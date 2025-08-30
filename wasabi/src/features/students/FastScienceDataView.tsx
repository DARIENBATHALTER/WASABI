import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { queryByStudentId } from '../../utils/studentIdQuery';

interface AssessmentRecord {
  id?: string;
  studentId: string;
  source: string;
  subject: string;
  testPeriod?: string;
  testDate: Date;
  score: number;
  percentile?: number;
  gradeLevel?: string;
  proficiency?: string;
  categoryPerformances?: Record<string, string>;
  detailedBenchmarks?: Array<{
    category: string;
    benchmark: string;
    pointsEarned: number;
    pointsPossible: number;
    percentage: number;
  }>;
}

interface FastScienceDataViewProps {
  studentId: number;
}

export function FastScienceDataView({ studentId }: FastScienceDataViewProps) {
  const [showFullReport, setShowFullReport] = useState(false);
  const [selectedRecordForFullReport, setSelectedRecordForFullReport] = useState<AssessmentRecord | null>(null);

  const { data: assessmentData, isLoading } = useQuery({
    queryKey: ['fastScience', studentId],
    queryFn: async () => {
      // Fetch FAST Science assessments using compound ID utility
      const allAssessments = await queryByStudentId(db.assessments, studentId);
      console.log('🐛 DEBUG All assessment records for student (Science view):', allAssessments);
      console.log('🐛 DEBUG Record sources/subjects:', allAssessments.map(r => ({ source: r.source, subject: r.subject })));
      
      const records = allAssessments.filter(record => record.source === 'FAST' && record.subject === 'Science');

      console.log('🐛 DEBUG FAST Science records found:', records.length);

      // Group by test period (typically just EOY for Science)
      const groupedData: Record<string, AssessmentRecord> = {};
      
      for (const record of records) {
        const period = record.testPeriod || 'EOY';
        
        // Keep the most recent record for each period
        if (!groupedData[period] || 
            new Date(record.testDate) > new Date(groupedData[period].testDate)) {
          groupedData[period] = record;
        }
      }

      return groupedData;
    }
  });

  // Check if user is in dark mode
  const isDarkMode = document.documentElement.classList.contains('dark');

  const getProficiencyColor = (proficiency: string | undefined, isDark: boolean = false): string => {
    switch (proficiency?.toLowerCase()) {
      case 'exceeds standards':
      case 'level 5':
      case 'mastery':
        return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff'; // Blue - exceeds
      case 'meets standards':
      case 'level 4':
      case 'proficient':
        return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc'; // Green - meets
      case 'approaching standards':
      case 'level 3':
      case 'approaching':
        return isDark ? 'rgb(251 191 36 / 0.3)' : '#ffff99'; // Yellow - approaching
      case 'below standards':
      case 'level 2':
      case 'level 1':
      case 'developing':
      case 'inadequate':
        return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc'; // Red - below
      default:
        return isDark ? 'rgb(107 114 128 / 0.3)' : '#f3f4f6'; // Gray - unknown
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600 dark:text-gray-400">Loading FAST Science data...</div>
      </div>
    );
  }

  if (!assessmentData || Object.keys(assessmentData).length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        No FAST Science assessment data available for this student.
      </div>
    );
  }

  // For Science, we typically only have EOY data
  const availablePeriods = ['EOY'];
  const periodNames = { EOY: 'End of Year' };

  return (
    <div className="space-y-6">
      {/* Score Chart (if we have multiple data points in the future) */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 text-center">
          FAST Science Scale Score
        </h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
              {assessmentData.EOY?.score || '-'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              End of Year Assessment
            </div>
            {assessmentData.EOY?.testDate && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                <div>Test Date:</div>
                <div className="font-medium">
                  {new Date(assessmentData.EOY.testDate).toLocaleDateString()}
                </div>
              </div>
            )}
            {assessmentData.EOY?.proficiency && (
              <div className="mt-2">
                <span 
                  className="inline-flex px-3 py-1 text-sm font-semibold rounded-full"
                  style={{
                    backgroundColor: getProficiencyColor(assessmentData.EOY.proficiency, isDarkMode),
                    color: isDarkMode ? '#e5e7eb' : '#374151'
                  }}
                >
                  {assessmentData.EOY.proficiency.charAt(0).toUpperCase() + assessmentData.EOY.proficiency.slice(1)}
                </span>
              </div>
            )}
            {assessmentData.EOY && (
              <button
                onClick={() => setSelectedRecordForFullReport(assessmentData.EOY)}
                className="mt-3 px-3 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900 dark:hover:bg-green-800 
                         text-green-800 dark:text-green-200 text-xs font-medium rounded-md transition-colors"
              >
                View Full Report
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Full Report Modal */}
      {selectedRecordForFullReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Full Assessment Data - Grade {selectedRecordForFullReport.gradeLevel} Science
              </h2>
              <button
                onClick={() => setSelectedRecordForFullReport(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-8rem)]">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Field
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {Object.entries(selectedRecordForFullReport).map(([key, value]) => {
                      // Skip complex objects for now, show them separately
                      if (key === 'categoryPerformances' || key === 'detailedBenchmarks') return null;
                      
                      let displayValue = value;
                      if (value instanceof Date) {
                        displayValue = value.toLocaleDateString();
                      } else if (typeof value === 'object' && value !== null) {
                        displayValue = JSON.stringify(value, null, 2);
                      } else if (value === null || value === undefined) {
                        displayValue = '-';
                      }
                      
                      return (
                        <tr key={key}>
                          <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                            {key.replace(/([A-Z])/g, ' $1').trim()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                            {String(displayValue)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Category Performances */}
              {selectedRecordForFullReport.categoryPerformances && Object.keys(selectedRecordForFullReport.categoryPerformances).length > 0 && (
                <div className="mt-6">
                  <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Science Domain Performance</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Domain
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Performance
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {Object.entries(selectedRecordForFullReport.categoryPerformances).map(([domain, performance]) => (
                          <tr key={domain}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {domain}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                              {performance}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FastScienceDataView;