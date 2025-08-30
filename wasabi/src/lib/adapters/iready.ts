import { BaseAdapter, type ColumnMapping } from './base';
import type { ParsedData, ValidationResult, AssessmentRecord } from '../../shared/types';

export class IReadyAdapter extends BaseAdapter {
  name = 'iReady';
  description = 'iReady Reading and Math Assessments';

  validateData(data: ParsedData): ValidationResult {
    const mappings = this.getColumnMappings();
    const baseValidation = this.validateRequiredColumns(data, mappings);
    
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for iReady-specific columns
    const hasIReadyColumns = data.headers.some(h => 
      h.toLowerCase().includes('iready') || 
      h.toLowerCase().includes('scale score') ||
      h.toLowerCase().includes('placement')
    );
    
    if (!hasIReadyColumns) {
      warnings.push('No obvious iReady-specific columns found. Please verify this is iReady data.');
    }

    // Check for subject data
    const hasSubject = data.headers.some(h => 
      h.toLowerCase().includes('subject') || 
      h.toLowerCase().includes('reading') || 
      h.toLowerCase().includes('math')
    );
    
    if (!hasSubject) {
      warnings.push('No subject information found. Will attempt to infer from other columns.');
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
        // iReady has multiple assessments per row (horizontal format)
        // Extract overall assessment and individual domain assessments
        const assessments = this.extractMultipleAssessments(row, data.headers);
        results.push(...assessments);
      } catch (error) {
        console.warn('Error transforming iReady row:', error);
      }
    }

    return results;
  }

  private extractMultipleAssessments(row: Record<string, any>, headers: string[]): AssessmentRecord[] {
    const results: AssessmentRecord[] = [];
    
    // Common student data
    const studentId = this.findValue(row, headers, [
      'Student ID', 'student_id', 'studentid', 'student id', 'student_number', 'id'
    ]);
    
    const testDate = this.findValue(row, headers, [
      'Completion Date', 'test_date', 'testdate', 'date', 'completion_date', 'assessment_date'
    ]);
    
    const gradeLevel = this.findValue(row, headers, [
      'Student Grade', 'grade_level', 'gradelevel', 'grade', 'student_grade'
    ]);

    if (!studentId) {
      return results;
    }

    const baseDate = testDate ? new Date(testDate) : new Date();
    const baseGrade = gradeLevel ? String(gradeLevel) : undefined;

    // Extract Overall Assessment
    const overallScore = this.findValue(row, headers, ['Overall Scale Score', 'scale_score', 'overall_scale_score']);
    const overallPlacement = this.findValue(row, headers, ['Overall Placement', 'placement', 'overall_placement']);
    const percentile = this.findValue(row, headers, ['Percentile', 'percentile', 'national_percentile']);
    const lexile = this.findValue(row, headers, ['Lexile Measure', 'lexile']);

    if (overallScore) {
      const subject = this.inferSubject(headers, row);
      results.push({
        studentId: String(studentId),
        source: 'iReady',
        testDate: baseDate,
        subject: `${subject} - Overall`,
        score: parseFloat(String(overallScore)),
        percentile: percentile ? parseFloat(String(percentile)) : undefined,
        gradeLevel: baseGrade,
        proficiency: this.convertPlacementToProficiency(overallPlacement),
      });
    }

    // Extract Domain-Specific Assessments
    const domains = [
      { name: 'Phonological Awareness', prefix: 'Phonological Awareness' },
      { name: 'Phonics', prefix: 'Phonics' },
      { name: 'High-Frequency Words', prefix: 'High-Frequency Words' },
      { name: 'Vocabulary', prefix: 'Vocabulary' },
      { name: 'Comprehension: Overall', prefix: 'Comprehension: Overall' },
      { name: 'Comprehension: Literature', prefix: 'Comprehension: Literature' },
      { name: 'Comprehension: Informational Text', prefix: 'Comprehension: Informational Text' },
      // Math domains (if this is math data)
      { name: 'Number and Operations', prefix: 'Number and Operations' },
      { name: 'Algebra and Algebraic Thinking', prefix: 'Algebra and Algebraic Thinking' },
      { name: 'Measurement and Data', prefix: 'Measurement and Data' },
      { name: 'Geometry', prefix: 'Geometry' },
    ];

    for (const domain of domains) {
      const domainScore = this.findValue(row, headers, [
        `${domain.prefix} Scale Score`,
        `${domain.name} Scale Score`,
        `${domain.name} Score`
      ]);
      
      const domainPlacement = this.findValue(row, headers, [
        `${domain.prefix} Placement`,
        `${domain.name} Placement`,
        `${domain.name} Level`
      ]);

      if (domainScore && domainScore !== 'Not Assessed' && domainScore !== '') {
        const subject = this.inferSubject(headers, row);
        results.push({
          studentId: String(studentId),
          source: 'iReady',
          testDate: baseDate,
          subject: `${subject} - ${domain.name}`,
          score: parseFloat(String(domainScore)),
          gradeLevel: baseGrade,
          proficiency: this.convertPlacementToProficiency(domainPlacement),
        });
      }
    }

    return results;
  }

  private convertPlacementToProficiency(placement: any): 'below' | 'approaching' | 'meets' | 'exceeds' | undefined {
    if (!placement) return undefined;
    
    const placementStr = String(placement).toLowerCase();
    
    // Handle grade level placements (e.g., "Grade 2", "Emerging K", "3 or More Grade Levels Below")
    if (placementStr.includes('3 or more') && placementStr.includes('below')) {
      return 'below';
    } else if (placementStr.includes('2 grade levels below') || placementStr.includes('emerging')) {
      return 'below';
    } else if (placementStr.includes('1 grade level below')) {
      return 'approaching';
    } else if (placementStr.includes('early on grade') || placementStr.includes('mid on grade') || placementStr.includes('on grade')) {
      return 'meets';
    } else if (placementStr.includes('above grade') || placementStr.includes('surpassed')) {
      return 'exceeds';
    }
    
    // Handle traditional placement levels
    if (placementStr.includes('early') || placementStr.includes('below') || placementStr === '1') {
      return 'below';
    } else if (placementStr.includes('developing') || placementStr.includes('approaching') || placementStr === '2') {
      return 'approaching';
    } else if (placementStr.includes('on') || placementStr.includes('meets') || placementStr === '3') {
      return 'meets';
    } else if (placementStr.includes('above') || placementStr.includes('exceeds') || placementStr === '4') {
      return 'exceeds';
    }
    
    return undefined;
  }

  private inferSubject(headers: string[], row: Record<string, any>): string {
    // Try to infer subject from column names or data
    const readingKeywords = ['reading', 'ela', 'language', 'literacy'];
    const mathKeywords = ['math', 'mathematics', 'number', 'algebra', 'geometry'];
    
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
      { csvColumn: 'Student ID', dbField: 'studentId', required: true },
      { csvColumn: 'Overall Scale Score', dbField: 'score', required: true },
      { csvColumn: 'Completion Date', dbField: 'testDate', required: false },
      { csvColumn: 'First Name', dbField: 'firstName', required: false },
      { csvColumn: 'Last Name', dbField: 'lastName', required: false },
      { csvColumn: 'Student Grade', dbField: 'gradeLevel', required: false },
    ];
  }
}