import { studentMatcher, type MatchResult } from '../student-matcher';
import * as Papa from 'papaparse';
import { db } from '../db';
import type { AttendanceRecord } from '../../shared/types';

export interface AttendanceUploadResult {
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

export class AttendanceAdapter {
  async processFile(file: File): Promise<AttendanceUploadResult> {
    console.log('🏫 Starting attendance file processing...');
    
    const csvText = await this.readFileAsText(file);
    const parsedData = await this.parseCSV(csvText);
    
    console.log(`📊 Parsed ${parsedData.length} rows from attendance CSV`);
    
    // Find the header row (should contain "Student" and have date columns)
    let headerRowIndex = -1;
    let headers: string[] = [];
    
    for (let i = 0; i < Math.min(5, parsedData.length); i++) {
      const row = parsedData[i];
      if (row.length > 0 && row[0] && row[0].toLowerCase().includes('student')) {
        headerRowIndex = i;
        headers = row;
        console.log(`✅ Found header row at index ${i}`);
        break;
      }
    }
    
    if (headerRowIndex === -1) {
      throw new Error('Could not find header row with Student column');
    }
    
    // Extract date columns (format like "8/12", "8/13", etc.)
    const dateColumns = this.extractDateColumns(headers);
    console.log(`📅 Found ${dateColumns.length} date columns`);
    
    // Process data rows
    const dataRows = parsedData.slice(headerRowIndex + 1);
    const result: AttendanceUploadResult = {
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
    
    // Clear existing attendance data
    await db.attendance.clear();
    console.log('🗑️  Cleared existing attendance data');
    
    // Process each student row
    for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      const row = dataRows[rowIndex];
      
      try {
        const studentName = row[0]; // "Last, First" format
        const studentId = row[1];   // DCPS ID
        
        if (!studentName || studentName.trim() === '') {
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
          
          // Process attendance data for this student
          const attendanceRecords = this.extractAttendanceRecords(
            match.wasabiId,
            row,
            headers,
            dateColumns,
            studentName,
            studentId
          );
          
          // Save attendance records
          for (const record of attendanceRecords) {
            await db.attendance.add(record);
            result.processedRecords++;
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
    
    console.log('📊 Attendance processing complete:', result);
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
  
  private extractDateColumns(headers: string[]): Array<{ index: number; header: string; date: Date | null }> {
    const dateColumns: Array<{ index: number; header: string; date: Date | null }> = [];
    
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (this.looksLikeDateColumn(header)) {
        const date = this.parseDateFromHeader(header);
        dateColumns.push({
          index: i,
          header,
          date
        });
      }
    }
    
    return dateColumns;
  }
  
  private looksLikeDateColumn(header: string): boolean {
    if (!header) return false;
    
    // Remove Excel formula prefixes and quotes
    const cleanHeader = header.replace(/^="?/, '').replace(/"?$/, '').trim();
    
    // Check for MM/DD format
    const datePattern = /^\d{1,2}\/\d{1,2}$/;
    return datePattern.test(cleanHeader);
  }
  
  private parseDateFromHeader(header: string): Date | null {
    try {
      // Remove Excel formula prefixes and quotes
      const cleanHeader = header.replace(/^="?/, '').replace(/"?$/, '').trim();
      
      // Parse MM/DD format - assume current school year
      const parts = cleanHeader.split('/');
      if (parts.length === 2) {
        const month = parseInt(parts[0], 10);
        const day = parseInt(parts[1], 10);
        
        // Determine year based on month (Aug-Dec = current year, Jan-Jul = next year)
        const currentYear = new Date().getFullYear();
        const year = month >= 8 ? currentYear : currentYear + 1;
        
        const date = new Date(year, month - 1, day);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    } catch (error) {
      console.warn('Failed to parse date from header:', header, error);
    }
    
    return null;
  }
  
  private extractAttendanceRecords(
    wasabiId: string,
    row: string[],
    headers: string[],
    dateColumns: Array<{ index: number; header: string; date: Date | null }>,
    originalStudentName: string,
    originalStudentId: string
  ): AttendanceRecord[] {
    const records: AttendanceRecord[] = [];
    
    for (const dateCol of dateColumns) {
      const attendanceValue = row[dateCol.index];
      
      // Skip empty, dash, or asterisk values
      if (!attendanceValue || attendanceValue === '-' || attendanceValue === '*' || attendanceValue.trim() === '') {
        continue;
      }
      
      if (!dateCol.date) {
        continue; // Skip if we couldn't parse the date
      }
      
      const status = this.parseAttendanceStatus(attendanceValue);
      
      const record: AttendanceRecord = {
        studentId: wasabiId,
        date: dateCol.date,
        status,
        matchedBy: 'dcps_id', // Will be set properly by the matcher
        matchConfidence: 100,   // Will be set properly by the matcher
        originalStudentId: originalStudentId,
        // Store original data for reference
        originalStudentName,
        attendanceCode: attendanceValue.trim(),
        dateHeader: dateCol.header
      };
      
      records.push(record);
    }
    
    return records;
  }
  
  private parseAttendanceStatus(value: string): 'present' | 'absent' | 'tardy' | 'early_dismissal' {
    if (!value) return 'absent';
    
    const statusStr = value.toUpperCase().trim();
    
    switch (statusStr) {
      case 'P':
        return 'present';
      case 'A':
      case 'U': // Unexcused absence
        return 'absent';
      case 'T':
      case 'L': // Late (same as tardy)
        return 'tardy';
      case 'E':
        return 'early_dismissal';
      case 'I': // In-school suspension - count as present
      case 'O': // Out-of-school suspension - count as absent
        return statusStr === 'I' ? 'present' : 'absent';
      default:
        // For unknown codes, default to present (safer assumption)
        return 'present';
    }
  }
}

export const attendanceAdapter = new AttendanceAdapter();