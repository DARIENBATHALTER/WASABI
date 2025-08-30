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

interface FastWritingDataViewProps {
  studentId: number;
}

export function FastWritingDataView({ studentId }: FastWritingDataViewProps) {
  const [showFullReport, setShowFullReport] = useState(false);
  const [selectedRecordForFullReport, setSelectedRecordForFullReport] = useState<AssessmentRecord | null>(null);

  const { data: assessmentData, isLoading } = useQuery({
    queryKey: ['fastWriting', studentId],
    queryFn: async () => {
      // Fetch FAST Writing assessments using compound ID utility
      const allRecords = await queryByStudentId(db.assessments, studentId);
      
      console.log('🐛 DEBUG All assessment records for student:', allRecords);
      console.log('🐛 DEBUG Record sources:', allRecords.map(r => ({ 
        source: r.source, 
        subject: r.subject,
        categoryPerformances: r.categoryPerformances,
        detailedBenchmarks: r.detailedBenchmarks
      })));

      const records = allRecords.filter(record => {
        console.log('🔍 Checking record:', {
          source: record.source,
          subject: record.subject,
          match: record.source === 'FAST' && record.subject === 'Writing'
        });
        return record.source === 'FAST' && record.subject === 'Writing';
      });

      // Debug: Log the raw records to see what data is available
      console.log('🐛 DEBUG FAST Writing records found:', records.length);
      if (records.length > 0) {
        console.log('🐛 DEBUG Full record:', records[0]);
        console.log('🐛 DEBUG Sample record fields:', Object.keys(records[0]));
        console.log('🐛 DEBUG Sample record categoryPerformances:', records[0].categoryPerformances);
        console.log('🐛 DEBUG Sample record detailedBenchmarks:', records[0].detailedBenchmarks);
      } else {
        console.log('🐛 DEBUG No FAST Writing records found for this student');
        console.log('🐛 Looking for Writing records differently...');
        const writingRecords = allRecords.filter(r => r.subject === 'Writing');
        console.log('🐛 Found Writing records:', writingRecords);
      }

      // Group by test period and grade level (typically just EOY for Writing)
      const groupedData: Record<string, AssessmentRecord> = {};
      
      for (const record of records) {
        const period = record.testPeriod || 'EOY';
        const grade = record.gradeLevel || 'Unknown';
        const key = `${period}_Grade${grade}`;
        
        // Keep the most recent record for each period/grade combination
        if (!groupedData[key] || 
            new Date(record.testDate) > new Date(groupedData[key].testDate)) {
          groupedData[key] = record;
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

  const getPerformanceColor = (performance: string | undefined, isDark: boolean = false): string => {
    // Writing performance might be numeric scores (e.g., out of 4) or text levels
    const perfValue = performance?.toString().toLowerCase();
    if (!perfValue) return isDark ? 'rgb(107 114 128 / 0.3)' : '#f3f4f6';
    
    // Handle numeric scores (assume out of 4 or 5, or raw point values)
    const numericValue = parseFloat(perfValue);
    if (!isNaN(numericValue)) {
      // For smaller scales (1-4 or 1-5)
      if (numericValue <= 5) {
        if (numericValue >= 4) return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff'; // Blue - high
        if (numericValue >= 3) return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc'; // Green - proficient
        if (numericValue >= 2) return isDark ? 'rgb(251 191 36 / 0.3)' : '#ffff99'; // Yellow - approaching
        return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc'; // Red - below
      }
      // For larger scales, use percentage-based logic
      else {
        if (numericValue >= 80) return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff';
        if (numericValue >= 70) return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc';
        if (numericValue >= 60) return isDark ? 'rgb(251 191 36 / 0.3)' : '#ffff99';
        return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc';
      }
    }
    
    // Handle text levels
    if (perfValue.includes('above') || perfValue.includes('exceeds') || perfValue.includes('advanced')) return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff';
    if (perfValue.includes('meets') || perfValue.includes('proficient') || perfValue.includes('satisfactory')) return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc';
    if (perfValue.includes('approaching') || perfValue.includes('developing') || perfValue.includes('partial')) return isDark ? 'rgb(251 191 36 / 0.3)' : '#ffff99';
    if (perfValue.includes('below') || perfValue.includes('inadequate') || perfValue.includes('minimal')) return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc';
    
    return isDark ? 'rgb(107 114 128 / 0.3)' : '#f3f4f6';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600 dark:text-gray-400">Loading FAST Writing data...</div>
      </div>
    );
  }

  if (!assessmentData || Object.keys(assessmentData).length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        No FAST Writing assessment data available for this student.
      </div>
    );
  }

  // Extract available periods and grades
  const availableKeys = Object.keys(assessmentData);
  const periodNames = { EOY: 'End of Year' };

  // B.E.S.T. Writing-specific performance dimensions
  const writingDimensions = [
    'Purpose/Structure',
    'Development',
    'Language',
    'Conventions',
    // Legacy dimensions for backward compatibility
    'Purpose and Focus',
    'Organization', 
    'Evidence and Elaboration',
    'Language Usage',
    'Content and Ideas'
  ];

  return (
    <div className="space-y-6">
      {/* Score Visualization */}
      <div className="grid grid-cols-1 gap-6">
          {Object.entries(assessmentData).map(([key, assessment]) => {
            // Debug: Show what data we actually have
            console.log('🐛 FAST Writing Assessment Data:', assessment);
            console.log('🐛 categoryPerformances:', assessment.categoryPerformances);
            console.log('🐛 detailedBenchmarks:', assessment.detailedBenchmarks);
            
            return (
              <div key={key} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                {/* Header */}
                <div className="text-center mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    Grade {assessment.gradeLevel} FAST Writing
                  </h4>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(assessment.testDate).toLocaleDateString()}
                  </div>
                </div>
                
                {/* Raw Score Display */}
                <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3 mb-4 text-center">
                  <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">FAST Writing Raw Score</div>
                  <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                    {assessment.score || '-'}
                  </div>
                </div>
                
                {/* Writing Mode Breakdown - Always Show */}
                <div className="space-y-3 mb-4">
                  <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600 pb-1">
                    Writing Mode: {assessment.gradeLevel === '4' ? 'Opinion/Argumentative' : 'Informative/Explanatory'}
                  </h5>
                  
                  {/* Purpose/Structure */}
                  <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">1. Purpose/Structure</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {assessment.categoryPerformances?.['Purpose/Structure'] || 'N/A'}
                    </div>
                  </div>
                  
                  {/* Development */}
                  <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">2. Development</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {assessment.categoryPerformances?.['Development'] || 'N/A'}
                    </div>
                  </div>
                  
                  {/* Language */}
                  <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">3. Language</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {assessment.categoryPerformances?.['Language'] || 'N/A'}
                    </div>
                  </div>
                </div>
                
                {/* Benchmark Data */}
                {assessment.detailedBenchmarks && assessment.detailedBenchmarks.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mb-3">
                    <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Benchmark Performance</h5>
                    {assessment.detailedBenchmarks.map((benchmark, idx) => (
                      <div key={idx} className="text-xs bg-gray-50 dark:bg-gray-700 rounded p-2 mb-1">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{benchmark.benchmark}</div>
                        <div className="text-gray-600 dark:text-gray-400">
                          {benchmark.pointsEarned}/{benchmark.pointsPossible} points ({benchmark.percentage}%)
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={() => setSelectedRecordForFullReport(assessment)}
                  className="w-full px-3 py-2 bg-orange-100 hover:bg-orange-200 dark:bg-orange-900 dark:hover:bg-orange-800 
                           text-orange-800 dark:text-orange-200 text-sm font-medium rounded-md transition-colors"
                >
                  View Full Report
                </button>
              </div>
            );
          })}
        </div>

      {/* See Full Report Button */}
      <div className="text-center">
        <button
          onClick={() => setShowFullReport(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 dark:bg-orange-500 dark:hover:bg-orange-600"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          See Full Report
        </button>
      </div>

      {/* Full Report Modal */}
      {showFullReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Complete FAST Writing Assessment Report
              </h2>
              <button
                onClick={() => setShowFullReport(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6">
              {Object.entries(assessmentData).map(([key, assessment]) => (
                <div key={key} className="mb-8">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                    <span className="w-3 h-3 bg-orange-500 rounded-full mr-3"></span>
                    Grade {assessment.gradeLevel} FAST Writing Assessment
                  </h3>
                  
                  {/* Overall Performance Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">FAST Writing Raw Score</div>
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{assessment.score}</div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Achievement Level</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {assessment.proficiency?.charAt(0).toUpperCase() + assessment.proficiency?.slice(1) || 'N/A'}
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <div className="text-sm text-gray-600 dark:text-gray-400">Test Date</div>
                      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                        {new Date(assessment.testDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Writing Dimensions Performance */}
                  {assessment.categoryPerformances && Object.keys(assessment.categoryPerformances).length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Writing Mode: Opinion/Argumentative</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {writingDimensions.map(dimension => {
                          const performance = assessment.categoryPerformances?.[dimension];
                          if (!performance) return null;
                          
                          return (
                            <div key={dimension} className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{dimension}</span>
                                <span 
                                  className="px-2 py-1 text-xs font-semibold rounded-full"
                                  style={{
                                    backgroundColor: getPerformanceColor(performance, isDarkMode),
                                    color: isDarkMode ? '#e5e7eb' : '#374151'
                                  }}
                                >
                                  {performance}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Detailed Standards */}
                  {assessment.detailedBenchmarks && assessment.detailedBenchmarks.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Benchmark Performance</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-600">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Category</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Standard</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Points</th>
                              <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Performance</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-700 divide-y divide-gray-200 dark:divide-gray-600">
                            {assessment.detailedBenchmarks.map((benchmark, index) => (
                              <tr key={index}>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{benchmark.category}</td>
                                <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">{benchmark.benchmark}</td>
                                <td className="px-4 py-2 text-sm text-center text-gray-900 dark:text-gray-100">
                                  {benchmark.pointsEarned}/{benchmark.pointsPossible}
                                </td>
                                <td className="px-4 py-2 text-center">
                                  <div className="flex items-center justify-center space-x-2">
                                    <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                                      <div 
                                        className="bg-orange-500 h-2 rounded-full transition-all duration-300" 
                                        style={{ width: `${Math.min(100, benchmark.percentage)}%` }}
                                      ></div>
                                    </div>
                                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{benchmark.percentage}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Full Report Modal */}
      {selectedRecordForFullReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Full Assessment Data - Grade {selectedRecordForFullReport.gradeLevel} Writing
              </h3>
              <button
                onClick={() => setSelectedRecordForFullReport(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                  <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">Writing Dimension Scores</h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Dimension
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Score
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {Object.entries(selectedRecordForFullReport.categoryPerformances).map(([dimension, score]) => (
                          <tr key={dimension}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                              {dimension}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
                              {score}
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

export default FastWritingDataView;