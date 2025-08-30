import { studentMatcher, type MatchResult } from '../student-matcher';
import * as Papa from 'papaparse';
import { db } from '../db';
import type { DisciplineRecord } from '../../shared/types';

export interface DisciplineUploadResult {
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

export class DisciplineAdapter {
  async processFile(file: File): Promise<DisciplineUploadResult> {
    console.log('⚖️ Starting discipline file processing...');
    
    const csvText = await this.readFileAsText(file);
    const parsedData = await this.parseCSV(csvText);
    
    console.log(`📊 Parsed ${parsedData.length} rows from discipline CSV`);
    
    if (parsedData.length === 0) {
      throw new Error('No data found in CSV file');
    }
    
    // First row should be headers
    const headers = parsedData[0];
    const dataRows = parsedData.slice(1);
    
    console.log('📋 Headers found:', headers);
    console.log(`📝 Processing ${dataRows.length} discipline records`);
    
    const result: DisciplineUploadResult = {
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
    
    // Clear existing discipline data
    await db.discipline.clear();
    console.log('🗑️  Cleared existing discipline data');
    
    // Process each discipline record
    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const row = dataRows[rowIndex];
      
      try {
        // Create row object from headers
        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header] = row[index] || '';
        });
        
        const studentName = rowData['Student'] || '';
        const studentId = rowData['Student ID'] || '';
        
        if (!studentName.trim()) {
          continue; // Skip empty rows
        }
        
        console.log(`👤 Processing: ${studentName} (ID: ${studentId})`);
        
        // Try to match this student
        const matchData = {
          Student: studentName,
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
          
          // Create discipline record
          const disciplineRecord = this.createDisciplineRecord(
            match.wasabiId,
            rowData,
            studentName,
            studentId,
            match
          );
          
          if (disciplineRecord) {
            // Save discipline record
            await db.discipline.add(disciplineRecord);
            result.processedRecords++;
            console.log(`  📝 Added discipline record: ${disciplineRecord.infraction}`);
          }
          
        } else {
          result.unmatchedRows++;
          result.matchingReport.noMatches++;
          console.log(`  ❌ No match found for: ${studentName}`);
        }
        
      } catch (error) {
        console.error(`Error processing row ${rowIndex}:`, error);
        result.errors.push(`Row ${rowIndex + 1}: ${error}`);
      }
    }
    
    console.log('📊 Discipline processing complete:', result);
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
  
  private createDisciplineRecord(
    wasabiId: string,
    rowData: any,
    originalStudentName: string,
    originalStudentId: string,
    match: MatchResult
  ): DisciplineRecord | null {
    try {
      // Parse dates
      const incidentDate = this.parseDate(rowData['Incident Date']);
      const submissionDate = this.parseDate(rowData['Submission Date']);
      const actionStart = this.parseDate(rowData['Action Record: Date Begins']);
      const actionEnd = this.parseDate(rowData['Action Record: Date Ends']);
      
      if (!incidentDate) {
        console.warn('Skipping record - no valid incident date');
        return null;
      }
      
      // Extract infraction and code
      const infractionFull = rowData['Code of Student Conduct Infraction'] || '';
      const [infractionCode, ...infractionParts] = infractionFull.split('-');
      const infraction = infractionParts.join('-').trim();
      
      // Parse action details
      const actionDaysStr = rowData['Action Record: Length of Action'] || '';
      const actionDays = actionDaysStr ? parseInt(actionDaysStr, 10) : undefined;
      
      // Determine suspension type
      const actionType = rowData['Action Record: Resultant Action'] || '';
      let suspensionType: 'in-school' | 'out-of-school' | 'other' = 'other';
      if (actionType.toLowerCase().includes('in-school') || actionType.toLowerCase().includes('in school')) {
        suspensionType = 'in-school';
      } else if (actionType.toLowerCase().includes('out-of-school') || actionType.toLowerCase().includes('out of school')) {
        suspensionType = 'out-of-school';
      }
      
      const disciplineRecord: DisciplineRecord = {
        studentId: wasabiId,
        studentName: originalStudentName,
        incidentDate,
        submissionDate,
        infraction: infraction || infractionFull,
        infractionCode: infractionCode?.trim() || '',
        incident: rowData['Incident'] || '',
        action: rowData['Action(s)'] || actionType,
        location: rowData['Location'] || '',
        reporter: rowData['Reporter'] || '',
        administrator: rowData['Administrator'] || '',
        // Detailed incident info
        narrative: rowData['Provide a brief narrative of the incident'] || '',
        previousActions: rowData['Previous Actions Taken by Teacher (Check all that apply)'] || '',
        adminFindings: rowData['ADMIN FINDINGS'] || '',
        adminSummary: rowData['Administrative Summary'] || '',
        // Categorization fields
        bullying: this.parseBooleanField(rowData['Involved in Bullying']),
        gangRelated: this.parseBooleanField(rowData['Gang Related']),
        weaponUse: this.parseBooleanField(rowData['Weapon Use']),
        alcoholUse: this.parseBooleanField(rowData['Use of Alcohol']),
        drugUse: this.parseBooleanField(rowData['Use of Drugs']),
        hateCrime: this.parseBooleanField(rowData['Involved in Hate Crime']),
        // Action details
        actionDays,
        actionStart,
        actionEnd,
        suspensionType,
        // Matching metadata
        matchedBy: match.matchType,
        matchConfidence: match.confidence,
        originalStudentId: originalStudentId,
        // Store all original data for reference
        ...rowData
      };
      
      return disciplineRecord;
      
    } catch (error) {
      console.error('Error creating discipline record:', error);
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
  
  private parseBooleanField(value: string): boolean {
    if (!value) return false;
    const normalizedValue = value.toLowerCase().trim();
    return normalizedValue === 'yes' || normalizedValue === 'true' || normalizedValue === '1';
  }
}

export const disciplineAdapter = new DisciplineAdapter();