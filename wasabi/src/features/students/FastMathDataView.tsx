import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { queryByStudentId } from '../../utils/studentIdQuery';

interface FastMathDataViewProps {
  studentId: number;
}

interface AssessmentRecord {
  id?: number;
  studentId: string;
  source: string;
  subject: string;
  testDate: Date;
  testPeriod?: string;
  score: number;
  percentile?: number;
  proficiency?: 'below' | 'approaching' | 'meets' | 'exceeds';
  gradeLevel?: string;
  categoryPerformances?: Record<string, string>;
  detailedBenchmarks?: {
    category: string;
    benchmark: string;
    pointsEarned: number;
    pointsPossible: number;
    percentage: number;
  }[];
  [key: string]: any;
}

export default function FastMathDataView({ studentId }: FastMathDataViewProps) {
  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [showFullReport, setShowFullReport] = React.useState(false);
  
  
  React.useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  const { data: assessmentData, isLoading } = useQuery({
    queryKey: ['fast-math-detailed', studentId],
    queryFn: async () => {
      // Fetch FAST Math assessments using compound ID utility
      const allAssessments = await queryByStudentId(db.assessments, studentId);
      const assessments = allAssessments.filter(record => 
        (record.source?.includes('FAST') && record.subject === 'Math') ||
        (record.source === 'FAST' && record.subject === 'Math')
      );
      
      console.log(`📊 Found ${assessments.length} FAST Math assessments for student ${studentId}`);
      
      // Check for enhanced data
      const withStandards = assessments.filter(a => a.standardsPerformance);
      const withoutStandards = assessments.filter(a => !a.standardsPerformance);
      console.log(`✨ ${withStandards.length} assessments have enhanced standards data`);
      console.log(`⚪ ${withoutStandards.length} assessments have basic data only`);
      
      // Group by test period and sort by date
      const groupedByPeriod: Record<string, AssessmentRecord> = {};
      
      assessments.forEach(assessment => {
        const period = assessment.testPeriod || 'Unknown';
        console.log(`📊 Assessment - Period: ${period}, Score: ${assessment.score}, Date: ${assessment.testDate}, PercentileRank: ${assessment.percentile}`);
        // Keep only the most recent assessment for each period
        if (!groupedByPeriod[period] || 
            new Date(assessment.testDate) > new Date(groupedByPeriod[period].testDate)) {
          groupedByPeriod[period] = assessment;
        }
      });
      
      console.log('📊 Grouped by period:', groupedByPeriod);
      console.log('📊 Sample assessment details:', assessments[0]);
      
      return groupedByPeriod;
    }
  });

  const getProficiencyColor = (proficiency: string | undefined, isDark: boolean = false): string => {
    switch (proficiency?.toLowerCase()) {
      case 'exceeds':
      case 'exceeds standards':
      case 'level 5':
      case 'level 4':
        return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff'; // Blue - exceeds
      case 'meets':
      case 'meets standards':
      case 'level 3':
        return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc'; // Green - meets
      case 'approaching':
      case 'approaching standards':
      case 'level 2':
        return isDark ? 'rgb(251 191 36 / 0.3)' : '#ffff99'; // Yellow - approaching
      case 'below':
      case 'below standards':
      case 'level 1':
        return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc'; // Red - below
      default:
        return isDark ? 'rgb(107 114 128 / 0.3)' : '#f3f4f6'; // Gray - unknown
    }
  };

  const getPerformanceColor = (performance: string | undefined, isDark: boolean = false): string => {
    switch (performance?.toLowerCase()) {
      case 'above the standard':
      case 'exceeds the standard':
        return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff'; // Blue - exceeds
      case 'at/near the standard':
      case 'meets the standard':
        return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc'; // Green - meets
      case 'approaching the standard':
        return isDark ? 'rgb(251 191 36 / 0.3)' : '#ffff99'; // Yellow - approaching
      case 'below the standard':
        return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc'; // Red - below
      default:
        return isDark ? 'rgb(107 114 128 / 0.3)' : '#f3f4f6'; // Gray - unknown
    }
  };

  const formatPeriodName = (period: string): string => {
    if (!period) return 'Assessment';
    
    // Handle both simple (PM1) and full format (fast-pm1-3rd-5th)
    const lower = period.toLowerCase();
    if (period === 'PM1' || lower.includes('pm1')) return 'Fall (PM1)';
    if (period === 'PM2' || lower.includes('pm2')) return 'Winter (PM2)';
    if (period === 'PM3' || lower.includes('pm3')) return 'Spring (PM3)';
    if (period === 'Unknown') return 'Assessment';
    return period;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600 dark:text-gray-400">Loading FAST Math data...</div>
      </div>
    );
  }

  if (!assessmentData || Object.keys(assessmentData).length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 dark:text-gray-400">
        No FAST Math assessment data available for this student.
      </div>
    );
  }

  // Order periods correctly and filter out periods without data
  const allPeriods = assessmentData ? Object.keys(assessmentData) : [];
  
  // Find periods in the correct order (PM1, PM2, PM3 only)
  const pm1Period = allPeriods.find(p => p.toLowerCase().includes('pm1'));
  const pm2Period = allPeriods.find(p => p.toLowerCase().includes('pm2'));
  const pm3Period = allPeriods.find(p => p.toLowerCase().includes('pm3'));
  
  // Build available periods in order, filtering out undefined values
  const availablePeriods = [pm1Period, pm2Period, pm3Period].filter(Boolean);
  
  console.log('📊 Available periods in Math:', availablePeriods);
  console.log('📊 All assessment data keys:', assessmentData ? Object.keys(assessmentData) : 'No data');
  
  // Prepare chart data for Recharts
  const chartData = availablePeriods.map(period => ({
    period: formatPeriodName(period),
    scaleScore: assessmentData[period]?.score || null,
    percentileRank: assessmentData[period]?.percentile || null,
  }));

  // Math-specific performance categories
  const mathCategories = [
    'Number Sense and Additive Reasoning',
    'Number Sense and Multiplicative Reasoning', 
    'Fractional Reasoning',
    'Geometric Reasoning, Measurement, and Data Analysis'
  ];


  // Helper functions
  const getCategoryFromStandard = (standardCode: string): string => {
    if (standardCode.includes('OA.')) return 'Operations and Algebraic Thinking';
    if (standardCode.includes('NBT.')) return 'Number and Operations in Base Ten';
    if (standardCode.includes('NF.')) return 'Number and Operations - Fractions';
    if (standardCode.includes('MD.')) return 'Measurement and Data';
    if (standardCode.includes('G.')) return 'Geometry';
    // Fallback for other patterns
    if (standardCode.toLowerCase().includes('number sense')) return 'Number Sense';
    if (standardCode.toLowerCase().includes('algebraic')) return 'Algebraic Thinking';
    if (standardCode.toLowerCase().includes('geometric')) return 'Geometric Reasoning';
    if (standardCode.toLowerCase().includes('multiplicative')) return 'Multiplicative Reasoning';
    if (standardCode.toLowerCase().includes('fractional')) return 'Fractional Reasoning';
    return 'Other';
  };

  const getRiskColor = (percentage: number): { level: string; color: string; bgColor: string } => {
    if (percentage >= 80) return { level: 'Low Risk', color: 'text-green-600', bgColor: 'bg-green-100' };
    if (percentage >= 60) return { level: 'Some Risk', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    if (percentage >= 40) return { level: 'Medium Risk', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    return { level: 'High Risk', color: 'text-red-600', bgColor: 'bg-red-100' };
  };

  // Get the most recent assessment with standards data for enhanced analysis
  const recentEnhancedAssessment = assessmentData ? Object.values(assessmentData)
    .filter(a => a.standardsPerformance)
    .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0] || null : null;

  // Process standards data for visualization
  const standardsAnalysis = recentEnhancedAssessment?.standardsPerformance ? (() => {
    const standards = Object.entries(recentEnhancedAssessment.standardsPerformance).map(([code, perf]: [string, any]) => ({
      code,
      category: getCategoryFromStandard(code),
      pointsEarned: perf.pointsEarned || 0,
      pointsPossible: perf.pointsPossible || 0,
      percentage: Math.round(perf.masteryPercentage || 0),
      mastered: perf.mastered || false
    }));
    
    // Group by category
    const categoryGroups = standards.reduce((groups, standard) => {
      const category = standard.category;
      if (!groups[category]) {
        groups[category] = { standards: [], totalEarned: 0, totalPossible: 0 };
      }
      groups[category].standards.push(standard);
      groups[category].totalEarned += standard.pointsEarned;
      groups[category].totalPossible += standard.pointsPossible;
      return groups;
    }, {} as Record<string, { standards: typeof standards; totalEarned: number; totalPossible: number }>);
    
    // Calculate category averages
    const categoryAverages = Object.entries(categoryGroups).map(([category, data]) => ({
      category,
      percentage: data.totalPossible > 0 ? Math.round((data.totalEarned / data.totalPossible) * 100) : 0,
      standards: data.standards.sort((a, b) => a.percentage - b.percentage)
    }));
    
    return {
      testDate: new Date(recentEnhancedAssessment.testDate).toLocaleDateString(),
      categoryAverages: categoryAverages.sort((a, b) => a.percentage - b.percentage),
      totalStandards: standards.length,
      masteredStandards: standards.filter(s => s.mastered).length,
      overallPerformance: recentEnhancedAssessment.overallPerformancePercentage || 0,
      riskLevel: recentEnhancedAssessment.riskLevel || 'Unknown'
    };
  })() : null;

  return (
    <div className="space-y-6">
      {/* Assessment Results Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            FAST Mathematics Assessment Results
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Metric
                </th>
                {availablePeriods.map(period => (
                  <th key={period} className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {formatPeriodName(period)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {/* Scale Score */}
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  Scale Score
                </td>
                {availablePeriods.map(period => {
                  const assessment = assessmentData[period];
                  return (
                    <td key={period} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                      {assessment?.score || '-'}
                    </td>
                  );
                })}
              </tr>


              {/* Percentile Rank */}
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  Percentile Rank
                </td>
                {availablePeriods.map(period => {
                  const assessment = assessmentData[period];
                  return (
                    <td key={period} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                      {assessment?.percentile ? `${assessment.percentile}%` : '-'}
                    </td>
                  );
                })}
              </tr>

              {/* Test Date */}
              <tr className="bg-gray-50 dark:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                  Test Date
                </td>
                {availablePeriods.map(period => {
                  const assessment = assessmentData[period];
                  return (
                    <td key={period} className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-400">
                      {assessment?.testDate ? new Date(assessment.testDate).toLocaleDateString() : '-'}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Scale Score Progress */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 text-center">
          FAST Mathematics Scale Score Progress
        </h3>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? '#374151' : '#e5e7eb'} />
            <XAxis 
              dataKey="period" 
              stroke={isDarkMode ? '#e5e7eb' : '#374151'}
              fontSize={12}
            />
            <YAxis 
              stroke={isDarkMode ? '#e5e7eb' : '#374151'}
              fontSize={12}
              label={{ 
                value: 'Scale Score', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: isDarkMode ? '#e5e7eb' : '#374151' }
              }}
            />
            <Tooltip 
              contentStyle={{
                backgroundColor: isDarkMode ? '#374151' : '#ffffff',
                border: `1px solid ${isDarkMode ? '#6b7280' : '#e5e7eb'}`,
                borderRadius: '8px',
                color: isDarkMode ? '#e5e7eb' : '#374151'
              }}
              formatter={(value: any) => [value, 'Scale Score']}
            />
            <Line 
              type="monotone" 
              dataKey="scaleScore" 
              stroke={isDarkMode ? '#3b82f6' : '#2563eb'}
              strokeWidth={3}
              dot={{ fill: isDarkMode ? '#3b82f6' : '#2563eb', strokeWidth: 2, r: 6 }}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>


      {/* See Full Report Button */}
      <div className="text-center">
        <button
          onClick={() => setShowFullReport(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          <svg className="mr-2 -ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          See Full Report
        </button>
      </div>

      {/* Full Report Modal */}
      {showFullReport && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" aria-hidden="true" onClick={() => setShowFullReport(false)}></div>
            
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            
            <div className="relative inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full sm:p-6">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  onClick={() => setShowFullReport(false)}
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div>
                <div className="mt-3 text-center sm:mt-0 sm:text-left">
                  <h3 className="text-xl leading-6 font-bold text-gray-900 dark:text-gray-100 mb-6" id="modal-title">
                    Complete FAST Mathematics Assessment Report
                  </h3>
                  <div className="max-h-[70vh] overflow-y-auto">
                    <div className="space-y-8">
                      {availablePeriods.map(period => {
                        const assessment = assessmentData[period];
                        if (!assessment) return null;

                        return (
                          <div key={period} className="border border-gray-200 dark:border-gray-600 rounded-lg">
                            {/* Header */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-600">
                              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                                {formatPeriodName(period)} Assessment
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                Test Date: {assessment.testDate ? new Date(assessment.testDate).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>

                            <div className="p-6 space-y-6">
                              {/* Overall Scores */}
                              <div className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                                    {assessment.score || 'N/A'}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">Scale Score</div>
                                </div>
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {assessment.percentile ? `${assessment.percentile}%` : 'N/A'}
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400">Percentile Rank</div>
                                </div>
                                <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                  <div className="text-lg font-semibold">
                                    <span 
                                      className="inline-flex px-3 py-1 rounded-full text-xs font-medium"
                                      style={{
                                        backgroundColor: getProficiencyColor(assessment.proficiency, isDarkMode),
                                        color: isDarkMode ? '#e5e7eb' : '#374151'
                                      }}
                                    >
                                      {assessment.proficiency?.charAt(0).toUpperCase() + assessment.proficiency?.slice(1) || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">Achievement Level</div>
                                </div>
                              </div>

                              {/* Performance Categories */}
                              {assessment.categoryPerformances && (
                                <div>
                                  <h5 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                                    Performance Categories
                                  </h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {Object.entries(assessment.categoryPerformances).map(([category, performance]) => (
                                      <div key={category} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded">
                                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                          {category}
                                        </span>
                                        <span 
                                          className="inline-flex px-2 py-1 rounded text-xs font-semibold"
                                          style={{
                                            backgroundColor: getPerformanceColor(performance, isDarkMode),
                                            color: isDarkMode ? '#e5e7eb' : '#374151'
                                          }}
                                        >
                                          {performance || 'N/A'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Detailed Benchmark Standards */}
                              {assessment.standardsPerformance && Object.keys(assessment.standardsPerformance).length > 0 && (
                                <div>
                                  <h5 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
                                    Question-by-Question Performance
                                  </h5>
                                  <div className="overflow-hidden border border-gray-200 dark:border-gray-600 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                      <thead className="bg-gray-50 dark:bg-gray-700">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                            Category
                                          </th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                            Benchmark/Question
                                          </th>
                                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                            Points Earned
                                          </th>
                                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                            Points Possible
                                          </th>
                                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                            Mastery %
                                          </th>
                                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                                            Status
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                        {Object.entries(assessment.standardsPerformance).map(([questionKey, performance], index) => (
                                          <tr key={questionKey} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700/50' : ''}>
                                            <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                                              {performance.category || 'Category'}
                                            </td>
                                            <td className="px-4 py-2 text-xs font-mono text-gray-600 dark:text-gray-400">
                                              {performance.benchmark || questionKey}
                                            </td>
                                            <td className="px-4 py-2 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                                              {performance.pointsEarned}
                                            </td>
                                            <td className="px-4 py-2 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                                              {performance.pointsPossible}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                              <div className="flex items-center justify-center">
                                                <div className="w-12 h-2 bg-gray-200 dark:bg-gray-600 rounded-full mr-2">
                                                  <div 
                                                    className={`h-2 rounded-full ${
                                                      performance.masteryPercentage >= 80 ? 'bg-green-500' :
                                                      performance.masteryPercentage >= 70 ? 'bg-blue-500' :
                                                      performance.masteryPercentage >= 60 ? 'bg-yellow-500' :
                                                      performance.masteryPercentage >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                                    }`}
                                                    style={{ width: `${Math.min(performance.masteryPercentage, 100)}%` }}
                                                  ></div>
                                                </div>
                                                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">
                                                  {Math.round(performance.masteryPercentage)}%
                                                </span>
                                              </div>
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                                                performance.mastered 
                                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                              }`}>
                                                {performance.mastered ? 'Mastered' : 'Needs Work'}
                                              </span>
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
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}