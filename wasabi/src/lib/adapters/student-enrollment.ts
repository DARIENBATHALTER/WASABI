import type { DataAdapter, ParsedData, ValidationResult } from './base';
import type { Student } from '../../shared/types';
import { StudentMatcher } from '../studentMatcher';

export class StudentEnrollmentAdapter implements DataAdapter {
  name = 'Student Enrollment';
  type = 'student-enrollment' as const;

  validateData(data: ParsedData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required columns
    const headers = data.headers.map(h => h.toLowerCase());
    
    const hasStudentId = headers.some(h => 
      h.includes('student id') || h.includes('id') || h.includes('student number')
    );
    const hasFirstName = headers.some(h => 
      h.includes('first') || h.includes('fname') || h.includes('first name')
    );
    const hasLastName = headers.some(h => 
      h.includes('last') || h.includes('lname') || h.includes('last name')
    );

    if (!hasStudentId) {
      errors.push('Missing required Student ID column');
    }
    if (!hasFirstName) {
      errors.push('Missing required First Name column');
    }
    if (!hasLastName) {
      errors.push('Missing required Last Name column');
    }

    // Check for empty data
    if (data.rows.length === 0) {
      errors.push('No data rows found');
    }

    // Validate sample records
    let validRecords = 0;
    const sampleSize = Math.min(10, data.rows.length);
    
    for (let i = 0; i < sampleSize; i++) {
      const row = data.rows[i];
      const studentId = this.findValue(row, data.headers, ['Student ID', 'student_id', 'studentid', 'id', 'student number']);
      const firstName = this.findValue(row, data.headers, ['First', 'first_name', 'firstname', 'first', 'fname']);
      const lastName = this.findValue(row, data.headers, ['Last', 'last_name', 'lastname', 'last', 'lname']);
      
      if (studentId && (firstName || lastName)) {
        validRecords++;
      }
    }

    if (validRecords === 0) {
      errors.push('No valid student records found in sample data');
    } else if (validRecords < sampleSize * 0.8) {
      warnings.push(`Only ${validRecords}/${sampleSize} sample records appear valid`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async transformData(data: ParsedData): Promise<Student[]> {
    const students: Student[] = [];
    
    for (const row of data.rows) {
      try {
        const student = this.transformStudentRecord(row, data.headers);
        if (student) {
          students.push(student);
        }
      } catch (error) {
        console.warn('Error transforming student record:', error);
        // Continue processing other rows
      }
    }

    return students;
  }

  private transformStudentRecord(row: Record<string, any>, headers: string[]): Student | null {
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

    // Parse gender from values like "F - Female", "M - Male"
    let parsedGender: 'male' | 'female' | 'other' | 'undisclosed' | undefined;
    if (gender) {
      const genderStr = String(gender).toLowerCase();
      if (genderStr.includes('f') || genderStr.includes('female')) {
        parsedGender = 'female';
      } else if (genderStr.includes('m') || genderStr.includes('male')) {
        parsedGender = 'male';
      } else {
        parsedGender = 'other';
      }
    }

    return {
      id: StudentMatcher.generateWasabiId(), // Generate unique WASABI ID
      studentNumber: String(studentId), // Store district ID separately
      firstName: String(firstName || ''),
      lastName: String(lastName || ''),
      grade: String(grade || ''),
      className: homeRoomTeacher ? String(homeRoomTeacher) : undefined,
      gender: parsedGender,
      flags: [],
      // Additional fields for enhanced matching
      dateOfBirth: dob ? String(dob) : undefined,
      homeRoomTeacher: homeRoomTeacher ? String(homeRoomTeacher) : undefined,
      createdAt: new Date(),
      lastUpdated: new Date(),
    };
  }

  private findValue(row: Record<string, any>, headers: string[], possibleKeys: string[]): any {
    // First try exact header matches
    for (const key of possibleKeys) {
      if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
        return row[key];
      }
    }
    
    // Then try case-insensitive matches
    const lowerHeaders = headers.map(h => h.toLowerCase());
    for (const key of possibleKeys) {
      const lowerKey = key.toLowerCase();
      for (let i = 0; i < lowerHeaders.length; i++) {
        if (lowerHeaders[i].includes(lowerKey) || lowerKey.includes(lowerHeaders[i])) {
          const originalHeader = headers[i];
          if (row[originalHeader] !== undefined && row[originalHeader] !== null && row[originalHeader] !== '') {
            return row[originalHeader];
          }
        }
      }
    }
    
    return null;
  }

  async parseCSV(file: File): Promise<ParsedData> {
    const Papa = (await import('papaparse')).default;
    
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            const criticalErrors = results.errors.filter(error => error.type === 'Delimiter');
            if (criticalErrors.length > 0) {
              reject(new Error(`CSV parsing failed: ${criticalErrors[0].message}`));
              return;
            }
          }
          
          resolve({
            headers: results.meta.fields || [],
            rows: results.data as Record<string, any>[],
          });
        },
        error: (error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        }
      });
    });
  }
}