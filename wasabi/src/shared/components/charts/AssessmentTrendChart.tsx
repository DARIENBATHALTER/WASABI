import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface AssessmentDataPoint {
  name: string; // Date or period
  averageScore: number;
  studentCount?: number;
  subject?: string;
}

interface AssessmentTrendChartProps {
  data: AssessmentDataPoint[];
  title?: string;
  height?: number;
  subjects?: string[];
  showBenchmark?: boolean;
  benchmarkScore?: number;
}

const SUBJECT_COLORS = {
  'Math': '#3b82f6',
  'Reading': '#f59e0b', 
  'Science': '#84cc16',
  'Writing': '#8b5cf6',
  'ELA': '#f59e0b',
  'Overall': '#6b7280'
};

export default function AssessmentTrendChart({ 
  data, 
  title, 
  height = 300,
  subjects = [],
  showBenchmark = false,
  benchmarkScore = 70
}: AssessmentTrendChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600">
          <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-gray-700 dark:text-gray-300">
                {entry.dataKey === 'averageScore' ? 'Average Score' : entry.dataKey}: {entry.value.toFixed(1)}
                {entry.payload.studentCount && (
                  <span className="text-sm text-gray-500 ml-1">
                    ({entry.payload.studentCount} students)
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Group data by subject if multiple subjects are provided
  const groupedData = subjects.length > 0 
    ? subjects.reduce((acc, subject) => {
        acc[subject] = data.filter(d => d.subject === subject);
        return acc;
      }, {} as Record<string, AssessmentDataPoint[]>)
    : { 'Overall': data };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="name" 
            stroke="#6b7280"
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          
          {showBenchmark && (
            <ReferenceLine 
              y={benchmarkScore} 
              stroke="#ef4444" 
              strokeDasharray="5 5" 
              label={{ value: "Benchmark", position: "topRight" }}
            />
          )}
          
          {Object.entries(groupedData).map(([subject, subjectData], index) => {
            const color = SUBJECT_COLORS[subject as keyof typeof SUBJECT_COLORS] || '#6b7280';
            return (
              <Line
                key={subject}
                type="monotone"
                dataKey="averageScore"
                data={subjectData}
                stroke={color}
                strokeWidth={2}
                dot={{ fill: color, strokeWidth: 2, r: 4 }}
                activeDot={{ r: 6, fill: color }}
                name={subject}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}