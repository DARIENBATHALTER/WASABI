import type { DataAdapter, ParsedData, ValidationResult } from './base';
import type { AssessmentRecord, MatchingReport } from '../../shared/types';
import { studentMatcher } from '../student-matcher';
import { db } from '../db';
import JSZip from 'jszip';
import Papa from 'papaparse';

export class FastZipAdapter implements DataAdapter {
  name = 'FAST Assessment ZIP File';
  type = 'fast-zip' as const;

  validateData(data: ParsedData): ValidationResult {
    // This adapter handles ZIP files differently
    // Validation will be done on extracted CSV files
    return {
      isValid: true,
      errors: [],
      warnings: [],
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
    throw new Error('Use processZipFile method for ZIP files');
  }

  async processZipFile(file: File, testPeriod: 'PM1' | 'PM2' | 'PM3'): Promise<{
    data: AssessmentRecord[];
    matchingReport: MatchingReport;
  }> {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    const allRecords: AssessmentRecord[] = [];
    const matchingReports: MatchingReport[] = [];

    // Extract all CSV files from ZIP
    for (const fileName in zipContent.files) {
      const fileEntry = zipContent.files[fileName];
      
      if (fileEntry.dir || !fileName.toLowerCase().endsWith('.csv')) {
        continue;
      }

      try {
        const csvContent = await fileEntry.async('string');
        const subject = this.detectSubjectFromFileName(fileName);
        
        if (subject) {
          const { records, report } = await this.processCsvContent(csvContent, subject, testPeriod, fileName);
          allRecords.push(...records);
          matchingReports.push(report);
        }
      } catch (error) {
        console.warn(`Error processing file ${fileName}:`, error);
      }
    }

    // Combine matching reports
    const combinedReport: MatchingReport = {
      datasetType: this.type,
      datasetName: this.name,
      uploadDate: new Date(),
      totalRows: matchingReports.reduce((sum, report) => sum + report.totalRows, 0),
      matchedRows: matchingReports.reduce((sum, report) => sum + report.matchedRows, 0),
      unmatchedRows: matchingReports.reduce((sum, report) => sum + report.unmatchedRows, 0),
      details: matchingReports.flatMap(report => report.details || []),
    };

    return {
      data: allRecords,
      matchingReport: combinedReport,
    };
  }

  private detectSubjectFromFileName(fileName: string): 'Math' | 'ELA' | null {
    const lowerFileName = fileName.toLowerCase();
    
    if (lowerFileName.includes('mathematics') || lowerFileName.includes('math')) {
      return 'Math';
    }
    
    if (lowerFileName.includes('ela') || lowerFileName.includes('reading')) {
      return 'ELA';
    }
    
    return null;
  }

  private async processCsvContent(
    csvContent: string,
    subject: 'Math' | 'ELA',
    testPeriod: 'PM1' | 'PM2' | 'PM3',
    fileName: string
  ): Promise<{
    records: AssessmentRecord[];
    report: MatchingReport;
  }> {
    // Parse CSV content
    const parseResult = await this.parseCSVString(csvContent);
    
    // Match students using new student-matcher
    const records: AssessmentRecord[] = [];
    let matchedCount = 0;
    let dcpsIdMatches = 0;
    let flIdMatches = 0;
    let nameMatches = 0;
    
    for (const row of parseResult.rows) {
      try {
        const match = await studentMatcher.matchStudent(row);
        if (match) {
          // Add match info to row
          const matchedRow = {
            ...row,
            wasabiId: match.wasabiId,
            matchInfo: match
          };
          
          const record = this.transformFastRecord(matchedRow, parseResult.headers, subject, testPeriod);
          if (record) {
            records.push(record);
            matchedCount++;
            
            // Count match types
            if (match.matchType === 'dcps_id') dcpsIdMatches++;
            else if (match.matchType === 'fl_id') flIdMatches++;
            else if (match.matchType === 'name') nameMatches++;
          }
        }
      } catch (error) {
        console.warn(`Error processing FAST ${subject} record:`, error);
      }
    }

    const report: MatchingReport = {
      datasetType: this.type,
      datasetName: `${this.name} - ${subject} ${testPeriod}`,
      uploadDate: new Date(),
      totalRows: parseResult.rows.length,
      matchedRows: matchedCount,
      unmatchedRows: parseResult.rows.length - matchedCount,
      details: []
    };

    return { records, report };
  }

  private async parseCSVString(csvContent: string): Promise<ParsedData> {
    return new Promise((resolve, reject) => {
      Papa.parse(csvContent, {
        header: false,
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
          
          // Find the header row
          let headerRowIndex = -1;
          let headers: string[] = [];
          
          for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            const hasStudentId = row.some(cell => cell && cell.toLowerCase().includes('student id'));
            const hasScore = row.some(cell => cell && 
              (cell.toLowerCase().includes('scale score') || 
               cell.toLowerCase().includes('equivalent score')));
               
            if (hasStudentId && hasScore) {
              headerRowIndex = i;
              headers = row.map(h => String(h).trim().replace(/^"?="?/, '').replace(/"?$/, ''));
              break;
            }
          }
          
          if (headerRowIndex === -1) {
            reject(new Error('Could not find header row with Student ID and Scale Score/Equivalent Score'));
            return;
          }
          
          // Convert remaining rows to objects
          const dataRows: Record<string, any>[] = [];
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length === 0 || row.every(cell => !cell || cell.trim() === '')) {
              continue;
            }
            
            const dataRow: Record<string, any> = {};
            for (let j = 0; j < headers.length && j < row.length; j++) {
              if (headers[j]) {
                let cellValue = row[j];
                if (typeof cellValue === 'string') {
                  cellValue = cellValue.replace(/^"?="?/, '').replace(/"?$/, '');
                }
                dataRow[headers[j]] = cellValue;
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

  private transformFastRecord(
    row: Record<string, any>,
    headers: string[],
    subject: 'Math' | 'ELA',
    testPeriod: 'PM1' | 'PM2' | 'PM3'
  ): AssessmentRecord | null {
    const wasabiId = row.wasabiId;
    const originalStudentId = this.findValue(row, headers, [
      'Student ID', 'student_id', 'studentid', 'student number', 'fleid', 'student_number'
    ]);

    if (!wasabiId) {
      return null;
    }

    const matchInfo = row.matchInfo;
    
    // Find scale score field that matches the subject (handle both "Scale Score" and "FAST Equivalent Score")
    const scaleScoreField = headers.find(h => 
      (h.toLowerCase().includes('scale score') || h.toLowerCase().includes('equivalent score')) && 
      (subject === 'Math' ? 
        h.toLowerCase().includes('math') : 
        h.toLowerCase().includes('ela') || h.toLowerCase().includes('reading'))
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

    // Find achievement level field
    const achievementLevelField = headers.find(h => 
      h.toLowerCase().includes('achievement level') && 
      (subject === 'Math' ? 
        h.toLowerCase().includes('math') : 
        h.toLowerCase().includes('ela') || h.toLowerCase().includes('reading'))
    );
    
    const achievementLevel = achievementLevelField ? row[achievementLevelField] : null;
    
    // Find percentile rank field
    const percentileField = headers.find(h => 
      h.toLowerCase().includes('percentile rank') && 
      (subject === 'Math' ? 
        h.toLowerCase().includes('math') : 
        h.toLowerCase().includes('ela') || h.toLowerCase().includes('reading'))
    );
    
    const percentile = percentileField ? row[percentileField] : null;

    // Extract other fields
    const gradeLevel = this.findValue(row, headers, [
      'Enrolled Grade', 'grade_level', 'gradelevel', 'grade', 'test_grade'
    ]);

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

    // Extract performance category scores for Math
    let categoryPerformances: Record<string, string> = {};
    let detailedBenchmarks: any[] = [];
    
    if (subject === 'Math') {
      // Use exact header names from CSV
      categoryPerformances['Number Sense and Additive Reasoning'] = 
        this.findExactValue(row, headers, '1. Number Sense and Additive Reasoning Performance');
      categoryPerformances['Number Sense and Multiplicative Reasoning'] = 
        this.findExactValue(row, headers, '2. Number Sense and Multiplicative Reasoning Performance');
      categoryPerformances['Fractional Reasoning'] = 
        this.findExactValue(row, headers, '3. Fractional Reasoning Performance');
      categoryPerformances['Geometric Reasoning, Measurement, and Data Analysis'] = 
        this.findExactValue(row, headers, '4. Geometric Reasoning, Measurement, and Data Analysis and Probability Performance');
    } else if (subject === 'ELA') {
      // Use exact header names from CSV
      categoryPerformances['Reading Prose and Poetry'] = 
        this.findExactValue(row, headers, '1. Reading Prose and Poetry Performance');
      categoryPerformances['Reading Informational Text'] = 
        this.findExactValue(row, headers, '2. Reading Informational Text Performance');
      categoryPerformances['Reading Across Genres & Vocabulary'] = 
        this.findExactValue(row, headers, '3. Reading Across Genres & Vocabulary Performance');
    }
    
    // Extract detailed benchmark data (Category, Benchmark, Points Earned, Points Possible pattern)
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
      subject: subject,
      testPeriod, // Add test period to the record
      score,
      percentile: percentile ? parseFloat(String(percentile)) : undefined,
      gradeLevel: gradeLevel ? String(gradeLevel) : undefined,
      proficiency: this.convertAchievementLevelToProficiency(achievementLevel),
      firstName,
      lastName,
      fullName: studentName ? String(studentName) : undefined,
      // Add category performances
      categoryPerformances,
      // Add detailed benchmark data
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
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
      };
    }
    
    // Single name - assume it's first name
    return {
      firstName: parts[0],
    };
  }

  private convertAchievementLevelToProficiency(level: any): 'below' | 'approaching' | 'meets' | 'exceeds' | undefined {
    if (!level) return undefined;
    
    const levelStr = String(level).toLowerCase();
    
    if (levelStr.includes('1') || levelStr.includes('inadequate') || levelStr.includes('below')) {
      return 'below';
    } else if (levelStr.includes('2') || levelStr.includes('developing') || levelStr.includes('approaching')) {
      return 'approaching';
    } else if (levelStr.includes('3') || levelStr.includes('satisfactory') || levelStr.includes('meets')) {
      return 'meets';
    } else if (levelStr.includes('4') || levelStr.includes('5') || levelStr.includes('proficient') || levelStr.includes('exceeds')) {
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

  private findExactValue(row: Record<string, any>, headers: string[], exactKey: string): any {
    // Try exact match first
    if (row[exactKey] !== undefined && row[exactKey] !== null && row[exactKey] !== '') {
      return row[exactKey];
    }
    
    // Try to find the header in the headers array (case-insensitive)
    const foundHeader = headers.find(h => h.toLowerCase().trim() === exactKey.toLowerCase().trim());
    if (foundHeader && row[foundHeader] !== undefined && row[foundHeader] !== null && row[foundHeader] !== '') {
      return row[foundHeader];
    }
    
    return null;
  }

  async parseCSV(file: File): Promise<ParsedData> {
    throw new Error('Use processZipFile method for ZIP files');
  }

  // Method compatible with existing upload system
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
    // Extract test period from dataset ID
    let testPeriod: 'PM1' | 'PM2' | 'PM3' = 'PM1';
    if (datasetId?.includes('pm2')) testPeriod = 'PM2';
    else if (datasetId?.includes('pm3')) testPeriod = 'PM3';
    
    const { data, matchingReport } = await this.processZipFile(file, testPeriod);
    
    // Store records in database
    await db.assessments.bulkPut(data);
    
    return {
      totalRows: matchingReport.totalRows,
      matchedRows: matchingReport.matchedRows,
      unmatchedRows: matchingReport.unmatchedRows,
      processedRecords: data.length,
      matchingReport: {
        dcpsIdMatches: data.filter(d => d.matchedBy === 'dcps_id').length,
        flIdMatches: data.filter(d => d.matchedBy === 'fl_id').length,
        nameMatches: data.filter(d => d.matchedBy === 'name').length,
        noMatches: matchingReport.unmatchedRows,
      },
      errors: [],
    };
  }
}