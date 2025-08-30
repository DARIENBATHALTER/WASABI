import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { examAnalyticsService } from '../../services/examAnalyticsService';
import type { TestType } from '../../shared/types/examAnalytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FastScienceAnalyticsProps {
  grade: '5';
}

export function FastScienceAnalytics({ grade }: FastScienceAnalyticsProps) {
  const testType: TestType = `FAST_SCIENCE_${grade}` as TestType;

  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['fastScienceAnalytics', testType],
    queryFn: () => examAnalyticsService.getTestAnalytics(testType),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading FAST Science analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 dark:text-red-400 mb-2">Failed to load FAST Science analytics</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Please try again later</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-600 dark:text-gray-400 mb-2">No FAST Science data available</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Upload FAST Science assessment data to see analytics
        </div>
      </div>
    );
  }

  // Prepare data for domain performance chart
  const domainChartData = analytics.standardsPerformance.map(domain => ({
    domain: domain.standardCode,
    percentage: domain.averagePercentage,
    students: domain.studentsCount,
    category: domain.category
  }));

  // Color scheme for Science domains
  const getDomainColor = (domainName: string): string => {
    switch (domainName) {
      case 'Physical Science': return '#3B82F6'; // Blue
      case 'Earth and Space Science': return '#10B981'; // Green  
      case 'Life Science': return '#F59E0B'; // Orange
      case 'Nature of Science': return '#8B5CF6'; // Purple
      default: return '#6B7280'; // Gray
    }
  };

  const getPerformanceColor = (percentage: number): string => {
    if (percentage >= 75) return '#10B981'; // Green - At/Above Standard
    if (percentage >= 50) return '#F59E0B'; // Orange - Approaching
    return '#EF4444'; // Red - Below Standard
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {analytics.testName}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {analytics.totalStudents}
              </div>
              <div className="text-sm text-blue-800 dark:text-blue-300">Students Tested</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {analytics.overallAverage}%
              </div>
              <div className="text-sm text-green-800 dark:text-green-300">Overall Average</div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {analytics.standardsPerformance.length}
              </div>
              <div className="text-sm text-purple-800 dark:text-purple-300">Science Domains</div>
            </div>
          </div>
        </div>
      </div>

      {/* Science Domain Performance Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Science Domain Performance
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={domainChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="domain" 
                className="text-xs"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                domain={[0, 100]}
                className="text-xs"
                label={{ value: 'Performance %', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip 
                formatter={(value, name) => [`${value}%`, 'Average Performance']}
                labelFormatter={(label) => `Domain: ${label}`}
                contentStyle={{
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white'
                }}
              />
              <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                {domainChartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getPerformanceColor(entry.percentage)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-center space-x-6 text-sm">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded mr-2"></div>
            <span className="text-gray-600 dark:text-gray-400">At/Above Standard (75%+)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-orange-500 rounded mr-2"></div>
            <span className="text-gray-600 dark:text-gray-400">Approaching (50-74%)</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-red-500 rounded mr-2"></div>
            <span className="text-gray-600 dark:text-gray-400">Below Standard (&lt;50%)</span>
          </div>
        </div>
      </div>

      {/* Detailed Domain Breakdown */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Detailed Domain Analysis
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {analytics.standardsPerformance.map((domain, index) => (
            <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900 dark:text-gray-100">
                  {domain.standardCode}
                </h4>
                <div className="flex items-center space-x-2">
                  <span 
                    className="px-2 py-1 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: getPerformanceColor(domain.averagePercentage) }}
                  >
                    {domain.averagePercentage}%
                  </span>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex justify-between">
                  <span>Students Tested:</span>
                  <span className="font-medium">{domain.studentsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Score:</span>
                  <span className="font-medium">{domain.averageScore.toFixed(1)}/4.0</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Points:</span>
                  <span className="font-medium">{domain.pointsEarned.toFixed(1)}/{domain.pointsPossible}</span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>Performance</span>
                  <span>{domain.averagePercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${domain.averagePercentage}%`,
                      backgroundColor: getPerformanceColor(domain.averagePercentage)
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Averages Summary */}
      {Object.keys(analytics.categoryAverages).length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Category Averages
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Object.entries(analytics.categoryAverages).map(([category, average]) => (
              <div key={category} className="text-center">
                <div className="text-2xl font-bold" style={{ color: getPerformanceColor(average) }}>
                  {average}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {category.replace('Science Domain: ', '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}