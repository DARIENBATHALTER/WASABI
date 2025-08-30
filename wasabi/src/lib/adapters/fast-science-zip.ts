import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { studentMatcher } from '../student-matcher';
import type { DataAdapter, ParsedData, AssessmentRecord, ImportReport } from '../types';

export interface FastScienceZipAdapter extends DataAdapter {
  processZipFile(file: File): Promise<{ records: AssessmentRecord[]; report: ImportReport }>;
}

export class FastScienceZipAdapter implements FastScienceZipAdapter {
  name = 'FAST Science ZIP';
  supportedTypes = ['.zip'];

  async processZipFile(file: File): Promise<{ records: AssessmentRecord[]; report: ImportReport }> {
    const JSZip = (await import('jszip')).default;
    
    try {
      const zip = await JSZip.loadAsync(file);
      const records: AssessmentRecord[] = [];
      let totalProcessed = 0;
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // Process each file in the ZIP
      for (const [filename, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;
        
        // Skip non-Excel files
        if (!filename.toLowerCase().endsWith('.xlsx') && !filename.toLowerCase().endsWith('.xls')) {
          continue;
        }

        try {
          const arrayBuffer = await zipEntry.async('arraybuffer');
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          
          // Convert to JSON with header row
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (jsonData.length === 0) {
            continue;
          }

          // Find header row and process data
          const { records: fileRecords, report: fileReport } = await this.processExcelData(jsonData, filename);
          
          records.push(...fileRecords);
          totalProcessed += fileReport.totalRows;
          successCount += fileReport.successfulRows;
          errorCount += fileReport.errorCount;
          errors.push(...fileReport.errors);
          
        } catch (error) {
          const errorMsg = `Error processing ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          console.error(errorMsg);
          errors.push(errorMsg);
          errorCount++;
        }
      }

      const report: ImportReport = {
        totalRows: totalProcessed,
        successfulRows: successCount,
        errorCount,
        errors,
        duplicateCount: 0, // Calculate if needed
        summary: `Processed ${records.length} FAST Science assessment records`
      };

      return { records, report };
    } catch (error) {
      throw new Error(`Failed to process FAST Science ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processExcelData(jsonData: any[][], filename: string): Promise<{ records: AssessmentRecord[]; report: ImportReport }> {
    const records: AssessmentRecord[] = [];
    let totalRows = 0;
    let successfulRows = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Find the header row (look for Student ID and Scale Score)
    let headerRowIndex = -1;
    let headers: string[] = [];
    
    for (let i = 0; i < Math.min(20, jsonData.length); i++) {
      const row = jsonData[i];
      const hasStudentId = row.some((cell: any) => cell && 
        (String(cell).toLowerCase().includes('student id') ||
         String(cell).toLowerCase().includes('fleid') ||
         String(cell).toLowerCase().includes('florida education identifier')));
      const hasScore = row.some((cell: any) => cell && 
        (String(cell).toLowerCase().includes('scale score') || 
         String(cell).toLowerCase().includes('equivalent score') ||
         String(cell).toLowerCase().includes('science') ||
         String(cell).toLowerCase().includes('score')));
         
      if (hasStudentId && hasScore) {
        headerRowIndex = i;
        headers = row.map((h: any) => String(h || '').trim());
        break;
      }
    }

    if (headerRowIndex === -1) {
      // Debug: Log available headers for troubleshooting
      console.log(`🐛 DEBUG: Available headers in ${filename}:`);
      for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        console.log(`Row ${i}:`, jsonData[i]);
      }
      throw new Error(`Could not find header row with Student ID and Score columns in ${filename}. Check the file format.`);
    }

    // Process data rows
    const dataRows = jsonData.slice(headerRowIndex + 1);
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      totalRows++;
      
      if (!row || row.length === 0 || row.every((cell: any) => !cell || String(cell).trim() === '')) {
        continue; // Skip empty rows
      }

      try {
        // Convert row array to object with headers
        const rowObject: Record<string, any> = {};
        for (let j = 0; j < headers.length && j < row.length; j++) {
          if (headers[j]) {
            rowObject[headers[j]] = row[j];
          }
        }

        // Extract grade from filename or row data
        const gradeMatch = filename.match(/Grade(\d+)/i);
        const grade = gradeMatch ? gradeMatch[1] : '5'; // Default to 5th grade for Science

        // Only process 5th grade Science
        if (grade !== '5') {
          continue;
        }

        // Try to match the student
        const match = await studentMatcher.matchStudent(rowObject);
        
        if (match) {
          rowObject.wasabiId = match.wasabiId;
          rowObject.matchInfo = {
            matchType: match.matchType,
            confidence: match.confidence
          };
        }

        // Transform to assessment record
        const record = this.transformScienceRecord(rowObject, headers, grade);
        
        if (record) {
          records.push(record);
          successfulRows++;
        }
        
      } catch (error) {
        const errorMsg = `Row ${i + 1} in ${filename}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        errorCount++;
      }
    }

    const report: ImportReport = {
      totalRows,
      successfulRows,
      errorCount,
      errors,
      duplicateCount: 0,
      summary: `Processed ${filename}: ${successfulRows}/${totalRows} rows successful`
    };

    return { records, report };
  }

  private transformScienceRecord(
    row: Record<string, any>,
    headers: string[],
    grade: string
  ): AssessmentRecord | null {
    const wasabiId = row.wasabiId;
    const originalStudentId = this.findValue(row, headers, [
      'Florida Education Identifier', 'FLEID', 'FL ID', 'FL_ID', 'fleid', 
      'Student ID', 'student_id', 'studentid', 'student number', 'student_number'
    ]);

    if (!wasabiId) {
      return null;
    }

    const matchInfo = row.matchInfo;
    
    // Find Science scale score
    const scaleScoreField = headers.find(h => 
      h.toLowerCase().includes('scale score') && 
      h.toLowerCase().includes('science')
    );
    
    const scaleScore = scaleScoreField ? row[scaleScoreField] : null;
    
    if (!scaleScore) {
      return null;
    }

    const score = parseFloat(String(scaleScore));
    if (isNaN(score)) {
      return null;
    }

    // Extract test date
    const testDate = this.findValue(row, headers, [
      'Date Taken', 'Test Completion Date', 'test_date', 'testdate', 'date', 'administration_date'
    ]);

    let parsedDate: Date;
    if (testDate) {
      try {
        parsedDate = new Date(testDate);
        if (isNaN(parsedDate.getTime())) {
          throw new Error('Invalid date');
        }
      } catch (error) {
        parsedDate = new Date();
      }
    } else {
      parsedDate = new Date();
    }

    // Find achievement level
    const achievementLevelField = headers.find(h => 
      h.toLowerCase().includes('achievement level') && 
      h.toLowerCase().includes('science')
    );
    
    const achievementLevel = achievementLevelField ? row[achievementLevelField] : null;
    
    // Find percentile rank - expand search patterns
    const percentileField = headers.find(h => {
      const lower = h.toLowerCase();
      return (lower.includes('percentile') || 
              lower.includes('percentile rank') ||
              lower.includes('national percentile') ||
              lower.includes('state percentile')) &&
             lower.includes('science');
    });
    
    console.log(`🔧 Science percentile field: ${percentileField}`);
    
    const percentile = percentileField ? row[percentileField] : null;

    // Extract student info
    const studentName = this.findValue(row, headers, [
      'Student Name', 'student_name', 'name'
    ]);

    let firstName: string | undefined;
    let lastName: string | undefined;
    
    if (studentName) {
      const nameParts = this.parseStudentName(String(studentName));
      firstName = nameParts.firstName;
      lastName = nameParts.lastName;
    }

    // Science typically has fewer category breakdowns than Math/ELA
    // Extract any available performance categories
    let categoryPerformances: Record<string, string> = {};
    let detailedBenchmarks: any[] = [];
    
    // Look for Science-specific performance categories
    const scienceCategories = [
      'Physical Science',
      'Earth and Space Science', 
      'Life Science',
      'Nature of Science'
    ];

    for (const category of scienceCategories) {
      const performanceField = headers.find(h => 
        h.toLowerCase().includes(category.toLowerCase()) && 
        h.toLowerCase().includes('performance')
      );
      
      if (performanceField && row[performanceField]) {
        categoryPerformances[category] = String(row[performanceField]);
      }
    }
    
    // Extract detailed benchmark data if available
    for (let i = 0; i < headers.length - 3; i += 4) {
      if (headers[i] === 'Category' && headers[i + 1] === 'Benchmark' && 
          headers[i + 2] === 'Points Earned' && headers[i + 3] === 'Points Possible') {
        const category = row[headers[i]];
        const benchmark = row[headers[i + 1]];
        const pointsEarned = row[headers[i + 2]];
        const pointsPossible = row[headers[i + 3]];
        
        if (category && benchmark && pointsEarned !== undefined && pointsPossible !== undefined) {
          detailedBenchmarks.push({
            category: String(category),
            benchmark: String(benchmark),
            pointsEarned: parseInt(String(pointsEarned)) || 0,
            pointsPossible: parseInt(String(pointsPossible)) || 0,
            percentage: pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 100) : 0
          });
        }
      }
    }

    return {
      studentId: wasabiId,
      matchedBy: matchInfo?.matchType,
      matchConfidence: matchInfo?.confidence,
      originalStudentId: originalStudentId ? String(originalStudentId) : undefined,
      source: 'FAST',
      testDate: parsedDate,
      subject: 'Science', // Science subject
      testPeriod: 'EOY', // Science is typically end-of-year only
      score,
      percentile: percentile ? parseFloat(String(percentile)) : undefined,
      gradeLevel: grade,
      proficiency: this.convertAchievementLevelToProficiency(achievementLevel),
      firstName,
      lastName,
      fullName: studentName ? String(studentName) : undefined,
      categoryPerformances,
      detailedBenchmarks,
    };
  }

  private parseStudentName(fullName: string): { firstName?: string; lastName?: string } {
    if (!fullName) return {};
    
    // Handle "Last, First" format
    if (fullName.includes(',')) {
      const parts = fullName.split(',').map(p => p.trim());
      return {
        lastName: parts[0],
        firstName: parts[1],
      };
    }
    
    // Handle "First Last" format
    const parts = fullName.split(' ').filter(p => p.trim());
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    }
    
    return { firstName: parts[0] || '' };
  }

  private convertAchievementLevelToProficiency(achievementLevel: any): string | undefined {
    if (!achievementLevel) return undefined;
    
    const level = String(achievementLevel).toLowerCase().trim();
    
    // Map FAST Science achievement levels to proficiency
    if (level.includes('level 5') || level.includes('mastery')) return 'exceeds standards';
    if (level.includes('level 4') || level.includes('proficient')) return 'meets standards';
    if (level.includes('level 3') || level.includes('approaching')) return 'approaching standards';
    if (level.includes('level 2') || level.includes('developing')) return 'below standards';
    if (level.includes('level 1') || level.includes('inadequate')) return 'below standards';
    
    return level;
  }

  private findValue(row: Record<string, any>, headers: string[], possibleKeys: string[]): any {
    for (const key of possibleKeys) {
      const exactMatch = row[key];
      if (exactMatch !== undefined && exactMatch !== null && exactMatch !== '') {
        return exactMatch;
      }
      
      const caseInsensitiveMatch = headers.find(h => 
        h.toLowerCase().trim() === key.toLowerCase().trim()
      );
      if (caseInsensitiveMatch && row[caseInsensitiveMatch] !== undefined && 
          row[caseInsensitiveMatch] !== null && row[caseInsensitiveMatch] !== '') {
        return row[caseInsensitiveMatch];
      }
    }
    return null;
  }

  async processFile(file: File, datasetId?: string): Promise<{
    totalRows: number;
    matchedRows: number;
    unmatchedRows: number;
    processedRecords: number;
    matchingReport: {
      dcpsIdMatches: number;
      flIdMatches: number;
      nameMatches: number;
      noMatches: number;
    };
    errors: string[];
  }> {
    const { records, report } = await this.processZipFile(file);
    
    // Store records in database
    const { db } = await import('../db');
    await db.assessments.bulkPut(records);
    
    return {
      totalRows: report.totalRows,
      matchedRows: report.successfulRows,
      unmatchedRows: report.totalRows - report.successfulRows,
      processedRecords: records.length,
      matchingReport: {
        dcpsIdMatches: records.filter(r => r.matchedBy === 'dcps_id').length,
        flIdMatches: records.filter(r => r.matchedBy === 'fl_id').length,
        nameMatches: records.filter(r => r.matchedBy === 'name').length,
        noMatches: report.totalRows - report.successfulRows,
      },
      errors: report.errors,
    };
  }

  async parseCSV(file: File): Promise<ParsedData> {
    throw new Error('Use processFile method for Science ZIP files');
  }
}

// Export instance
export const fastScienceZipAdapter = new FastScienceZipAdapter();