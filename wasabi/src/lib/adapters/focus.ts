import { BaseAdapter, type ColumnMapping } from './base';
import type { ParsedData, ValidationResult, Student, AttendanceRecord, GradeRecord } from '../../shared/types';

export class FocusAdapter extends BaseAdapter {
  name = 'FOCUS';
  description = 'FOCUS School Information System';

  validateData(data: ParsedData): ValidationResult {
    const mappings = this.getColumnMappings();
    const baseValidation = this.validateRequiredColumns(data, mappings);
    
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for essential columns that help us identify the data type
    const hasStudentColumns = data.headers.some(h => 
      h.toLowerCase().includes('student') || h.toLowerCase().includes('name')
    );
    
    if (!hasStudentColumns) {
      warnings.push('No obvious student identifier columns found');
    }

    // Sample a few rows to check data quality
    const sampleSize = Math.min(5, data.rows.length);
    for (let i = 0; i < sampleSize; i++) {
      const row = data.rows[i];
      
      // Check if row has any actual data
      const hasData = Object.values(row).some(value => 
        value !== null && value !== undefined && value !== ''
      );
      
      if (!hasData) {
        warnings.push(`Row ${i + 1} appears to be empty`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async transformData(data: ParsedData): Promise<any[]> {
    const results: any[] = [];
    
    // Try to detect what type of FOCUS data this is based on columns
    const headers = data.headers.map(h => h.toLowerCase());
    
    const hasAttendance = headers.some(h => 
      h.includes('absent') || h.includes('present') || h.includes('tardy') || h.includes('attendance')
    );
    
    const hasGrades = headers.some(h => 
      h.includes('gpa') || h.includes('course') || h.includes('mark') || h.includes('semester') || h.includes('term')
    );
    
    const hasStudentInfo = headers.some(h => 
      h.includes('student') || h.includes('name') || h.includes('id') || h.includes('first') || h.includes('last')
    );

    // Check if this looks like student enrollment data specifically
    const isStudentEnrollment = headers.includes('first') && headers.includes('last') && 
      (headers.includes('student id') || headers.includes('id')) && !hasGrades && !hasAttendance;

    for (const row of data.rows) {
      try {
        if (isStudentEnrollment || (hasStudentInfo && !hasAttendance && !hasGrades)) {
          // Student master data
          const student = this.transformStudentRecord(row, data.headers);
          if (student) {
            results.push({ ...student, type: 'student' });
          }
        } else if (hasAttendance) {
          // Attendance data
          const attendance = this.transformAttendanceRecord(row, data.headers);
          if (attendance) {
            results.push({ ...attendance, type: 'attendance' });
          }
        } else if (hasGrades) {
          // Grade data
          const grade = this.transformGradeRecord(row, data.headers);
          if (grade) {
            results.push({ ...grade, type: 'grade' });
          }
        } else {
          // Generic record - try to extract what we can
          const generic = this.transformGenericRecord(row, data.headers);
          if (generic) {
            results.push({ ...generic, type: 'generic' });
          }
        }
      } catch (error) {
        console.warn('Error transforming row:', error);
        // Continue processing other rows
      }
    }

    return results;
  }

  private transformStudentRecord(row: Record<string, any>, headers: string[]): Student | null {
    // WAA Student CSV field mappings based on actual data structure
    const studentId = this.findValue(row, headers, ['Student ID', 'student_id', 'studentid', 'id', 'student number']);
    const firstName = this.findValue(row, headers, ['First', 'first_name', 'firstname', 'first', 'fname']);
    const lastName = this.findValue(row, headers, ['Last', 'last_name', 'lastname', 'last', 'lname']);
    const grade = this.findValue(row, headers, ['Grade', 'grade', 'grade_level', 'gradelevel', 'current_grade']);
    const homeRoomTeacher = this.findValue(row, headers, ['Home Room Teacher', 'homeroom', 'teacher', 'classroom']);
    const dob = this.findValue(row, headers, ['DOB', 'date_of_birth', 'dateofbirth', 'birth_date']);
    const gender = this.findValue(row, headers, ['Gender', 'gender', 'sex']);

    if (!studentId || (!firstName && !lastName)) {
      return null;
    }

    return {
      id: String(studentId),
      studentNumber: String(studentId),
      firstName: String(firstName || ''),
      lastName: String(lastName || ''),
      grade: String(grade || ''),
      className: homeRoomTeacher ? String(homeRoomTeacher) : undefined,
      flags: [],
      type: 'student' as const,
    };
  }

  private transformAttendanceRecord(row: Record<string, any>, headers: string[]): AttendanceRecord | null {
    const studentId = this.findValue(row, headers, ['student_id', 'studentid', 'id']);
    const date = this.findValue(row, headers, ['date', 'attendance_date', 'school_date']);
    const status = this.findValue(row, headers, ['status', 'attendance_status', 'present', 'absent']);

    if (!studentId || !date) {
      return null;
    }

    let attendanceStatus: 'present' | 'absent' | 'tardy' | 'early_dismissal' = 'present';
    
    if (status) {
      const statusStr = String(status).toLowerCase();
      if (statusStr.includes('absent') || statusStr === 'a') {
        attendanceStatus = 'absent';
      } else if (statusStr.includes('tardy') || statusStr === 't') {
        attendanceStatus = 'tardy';
      } else if (statusStr.includes('early') || statusStr === 'e') {
        attendanceStatus = 'early_dismissal';
      }
    }

    return {
      studentId: String(studentId),
      date: new Date(date),
      status: attendanceStatus,
    };
  }

  private transformGradeRecord(row: Record<string, any>, headers: string[]): GradeRecord | null {
    const studentId = this.findValue(row, headers, ['student_id', 'studentid', 'id']);
    const term = this.findValue(row, headers, ['term', 'semester', 'quarter', 'marking_period']);
    const gpa = this.findValue(row, headers, ['gpa', 'grade_point_average', 'cumulative_gpa']);

    if (!studentId) {
      return null;
    }

    // Extract course grades
    const courses: any[] = [];
    headers.forEach((header, index) => {
      if (header.toLowerCase().includes('course') || header.toLowerCase().includes('subject')) {
        const courseName = row[header];
        const gradeHeader = headers.find(h => 
          h.toLowerCase().includes('grade') && h !== header
        );
        
        if (courseName && gradeHeader) {
          courses.push({
            courseName: String(courseName),
            grade: String(row[gradeHeader] || ''),
          });
        }
      }
    });

    return {
      studentId: String(studentId),
      term: String(term || 'Unknown'),
      gpa: gpa ? parseFloat(String(gpa)) : 0,
      courses,
    };
  }

  private transformGenericRecord(row: Record<string, any>, headers: string[]): any | null {
    const studentId = this.findValue(row, headers, ['student_id', 'studentid', 'id']);
    
    if (!studentId) {
      return null;
    }

    return {
      studentId: String(studentId),
      data: row,
      source: 'focus',
    };
  }

  private findValue(row: Record<string, any>, headers: string[], searchTerms: string[]): any {
    for (const term of searchTerms) {
      // Try exact match first
      if (row[term] !== undefined) {
        return row[term];
      }
      
      // Try case-insensitive match
      const header = headers.find(h => h.toLowerCase() === term.toLowerCase());
      if (header && row[header] !== undefined) {
        return row[header];
      }
      
      // Try partial match
      const partialHeader = headers.find(h => 
        h.toLowerCase().includes(term.toLowerCase()) || 
        term.toLowerCase().includes(h.toLowerCase())
      );
      if (partialHeader && row[partialHeader] !== undefined) {
        return row[partialHeader];
      }
    }
    
    return null;
  }

  getColumnMappings(): ColumnMapping[] {
    return [
      { csvColumn: 'Student ID', dbField: 'id', required: true },
      { csvColumn: 'First', dbField: 'firstName', required: true },
      { csvColumn: 'Last', dbField: 'lastName', required: true },
      { csvColumn: 'Grade', dbField: 'grade', required: false },
      { csvColumn: 'Home Room Teacher', dbField: 'className', required: false },
      { csvColumn: 'DOB', dbField: 'dateOfBirth', required: false },
    ];
  }
}