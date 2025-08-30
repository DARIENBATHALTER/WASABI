import { studentMatcher } from '../student-matcher';
import { db } from '../db';
import type { AttendanceRecord } from '../../shared/types';

export interface EnhancedAttendanceUploadResult {
  totalRows: number;
  validRows: number;
  matchedRows: number;
  unmatchedRows: number;
  processedRecords: number;
  errors: string[];
  dateRange: {
    start: string;
    end: string;
  };
  attendanceSummary: {
    totalDays: number;
    uniqueStudents: number;
    avgAttendanceRate: number;
  };
}

export class EnhancedAttendanceAdapter {
  async processFile(file: File): Promise<EnhancedAttendanceUploadResult> {
    console.log('📅 Starting enhanced attendance file processing...');
    
    const text = await file.text();
    const lines = text.split('\n');
    
    // Parse header to extract date columns
    const headerLine = lines[1]; // Skip title row
    const headers = this.parseCSVLine(headerLine);
    
    // Extract date columns (format: ="8/12", ="8/13", etc.)
    const dateColumns: string[] = [];
    const dateColumnIndices: number[] = [];
    
    headers.forEach((header, index) => {
      const dateMatch = header.match(/="(\d{1,2}\/\d{1,2})"/);
      if (dateMatch) {
        dateColumns.push(dateMatch[1]);
        dateColumnIndices.push(index);
      }
    });
    
    console.log(`📅 Found ${dateColumns.length} attendance date columns from ${dateColumns[0]} to ${dateColumns[dateColumns.length - 1]}`);
    
    const studentNameIndex = headers.findIndex(h => h.toLowerCase().includes('student') && !h.toLowerCase().includes('id'));
    const studentIdIndex = headers.findIndex(h => h.toLowerCase().includes('student id'));
    const gradeIndex = headers.findIndex(h => h.toLowerCase().includes('grade'));
    const absencesIndex = headers.findIndex(h => h.toLowerCase().includes('absences'));
    
    const attendanceRecords: AttendanceRecord[] = [];
    let validRows = 0;
    let matchedRows = 0;
    let unmatchedRows = 0;
    const errors: string[] = [];
    
    // Process each student row
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const columns = this.parseCSVLine(line);
        if (columns.length < Math.max(studentNameIndex, studentIdIndex, gradeIndex) + 1) continue;
        
        validRows++;
        
        const studentName = this.cleanValue(columns[studentNameIndex]);
        const studentId = this.cleanValue(columns[studentIdIndex]);
        const grade = this.cleanValue(columns[gradeIndex]);
        const totalAbsences = this.cleanValue(columns[absencesIndex]);
        
        // Match student using enhanced matching
        const matchResult = await studentMatcher.findStudent({
          name: studentName,
          studentId: studentId,
          grade: grade
        });
        
        if (!matchResult.wasabiId) {
          unmatchedRows++;
          errors.push(`No match found for: ${studentName} (ID: ${studentId})`);
          continue;
        }
        
        matchedRows++;
        
        // Create detailed attendance records for each date
        dateColumnIndices.forEach((colIndex, dateIndex) => {
          const attendanceCode = this.cleanValue(columns[colIndex]) || 'P';
          const dateStr = dateColumns[dateIndex];
          
          // Convert date to full date (assuming current school year)
          const fullDate = this.convertToFullDate(dateStr);
          
          const record: AttendanceRecord = {
            studentId: matchResult.wasabiId,
            date: fullDate,
            status: this.mapAttendanceStatus(attendanceCode),
            attendanceCode: attendanceCode,
            dayOfWeek: this.getDayOfWeek(fullDate),
            month: fullDate.toLocaleString('default', { month: 'long' }),
            isAbsent: this.isAbsentCode(attendanceCode),
            isTardy: this.isTardyCode(attendanceCode),
            isExcused: this.isExcusedCode(attendanceCode),
            // Enhanced metadata
            totalAbsencesToDate: parseInt(totalAbsences) || 0,
            attendanceRate: this.calculateAttendanceRate(columns, dateColumnIndices, dateIndex + 1),
            consecutiveAbsences: this.calculateConsecutiveAbsences(columns, dateColumnIndices, dateIndex),
            // Matching metadata
            matchedBy: matchResult.matchedBy,
            matchConfidence: matchResult.confidence,
            originalStudentId: studentId
          };
          
          attendanceRecords.push(record);
        });
        
      } catch (error) {
        errors.push(`Error processing row ${i}: ${error}`);
      }
    }
    
    // Bulk insert attendance records
    await db.attendance.bulkPut(attendanceRecords);
    
    // Calculate summary statistics
    const uniqueStudents = new Set(attendanceRecords.map(r => r.studentId)).size;
    const totalPresent = attendanceRecords.filter(r => r.status === 'Present').length;
    const avgAttendanceRate = attendanceRecords.length > 0 ? (totalPresent / attendanceRecords.length) * 100 : 0;
    
    const result: EnhancedAttendanceUploadResult = {
      totalRows: lines.length - 2, // Subtract header rows
      validRows,
      matchedRows,
      unmatchedRows,
      processedRecords: attendanceRecords.length,
      errors,
      dateRange: {
        start: dateColumns[0] || 'Unknown',
        end: dateColumns[dateColumns.length - 1] || 'Unknown'
      },
      attendanceSummary: {
        totalDays: dateColumns.length,
        uniqueStudents,
        avgAttendanceRate: Math.round(avgAttendanceRate * 100) / 100
      }
    };
    
    console.log(`📅 Enhanced attendance processing complete:`, result);
    return result;
  }
  
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }
  
  private cleanValue(value: string): string {
    if (!value) return '';
    return value.replace(/^[="']+|[="']+$/g, '').trim();
  }
  
  private convertToFullDate(dateStr: string): Date {
    // Convert "8/12" to full date, assuming current school year
    const [month, day] = dateStr.split('/').map(n => parseInt(n));
    const currentYear = new Date().getFullYear();
    const schoolYear = month >= 8 ? currentYear : currentYear + 1; // Aug-Jul school year
    
    return new Date(schoolYear, month - 1, day);
  }
  
  private getDayOfWeek(date: Date): string {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  private mapAttendanceStatus(code: string): string {
    const upperCode = code.toUpperCase();
    
    switch (upperCode) {
      case 'P': return 'Present';
      case 'A': case 'U': return 'Absent';
      case 'T': case 'L': return 'Tardy';
      case 'E': return 'Excused';
      case 'S': return 'Suspended';
      default: return upperCode === 'P' ? 'Present' : 'Other';
    }
  }
  
  private isAbsentCode(code: string): boolean {
    const upperCode = code.toUpperCase();
    return ['A', 'U', 'S'].includes(upperCode);
  }
  
  private isTardyCode(code: string): boolean {
    const upperCode = code.toUpperCase();
    return ['T', 'L'].includes(upperCode);
  }
  
  private isExcusedCode(code: string): boolean {
    const upperCode = code.toUpperCase();
    return ['E'].includes(upperCode);
  }
  
  private calculateAttendanceRate(columns: string[], dateIndices: number[], upToIndex: number): number {
    let present = 0;
    let total = 0;
    
    for (let i = 0; i < Math.min(upToIndex, dateIndices.length); i++) {
      const code = this.cleanValue(columns[dateIndices[i]]);
      if (code) {
        total++;
        if (code.toUpperCase() === 'P') present++;
      }
    }
    
    return total > 0 ? (present / total) * 100 : 100;
  }
  
  private calculateConsecutiveAbsences(columns: string[], dateIndices: number[], currentIndex: number): number {
    let consecutive = 0;
    
    // Count backwards from current date
    for (let i = currentIndex; i >= 0; i--) {
      const code = this.cleanValue(columns[dateIndices[i]]);
      if (this.isAbsentCode(code)) {
        consecutive++;
      } else {
        break;
      }
    }
    
    return consecutive;
  }
}