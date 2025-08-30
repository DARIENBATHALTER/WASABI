import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { Database, Users, Calendar, GraduationCap, FileText, BarChart3, RefreshCw } from 'lucide-react';

type TableName = 'students' | 'attendance' | 'grades' | 'assessments';

interface DatabaseStats {
  students: number;
  attendance: number;
  grades: number;
  assessments: number;
}

export default function DatabaseViewer() {
  const [selectedTable, setSelectedTable] = useState<TableName>('students');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Get database statistics
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ['database-stats'],
    queryFn: async (): Promise<DatabaseStats> => {
      const [students, attendance, grades, assessments] = await Promise.all([
        db.students.count(),
        db.attendance.count(),
        db.grades.count(),
        db.assessments.count(),
      ]);
      return { students, attendance, grades, assessments };
    },
  });

  // Get table data based on selection
  const { data: tableData, refetch: refetchTable, isLoading } = useQuery({
    queryKey: ['table-data', selectedTable],
    queryFn: async () => {
      switch (selectedTable) {
        case 'students':
          return await db.students.toArray();
        case 'attendance':
          return await db.attendance.toArray();
        case 'grades':
          return await db.grades.toArray();
        case 'assessments':
          return await db.assessments.toArray();
        default:
          return [];
      }
    },
  });

  // Get specific student data
  const { data: studentData } = useQuery({
    queryKey: ['student-data', selectedStudentId],
    queryFn: async () => {
      if (!selectedStudentId) return null;
      
      const [student, attendance, grades, assessments] = await Promise.all([
        db.students.where('id').equals(selectedStudentId).first(),
        db.attendance.where('studentId').equals(selectedStudentId).toArray(),
        db.grades.where('studentId').equals(selectedStudentId).toArray(),
        db.assessments.where('studentId').equals(selectedStudentId).toArray(),
      ]);
      
      return { student, attendance, grades, assessments };
    },
    enabled: !!selectedStudentId,
  });

  const refreshAll = () => {
    refetchStats();
    refetchTable();
  };

  const tables = [
    { key: 'students' as TableName, label: 'Students', icon: Users, color: 'bg-blue-500' },
    { key: 'attendance' as TableName, label: 'Attendance', icon: Calendar, color: 'bg-green-500' },
    { key: 'grades' as TableName, label: 'Grades', icon: GraduationCap, color: 'bg-purple-500' },
    { key: 'assessments' as TableName, label: 'Assessments', icon: BarChart3, color: 'bg-orange-500' },
  ];

  const renderTableData = (data: any[]) => {
    if (!data?.length) {
      return (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <Database size={48} className="mx-auto mb-4 opacity-50" />
          <p>No data in this table</p>
        </div>
      );
    }

    const keys = Object.keys(data[0]);
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700">
              {keys.map(key => (
                <th key={key} className="border border-gray-200 dark:border-gray-600 px-3 py-2 text-left font-medium">
                  {key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 100).map((row, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                {keys.map(key => (
                  <td key={key} className="border border-gray-200 dark:border-gray-600 px-3 py-2 max-w-xs truncate">
                    {typeof row[key] === 'object' ? JSON.stringify(row[key]) : String(row[key] || '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {data.length > 100 && (
          <p className="text-center text-gray-500 dark:text-gray-400 mt-4">
            Showing first 100 of {data.length} records
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Database Viewer
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Development tool for inspecting database contents and student data mappings
            </p>
          </div>
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-4 py-2 bg-wasabi-green text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* Database Statistics */}
      <div className="grid grid-cols-4 gap-4">
        {tables.map(table => {
          const Icon = table.icon;
          const count = stats?.[table.key] || 0;
          
          return (
            <div
              key={table.key}
              className={`p-4 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 cursor-pointer transition-all hover:shadow-md ${
                selectedTable === table.key ? 'ring-2 ring-wasabi-green' : ''
              }`}
              onClick={() => setSelectedTable(table.key)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    {table.label}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {count.toLocaleString()}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${table.color}`}>
                  <Icon size={24} className="text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Student Inspector */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Student Data Inspector
        </h2>
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            placeholder="Enter Student ID to inspect..."
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          />
        </div>
        
        {studentData && (
          <div className="space-y-4">
            {/* Student Info */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Student Info</h3>
              <pre className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm overflow-x-auto">
                {JSON.stringify(studentData.student, null, 2)}
              </pre>
            </div>
            
            {/* Attendance Records */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Attendance Records ({studentData.attendance.length})
              </h3>
              <pre className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm overflow-x-auto overflow-y-auto max-h-40">
                {JSON.stringify(studentData.attendance, null, 2)}
              </pre>
            </div>
            
            {/* Grade Records */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Grade Records ({studentData.grades.length})
              </h3>
              <pre className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm overflow-x-auto overflow-y-auto max-h-40">
                {JSON.stringify(studentData.grades, null, 2)}
              </pre>
            </div>
            
            {/* Assessment Records */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                Assessment Records ({studentData.assessments.length})
              </h3>
              <pre className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm overflow-x-auto overflow-y-auto max-h-40">
                {JSON.stringify(studentData.assessments, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Table Data */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {tables.find(t => t.key === selectedTable)?.label} Table
          </h2>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {tableData?.length || 0} records
          </span>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
          </div>
        ) : (
          renderTableData(tableData || [])
        )}
        </div>
      </div>
    </div>
  );
}