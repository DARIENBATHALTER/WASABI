import { useState, useCallback } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DataSourceDetector } from '../../lib/auto-detector';
import { getDataAdapter } from '../../lib/adapters';
import { EnhancedFASTAdapter } from '../../lib/adapters/enhanced-fast-adapter';
import { db } from '../../lib/db';
import { StudentMatcher, type MatchSummary } from '../../lib/student-matching';
import { showToast } from '../../shared/components/Toast';
import type { DataSource } from '../../shared/types';

interface FileDetection {
  file: File;
  detectedType: string;
  confidence: number;
  suggestedName: string;
  reason: string;
}

interface FileUploadResult {
  file: File;
  selectedType: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: {
    recordCount: number;
    matchingSummary?: MatchSummary;
    errors: string[];
    warnings: string[];
  };
}

const dataTypeOptions = [
  { value: 'iready', label: 'iReady Assessment' },
  { value: 'fast', label: 'FAST Assessment' },
  { value: 'star', label: 'STAR Assessment' },
  { value: 'achieve3000', label: 'Achieve3000' },
  { value: 'attendance', label: 'Attendance Data' },
  { value: 'grades', label: 'Grade Data' },
];

export default function UploadDatasets() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileDetections, setFileDetections] = useState<FileDetection[]>([]);
  const [uploadResults, setUploadResults] = useState<FileUploadResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const queryClient = useQueryClient();

  const analyzeFiles = useCallback(async (files: File[]) => {
    const detections: FileDetection[] = [];
    
    for (const file of files) {
      try {
        // Parse a sample of the CSV to detect type
        const text = await file.text();
        const lines = text.split('\n').slice(0, 5);
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const detection = DataSourceDetector.detect(file.name, {
          headers,
          rows: []
        });
        
        detections.push({
          file,
          detectedType: detection.type === 'student-enrollment' ? 'iready' : detection.type, // Don't allow enrollment type
          confidence: detection.confidence,
          suggestedName: detection.suggestedName,
          reason: detection.reason,
        });
      } catch (error) {
        detections.push({
          file,
          detectedType: 'iready',
          confidence: 0,
          suggestedName: file.name,
          reason: 'Failed to analyze file',
        });
      }
    }
    
    setFileDetections(detections);
    setUploadResults(detections.map(d => ({
      file: d.file,
      selectedType: d.detectedType,
      status: 'pending' as const,
    })));
  }, []);

  const handleFileSelect = useCallback(async (files: File[]) => {
    const csvFiles = files.filter(file => 
      file.type === 'text/csv' || file.name.endsWith('.csv')
    );
    
    if (csvFiles.length === 0) {
      showToast({
        type: 'error',
        title: 'No CSV Files',
        message: 'Please select CSV files to upload.',
      });
      return;
    }
    
    setSelectedFiles(csvFiles);
    await analyzeFiles(csvFiles);
  }, [analyzeFiles]);

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
    handleFileSelect(files);
  }, [handleFileSelect]);

  const updateSelectedType = (fileIndex: number, newType: string) => {
    setUploadResults(prev => 
      prev.map((result, index) => 
        index === fileIndex 
          ? { ...result, selectedType: newType }
          : result
      )
    );
  };

  const processUploads = async () => {
    setIsProcessing(true);
    const updatedResults = [...uploadResults];
    
    for (let i = 0; i < updatedResults.length; i++) {
      const result = updatedResults[i];
      
      try {
        updatedResults[i] = { ...result, status: 'processing' };
        setUploadResults([...updatedResults]);
        
        // Special handling for FAST uploads using enhanced adapter
        if (result.selectedType === 'fast') {
          const enhancedAdapter = new EnhancedFASTAdapter();
          
          // Extract subject and grade from filename
          const filename = result.file.name.toLowerCase();
          let subject: 'ELA' | 'Math' | 'Science' | 'Writing' = 'ELA';
          let grade = '3'; // default
          
          if (filename.includes('math')) subject = 'Math';
          else if (filename.includes('science')) subject = 'Science';
          else if (filename.includes('writing')) subject = 'Writing';
          else if (filename.includes('ela') || filename.includes('reading')) subject = 'ELA';
          
          const gradeMatch = filename.match(/grade(\d+|k)/i);
          if (gradeMatch) {
            grade = gradeMatch[1].toLowerCase() === 'k' ? 'K' : gradeMatch[1];
          }
          
          console.log(`🎯 Processing FAST file "${result.file.name}" as ${subject} Grade ${grade}`);
          
          // Process with enhanced adapter
          const fastResult = await enhancedAdapter.processFile(result.file, subject, grade);
          
          // Create success result
          updatedResults[i] = {
            ...result,
            status: 'success',
            result: {
              recordCount: fastResult.processedRecords,
              matchingSummary: {
                exactMatches: fastResult.matchedRows,
                fuzzyMatches: 0,
                noMatches: fastResult.unmatchedRows,
                details: []
              } as MatchSummary,
              errors: fastResult.errors,
              warnings: []
            }
          };
          
          setUploadResults([...updatedResults]);
          continue; // Skip normal adapter processing for FAST files
        }
        
        // Normal adapter processing for non-FAST files
        const adapter = getDataAdapter(result.selectedType as any);
        
        // Parse CSV
        const parsedData = await adapter.parseCSV(result.file);
        
        // Validate data
        const validation = adapter.validateData(parsedData);
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        // Transform data
        const transformedData = await adapter.transformData(parsedData);
        
        let matchingSummary: MatchSummary | undefined;
        let successfulRecords = transformedData;
        
        // Handle student matching for assessment data
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
        
        // Save to database
        const dataSource: DataSource = {
          id: `${result.selectedType}_${Date.now()}_${i}`,
          name: fileDetections[i]?.suggestedName || result.file.name,
          type: result.selectedType,
          uploadDate: new Date(),
          recordCount: successfulRecords.length,
        };
        
        await db.transaction('rw', [db.dataSources, db.assessments, db.attendance, db.grades], async () => {
          // Save data source metadata
          await db.dataSources.add(dataSource);
          
          // Save the actual data based on type
          if (result.selectedType === 'attendance') {
            await db.attendance.bulkPut(successfulRecords);
          } else if (result.selectedType === 'grades') {
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
        if (matchingSummary.fuzzyMatches > 0) {
          warnings.push(`${matchingSummary.fuzzyMatches} records matched with low confidence`);
        }
        if (matchingSummary.noMatches > 0) {
          warnings.push(`${matchingSummary.noMatches} records could not be matched and were skipped`);
        }
        
        updatedResults[i] = {
          ...result,
          status: 'success',
          result: {
            recordCount: successfulRecords.length,
            matchingSummary,
            errors: [],
            warnings,
          }
        };
        
      } catch (error) {
        console.error('Error processing file:', error);
        updatedResults[i] = {
          ...result,
          status: 'error',
          result: {
            recordCount: 0,
            errors: [error instanceof Error ? error.message : 'Upload failed'],
            warnings: []
          }
        };
      }
      
      setUploadResults([...updatedResults]);
    }
    
    setIsProcessing(false);
    
    // Show summary toast
    const successful = updatedResults.filter(r => r.status === 'success').length;
    const failed = updatedResults.filter(r => r.status === 'error').length;
    
    if (successful > 0) {
      showToast({
        type: 'success',
        title: `Uploaded ${successful} dataset${successful > 1 ? 's' : ''} successfully!`,
        message: failed > 0 ? `${failed} file${failed > 1 ? 's' : ''} failed to upload.` : undefined,
        duration: 5000,
      });
    }
    
    if (failed > 0 && successful === 0) {
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: `${failed} file${failed > 1 ? 's' : ''} failed to upload.`,
      });
    }
    
    // Invalidate queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['data-sources'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['data-sources-with-stats'], refetchType: 'active' }),
      queryClient.invalidateQueries({ queryKey: ['admin-stats'], refetchType: 'active' })
    ]);
  };

  const resetUpload = () => {
    setSelectedFiles([]);
    setFileDetections([]);
    setUploadResults([]);
  };

  const getStatusIcon = (status: FileUploadResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      case 'processing':
        return <Loader className="h-5 w-5 animate-spin text-blue-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    }
  };

  if (selectedFiles.length === 0) {
    return (
      <div className="space-y-6">
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Upload Multiple Datasets</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Select multiple CSV files to upload. The system will automatically detect the data type and allow you to make adjustments before uploading.
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
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold">Review and Upload Datasets</h3>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Review the detected file types and make adjustments before uploading.
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={resetUpload}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg"
              disabled={isProcessing}
            >
              Reset
            </button>
            <button
              onClick={processUploads}
              disabled={isProcessing || uploadResults.every(r => r.status !== 'pending')}
              className="px-6 py-2 bg-wasabi-green text-white rounded-lg hover:bg-wasabi-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isProcessing ? 'Uploading...' : 'Upload All'}
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Filename
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dataset Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Detection
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Results
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {uploadResults.map((result, index) => {
                const detection = fileDetections[index];
                
                return (
                  <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      {getStatusIcon(result.status)}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {result.file.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {(result.file.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <select
                        value={result.selectedType}
                        onChange={(e) => updateSelectedType(index, e.target.value)}
                        disabled={result.status === 'processing' || result.status === 'success'}
                        className="text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800 focus:ring-wasabi-green focus:border-wasabi-green"
                      >
                        {dataTypeOptions.map(option => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm">
                        <div className="text-gray-900 dark:text-white">
                          {Math.round((detection?.confidence || 0) * 100)}% confidence
                        </div>
                        <div className="text-gray-500 dark:text-gray-400">
                          {detection?.reason || 'Unknown'}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {result.result && (
                        <div className="text-sm">
                          {result.status === 'success' && (
                            <div className="text-green-600 dark:text-green-400">
                              {result.result.recordCount} records imported
                              {result.result.matchingSummary && (
                                <div className="text-xs mt-1">
                                  {result.result.matchingSummary.exactMatches + result.result.matchingSummary.fuzzyMatches} matched,{' '}
                                  {result.result.matchingSummary.noMatches} skipped
                                </div>
                              )}
                            </div>
                          )}
                          {result.status === 'error' && result.result.errors.length > 0 && (
                            <div className="text-red-600 dark:text-red-400 text-xs">
                              {result.result.errors[0]}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}