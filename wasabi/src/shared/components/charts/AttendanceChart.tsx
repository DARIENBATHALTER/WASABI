import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface AttendanceDataPoint {
  name: string;
  attendanceRate: number;
  studentCount?: number;
}

interface AttendanceChartProps {
  data: AttendanceDataPoint[];
  title?: string;
  height?: number;
  type?: 'line' | 'area';
  showStudentCount?: boolean;
}

export default function AttendanceChart({ 
  data, 
  title, 
  height = 300, 
  type = 'area',
  showStudentCount = false 
}: AttendanceChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600">
          <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
          <p className="text-wasabi-green">
            Attendance Rate: {data.attendanceRate.toFixed(1)}%
          </p>
          {showStudentCount && data.studentCount && (
            <p className="text-gray-600 dark:text-gray-400">
              Students: {data.studentCount}
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  const formatYAxis = (value: number) => `${value}%`;

  if (type === 'area') {
    return (
      <div className="w-full">
        {title && (
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
        )}
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="attendanceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#84cc16" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#84cc16" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
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
              tickFormatter={formatYAxis}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area 
              type="monotone" 
              dataKey="attendanceRate" 
              stroke="#84cc16" 
              strokeWidth={2}
              fill="url(#attendanceGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  }

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
            tickFormatter={formatYAxis}
            domain={[0, 100]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line 
            type="monotone" 
            dataKey="attendanceRate" 
            stroke="#84cc16" 
            strokeWidth={3}
            dot={{ fill: '#84cc16', strokeWidth: 2, r: 5 }}
            activeDot={{ r: 7, fill: '#22c55e' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}