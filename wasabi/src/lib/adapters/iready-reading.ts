import type { DataAdapter, ParsedData, ValidationResult } from './base';
import type { AssessmentRecord, MatchingReport } from '../../shared/types';
import { studentMatcher } from '../studentMatcher';

export class IReadyReadingAdapter implements DataAdapter {
  name = 'iReady Reading Assessment';
  type = 'iready-reading' as const;

  validateData(data: ParsedData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required columns
    const headers = data.headers.map(h => h.toLowerCase());
    
    const hasStudentId = headers.some(h => 
      h.includes('student') && h.includes('id') || h.includes('studentid') || h.includes('student_id')
    );
    const hasOverallScore = headers.some(h => 
      h.includes('overall') && h.includes('scale') && h.includes('score')
    );
    const hasDate = headers.some(h => 
      h.includes('completion') && h.includes('date') || h.includes('test') && h.includes('date')
    );

    // Check for reading-specific indicators
    const hasReadingIndicators = headers.some(h => 
      h.includes('phonics') || h.includes('vocabulary') || h.includes('comprehension') || 
      h.includes('lexile') || h.includes('phonological')
    );

    if (!hasStudentId) {
      errors.push('Missing required Student ID column');
    }
    if (!hasOverallScore) {
      errors.push('Missing required Overall Scale Score column');
    }
    if (!hasDate) {
      errors.push('Missing required test date column');
    }
    if (!hasReadingIndicators) {
      warnings.push('No reading-specific columns detected - verify this is iReady Reading data');
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
        // Create comprehensive iReady Reading record with all data
        const comprehensiveRecord = this.transformComprehensiveRecord(matchedRow, data.headers);
        if (comprehensiveRecord) {
          records.push(comprehensiveRecord);
        }
        
      } catch (error) {
        console.warn('Error transforming iReady Reading record:', error);
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

  private transformComprehensiveRecord(row: Record<string, any>, headers: string[]): AssessmentRecord | null {
    const wasabiId = row.wasabiId;
    const originalStudentId = this.findValue(row, headers, [
      'Student ID', 'student_id', 'studentid', 'student id', 'student_number', 'id'
    ]);
    const overallScore = this.findValue(row, headers, [
      'Overall Scale Score', 'scale_score', 'overall_scale_score', 'overall scale score'
    ]);
    const testDate = this.findValue(row, headers, [
      'Completion Date', 'test_date', 'testdate', 'date', 'completion_date', 'assessment_date'
    ]);

    if (!wasabiId || !overallScore || !testDate) {
      return null;
    }

    const matchInfo = row.matchInfo;

    // Parse score
    const score = parseFloat(String(overallScore));
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

    // Extract all comprehensive fields
    const duration = this.findValue(row, headers, ['Duration (min)', 'duration', 'test_duration']);
    const placement = this.findValue(row, headers, ['Overall Placement', 'placement', 'overall_placement']);
    const relativePlacement = this.findValue(row, headers, ['Overall Relative Placement', 'overall_relative_placement']);
    const percentile = this.findValue(row, headers, ['Percentile', 'percentile', 'national_percentile']);
    const grouping = this.findValue(row, headers, ['Grouping', 'grouping']);
    const lexileMeasure = this.findValue(row, headers, ['Lexile Measure', 'lexile_measure']);
    const lexileRange = this.findValue(row, headers, ['Lexile Range', 'lexile_range']);
    const gradeLevel = this.findValue(row, headers, ['Student Grade', 'grade_level', 'gradelevel', 'grade']);
    const readingDifficulty = this.findValue(row, headers, ['Reading Difficulty Indicator (Y/N)']);
    
    // Domain scores
    const phonologicalScore = this.findValue(row, headers, ['Phonological Awareness Scale Score']);
    const phonologicalPlacement = this.findValue(row, headers, ['Phonological Awareness Placement']);
    const phonologicalRelative = this.findValue(row, headers, ['Phonological Awareness Relative Placement']);
    
    const phonicsScore = this.findValue(row, headers, ['Phonics Scale Score']);
    const phonicsPlacement = this.findValue(row, headers, ['Phonics Placement']);
    const phonicsRelative = this.findValue(row, headers, ['Phonics Relative Placement']);
    
    const highFreqScore = this.findValue(row, headers, ['High-Frequency Words Scale Score']);
    const highFreqPlacement = this.findValue(row, headers, ['High-Frequency Words Placement']);
    const highFreqRelative = this.findValue(row, headers, ['High-Frequency Words Relative Placement']);
    
    const vocabularyScore = this.findValue(row, headers, ['Vocabulary Scale Score']);
    const vocabularyPlacement = this.findValue(row, headers, ['Vocabulary Placement']);
    const vocabularyRelative = this.findValue(row, headers, ['Vocabulary Relative Placement']);
    
    const comprehensionOverallScore = this.findValue(row, headers, ['Comprehension: Overall Scale Score']);
    const comprehensionOverallPlacement = this.findValue(row, headers, ['Comprehension: Overall Placement']);
    const comprehensionOverallRelative = this.findValue(row, headers, ['Comprehension: Overall Relative Placement']);
    
    const comprehensionLitScore = this.findValue(row, headers, ['Comprehension: Literature Scale Score']);
    const comprehensionLitPlacement = this.findValue(row, headers, ['Comprehension: Literature Placement']);
    const comprehensionLitRelative = this.findValue(row, headers, ['Comprehension: Literature Relative Placement']);
    
    const comprehensionInfoScore = this.findValue(row, headers, ['Comprehension: Informational Text Scale Score']);
    const comprehensionInfoPlacement = this.findValue(row, headers, ['Comprehension: Informational Text Placement']);
    const comprehensionInfoRelative = this.findValue(row, headers, ['Comprehension: Informational Text Relative Placement']);
    
    // Growth measures
    const diagnosticGain = this.findValue(row, headers, ['Diagnostic Gain']);
    const annualTypical = this.findValue(row, headers, ['Annual Typical Growth Measure']);
    const annualStretch = this.findValue(row, headers, ['Annual Stretch Growth Measure']);
    const percentProgressTypical = this.findValue(row, headers, ['Percent Progress to Annual Typical Growth (%)']);
    const percentProgressStretch = this.findValue(row, headers, ['Percent Progress to Annual Stretch Growth (%)']);
    const midGradeScore = this.findValue(row, headers, ['Mid On Grade Level Scale Score']);

    // Create comprehensive metadata object
    const comprehensiveData = {
      duration: duration ? parseFloat(String(duration)) : undefined,
      overallPlacement: placement ? String(placement) : undefined,
      overallRelativePlacement: relativePlacement ? String(relativePlacement) : undefined,
      grouping: grouping ? String(grouping) : undefined,
      lexileMeasure: lexileMeasure ? String(lexileMeasure) : undefined,
      lexileRange: lexileRange ? String(lexileRange) : undefined,
      readingDifficultyIndicator: readingDifficulty ? String(readingDifficulty) : undefined,
      
      // Domain data
      phonologicalAwarenessScore: phonologicalScore ? parseFloat(String(phonologicalScore)) : undefined,
      phonologicalAwarenessPlacement: phonologicalPlacement ? String(phonologicalPlacement) : undefined,
      phonologicalAwarenessRelativePlacement: phonologicalRelative ? String(phonologicalRelative) : undefined,
      
      phonicsScore: phonicsScore ? parseFloat(String(phonicsScore)) : undefined,
      phonicsPlacement: phonicsPlacement ? String(phonicsPlacement) : undefined,
      phonicsRelativePlacement: phonicsRelative ? String(phonicsRelative) : undefined,
      
      highFrequencyWordsScore: highFreqScore ? parseFloat(String(highFreqScore)) : undefined,
      highFrequencyWordsPlacement: highFreqPlacement ? String(highFreqPlacement) : undefined,
      highFrequencyWordsRelativePlacement: highFreqRelative ? String(highFreqRelative) : undefined,
      
      vocabularyScore: vocabularyScore ? parseFloat(String(vocabularyScore)) : undefined,
      vocabularyPlacement: vocabularyPlacement ? String(vocabularyPlacement) : undefined,
      vocabularyRelativePlacement: vocabularyRelative ? String(vocabularyRelative) : undefined,
      
      comprehensionOverallScore: comprehensionOverallScore ? parseFloat(String(comprehensionOverallScore)) : undefined,
      comprehensionOverallPlacement: comprehensionOverallPlacement ? String(comprehensionOverallPlacement) : undefined,
      comprehensionOverallRelativePlacement: comprehensionOverallRelative ? String(comprehensionOverallRelative) : undefined,
      
      comprehensionLiteratureScore: comprehensionLitScore ? parseFloat(String(comprehensionLitScore)) : undefined,
      comprehensionLiteraturePlacement: comprehensionLitPlacement ? String(comprehensionLitPlacement) : undefined,
      comprehensionLiteratureRelativePlacement: comprehensionLitRelative ? String(comprehensionLitRelative) : undefined,
      
      comprehensionInformationalScore: comprehensionInfoScore ? parseFloat(String(comprehensionInfoScore)) : undefined,
      comprehensionInformationalPlacement: comprehensionInfoPlacement ? String(comprehensionInfoPlacement) : undefined,
      comprehensionInformationalRelativePlacement: comprehensionInfoRelative ? String(comprehensionInfoRelative) : undefined,
      
      // Growth metrics
      diagnosticGain: diagnosticGain ? parseFloat(String(diagnosticGain)) : undefined,
      annualTypicalGrowth: annualTypical ? parseFloat(String(annualTypical)) : undefined,
      annualStretchGrowth: annualStretch ? parseFloat(String(annualStretch)) : undefined,
      percentProgressTypical: percentProgressTypical ? parseFloat(String(percentProgressTypical)) : undefined,
      percentProgressStretch: percentProgressStretch ? parseFloat(String(percentProgressStretch)) : undefined,
      midOnGradeScore: midGradeScore ? parseFloat(String(midGradeScore)) : undefined,
    };

    return {
      studentId: wasabiId,
      source: 'iReady Reading',
      matchedBy: matchInfo?.matchedBy,
      matchConfidence: matchInfo?.confidence,
      originalStudentId: originalStudentId ? String(originalStudentId) : undefined,
      testDate: parsedDate,
      subject: 'Reading - Comprehensive',
      score,
      percentile: percentile ? parseFloat(String(percentile)) : undefined,
      gradeLevel: gradeLevel ? String(gradeLevel) : undefined,
      proficiency: this.convertPlacementToProficiency(placement),
      metadata: comprehensiveData, // Store all comprehensive data in metadata
    };
  }

  private convertPlacementToProficiency(placement: any): 'below' | 'approaching' | 'meets' | 'exceeds' | undefined {
    if (!placement) return undefined;
    
    const placementStr = String(placement).toLowerCase();
    
    if (placementStr.includes('3 or more') || placementStr.includes('below')) {
      return 'below';
    } else if (placementStr.includes('2 grade') || placementStr.includes('emerging')) {
      return 'below';
    } else if (placementStr.includes('1 grade')) {
      return 'approaching';
    } else if (placementStr.includes('on grade') || placementStr.includes('grade level')) {
      return 'meets';
    } else if (placementStr.includes('above')) {
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