import React, { useState, useEffect } from 'react';
import { ClipboardList, BookOpen, Calculator, TrendingUp, Users, Target, AlertCircle, ChevronDown, ChevronRight, BarChart3, X } from 'lucide-react';
import PageHeader from '../shared/components/PageHeader';
import PageWrapper from '../shared/components/PageWrapper';
import { examAnalyticsService } from '../services/examAnalyticsService';
import type { TestType, StandardPerformance, TestAnalytics, TimeSeriesData } from '../shared/types/examAnalytics';

interface TestOption {
  value: TestType;
  label: string;
  subject: 'ELA' | 'MATH' | 'WRITING' | 'SCIENCE';
  grade: string;
  description: string;
}

const testOptions: TestOption[] = [
  // ELA Tests
  { value: 'FAST_ELA_K', label: 'FAST Early Literacy - Kindergarten', subject: 'ELA', grade: 'K', description: 'Early literacy assessment with 10 domain areas' },
  { value: 'FAST_ELA_1', label: 'FAST Early Literacy - Grade 1', subject: 'ELA', grade: '1', description: 'Early literacy assessment with 10 domain areas' },
  { value: 'FAST_ELA_2', label: 'FAST Reading - Grade 2', subject: 'ELA', grade: '2', description: 'Reading assessment with domain-based scoring' },
  { value: 'FAST_ELA_3', label: 'FAST ELA Reading - Grade 3', subject: 'ELA', grade: '3', description: '13 specific reading and vocabulary standards' },
  { value: 'FAST_ELA_4', label: 'FAST ELA Reading - Grade 4', subject: 'ELA', grade: '4', description: '13 specific reading and vocabulary standards' },
  { value: 'FAST_ELA_5', label: 'FAST ELA Reading - Grade 5', subject: 'ELA', grade: '5', description: '13 specific reading and vocabulary standards' },
  
  // Math Tests
  { value: 'FAST_MATH_K', label: 'FAST Mathematics - Kindergarten', subject: 'MATH', grade: 'K', description: 'Basic mathematics achievement levels' },
  { value: 'FAST_MATH_1', label: 'FAST Mathematics - Grade 1', subject: 'MATH', grade: '1', description: 'Basic mathematics achievement levels' },
  { value: 'FAST_MATH_2', label: 'FAST Mathematics - Grade 2', subject: 'MATH', grade: '2', description: 'Basic mathematics achievement levels' },
  { value: 'FAST_MATH_3', label: 'FAST Mathematics - Grade 3', subject: 'MATH', grade: '3', description: '11 specific mathematics standards' },
  { value: 'FAST_MATH_4', label: 'FAST Mathematics - Grade 4', subject: 'MATH', grade: '4', description: '11 specific mathematics standards' },
  { value: 'FAST_MATH_5', label: 'FAST Mathematics - Grade 5', subject: 'MATH', grade: '5', description: '13 specific mathematics standards' },
  
  // Writing Tests
  { value: 'FAST_WRITING_4', label: 'FAST Writing - Grade 4', subject: 'WRITING', grade: '4', description: 'Opinion/Argumentative writing with 3 mode dimensions' },
  { value: 'FAST_WRITING_5', label: 'FAST Writing - Grade 5', subject: 'WRITING', grade: '5', description: 'Informative/Explanatory writing with 3 mode dimensions' },
  
  // Science Tests
  { value: 'FAST_SCIENCE_5', label: 'FAST Science - Grade 5', subject: 'SCIENCE', grade: '5', description: 'Science assessment with 4 domain areas: Physical Science, Earth & Space, Life Science, Nature of Science' },
  
  // iReady ELA Tests
  { value: 'IREADY_ELA_K', label: 'iReady Reading - Kindergarten', subject: 'ELA', grade: 'K', description: 'Diagnostic reading assessment with placement levels and domain scores' },
  { value: 'IREADY_ELA_1', label: 'iReady Reading - Grade 1', subject: 'ELA', grade: '1', description: 'Diagnostic reading assessment with placement levels and domain scores' },
  { value: 'IREADY_ELA_2', label: 'iReady Reading - Grade 2', subject: 'ELA', grade: '2', description: 'Diagnostic reading assessment with placement levels and domain scores' },
  { value: 'IREADY_ELA_3', label: 'iReady Reading - Grade 3', subject: 'ELA', grade: '3', description: 'Diagnostic reading assessment with placement levels and domain scores' },
  { value: 'IREADY_ELA_4', label: 'iReady Reading - Grade 4', subject: 'ELA', grade: '4', description: 'Diagnostic reading assessment with placement levels and domain scores' },
  { value: 'IREADY_ELA_5', label: 'iReady Reading - Grade 5', subject: 'ELA', grade: '5', description: 'Diagnostic reading assessment with placement levels and domain scores' },
  
  // iReady Math Tests
  { value: 'IREADY_MATH_K', label: 'iReady Math - Kindergarten', subject: 'MATH', grade: 'K', description: 'Diagnostic math assessment with Number Operations, Algebra, Measurement & Data, Geometry domains' },
  { value: 'IREADY_MATH_1', label: 'iReady Math - Grade 1', subject: 'MATH', grade: '1', description: 'Diagnostic math assessment with Number Operations, Algebra, Measurement & Data, Geometry domains' },
  { value: 'IREADY_MATH_2', label: 'iReady Math - Grade 2', subject: 'MATH', grade: '2', description: 'Diagnostic math assessment with Number Operations, Algebra, Measurement & Data, Geometry domains' },
  { value: 'IREADY_MATH_3', label: 'iReady Math - Grade 3', subject: 'MATH', grade: '3', description: 'Diagnostic math assessment with Number Operations, Algebra, Measurement & Data, Geometry domains' },
  { value: 'IREADY_MATH_4', label: 'iReady Math - Grade 4', subject: 'MATH', grade: '4', description: 'Diagnostic math assessment with Number Operations, Algebra, Measurement & Data, Geometry domains' },
  { value: 'IREADY_MATH_5', label: 'iReady Math - Grade 5', subject: 'MATH', grade: '5', description: 'Diagnostic math assessment with Number Operations, Algebra, Measurement & Data, Geometry domains' },
];


export default function ExamAnalytics() {
  const [selectedTest, setSelectedTest] = useState<TestType | null>(null);
  const [selectedStandard, setSelectedStandard] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testAnalytics, setTestAnalytics] = useState<TestAnalytics | null>(null);
  const [expandedStandards, setExpandedStandards] = useState<Set<string>>(new Set());
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [schoolwideAnalytics, setSchoolwideAnalytics] = useState<any>(null);
  const [loadingSchoolwide, setLoadingSchoolwide] = useState(false);


  const selectedTestOption = testOptions.find(option => option.value === selectedTest);
  const selectedStandardData = testAnalytics?.standardsPerformance.find(s => s.standardCode === selectedStandard);

  // Load schoolwide analytics on component mount
  useEffect(() => {
    const loadSchoolwideAnalytics = async () => {
      setLoadingSchoolwide(true);
      try {
        const analytics = await examAnalyticsService.getSchoolwideAnalytics();
        setSchoolwideAnalytics(analytics);
      } catch (error) {
        console.error('Error loading schoolwide analytics:', error);
      } finally {
        setLoadingSchoolwide(false);
      }
    };

    loadSchoolwideAnalytics();
  }, []);

  const toggleStandardExpanded = (standardCode: string) => {
    const newExpanded = new Set(expandedStandards);
    if (newExpanded.has(standardCode)) {
      newExpanded.delete(standardCode);
    } else {
      newExpanded.add(standardCode);
    }
    setExpandedStandards(newExpanded);
  };

  const handleTestSelection = async (testType: TestType) => {
    setSelectedTest(testType);
    setSelectedStandard(null); // Reset standard selection when test changes
    setExpandedStandards(new Set()); // Reset expanded standards when test changes
    setIsDetailModalOpen(false); // Close modal when test changes
    setLoading(true);
    
    try {
      // Use the real exam analytics service to query database
      const analytics = await examAnalyticsService.getTestAnalytics(testType);
      setTestAnalytics(analytics);
    } catch (error) {
      console.error('Error loading FAST data:', error);
      setTestAnalytics(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStandardSelection = (standardCode: string) => {
    setSelectedStandard(standardCode === selectedStandard ? null : standardCode);
  };


  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
    if (percentage >= 60) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400';
  };

  // Special color coding for Writing Mode scores (0-4 scale)
  const getWritingModeColor = (score: number) => {
    if (score === 4) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400';
    if (score === 3) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (score === 2) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400';
    return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'; // 0 or 1
  };

  // Render distribution chart for Writing tests
  const renderWritingDistribution = () => {
    if (!testAnalytics) return null;
    
    // Calculate distribution of Writing Mode scores
    const distribution: Record<string, number[]> = {
      'Purpose/Structure': [],
      'Development': [],
      'Language': []
    };
    
    // Collect all scores for each Writing Mode
    testAnalytics.standardsPerformance.forEach(standard => {
      if (distribution[standard.standardCode]) {
        standard.studentScores.forEach(student => {
          // Convert percentage back to 0-4 scale
          const score = Math.round((student.percentage / 100) * 4);
          distribution[standard.standardCode].push(score);
        });
      }
    });
    
    // Calculate score counts for each mode
    const scoreCounts: Record<string, Record<number, number>> = {};
    Object.entries(distribution).forEach(([mode, scores]) => {
      scoreCounts[mode] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      scores.forEach(score => {
        scoreCounts[mode][score]++;
      });
    });
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Writing Mode Score Distribution
        </h4>
        
        {/* 3 charts across in a row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(scoreCounts).map(([mode, counts]) => {
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            if (total === 0) return null;
            
            return (
              <div key={mode} className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{mode}</h5>
                <div className="flex items-end gap-1 h-20">
                  {[0, 1, 2, 3, 4].map(score => {
                    const count = counts[score];
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const height = percentage; // Height as percentage
                    
                    return (
                      <div key={score} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex flex-col items-center justify-end h-16">
                          <div 
                            className={`w-full rounded-t transition-all ${
                              score === 4 ? 'bg-green-500' :
                              score === 3 ? 'bg-yellow-500' :
                              score === 2 ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}
                            style={{ height: `${height}%` }}
                            title={`${count} students (${Math.round(percentage)}%)`}
                          >
                            {count > 0 && (
                              <div className="text-xs text-white text-center font-medium px-1">
                                {count}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                          {score}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <strong>Scoring Guide:</strong> 4 = Exceeds Expectations, 3 = Meets Expectations, 2 = Approaching, 0-1 = Below Expectations
          </p>
        </div>
      </div>
    );
  };

  const renderScienceDistribution = () => {
    if (!testAnalytics) return null;
    
    // Calculate distribution for each Science domain based on actual points earned/possible
    const domainData: Record<string, Array<{points: number, possible: number, percentage: number}>> = {};
    
    // Collect points data for each Science domain
    testAnalytics.standardsPerformance.forEach(standard => {
      const domainName = standard.category || standard.standardCode;
      
      if (!domainData[domainName]) {
        domainData[domainName] = [];
      }
      
      standard.studentScores.forEach(student => {
        domainData[domainName].push({
          points: student.pointsEarned,
          possible: student.pointsPossible,
          percentage: student.percentage
        });
      });
    });
    
    // Calculate score distributions for each domain (0-4 point scale similar to Writing)
    const scoreCounts: Record<string, Record<number, number>> = {};
    Object.entries(domainData).forEach(([domain, scores]) => {
      scoreCounts[domain] = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      
      scores.forEach(student => {
        // Convert points earned/possible to 0-4 scale
        let score = 0;
        if (student.possible > 0) {
          const percentage = (student.points / student.possible) * 100;
          // Map percentage to 0-4 scale
          if (percentage >= 90) score = 4;
          else if (percentage >= 75) score = 3;
          else if (percentage >= 50) score = 2;
          else if (percentage >= 25) score = 1;
          else score = 0;
        }
        
        scoreCounts[domain][score]++;
      });
    });
    
    // Only show domains that have data
    const availableDomains = Object.keys(scoreCounts).filter(domain => {
      const total = Object.values(scoreCounts[domain]).reduce((a, b) => a + b, 0);
      return total > 0;
    });
    
    if (availableDomains.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Science Domain Score Distribution
          </h4>
          <p className="text-gray-500 dark:text-gray-400">No Science domain data available</p>
        </div>
      );
    }
    
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Science Domain Score Distribution
        </h4>
        
        {/* Dynamic grid based on number of domains */}
        <div className={`grid gap-4 ${availableDomains.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
          {availableDomains.map(domain => {
            const counts = scoreCounts[domain];
            const total = Object.values(counts).reduce((a, b) => a + b, 0);
            
            return (
              <div key={domain} className="space-y-2">
                <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 text-center">{domain}</h5>
                <div className="flex items-end gap-1 h-20">
                  {[0, 1, 2, 3, 4].map(score => {
                    const count = counts[score];
                    const percentage = total > 0 ? (count / total) * 100 : 0;
                    const height = percentage; // Height as percentage
                    
                    return (
                      <div key={score} className="flex-1 flex flex-col items-center">
                        <div className="w-full flex flex-col items-center justify-end h-16">
                          <div 
                            className={`w-full rounded-t transition-all ${
                              score === 4 ? 'bg-green-500' :
                              score === 3 ? 'bg-yellow-500' :
                              score === 2 ? 'bg-orange-500' :
                              'bg-red-500'
                            }`}
                            style={{ height: `${height}%` }}
                            title={`${count} students (${Math.round(percentage)}%)`}
                          >
                            {count > 0 && (
                              <div className="text-xs text-white text-center font-medium px-1">
                                {count}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                          {score}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <strong>Scoring Guide:</strong> 4 = Exceptional (90%+), 3 = Proficient (75-89%), 2 = Approaching (50-74%), 1 = Developing (25-49%), 0 = Beginning (&lt;25%)
          </p>
        </div>
      </div>
    );
  };

  const renderIReadyMatrix = () => {
    if (!testAnalytics) return null;

    // Get all available test periods from time series data
    const periods = testAnalytics.timeSeriesData.map(d => d.period).sort((a, b) => {
      // Sort chronologically by parsing the date string (e.g., "Sep 2024")
      const dateA = new Date(a + " 01"); // Add day for proper Date parsing
      const dateB = new Date(b + " 01");
      return dateA.getTime() - dateB.getTime();
    });

    // Function to get color based on percentile - adjusted for low-performing schools
    const getPercentileColor = (percentile: number) => {
      // More equitable scale for highlighting relative performance
      if (percentile >= 50) return 'bg-green-500'; // Top 50% - green (celebrating top performers)
      if (percentile >= 35) return 'bg-yellow-500'; // Above 35th percentile - yellow  
      if (percentile >= 20) return 'bg-orange-500'; // Above 20th percentile - orange
      if (percentile >= 10) return 'bg-red-500'; // Above 10th percentile - red
      return 'bg-red-700'; // Below 10th percentile - dark red
    };

    // Function to get color based on scale score for domains (relative performance within your school)
    const getScaleScoreColor = (score: number, allScoresForComparison: number[]) => {
      if (allScoresForComparison.length === 0) return 'bg-gray-400';
      
      // Calculate percentile rank within your school's data
      const sortedScores = [...allScoresForComparison].sort((a, b) => a - b);
      const rank = sortedScores.filter(s => s <= score).length;
      const percentileRank = (rank / sortedScores.length) * 100;
      
      // Use similar thresholds as percentile colors but for relative performance
      if (percentileRank >= 80) return 'bg-green-500'; // Top 20% of your scores
      if (percentileRank >= 65) return 'bg-yellow-500'; // Above 65th percentile of your scores
      if (percentileRank >= 40) return 'bg-orange-500'; // Above 40th percentile of your scores
      if (percentileRank >= 20) return 'bg-red-500'; // Above 20th percentile of your scores
      return 'bg-red-700'; // Bottom 20% of your scores
    };

    const getPercentileTextColor = (percentile: number) => {
      return 'text-white'; // Always white text for contrast
    };

    // Collect all scale scores for relative color coding
    const allScoresForComparison: number[] = [];
    testAnalytics.standardsPerformance.forEach(domain => {
      periods.forEach(period => {
        const periodStudents = (domain as any).studentScoresByPeriod?.[period] || [];
        if (periodStudents.length > 0) {
          const avgScore = Math.round(periodStudents.reduce((sum: number, s: any) => sum + s.score, 0) / periodStudents.length);
          allScoresForComparison.push(avgScore);
        }
      });
    });

    return (
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100 min-w-[200px]">
                Domain
              </th>
              {periods.map(period => (
                <th key={period} className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-gray-100 min-w-[120px]">
                  {period}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
            {testAnalytics.standardsPerformance.map(domain => (
              <tr key={domain.standardCode} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">
                  {domain.standardCode}
                </td>
                {periods.map(period => {
                  // Get students for this domain and period
                  const periodStudents = (domain as any).studentScoresByPeriod?.[period] || [];
                  
                  if (periodStudents.length === 0) {
                    return (
                      <td key={period} className="px-4 py-3 text-center text-sm text-gray-400">
                        -
                      </td>
                    );
                  }

                  // Calculate average score for this domain/period
                  const avgScore = Math.round(periodStudents.reduce((sum: number, s: any) => sum + s.score, 0) / periodStudents.length);
                  
                  // Only show percentiles for Overall Performance (other domains don't have domain-specific percentiles)
                  const percentileStudents = periodStudents.filter((s: any) => s.percentile !== null);
                  const avgPercentile = percentileStudents.length > 0 
                    ? Math.round(percentileStudents.reduce((sum: number, s: any) => sum + s.percentile, 0) / percentileStudents.length)
                    : null;
                  
                  const isOverallPerformance = domain.standardCode === 'Overall Performance';

                  return (
                    <td key={period} className="px-4 py-3 text-center">
                      <div 
                        className={`inline-flex flex-col items-center justify-center rounded-lg px-3 py-2 min-w-[80px] ${
                          isOverallPerformance && avgPercentile !== null 
                            ? getPercentileColor(avgPercentile) 
                            : getScaleScoreColor(avgScore, allScoresForComparison)
                        } text-white`}
                        title={`${periodStudents.length} students - Avg Score: ${avgScore}${avgPercentile !== null ? `, Avg Percentile: ${avgPercentile}%` : ' (relative to class performance)'}`}
                      >
                        <div className="text-sm font-bold">
                          {avgScore}
                        </div>
                        {isOverallPerformance && avgPercentile !== null && (
                          <div className="text-xs opacity-90">
                            {avgPercentile}%
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            <strong>Reading Guide:</strong> Numbers show Average Scale Scores. Overall Performance shows percentiles (bottom number). Domain colors show relative performance within your class data.
          </p>
          <div className="flex items-center gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-700 rounded"></div>
              <span>Bottom 20%</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-500 rounded"></div>
              <span>20th-39th %ile</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span>40th-64th %ile</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-500 rounded"></div>
              <span>65th-79th %ile</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-500 rounded"></div>
              <span>Top 20%</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
              *Colors show relative performance within your school's data
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderLineChart = (data: TimeSeriesData[], metric: 'averageScaleScore' | 'averagePercentile', color: string, showYAxis: boolean = true) => {
    if (!data || data.length === 0) {
      return (
        <div className="h-64 flex items-center justify-center">
          <p className="text-gray-500 dark:text-gray-400">No time series data available</p>
        </div>
      );
    }

    const width = 400;
    const height = 200;
    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const values = data.map(d => d[metric]);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    const points = data.map((d, i) => {
      const x = padding + (i * chartWidth) / Math.max(data.length - 1, 1);
      const y = padding + chartHeight - ((d[metric] - minValue) / valueRange) * chartHeight;
      return { x, y, value: d[metric], period: d.period };
    });

    const pathData = points.map((point, i) => `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

    return (
      <div className="h-64 flex flex-col">
        <svg width={width} height={height} className="mx-auto">
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((percent) => {
            const y = padding + chartHeight - (percent / 100) * chartHeight;
            return (
              <g key={percent}>
                <line
                  x1={padding}
                  y1={y}
                  x2={width - padding}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity="0.1"
                  className="text-gray-400"
                />
                {showYAxis && (
                  <text
                    x={padding - 5}
                    y={y + 4}
                    textAnchor="end"
                    className="text-xs fill-current text-gray-500"
                  >
                    {percent}
                  </text>
                )}
              </g>
            );
          })}

          {/* Straight line */}
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="3"
            className="drop-shadow-sm"
          />

          {/* Data points */}
          {points.map((point, i) => (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r="4"
                fill={color}
                className="drop-shadow-sm"
              />
              <text
                x={point.x}
                y={point.y - 10}
                textAnchor="middle"
                className="text-xs font-medium fill-current text-gray-700 dark:text-gray-300"
              >
                {point.value}
              </text>
            </g>
          ))}

          {/* X-axis labels */}
          {points.map((point, i) => (
            <text
              key={i}
              x={point.x}
              y={height - 10}
              textAnchor="middle"
              className="text-sm font-medium fill-current text-gray-600 dark:text-gray-400"
            >
              {point.period}
            </text>
          ))}
        </svg>
        
        {/* Legend/Summary */}
        <div className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
          {data.length > 1 && (
            <span>
              Change: {values[values.length - 1] - values[0] > 0 ? '+' : ''}{values[values.length - 1] - values[0]} from {data[0].period} to {data[data.length - 1].period}
            </span>
          )}
        </div>
      </div>
    );
  };

  const getPerformanceColorClass = (percentage: number) => {
    if (percentage >= 80) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    if (percentage >= 60) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    if (percentage >= 40) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
    return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
  };

  const renderProficiencyChart = (distribution: any, title: string) => {
    const total = Object.values(distribution).reduce((a: number, b: any) => a + Number(b), 0);
    if (total === 0) return null;

    const percentages = {
      exceeds: Math.round((distribution.exceeds / total) * 100),
      meets: Math.round((distribution.meets / total) * 100),
      approaching: Math.round((distribution.approaching / total) * 100),
      below: Math.round((distribution.below / total) * 100)
    };

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
        
        <div className="space-y-3">
          <div className="flex items-center">
            <div className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">Exceeds:</div>
            <div className="flex-1 ml-3">
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${percentages.exceeds}%` }}
                ></div>
              </div>
            </div>
            <div className="w-16 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
              {percentages.exceeds}% ({distribution.exceeds})
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">Meets:</div>
            <div className="flex-1 ml-3">
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${percentages.meets}%` }}
                ></div>
              </div>
            </div>
            <div className="w-16 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
              {percentages.meets}% ({distribution.meets})
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">Approaching:</div>
            <div className="flex-1 ml-3">
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500 transition-all duration-500"
                  style={{ width: `${percentages.approaching}%` }}
                ></div>
              </div>
            </div>
            <div className="w-16 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
              {percentages.approaching}% ({distribution.approaching})
            </div>
          </div>

          <div className="flex items-center">
            <div className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">Below:</div>
            <div className="flex-1 ml-3">
              <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${percentages.below}%` }}
                ></div>
              </div>
            </div>
            <div className="w-16 text-right text-sm font-medium text-gray-900 dark:text-gray-100">
              {percentages.below}% ({distribution.below})
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSchoolwideDashboard = () => {
    if (loadingSchoolwide) {
      return (
        <div className="mt-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading schoolwide analytics...</span>
          </div>
        </div>
      );
    }

    if (!schoolwideAnalytics) {
      return (
        <div className="mt-8 text-center py-8 text-gray-500 dark:text-gray-400">
          No schoolwide data available. Please import FAST assessment data to view analytics.
        </div>
      );
    }

    return (
      <div className="mt-8 space-y-6">
        {/* Schoolwide Overview Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2 bg-wasabi-green/10 rounded-lg">
              <TrendingUp size={20} className="text-wasabi-green" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Schoolwide FAST Performance Overview
            </h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Users size={16} className="text-blue-600 dark:text-blue-400" />
                <h4 className="font-medium text-blue-800 dark:text-blue-300">Total Students</h4>
              </div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{schoolwideAnalytics.totalStudents}</p>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <Target size={16} className="text-green-600 dark:text-green-400" />
                <h4 className="font-medium text-green-800 dark:text-green-300">Avg Scale Score</h4>
              </div>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{schoolwideAnalytics.schoolwideAverageScore}</p>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <BarChart3 size={16} className="text-purple-600 dark:text-purple-400" />
                <h4 className="font-medium text-purple-800 dark:text-purple-300">Avg Percentile</h4>
              </div>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{schoolwideAnalytics.schoolwideAveragePercentile}%</p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <ClipboardList size={16} className="text-yellow-600 dark:text-yellow-400" />
                <h4 className="font-medium text-yellow-800 dark:text-yellow-300">Total Assessments</h4>
              </div>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{schoolwideAnalytics.totalAssessments}</p>
            </div>
          </div>
        </div>

        {/* Subject Area Performance */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Performance by Subject Area</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {schoolwideAnalytics.subjectAnalytics && schoolwideAnalytics.subjectAnalytics.map((subject: any) => (
              <div key={subject.subject} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-3">
                  {subject.subject === 'Math' || subject.subject === 'Mathematics' ? (
                    <Calculator size={16} className="text-blue-600 dark:text-blue-400" />
                  ) : subject.subject === 'ELA' || subject.subject === 'Reading' || subject.subject === 'Early Literacy' ? (
                    <BookOpen size={16} className="text-green-600 dark:text-green-400" />
                  ) : subject.subject === 'Science' ? (
                    <BarChart3 size={16} className="text-teal-600 dark:text-teal-400" />
                  ) : (
                    <ClipboardList size={16} className="text-purple-600 dark:text-purple-400" />
                  )}
                  <h4 className="font-medium text-gray-800 dark:text-gray-300">
                    {subject.subject === 'Early Literacy' ? 'ELA/Reading' : subject.subject}
                  </h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Avg Score:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{subject.averageScore}</span>
                  </div>
                  {/* Only show Avg Percentile for ELA, Reading, Math, and Mathematics - not Writing or Science */}
                  {(subject.subject === 'ELA' || subject.subject === 'Reading' || subject.subject === 'Early Literacy' || 
                    subject.subject === 'Math' || subject.subject === 'Mathematics') && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400">Avg Percentile:</span>
                      <span className={`font-medium ${subject.averagePercentile >= 60 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {subject.averagePercentile}%
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Students:</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{subject.studentCount}</span>
                  </div>
                  <div className="pt-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPerformanceColorClass(subject.averagePercentile)}`}>
                      {subject.averagePercentile >= 80 ? 'Excellent' : 
                       subject.averagePercentile >= 60 ? 'Good' : 
                       subject.averagePercentile >= 40 ? 'Needs Improvement' : 'Below Standard'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance by Grade Level */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Performance by Grade Level</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Grade</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Math Score</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg ELA Score</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Scale Score</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Percentile</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Performance</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {schoolwideAnalytics.gradeAnalytics.map((grade: any) => (
                  <tr key={grade.grade}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      Grade {grade.grade}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {grade.studentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {grade.averageMathScore !== null ? grade.averageMathScore : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {grade.averageELAScore !== null ? grade.averageELAScore : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {grade.averageScore}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {grade.averagePercentile}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPerformanceColorClass(grade.averagePercentile)}`}>
                        {grade.averagePercentile >= 80 ? 'Excellent' : 
                         grade.averagePercentile >= 60 ? 'Good' : 
                         grade.averagePercentile >= 40 ? 'Needs Improvement' : 'Below Standard'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Performance by Homeroom */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Performance by Homeroom</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Homeroom</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Students</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Math Score</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg ELA Score</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Scale Score</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Avg Percentile</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Performance</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {schoolwideAnalytics.homeroomAnalytics
                  .sort((a: any, b: any) => b.averagePercentile - a.averagePercentile)
                  .map((homeroom: any) => (
                  <tr key={homeroom.homeroom}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                      {homeroom.homeroom}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {homeroom.studentCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {homeroom.averageMathScore !== null ? homeroom.averageMathScore : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {homeroom.averageELAScore !== null ? homeroom.averageELAScore : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {homeroom.averageScore}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                      {homeroom.averagePercentile}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPerformanceColorClass(homeroom.averagePercentile)}`}>
                        {homeroom.averagePercentile >= 80 ? 'Excellent' : 
                         homeroom.averagePercentile >= 60 ? 'Good' : 
                         homeroom.averagePercentile >= 40 ? 'Needs Improvement' : 'Below Standard'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3-Tiered Performance Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Overall School Distribution */}
          {renderProficiencyChart(
            schoolwideAnalytics.schoolwideProficiencyDistribution,
            'Schoolwide Performance Distribution'
          )}

          {/* Quick Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Key Insights</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Highest Performing Grade</div>
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {schoolwideAnalytics.gradeAnalytics.length > 0 
                    ? `Grade ${schoolwideAnalytics.gradeAnalytics.reduce((max: any, grade: any) => 
                        grade.averagePercentile > max.averagePercentile ? grade : max).grade}`
                    : 'N/A'
                  }
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Students Meeting/Exceeding Standards</div>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {(() => {
                    const total = Object.values(schoolwideAnalytics.schoolwideProficiencyDistribution).reduce((a: number, b: any) => a + Number(b), 0);
                    if (total === 0) return '0%';
                    const meetingExceeding = schoolwideAnalytics.schoolwideProficiencyDistribution.meets + 
                                            schoolwideAnalytics.schoolwideProficiencyDistribution.exceeds;
                    return `${Math.round((meetingExceeding / total) * 100)}%`;
                  })()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Students Needing Support</div>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">
                  {(() => {
                    const total = Object.values(schoolwideAnalytics.schoolwideProficiencyDistribution).reduce((a: number, b: any) => a + Number(b), 0);
                    if (total === 0) return '0%';
                    return `${Math.round((schoolwideAnalytics.schoolwideProficiencyDistribution.below / total) * 100)}%`;
                  })()}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Top Performing Homeroom</div>
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {schoolwideAnalytics.homeroomAnalytics.length > 0 
                    ? schoolwideAnalytics.homeroomAnalytics.reduce((max: any, homeroom: any) => 
                        homeroom.averagePercentile > max.averagePercentile ? homeroom : max).homeroom
                    : 'N/A'
                  }
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAnalyticsDashboard = () => {
    // Show schoolwide analytics when no test is selected
    if (!selectedTestOption) {
      return renderSchoolwideDashboard();
    }

    return (
      <div className="mt-8 space-y-6">
        {/* Overview Cards */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-wasabi-green/10 rounded-lg">
              <TrendingUp size={20} className="text-wasabi-green" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {selectedTestOption.label} - Performance Overview
            </h3>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading assessment data...</span>
            </div>
          ) : testAnalytics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Users size={16} className="text-blue-600 dark:text-blue-400" />
                  <h4 className="font-medium text-blue-800 dark:text-blue-300">Students Tested</h4>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{testAnalytics.totalStudents}</p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Target size={16} className="text-green-600 dark:text-green-400" />
                  <h4 className="font-medium text-green-800 dark:text-green-300">Overall Average</h4>
                </div>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{testAnalytics.overallAverage}%</p>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400" />
                  <h4 className="font-medium text-yellow-800 dark:text-yellow-300">Standards Below 60%</h4>
                </div>
                <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">
                  {testAnalytics.standardsPerformance.filter(s => s.averagePercentage < 60).length}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Select a test to view performance data
            </div>
          )}
        </div>

        {/* Time Series Performance Charts OR Writing/Science Distribution */}
        {testAnalytics && !loading && (
          selectedTest === 'FAST_WRITING_4' || selectedTest === 'FAST_WRITING_5' || selectedTest === 'FAST_SCIENCE_5' ? (
            // For Writing and Science tests, show distribution chart instead of time series
            selectedTest === 'FAST_SCIENCE_5' ? renderScienceDistribution() : renderWritingDistribution()
          ) : (
            // For all other tests, show time series charts
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Average Scale Score Over Time */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <TrendingUp size={20} className="mr-2" />
                  Average Scale Score Over Time
                </h4>
                {renderLineChart(testAnalytics.timeSeriesData, 'averageScaleScore', '#3B82F6', true)}
              </div>

              {/* Average Percentile Over Time */}
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
                  <TrendingUp size={20} className="mr-2" />
                  Average Percentile Over Time
                </h4>
                {renderLineChart(testAnalytics.timeSeriesData, 'averagePercentile', '#10B981', false)}
              </div>
            </div>
          )
        )}


        {/* Detailed Standard Analysis Button */}
        {testAnalytics && !loading && (
          <div className="mb-6">
            <button
              onClick={() => setIsDetailModalOpen(true)}
              className="inline-flex items-center px-4 py-2 bg-wasabi-green hover:bg-wasabi-green/90 text-white rounded-lg font-medium transition-colors"
            >
              <BarChart3 size={16} className="mr-2" />
              Detailed Standard Analysis
            </button>
          </div>
        )}

        {/* iReady Growth Matrix */}
        {testAnalytics && !loading && selectedTest?.startsWith('IREADY_') && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                iReady Domain Performance Over Time
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Scale scores by domain and assessment period - colors show percentile performance
              </p>
            </div>
            {renderIReadyMatrix()}
          </div>
        )}

        {/* Streamlined Standards Performance Table */}
        {testAnalytics && !loading && !selectedTest?.startsWith('IREADY_') && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Standards Performance Overview
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Click any standard to view individual student performance
              </p>
            </div>
            
            {/* Table Header */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/30 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Standard
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Avg Score
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Students
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden md:table-cell">
                      Distribution
                    </th>
                    <th className="px-2 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {testAnalytics.standardsPerformance
                    .sort((a, b) => a.averagePercentage - b.averagePercentage) // Sort by performance, worst first
                    .map((standard, index) => (
                    <React.Fragment key={standard.standardCode}>
                      <tr 
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                          expandedStandards.has(standard.standardCode) ? 'bg-gray-50 dark:bg-gray-700/30' : ''
                        }`}
                        onClick={() => toggleStandardExpanded(standard.standardCode)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0">
                              {expandedStandards.has(standard.standardCode) ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {standard.standardCode}
                              </div>
                              {standard.averagePercentage < 100 && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 mt-1">
                                  Priority
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {(selectedTest === 'FAST_WRITING_4' || selectedTest === 'FAST_WRITING_5') && 
                           (standard.standardCode === 'Purpose/Structure' || standard.standardCode === 'Development' || standard.standardCode === 'Language') ? (
                            // For Writing Mode scores, show average as 0-4 scale
                            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                              getWritingModeColor(Math.round((standard.averagePercentage / 100) * 4))
                            }`}>
                              {((standard.averagePercentage / 100) * 4).toFixed(1)}/4
                            </div>
                          ) : (
                            // For all other scores, show percentage
                            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${
                              standard.averagePercentage === 100 ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' :
                              'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                            }`}>
                              {standard.averagePercentage}%
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-sm text-gray-900 dark:text-gray-100">
                            {standard.studentScores.length}
                          </span>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <div className="flex items-center justify-center gap-2">
                            <div className="flex items-center gap-1">
                              <div className="w-12 h-2 bg-green-500 rounded-full" style={{width: `${(standard.studentScores.filter(s => s.percentage === 100).length / standard.studentScores.length) * 48}px`}}></div>
                              <span className="text-xs text-gray-500">{standard.studentScores.filter(s => s.percentage === 100).length}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-12 h-2 bg-red-500 rounded-full" style={{width: `${(standard.studentScores.filter(s => s.percentage < 100).length / standard.studentScores.length) * 48}px`}}></div>
                              <span className="text-xs text-gray-500">{standard.studentScores.filter(s => s.percentage < 100).length}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-4">
                          <AlertCircle className={`w-4 h-4 ${
                            standard.studentScores.filter(s => s.percentage < 100).length > 0 ? 'text-red-500' : 'text-gray-300'
                          }`} />
                        </td>
                      </tr>
                      
                      {/* Expandable Student Details Row */}
                      {expandedStandards.has(standard.standardCode) && (
                        <tr>
                          <td colSpan={6} className="px-0 py-0 bg-gray-50 dark:bg-gray-800/50">
                            <div className="px-6 py-4">
                              {/* Student Performance Summary */}
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                                    {standard.studentScores.filter(s => s.percentage === 100).length}
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400">Correct</div>
                                </div>
                                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                                    {standard.studentScores.filter(s => s.percentage < 100).length}
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400">Incorrect</div>
                                </div>
                              </div>

                              {/* Student List */}
                              <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Student
                            </th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Points Earned
                            </th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Points Possible
                            </th>
                            <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Percentage
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                          {standard.studentScores
                            .sort((a, b) => a.percentage - b.percentage) // Sort students by performance, lowest first
                            .map((student, studentIndex) => (
                            <tr key={`${standard.standardCode}-${student.studentId}-${studentIndex}`} className={student.percentage < 60 ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                                {student.studentName}
                                {student.percentage < 60 && (
                                  <span className="ml-2 text-xs text-red-600 dark:text-red-400">⚠️</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-center text-gray-900 dark:text-gray-100">
                                {student.pointsEarned}
                              </td>
                              <td className="px-4 py-2 text-sm text-center text-gray-900 dark:text-gray-100">
                                {student.pointsPossible}
                              </td>
                              <td className="px-4 py-2 text-center">
                                {(selectedTest === 'FAST_WRITING_4' || selectedTest === 'FAST_WRITING_5') && 
                                 (standard.standardCode === 'Purpose/Structure' || standard.standardCode === 'Development' || standard.standardCode === 'Language') ? (
                                  // For Writing Mode scores, show 0-4 scale with special colors
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getWritingModeColor(student.pointsEarned)}`}>
                                    {student.pointsEarned}/4
                                  </span>
                                ) : (
                                  // For all other scores, show percentage
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getPerformanceColor(student.percentage)}`}>
                                    {student.percentage}%
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageWrapper>
      <PageHeader
        title="Exam Analytics"
        description="Analyze student performance on FAST assessments by learning standards and domains"
        icon={ClipboardList}
        iconColor="text-blue-600"
      >
        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700">
          🚧 Under Construction
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Compact Assessment Selector - Slim Row */}
        <div className="mb-6 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
              Assessment:
            </label>
            <div className="relative flex-1 max-w-md">
              <select
                value={selectedTest || ''}
                onChange={(e) => e.target.value && handleTestSelection(e.target.value as TestType)}
                className="block w-full px-3 py-2 pr-8 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-md focus:ring-2 focus:ring-wasabi-green focus:border-transparent appearance-none text-sm"
              >
                <option value="">-- Select a test --</option>
                
                {/* Group by subject */}
                <optgroup label="📚 English Language Arts (ELA)">
                  {testOptions.filter(opt => opt.subject === 'ELA').map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                
                <optgroup label="🔢 Mathematics">
                  {testOptions.filter(opt => opt.subject === 'MATH').map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                
                <optgroup label="✏️ Writing">
                  {testOptions.filter(opt => opt.subject === 'WRITING').map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
                
                <optgroup label="🧪 Science">
                  {testOptions.filter(opt => opt.subject === 'SCIENCE').map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </optgroup>
              </select>
              
              <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                <ChevronDown size={20} className="text-gray-400" />
              </div>
            </div>
            
            {selectedTestOption && (
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  selectedTestOption.subject === 'ELA' 
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' 
                    : selectedTestOption.subject === 'MATH'
                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300'
                    : selectedTestOption.subject === 'SCIENCE'
                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'
                    : 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300'
                }`}>
                  {selectedTestOption.subject}
                </span>
                <span className="bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium">
                  Grade {selectedTestOption.grade}
                </span>
              </div>
            )}
          </div>
        </div>


        {/* Analytics Dashboard */}
        {renderAnalyticsDashboard()}

        {/* Detailed Standard Analysis Modal */}
        {isDetailModalOpen && testAnalytics && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex items-start justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
              </div>
              
              <div className="inline-block align-top bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle w-full max-w-6xl">
                <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                      Detailed Standard Analysis
                    </h2>
                    <button
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        setSelectedStandard(null);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                      <X size={24} />
                    </button>
                  </div>
                  
                  {/* Standard Selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select a specific standard to view all student performance:
                    </label>
                    <div className="relative max-w-lg">
                      <select
                        value={selectedStandard || ''}
                        onChange={(e) => setSelectedStandard(e.target.value || null)}
                        className="block w-full px-4 py-3 pr-10 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-xl focus:ring-wasabi-green focus:border-wasabi-green appearance-none"
                      >
                        <option value="">-- Select a standard for detailed view --</option>
                        
                        {Object.entries(testAnalytics.categoryAverages).map(([category]) => (
                          <optgroup key={category} label={category}>
                            {testAnalytics.standardsPerformance
                              .filter(s => s.category === category)
                              .map(standard => (
                                <option key={standard.standardCode} value={standard.standardCode}>
                                  {standard.standardCode} - {standard.averagePercentage}% avg
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      </select>
                      
                      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                        <ChevronDown size={20} className="text-gray-400" />
                      </div>
                    </div>
                    
                    {selectedStandardData && (
                      <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                          {selectedStandardData.standardDescription}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs">
                          <span className={`px-2 py-1 rounded-full font-medium ${getPerformanceColor(selectedStandardData.averagePercentage)}`}>
                            Class Average: {selectedStandardData.averagePercentage}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Detailed Standard Student Performance View */}
                  {selectedStandardData && (
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        All Student Performance: {selectedStandardData.standardCode}
                      </h3>

                      {/* Quick Stats - Binary scoring */}
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {selectedStandardData.studentScores.filter(s => s.percentage === 100).length}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Correct</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                            {selectedStandardData.studentScores.filter(s => s.percentage < 100).length}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Incorrect</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                            {selectedStandardData.averagePercentage}%
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">Class Average</div>
                        </div>
                      </div>

                      {/* All Students Table */}
                      <div className="overflow-x-auto max-h-96">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Student Name
                              </th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Points Earned
                              </th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Points Possible
                              </th>
                              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Result
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                            {selectedStandardData.studentScores
                              .sort((a, b) => b.percentage - a.percentage) // Sort by performance, highest first
                              .map((student, index) => (
                              <tr key={`modal-${selectedStandardData.standardCode}-${student.studentId}-${index}`} className={`
                                ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700/50'}
                                ${student.percentage < 100 ? 'border-l-4 border-red-400' : 'border-l-4 border-green-400'}
                              `}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div>
                                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        {student.studentName}
                                      </div>
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        ID: {student.studentId.slice(-6)}
                                      </div>
                                    </div>
                                    {student.percentage < 100 && (
                                      <span className="ml-2 text-red-500 text-lg" title="Needs attention">⚠️</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                                  {student.pointsEarned}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-900 dark:text-gray-100">
                                  {student.pointsPossible}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                    student.percentage === 100 
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                                  }`}>
                                    {student.percentage === 100 ? 'Correct' : 'Incorrect'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Students needing attention callout */}
                      {selectedStandardData.studentScores.filter(s => s.percentage < 100).length > 0 && (
                        <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
                          <h4 className="text-sm font-medium text-red-800 dark:text-red-200 mb-2">
                            📋 Students Who Answered Incorrectly ({selectedStandardData.studentScores.filter(s => s.percentage < 100).length} students)
                          </h4>
                          <div className="text-sm text-red-700 dark:text-red-300">
                            {selectedStandardData.studentScores
                              .filter(s => s.percentage < 100)
                              .sort((a, b) => a.percentage - b.percentage)
                              .map(s => s.studentName)
                              .join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}