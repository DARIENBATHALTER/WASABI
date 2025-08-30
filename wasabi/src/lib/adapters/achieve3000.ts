import { BaseAdapter, type ColumnMapping } from './base';
import type { ParsedData, ValidationResult, AssessmentRecord } from '../../shared/types';

export class Achieve3000Adapter extends BaseAdapter {
  name = 'Achieve3000';
  description = 'Achieve3000 Literacy Assessment Data';

  validateData(data: ParsedData): ValidationResult {
    const mappings = this.getColumnMappings();
    const baseValidation = this.validateRequiredColumns(data, mappings);
    
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for Achieve3000-specific columns
    const hasAchieve3000Columns = data.headers.some(h => 
      h.toLowerCase().includes('achieve') || 
      h.toLowerCase().includes('lexile') ||
      h.toLowerCase().includes('literacy') ||
      h.toLowerCase().includes('reading level')
    );
    
    if (!hasAchieve3000Columns) {
      warnings.push('No obvious Achieve3000-specific columns found. Please verify this is Achieve3000 data.');
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
        console.warn('Error transforming Achieve3000 row:', error);
      }
    }

    return results;
  }

  private transformAssessmentRecord(row: Record<string, any>, headers: string[]): AssessmentRecord | null {
    // Common Achieve3000 field mappings
    const studentId = this.findValue(row, headers, [
      'student_id', 'studentid', 'student number', 'id', 'user_id'
    ]);
    
    const testDate = this.findValue(row, headers, [
      'test_date', 'testdate', 'date', 'assessment_date', 'completion_date'
    ]);
    
    const lexileScore = this.findValue(row, headers, [
      'lexile', 'lexile_score', 'lexilescore', 'reading_level', 'score'
    ]);
    
    const readingLevel = this.findValue(row, headers, [
      'reading_level', 'readinglevel', 'level', 'grade_level_equivalent'
    ]);
    
    const gradeLevel = this.findValue(row, headers, [
      'grade_level', 'gradelevel', 'grade', 'student_grade'
    ]);
    
    const growthMeasure = this.findValue(row, headers, [
      'growth', 'growth_measure', 'change', 'improvement'
    ]);

    if (!studentId || !lexileScore) {
      return null;
    }

    // Convert Lexile score to proficiency level (rough approximation)
    let proficiency: 'below' | 'approaching' | 'meets' | 'exceeds' | undefined;
    const lexile = parseFloat(String(lexileScore));
    
    if (!isNaN(lexile)) {
      // These are rough grade-level expectations - would need to be refined based on student's actual grade
      if (lexile < 500) {
        proficiency = 'below';
      } else if (lexile < 750) {
        proficiency = 'approaching';
      } else if (lexile < 1000) {
        proficiency = 'meets';
      } else {
        proficiency = 'exceeds';
      }
    }

    return {
      studentId: String(studentId),
      source: 'Achieve3000',
      testDate: testDate ? new Date(testDate) : new Date(),
      subject: 'Reading', // Achieve3000 is primarily reading/literacy focused
      score: lexile,
      gradeLevel: readingLevel ? String(readingLevel) : (gradeLevel ? String(gradeLevel) : undefined),
      proficiency,
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
      { csvColumn: 'lexile', dbField: 'score', required: true },
      { csvColumn: 'test_date', dbField: 'testDate', required: false },
      { csvColumn: 'reading_level', dbField: 'gradeLevel', required: false },
    ];
  }
}