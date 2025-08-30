import { useState } from 'react';
import { Database, Upload, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { StudentMatcher } from '../../lib/student-matching';
import ActiveDatasets from './ActiveDatasets';
import UploadDatasets from './UploadDatasets';

const tabs = [
  { id: 'active', label: 'Active Datasets', icon: Database },
  { id: 'upload', label: 'Upload Datasets', icon: Upload },
];

export default function DatasetTabs() {
  const [activeTab, setActiveTab] = useState('active');

  // Check if enrollment data exists
  const { data: hasEnrollment } = useQuery({
    queryKey: ['has-enrollment'],
    queryFn: () => StudentMatcher.hasEnrollmentData(),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  const renderTabContent = () => {
    switch (activeTab) {
      case 'active':
        return <ActiveDatasets />;
      case 'upload':
        if (!hasEnrollment) {
          return (
            <div className="text-center py-12">
              <AlertCircle className="mx-auto h-16 w-16 text-yellow-500 mb-6" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Student Enrollment Required
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You must upload student enrollment data before uploading other datasets.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Go back to upload your student enrollment file first.
              </p>
            </div>
          );
        }
        return <UploadDatasets />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isDisabled = tab.id === 'upload' && !hasEnrollment;
            
            return (
              <button
                key={tab.id}
                onClick={() => !isDisabled && setActiveTab(tab.id)}
                disabled={isDisabled}
                className={`
                  flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm
                  transition-colors duration-200
                  ${isDisabled
                    ? 'border-transparent text-gray-300 cursor-not-allowed dark:text-gray-600'
                    : isActive
                      ? 'border-wasabi-green text-wasabi-green'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {isDisabled && <AlertCircle size={14} className="text-yellow-500" />}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {renderTabContent()}
      </div>
    </div>
  );
}