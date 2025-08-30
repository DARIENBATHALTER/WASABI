import type { DataAdapter, ParsedData, ValidationResult } from './base';
import type { GradeRecord, MatchingReport } from '../../shared/types';
import { studentMatcher } from '../studentMatcher';

export class GradesAdapter implements DataAdapter {
  name = 'Grade Data';
  type = 'grades' as const;

  validateData(data: ParsedData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required columns
    const headers = data.headers.map(h => h.toLowerCase());
    
    const hasStudentId = headers.some(h => 
      h.includes('student') && h.includes('id') || h.includes('studentid') || h.includes('student_id')
    );
    const hasCourse = headers.some(h => 
      h.includes('course') || h.includes('subject')
    );
    const hasGradeColumns = headers.some(h => 
      h.includes('quarter') || h.includes('progress') || h.includes('period') || h.includes('gradebook')
    );

    if (!hasStudentId) {
      errors.push('Missing required Student ID column');
    }
    if (!hasCourse && !hasGradeColumns) {
      errors.push('Missing required course or grade period columns');
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
      const studentId = this.findValue(row, data.headers, ['Student ID', 'student_id', 'studentid', 'id']);
      const course = this.findValue(row, data.headers, ['Course', 'Subject', 'course', 'subject']);
      
      if (studentId && (course || this.hasAnyGradeData(row, data.headers))) {
        validRecords++;
      }
    }

    if (validRecords === 0) {
      errors.push('No valid grade records found in sample data');
    } else if (validRecords < sampleSize * 0.8) {
      warnings.push(`Only ${validRecords}/${sampleSize} sample records appear valid`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async transformData(data: ParsedData): Promise<GradeRecord[]> {
    const result = await this.transformDataWithMatching(data);
    return result.data;
  }

  async transformDataWithMatching(data: ParsedData): Promise<{
    data: GradeRecord[];
    matchingReport: MatchingReport;
  }> {
    // First, match all rows to students using the StudentMatcher
    const { matchedRows, report } = await studentMatcher.matchDataset(data.rows);
    
    const records: GradeRecord[] = [];
    
    for (const matchedRow of matchedRows) {
      try {
        const record = this.transformGradeRecord(matchedRow, data.headers);
        if (record) {
          records.push(record);
        }
      } catch (error) {
        console.warn('Error transforming grade record:', error);
        // Continue processing other rows
      }
    }

    return {
      data: records,
      matchingReport: {
        ...report,
        datasetType: this.type,
        datasetName: this.name,
        uploadDate: new Date(),
      }
    };
  }

  private transformGradeRecord(row: Record<string, any>, headers: string[]): GradeRecord | null {
    // Use WASABI ID from matching if available, otherwise try to extract district ID
    const wasabiId = row.wasabiId;
    const originalStudentId = this.findValue(row, headers, ['Student ID', 'student_id', 'studentid', 'id']);
    const course = this.findValue(row, headers, ['Course', 'Subject', 'course', 'subject']);
    const student = this.findValue(row, headers, ['Student', 'student', 'student_name']);
    const gradeLevel = this.findValue(row, headers, ['Grade Level', 'grade_level', 'grade']);
    const teacher = this.findValue(row, headers, ['Teacher', 'teacher', 'instructor']);

    if (!wasabiId) {
      // If no WASABI ID match, skip this record
      return null;
    }

    const matchInfo = row.matchInfo;

    // Extract all grade periods from this row
    const grades: Array<{ period: string; grade: string }> = [];
    
    // Look for grade period columns
    for (const header of headers) {
      const lowerHeader = header.toLowerCase();
      
      // Skip administrative columns
      if (lowerHeader.includes('student') || lowerHeader.includes('id') || 
          lowerHeader.includes('course') || lowerHeader.includes('teacher') || 
          lowerHeader.includes('section') || lowerHeader.includes('period') && !lowerHeader.includes('progress')) {
        continue;
      }
      
      // Check if this looks like a grade period column
      if (lowerHeader.includes('quarter') || lowerHeader.includes('progress') || 
          lowerHeader.includes('gradebook') || lowerHeader.includes('semester')) {
        const gradeValue = row[header];
        if (gradeValue !== null && gradeValue !== undefined && gradeValue !== '' && 
            String(gradeValue).trim() !== '"=""' && String(gradeValue).trim() !== '="""') {
          const cleanGrade = String(gradeValue).replace(/^"|"$/g, '').trim();
          if (cleanGrade && cleanGrade !== '=' && !cleanGrade.startsWith('="')) {
            grades.push({
              period: header,
              grade: cleanGrade,
            });
          }
        }
      }
    }

    // Only create record if we have at least one grade
    if (grades.length === 0) {
      return null;
    }

    const record: GradeRecord = {
      studentId: wasabiId, // Use WASABI ID
      studentName: student ? String(student) : undefined,
      course: course ? String(course) : 'Unknown Course',
      gradeLevel: gradeLevel ? String(gradeLevel) : undefined,
      teacher: teacher ? String(teacher) : undefined,
      grades,
      // Include matching metadata
      matchedBy: matchInfo?.matchedBy,
      matchConfidence: matchInfo?.confidence,
      originalStudentId: originalStudentId ? String(originalStudentId) : undefined,
    };

    // Include all original CSV data for debugging/reference
    Object.keys(row).forEach(key => {
      if (!['wasabiId', 'matchInfo'].includes(key)) {
        record[key] = row[key];
      }
    });

    return record;
  }

  private hasAnyGradeData(row: Record<string, any>, headers: string[]): boolean {
    // Check if this row has any actual grade data
    for (const header of headers) {
      const lowerHeader = header.toLowerCase();
      if (lowerHeader.includes('quarter') || lowerHeader.includes('progress') || 
          lowerHeader.includes('gradebook') || lowerHeader.includes('semester')) {
        const value = row[header];
        if (value !== null && value !== undefined && value !== '' && 
            String(value).trim() !== '"=""' && String(value).trim() !== '="""') {
          const cleanValue = String(value).replace(/^"|"$/g, '').trim();
          if (cleanValue && cleanValue !== '=' && !cleanValue.startsWith('="')) {
            return true;
          }
        }
      }
    }
    return false;
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