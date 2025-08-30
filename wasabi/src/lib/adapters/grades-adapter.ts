import { studentMatcher } from '../student-matcher';
import * as XLSX from 'xlsx';
import { db } from '../db';
import type { GradeRecord } from '../../shared/types';

export interface GradesUploadResult {
  totalRows: number;
  validRows: number;
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

export class GradesAdapter {
  async processFile(file: File): Promise<GradesUploadResult> {
    console.log('📚 Starting grades file processing...');
    
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[worksheetName];
    
    // Convert to JSON with headers
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,
      defval: '',
      blankrows: false
    });
    
    // Manually extract formula values if the regular parsing didn't work
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const processedData = jsonData.map((row: any, rowIndex) => {
      const newRow = { ...row };
      
      // Check if Student ID is empty, then try to get formula values
      if (!newRow['Student ID'] || newRow['Student ID'] === '') {
        // Try different possible column positions for Student ID
        const possibleColumns = ['B', 'C', 'D', 'E']; // Common positions
        for (const col of possibleColumns) {
          const cellAddress = `${col}${rowIndex + 2}`; // +2 because of header row
          const cell = worksheet[cellAddress];
          if (cell && cell.f && cell.v) {
            // Check if this looks like a student ID column by examining the header
            const headerAddress = `${col}1`;
            const headerCell = worksheet[headerAddress];
            const headerValue = headerCell?.v?.toString().toLowerCase() || '';
            
            if (headerValue.includes('student') && headerValue.includes('id')) {
              newRow['Student ID'] = cell.v.toString();
              console.log(`📝 Extracted Student ID from formula in column ${col}: ${cell.v}`);
              break;
            }
          }
        }
      }
      
      return newRow;
    });
    
    console.log(`📊 Parsed ${processedData.length} rows from grades Excel file`);
    
    const result: GradesUploadResult = {
      totalRows: processedData.length,
      validRows: 0,
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
    
    // Clear existing grades data
    await db.grades.clear();
    console.log('🗑️  Cleared existing grades data');
    
    // Process each row
    for (let rowIndex = 0; rowIndex < processedData.length; rowIndex++) {
      const row = processedData[rowIndex] as any;
      
      try {
        // Skip rows that don't have student name or course
        const studentName = row['Student'] || '';
        const courseName = row['Course'] || '';
        
        if (!studentName.trim() || !courseName.trim()) {
          continue; // Skip incomplete rows
        }
        
        result.validRows++;
        
        console.log(`👤 Processing: ${studentName} - ${courseName}`);
        
        // Try to match this student - check multiple possible column names
        const dcpsId = row['Student ID'] || row['DCPS Student ID'] || row['DCPS ID'] || row['StudentID'] || row['ID'] || '';
        const matchData = {
          Student: studentName,
          'Student Name': studentName,
          'Student ID': dcpsId,
          'DCPS Student ID': dcpsId
        };
        
        console.log(`🔍 Matching data for ${studentName}:`, { dcpsId, studentName });
        
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
          
          // Process grade data for this course
          const gradeRecord = this.createGradeRecord(
            match.wasabiId,
            row,
            studentName,
            dcpsId
          );
          
          if (gradeRecord) {
            // Save grade record
            await db.grades.add(gradeRecord);
            result.processedRecords++;
            console.log(`  📝 Added grade record for ${courseName}`);
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
    
    console.log('📊 Grades processing complete:', result);
    return result;
  }
  
  private createGradeRecord(
    wasabiId: string,
    row: any,
    originalStudentName: string,
    originalStudentId: string
  ): GradeRecord | null {
    const courseName = row['Course'];
    const teacher = row['Teacher'] || '';
    const gradeLevel = row['Grade Level'] || '';
    
    if (!courseName || !courseName.trim()) {
      return null;
    }
    
    // Extract grade periods
    const grades = this.extractGradePeriods(row);
    
    const gradeRecord: GradeRecord = {
      studentId: wasabiId,
      studentName: originalStudentName,
      course: courseName.trim(),
      gradeLevel: gradeLevel.trim(),
      teacher: teacher.trim(),
      grades,
      matchedBy: 'name', // Will be set by the matcher
      matchConfidence: 100, // Will be set by the matcher
      originalStudentId: originalStudentId,
      // Store additional metadata
      period: row['Period'] || '',
      section: row['Section'] || '',
      courseNumber: row['Course Num'] || '',
      fullYearGrade: row['Full Year'] || '',
      finalGrade: row['Final Grade'] || ''
    };
    
    return gradeRecord;
  }
  
  private extractGradePeriods(row: any) {
    const grades = [];
    
    // Map the grade periods based on the actual column names
    const gradePeriodMappings = [
      { period: 'PP1', column: 'Progress Period 1' },
      { period: 'Q1', column: 'Quarter 1 (Gradebook)' },
      { period: 'PP2', column: 'Progress Period 2' },
      { period: 'Q2', column: 'Quarter 2 (Gradebook)' },
      { period: 'PP3', column: 'Progress Period 3' },
      { period: 'Q3', column: 'Quarter 3 (Gradebook)' },
      { period: 'PP4', column: 'Progress Period 4' },
      { period: 'Q4', column: 'Quarter 4 (Gradebook)' }
    ];
    
    for (const mapping of gradePeriodMappings) {
      const gradeValue = row[mapping.column];
      if (gradeValue && gradeValue.toString().trim()) {
        grades.push({
          period: mapping.period,
          grade: this.normalizeGrade(gradeValue.toString().trim())
        });
      }
    }
    
    // Add full year and final grades if available
    if (row['Full Year']) {
      grades.push({
        period: 'Full Year',
        grade: this.normalizeGrade(row['Full Year'].toString().trim())
      });
    }
    
    if (row['Final Grade']) {
      grades.push({
        period: 'Final',
        grade: this.normalizeGrade(row['Final Grade'].toString().trim())
      });
    }
    
    return grades;
  }
  
  private normalizeGrade(gradeStr: string): string {
    if (!gradeStr) return '';
    
    // Handle grades like "80 S", "96 E", etc.
    // Extract the numeric part and letter grade
    const match = gradeStr.match(/^(\d+)\s*([A-Z]?)$/);
    if (match) {
      const numeric = match[1];
      const letter = match[2];
      
      // Convert numeric to letter grade if needed
      if (!letter) {
        return this.convertNumericToLetterGrade(parseInt(numeric));
      }
      
      return `${numeric} (${letter})`;
    }
    
    // Handle pure letter grades
    if (/^[A-F][+-]?$/.test(gradeStr)) {
      return gradeStr;
    }
    
    // Handle pure numeric grades
    if (/^\d+$/.test(gradeStr)) {
      return this.convertNumericToLetterGrade(parseInt(gradeStr));
    }
    
    // Return as-is for other formats
    return gradeStr;
  }
  
  private convertNumericToLetterGrade(numeric: number): string {
    if (numeric >= 90) return `${numeric} (A)`;
    if (numeric >= 80) return `${numeric} (B)`;
    if (numeric >= 70) return `${numeric} (C)`;
    if (numeric >= 60) return `${numeric} (D)`;
    return `${numeric} (F)`;
  }
}

export const gradesAdapter = new GradesAdapter();