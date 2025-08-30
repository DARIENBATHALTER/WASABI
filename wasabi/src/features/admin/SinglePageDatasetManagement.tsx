import { useState, useCallback } from 'react';
import { ArrowLeft, Users, Upload, Trash2, Database, FileText, CheckCircle, XCircle, Loader, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { studentMatcher } from '../../lib/studentMatcher';
import MatchingReportComponent from './MatchingReport';
import { DataSourceDetector } from '../../lib/auto-detector';
import { getDataAdapter } from '../../lib/adapters';
import { showToast } from '../../shared/components/Toast';
import type { DataSource, MatchingReport } from '../../shared/types';

interface SinglePageDatasetManagementProps {
  onBack: () => void;
}

interface OtherDatasetUpload {
  file: File;
  detectedType: string;
  confidence: number;
  suggestedName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  result?: {
    recordCount: number;
    errors: string[];
    warnings: string[];
    matchingReport?: MatchingReport;
  };
}

const dataTypeOptions = [
  { value: 'iready-reading', label: 'iReady Reading Assessment' },
  { value: 'iready-math', label: 'iReady Math Assessment' },
  { value: 'fast-reading', label: 'FAST Reading/ELA Assessment' },
  { value: 'fast-math', label: 'FAST Math Assessment' },
  { value: 'star-early-literacy', label: 'STAR Early Literacy Assessment' },
  { value: 'star-math', label: 'STAR Math Assessment' },
  { value: 'achieve3000', label: 'Achieve3000' },
  { value: 'attendance', label: 'Attendance Data' },
  { value: 'grades', label: 'Grade Data' },
];

export default function SinglePageDatasetManagement({ onBack }: SinglePageDatasetManagementProps) {
  const [isUploadingEnrollment, setIsUploadingEnrollment] = useState(false);
  const [otherDatasetUploads, setOtherDatasetUploads] = useState<OtherDatasetUpload[]>([]);
  const [isProcessingOther, setIsProcessingOther] = useState(false);
  const [showingMatchingReport, setShowingMatchingReport] = useState<MatchingReport | null>(null);
  
  const queryClient = useQueryClient();

  // Get database stats
  const { data: dbStats } = useQuery({
    queryKey: ['db-stats'],
    queryFn: async () => {
      const [studentCount, dataSourceCount, assessmentCount, attendanceCount, gradeCount] = await Promise.all([
        db.students.count(),
        db.dataSources.count(),
        db.assessments.count(),
        db.attendance.count(),
        db.grades.count(),
      ]);
      return { studentCount, dataSourceCount, assessmentCount, attendanceCount, gradeCount };
    },
    refetchInterval: 2000, // Update every 2 seconds
  });

  // Get enrollment data source
  const { data: enrollmentSource } = useQuery({
    queryKey: ['enrollment-source'],
    queryFn: async () => {
      const sources = await db.dataSources.where('type').equals('student-enrollment').toArray();
      return sources[0] || null;
    },
    refetchInterval: 2000,
  });

  // Get other data sources
  const { data: otherSources } = useQuery({
    queryKey: ['other-sources'],
    queryFn: async () => {
      const sources = await db.dataSources.where('type').notEqual('student-enrollment').toArray();
      return sources;
    },
    refetchInterval: 2000,
  });

  const handleClearDatabase = async () => {
    if (!confirm('Are you sure you want to clear ALL data? This will delete everything including students, assessments, attendance, grades, and data sources. This action cannot be undone.')) {
      return;
    }

    try {
      await db.transaction('rw', [db.students, db.assessments, db.attendance, db.grades, db.dataSources], async () => {
        await db.students.clear();
        await db.assessments.clear();
        await db.attendance.clear();
        await db.grades.clear();
        await db.dataSources.clear();
      });

      showToast({
        type: 'success',
        title: 'Database Cleared',
        message: 'All data has been permanently deleted.',
        duration: 5000,
      });

      // Refresh all queries
      await queryClient.invalidateQueries();

    } catch (error) {
      console.error('Error clearing database:', error);
      showToast({
        type: 'error',
        title: 'Clear Failed',
        message: error instanceof Error ? error.message : 'Failed to clear database',
      });
    }
  };

  const handleEnrollmentUpload = useCallback(async (file: File) => {
    setIsUploadingEnrollment(true);

    try {
      // Parse and detect
      const text = await file.text();
      const lines = text.split('\n').slice(0, 5);
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const detection = DataSourceDetector.detect(file.name, { headers, rows: [] });

      if (detection.type !== 'student-enrollment') {
        showToast({
          type: 'error',
          title: 'Invalid File Type',
          message: 'Please upload a student enrollment CSV file',
        });
        return;
      }

      const adapter = getDataAdapter('student-enrollment');
      const parsedData = await adapter.parseCSV(file);
      const validation = adapter.validateData(parsedData);
      
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      const transformedData = await adapter.transformData(parsedData);
      const students = transformedData.filter(record => record.type === 'student' || !record.type);
      
      if (students.length === 0) {
        throw new Error('No student records found in the uploaded file');
      }

      // Save to database
      const dataSource: DataSource = {
        id: `student_enrollment_${Date.now()}`,
        name: `Student Enrollment - ${file.name}`,
        type: 'student-enrollment',
        uploadDate: new Date(),
        recordCount: students.length,
      };
      
      await db.transaction('rw', [db.dataSources, db.students, db.assessments, db.attendance, db.grades], async () => {
        // Clear existing data
        await db.students.clear();
        await db.dataSources.where('type').equals('student-enrollment').delete();
        await db.assessments.clear();
        await db.attendance.clear();
        await db.grades.clear();
        await db.dataSources.where('type').notEqual('student-enrollment').delete();
        
        // Save new data
        await db.dataSources.add(dataSource);
        await db.students.bulkPut(students);
      });

      showToast({
        type: 'success',
        title: `Imported ${students.length} students successfully!`,
        message: 'Previous assessment data cleared. Upload new datasets below.',
        duration: 6000,
      });

      // Clear other uploads since they need to be re-uploaded
      setOtherDatasetUploads([]);
      
      await queryClient.invalidateQueries();

    } catch (error) {
      console.error('Error processing enrollment file:', error);
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsUploadingEnrollment(false);
    }
  }, [queryClient]);

  const handleDeleteEnrollment = async () => {
    if (!confirm('Are you sure you want to delete the student enrollment data? This will also clear all other datasets.')) {
      return;
    }

    try {
      await db.transaction('rw', [db.dataSources, db.students, db.assessments, db.attendance, db.grades], async () => {
        await db.students.clear();
        await db.dataSources.where('type').equals('student-enrollment').delete();
        await db.assessments.clear();
        await db.attendance.clear();
        await db.grades.clear();
        await db.dataSources.where('type').notEqual('student-enrollment').delete();
      });

      showToast({
        type: 'success',
        title: 'Enrollment Data Deleted',
        message: 'All data has been cleared.',
      });

      setOtherDatasetUploads([]);
      await queryClient.invalidateQueries();

    } catch (error) {
      console.error('Error deleting enrollment:', error);
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'Failed to delete enrollment data',
      });
    }
  };

  const handleOtherDatasetSelect = useCallback(async (files: File[]) => {
    if (!enrollmentSource) {
      showToast({
        type: 'error',
        title: 'Enrollment Required',
        message: 'Please upload student enrollment data first.',
      });
      return;
    }

    const uploads: OtherDatasetUpload[] = [];
    
    for (const file of files) {
      try {
        const text = await file.text();
        const lines = text.split('\n').slice(0, 5);
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        
        const detection = DataSourceDetector.detect(file.name, { headers, rows: [] });
        
        uploads.push({
          file,
          detectedType: detection.type === 'student-enrollment' ? 'iready' : detection.type,
          confidence: detection.confidence,
          suggestedName: detection.suggestedName,
          status: 'pending',
        });
      } catch (error) {
        uploads.push({
          file,
          detectedType: 'iready',
          confidence: 0,
          suggestedName: file.name,
          status: 'error',
          result: {
            recordCount: 0,
            errors: ['Failed to analyze file'],
            warnings: []
          }
        });
      }
    }
    
    setOtherDatasetUploads(uploads);
  }, [enrollmentSource]);

  const updateUploadType = (index: number, newType: string) => {
    setOtherDatasetUploads(prev => 
      prev.map((upload, i) => 
        i === index ? { ...upload, detectedType: newType } : upload
      )
    );
  };

  const processOtherUploads = async () => {
    setIsProcessingOther(true);
    const updatedUploads = [...otherDatasetUploads];
    
    for (let i = 0; i < updatedUploads.length; i++) {
      const upload = updatedUploads[i];
      
      try {
        updatedUploads[i] = { ...upload, status: 'processing' };
        setOtherDatasetUploads([...updatedUploads]);
        
        const adapter = getDataAdapter(upload.detectedType as any);
        const parsedData = await adapter.parseCSV(upload.file);
        const validation = adapter.validateData(parsedData);
        
        if (!validation.isValid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        // Use the new matching system if adapter supports it
        let transformedData;
        let matchingReport;
        
        if ('transformDataWithMatching' in adapter && typeof adapter.transformDataWithMatching === 'function') {
          const result = await adapter.transformDataWithMatching(parsedData);
          transformedData = result.data;
          matchingReport = result.matchingReport;
        } else {
          // Fallback to old method for adapters not yet updated
          transformedData = await adapter.transformData(parsedData);
          // Create a basic matching report
          matchingReport = {
            datasetType: upload.detectedType,
            datasetName: upload.suggestedName || upload.file.name,
            uploadDate: new Date(),
            totalStudentsInEnrollment: 0,
            totalRowsInDataset: transformedData.length,
            matchedStudents: transformedData.length,
            unmatchedRows: 0,
            duplicateMatches: 0,
            matchRate: 100,
            confidence: { high: transformedData.length, medium: 0, low: 0, uncertain: 0 },
            unmatchedStudentNames: []
          };
        }
          
        if (transformedData.length === 0) {
          throw new Error('No records could be matched to enrolled students');
        }
        
        // Save to database
        const dataSource: DataSource = {
          id: `${upload.detectedType}_${Date.now()}_${i}`,
          name: upload.suggestedName || upload.file.name,
          type: upload.detectedType as any,
          uploadDate: new Date(),
          recordCount: transformedData.length,
        };
        
        await db.transaction('rw', [db.dataSources, db.assessments, db.attendance, db.grades, db.matchingReports], async () => {
          await db.dataSources.add(dataSource);
          
          // Save the matching report
          await db.matchingReports.add(matchingReport);
          
          if (upload.detectedType === 'attendance') {
            await db.attendance.bulkPut(transformedData);
          } else if (upload.detectedType === 'grades') {
            await db.grades.bulkPut(transformedData);
          } else {
            await db.assessments.bulkPut(transformedData);
          }
        });
        
        updatedUploads[i] = {
          ...upload,
          status: 'success',
          result: {
            recordCount: transformedData.length,
            errors: [],
            warnings: matchingReport.matchRate < 90 ? [`Match rate: ${matchingReport.matchRate}%`] : [],
            matchingReport,
          }
        };
        
      } catch (error) {
        console.error('Error processing file:', error);
        updatedUploads[i] = {
          ...upload,
          status: 'error',
          result: {
            recordCount: 0,
            errors: [error instanceof Error ? error.message : 'Upload failed'],
            warnings: []
          }
        };
      }
      
      setOtherDatasetUploads([...updatedUploads]);
    }
    
    setIsProcessingOther(false);
    await queryClient.invalidateQueries();
    
    const successful = updatedUploads.filter(u => u.status === 'success').length;
    if (successful > 0) {
      showToast({
        type: 'success',
        title: `Uploaded ${successful} dataset${successful > 1 ? 's' : ''} successfully!`,
        duration: 5000,
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'processing': return <Loader className="h-5 w-5 animate-spin text-blue-600" />;
      default: return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Manage Datasets
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Upload and manage student data sources
          </p>
        </div>
      </div>

      {/* Database Stats */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold mb-2">Database Status</h2>
            <div className="flex space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-wasabi-green" />
                <span><strong>{dbStats?.studentCount || 0}</strong> students</span>
              </div>
              <div className="flex items-center space-x-2">
                <Database className="h-4 w-4 text-blue-600" />
                <span><strong>{dbStats?.dataSourceCount || 0}</strong> data sources</span>
              </div>
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-purple-600" />
                <span><strong>{(dbStats?.assessmentCount || 0) + (dbStats?.attendanceCount || 0) + (dbStats?.gradeCount || 0)}</strong> total records</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleClearDatabase}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 size={16} />
            <span>Clear Database</span>
          </button>
        </div>
      </div>

      {/* Student Enrollment Section */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Student Enrollment Data</h2>
        
        {enrollmentSource ? (
          <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-700">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  {enrollmentSource.name}
                </p>
                <p className="text-sm text-green-600 dark:text-green-300">
                  {enrollmentSource.recordCount} students • Uploaded {enrollmentSource.uploadDate.toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={handleDeleteEnrollment}
              className="flex items-center space-x-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>
        ) : (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Upload Student Enrollment Data
            </p>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Start by uploading your student enrollment CSV file
            </p>
            
            <input
              type="file"
              accept=".csv"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length > 0) handleEnrollmentUpload(files[0]);
              }}
              disabled={isUploadingEnrollment}
              className="hidden"
              id="enrollment-upload"
            />
            <label
              htmlFor="enrollment-upload"
              className={`
                inline-flex items-center space-x-2 px-6 py-3 rounded-lg cursor-pointer transition-colors
                ${isUploadingEnrollment 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-wasabi-green hover:bg-wasabi-green/90'
                } text-white
              `}
            >
              {isUploadingEnrollment ? (
                <>
                  <Loader className="h-5 w-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span>Select Enrollment File</span>
                </>
              )}
            </label>
          </div>
        )}
      </div>

      {/* Other Datasets Section */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Assessment & Other Data</h2>
        
        {!enrollmentSource ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <AlertTriangle className="mx-auto h-12 w-12 mb-4" />
            <p>Upload student enrollment data first before adding other datasets.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Existing Sources */}
            {otherSources && otherSources.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Uploaded Datasets</h3>
                {otherSources.map((source) => (
                  <div key={source.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {source.recordCount} records • {source.type}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Interface */}
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Upload New Datasets</h3>
              
              <input
                type="file"
                multiple
                accept=".csv"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) handleOtherDatasetSelect(files);
                }}
                className="hidden"
                id="other-upload"
              />
              <label
                htmlFor="other-upload"
                className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
              >
                <Upload className="h-5 w-5" />
                <span>Select Files</span>
              </label>

              {/* File Analysis */}
              {otherDatasetUploads.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">Review Files</h4>
                    <button
                      onClick={processOtherUploads}
                      disabled={isProcessingOther || otherDatasetUploads.every(u => u.status !== 'pending')}
                      className="px-4 py-2 bg-wasabi-green text-white rounded-lg hover:bg-wasabi-green/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessingOther ? 'Processing...' : 'Upload All'}
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    {otherDatasetUploads.map((upload, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center space-x-3 mb-2">
                          {getStatusIcon(upload.status)}
                          <div className="flex-1">
                            <p className="font-medium">{upload.file.name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {Math.round(upload.confidence * 100)}% confidence
                            </p>
                          </div>
                          <select
                            value={upload.detectedType}
                            onChange={(e) => updateUploadType(index, e.target.value)}
                            disabled={upload.status === 'processing' || upload.status === 'success'}
                            className="text-sm rounded border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                          >
                            {dataTypeOptions.map(option => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        {upload.result && (
                          <div className="text-sm space-y-2">
                            {upload.status === 'success' && (
                              <div className="space-y-2">
                                <p className="text-green-600">
                                  Successfully imported {upload.result.recordCount} records
                                </p>
                                {upload.result.matchingReport && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600 dark:text-gray-400">
                                      Match rate: {upload.result.matchingReport.matchRate}%
                                    </span>
                                    <button
                                      onClick={() => setShowingMatchingReport(upload.result!.matchingReport!)}
                                      className="text-blue-600 hover:text-blue-800 underline text-xs"
                                    >
                                      View Matching Report
                                    </button>
                                  </div>
                                )}
                                {upload.result.warnings.map((warning, i) => (
                                  <p key={i} className="text-yellow-600 text-xs">{warning}</p>
                                ))}
                              </div>
                            )}
                            {upload.status === 'error' && upload.result.errors.length > 0 && (
                              <p className="text-red-600">{upload.result.errors[0]}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Matching Report Modal */}
      {showingMatchingReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <MatchingReportComponent
              report={showingMatchingReport}
              datasetName={showingMatchingReport.datasetName}
              onClose={() => setShowingMatchingReport(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}