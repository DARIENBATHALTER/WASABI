import { studentMatcher } from '../student-matcher';
import { db } from '../db';
import type { AssessmentRecord } from '../../shared/types';

export interface EnhancedFASTUploadResult {
  totalRows: number;
  validRows: number;
  matchedRows: number;
  unmatchedRows: number;
  processedRecords: number;
  errors: string[];
  subject: 'ELA' | 'Math' | 'Science' | 'Writing';
  grade: string;
  assessmentSummary: {
    avgScaleScore: number;
    totalStudents: number;
    achievementLevelDistribution: Record<string, number>;
    standardsMastery: Array<{standard: string; masteryRate: number; avgScore: number}>;
    riskStudents: number;
  };
}

export class EnhancedFASTAdapter {
  async processFile(file: File, subject: 'ELA' | 'Math' | 'Science' | 'Writing', grade: string, testPeriod?: string): Promise<EnhancedFASTUploadResult> {
    console.log(`🎯 Starting enhanced FAST ${subject} Grade ${grade} file processing...`);
    
    const text = await file.text();
    const lines = text.split('\n');
    
    if (lines.length < 2) {
      throw new Error('File appears to be empty or invalid');
    }
    
    // Parse header
    const headers = this.parseCSVLine(lines[0]);
    const columnMap = this.mapColumns(headers, subject);
    
    console.log(`🎯 Column mapping for FAST ${subject} Grade ${grade}:`, columnMap);
    console.log(`🎯 Headers found:`, headers.map((h, i) => `${i}: ${h}`));
    
    const assessmentRecords: AssessmentRecord[] = [];
    let validRows = 0;
    let matchedRows = 0;
    let unmatchedRows = 0;
    const errors: string[] = [];
    
    // Extract standards benchmarks from headers
    const standardsBenchmarks = this.extractStandardsBenchmarks(headers);
    console.log(`🎯 Found ${standardsBenchmarks.length} standards benchmarks`);
    
    // Process each student row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const columns = this.parseCSVLine(line);
        if (columns.length < 10) continue; // Ensure we have basic columns
        
        validRows++;
        
        const studentName = this.cleanValue(columns[columnMap.studentName]);
        const studentId = this.cleanValue(columns[columnMap.studentId]);
        const enrolledGrade = this.cleanValue(columns[columnMap.enrolledGrade]);
        
        // Match student using FL ID if available, fallback to name/ID
        const matchResult = await studentMatcher.matchStudent({
          'Student Name': studentName,
          'Student ID': studentId,
          'Enrolled Grade': enrolledGrade
        });
        
        if (!matchResult) {
          unmatchedRows++;
          errors.push(`No match found for: ${studentName} (ID: ${studentId})`);
          continue;
        }
        
        matchedRows++;
        
        // Extract test date
        const testDate = this.parseDate(this.cleanValue(columns[columnMap.dateTaken]));
        
        // Debug score values
        const scaleScore = this.cleanValue(columns[columnMap.scaleScore]);
        const achievementLevel = this.cleanValue(columns[columnMap.achievementLevel]);
        const percentileRank = this.cleanValue(columns[columnMap.percentileRank]);
        console.log(`🔍 Student ${studentName} - Scale Score: "${scaleScore}", Achievement: "${achievementLevel}", Percentile: "${percentileRank}"`);
        
        // Process based on subject
        const record = await this.processSubjectRecord(
          columns, 
          columnMap, 
          standardsBenchmarks,
          matchResult.wasabiId, 
          testDate,
          subject,
          grade,
          studentId,
          matchResult,
          testPeriod
        );
        
        assessmentRecords.push(record);
        
      } catch (error) {
        errors.push(`Error processing row ${i}: ${error}`);
      }
    }
    
    // Bulk insert records
    await db.assessments.bulkPut(assessmentRecords);
    
    // Generate summary statistics
    const summary = this.generateSummaryStatistics(assessmentRecords, standardsBenchmarks);
    
    const result: EnhancedFASTUploadResult = {
      totalRows: lines.length - 1,
      validRows,
      matchedRows,
      unmatchedRows,
      processedRecords: assessmentRecords.length,
      errors,
      subject,
      grade,
      assessmentSummary: summary
    };
    
    console.log(`🎯 Enhanced FAST ${subject} Grade ${grade} processing complete:`, result);
    return result;
  }
  
  private async processSubjectRecord(
    columns: string[], 
    columnMap: any, 
    standardsBenchmarks: Array<{standard: string; pointsEarnedIndex: number; pointsPossibleIndex: number}>,
    wasabiId: string, 
    testDate: Date | undefined,
    subject: string,
    grade: string,
    originalStudentId: string,
    matchResult: any,
    testPeriod?: string
  ): Promise<AssessmentRecord> {
    
    // Calculate detailed standards performance
    const standardsPerformance: Record<string, any> = {};
    let totalPointsEarned = 0;
    let totalPointsPossible = 0;
    
    standardsBenchmarks.forEach((benchmark, index) => {
      // Get the actual category and benchmark values from the data row
      const categoryValue = this.cleanValue(columns[benchmark.pointsEarnedIndex - 2]) || `Category ${index + 1}`; // Category is 2 columns before Points Earned
      const benchmarkValue = this.cleanValue(columns[benchmark.pointsEarnedIndex - 1]) || `Benchmark ${index + 1}`; // Benchmark is 1 column before Points Earned
      const pointsEarned = this.parseNumber(this.cleanValue(columns[benchmark.pointsEarnedIndex])) || 0;
      const pointsPossible = this.parseNumber(this.cleanValue(columns[benchmark.pointsPossibleIndex])) || 0;
      
      totalPointsEarned += pointsEarned;
      totalPointsPossible += pointsPossible;
      
      // Use a combined key for uniqueness
      const questionKey = `${categoryValue} - ${benchmarkValue}`;
      standardsPerformance[questionKey] = {
        category: categoryValue,
        benchmark: benchmarkValue,
        pointsEarned,
        pointsPossible,
        masteryPercentage: pointsPossible > 0 ? (pointsEarned / pointsPossible) * 100 : 0,
        mastered: pointsPossible > 0 && (pointsEarned / pointsPossible) >= 0.7 // 70% threshold
      };
    });
    
    // Calculate overall performance percentage
    const overallPerformancePercentage = totalPointsPossible > 0 ? (totalPointsEarned / totalPointsPossible) * 100 : 0;
    
    const baseRecord: AssessmentRecord = {
      studentId: wasabiId,
      source: `FAST ${subject}`,
      testDate: testDate || new Date(),
      subject: subject,
      testPeriod: testPeriod,
      
      // Core scores
      score: this.parseNumber(this.cleanValue(columns[columnMap.scaleScore])) || 0,
      level: this.parseNumber(this.cleanValue(columns[columnMap.achievementLevel])) || 0,
      percentile: this.parseNumber(this.cleanValue(columns[columnMap.percentileRank])) || 0,
      performanceLevel: this.cleanValue(columns[columnMap.achievementLevel]),
      
      // Enhanced standards-based data
      standardsPerformance,
      overallPerformancePercentage,
      totalPointsEarned,
      totalPointsPossible,
      standardsMasteredCount: Object.values(standardsPerformance).filter((perf: any) => perf.mastered).length,
      totalStandardsAssessed: standardsBenchmarks.length,
      
      // Student demographics and support information
      ethnicity: this.cleanValue(columns[columnMap.ethnicity]),
      sex: this.cleanValue(columns[columnMap.sex]),
      section504: this.cleanValue(columns[columnMap.section504]) === 'Yes',
      primaryExceptionality: this.cleanValue(columns[columnMap.primaryExceptionality]),
      englishLanguageLearner: this.cleanValue(columns[columnMap.ell]) === 'Yes',
      
      // Test administration details
      testReason: this.cleanValue(columns[columnMap.testReason]),
      testOpportunityNumber: this.parseNumber(this.cleanValue(columns[columnMap.testOppNumber])) || 1,
      testCompletionDate: this.parseDate(this.cleanValue(columns[columnMap.testCompletionDate])),
      
      // Performance categories
      readingProsePoetryPerformance: this.cleanValue(columns[columnMap.readingProsePoetry]),
      readingInformationalTextPerformance: this.cleanValue(columns[columnMap.readingInformationalText]),
      readingAcrossGenresVocabularyPerformance: this.cleanValue(columns[columnMap.readingAcrossGenres]),
      
      // Risk assessment
      riskLevel: this.calculateRiskLevel(
        this.parseNumber(this.cleanValue(columns[columnMap.scaleScore])) || 0,
        this.cleanValue(columns[columnMap.achievementLevel]),
        overallPerformancePercentage
      ),
      
      // Metadata
      gradeLevel: grade,
      academicYear: '2024-2025',
      testingLocation: this.cleanValue(columns[columnMap.testingLocation]),
      enrolledSchool: this.cleanValue(columns[columnMap.enrolledSchool]),
      
      // Matching metadata
      matchedBy: matchResult.matchType,
      matchConfidence: matchResult.confidence,
      originalStudentId
    };
    
    return baseRecord;
  }
  
  private extractStandardsBenchmarks(headers: string[]): Array<{category: string; standard: string; pointsEarnedIndex: number; pointsPossibleIndex: number}> {
    const benchmarks: Array<{category: string; standard: string; pointsEarnedIndex: number; pointsPossibleIndex: number}> = [];
    
    // Look for the repeating pattern: "Category, Benchmark, Points Earned, Points Possible"
    for (let i = 0; i < headers.length - 3; i++) {
      const header1 = headers[i].toLowerCase().trim();
      const header2 = headers[i + 1].toLowerCase().trim();
      const header3 = headers[i + 2].toLowerCase().trim();
      const header4 = headers[i + 3].toLowerCase().trim();
      
      // Check if this matches the exact pattern: Category, Benchmark, Points Earned, Points Possible
      if (header1 === 'category' && 
          header2 === 'benchmark' && 
          header3 === 'points earned' && 
          header4 === 'points possible') {
        
        // This is a standards question set
        benchmarks.push({
          category: `Question ${benchmarks.length + 1}`, // We'll get the actual category from the data
          standard: `Question ${benchmarks.length + 1}`, // We'll get the actual benchmark from the data
          pointsEarnedIndex: i + 2, // Points Earned column
          pointsPossibleIndex: i + 3  // Points Possible column
        });
        
        // Skip ahead to avoid overlapping matches
        i += 3;
      }
    }
    
    console.log(`🎯 Found ${benchmarks.length} standards question sets in headers`);
    return benchmarks;
  }
  
  private mapColumns(headers: string[], subject: string): Record<string, number> {
    const map: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const lower = header.toLowerCase().trim();
      
      // Common FAST fields (all files have these)
      if (lower === 'student name' || lower === '﻿student name') map.studentName = index;
      else if (lower === 'student id') map.studentId = index;
      else if (lower === 'enrolled grade') map.enrolledGrade = index;
      else if (lower === 'date taken') map.dateTaken = index;
      else if (lower === 'test completion date') map.testCompletionDate = index;
      else if (lower === 'ethnicity') map.ethnicity = index;
      else if (lower === 'sex') map.sex = index;
      else if (lower === 'section 504') map.section504 = index;
      else if (lower === 'primary exceptionality') map.primaryExceptionality = index;
      else if (lower === 'english language learner (ell) status') map.ell = index;
      else if (lower === 'test reason') map.testReason = index;
      else if (lower === 'test oppnumber') map.testOppNumber = index;
      else if (lower === 'testing location') map.testingLocation = index;
      else if (lower === 'enrolled school') map.enrolledSchool = index;
      
      // COMPREHENSIVE FAST SCORE MAPPING
      // Pattern 1: Grades 3-5 use "Scale Score" format
      if (lower.includes('scale score') && lower.includes('fast')) {
        map.scaleScore = index;
      }
      // Pattern 2: Grades K-2 use "FAST Equivalent Score" format  
      else if (lower.includes('fast equivalent score') && lower.includes('fast')) {
        map.scaleScore = index;
      }
      
      // Achievement Level mapping (consistent across all grades)
      if (lower.includes('achievement level') && lower.includes('fast')) {
        map.achievementLevel = index;
      }
      
      // Percentile Rank mapping (consistent across all grades)
      if (lower.includes('percentile rank') && lower.includes('fast')) {
        map.percentileRank = index;
      }
      
      // Subject-specific domain/category performance columns
      if (subject === 'ELA' || subject === 'Reading') {
        // Grades 3-5 ELA Reading performance categories
        if (lower === '1. reading prose and poetry performance') map.readingProsePoetry = index;
        else if (lower === '2. reading informational text performance') map.readingInformationalText = index;
        else if (lower === '3. reading across genres & vocabulary performance') map.readingAcrossGenres = index;
      } else if (subject === 'Math' || subject === 'Mathematics') {
        // Grade 3 Math categories
        if (lower === '1. number sense and additive reasoning performance') map.mathNumberSenseAdditive = index;
        else if (lower === '2. number sense and multiplicative reasoning performance') map.mathNumberSenseMultiplicative = index;
        else if (lower === '3. fractional reasoning performance') map.mathFractionalReasoning = index;
        else if (lower === '4. geometric reasoning, measurement, and data analysis and probability performance') map.mathGeometric = index;
        
        // Grade 4-5 Math categories  
        else if (lower === '1. number sense and operations with whole numbers performance') map.mathWholeNumbers = index;
        else if (lower === '2. number sense and operations with fractions and decimals performance') map.mathFractionsDecimals = index;
        else if (lower === '3. geometric reasoning, measurement, and data analysis and probability performance') map.mathGeometric = index;
        else if (lower === '3. algebraic reasoning performance') map.mathAlgebraic = index; // Grade 5 only
        else if (lower === '4. geometric reasoning, measurement, and data analysis and probability performance') map.mathGeometric = index;
      } else if (subject === 'Early Literacy') {
        // K-2 Early Literacy domain scores (10 domains)
        if (lower === '1. alphabetic principle domain score') map.earlyLitAlphabetic = index;
        else if (lower === '2. concept of word domain score') map.earlyLitConceptWord = index;
        else if (lower === '3. visual discrimination domain score') map.earlyLitVisual = index;
        else if (lower === '4. phonemic awareness domain score') map.earlyLitPhonemic = index;
        else if (lower === '5. phonics domain score') map.earlyLitPhonics = index;
        else if (lower === '6. structural analysis domain score') map.earlyLitStructural = index;
        else if (lower === '7. vocabulary domain score') map.earlyLitVocabulary = index;
        else if (lower === '8. sentence-level comprehension domain score') map.earlyLitSentence = index;
        else if (lower === '9. paragraph-level comprehension domain score') map.earlyLitParagraph = index;
        else if (lower === '10. early numeracy domain score') map.earlyLitNumeracy = index;
      }
    });
    
    console.log(`🗺️ Final column map for ${subject}:`, map);
    return map;
  }
  
  private calculateRiskLevel(scaleScore: number, achievementLevel: string, performancePercentage: number): string {
    const level = achievementLevel?.toLowerCase() || '';
    
    if (level === 'level 1' || performancePercentage < 30) {
      return 'High Risk';
    } else if (level === 'level 2' || performancePercentage < 50) {
      return 'Medium Risk';
    } else if (level === 'level 3' || performancePercentage < 70) {
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
  
  private generateSummaryStatistics(records: AssessmentRecord[], standardsBenchmarks: Array<{standard: string; pointsEarnedIndex: number; pointsPossibleIndex: number}>) {
    const scores = records.map(r => r.score || 0).filter(s => s > 0);
    const avgScaleScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    
    // Achievement level distribution
    const achievementLevelDistribution: Record<string, number> = {};
    records.forEach(r => {
      const level = r.performanceLevel || 'Unknown';
      achievementLevelDistribution[level] = (achievementLevelDistribution[level] || 0) + 1;
    });
    
    // Standards mastery analysis
    const standardsMastery: Array<{standard: string; masteryRate: number; avgScore: number}> = [];
    
    standardsBenchmarks.forEach(benchmark => {
      const standardPerformances = records
        .map(r => r.standardsPerformance?.[benchmark.standard])
        .filter(perf => perf);
      
      if (standardPerformances.length > 0) {
        const masteredCount = standardPerformances.filter(perf => perf.mastered).length;
        const masteryRate = (masteredCount / standardPerformances.length) * 100;
        const avgScore = standardPerformances.reduce((sum, perf) => sum + perf.masteryPercentage, 0) / standardPerformances.length;
        
        standardsMastery.push({
          standard: benchmark.standard,
          masteryRate: Math.round(masteryRate * 100) / 100,
          avgScore: Math.round(avgScore * 100) / 100
        });
      }
    });
    
    // Sort standards by mastery rate (lowest first for intervention prioritization)
    standardsMastery.sort((a, b) => a.masteryRate - b.masteryRate);
    
    // Risk students (Level 1 or High Risk)
    const riskStudents = records.filter(r => 
      r.riskLevel === 'High Risk' || 
      r.performanceLevel === 'Level 1' ||
      (r.overallPerformancePercentage || 0) < 30
    ).length;
    
    return {
      avgScaleScore: Math.round(avgScaleScore * 100) / 100,
      totalStudents: records.length,
      achievementLevelDistribution,
      standardsMastery,
      riskStudents
    };
  }
}