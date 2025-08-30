import type { DataAdapter, ParsedData, ValidationResult } from './base';
import type { AttendanceRecord, MatchingReport } from '../../shared/types';
import { studentMatcher } from '../studentMatcher';

export class AttendanceAdapter implements DataAdapter {
  name = 'Attendance Data';
  type = 'attendance' as const;

  validateData(data: ParsedData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required columns
    const headers = data.headers.map(h => h.toLowerCase());
    
    const hasStudentId = headers.some(h => 
      h.includes('student') && h.includes('id') || h.includes('studentid') || h.includes('student_id')
    );
    
    // Check for date columns (daily matrix format)
    const dateColumns = this.findDateColumns(data.headers);
    const hasAbsencesSummary = headers.some(h => h.includes('absences'));
    
    if (!hasStudentId) {
      errors.push('Missing required Student ID column');
    }
    if (dateColumns.length === 0 && !hasAbsencesSummary) {
      errors.push('Missing required attendance data columns');
    }

    // Check for empty data
    if (data.rows.length === 0) {
      errors.push('No data rows found');
    }

    // Validate sample records
    let validRecords = 0;
    const sampleSize = Math.min(10, data.rows.length);
    
    for (let i = 0; i < sampleSize; i++) {
      const row = data.rows[i];
      const studentId = this.findValue(row, data.headers, ['Student ID', 'student_id', 'studentid', 'id']);
      
      if (studentId && (dateColumns.length > 0 || hasAbsencesSummary)) {
        validRecords++;
      }
    }

    if (validRecords === 0) {
      errors.push('No valid attendance records found in sample data');
    } else if (validRecords < sampleSize * 0.8) {
      warnings.push(`Only ${validRecords}/${sampleSize} sample records appear valid`);
    }

    if (dateColumns.length > 0) {
      warnings.push(`Found ${dateColumns.length} daily attendance columns`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async transformData(data: ParsedData): Promise<AttendanceRecord[]> {
    const result = await this.transformDataWithMatching(data);
    return result.data;
  }

  async transformDataWithMatching(data: ParsedData): Promise<{
    data: AttendanceRecord[];
    matchingReport: MatchingReport;
  }> {
    const dateColumns = this.findDateColumns(data.headers);
    
    // First, match all rows to students using the StudentMatcher
    const { matchedRows, report } = await studentMatcher.matchDataset(data.rows);
    
    const records: AttendanceRecord[] = [];
    
    for (const matchedRow of matchedRows) {
      try {
        const studentRecords = this.transformAttendanceRecord(matchedRow, data.headers, dateColumns);
        records.push(...studentRecords);
      } catch (error) {
        console.warn('Error transforming attendance record:', error);
        // Continue processing other rows
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

  private transformAttendanceRecord(row: Record<string, any>, headers: string[], dateColumns: string[]): AttendanceRecord[] {
    // Use WASABI ID from matching if available, otherwise try to extract district ID
    const wasabiId = row.wasabiId;
    const originalStudentId = this.findValue(row, headers, ['Student ID', 'student_id', 'studentid', 'id']);
    
    if (!wasabiId) {
      // If no WASABI ID match, skip this record
      return [];
    }

    const records: AttendanceRecord[] = [];
    const matchInfo = row.matchInfo;
    
    // Process each date column
    for (const dateColumn of dateColumns) {
      const attendanceValue = row[dateColumn];
      
      // Skip empty or dash values
      if (!attendanceValue || attendanceValue === '-' || attendanceValue === '') {
        continue;
      }
      
      const date = this.parseDateFromHeader(dateColumn);
      if (!date) {
        continue;
      }
      
      const status = this.parseAttendanceStatus(attendanceValue);
      
      const record: AttendanceRecord = {
        studentId: wasabiId, // Use WASABI ID
        date,
        status,
        // Include matching metadata
        matchedBy: matchInfo?.matchedBy,
        matchConfidence: matchInfo?.confidence,
        originalStudentId: originalStudentId ? String(originalStudentId) : undefined,
      };
      
      // Include all original CSV data for debugging/reference
      Object.keys(row).forEach(key => {
        if (!['wasabiId', 'matchInfo'].includes(key)) {
          record[key] = row[key];
        }
      });
      
      records.push(record);
    }

    return records;
  }

  private findDateColumns(headers: string[]): string[] {
    const dateColumns: string[] = [];
    
    for (const header of headers) {
      // Look for date patterns like "8/12", "9/3", etc.
      if (this.looksLikeDateColumn(header)) {
        dateColumns.push(header);
      }
    }
    
    return dateColumns;
  }
  
  private looksLikeDateColumn(header: string): boolean {
    // Remove any Excel formula prefixes and quotes
    const cleanHeader = header.replace(/^="?/, '').replace(/"?$/, '');
    
    // Check for MM/DD format
    const datePattern = /^\d{1,2}\/\d{1,2}$/;
    return datePattern.test(cleanHeader);
  }
  
  private parseDateFromHeader(header: string): Date | null {
    try {
      // Remove any Excel formula prefixes and quotes
      const cleanHeader = header.replace(/^="?/, '').replace(/"?$/, '');
      
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
  
  private parseAttendanceStatus(value: any): 'present' | 'absent' | 'tardy' | 'early_dismissal' {
    if (!value) return 'absent';
    
    const statusStr = String(value).toUpperCase().trim();
    
    switch (statusStr) {
      case 'P':
        return 'present';
      case 'A':
      case 'U': // Unexcused absence
        return 'absent';
      case 'T':
        return 'tardy';
      case 'E':
      case 'L': // Left early
        return 'early_dismissal';
      default:
        // Default to present for other codes like 'I' (in-school suspension), 'O' (out-of-school), etc.
        return 'present';
    }
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
        header: false, // Don't use automatic header detection
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            const criticalErrors = results.errors.filter(error => error.type === 'Delimiter');
            if (criticalErrors.length > 0) {
              reject(new Error(`CSV parsing failed: ${criticalErrors[0].message}`));
              return;
            }
          }
          
          const rows = results.data as string[][];
          
          // Find the actual header row (should contain "Student ID")
          let headerRowIndex = -1;
          let headers: string[] = [];
          
          for (let i = 0; i < Math.min(5, rows.length); i++) {
            const row = rows[i];
            if (row.some(cell => cell && cell.toLowerCase().includes('student') && cell.toLowerCase().includes('id'))) {
              headerRowIndex = i;
              headers = row.map(h => String(h).trim().replace(/^"/, '').replace(/"$/, ''));
              break;
            }
          }
          
          if (headerRowIndex === -1) {
            reject(new Error('Could not find header row with Student ID'));
            return;
          }
          
          // Convert remaining rows to objects
          const dataRows: Record<string, any>[] = [];
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
              continue; // Skip empty rows
            }
            
            const dataRow: Record<string, any> = {};
            for (let j = 0; j < headers.length && j < row.length; j++) {
              if (headers[j]) {
                dataRow[headers[j]] = row[j];
              }
            }
            dataRows.push(dataRow);
          }
          
          resolve({
            headers,
            rows: dataRows,
          });
        },
        error: (error) => {
          reject(new Error(`Failed to parse CSV: ${error.message}`));
        }
      });
    });
  }
}