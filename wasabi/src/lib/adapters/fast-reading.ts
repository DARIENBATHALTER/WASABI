import type { DataAdapter, ParsedData, ValidationResult } from './base';
import type { AssessmentRecord, MatchingReport } from '../../shared/types';
import { studentMatcher } from '../studentMatcher';

export class FastReadingAdapter implements DataAdapter {
  name = 'FAST Reading/ELA Assessment (Grades 3-5)';
  type = 'fast-reading' as const;

  validateData(data: ParsedData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required columns
    const headers = data.headers.map(h => h.toLowerCase());
    
    const hasStudentId = headers.some(h => 
      h.includes('student') && h.includes('id') || h.includes('studentid') || h.includes('fleid')
    );
    const hasScaleScore = headers.some(h => 
      h.includes('scale') && h.includes('score')
    );
    // FAST reports don't always have explicit test dates - they're in the filename
    const hasDate = headers.some(h => 
      h.includes('date') && h.includes('taken') || h.includes('test') && h.includes('date')
    ) || true; // Allow files without date column since date is in filename

    // Check for reading/ELA indicators
    const hasReadingIndicators = headers.some(h => 
      h.includes('ela') || h.includes('reading') || h.includes('english')
    );
    const hasTestSubject = headers.some(h => 
      h.includes('test') && h.includes('subject') || h.includes('subject')
    );

    if (!hasStudentId) {
      errors.push('Missing required Student ID column');
    }
    if (!hasScaleScore) {
      errors.push('Missing required Scale Score column');
    }
    // Date is optional since it can be extracted from filename
    if (!hasReadingIndicators && !hasTestSubject) {
      warnings.push('No reading/ELA subject indicators found - verify this is FAST Reading data');
    }

    // Check for empty data
    if (data.rows.length === 0) {
      errors.push('No data rows found');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async transformData(data: ParsedData): Promise<AssessmentRecord[]> {
    const result = await this.transformDataWithMatching(data);
    return result.data;
  }

  async transformDataWithMatching(data: ParsedData): Promise<{
    data: AssessmentRecord[];
    matchingReport: MatchingReport;
  }> {
    // First, match all rows to students using the StudentMatcher
    const { matchedRows, report } = await studentMatcher.matchDataset(data.rows);
    
    const records: AssessmentRecord[] = [];
    
    for (const matchedRow of matchedRows) {
      try {
        const record = this.transformFastRecord(matchedRow, data.headers);
        if (record) {
          records.push(record);
        }
      } catch (error) {
        console.warn('Error transforming FAST Reading record:', error);
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

  private transformFastRecord(row: Record<string, any>, headers: string[]): AssessmentRecord | null {
    // Use WASABI ID from matching if available, otherwise try to extract original ID
    const wasabiId = row.wasabiId;
    const originalStudentId = this.findValue(row, headers, [
      'Student ID', 'student_id', 'studentid', 'student number', 'fleid', 'student_number'
    ]);

    if (!wasabiId) {
      return null;
    }

    const matchInfo = row.matchInfo;
    const scaleScore = this.findValue(row, headers, [
      'Scale Score', 'scale_score', 'scalescore', 'scale score', 'score'
    ]);
    const testDate = this.findValue(row, headers, [
      'Date Taken', 'Test Completion Date', 'test_date', 'testdate', 'date', 'administration_date'
    ]);

    if (!wasabiId || !scaleScore) {
      return null;
    }

    // Parse score
    const score = parseFloat(String(scaleScore));
    if (isNaN(score)) {
      return null;
    }

    // Parse date - if not found in data, use a default or extract from filename context
    let parsedDate: Date;
    if (testDate) {
      try {
        parsedDate = new Date(testDate);
        if (isNaN(parsedDate.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (error) {
        // Fall back to current date if date parsing fails
        parsedDate = new Date();
      }
    } else {
      // Use current date as fallback - in practice, date could be extracted from filename
      parsedDate = new Date();
    }

    // Extract additional fields
    const achievementLevel = this.findValue(row, headers, [
      'Achievement Level', 'achievement_level', 'achievementlevel', 'achievement level', 'level', 'performance_level',
      // Include grade-specific FAST column patterns
      'Grade 3 FAST ELA Reading Achievement Level', 'Grade 4 FAST ELA Reading Achievement Level', 'Grade 5 FAST ELA Reading Achievement Level',
      'FAST ELA Reading Achievement Level', 'FAST Reading Achievement Level'
    ]);
    const percentile = this.findValue(row, headers, [
      'Percentile Rank', 'percentile_rank', 'percentile', 'national_percentile'
    ]);
    const gradeLevel = this.findValue(row, headers, [
      'Test Grade', 'Enrolled Grade', 'grade_level', 'gradelevel', 'grade', 'test_grade'
    ]);
    const testSubject = this.findValue(row, headers, [
      'Test Subject', 'subject', 'test_subject', 'subject_area', 'domain'
    ]);

    // Extract student name if available
    const studentName = this.findValue(row, headers, [
      'Student Name', 'student_name', 'name'
    ]);
    let firstName: string | undefined;
    let lastName: string | undefined;
    
    if (studentName) {
      const nameParts = this.parseStudentName(String(studentName));
      firstName = nameParts.firstName;
      lastName = nameParts.lastName;
    }

    // Determine subject - should be Reading/ELA for this adapter
    let subject = 'Reading';
    if (testSubject) {
      const subjectStr = String(testSubject).toLowerCase();
      if (subjectStr.includes('ela') || subjectStr.includes('english')) {
        subject = 'ELA';
      } else if (subjectStr.includes('reading')) {
        subject = 'Reading';
      }
    }

    return {
      studentId: wasabiId,
      matchedBy: matchInfo?.matchedBy,
      matchConfidence: matchInfo?.confidence,
      originalStudentId: originalStudentId ? String(originalStudentId) : undefined,
      source: 'FAST',
      testDate: parsedDate,
      subject,
      score,
      percentile: percentile ? parseFloat(String(percentile)) : undefined,
      gradeLevel: gradeLevel ? String(gradeLevel) : undefined,
      proficiency: this.convertAchievementLevelToProficiency(achievementLevel),
      firstName,
      lastName,
      fullName: studentName ? String(studentName) : undefined,
    };
  }

  private parseStudentName(fullName: string): { firstName?: string; lastName?: string } {
    if (!fullName) return {};
    
    // Handle "Last, First" format
    if (fullName.includes(',')) {
      const parts = fullName.split(',').map(p => p.trim());
      return {
        lastName: parts[0],
        firstName: parts[1],
      };
    }
    
    // Handle "First Last" format
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    }
    
    // Single name - assume it's first name
    return {
      firstName: parts[0],
    };
  }

  private convertAchievementLevelToProficiency(level: any): 'below' | 'approaching' | 'meets' | 'exceeds' | undefined {
    if (!level) return undefined;
    
    const levelStr = String(level).toLowerCase();
    
    if (levelStr.includes('1') || levelStr.includes('inadequate') || levelStr.includes('below')) {
      return 'below';
    } else if (levelStr.includes('2') || levelStr.includes('developing') || levelStr.includes('approaching')) {
      return 'approaching';
    } else if (levelStr.includes('3') || levelStr.includes('satisfactory') || levelStr.includes('meets')) {
      return 'meets';
    } else if (levelStr.includes('4') || levelStr.includes('5') || levelStr.includes('proficient') || levelStr.includes('exceeds')) {
      return 'exceeds';
    }
    
    return undefined;
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
        header: false, // Don't use automatic header detection
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            const criticalErrors = results.errors.filter(error => error.type === 'Delimiter');
            if (criticalErrors.length > 0) {
              reject(new Error(`CSV parsing failed: ${criticalErrors[0].message}`));
              return;
            }
          }
          
          const rows = results.data as string[][];
          
          // Find the actual header row (should contain "Student ID" and "Scale Score")
          let headerRowIndex = -1;
          let headers: string[] = [];
          
          for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            if (row.some(cell => cell && cell.toLowerCase().includes('student id')) &&
                row.some(cell => cell && cell.toLowerCase().includes('scale score'))) {
              headerRowIndex = i;
              headers = row.map(h => String(h).trim().replace(/^"?="?/, '').replace(/"?$/, ''));
              break;
            }
          }
          
          if (headerRowIndex === -1) {
            reject(new Error('Could not find header row with Student ID and Scale Score'));
            return;
          }
          
          // Convert remaining rows to objects
          const dataRows: Record<string, any>[] = [];
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
              continue; // Skip empty rows
            }
            
            const dataRow: Record<string, any> = {};
            for (let j = 0; j < headers.length && j < row.length; j++) {
              if (headers[j]) {
                // Clean up Excel formula prefixes
                let cellValue = row[j];
                if (typeof cellValue === 'string') {
                  cellValue = cellValue.replace(/^"?="?/, '').replace(/"?$/, '');
                }
                dataRow[headers[j]] = cellValue;
              }
            }
            dataRows.push(dataRow);
          }
          
          resolve({
            headers,
            rows: dataRows,
          });
        },
        error: (error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        }
      });
    });
  }
}