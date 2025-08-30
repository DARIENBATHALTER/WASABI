import { useState } from 'react';
import { ArrowLeft, Upload, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StudentMatcher } from '../../lib/student-matching';
import EnrollmentUpload from './EnrollmentUpload';
import DatasetTabs from './DatasetTabs';

interface DatasetManagementProps {
  onBack: () => void;
}

export default function DatasetManagement({ onBack }: DatasetManagementProps) {
  // Check if enrollment data exists
  const { data: hasEnrollment, isLoading, error } = useQuery({
    queryKey: ['has-enrollment'],
    queryFn: async () => {
      try {
        const result = await StudentMatcher.hasEnrollmentData();
        console.log('Query result:', result);
        return result;
      } catch (error) {
        console.error('Error checking enrollment:', error);
        return false; // Default to false if error
      }
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchInterval: 1000, // Check every second to catch deletions quickly
  });

  console.log('DatasetManagement - hasEnrollment:', hasEnrollment, 'isLoading:', isLoading, 'error:', error);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
      </div>
    );
  }

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

      {/* Content */}
      {hasEnrollment === false || hasEnrollment === undefined ? (
        <EnrollmentUpload />
      ) : (
        <DatasetTabs />
      )}
    </div>
  );
}