import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, XCircle, AlertTriangle, Loader, Users, Database } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { DataSourceDetector } from '../../lib/auto-detector';
import { getDataAdapter } from '../../lib/adapters';
import { db } from '../../lib/db';
import { StudentMatcher, type MatchSummary } from '../../lib/student-matching';
import type { DataSource } from '../../shared/types';

interface FileAnalysis {
  file: File;
  detection: any;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: {
    recordCount: number;
    errors: string[];
    warnings: string[];
    matchingSummary?: MatchSummary;
  };
}

export default function BulkUpload() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileAnalyses, setFileAnalyses] = useState<FileAnalysis[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const queryClient = useQueryClient();

  // Check if enrollment data exists
  const { data: hasEnrollment } = useQuery({
    queryKey: ['has-enrollment'],
    queryFn: () => StudentMatcher.hasEnrollmentData(),
    staleTime: 0, // Always fresh - critical for UI flow
    refetchOnWindowFocus: true,
  });

  // Get enrollment stats
  const { data: enrollmentStats } = useQuery({
    queryKey: ['enrollment-stats'],
    queryFn: () => StudentMatcher.getEnrollmentStats(),
    enabled: hasEnrollment === true,
    staleTime: 30 * 1000, // 30 seconds - can be slightly cached
  });

  const handleFileSelect = useCallback(async (files: File[]) => {
    setSelectedFiles(files);
    setIsProcessing(true);
    
    // Analyze and immediately process each file
    const analyses: FileAnalysis[] = [];
    
    for (const file of files) {
      try {
        // Parse a sample of the CSV to detect type
        const text = await file.text();
        const lines = text.split('\n').slice(0, 5); // First 5 lines
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const detection = DataSourceDetector.detect(file.name, {
          headers,
          rows: []
        });
        
        analyses.push({
          file,
          detection,
          status: 'processing'
        });
      } catch (error) {
        analyses.push({
          file,
          detection: {
            type: 'unknown',
            confidence: 0,
            reason: 'Failed to parse file',
            suggestedName: file.name
          },
          status: 'error',
          result: {
            recordCount: 0,
            errors: [`Failed to analyze file: ${error instanceof Error ? error.message : 'Unknown error'}`],
            warnings: []
          }
        });
      }
    }
    
    setFileAnalyses(analyses);
    
    // Immediately process the files
    await processFilesImmediate(analyses);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files).filter(file => 
      file.type === 'text/csv' || file.name.endsWith('.csv')
    );
    
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  const processFilesImmediate = async (analyses: FileAnalysis[]) => {
    // Sort files to process enrollment first
    const sortedAnalyses = [...analyses].sort((a, b) => {
      if (a.detection.type === 'student-enrollment') return -1;
      if (b.detection.type === 'student-enrollment') return 1;
      return 0;
    });
    
    const updatedAnalyses = [...analyses];
    
    for (let i = 0; i < sortedAnalyses.length; i++) {
      const analysis = sortedAnalyses[i];
      const index = analyses.findIndex(a => a.file === analysis.file);
      
      try {
        console.log('Processing file:', analysis.file.name, 'Type:', analysis.detection.type);
        
        updatedAnalyses[index] = { ...analysis, status: 'processing' };
        setFileAnalyses([...updatedAnalyses]);
        
        const adapter = getDataAdapter(analysis.detection.type === 'unknown' ? 'student-enrollment' : analysis.detection.type);
        
        // Parse CSV
        const parsedData = await adapter.parseCSV(analysis.file);
        console.log('Parsed data:', parsedData.headers, 'Rows:', parsedData.rows.length);
        
        // Validate data
        const validation = adapter.validateData(parsedData);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        // Transform data
        const transformedData = await adapter.transformData(parsedData);
        console.log('Transformed data:', transformedData.length, 'records');
        
        let matchingSummary: MatchSummary | undefined;
        let successfulRecords = transformedData;
        
        // Handle student matching for non-enrollment data
        if (analysis.detection.type !== 'student-enrollment') {
          const matcher = new StudentMatcher();
          
          // Extract student candidates from the data
          const candidates = transformedData.map(record => ({
            studentId: record.studentId,
            firstName: record.firstName,
            lastName: record.lastName,
            fullName: record.fullName,
            grade: record.grade || record.gradeLevel,
            className: record.className,
            originalRecord: record
          }));
          
          matchingSummary = await matcher.matchBatch(candidates);
          
          // Filter to only successfully matched records
          successfulRecords = matchingSummary.details
            .filter(detail => detail.result.success && detail.result.matchedStudent)
            .map(detail => ({
              ...detail.sourceData.originalRecord,
              studentId: detail.result.matchedStudent!.id,
            }));
            
          if (successfulRecords.length === 0) {
            throw new Error('No records could be matched to enrolled students');
          }
        }
        
        // Save to database
        const dataSource: DataSource = {
          id: `${analysis.detection.type}_${Date.now()}_${i}`,
          name: analysis.detection.suggestedName || analysis.file.name,
          type: analysis.detection.type === 'unknown' ? 'student-enrollment' : analysis.detection.type,
          uploadDate: new Date(),
          recordCount: successfulRecords.length,
        };
        
        await db.transaction('rw', [db.dataSources, db.students, db.assessments, db.attendance, db.grades], async () => {
          // Save data source metadata
          await db.dataSources.add(dataSource);
          
          // Save the actual data based on type
          if (analysis.detection.type === 'student-enrollment') {
            // Student enrollment data
            const students = successfulRecords.filter(record => record.type === 'student' || !record.type);
            console.log('Processing student enrollment data:', {
              totalRecords: successfulRecords.length,
              studentRecords: students.length,
              sampleRecord: students[0]
            });
            if (students.length) {
              await db.students.bulkPut(students);
              console.log('Successfully saved', students.length, 'students to database');
            } else {
              console.warn('No student records found to save');
            }
          } else if (analysis.detection.type === 'attendance') {
            await db.attendance.bulkPut(successfulRecords);
          } else if (analysis.detection.type === 'grades') {
            await db.grades.bulkPut(successfulRecords);
          } else {
            // Assessment data
            const cleanRecords = successfulRecords.map(record => {
              const { originalRecord, matchConfidence, matchedBy, ...cleanRecord } = record;
              return cleanRecord;
            });
            await db.assessments.bulkPut(cleanRecords);
          }
        });
        
        const warnings = [...validation.warnings];
        if (matchingSummary) {
          if (matchingSummary.fuzzyMatches > 0) {
            warnings.push(`${matchingSummary.fuzzyMatches} records matched with low confidence`);
          }
          if (matchingSummary.noMatches > 0) {
            warnings.push(`${matchingSummary.noMatches} records could not be matched and were skipped`);
          }
        }
        
        updatedAnalyses[index] = {
          ...analysis,
          status: 'success',
          result: {
            recordCount: successfulRecords.length,
            errors: [],
            warnings,
            matchingSummary,
          }
        };
        
      } catch (error) {
        console.error('Error processing file:', error);
        updatedAnalyses[index] = {
          ...analysis,
          status: 'error',
          result: {
            recordCount: 0,
            errors: [error instanceof Error ? error.message : 'Upload failed'],
            warnings: []
          }
        };
      }
      
      setFileAnalyses([...updatedAnalyses]);
    }
    
    setIsProcessing(false);
    
    // Small delay to ensure database transactions are complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Invalidate queries and force immediate refetch
    console.log('Invalidating queries after upload...');
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['data-sources'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['has-enrollment'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['enrollment-stats'], refetchType: 'active' })
    ]);
    console.log('Query invalidation complete');
  };

  const resetUpload = () => {
    setSelectedFiles([]);
    setFileAnalyses([]);
  };

  if (!hasEnrollment) {
    return (
      <div className="text-center py-12">
        <Users className="mx-auto h-16 w-16 text-gray-400 mb-6" />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Start with Student Enrollment
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
          Upload your student enrollment CSV file to begin. All other data will be matched against these enrolled students.
        </p>
        
        <div className="max-w-lg mx-auto">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-lg p-8 transition-colors duration-200
              ${isDragging
                ? 'border-wasabi-green bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-gray-600'
              }
            `}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Upload Student Enrollment Data
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Drag and drop your FOCUS student CSV file here, or click to browse
            </p>
            
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) handleFileSelect(files);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          
          {isProcessing && (
            <div className="mt-6 text-center">
              <Loader className="animate-spin mx-auto h-8 w-8 text-wasabi-green mb-2" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Processing enrollment data...
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enrollment Status */}
      <div className="card border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20">
        <div className="flex items-start space-x-3">
          <Users className="h-5 w-5 text-green-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold">Student Enrollment Active</h3>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <strong>{enrollmentStats?.totalStudents}</strong> students enrolled
                {enrollmentStats?.lastUpdated && (
                  <span> • Last updated {enrollmentStats.lastUpdated.toLocaleDateString()}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Upload Interface */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Bulk Data Import</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Upload multiple CSV files at once. The system will automatically detect the data type and import accordingly.
        </p>
        
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200
            ${isDragging
              ? 'border-wasabi-green bg-green-50 dark:bg-green-900/20'
              : 'border-gray-300 dark:border-gray-600'
            }
          `}
        >
          <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Drop CSV files here or click to browse
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            Supports iReady, FAST, STAR, Attendance, and GPA data
          </p>
          
          <input
            type="file"
            multiple
            accept=".csv"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) handleFileSelect(files);
            }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>

      {/* File Analysis Results */}
      {fileAnalyses.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {isProcessing ? 'Processing Files...' : 'Import Results'}
            </h3>
            {!isProcessing && (
              <button
                onClick={resetUpload}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
              >
                Upload More Files
              </button>
            )}
          </div>
          
          <div className="space-y-3">
            {fileAnalyses.map((analysis, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <div className="font-medium">{analysis.file.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {analysis.detection.suggestedName} ({Math.round(analysis.detection.confidence * 100)}% confidence)
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {analysis.status === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
                    {analysis.status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
                    {analysis.status === 'processing' && <Loader className="h-5 w-5 animate-spin text-blue-600" />}
                    {analysis.status === 'pending' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  {analysis.detection.reason}
                </p>
                
                {analysis.result && (
                  <div className="text-sm">
                    {analysis.result.errors.length > 0 && (
                      <div className="text-red-600 mb-1">
                        Errors: {analysis.result.errors.join(', ')}
                      </div>
                    )}
                    {analysis.result.warnings.length > 0 && (
                      <div className="text-yellow-600 mb-1">
                        Warnings: {analysis.result.warnings.join(', ')}
                      </div>
                    )}
                    {analysis.status === 'success' && (
                      <div className="text-green-600">
                        Successfully imported {analysis.result.recordCount} records
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}