import type { DataAdapter, ParsedData, ValidationResult } from './base';
import type { AssessmentRecord, MatchingReport } from '../../shared/types';
import { studentMatcher } from '../studentMatcher';

export class StarEarlyLiteracyAdapter implements DataAdapter {
  name = 'STAR Early Literacy Assessment (Grades K-2)';
  type = 'star-early-literacy' as const;

  validateData(data: ParsedData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required columns
    const headers = data.headers.map(h => h.toLowerCase());
    
    const hasStudentId = headers.some(h => 
      h.includes('student') && h.includes('id') || h.includes('studentid') || h.includes('student_number')
    );
    const hasScaledScore = headers.some(h => 
      h.includes('scaled') && h.includes('score') || h.includes('scaledscore') || h.includes('ss') || h.includes('unified') && h.includes('score')
    );
    const hasDate = headers.some(h => 
      h.includes('test') && h.includes('date') || h.includes('completion') && h.includes('date') || h.includes('completed') && h.includes('date')
    );

    // Check for early literacy indicators
    const hasEarlyLiteracyIndicators = headers.some(h => 
      h.includes('early') && h.includes('literacy') || 
      h.includes('literacy') || 
      h.includes('reading') ||
      h.includes('star') && (h.includes('early') || h.includes('literacy'))
    );

    if (!hasStudentId) {
      errors.push('Missing required Student ID column');
    }
    if (!hasScaledScore) {
      errors.push('Missing required Scaled Score column');
    }
    if (!hasDate) {
      errors.push('Missing required test date column');
    }
    if (!hasEarlyLiteracyIndicators) {
      warnings.push('No early literacy indicators found - verify this is STAR Early Literacy data');
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
        const record = this.transformStarRecord(matchedRow, data.headers);
        if (record) {
          records.push(record);
        }
      } catch (error) {
        console.warn('Error transforming STAR Early Literacy record:', error);
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

  private transformStarRecord(row: Record<string, any>, headers: string[]): AssessmentRecord | null {
    // Use WASABI ID from matching if available, otherwise try to extract original ID
    const wasabiId = row.wasabiId;
    const originalStudentId = this.findValue(row, headers, [
      'Student ID', 'student_id', 'studentid', 'student number', 'id', 'student_number'
    ]);

    if (!wasabiId) {
      return null;
    }

    const matchInfo = row.matchInfo;
    const scaledScore = this.findValue(row, headers, [
      'Unified Score', 'scaled_score', 'scaledscore', 'scaled score', 'ss', 'score'
    ]);
    const testDate = this.findValue(row, headers, [
      'Completed Date', 'test_date', 'testdate', 'date', 'completion_date', 'test_completion_date'
    ]);
    
    // Filter for Early Literacy tests only
    const activityName = this.findValue(row, headers, [
      'Activity Name', 'activity_name', 'test_name', 'test_type'
    ]);
    
    if (activityName && !String(activityName).toLowerCase().includes('early literacy')) {
      return null; // Skip non-Early Literacy tests
    }

    if (!wasabiId || !scaledScore || !testDate) {
      return null;
    }

    // Parse score
    const score = parseFloat(String(scaledScore));
    if (isNaN(score)) {
      return null;
    }

    // Parse date
    let parsedDate: Date;
    try {
      parsedDate = new Date(testDate);
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      return null;
    }

    // Extract additional fields
    const percentileRank = this.findValue(row, headers, [
      'Percentile Rank', 'percentile_rank', 'percentilerank', 'percentile rank', 'percentile', 'pr'
    ]);
    const gradeEquivalent = this.findValue(row, headers, [
      'grade_equivalent', 'gradeequivalent', 'grade equivalent', 'ge'
    ]);
    const gradeLevel = this.findValue(row, headers, [
      'Grade', 'grade_level', 'gradelevel', 'grade', 'student_grade'
    ]);
    const testName = this.findValue(row, headers, [
      'Activity Name', 'Application Name', 'subject', 'test_subject', 'domain', 'test_name'
    ]);
    const studentName = this.findValue(row, headers, [
      'Student Name', 'student_name', 'name'
    ]);

    // Determine subject
    let subject = 'Early Literacy';
    if (testName) {
      const testStr = String(testName).toLowerCase();
      if (testStr.includes('reading') || testStr.includes('literacy')) {
        subject = 'Early Literacy';
      }
    }

    // Convert percentile to proficiency if available
    let proficiency: 'below' | 'approaching' | 'meets' | 'exceeds' | undefined;
    if (percentileRank) {
      const percentile = parseFloat(String(percentileRank));
      if (!isNaN(percentile)) {
        proficiency = this.convertPercentileToProficiency(percentile);
      }
    }

    return {
      studentId: wasabiId,
      matchedBy: matchInfo?.matchedBy,
      matchConfidence: matchInfo?.confidence,
      originalStudentId: originalStudentId ? String(originalStudentId) : undefined,
      source: 'STAR Early Literacy',
      testDate: parsedDate,
      subject,
      score,
      percentile: percentileRank ? parseFloat(String(percentileRank)) : undefined,
      gradeLevel: gradeLevel ? String(gradeLevel) : undefined,
      proficiency,
      fullName: studentName ? String(studentName) : undefined,
    };
  }

  private convertPercentileToProficiency(percentile: number): 'below' | 'approaching' | 'meets' | 'exceeds' {
    if (percentile < 25) {
      return 'below';
    } else if (percentile < 50) {
      return 'approaching';
    } else if (percentile < 75) {
      return 'meets';
    } else {
      return 'exceeds';
    }
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