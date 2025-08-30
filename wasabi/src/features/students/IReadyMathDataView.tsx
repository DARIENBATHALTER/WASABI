import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { queryByStudentId } from '../../utils/studentIdQuery';

interface IReadyMathDataViewProps {
  studentId: number;
}

interface IReadyAssessment {
  testDate: Date;
  overallScaleScore: number;
  overallPlacement: string;
  overallRelativePlacement: string;
  percentile: number;
  grouping: string;
  quantileMeasure: string;
  quantileRange: string;
  
  // Domain scores
  numberOperationsScore: number;
  numberOperationsPlacement: string;
  numberOperationsRelativePlacement: string;
  
  algebraScore: number;
  algebraPlacement: string;
  algebraRelativePlacement: string;
  
  measurementDataScore: number;
  measurementDataPlacement: string;
  measurementDataRelativePlacement: string;
  
  geometryScore: number;
  geometryPlacement: string;
  geometryRelativePlacement: string;
  
  // Growth metrics
  diagnosticGain: number;
  annualTypicalGrowth: number;
  annualStretchGrowth: number;
  percentProgressTypical: number;
  percentProgressStretch: number;
  midOnGradeScore: number;
}

export default function IReadyMathDataView({ studentId }: IReadyMathDataViewProps) {
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

  // Color function for placement values
  const getPlacementColor = (placement: string, isDark: boolean = false) => {
    if (!placement) return isDark ? 'rgb(75 85 99 / 0.3)' : '#f0f0f0';
    
    const p = placement.toLowerCase();
    
    // Above grade level - Excellent (Green)
    if (p.includes('above grade') || p.includes('exceed') || p.includes('advanced')) {
      return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc';
    }
    
    // At/On grade level - Good (Blue)
    if (p.includes('on grade') || p.includes('at grade') || p.includes('mid grade') || p.includes('meets')) {
      return isDark ? 'rgb(59 130 246 / 0.3)' : '#cce6ff';
    }
    
    // 1 grade below - Approaching (Yellow)
    if (p.includes('1 grade below') || p.includes('approaching') || p.includes('nearly')) {
      return isDark ? 'rgb(234 179 8 / 0.3)' : '#ffff99';
    }
    
    // 2 grades below - Below (Orange)
    if (p.includes('2 grade') || p.includes('below') || p.includes('developing')) {
      return isDark ? 'rgb(249 115 22 / 0.3)' : '#ffcc99';
    }
    
    // 3+ grades below or early levels - Well Below (Red)
    if (p.includes('3 grade') || p.includes('emerging') || p.includes('early') || p.includes('well below')) {
      return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc';
    }
    
    // Default for unknown
    return isDark ? 'rgb(75 85 99 / 0.3)' : '#f0f0f0';
  };

  const { data: assessmentData, isLoading } = useQuery({
    queryKey: ['iready-math-detailed', studentId],
    queryFn: async () => {
      // Fetch iReady Math assessments
      const allAssessments = await queryByStudentId(db.assessments, studentId);
      const assessments = allAssessments.filter(record => 
        (record.source === 'iReady Math' || record.source === 'iReady') && 
        (record.subject === 'Math' || record.subject?.includes('Math'))
      );
      
      console.log(`📊 Found ${assessments.length} iReady Math assessments for student ${studentId}`);
      
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
        quantileMeasure: assessment.quantileMeasure,
        quantileRange: assessment.quantileRange,
        numberOperationsScore: assessment.numberOperationsScore,
        numberOperationsPlacement: assessment.numberOperationsPlacement,
        numberOperationsRelativePlacement: assessment.numberOperationsRelativePlacement,
        algebraScore: assessment.algebraScore,
        algebraPlacement: assessment.algebraPlacement,
        algebraRelativePlacement: assessment.algebraRelativePlacement,
        measurementDataScore: assessment.measurementDataScore,
        measurementDataPlacement: assessment.measurementDataPlacement,
        measurementDataRelativePlacement: assessment.measurementDataRelativePlacement,
        geometryScore: assessment.geometryScore,
        geometryPlacement: assessment.geometryPlacement,
        geometryRelativePlacement: assessment.geometryRelativePlacement,
        diagnosticGain: assessment.diagnosticGain,
        annualTypicalGrowth: assessment.annualTypicalGrowthMeasure,
        annualStretchGrowth: assessment.annualStretchGrowthMeasure,
        midOnGradeScore: assessment.midOnGradeLevelScaleScore
      }))
        .sort((a, b) => new Date(a.testDate).getTime() - new Date(b.testDate).getTime());
    },
  });


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
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading iReady Math data...</span>
      </div>
    );
  }

  if (!assessmentData?.length) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        <p>No iReady Math data available</p>
        <p className="text-sm">Data will appear here once assessments are uploaded</p>
      </div>
    );
  }

  // Metrics to display in the table
  const metrics = [
    { key: 'duration', label: 'Duration (min)' },
    { key: 'overallScore', label: 'Overall Scale Score', hasColor: true },
    { key: 'overallPlacement', label: 'Overall Placement', hasColor: true },
    { key: 'overallRelativePlacement', label: 'Overall Relative Placement', hasColor: true },
    { key: 'percentile', label: 'Percentile' },
    { key: 'grouping', label: 'Grouping' },
    { key: 'quantileMeasure', label: 'Quantile Measure' },
    { key: 'quantileRange', label: 'Quantile Range' },
    { key: 'numberOperations', label: 'Number and Operations Scale Score', hasColor: true, domain: true },
    { key: 'numberOperationsPlacement', label: 'Number and Operations Placement', hasColor: true },
    { key: 'numberOperationsRelative', label: 'Number and Operations Relative Placement', hasColor: true },
    { key: 'algebra', label: 'Algebra and Algebraic Thinking Scale Score', hasColor: true, domain: true },
    { key: 'algebraPlacement', label: 'Algebra and Algebraic Thinking Placement', hasColor: true },
    { key: 'algebraRelative', label: 'Algebra and Algebraic Thinking Relative Placement', hasColor: true },
    { key: 'measurement', label: 'Measurement and Data Scale Score', hasColor: true, domain: true },
    { key: 'measurementPlacement', label: 'Measurement and Data Placement', hasColor: true },
    { key: 'measurementRelative', label: 'Measurement and Data Relative Placement', hasColor: true },
    { key: 'geometry', label: 'Geometry Scale Score', hasColor: true, domain: true },
    { key: 'geometryPlacement', label: 'Geometry Placement', hasColor: true },
    { key: 'geometryRelative', label: 'Geometry Relative Placement', hasColor: true },
    { key: 'diagnosticGain', label: 'Diagnostic Gain' },
    { key: 'annualTypical', label: 'Annual Typical Growth Measure' },
    { key: 'annualStretch', label: 'Annual Stretch Growth Measure' },
    { key: 'midGradeScore', label: 'Mid On Grade Level Scale Score' },
  ];

  // Domain charts data
  const domainCharts = [
    { key: 'overallScore', label: 'Overall Scale Score', color: '#22c55e' },
    { key: 'numberOperations', label: 'Number and Operations Scale Score', color: '#3b82f6' },
    { key: 'algebra', label: 'Algebra and Algebraic Thinking Scale Score', color: '#8b5cf6' },
    { key: 'measurement', label: 'Measurement and Data Scale Score', color: '#f59e0b' },
    { key: 'geometry', label: 'Geometry Scale Score', color: '#ef4444' },
  ];

  return (
    <div className="space-y-6">
      {/* Comprehensive Data Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="text-left py-2 px-3 font-bold text-base text-gray-900 dark:text-gray-100 sticky left-0 bg-gray-50 dark:bg-gray-700">
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
                    let color = '#ffffff';
                    
                    // Map metric keys to data properties
                    switch (metric.key) {
                      case 'duration':
                        value = assessment.duration || '-';
                        break;
                      case 'overallScore':
                        value = assessment.overallScore || '-';
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
                      case 'quantileMeasure':
                        value = assessment.quantileMeasure || '-';
                        break;
                      case 'quantileRange':
                        value = assessment.quantileRange || '-';
                        break;
                      case 'numberOperations':
                        value = assessment.numberOperationsScore || '-';
                        break;
                      case 'numberOperationsPlacement':
                        value = assessment.numberOperationsPlacement || '-';
                        break;
                      case 'numberOperationsRelative':
                        value = assessment.numberOperationsRelativePlacement || '-';
                        break;
                      case 'algebra':
                        value = assessment.algebraScore || '-';
                        break;
                      case 'algebraPlacement':
                        value = assessment.algebraPlacement || '-';
                        break;
                      case 'algebraRelative':
                        value = assessment.algebraRelativePlacement || '-';
                        break;
                      case 'measurement':
                        value = assessment.measurementDataScore || '-';
                        break;
                      case 'measurementPlacement':
                        value = assessment.measurementDataPlacement || '-';
                        break;
                      case 'measurementRelative':
                        value = assessment.measurementDataRelativePlacement || '-';
                        break;
                      case 'geometry':
                        value = assessment.geometryScore || '-';
                        break;
                      case 'geometryPlacement':
                        value = assessment.geometryPlacement || '-';
                        break;
                      case 'geometryRelative':
                        value = assessment.geometryRelativePlacement || '-';
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
                      default:
                        value = '-';
                    }
                    
                    if (metric.hasColor && value !== '-') {
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
                    case 'numberOperations':
                      value = assessment.numberOperationsScore || 0;
                      break;
                    case 'algebra':
                      value = assessment.algebraScore || 0;
                      break;
                    case 'measurement':
                      value = assessment.measurementDataScore || 0;
                      break;
                    case 'geometry':
                      value = assessment.geometryScore || 0;
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
                    case 'numberOperations':
                      value = assessment.numberOperationsScore || 0;
                      break;
                    case 'algebra':
                      value = assessment.algebraScore || 0;
                      break;
                    case 'measurement':
                      value = assessment.measurementDataScore || 0;
                      break;
                    case 'geometry':
                      value = assessment.geometryScore || 0;
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
                        case 'numberOperations':
                          value = assessment.numberOperationsScore || 0;
                          break;
                        case 'algebra':
                          value = assessment.algebraScore || 0;
                          break;
                        case 'measurement':
                          value = assessment.measurementDataScore || 0;
                          break;
                        case 'geometry':
                          value = assessment.geometryScore || 0;
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