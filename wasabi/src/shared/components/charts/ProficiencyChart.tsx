import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ProficiencyDistribution } from '../../../lib/analytics-utils';

interface ProficiencyChartProps {
  data: ProficiencyDistribution;
  title?: string;
  height?: number;
}

export default function ProficiencyChart({ data, title, height = 300 }: ProficiencyChartProps) {
  const chartData = [
    { name: 'Below', value: data.below, color: '#ef4444' },
    { name: 'Approaching', value: data.approaching, color: '#f59e0b' },
    { name: 'Meets', value: data.meets, color: '#84cc16' },
    { name: 'Exceeds', value: data.exceeds, color: '#22c55e' },
  ];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600">
          <p className="font-medium text-gray-900 dark:text-gray-100">{`${label}: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis 
            dataKey="name" 
            stroke="#6b7280"
            fontSize={12}
          />
          <YAxis 
            stroke="#6b7280"
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="value" 
            fill={(entry: any) => entry.color}
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}