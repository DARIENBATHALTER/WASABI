import { studentMatcher } from '../student-matcher';
import { db } from '../db';
import type { AssessmentRecord } from '../../shared/types';

export interface EnhancedIReadyUploadResult {
  totalRows: number;
  validRows: number;
  matchedRows: number;
  unmatchedRows: number;
  processedRecords: number;
  errors: string[];
  subject: 'Reading' | 'Math';
  assessmentSummary: {
    avgOverallScore: number;
    totalStudents: number;
    gradeDistribution: Record<string, number>;
    placementDistribution: Record<string, number>;
    riskStudents: number;
  };
}

export class EnhancedIReadyAdapter {
  async processFile(file: File, subject: 'Reading' | 'Math'): Promise<EnhancedIReadyUploadResult> {
    console.log(`📚 Starting enhanced iReady ${subject} file processing...`);
    
    const text = await file.text();
    const lines = text.split('\n');
    
    if (lines.length < 2) {
      throw new Error('File appears to be empty or invalid');
    }
    
    // Parse header
    const headers = this.parseCSVLine(lines[0]);
    const columnMap = this.mapColumns(headers, subject);
    
    console.log(`📚 Column mapping for ${subject}:`, columnMap);
    
    const assessmentRecords: AssessmentRecord[] = [];
    let validRows = 0;
    let matchedRows = 0;
    let unmatchedRows = 0;
    const errors: string[] = [];
    
    // Process each student row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const columns = this.parseCSVLine(line);
        if (columns.length < Math.max(...Object.values(columnMap).filter(v => typeof v === 'number')) + 1) continue;
        
        validRows++;
        
        const firstName = this.cleanValue(columns[columnMap.firstName]);
        const lastName = this.cleanValue(columns[columnMap.lastName]);
        const studentId = this.cleanValue(columns[columnMap.studentId]);
        const grade = this.cleanValue(columns[columnMap.grade]);
        const fullName = `${lastName}, ${firstName}`;
        
        // Match student
        const matchResult = await studentMatcher.findStudent({
          name: fullName,
          studentId: studentId,
          grade: grade
        });
        
        if (!matchResult.wasabiId) {
          unmatchedRows++;
          errors.push(`No match found for: ${fullName} (ID: ${studentId})`);
          continue;
        }
        
        matchedRows++;
        
        // Extract test dates
        const startDate = this.parseDate(this.cleanValue(columns[columnMap.startDate]));
        const completionDate = this.parseDate(this.cleanValue(columns[columnMap.completionDate]));
        
        if (subject === 'Reading') {
          const record = await this.processReadingRecord(columns, columnMap, matchResult.wasabiId, startDate, completionDate, studentId, matchResult);
          assessmentRecords.push(record);
        } else {
          const record = await this.processMathRecord(columns, columnMap, matchResult.wasabiId, startDate, completionDate, studentId, matchResult);
          assessmentRecords.push(record);
        }
        
      } catch (error) {
        errors.push(`Error processing row ${i}: ${error}`);
      }
    }
    
    // Bulk insert records
    await db.assessments.bulkPut(assessmentRecords);
    
    // Generate summary statistics
    const summary = this.generateSummaryStatistics(assessmentRecords);
    
    const result: EnhancedIReadyUploadResult = {
      totalRows: lines.length - 1,
      validRows,
      matchedRows,
      unmatchedRows,
      processedRecords: assessmentRecords.length,
      errors,
      subject,
      assessmentSummary: summary
    };
    
    console.log(`📚 Enhanced iReady ${subject} processing complete:`, result);
    return result;
  }
  
  private async processReadingRecord(
    columns: string[], 
    columnMap: any, 
    wasabiId: string, 
    startDate: Date | undefined, 
    completionDate: Date | undefined,
    originalStudentId: string,
    matchResult: any
  ): Promise<AssessmentRecord> {
    return {
      studentId: wasabiId,
      source: 'iReady Reading',
      testDate: completionDate || startDate || new Date(),
      subject: 'Reading',
      
      // Overall scores
      score: this.parseNumber(this.cleanValue(columns[columnMap.overallScore])) || 0,
      level: this.parseNumber(this.cleanValue(columns[columnMap.overallScore])) || 0,
      percentile: this.parseNumber(this.cleanValue(columns[columnMap.percentile])) || 0,
      
      // Reading-specific metrics
      placement: this.cleanValue(columns[columnMap.placement]),
      relativePlacement: this.cleanValue(columns[columnMap.relativePlacement]),
      lexileLevel: this.cleanValue(columns[columnMap.lexile]),
      lexileRange: this.cleanValue(columns[columnMap.lexileRange]),
      
      // Domain scores
      phonologicalAwareness: this.parseNumber(this.cleanValue(columns[columnMap.phonologicalAwareness])) || 0,
      phonics: this.parseNumber(this.cleanValue(columns[columnMap.phonics])) || 0,
      highFrequencyWords: this.parseNumber(this.cleanValue(columns[columnMap.highFrequencyWords])) || 0,
      vocabulary: this.parseNumber(this.cleanValue(columns[columnMap.vocabulary])) || 0,
      comprehensionLiterature: this.parseNumber(this.cleanValue(columns[columnMap.comprehensionLiterature])) || 0,
      comprehensionInformational: this.parseNumber(this.cleanValue(columns[columnMap.comprehensionInformational])) || 0,
      overallReadingScore: this.parseNumber(this.cleanValue(columns[columnMap.comprehensionOverall])) || 0,
      
      // Domain placements
      phonologicalAwarenessPlacement: this.cleanValue(columns[columnMap.phonologicalAwarenessPlacement]),
      phonicsPlacement: this.cleanValue(columns[columnMap.phonicsPlacement]),
      highFrequencyWordsPlacement: this.cleanValue(columns[columnMap.highFrequencyWordsPlacement]),
      vocabularyPlacement: this.cleanValue(columns[columnMap.vocabularyPlacement]),
      comprehensionLiteraturePlacement: this.cleanValue(columns[columnMap.comprehensionLiteraturePlacement]),
      comprehensionInformationalPlacement: this.cleanValue(columns[columnMap.comprehensionInformationalPlacement]),
      comprehensionOverallPlacement: this.cleanValue(columns[columnMap.comprehensionOverallPlacement]),
      
      // Growth metrics
      diagnosticGain: this.parseNumber(this.cleanValue(columns[columnMap.diagnosticGain])) || 0,
      annualTypicalGrowth: this.parseNumber(this.cleanValue(columns[columnMap.annualTypicalGrowth])) || 0,
      annualStretchGrowth: this.parseNumber(this.cleanValue(columns[columnMap.annualStretchGrowth])) || 0,
      percentProgressTypical: this.parseNumber(this.cleanValue(columns[columnMap.percentProgressTypical])) || 0,
      percentProgressStretch: this.parseNumber(this.cleanValue(columns[columnMap.percentProgressStretch])) || 0,
      
      // Test conditions
      duration: this.parseNumber(this.cleanValue(columns[columnMap.duration])) || 0,
      readAloud: this.cleanValue(columns[columnMap.readAloud]) === 'On',
      rushFlag: this.cleanValue(columns[columnMap.rushFlag]) === 'Y',
      baseline: this.cleanValue(columns[columnMap.baseline]) === 'Y',
      mostRecentYTD: this.cleanValue(columns[columnMap.mostRecentYTD]) === 'Y',
      
      // Risk indicators
      readingDifficultyIndicator: this.cleanValue(columns[columnMap.readingDifficulty]) === 'Y',
      riskLevel: this.calculateReadingRiskLevel(columns, columnMap),
      
      // Metadata
      gradeLevel: this.cleanValue(columns[columnMap.grade]),
      academicYear: this.cleanValue(columns[columnMap.academicYear]),
      normingWindow: this.cleanValue(columns[columnMap.normingWindow]),
      
      // Matching metadata
      matchedBy: matchResult.matchedBy,
      matchConfidence: matchResult.confidence,
      originalStudentId
    };
  }
  
  private async processMathRecord(
    columns: string[], 
    columnMap: any, 
    wasabiId: string, 
    startDate: Date | undefined, 
    completionDate: Date | undefined,
    originalStudentId: string,
    matchResult: any
  ): Promise<AssessmentRecord> {
    return {
      studentId: wasabiId,
      source: 'iReady Math',
      testDate: completionDate || startDate || new Date(),
      subject: 'Math',
      
      // Overall scores
      score: this.parseNumber(this.cleanValue(columns[columnMap.overallScore])) || 0,
      level: this.parseNumber(this.cleanValue(columns[columnMap.overallScore])) || 0,
      percentile: this.parseNumber(this.cleanValue(columns[columnMap.percentile])) || 0,
      
      // Math-specific metrics
      placement: this.cleanValue(columns[columnMap.placement]),
      relativePlacement: this.cleanValue(columns[columnMap.relativePlacement]),
      quantileMeasure: this.cleanValue(columns[columnMap.quantile]),
      quantileRange: this.cleanValue(columns[columnMap.quantileRange]),
      
      // Domain scores
      numberAndOperations: this.parseNumber(this.cleanValue(columns[columnMap.numberAndOperations])) || 0,
      algebraAndAlgebraicThinking: this.parseNumber(this.cleanValue(columns[columnMap.algebraAndAlgebraicThinking])) || 0,
      measurementAndData: this.parseNumber(this.cleanValue(columns[columnMap.measurementAndData])) || 0,
      geometry: this.parseNumber(this.cleanValue(columns[columnMap.geometry])) || 0,
      overallMathScore: this.parseNumber(this.cleanValue(columns[columnMap.overallScore])) || 0,
      
      // Domain placements
      numberAndOperationsPlacement: this.cleanValue(columns[columnMap.numberAndOperationsPlacement]),
      algebraAndAlgebraicThinkingPlacement: this.cleanValue(columns[columnMap.algebraAndAlgebraicThinkingPlacement]),
      measurementAndDataPlacement: this.cleanValue(columns[columnMap.measurementAndDataPlacement]),
      geometryPlacement: this.cleanValue(columns[columnMap.geometryPlacement]),
      
      // Growth metrics
      diagnosticGain: this.parseNumber(this.cleanValue(columns[columnMap.diagnosticGain])) || 0,
      annualTypicalGrowth: this.parseNumber(this.cleanValue(columns[columnMap.annualTypicalGrowth])) || 0,
      annualStretchGrowth: this.parseNumber(this.cleanValue(columns[columnMap.annualStretchGrowth])) || 0,
      percentProgressTypical: this.parseNumber(this.cleanValue(columns[columnMap.percentProgressTypical])) || 0,
      percentProgressStretch: this.parseNumber(this.cleanValue(columns[columnMap.percentProgressStretch])) || 0,
      
      // Test conditions
      duration: this.parseNumber(this.cleanValue(columns[columnMap.duration])) || 0,
      readAloud: this.cleanValue(columns[columnMap.readAloud]) === 'On',
      rushFlag: this.cleanValue(columns[columnMap.rushFlag]) === 'Y',
      baseline: this.cleanValue(columns[columnMap.baseline]) === 'Y',
      mostRecentYTD: this.cleanValue(columns[columnMap.mostRecentYTD]) === 'Y',
      
      // Risk indicators
      riskLevel: this.calculateMathRiskLevel(columns, columnMap),
      
      // Metadata
      gradeLevel: this.cleanValue(columns[columnMap.grade]),
      academicYear: this.cleanValue(columns[columnMap.academicYear]),
      normingWindow: this.cleanValue(columns[columnMap.normingWindow]),
      
      // Matching metadata
      matchedBy: matchResult.matchedBy,
      matchConfidence: matchResult.confidence,
      originalStudentId
    };
  }
  
  private mapColumns(headers: string[], subject: 'Reading' | 'Math'): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const lower = header.toLowerCase().trim();
      
      // Common fields
      if (lower === 'last name') map.lastName = index;
      else if (lower === 'first name') map.firstName = index;
      else if (lower === 'student id') map.studentId = index;
      else if (lower === 'student grade') map.grade = index;
      else if (lower === 'academic year') map.academicYear = index;
      else if (lower === 'start date') map.startDate = index;
      else if (lower === 'completion date') map.completionDate = index;
      else if (lower === 'norming window') map.normingWindow = index;
      else if (lower === 'baseline diagnostic (y/n)') map.baseline = index;
      else if (lower === 'most recent diagnostic ytd (y/n)') map.mostRecentYTD = index;
      else if (lower === 'duration (min)') map.duration = index;
      else if (lower === 'rush flag') map.rushFlag = index;
      else if (lower === 'read aloud') map.readAloud = index;
      else if (lower === 'overall scale score') map.overallScore = index;
      else if (lower === 'overall placement') map.placement = index;
      else if (lower === 'overall relative placement') map.relativePlacement = index;
      else if (lower === 'percentile') map.percentile = index;
      else if (lower === 'diagnostic gain') map.diagnosticGain = index;
      else if (lower === 'annual typical growth measure') map.annualTypicalGrowth = index;
      else if (lower === 'annual stretch growth measure') map.annualStretchGrowth = index;
      else if (lower === 'percent progress to annual typical growth (%)') map.percentProgressTypical = index;
      else if (lower === 'percent progress to annual stretch growth (%)') map.percentProgressStretch = index;
      
      if (subject === 'Reading') {
        // Reading-specific fields
        if (lower === 'lexile measure') map.lexile = index;
        else if (lower === 'lexile range') map.lexileRange = index;
        else if (lower === 'phonological awareness scale score') map.phonologicalAwareness = index;
        else if (lower === 'phonological awareness placement') map.phonologicalAwarenessPlacement = index;
        else if (lower === 'phonics scale score') map.phonics = index;
        else if (lower === 'phonics placement') map.phonicsPlacement = index;
        else if (lower === 'high-frequency words scale score') map.highFrequencyWords = index;
        else if (lower === 'high-frequency words placement') map.highFrequencyWordsPlacement = index;
        else if (lower === 'vocabulary scale score') map.vocabulary = index;
        else if (lower === 'vocabulary placement') map.vocabularyPlacement = index;
        else if (lower === 'comprehension: overall scale score') map.comprehensionOverall = index;
        else if (lower === 'comprehension: overall placement') map.comprehensionOverallPlacement = index;
        else if (lower === 'comprehension: literature scale score') map.comprehensionLiterature = index;
        else if (lower === 'comprehension: literature placement') map.comprehensionLiteraturePlacement = index;
        else if (lower === 'comprehension: informational text scale score') map.comprehensionInformational = index;
        else if (lower === 'comprehension: informational text placement') map.comprehensionInformationalPlacement = index;
        else if (lower === 'reading difficulty indicator (y/n)') map.readingDifficulty = index;
      } else {
        // Math-specific fields
        if (lower === 'quantile measure') map.quantile = index;
        else if (lower === 'quantile range') map.quantileRange = index;
        else if (lower === 'number and operations scale score') map.numberAndOperations = index;
        else if (lower === 'number and operations placement') map.numberAndOperationsPlacement = index;
        else if (lower === 'algebra and algebraic thinking scale score') map.algebraAndAlgebraicThinking = index;
        else if (lower === 'algebra and algebraic thinking placement') map.algebraAndAlgebraicThinkingPlacement = index;
        else if (lower === 'measurement and data scale score') map.measurementAndData = index;
        else if (lower === 'measurement and data placement') map.measurementAndDataPlacement = index;
        else if (lower === 'geometry scale score') map.geometry = index;
        else if (lower === 'geometry placement') map.geometryPlacement = index;
      }
    });
    
    return map;
  }
  
  private calculateReadingRiskLevel(columns: string[], columnMap: any): string {
    const percentile = this.parseNumber(this.cleanValue(columns[columnMap.percentile])) || 0;
    const readingDifficulty = this.cleanValue(columns[columnMap.readingDifficulty]) === 'Y';
    const relativePlacement = this.cleanValue(columns[columnMap.relativePlacement])?.toLowerCase() || '';
    
    if (readingDifficulty || percentile <= 10 || relativePlacement.includes('3 or more')) {
      return 'High Risk';
    } else if (percentile <= 25 || relativePlacement.includes('2 grade')) {
      return 'Medium Risk';
    } else if (percentile <= 40 || relativePlacement.includes('1 grade')) {
      return 'Some Risk';
    } else {
      return 'Low Risk';
    }
  }
  
  private calculateMathRiskLevel(columns: string[], columnMap: any): string {
    const percentile = this.parseNumber(this.cleanValue(columns[columnMap.percentile])) || 0;
    const relativePlacement = this.cleanValue(columns[columnMap.relativePlacement])?.toLowerCase() || '';
    
    if (percentile <= 10 || relativePlacement.includes('3 or more')) {
      return 'High Risk';
    } else if (percentile <= 25 || relativePlacement.includes('2 grade')) {
      return 'Medium Risk';
    } else if (percentile <= 40 || relativePlacement.includes('1 grade')) {
      return 'Some Risk';
    } else {
      return 'Low Risk';
    }
  }
  
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  }
  
  private cleanValue(value: string): string {
    if (!value) return '';
    return value.replace(/^[="']+|[="']+$/g, '').trim();
  }
  
  private parseDate(dateStr: string): Date | undefined {
    if (!dateStr) return undefined;
    
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? undefined : date;
    } catch {
      return undefined;
    }
  }
  
  private parseNumber(value: string): number | undefined {
    if (!value || value === 'N/A' || value === '') return undefined;
    const num = parseFloat(value);
    return isNaN(num) ? undefined : num;
  }
  
  private generateSummaryStatistics(records: AssessmentRecord[]) {
    const scores = records.map(r => r.score || 0).filter(s => s > 0);
    const avgOverallScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    // Grade distribution
    const gradeDistribution: Record<string, number> = {};
    records.forEach(r => {
      const grade = r.gradeLevel || 'Unknown';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });
    
    // Placement distribution
    const placementDistribution: Record<string, number> = {};
    records.forEach(r => {
      const placement = r.placement || 'Unknown';
      placementDistribution[placement] = (placementDistribution[placement] || 0) + 1;
    });
    
    // Risk students (those with High Risk or reading difficulty indicator)
    const riskStudents = records.filter(r => 
      r.riskLevel === 'High Risk' || 
      r.readingDifficultyIndicator === true ||
      (r.percentile || 0) <= 15
    ).length;
    
    return {
      avgOverallScore: Math.round(avgOverallScore * 100) / 100,
      totalStudents: records.length,
      gradeDistribution,
      placementDistribution,
      riskStudents
    };
  }
}