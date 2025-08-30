import { useState, useCallback, useEffect } from 'react';
import { Upload, File, CheckCircle, XCircle, AlertTriangle, Loader, Users, Lock } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { getDataAdapter } from '../../lib/adapters';
import { db } from '../../lib/db';
import { StudentMatcher, type MatchSummary } from '../../lib/student-matching';
import type { DataSource } from '../../shared/types';
import SimpleFileUpload from './SimpleFileUpload';

const DATA_SOURCE_TYPES = [
  { value: 'focus', label: 'FOCUS (School Information System)', description: 'Student enrollment, grades, attendance', required: true },
  { value: 'iready', label: 'iReady', description: 'Reading and math diagnostic assessments', requiresEnrollment: true },
  { value: 'fast', label: 'FAST', description: 'Florida Assessment of Student Thinking', requiresEnrollment: true },
  { value: 'star', label: 'STAR', description: 'Renaissance reading and math assessments', requiresEnrollment: true },
  { value: 'achieve3000', label: 'Achieve3000', description: 'Literacy assessment data', requiresEnrollment: true },
];

interface UploadResult {
  success: boolean;
  recordCount: number;
  errors: string[];
  warnings: string[];
  matchingSummary?: MatchSummary;
}

export default function CSVUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedType, setSelectedType] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  
  const queryClient = useQueryClient();

  // Check if enrollment data exists
  const { data: hasEnrollment, isLoading: checkingEnrollment } = useQuery({
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

  const uploadMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: string }) => {
      const adapter = getDataAdapter(type as any);
      
      // Parse CSV
      const parsedData = await adapter.parseCSV(file);
      
      // Validate data
      const validation = adapter.validateData(parsedData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Transform data
      const transformedData = await adapter.transformData(parsedData);
      
      let matchingSummary: MatchSummary | undefined;
      let successfulRecords = transformedData;
      
      // Handle student matching for non-enrollment data
      if (type !== 'focus') {
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
            studentId: detail.result.matchedStudent!.id, // Use the matched student ID
            matchConfidence: detail.result.confidence,
            matchedBy: detail.result.matchedBy,
          }));
          
        if (successfulRecords.length === 0) {
          throw new Error('No records could be matched to enrolled students');
        }
      }
      
      // Save to database
      const dataSource: DataSource = {
        id: `${type}_${Date.now()}`,
        name: `${adapter.description} - ${file.name}`,
        type: type as any,
        uploadDate: new Date(),
        recordCount: successfulRecords.length,
      };
      
      await db.transaction('rw', [db.dataSources, db.students, db.assessments, db.attendance, db.grades], async () => {
        // Save data source metadata
        await db.dataSources.add(dataSource);
        
        // Save the actual data based on type
        if (type === 'focus') {
          // FOCUS data contains students, grades, and attendance
          const students = successfulRecords.filter(record => record.type === 'student');
          const grades = successfulRecords.filter(record => record.type === 'grade');
          const attendance = successfulRecords.filter(record => record.type === 'attendance');
          
          if (students.length) await db.students.bulkPut(students);
          if (grades.length) await db.grades.bulkPut(grades);
          if (attendance.length) await db.attendance.bulkPut(attendance);
        } else {
          // Assessment data - clean the records first
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
      
      return {
        success: true,
        recordCount: successfulRecords.length,
        errors: [],
        warnings,
        matchingSummary,
      };
    },
    onSuccess: (result) => {
      setUploadResult(result);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['data-sources'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['has-enrollment'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['enrollment-stats'], refetchType: 'active' })
      ]);
      
      // Reset form
      setSelectedFile(null);
      setSelectedType('');
    },
    onError: (error) => {
      setUploadResult({
        success: false,
        recordCount: 0,
        errors: [error instanceof Error ? error.message : 'Upload failed'],
        warnings: [],
      });
    },
  });

  const handleFileSelect = useCallback((file: File) => {
    console.log('File selected:', file);
    
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setUploadResult({
        success: false,
        recordCount: 0,
        errors: ['Please select a CSV file'],
        warnings: [],
      });
      return;
    }
    
    setSelectedFile(file);
    setUploadResult(null);
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
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleUpload = () => {
    console.log('Upload clicked - File:', selectedFile, 'Type:', selectedType);
    if (!selectedFile || !selectedType) return;
    
    uploadMutation.mutate({ file: selectedFile, type: selectedType });
  };

  return (
    <div className="space-y-6">
      {/* Debug File Upload */}
      <SimpleFileUpload />
      
      {/* Enrollment Status */}
      {!checkingEnrollment && (
        <div className={`
          card border-l-4 ${hasEnrollment 
            ? 'border-l-green-500 bg-green-50 dark:bg-green-900/20' 
            : 'border-l-amber-500 bg-amber-50 dark:bg-amber-900/20'
          }
        `}>
          <div className="flex items-start space-x-3">
            <Users className={`h-5 w-5 mt-0.5 ${hasEnrollment ? 'text-green-600' : 'text-amber-600'}`} />
            <div className="flex-1">
              <h3 className="font-semibold">
                {hasEnrollment ? 'Student Enrollment Active' : 'Student Enrollment Required'}
              </h3>
              
              {hasEnrollment ? (
                <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  <p>
                    <strong>{enrollmentStats?.totalStudents}</strong> students enrolled
                    {enrollmentStats?.lastUpdated && (
                      <span> • Last updated {enrollmentStats.lastUpdated.toLocaleDateString()}</span>
                    )}
                  </p>
                  {enrollmentStats?.gradeDistribution && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {Object.entries(enrollmentStats.gradeDistribution).map(([grade, count]) => (
                        <span key={grade} className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">
                          Grade {grade}: {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  Upload student enrollment data from FOCUS first. Assessment data requires enrolled students for matching.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Data Source Type Selection */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Select Data Source Type</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DATA_SOURCE_TYPES.map((type) => {
            const isDisabled = type.requiresEnrollment && !hasEnrollment;
            
            return (
              <button
                key={type.value}
                onClick={() => !isDisabled && setSelectedType(type.value)}
                disabled={isDisabled}
                className={`
                  p-4 rounded-lg border-2 text-left transition-all duration-200 relative
                  ${isDisabled
                    ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-60 cursor-not-allowed'
                    : selectedType === type.value
                    ? 'border-wasabi-green bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                  }
                `}
              >
                {isDisabled && (
                  <Lock className="absolute top-2 right-2 h-4 w-4 text-gray-400" />
                )}
                
                <div className="flex items-center gap-2">
                  <div className="font-medium text-gray-900 dark:text-white">
                    {type.label}
                  </div>
                  {type.required && (
                    <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">
                      Required First
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {type.description}
                </div>
                {isDisabled && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Requires student enrollment data
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* File Upload */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-4">Upload CSV File</h2>
        
        <div className="relative">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 relative
              ${isDragging
                ? 'border-wasabi-green bg-green-50 dark:bg-green-900/20'
                : 'border-gray-300 dark:border-gray-600'
              }
            `}
          >
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            
            {selectedFile ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center space-x-2">
                  <File className="h-5 w-5 text-wasabi-green" />
                  <span className="font-medium">{selectedFile.name}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Drop your CSV file here, or click to browse
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  Supports CSV files up to 10MB
                </p>
              </div>
            )}
            
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileSelect(file);
                }
                // Reset the input so the same file can be selected again
                e.target.value = '';
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              style={{ pointerEvents: 'auto' }}
            />
          </div>
        </div>
      </div>

      {/* Upload Button */}
      <div className="flex justify-end">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || !selectedType || uploadMutation.isPending}
          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {uploadMutation.isPending ? (
            <Loader className="animate-spin" size={16} />
          ) : (
            <Upload size={16} />
          )}
          <span>
            {uploadMutation.isPending ? 'Processing...' : 'Upload & Process'}
          </span>
        </button>
      </div>

      {/* Upload Result */}
      {uploadResult && (
        <div className="space-y-4">
          <div className={`
            card border-l-4
            ${uploadResult.success
              ? 'border-l-green-500 bg-green-50 dark:bg-green-900/20'
              : 'border-l-red-500 bg-red-50 dark:bg-red-900/20'
            }
          `}>
            <div className="flex items-start space-x-3">
              {uploadResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
              )}
              
              <div className="flex-1">
                <h3 className="font-semibold">
                  {uploadResult.success ? 'Upload Successful!' : 'Upload Failed'}
                </h3>
                
                {uploadResult.success && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Successfully processed {uploadResult.recordCount} records
                  </p>
                )}
                
                {uploadResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-red-600">Errors:</p>
                    <ul className="text-sm text-red-600 mt-1 list-disc list-inside">
                      {uploadResult.errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {uploadResult.warnings.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center space-x-1">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <p className="text-sm font-medium text-yellow-600">Warnings:</p>
                    </div>
                    <ul className="text-sm text-yellow-600 mt-1 list-disc list-inside">
                      {uploadResult.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Student Matching Results */}
          {uploadResult.matchingSummary && (
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Student Matching Results</h3>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {uploadResult.matchingSummary.exactMatches}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Exact Matches</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {uploadResult.matchingSummary.fuzzyMatches}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Fuzzy Matches</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {uploadResult.matchingSummary.multipleMatches}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Multiple Matches</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {uploadResult.matchingSummary.noMatches}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">No Matches</div>
                </div>
              </div>

              {/* Detailed Results */}
              {uploadResult.matchingSummary.details.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Match Details</h4>
                  <div className="max-h-64 overflow-y-auto">
                    <div className="space-y-2">
                      {uploadResult.matchingSummary.details
                        .filter(detail => !detail.result.success || detail.result.confidence !== 'exact')
                        .slice(0, 10) // Show first 10 problematic matches
                        .map((detail, index) => (
                        <div key={index} className={`
                          p-3 rounded border text-sm
                          ${detail.result.success
                            ? 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20'
                            : 'border-red-200 bg-red-50 dark:bg-red-900/20'
                          }
                        `}>
                          <div className="font-medium">
                            Source: {detail.sourceData.firstName} {detail.sourceData.lastName}
                            {detail.sourceData.grade && ` (Grade ${detail.sourceData.grade})`}
                          </div>
                          <div className="text-gray-600 dark:text-gray-400 mt-1">
                            {detail.result.reason}
                          </div>
                          {detail.result.alternatives && detail.result.alternatives.length > 0 && (
                            <div className="mt-2">
                              <span className="text-xs text-gray-500">Possible matches: </span>
                              {detail.result.alternatives.slice(0, 3).map((alt, i) => (
                                <span key={i} className="text-xs text-blue-600 mr-2">
                                  {alt.firstName} {alt.lastName} (Grade {alt.grade})
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {uploadResult.matchingSummary.details.length > 10 && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
                      Showing first 10 entries. Total: {uploadResult.matchingSummary.details.length}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}