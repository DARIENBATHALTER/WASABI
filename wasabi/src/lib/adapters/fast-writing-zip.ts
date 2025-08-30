import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { studentMatcher } from '../student-matcher';
import type { DataAdapter, ParsedData, AssessmentRecord, ImportReport } from '../types';

export interface FastWritingZipAdapter extends DataAdapter {
  processZipFile(file: File): Promise<{ records: AssessmentRecord[]; report: ImportReport }>;
}

export class FastWritingZipAdapter implements FastWritingZipAdapter {
  name = 'FAST Writing ZIP';
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
        summary: `Processed ${records.length} FAST Writing assessment records`
      };

      return { records, report };
    } catch (error) {
      throw new Error(`Failed to process FAST Writing ZIP file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async processExcelData(jsonData: any[][], filename: string): Promise<{ records: AssessmentRecord[]; report: ImportReport }> {
    const records: AssessmentRecord[] = [];
    let totalRows = 0;
    let successfulRows = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Find the header row (look for Student ID and Scale Score/Writing score)
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
         String(cell).toLowerCase().includes('writing score') ||
         String(cell).toLowerCase().includes('total score') ||
         String(cell).toLowerCase().includes('b.e.s.t') ||
         String(cell).toLowerCase().includes('best') ||
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

    // Debug: Log the headers we found
    console.log('📋 Found headers in Writing file:', headers);
    
    // Process data rows
    const dataRows = jsonData.slice(headerRowIndex + 1);
    console.log(`📊 Processing ${dataRows.length} data rows from ${filename}`);
    
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

        // Extract grade from filename
        const gradeMatch = filename.match(/Grade(\d+)/i);
        const grade = gradeMatch ? gradeMatch[1] : '4'; // Default to 4th grade

        // Only process 4th and 5th grade Writing
        if (grade !== '4' && grade !== '5') {
          continue;
        }

        // Debug: Log what we're trying to match
        const studentIdField = this.findValue(rowObject, headers, [
          'Florida Education Identifier', 'FLEID', 'FL ID', 'FL_ID', 'fleid', 
          'Student ID', 'student_id', 'studentid', 'student number', 'student_number'
        ]);
        const studentNameField = this.findValue(rowObject, headers, [
          'Student', 'Student Name', 'Name', 'Full Name'
        ]);
        
        if (i === 0) {
          console.log('🔍 First student data for matching:', {
            studentId: studentIdField,
            studentName: studentNameField,
            grade: grade,
            allFields: rowObject
          });
        }
        
        // Debug FL ID extraction for all rows
        console.log(`🔍 Row ${i + 1}: Processing "${studentNameField}" with FL ID "${studentIdField}"`)
        
        // Try to match the student
        const match = await studentMatcher.matchStudent(rowObject);
        
        if (match) {
          rowObject.wasabiId = match.wasabiId;
          rowObject.matchInfo = {
            matchType: match.matchType,
            confidence: match.confidence
          };
          console.log(`✅ Row ${i + 1}: MATCHED ${studentIdField} via ${match.matchType} with ${match.confidence}% confidence`);
        } else {
          console.log(`❌ Row ${i + 1}: NO MATCH for "${studentNameField}" (${studentIdField})`);
        }

        // Transform to assessment record
        const record = this.transformWritingRecord(rowObject, headers, grade);
        
        if (record) {
          records.push(record);
          successfulRows++;
          console.log(`📝 Row ${i + 1}: Successfully created assessment record`);
        } else {
          console.log(`❌ Row ${i + 1}: Failed to create assessment record - check transformWritingRecord`);
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

  private transformWritingRecord(
    row: Record<string, any>,
    headers: string[],
    grade: string
  ): AssessmentRecord | null {
    const wasabiId = row.wasabiId;
    console.log(`🔧 transformWritingRecord: wasabiId=${wasabiId}, grade=${grade}`);
    console.log(`🔧 Available headers:`, headers);
    const originalStudentId = this.findValue(row, headers, [
      'Florida Education Identifier', 'FLEID', 'FL ID', 'FL_ID', 'fleid', 
      'Student ID', 'student_id', 'studentid', 'student number', 'student_number'
    ]);

    if (!wasabiId) {
      return null;
    }

    const matchInfo = row.matchInfo;
    
    // Find B.E.S.T. Writing Raw Score using exact header names
    const exactScoreHeaders = {
      '4': 'Grade 4 B.E.S.T. Writing Raw Score',
      '5': 'Grade 5 B.E.S.T. Writing Raw Score'
    };
    
    const expectedScoreHeader = exactScoreHeaders[grade as '4' | '5'];
    let scaleScoreField = expectedScoreHeader && headers.includes(expectedScoreHeader) ? expectedScoreHeader : null;
    
    // Fallback to pattern matching if exact header not found
    if (!scaleScoreField) {
      scaleScoreField = headers.find(h => {
        const lower = h.toLowerCase();
        return lower.includes('b.e.s.t. writing raw score') || 
               (lower.includes('writing') && lower.includes('raw score')) ||
               lower.includes('scale score') || 
               lower.includes('total score') || 
               lower.includes('writing score');
      });
    }
    
    console.log(`🔧 Looking for score field. Found: ${scaleScoreField}`);
    console.log(`🔧 All headers with 'score' or 'raw':`, headers.filter(h => 
      h.toLowerCase().includes('score') || h.toLowerCase().includes('raw')
    ));
    const scaleScore = scaleScoreField ? row[scaleScoreField] : null;
    console.log(`🔧 Score value: ${scaleScore}`);
    
    if (!scaleScore) {
      console.log(`❌ No score found - returning null`);
      return null;
    }

    // Handle fractional scores like "6/12"
    let score: number;
    const scoreStr = String(scaleScore).trim();
    if (scoreStr.includes('/')) {
      const [numerator, denominator] = scoreStr.split('/').map(s => parseFloat(s.trim()));
      if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
        // Convert fraction to percentage or scale score
        score = (numerator / denominator) * 4; // Convert to 4-point scale commonly used
      } else {
        console.log(`❌ Invalid fraction format: ${scoreStr}`);
        return null;
      }
    } else {
      score = parseFloat(scoreStr);
      if (isNaN(score)) {
        console.log(`❌ Invalid score format: ${scoreStr}`);
        return null;
      }
    }
    
    console.log(`🔧 Processed score: ${scoreStr} → ${score}`);

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

    // Find achievement level - expand search patterns
    const achievementLevelField = headers.find(h => {
      const lower = h.toLowerCase();
      return lower.includes('achievement level') || 
             lower.includes('performance level') ||
             lower.includes('proficiency level') ||
             (lower.includes('level') && (lower.includes('writing') || lower.includes('b.e.s.t')));
    });
    
    console.log(`🔧 Achievement level field: ${achievementLevelField}`);
    let achievementLevel = achievementLevelField ? row[achievementLevelField] : null;
    console.log(`🔧 Achievement level value: ${achievementLevel}`);
    
    // If no explicit achievement level, derive from score
    if (!achievementLevel && score) {
      if (score >= 3.5) achievementLevel = 'Proficient';
      else if (score >= 2.5) achievementLevel = 'Approaching';
      else if (score >= 1.5) achievementLevel = 'Developing'; 
      else achievementLevel = 'Beginning';
      console.log(`🔧 Derived achievement level from score ${score}: ${achievementLevel}`);
    }
    
    // Find percentile rank - expand search patterns
    const percentileField = headers.find(h => {
      const lower = h.toLowerCase();
      return lower.includes('percentile') || 
             lower.includes('percentile rank') ||
             lower.includes('national percentile') ||
             lower.includes('state percentile');
    });
    
    console.log(`🔧 Percentile field: ${percentileField}`);
    const percentile = percentileField ? row[percentileField] : null;
    console.log(`🔧 Percentile value: ${percentile}`);
    
    if (!percentile) {
      console.log(`ℹ️ No percentile data available in this Writing file format`);
    }

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

    // Writing performance categories
    let categoryPerformances: Record<string, string> = {};
    let detailedBenchmarks: any[] = [];
    
    // Look for B.E.S.T. Writing Mode subdimensions specifically
    // Expected patterns:
    // - "Writing Mode: Opinion/Argumentative: 1. Purpose/Structure"
    // - "Writing Mode: Opinion/Argumentative: 2. Development" 
    // - "Writing Mode: Opinion/Argumentative: 3. Language"
    
    console.log(`📝 DEBUG: All headers for Writing Mode search:`, headers);
    
    const writingModeFields = headers.filter(h => {
      const lower = h.toLowerCase();
      return lower.includes('writing mode') || 
             (lower.includes('writing') && lower.includes('opinion')) ||
             (lower.includes('writing') && lower.includes('argumentative'));
    });
    
    console.log(`📝 Found Writing Mode fields:`, writingModeFields);
    
    // Extract Writing Mode data using EXACT header names
    console.log(`📝 DEBUG: Searching through ${headers.length} headers for Writing Mode data`);
    console.log(`📝 DEBUG: Grade = ${grade}`);
    
    // Define exact header patterns for each grade and writing mode
    const exactHeaders = {
      '4': {
        purposeStructure: 'Writing Mode: Opinion/Argumentative: 1. Purpose/Structure',
        development: 'Writing Mode: Opinion/Argumentative: 2. Development', 
        language: 'Writing Mode: Opinion/Argumentative: 3. Language'
      },
      '5': {
        purposeStructure: 'Writing Mode: Informative/Explanatory: 1. Purpose/Structure',
        development: 'Writing Mode: Informative/Explanatory: 2. Development',
        language: 'Writing Mode: Informative/Explanatory: 3. Language'
      }
    };

    const gradeHeaders = exactHeaders[grade as '4' | '5'];
    if (gradeHeaders) {
      console.log(`📝 Looking for exact headers for Grade ${grade}:`, gradeHeaders);
      
      // Check for exact matches first
      if (headers.includes(gradeHeaders.purposeStructure)) {
        const value = row[gradeHeaders.purposeStructure];
        if (value !== undefined && value !== '' && value !== null && String(value).trim() !== 'N/A') {
          categoryPerformances['Purpose/Structure'] = String(value);
          console.log(`✅ PURPOSE/STRUCTURE found: "${gradeHeaders.purposeStructure}" = ${value}`);
        }
      }
      
      if (headers.includes(gradeHeaders.development)) {
        const value = row[gradeHeaders.development];
        if (value !== undefined && value !== '' && value !== null && String(value).trim() !== 'N/A') {
          categoryPerformances['Development'] = String(value);
          console.log(`✅ DEVELOPMENT found: "${gradeHeaders.development}" = ${value}`);
        }
      }
      
      if (headers.includes(gradeHeaders.language)) {
        const value = row[gradeHeaders.language];
        if (value !== undefined && value !== '' && value !== null && String(value).trim() !== 'N/A') {
          categoryPerformances['Language'] = String(value);
          console.log(`✅ LANGUAGE found: "${gradeHeaders.language}" = ${value}`);
        }
      }
    }

    // Fallback: search for similar patterns if exact match fails
    if (Object.keys(categoryPerformances).length === 0) {
      console.log(`⚠️ No exact matches found, searching with fallback patterns...`);
      
      headers.forEach((field, index) => {
        const lower = field.toLowerCase();
        const value = row[field];
        
        console.log(`📝 DEBUG Header ${index}: "${field}" = "${value}"`);
        
        if (value !== undefined && value !== '' && value !== null && String(value).trim() !== 'N/A') {
          // Fallback patterns
          if ((lower.includes('writing mode') && lower.includes('1.') && lower.includes('purpose')) ||
              (lower.includes('purpose') && lower.includes('structure'))) {
            categoryPerformances['Purpose/Structure'] = String(value);
            console.log(`✅ PURPOSE/STRUCTURE (fallback) found in "${field}": ${value}`);
          }
          else if ((lower.includes('writing mode') && lower.includes('2.') && lower.includes('development')) ||
                   lower.includes('development')) {
            categoryPerformances['Development'] = String(value);
            console.log(`✅ DEVELOPMENT (fallback) found in "${field}": ${value}`);
          }
          else if ((lower.includes('writing mode') && lower.includes('3.') && lower.includes('language')) ||
                   (lower.includes('language') && !lower.includes('english'))) {
            categoryPerformances['Language'] = String(value);
            console.log(`✅ LANGUAGE (fallback) found in "${field}": ${value}`);
          }
        }
      });
    }

    console.log(`📝 Final categoryPerformances extracted:`, categoryPerformances);
    
    // Also check for other writing dimensions not in "Writing Mode" format
    const otherDimensions = ['Conventions', 'Organization', 'Evidence and Elaboration'];
    otherDimensions.forEach(dimension => {
      const field = headers.find(h => 
        h.toLowerCase().includes(dimension.toLowerCase()) && 
        !h.toLowerCase().includes('benchmark')
      );
      if (field && row[field]) {
        categoryPerformances[dimension] = String(row[field]);
        console.log(`📝 ${dimension}: ${row[field]}`);
      }
    });
    
    // Extract benchmark data - look for Benchmark, Points Earned, Points Possible columns
    const benchmarkField = headers.find(h => h === 'Benchmark' || h.toLowerCase() === 'benchmark');
    const pointsEarnedField = headers.find(h => h === 'Points Earned' || h.toLowerCase().includes('points earned'));
    const pointsPossibleField = headers.find(h => h === 'Points Possible' || h.toLowerCase().includes('points possible'));
    
    if (benchmarkField && pointsEarnedField && pointsPossibleField) {
      const benchmark = row[benchmarkField];
      const pointsEarned = row[pointsEarnedField];
      const pointsPossible = row[pointsPossibleField];
      
      if (benchmark && pointsEarned !== undefined && pointsPossible !== undefined) {
        const earned = parseFloat(String(pointsEarned)) || 0;
        const possible = parseFloat(String(pointsPossible)) || 0;
        
        detailedBenchmarks.push({
          category: 'Writing',
          benchmark: String(benchmark),
          pointsEarned: earned,
          pointsPossible: possible,
          percentage: possible > 0 ? Math.round((earned / possible) * 100) : 0
        });
        
        console.log(`📊 Benchmark: ${benchmark}, Points: ${earned}/${possible}`);
      }
    }
    
    // Also check for repeated benchmark patterns (Category, Benchmark, Points Earned, Points Possible)
    for (let i = 0; i < headers.length - 3; i++) {
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
            pointsEarned: parseFloat(String(pointsEarned)) || 0,
            pointsPossible: parseFloat(String(pointsPossible)) || 0,
            percentage: pointsPossible > 0 ? Math.round((pointsEarned / pointsPossible) * 100) : 0
          });
        }
        i += 3; // Skip the next 3 columns we just processed
      }
    }

    // Final debug output
    console.log(`📝 FINAL categoryPerformances extracted:`, categoryPerformances);
    console.log(`📊 FINAL detailedBenchmarks extracted:`, detailedBenchmarks);
    
    // Create the assessment record
    const assessmentRecord = {
      studentId: wasabiId,
      matchedBy: matchInfo?.matchType,
      matchConfidence: matchInfo?.confidence,
      originalStudentId: originalStudentId ? String(originalStudentId) : undefined,
      source: 'FAST',
      testDate: parsedDate,
      subject: 'Writing', // Writing subject
      testPeriod: 'EOY', // Writing is typically end-of-year only
      score,
      percentile: percentile ? parseFloat(String(percentile)) : undefined,
      gradeLevel: grade,
      proficiency: this.convertAchievementLevelToProficiency(achievementLevel),
      firstName,
      lastName,
      fullName: studentName ? String(studentName) : undefined,
      categoryPerformances: Object.keys(categoryPerformances).length > 0 ? categoryPerformances : undefined,
      detailedBenchmarks: detailedBenchmarks.length > 0 ? detailedBenchmarks : undefined,
    };
    
    console.log(`📝 FINAL ASSESSMENT RECORD for ${wasabiId}:`, assessmentRecord);
    
    return assessmentRecord;
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
    
    // Map FAST Writing achievement levels to proficiency
    if (level.includes('level 5') || level.includes('mastery') || level.includes('exceeds')) return 'exceeds standards';
    if (level.includes('level 4') || level.includes('proficient') || level.includes('meets')) return 'meets standards';
    if (level.includes('level 3') || level.includes('approaching')) return 'approaching standards';
    if (level.includes('level 2') || level.includes('developing') || level.includes('below')) return 'below standards';
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
    throw new Error('Use processFile method for Writing ZIP files');
  }
}

// Export instance
export const fastWritingZipAdapter = new FastWritingZipAdapter();