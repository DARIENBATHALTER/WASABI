import { studentMatcher, type MatchResult } from '../student-matcher';
import * as Papa from 'papaparse';
import { db } from '../db';
import type { AssessmentRecord } from '../../shared/types';

export interface IReadyMathUploadResult {
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  processedRecords: number;
  errors: string[];
  matchingReport: {
    dcpsIdMatches: number;
    nameMatches: number;
    noMatches: number;
  };
}

export class IReadyMathAdapter {
  async processFile(file: File): Promise<IReadyMathUploadResult> {
    console.log('📐 Starting iReady Math file processing...');
    
    const csvText = await this.readFileAsText(file);
    const parsedData = await this.parseCSV(csvText);
    
    console.log(`📊 Parsed ${parsedData.length} rows from iReady Math CSV`);
    
    if (parsedData.length === 0) {
      throw new Error('No data found in CSV file');
    }
    
    // First row should be headers
    const headers = parsedData[0];
    const dataRows = parsedData.slice(1);
    
    console.log('📋 Headers found:', headers);
    console.log(`📝 Processing ${dataRows.length} iReady Math assessment records`);
    
    const result: IReadyMathUploadResult = {
      totalRows: dataRows.length,
      matchedRows: 0,
      unmatchedRows: 0,
      processedRecords: 0,
      errors: [],
      matchingReport: {
        dcpsIdMatches: 0,
        nameMatches: 0,
        noMatches: 0
      }
    };
    
    // Clear existing iReady Math assessments
    await db.assessments.where('source').equals('iReady Math').delete();
    console.log('🗑️  Cleared existing iReady Math assessment data');
    
    // Process each assessment record
    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const row = dataRows[rowIndex];
      
      try {
        // Create row object from headers
        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index] || '';
        });
        
        const firstName = rowData['First Name'] || '';
        const lastName = rowData['Last Name'] || '';
        const studentId = rowData['Student ID'] || '';
        const fullName = `${lastName}, ${firstName}`.trim();
        
        if (!firstName.trim() || !lastName.trim()) {
          continue; // Skip empty rows
        }
        
        console.log(`👤 Processing: ${fullName} (ID: ${studentId})`);
        
        // Try to match this student
        const matchData = {
          Student: fullName,
          'First Name': firstName,
          'Last Name': lastName,
          'Student ID': studentId,
          'DCPS Student ID': studentId
        };
        
        const match = await studentMatcher.matchStudent(matchData);
        
        if (match) {
          result.matchedRows++;
          
          // Track match type
          if (match.matchType === 'dcps_id') {
            result.matchingReport.dcpsIdMatches++;
          } else if (match.matchType === 'name') {
            result.matchingReport.nameMatches++;
          }
          
          console.log(`  ✅ Matched to: ${match.student.firstName} ${match.student.lastName} (${match.matchType}, ${match.confidence}% confidence)`);
          
          // Create assessment record
          const assessmentRecord = this.createAssessmentRecord(
            match.wasabiId,
            rowData,
            fullName,
            studentId,
            match
          );
          
          if (assessmentRecord) {
            // Save assessment record
            await db.assessments.add(assessmentRecord);
            result.processedRecords++;
            console.log(`  📊 Added iReady Math assessment: Overall Score ${assessmentRecord.score}, Placement ${assessmentRecord.proficiency}`);
          }
          
        } else {
          result.unmatchedRows++;
          result.matchingReport.noMatches++;
          console.log(`  ❌ No match found for: ${fullName}`);
        }
        
      } catch (error) {
        console.error(`Error processing row ${rowIndex}:`, error);
        result.errors.push(`Row ${rowIndex + 1}: ${error}`);
      }
    }
    
    console.log('📊 iReady Math processing complete:', result);
    return result;
  }
  
  private async readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }
  
  private async parseCSV(csvText: string): Promise<string[][]> {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        complete: (results) => {
          resolve(results.data as string[][]);
        },
        error: (error) => {
          reject(error);
        },
        skipEmptyLines: false // Keep empty lines for structure detection
      });
    });
  }
  
  private createAssessmentRecord(
    wasabiId: string,
    rowData: any,
    originalStudentName: string,
    originalStudentId: string,
    match: MatchResult
  ): AssessmentRecord | null {
    try {
      // Parse test dates
      const completionDate = this.parseDate(rowData['Completion Date']);
      
      if (!completionDate) {
        console.warn('Skipping record - no valid completion date');
        return null;
      }
      
      // Parse scores and placement
      const overallScaleScore = parseInt(rowData['Overall Scale Score'] || '0', 10);
      const percentile = parseInt(rowData['Percentile'] || '0', 10);
      const overallPlacement = rowData['Overall Placement'] || '';
      const overallRelativePlacement = rowData['Overall Relative Placement'] || '';
      
      // Determine proficiency level based on placement
      const proficiency = this.mapPlacementToProficiency(overallPlacement, overallRelativePlacement);
      
      // Parse domain scores
      const numberOpsScore = parseInt(rowData['Number and Operations Scale Score'] || '0', 10);
      const algebraScore = parseInt(rowData['Algebra and Algebraic Thinking Scale Score'] || '0', 10);
      const measurementScore = parseInt(rowData['Measurement and Data Scale Score'] || '0', 10);
      const geometryScore = parseInt(rowData['Geometry Scale Score'] || '0', 10);
      
      // Parse growth measures
      const diagnosticGain = parseInt(rowData['Diagnostic Gain'] || '0', 10);
      const annualTypicalGrowth = parseInt(rowData['Annual Typical Growth Measure'] || '0', 10);
      const annualStretchGrowth = parseInt(rowData['Annual Stretch Growth Measure'] || '0', 10);
      const percentProgressTypical = parseFloat(rowData['Percent Progress to Annual Typical Growth (%)'] || '0');
      const percentProgressStretch = parseFloat(rowData['Percent Progress to Annual Stretch Growth (%)'] || '0');
      
      const assessmentRecord: AssessmentRecord = {
        studentId: wasabiId,
        source: 'iReady Math',
        testDate: completionDate,
        subject: 'Math',
        score: overallScaleScore,
        percentile: percentile > 0 ? percentile : undefined,
        gradeLevel: rowData['Student Grade'] || '',
        proficiency,
        // Matching metadata
        matchedBy: match.matchType,
        matchConfidence: match.confidence,
        originalStudentId: originalStudentId,
        // Store all iReady-specific data
        originalStudentName,
        academicYear: rowData['Academic Year'] || '',
        school: rowData['School'] || '',
        enrolled: rowData['Enrolled'] || '',
        userName: rowData['User Name'] || '',
        sex: rowData['Sex'] || '',
        hispanicLatino: rowData['Hispanic or Latino'] || '',
        race: rowData['Race'] || '',
        englishLanguageLearner: rowData['English Language Learner'] || '',
        specialEducation: rowData['Special Education'] || '',
        economicallyDisadvantaged: rowData['Economically Disadvantaged'] || '',
        migrant: rowData['Migrant'] || '',
        classes: rowData['Class(es)'] || '',
        classTeachers: rowData['Class Teacher(s)'] || '',
        reportGroups: rowData['Report Group(s)'] || '',
        startDate: rowData['Start Date'] || '',
        normingWindow: rowData['Norming Window'] || '',
        baselineDiagnostic: rowData['Baseline Diagnostic (Y/N)'] || '',
        mostRecentDiagnostic: rowData['Most Recent Diagnostic YTD (Y/N)'] || '',
        duration: rowData['Duration (min)'] || '',
        rushFlag: rowData['Rush Flag'] || '',
        readAloud: rowData['Read Aloud'] || '',
        // Placement information
        overallPlacement,
        overallRelativePlacement,
        grouping: rowData['Grouping'] || '',
        quantileMeasure: rowData['Quantile Measure'] || '',
        quantileRange: rowData['Quantile Range'] || '',
        // Domain scores
        numberOperationsScore: numberOpsScore || undefined,
        numberOperationsPlacement: rowData['Number and Operations Placement'] || '',
        numberOperationsRelativePlacement: rowData['Number and Operations Relative Placement'] || '',
        algebraScore: algebraScore || undefined,
        algebraPlacement: rowData['Algebra and Algebraic Thinking Placement'] || '',
        algebraRelativePlacement: rowData['Algebra and Algebraic Thinking Relative Placement'] || '',
        measurementDataScore: measurementScore || undefined,
        measurementDataPlacement: rowData['Measurement and Data Placement'] || '',
        measurementDataRelativePlacement: rowData['Measurement and Data Relative Placement'] || '',
        geometryScore: geometryScore || undefined,
        geometryPlacement: rowData['Geometry Placement'] || '',
        geometryRelativePlacement: rowData['Geometry Relative Placement'] || '',
        // Growth metrics
        diagnosticGain: diagnosticGain || undefined,
        annualTypicalGrowthMeasure: annualTypicalGrowth || undefined,
        annualStretchGrowthMeasure: annualStretchGrowth || undefined,
        percentProgressToAnnualTypicalGrowth: percentProgressTypical || undefined,
        percentProgressToAnnualStretchGrowth: percentProgressStretch || undefined,
        midOnGradeLevelScaleScore: parseInt(rowData['Mid On Grade Level Scale Score'] || '0', 10) || undefined
      };
      
      return assessmentRecord;
      
    } catch (error) {
      console.error('Error creating iReady Math assessment record:', error);
      return null;
    }
  }
  
  private parseDate(dateStr: string): Date | undefined {
    if (!dateStr || dateStr.trim() === '') return undefined;
    
    try {
      // Handle MM/DD/YYYY format
      const cleanDateStr = dateStr.trim();
      const date = new Date(cleanDateStr);
      
      if (isNaN(date.getTime())) {
        // Try parsing MM/DD/YYYY format manually
        const parts = cleanDateStr.split('/');
        if (parts.length === 3) {
          const month = parseInt(parts[0], 10) - 1; // Month is 0-indexed
          const day = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          const parsedDate = new Date(year, month, day);
          
          if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
          }
        }
        return undefined;
      }
      
      return date;
    } catch (error) {
      console.warn('Failed to parse date:', dateStr, error);
      return undefined;
    }
  }
  
  private mapPlacementToProficiency(placement: string, relativePlacement: string): 'below' | 'approaching' | 'meets' | 'exceeds' {
    if (!placement) return 'below';
    
    const placementLower = placement.toLowerCase();
    const relativePlacementLower = relativePlacement.toLowerCase();
    
    // Check relative placement for grade level information
    if (relativePlacementLower.includes('above') || relativePlacementLower.includes('exceed')) {
      return 'exceeds';
    }
    
    if (relativePlacementLower.includes('on') || relativePlacementLower.includes('at grade level')) {
      return 'meets';
    }
    
    if (relativePlacementLower.includes('1 grade level below')) {
      return 'approaching';
    }
    
    if (relativePlacementLower.includes('below') || relativePlacementLower.includes('emerging')) {
      return 'below';
    }
    
    // Fallback to placement level analysis
    if (placementLower.includes('grade')) {
      // Extract grade info and compare to student grade if possible
      return 'approaching'; // Default for grade-level placements
    }
    
    if (placementLower.includes('emerging')) {
      return 'below';
    }
    
    // Default fallback
    return 'below';
  }
}

export const iReadyMathAdapter = new IReadyMathAdapter();