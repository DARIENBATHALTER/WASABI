import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { queryByStudentId } from '../../utils/studentIdQuery';

interface IReadyReadingDataViewProps {
  studentId: number;
}

export default function IReadyReadingDataView({ studentId }: IReadyReadingDataViewProps) {
  // Detect dark mode
  const [isDarkMode, setIsDarkMode] = React.useState(false);
  const [hoveredDomain, setHoveredDomain] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; value: number; domain: string; date: string }>({
    visible: false,
    x: 0,
    y: 0,
    value: 0,
    domain: '',
    date: ''
  });
  
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
    queryKey: ['iready-reading-detailed', studentId],
    queryFn: async () => {
      // Fetch iReady Reading assessments using compound ID utility
      const allAssessments = await queryByStudentId(db.assessments, studentId);
      const assessments = allAssessments.filter(record => 
        (record.source === 'iReady Reading' || record.source === 'iReady') && 
        (record.subject === 'Reading' || record.subject === 'ELA' || record.subject?.includes('Reading'))
      );
      
      console.log(`📖 Found ${assessments.length} iReady Reading assessments for student ${studentId}`);
      
      // Transform data to match component expectations
      return assessments.map(assessment => ({
        testDate: assessment.testDate,
        overallScore: assessment.score,
        percentile: assessment.percentile,
        gradeLevel: assessment.gradeLevel,
        proficiency: assessment.proficiency,
        // Map stored properties to expected names
        duration: assessment.duration,
        overallPlacement: assessment.overallPlacement,
        overallRelativePlacement: assessment.overallRelativePlacement,
        grouping: assessment.grouping,
        lexileMeasure: assessment.lexileMeasure,
        lexileRange: assessment.lexileRange,
        // Reading-specific domain scores
        phonologicalAwarenessScore: assessment.phonologicalAwarenessScore,
        phonologicalAwarenessPlacement: assessment.phonologicalAwarenessPlacement,
        phonologicalAwarenessRelativePlacement: assessment.phonologicalAwarenessRelativePlacement,
        phonicsScore: assessment.phonicsScore,
        phonicsPlacement: assessment.phonicsPlacement,
        phonicsRelativePlacement: assessment.phonicsRelativePlacement,
        highFrequencyWordsScore: assessment.highFrequencyWordsScore,
        highFrequencyWordsPlacement: assessment.highFrequencyWordsPlacement,
        highFrequencyWordsRelativePlacement: assessment.highFrequencyWordsRelativePlacement,
        vocabularyScore: assessment.vocabularyScore,
        vocabularyPlacement: assessment.vocabularyPlacement,
        vocabularyRelativePlacement: assessment.vocabularyRelativePlacement,
        comprehensionOverallScore: assessment.comprehensionOverallScore,
        comprehensionOverallPlacement: assessment.comprehensionOverallPlacement,
        comprehensionOverallRelativePlacement: assessment.comprehensionOverallRelativePlacement,
        comprehensionLiteratureScore: assessment.comprehensionLiteratureScore,
        comprehensionLiteraturePlacement: assessment.comprehensionLiteraturePlacement,
        comprehensionLiteratureRelativePlacement: assessment.comprehensionLiteratureRelativePlacement,
        comprehensionInformationalScore: assessment.comprehensionInformationalScore,
        comprehensionInformationalPlacement: assessment.comprehensionInformationalPlacement,
        comprehensionInformationalRelativePlacement: assessment.comprehensionInformationalRelativePlacement,
        // Growth metrics
        diagnosticGain: assessment.diagnosticGain,
        annualTypicalGrowth: assessment.annualTypicalGrowthMeasure,
        annualStretchGrowth: assessment.annualStretchGrowthMeasure,
        midOnGradeScore: assessment.midOnGradeLevelScaleScore,
        readingDifficultyIndicator: assessment.readingDifficultyIndicator
      }))
        .sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());
    },
  });

  const getPlacementColor = (placement: string, isDark: boolean = false) => {
    if (!placement) return isDark ? 'transparent' : 'transparent';
    const p = placement.toLowerCase();
    
    if (p.includes('above grade') || p.includes('surpassed level')) return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff'; // Blue
    if (p.includes('on grade') || p.includes('mid or above grade level')) return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc'; // Green
    if (p.includes('1 grade') && p.includes('below')) return isDark ? 'rgb(251 191 36 / 0.3)' : '#ffff99'; // Yellow
    if (p.includes('2 grade') && p.includes('below')) return isDark ? 'rgb(249 115 22 / 0.3)' : '#ffcc99'; // Orange
    if (p.includes('3 or more') || p.includes('emerging') || p.includes('not assessed')) return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc'; // Red
    
    return isDark ? 'rgb(107 114 128 / 0.2)' : '#f0f0f0'; // Gray
  };

  const getScoreColor = (score: number, midGradeScore: number = 450, isDark: boolean = false) => {
    if (score >= midGradeScore + 50) return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff'; // Blue - well above
    if (score >= midGradeScore) return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc'; // Green - on grade
    if (score >= midGradeScore - 50) return isDark ? 'rgb(251 191 36 / 0.3)' : '#ffff99'; // Yellow - slightly below
    if (score >= midGradeScore - 100) return isDark ? 'rgb(249 115 22 / 0.3)' : '#ffcc99'; // Orange - below
    return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc'; // Red - well below
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-wasabi-green"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading iReady Reading data...</span>
      </div>
    );
  }

  if (!assessmentData?.length) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        <p>No iReady Reading data available</p>
        <p className="text-sm">Data will appear here once assessments are uploaded</p>
      </div>
    );
  }

  // Reading-specific metrics to display in the table
  const metrics = [
    { key: 'duration', label: 'Duration (min)' },
    { key: 'overallScore', label: 'Overall Scale Score', hasColor: true },
    { key: 'overallPlacement', label: 'Overall Placement', hasColor: true },
    { key: 'overallRelativePlacement', label: 'Overall Relative Placement', hasColor: true },
    { key: 'percentile', label: 'Percentile' },
    { key: 'grouping', label: 'Grouping' },
    { key: 'lexileMeasure', label: 'Lexile Measure' },
    { key: 'lexileRange', label: 'Lexile Range' },
    { key: 'phonologicalAwareness', label: 'Phonological Awareness Scale Score', hasColor: true, domain: true },
    { key: 'phonologicalAwarenessPlacement', label: 'Phonological Awareness Placement', hasColor: true },
    { key: 'phonologicalAwarenessRelative', label: 'Phonological Awareness Relative Placement', hasColor: true },
    { key: 'phonics', label: 'Phonics Scale Score', hasColor: true, domain: true },
    { key: 'phonicsPlacement', label: 'Phonics Placement', hasColor: true },
    { key: 'phonicsRelative', label: 'Phonics Relative Placement', hasColor: true },
    { key: 'highFrequencyWords', label: 'High-Frequency Words Scale Score', hasColor: true, domain: true },
    { key: 'highFrequencyWordsPlacement', label: 'High-Frequency Words Placement', hasColor: true },
    { key: 'highFrequencyWordsRelative', label: 'High-Frequency Words Relative Placement', hasColor: true },
    { key: 'vocabulary', label: 'Vocabulary Scale Score', hasColor: true, domain: true },
    { key: 'vocabularyPlacement', label: 'Vocabulary Placement', hasColor: true },
    { key: 'vocabularyRelative', label: 'Vocabulary Relative Placement', hasColor: true },
    { key: 'comprehensionOverall', label: 'Comprehension: Overall Scale Score', hasColor: true, domain: true },
    { key: 'comprehensionOverallPlacement', label: 'Comprehension: Overall Placement', hasColor: true },
    { key: 'comprehensionOverallRelative', label: 'Comprehension: Overall Relative Placement', hasColor: true },
    { key: 'comprehensionLiterature', label: 'Comprehension: Literature Scale Score', hasColor: true, domain: true },
    { key: 'comprehensionLiteraturePlacement', label: 'Comprehension: Literature Placement', hasColor: true },
    { key: 'comprehensionLiteratureRelative', label: 'Comprehension: Literature Relative Placement', hasColor: true },
    { key: 'comprehensionInformational', label: 'Comprehension: Informational Text Scale Score', hasColor: true, domain: true },
    { key: 'comprehensionInformationalPlacement', label: 'Comprehension: Informational Text Placement', hasColor: true },
    { key: 'comprehensionInformationalRelative', label: 'Comprehension: Informational Text Relative Placement', hasColor: true },
    { key: 'diagnosticGain', label: 'Diagnostic Gain' },
    { key: 'annualTypical', label: 'Annual Typical Growth Measure' },
    { key: 'annualStretch', label: 'Annual Stretch Growth Measure' },
    { key: 'midGradeScore', label: 'Mid On Grade Level Scale Score' },
    { key: 'readingDifficultyIndicator', label: 'Reading Difficulty Indicator' },
  ];

  // Domain charts data - Reading-specific domains
  const domainCharts = [
    { key: 'overallScore', label: 'Overall Scale Score', color: '#22c55e' },
    { key: 'phonologicalAwareness', label: 'Phonological Awareness', color: '#3b82f6' },
    { key: 'phonics', label: 'Phonics', color: '#8b5cf6' },
    { key: 'highFrequencyWords', label: 'High-Frequency Words', color: '#f59e0b' },
    { key: 'vocabulary', label: 'Vocabulary', color: '#ef4444' },
    { key: 'comprehensionOverall', label: 'Comprehension Overall', color: '#06b6d4' },
  ];

  return (
    <div className="space-y-6">
      {/* Comprehensive Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="text-left py-3 px-3 font-bold text-base text-gray-900 dark:text-gray-100 sticky left-0 bg-gray-50 dark:bg-gray-700">
                  Metric
                </th>
                {assessmentData.map((assessment: any, index: number) => (
                  <th key={index} className="text-center py-2 px-3 font-bold text-base text-gray-900 dark:text-gray-100 min-w-[100px]">
                    {new Date(assessment.testDate).toLocaleDateString()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {metrics.map((metric) => (
                <tr key={metric.key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-2 px-3 text-gray-900 dark:text-gray-100 font-medium sticky left-0 bg-white dark:bg-gray-800">
                    {metric.label}
                  </td>
                  {assessmentData.map((assessment: any, index: number) => {
                    let value = '';
                    let color = isDarkMode ? 'transparent' : 'transparent';
                    
                    // Map metric keys to data properties
                    switch (metric.key) {
                      case 'duration':
                        value = assessment.duration || '-';
                        break;
                      case 'overallScore':
                        value = assessment.overallScore || '-';
                        if (metric.hasColor && value !== '-' && typeof assessment.overallScore === 'number') {
                          color = getScoreColor(assessment.overallScore, assessment.midOnGradeScore, isDarkMode);
                        }
                        break;
                      case 'overallPlacement':
                        value = assessment.overallPlacement || '-';
                        break;
                      case 'overallRelativePlacement':
                        value = assessment.overallRelativePlacement || '-';
                        break;
                      case 'percentile':
                        value = assessment.percentile || '-';
                        break;
                      case 'grouping':
                        value = assessment.grouping || '-';
                        break;
                      case 'lexileMeasure':
                        value = assessment.lexileMeasure || '-';
                        break;
                      case 'lexileRange':
                        value = assessment.lexileRange || '-';
                        break;
                      case 'phonologicalAwareness':
                        value = assessment.phonologicalAwarenessScore || '-';
                        break;
                      case 'phonologicalAwarenessPlacement':
                        value = assessment.phonologicalAwarenessPlacement || '-';
                        break;
                      case 'phonologicalAwarenessRelative':
                        value = assessment.phonologicalAwarenessRelativePlacement || '-';
                        break;
                      case 'phonics':
                        value = assessment.phonicsScore || '-';
                        break;
                      case 'phonicsPlacement':
                        value = assessment.phonicsPlacement || '-';
                        break;
                      case 'phonicsRelative':
                        value = assessment.phonicsRelativePlacement || '-';
                        break;
                      case 'highFrequencyWords':
                        value = assessment.highFrequencyWordsScore || '-';
                        break;
                      case 'highFrequencyWordsPlacement':
                        value = assessment.highFrequencyWordsPlacement || '-';
                        break;
                      case 'highFrequencyWordsRelative':
                        value = assessment.highFrequencyWordsRelativePlacement || '-';
                        break;
                      case 'vocabulary':
                        value = assessment.vocabularyScore || '-';
                        break;
                      case 'vocabularyPlacement':
                        value = assessment.vocabularyPlacement || '-';
                        break;
                      case 'vocabularyRelative':
                        value = assessment.vocabularyRelativePlacement || '-';
                        break;
                      case 'comprehensionOverall':
                        value = assessment.comprehensionOverallScore || '-';
                        break;
                      case 'comprehensionOverallPlacement':
                        value = assessment.comprehensionOverallPlacement || '-';
                        break;
                      case 'comprehensionOverallRelative':
                        value = assessment.comprehensionOverallRelativePlacement || '-';
                        break;
                      case 'comprehensionLiterature':
                        value = assessment.comprehensionLiteratureScore || '-';
                        break;
                      case 'comprehensionLiteraturePlacement':
                        value = assessment.comprehensionLiteraturePlacement || '-';
                        break;
                      case 'comprehensionLiteratureRelative':
                        value = assessment.comprehensionLiteratureRelativePlacement || '-';
                        break;
                      case 'comprehensionInformational':
                        value = assessment.comprehensionInformationalScore || '-';
                        break;
                      case 'comprehensionInformationalPlacement':
                        value = assessment.comprehensionInformationalPlacement || '-';
                        break;
                      case 'comprehensionInformationalRelative':
                        value = assessment.comprehensionInformationalRelativePlacement || '-';
                        break;
                      case 'diagnosticGain':
                        value = assessment.diagnosticGain || '-';
                        break;
                      case 'annualTypical':
                        value = assessment.annualTypicalGrowth || '-';
                        break;
                      case 'annualStretch':
                        value = assessment.annualStretchGrowth || '-';
                        break;
                      case 'midGradeScore':
                        value = assessment.midOnGradeScore || '-';
                        break;
                      case 'readingDifficultyIndicator':
                        value = assessment.readingDifficultyIndicator || '-';
                        break;
                      default:
                        value = '-';
                    }
                    
                    if (metric.hasColor && value !== '-' && color === 'transparent') {
                      if (metric.key.includes('Placement') || metric.key.includes('Relative')) {
                        color = getPlacementColor(value.toString(), isDarkMode);
                      } else if (typeof value === 'number') {
                        color = getScoreColor(value, assessment.midOnGradeScore, isDarkMode);
                      }
                    }
                    
                    return (
                      <td 
                        key={index} 
                        className="py-2 px-3 text-center text-gray-900 dark:text-gray-100"
                        style={{ backgroundColor: metric.hasColor ? color : undefined }}
                      >
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Line Domain Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h5 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4 text-center">
          Domain Performance Over Time
        </h5>
        
        {/* Chart */}
        <div className="relative h-64 mb-6">
          <svg className="w-full h-full" viewBox="0 0 600 240">
            {(() => {
              // Calculate dynamic y-axis range based on actual data
              const allValues: number[] = [];
              domainCharts.forEach(chart => {
                assessmentData.forEach((assessment: any) => {
                  let value = 0;
                  switch (chart.key) {
                    case 'overallScore':
                      value = assessment.overallScore || 0;
                      break;
                    case 'phonologicalAwareness':
                      value = assessment.phonologicalAwarenessScore || 0;
                      break;
                    case 'phonics':
                      value = assessment.phonicsScore || 0;
                      break;
                    case 'highFrequencyWords':
                      value = assessment.highFrequencyWordsScore || 0;
                      break;
                    case 'vocabulary':
                      value = assessment.vocabularyScore || 0;
                      break;
                    case 'comprehensionOverall':
                      value = assessment.comprehensionOverallScore || 0;
                      break;
                  }
                  if (value > 0) allValues.push(value);
                });
              });

              if (allValues.length === 0) return null;

              const minValue = Math.min(...allValues);
              const maxValue = Math.max(...allValues);
              const padding = (maxValue - minValue) * 0.1; // 10% padding
              const yMin = Math.max(0, Math.floor((minValue - padding) / 50) * 50);
              const yMax = Math.ceil((maxValue + padding) / 50) * 50;
              const yRange = yMax - yMin;

              // Generate grid lines
              const gridStep = yRange <= 100 ? 25 : yRange <= 200 ? 50 : 100;
              const gridValues = [];
              for (let i = Math.ceil(yMin / gridStep) * gridStep; i <= yMax; i += gridStep) {
                gridValues.push(i);
              }

              return (
                <>
                  {/* Background grid */}
                  {gridValues.map(gridValue => {
                    const y = 220 - ((gridValue - yMin) / yRange) * 200;
                    return (
                      <g key={gridValue}>
                        <line
                          x1="60" y1={y} x2="580" y2={y}
                          stroke={isDarkMode ? "#374151" : "#e5e7eb"}
                          strokeDasharray="2 2"
                        />
                        <text
                          x="55" y={y + 3}
                          className={`text-xs ${isDarkMode ? 'fill-gray-500' : 'fill-gray-400'}`}
                          textAnchor="end"
                        >
                          {gridValue}
                        </text>
                      </g>
                    );
                  })}
                </>
              );
            })()}
            
            {/* X-axis labels (dates) */}
            {assessmentData.map((assessment: any, index: number) => {
              const x = 60 + (index / Math.max(assessmentData.length - 1, 1)) * 520;
              return (
                <text
                  key={index}
                  x={x}
                  y={235}
                  className={`text-xs ${isDarkMode ? 'fill-gray-500' : 'fill-gray-400'}`}
                  textAnchor="middle"
                >
                  {new Date(assessment.testDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })}
                </text>
              );
            })}
            
            {(() => {
              // Calculate dynamic y-axis range (same as above)
              const allValues: number[] = [];
              domainCharts.forEach(chart => {
                assessmentData.forEach((assessment: any) => {
                  let value = 0;
                  switch (chart.key) {
                    case 'overallScore':
                      value = assessment.overallScore || 0;
                      break;
                    case 'phonologicalAwareness':
                      value = assessment.phonologicalAwarenessScore || 0;
                      break;
                    case 'phonics':
                      value = assessment.phonicsScore || 0;
                      break;
                    case 'highFrequencyWords':
                      value = assessment.highFrequencyWordsScore || 0;
                      break;
                    case 'vocabulary':
                      value = assessment.vocabularyScore || 0;
                      break;
                    case 'comprehensionOverall':
                      value = assessment.comprehensionOverallScore || 0;
                      break;
                  }
                  if (value > 0) allValues.push(value);
                });
              });

              if (allValues.length === 0) return null;

              const minValue = Math.min(...allValues);
              const maxValue = Math.max(...allValues);
              const padding = (maxValue - minValue) * 0.1;
              const yMin = Math.max(0, Math.floor((minValue - padding) / 50) * 50);
              const yMax = Math.ceil((maxValue + padding) / 50) * 50;
              const yRange = yMax - yMin;

              return (
                <>
                  {/* Domain lines */}
                  {domainCharts.map((chart) => {
                    const points = assessmentData.map((assessment: any, index: number) => {
                      let value = 0;
                      switch (chart.key) {
                        case 'overallScore':
                          value = assessment.overallScore || 0;
                          break;
                        case 'phonologicalAwareness':
                          value = assessment.phonologicalAwarenessScore || 0;
                          break;
                        case 'phonics':
                          value = assessment.phonicsScore || 0;
                          break;
                        case 'highFrequencyWords':
                          value = assessment.highFrequencyWordsScore || 0;
                          break;
                        case 'vocabulary':
                          value = assessment.vocabularyScore || 0;
                          break;
                        case 'comprehensionOverall':
                          value = assessment.comprehensionOverallScore || 0;
                          break;
                        case 'midGradeScore':
                          value = assessment.midOnGradeScore || 0;
                          break;
                      }
                      const x = 60 + (index / Math.max(assessmentData.length - 1, 1)) * 520;
                      const y = 220 - ((value - yMin) / yRange) * 200;
                      return { x, y, value };
                    }).filter(p => p.value > 0);

                    if (points.length === 0) return null;

                    const isHighlighted = hoveredDomain === chart.key || hoveredDomain === null;
                    const opacity = hoveredDomain === null ? 1 : (isHighlighted ? 1 : 0.3);

                    return (
                      <g key={chart.key} style={{ opacity }}>
                        {/* Data line */}
                        <polyline
                          points={points.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke={chart.color}
                          strokeWidth={isHighlighted ? 3 : 2}
                        />
                        
                        {/* Data points */}
                        {points.map((point, pointIndex) => {
                          const assessmentIndex = assessmentData.findIndex((_: any, idx: number) => {
                            const x = 60 + (idx / Math.max(assessmentData.length - 1, 1)) * 520;
                            return Math.abs(x - point.x) < 1;
                          });
                          const assessment = assessmentData[assessmentIndex];
                          return (
                            <circle
                              key={pointIndex}
                              cx={point.x}
                              cy={point.y}
                              r={isHighlighted ? 5 : 4}
                              fill={chart.color}
                              stroke="white"
                              strokeWidth="2"
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={(e) => {
                                const svgElement = e.currentTarget.closest('svg');
                                if (svgElement) {
                                  const svgRect = svgElement.getBoundingClientRect();
                                  const parentRect = svgElement.parentElement?.getBoundingClientRect();
                                  if (parentRect) {
                                    setHoveredDomain(chart.key);
                                    setTooltip({
                                      visible: true,
                                      x: point.x,
                                      y: point.y - 15,
                                      value: point.value,
                                      domain: chart.label,
                                      date: assessment ? new Date(assessment.testDate).toLocaleDateString() : ''
                                    });
                                  }
                                }
                              }}
                              onMouseLeave={() => {
                                setHoveredDomain(null);
                                setTooltip(prev => ({ ...prev, visible: false }));
                              }}
                            />
                          );
                        })}
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </svg>
          
          {/* Tooltip */}
          {tooltip.visible && (
            <div
              className="absolute z-50 px-3 py-2 text-sm bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg shadow-lg pointer-events-none"
              style={{
                left: `${tooltip.x}px`,
                top: `${tooltip.y}px`,
                transform: 'translate(-50%, -100%)'
              }}
            >
              <div className="font-medium">{tooltip.domain}</div>
              <div>Score: {tooltip.value}</div>
              <div className="text-xs opacity-75">{tooltip.date}</div>
            </div>
          )}
        </div>
        
        {/* Interactive Legend Table */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {domainCharts.map((chart) => (
              <div
                key={chart.key}
                className="flex items-center p-2 rounded cursor-pointer transition-all duration-200 hover:bg-white dark:hover:bg-gray-800"
                onMouseEnter={() => setHoveredDomain(chart.key)}
                onMouseLeave={() => setHoveredDomain(null)}
                style={{ 
                  opacity: hoveredDomain === null || hoveredDomain === chart.key ? 1 : 0.5,
                  backgroundColor: hoveredDomain === chart.key ? (isDarkMode ? 'rgb(31 41 55)' : 'white') : 'transparent'
                }}
              >
                <div
                  className="w-4 h-3 mr-3 rounded-sm border border-gray-300 dark:border-gray-600"
                  style={{ backgroundColor: chart.color }}
                ></div>
                <span className="text-gray-700 dark:text-gray-300 font-medium">
                  {chart.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}