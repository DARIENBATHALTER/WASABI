import { BaseAdapter, type ColumnMapping } from './base';
import type { ParsedData, ValidationResult, AssessmentRecord } from '../../shared/types';

export class FastAdapter extends BaseAdapter {
  name = 'FAST';
  description = 'Florida Assessment of Student Thinking';

  validateData(data: ParsedData): ValidationResult {
    const mappings = this.getColumnMappings();
    const baseValidation = this.validateRequiredColumns(data, mappings);
    
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for FAST-specific columns
    const hasFastColumns = data.headers.some(h => 
      h.toLowerCase().includes('fast') || 
      h.toLowerCase().includes('scale score') ||
      h.toLowerCase().includes('achievement level') ||
      h.toLowerCase().includes('florida')
    );
    
    if (!hasFastColumns) {
      warnings.push('No obvious FAST-specific columns found. Please verify this is FAST data.');
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
        console.warn('Error transforming FAST row:', error);
      }
    }

    return results;
  }

  private transformAssessmentRecord(row: Record<string, any>, headers: string[]): AssessmentRecord | null {
    // FAST field mappings based on actual data structure
    const studentId = this.findValue(row, headers, [
      'Student ID', 'student_id', 'studentid', 'student number', 'fleid', 'student_number'
    ]);
    
    const testDate = this.findValue(row, headers, [
      'Date Taken', 'Test Completion Date', 'test_date', 'testdate', 'date', 'administration_date'
    ]);
    
    const subject = this.findValue(row, headers, [
      'Test Subject', 'subject', 'test_subject', 'subject_area', 'domain'
    ]) || this.inferSubject(headers, row);
    
    const scaleScore = this.findValue(row, headers, [
      'Scale Score', 'scale_score', 'scalescore', 'scale score', 'score'
    ]);
    
    const achievementLevel = this.findValue(row, headers, [
      'Achievement Level', 'achievement_level', 'achievementlevel', 'achievement level', 'level', 'performance_level',
      // Include grade-specific FAST column patterns
      'Grade 3 FAST Mathematics Achievement Level', 'Grade 4 FAST Mathematics Achievement Level', 'Grade 5 FAST Mathematics Achievement Level',
      'Grade 3 FAST ELA Reading Achievement Level', 'Grade 4 FAST ELA Reading Achievement Level', 'Grade 5 FAST ELA Reading Achievement Level',
      'FAST Mathematics Achievement Level', 'FAST ELA Reading Achievement Level', 'FAST Reading Achievement Level'
    ]);
    
    const gradeLevel = this.findValue(row, headers, [
      'Test Grade', 'Enrolled Grade', 'grade_level', 'gradelevel', 'grade', 'test_grade'
    ]);

    const percentileRank = this.findValue(row, headers, [
      'Percentile Rank', 'percentile_rank', 'percentile', 'national_percentile'
    ]);

    const studentName = this.findValue(row, headers, [
      'Student Name', 'student_name', 'name'
    ]);

    if (!studentId || !scaleScore) {
      return null;
    }

    // Convert FAST achievement levels to proficiency
    let proficiency: 'below' | 'approaching' | 'meets' | 'exceeds' | undefined;
    if (achievementLevel) {
      const level = String(achievementLevel).toLowerCase();
      if (level.includes('level 1') || level.includes('1') || level.includes('inadequate') || level.includes('below')) {
        proficiency = 'below';
      } else if (level.includes('level 2') || level.includes('2') || level.includes('developing') || level.includes('approaching')) {
        proficiency = 'approaching';
      } else if (level.includes('level 3') || level.includes('3') || level.includes('satisfactory') || level.includes('meets')) {
        proficiency = 'meets';
      } else if (level.includes('level 4') || level.includes('level 5') || level.includes('4') || level.includes('5') || level.includes('proficient') || level.includes('exceeds')) {
        proficiency = 'exceeds';
      }
    }

    // Extract student name parts for matching
    let firstName = '';
    let lastName = '';
    if (studentName) {
      const nameParts = String(studentName).split(',').map(part => part.trim());
      if (nameParts.length >= 2) {
        lastName = nameParts[0];
        firstName = nameParts[1];
      } else {
        const spaceParts = String(studentName).split(' ');
        if (spaceParts.length >= 2) {
          firstName = spaceParts[0];
          lastName = spaceParts.slice(1).join(' ');
        }
      }
    }

    return {
      studentId: String(studentId),
      source: 'FAST',
      testDate: testDate ? new Date(testDate) : new Date(),
      subject: String(subject || 'Unknown'),
      score: parseFloat(String(scaleScore)),
      percentile: percentileRank ? parseFloat(String(percentileRank)) : undefined,
      gradeLevel: gradeLevel ? String(gradeLevel) : undefined,
      proficiency,
      // Add name fields for student matching
      firstName,
      lastName,
      fullName: studentName ? String(studentName) : undefined,
    };
  }

  private inferSubject(headers: string[], row: Record<string, any>): string {
    // Try to infer subject from column names or data
    const readingKeywords = ['reading', 'ela', 'english', 'language arts'];
    const mathKeywords = ['math', 'mathematics'];
    
    const hasReading = headers.some(h => 
      readingKeywords.some(keyword => h.toLowerCase().includes(keyword))
    );
    
    const hasMath = headers.some(h => 
      mathKeywords.some(keyword => h.toLowerCase().includes(keyword))
    );
    
    if (hasReading && !hasMath) return 'Reading';
    if (hasMath && !hasReading) return 'Math';
    
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
      { csvColumn: 'Student ID', dbField: 'studentId', required: true },
      { csvColumn: 'Scale Score', dbField: 'score', required: true },
      { csvColumn: 'Date Taken', dbField: 'testDate', required: false },
      { csvColumn: 'Test Subject', dbField: 'subject', required: false },
      { csvColumn: 'Achievement Level', dbField: 'proficiency', required: false },
      { csvColumn: 'Student Name', dbField: 'fullName', required: false },
    ];
  }
}