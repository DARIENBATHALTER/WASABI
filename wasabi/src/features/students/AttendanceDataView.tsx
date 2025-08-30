import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { queryByStudentId } from '../../utils/studentIdQuery';

interface AttendanceDataViewProps {
  studentId: number;
}

interface AttendanceRecord {
  id?: number;
  studentId: string;
  date: Date;
  status: 'present' | 'absent' | 'tardy' | 'early_dismissal';
  attendanceCode?: string; // Original code like P, U, E, L, T, etc.
  [key: string]: any;
}

// Helper function to get color classes based on attendance rate
const getAttendanceColorClasses = (attendanceRate: string): string => {
  const rate = parseFloat(attendanceRate);
  if (rate >= 95) {
    return 'text-green-600 dark:text-green-400'; // Excellent (95%+)
  } else if (rate >= 90) {
    return 'text-blue-600 dark:text-blue-400'; // Good (90-94%)
  } else if (rate >= 85) {
    return 'text-yellow-600 dark:text-yellow-400'; // Fair (85-89%)
  } else if (rate >= 80) {
    return 'text-orange-600 dark:text-orange-400'; // Poor (80-84%)
  } else {
    return 'text-red-600 dark:text-red-400'; // Critical (Below 80%)
  }
};

export default function AttendanceDataView({ studentId }: AttendanceDataViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Dark mode detection
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check initial dark mode state
    const checkDarkMode = () => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode(isDark);
    };

    checkDarkMode();

    // Set up observer to watch for class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          checkDarkMode();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);
  
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['attendance', studentId],
    queryFn: async () => {
      const records = await queryByStudentId(db.attendance, studentId);
      console.log(`🔍 DEBUG: Looking for attendance records for studentId: ${studentId}`);
      console.log(`📊 DEBUG: Found ${records.length} attendance records`);
      
      if (records.length > 0) {
        console.log('🔍 DEBUG: Sample record:', records[0]);
      }
      return records as AttendanceRecord[];
    },
  });

  // Color mapping for attendance statuses (based on original codes for better granularity)
  const getStatusColor = (record: AttendanceRecord, isDark: boolean = false) => {
    const code = record.attendanceCode || record.status;
    if (!code) return isDark ? 'rgb(75 85 99 / 0.3)' : '#f0f0f0';
    
    const statusStr = typeof code === 'string' ? code.toUpperCase().trim() : String(code).toUpperCase().trim();
    
    switch (statusStr) {
      case 'P':
      case 'PRESENT':
        return isDark ? 'rgb(34 197 94 / 0.3)' : '#ccffcc'; // Light/dark green for Present
      case 'L':
      case 'T': 
      case 'TARDY':
        return isDark ? 'rgb(234 179 8 / 0.3)' : '#ffff99'; // Light/dark yellow for Late/Tardy
      case 'E':
      case 'EARLY_DISMISSAL':
        return isDark ? 'rgb(239 68 68 / 0.3)' : '#ffcccc'; // Light/dark red for Excused/Early dismissal
      case 'U':
      case 'A':
      case 'ABSENT':
        return isDark ? 'rgb(168 85 247 / 0.3)' : '#ffccff'; // Light/dark magenta for Unexcused absent
      case 'I':
        return isDark ? 'rgb(249 115 22 / 0.3)' : '#ffcc99'; // Light/dark orange for In-school suspension
      case 'O':
        return isDark ? 'rgb(220 38 38 / 0.3)' : '#ffdddd'; // Light/dark red for out-of-school
      default: 
        return isDark ? 'rgb(75 85 99 / 0.3)' : '#f0f0f0'; // Light/dark gray for unknown
    }
  };

  const getStatusLabel = (record: AttendanceRecord) => {
    const code = record.attendanceCode || record.status;
    if (!code) return 'Unknown';
    
    const statusStr = typeof code === 'string' ? code.toUpperCase().trim() : String(code).toUpperCase().trim();
    
    switch (statusStr) {
      case 'P':
      case 'PRESENT':
        return 'Present';
      case 'L': 
        return 'Late';
      case 'T':
      case 'TARDY': 
        return 'Tardy';
      case 'E':
      case 'EARLY_DISMISSAL': 
        return 'Excused/Early Dismissal';
      case 'U':
        return 'Unexcused Absent';
      case 'A':
      case 'ABSENT': 
        return 'Absent';
      case 'I': 
        return 'In-School Suspension';
      case 'O': 
        return 'Out-of-School';
      case '*': 
        return 'Enrollment Related';
      case '-': 
        return 'Not Enrolled';
      default: 
        return String(code);
    }
  };

  // Process attendance data for visualization
  const processedData = React.useMemo(() => {
    if (!attendanceData?.length) return null;

    // Sort records by date (newest first, then reverse for chart)
    const sortedRecords = [...attendanceData]
      .filter(record => record.date) // Only records with valid dates
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateA.getTime() - dateB.getTime(); // Chronological order (oldest first)
      });

    if (sortedRecords.length === 0) return null;

    // Get all records and last 45 records
    const allRecords = sortedRecords;
    const last45Records = sortedRecords.slice(-45); // Last 45 days

    // Helper function to calculate stats from records
    const calculateStats = (records: AttendanceRecord[]) => {
      const totalDays = records.length;
      
      const presentDays = records.filter(r => {
        const code = (r.attendanceCode || r.status || '').toString().toUpperCase().trim();
        return code === 'P' || r.status === 'present';
      }).length;
      
      const absentDays = records.filter(r => {
        const code = (r.attendanceCode || r.status || '').toString().toUpperCase().trim();
        return ['U', 'A'].includes(code) || r.status === 'absent';
      }).length;
      
      const excusedDays = records.filter(r => {
        const code = (r.attendanceCode || r.status || '').toString().toUpperCase().trim();
        return code === 'E' || r.status === 'early_dismissal';
      }).length;
      
      const tardies = records.filter(r => {
        const code = (r.attendanceCode || r.status || '').toString().toUpperCase().trim();
        return ['L', 'T'].includes(code) || r.status === 'tardy';
      }).length;
      
      const totalAbsences = absentDays + excusedDays;
      const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : '0';

      return {
        totalDays,
        presentDays,
        excusedAbsences: excusedDays,
        unexcusedAbsences: absentDays,
        tardies,
        totalAbsences,
        attendanceRate
      };
    };

    // Calculate stats for both periods
    const yearStats = calculateStats(allRecords);
    const last45Stats = calculateStats(last45Records);

    return {
      // Chart data (all records, but we'll show based on time range)
      chartRecords: allRecords,
      last45Records,
      
      // Stats
      yearStats,
      last45Stats,
      
      // Meta
      totalDays: allRecords.length,
      dateRange: {
        start: allRecords[0]?.date,
        end: allRecords[allRecords.length - 1]?.date
      }
    };
  }, [attendanceData]);

  // Create simple bar chart visualization
  useEffect(() => {
    if (!processedData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = 80;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { last45Records } = processedData;
    if (last45Records.length === 0) return;

    const barWidth = canvas.width / last45Records.length;
    const barHeight = canvas.height;

    // Draw bars for each day
    last45Records.forEach((record, index) => {
      const color = getStatusColor(record, isDarkMode);
      ctx.fillStyle = color;
      ctx.fillRect(index * barWidth, 0, barWidth - 1, barHeight);
    });

  }, [processedData, isDarkMode]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-wasabi-green"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading attendance data...</span>
      </div>
    );
  }

  if (!processedData) {
    return (
      <div className="text-center text-gray-500 dark:text-gray-400 py-8">
        <p>No attendance data available</p>
        <p className="text-sm">Data will appear here once attendance records are uploaded</p>
      </div>
    );
  }

  const { yearStats, last45Stats } = processedData;

  return (
    <div className="space-y-4">
      {/* Attendance Chart - Recent Days */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
          Daily Attendance - Last {processedData.last45Records.length} School Days
          {processedData.dateRange.start && processedData.dateRange.end && (
            <span className="text-xs text-gray-500 ml-2">
              ({new Date(processedData.dateRange.start).toLocaleDateString()} - {new Date(processedData.dateRange.end).toLocaleDateString()})
            </span>
          )}
        </h4>
        <div className="relative w-full border border-gray-200 dark:border-gray-600 rounded">
          <canvas 
            ref={canvasRef}
            className="w-full h-20 block"
            style={{ height: '80px' }}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="text-center text-xs space-x-2 flex flex-wrap justify-center gap-2 text-gray-700 dark:text-gray-300">
        <span className="inline-flex items-center">
          <div 
            className="w-3 h-3 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getStatusColor({ attendanceCode: 'P' } as AttendanceRecord, isDarkMode) }}
          ></div>
          Present
        </span>
        <span className="inline-flex items-center">
          <div 
            className="w-3 h-3 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getStatusColor({ attendanceCode: 'T' } as AttendanceRecord, isDarkMode) }}
          ></div>
          Late/Tardy
        </span>
        <span className="inline-flex items-center">
          <div 
            className="w-3 h-3 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getStatusColor({ attendanceCode: 'E' } as AttendanceRecord, isDarkMode) }}
          ></div>
          Excused/Early
        </span>
        <span className="inline-flex items-center">
          <div 
            className="w-3 h-3 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getStatusColor({ attendanceCode: 'U' } as AttendanceRecord, isDarkMode) }}
          ></div>
          Unexcused Absent
        </span>
        <span className="inline-flex items-center">
          <div 
            className="w-3 h-3 border border-gray-300 dark:border-gray-600 mr-1"
            style={{ backgroundColor: getStatusColor({ attendanceCode: 'I' } as AttendanceRecord, isDarkMode) }}
          ></div>
          In-School Susp.
        </span>
      </div>

      {/* Comparative Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Days */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Last {processedData.last45Records.length} School Days
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Attendance Rate:</span>
              <span className={`ml-2 font-bold ${getAttendanceColorClasses(last45Stats.attendanceRate)}`}>
                {last45Stats.attendanceRate}%
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">School Days:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {last45Stats.totalDays}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Days Present:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {last45Stats.presentDays}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Absences:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {last45Stats.totalAbsences}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Excused:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {last45Stats.excusedAbsences}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Unexcused:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {last45Stats.unexcusedAbsences}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Tardies:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {last45Stats.tardies}
              </span>
            </div>
          </div>
        </div>

        {/* Whole School Year */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
            Whole School Year ({processedData.totalDays} days)
          </h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">Attendance Rate:</span>
              <span className={`ml-2 font-bold ${getAttendanceColorClasses(yearStats.attendanceRate)}`}>
                {yearStats.attendanceRate}%
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">School Days:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {yearStats.totalDays}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Days Present:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {yearStats.presentDays}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Total Absences:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {yearStats.totalAbsences}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Excused:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {yearStats.excusedAbsences}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Unexcused:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {yearStats.unexcusedAbsences}
              </span>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">Tardies:</span>
              <span className="ml-2 font-medium text-gray-900 dark:text-gray-100">
                {yearStats.tardies}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}