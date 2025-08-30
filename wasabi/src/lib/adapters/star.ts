import { BaseAdapter, type ColumnMapping } from './base';
import type { ParsedData, ValidationResult, AssessmentRecord } from '../../shared/types';

export class StarAdapter extends BaseAdapter {
  name = 'STAR';
  description = 'Renaissance STAR Reading and Math Assessments';

  validateData(data: ParsedData): ValidationResult {
    const mappings = this.getColumnMappings();
    const baseValidation = this.validateRequiredColumns(data, mappings);
    
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for STAR-specific columns
    const hasStarColumns = data.headers.some(h => 
      h.toLowerCase().includes('star') || 
      h.toLowerCase().includes('scaled score') ||
      h.toLowerCase().includes('percentile rank') ||
      h.toLowerCase().includes('renaissance')
    );
    
    if (!hasStarColumns) {
      warnings.push('No obvious STAR-specific columns found. Please verify this is STAR data.');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async transformData(data: ParsedData): Promise<AssessmentRecord[]> {
    const results: AssessmentRecord[] = [];

    for (const row of data.rows) {
      try {
        const record = this.transformAssessmentRecord(row, data.headers);
        if (record) {
          results.push(record);
        }
      } catch (error) {
        console.warn('Error transforming STAR row:', error);
      }
    }

    return results;
  }

  private transformAssessmentRecord(row: Record<string, any>, headers: string[]): AssessmentRecord | null {
    // Common STAR field mappings
    const studentId = this.findValue(row, headers, [
      'student_id', 'studentid', 'student number', 'id', 'student_number'
    ]);
    
    const testDate = this.findValue(row, headers, [
      'test_date', 'testdate', 'date', 'completion_date', 'test_completion_date'
    ]);
    
    const subject = this.findValue(row, headers, [
      'subject', 'test_subject', 'domain', 'test_name'
    ]) || this.inferSubject(headers, row);
    
    const scaledScore = this.findValue(row, headers, [
      'scaled_score', 'scaledscore', 'scaled score', 'ss', 'score'
    ]);
    
    const percentileRank = this.findValue(row, headers, [
      'percentile_rank', 'percentilerank', 'percentile rank', 'percentile', 'pr'
    ]);
    
    const gradeEquivalent = this.findValue(row, headers, [
      'grade_equivalent', 'gradeequivalent', 'grade equivalent', 'ge'
    ]);
    
    const gradeLevel = this.findValue(row, headers, [
      'grade_level', 'gradelevel', 'grade', 'student_grade'
    ]);

    if (!studentId || !scaledScore) {
      return null;
    }

    // STAR doesn't typically use traditional proficiency levels
    // We can infer based on percentile rank if available
    let proficiency: 'below' | 'approaching' | 'meets' | 'exceeds' | undefined;
    if (percentileRank) {
      const percentile = parseFloat(String(percentileRank));
      if (percentile < 25) {
        proficiency = 'below';
      } else if (percentile < 50) {
        proficiency = 'approaching';
      } else if (percentile < 75) {
        proficiency = 'meets';
      } else {
        proficiency = 'exceeds';
      }
    }

    return {
      studentId: String(studentId),
      source: 'STAR',
      testDate: testDate ? new Date(testDate) : new Date(),
      subject: String(subject || 'Unknown'),
      score: parseFloat(String(scaledScore)),
      percentile: percentileRank ? parseFloat(String(percentileRank)) : undefined,
      gradeLevel: gradeEquivalent ? String(gradeEquivalent) : (gradeLevel ? String(gradeLevel) : undefined),
      proficiency,
    };
  }

  private inferSubject(headers: string[], row: Record<string, any>): string {
    // Try to infer subject from column names or data
    const readingKeywords = ['reading', 'literacy', 'english'];
    const mathKeywords = ['math', 'mathematics'];
    
    const hasReading = headers.some(h => 
      readingKeywords.some(keyword => h.toLowerCase().includes(keyword))
    );
    
    const hasMath = headers.some(h => 
      mathKeywords.some(keyword => h.toLowerCase().includes(keyword))
    );
    
    if (hasReading && !hasMath) return 'Reading';
    if (hasMath && !hasReading) return 'Math';
    
    // Check for STAR-specific test names
    const testName = this.findValue(row, headers, ['test_name', 'testname', 'assessment']);
    if (testName) {
      const name = String(testName).toLowerCase();
      if (name.includes('reading')) return 'Reading';
      if (name.includes('math')) return 'Math';
    }
    
    // Check row data for clues
    const rowValues = Object.values(row).join(' ').toLowerCase();
    if (readingKeywords.some(keyword => rowValues.includes(keyword))) {
      return 'Reading';
    }
    if (mathKeywords.some(keyword => rowValues.includes(keyword))) {
      return 'Math';
    }
    
    return 'Unknown';
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
        h.toLowerCase().includes(term.toLowerCase())
      );
      if (partialHeader && row[partialHeader] !== undefined) {
        return row[partialHeader];
      }
    }
    
    return null;
  }

  getColumnMappings(): ColumnMapping[] {
    return [
      { csvColumn: 'student_id', dbField: 'studentId', required: true },
      { csvColumn: 'scaled_score', dbField: 'score', required: true },
      { csvColumn: 'test_date', dbField: 'testDate', required: false },
      { csvColumn: 'subject', dbField: 'subject', required: false },
      { csvColumn: 'percentile_rank', dbField: 'percentile', required: false },
    ];
  }
}