import { useState, useCallback } from 'react';
import { Upload, Users, Loader, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { DataSourceDetector } from '../../lib/auto-detector';
import { getDataAdapter } from '../../lib/adapters';
import { db } from '../../lib/db';
import { showToast } from '../../shared/components/Toast';
import type { DataSource } from '../../shared/types';

export default function EnrollmentUpload() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const queryClient = useQueryClient();

  const handleFileSelect = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0]; // Only process first file for enrollment
    setIsProcessing(true);

    try {
      // Parse a sample of the CSV to detect type
      const text = await file.text();
      const lines = text.split('\n').slice(0, 5);
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const detection = DataSourceDetector.detect(file.name, {
        headers,
        rows: []
      });

      // Ensure it's detected as enrollment data
      if (detection.type !== 'student-enrollment') {
        showToast({
          type: 'error',
          title: 'Invalid File Type',
          message: 'Please upload a student enrollment CSV file',
        });
        return;
      }

      // Process the file
      const adapter = getDataAdapter('student-enrollment');
      
      // Parse CSV
      const parsedData = await adapter.parseCSV(file);
      console.log('Parsed enrollment data:', parsedData.headers, 'Rows:', parsedData.rows.length);
      
      // Validate data
      const validation = adapter.validateData(parsedData);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Transform data
      const transformedData = await adapter.transformData(parsedData);
      console.log('Transformed enrollment data:', transformedData.length, 'records');
      console.log('Sample transformed record:', transformedData[0]);
      
      // Filter to only student records
      const students = transformedData.filter(record => record.type === 'student' || !record.type);
      console.log('Filtered students:', students.length, 'Sample student:', students[0]);
      
      if (students.length === 0) {
        console.log('All transformed records:', transformedData.map(r => ({ type: r.type, keys: Object.keys(r) })));
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
        // Clear existing enrollment data (only one enrollment file allowed)
        await db.students.clear();
        await db.dataSources.where('type').equals('student-enrollment').delete();
        
        // Clear all dependent data since they need to be re-matched to new enrollment
        await db.assessments.clear();
        await db.attendance.clear();
        await db.grades.clear();
        
        // Delete non-enrollment data source records since data is cleared
        await db.dataSources.where('type').notEqual('student-enrollment').delete();
        
        // Save new enrollment data
        await db.dataSources.add(dataSource);
        await db.students.bulkPut(students);
      });

      // Show success message
      showToast({
        type: 'success',
        title: `Imported ${students.length} students successfully!`,
        message: 'All previous dataset uploads have been cleared and must be re-uploaded to match the new enrollment.',
        duration: 8000,
      });

      // Invalidate queries to trigger UI refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['has-enrollment'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['enrollment-stats'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['data-sources'], refetchType: 'active' }),
        queryClient.invalidateQueries({ queryKey: ['data-sources-with-stats'], refetchType: 'active' })
      ]);

    } catch (error) {
      console.error('Error processing enrollment file:', error);
      showToast({
        type: 'error',
        title: 'Upload Failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    } finally {
      setIsProcessing(false);
    }
  }, [queryClient]);

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

  return (
    <div className="text-center py-12">
      <Users className="mx-auto h-16 w-16 text-gray-400 mb-6" />
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
        Upload Student Enrollment Data
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
        Start by uploading your student enrollment CSV file. This will serve as the master index for matching all other data sources.
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
            ${isProcessing ? 'pointer-events-none opacity-50' : ''}
          `}
        >
          {isProcessing ? (
            <div className="text-center">
              <Loader className="animate-spin mx-auto h-12 w-12 text-wasabi-green mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Processing Enrollment Data
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we import your student data...
              </p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Upload Student Enrollment File
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
                disabled={isProcessing}
              />
            </>
          )}
        </div>
        
        <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
          <AlertCircle size={16} />
          <span>Only CSV files are supported. Only one enrollment file can be active at a time.</span>
        </div>
      </div>
    </div>
  );
}