import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';

interface AssessmentDataViewProps {
  studentId: string;
  source: string; // 'iReady', 'FAST', 'STAR Early Literacy'
  subject?: string; // 'Reading', 'Math', 'ELA', etc.
}

interface AssessmentRecord {
  id?: number;
  studentId: string;
  source: string;
  subject: string;
  testDate: Date;
  score: number;
  percentile?: number;
  proficiency?: 'below' | 'approaching' | 'meets' | 'exceeds';
  gradeLevel?: string;
  [key: string]: any;
}

export default function AssessmentDataView({ studentId, source, subject }: AssessmentDataViewProps) {
  const { data: assessmentData, isLoading } = useQuery({
    queryKey: ['assessments', studentId, source, subject],
    queryFn: async () => {
      let query = db.assessments.where('studentId').equals(studentId);
      
      if (source) {
        query = query.and(record => {
          if (source === 'iReady') {
            return record.source === 'iReady' || record.source === 'iReady Reading' || record.source === 'iReady Math';
          }
          return record.source === source;
        });
      }
      
      if (subject) {
        query = query.and(record => {
          if (subject === 'Reading') {
            return record.subject === 'Reading' || 
                   record.subject === 'ELA' || 
                   record.subject === 'Reading - Overall' ||
                   record.subject?.includes('Reading');
          }
          if (subject === 'Math') {
            return record.subject === 'Math' || 
                   record.subject === 'Math - Overall' ||
                   record.subject?.includes('Math');
          }
          return record.subject === subject;
        });
      }
      
      const records = await query.toArray();
      return records as AssessmentRecord[];
    },
  });

  const getProficiencyColor = (proficiency?: string) => {
    switch (proficiency) {
      case 'exceeds': return '#22c55e'; // Green
      case 'meets': return '#84cc16'; // Light green
      case 'approaching': return '#eab308'; // Yellow
      case 'below': return '#ef4444'; // Red
      default: return '#6b7280'; // Gray
    }
  };

  const getProficiencyLabel = (proficiency?: string) => {
    switch (proficiency) {
      case 'exceeds': return 'Exceeds Standards';
      case 'meets': return 'Meets Standards';
      case 'approaching': return 'Approaching Standards';
      case 'below': return 'Below Standards';
      default: return 'Not Available';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-wasabi-green"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading assessment data...</span>
      </div>
    );
  }

  if (!assessmentData?.length) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        <p>No {source} {subject} data available</p>
        <p className="text-sm">Data will appear here once assessments are uploaded</p>
      </div>
    );
  }

  // Sort by test date (most recent first)
  const sortedData = [...assessmentData].sort((a, b) => 
    new Date(b.testDate).getTime() - new Date(a.testDate).getTime()
  );

  // Get the most recent assessment for overview
  const mostRecent = sortedData[0];

  return (
    <div className="space-y-4">
      {/* Overview Card */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Most Recent Assessment
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Test Date:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
              {new Date(mostRecent.testDate).toLocaleDateString()}
            </span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Score:</span>
            <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
              {mostRecent.score}
            </span>
          </div>
          {mostRecent.percentile && (
            <div>
              <span className="text-gray-600 dark:text-gray-400">Percentile:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {mostRecent.percentile}th
              </span>
            </div>
          )}
          {mostRecent.proficiency && (
            <div>
              <span className="text-gray-600 dark:text-gray-400">Performance:</span>
              <span 
                className="ml-2 font-medium px-2 py-1 rounded text-white text-xs"
                style={{ backgroundColor: getProficiencyColor(mostRecent.proficiency) }}
              >
                {getProficiencyLabel(mostRecent.proficiency)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Score Trend Chart */}
      {sortedData.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-4">
            Score Trend Over Time
          </h4>
          <div className="relative h-32">
            <svg className="w-full h-full" viewBox="0 0 400 120">
              {/* Generate simple line chart */}
              {(() => {
                const points = sortedData.reverse().map((record, index) => {
                  const x = (index / (sortedData.length - 1)) * 360 + 20;
                  const maxScore = Math.max(...sortedData.map(r => r.score));
                  const minScore = Math.min(...sortedData.map(r => r.score));
                  const range = maxScore - minScore || 1;
                  const y = 100 - ((record.score - minScore) / range) * 80;
                  return { x, y, score: record.score, date: record.testDate };
                });

                return (
                  <>
                    {/* Draw line */}
                    <polyline
                      points={points.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none"
                      stroke="#008800"
                      strokeWidth="2"
                    />
                    {/* Draw points */}
                    {points.map((point, index) => (
                      <g key={index}>
                        <circle
                          cx={point.x}
                          cy={point.y}
                          r="4"
                          fill="#008800"
                        />
                        <text
                          x={point.x}
                          y={point.y - 8}
                          textAnchor="middle"
                          className="text-xs fill-gray-600 dark:fill-gray-400"
                        >
                          {point.score}
                        </text>
                      </g>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        </div>
      )}

      {/* Assessment History Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Assessment History
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                  Test Date
                </th>
                <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                  Score
                </th>
                {assessmentData.some(r => r.percentile) && (
                  <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                    Percentile
                  </th>
                )}
                {assessmentData.some(r => r.proficiency) && (
                  <th className="text-center py-3 px-4 font-medium text-gray-900 dark:text-gray-100">
                    Performance Level
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sortedData.map((record, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                    {new Date(record.testDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-center text-gray-900 dark:text-gray-100 font-medium">
                    {record.score}
                  </td>
                  {assessmentData.some(r => r.percentile) && (
                    <td className="py-3 px-4 text-center text-gray-600 dark:text-gray-400">
                      {record.percentile ? `${record.percentile}th` : '-'}
                    </td>
                  )}
                  {assessmentData.some(r => r.proficiency) && (
                    <td className="py-3 px-4 text-center">
                      {record.proficiency ? (
                        <span 
                          className="px-2 py-1 rounded text-white text-xs font-medium"
                          style={{ backgroundColor: getProficiencyColor(record.proficiency) }}
                        >
                          {getProficiencyLabel(record.proficiency)}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}