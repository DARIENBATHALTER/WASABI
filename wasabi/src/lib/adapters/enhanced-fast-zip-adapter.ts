import type { DataAdapter, ParsedData, ValidationResult } from './base';
import type { AssessmentRecord, MatchingReport } from '../../shared/types';
import { EnhancedFASTAdapter } from './enhanced-fast-adapter';
import JSZip from 'jszip';

export class EnhancedFastZipAdapter implements DataAdapter {
  name = 'FAST Assessment ZIP File (Enhanced)';
  type = 'fast-zip-enhanced' as const;

  private enhancedAdapter = new EnhancedFASTAdapter();

  validateData(data: ParsedData): ValidationResult {
    // ZIP files are validated during processing
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
    throw new Error('Use processFile method for ZIP files');
  }

  async processFile(file: File, testPeriod: string): Promise<{
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
    console.log(`🎯 Starting enhanced ZIP processing for ${file.name} (${testPeriod})`);
    
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    
    let totalProcessedRecords = 0;
    let totalMatchedRows = 0;
    let totalUnmatchedRows = 0;
    const allErrors: string[] = [];
    
    // Extract and process each CSV file in the ZIP
    for (const fileName in zipContent.files) {
      const fileEntry = zipContent.files[fileName];
      
      if (fileEntry.dir || !fileName.toLowerCase().endsWith('.csv')) {
        continue;
      }

      try {
        console.log(`📄 Processing CSV file: ${fileName}`);
        
        // Extract the CSV content as text
        const csvText = await fileEntry.async('text');
        
        // Create a File-like object from the CSV content
        const csvFile = new File([csvText], fileName, { type: 'text/csv' });
        
        // Extract subject and grade from filename
        const { subject, grade } = this.extractSubjectAndGrade(fileName);
        
        console.log(`🎯 Detected: ${subject} Grade ${grade} from ${fileName}`);
        
        // Process using the enhanced FAST adapter
        const result = await this.enhancedAdapter.processFile(csvFile, subject, grade, testPeriod);
        
        console.log(`✅ Enhanced FAST adapter processed ${result.processedRecords} records from ${fileName}`);
        
        // Accumulate statistics
        totalProcessedRecords += result.processedRecords;
        totalMatchedRows += result.matchedRows;
        totalUnmatchedRows += result.unmatchedRows;
        allErrors.push(...result.errors);
        
      } catch (error) {
        const errorMsg = `Error processing ${fileName}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        allErrors.push(errorMsg);
      }
    }

    // Create consolidated matching report
    const matchingReport: MatchingReport = {
      datasetType: this.type,
      datasetName: `${this.name} - ${testPeriod}`,
      uploadDate: new Date(),
      totalRows: totalProcessedRecords + totalUnmatchedRows,
      matchedRows: totalMatchedRows,
      unmatchedRows: totalUnmatchedRows,
      details: []
    };

    console.log(`🎯 Enhanced ZIP processing complete:`, {
      totalProcessedRecords,
      totalMatchedRows,
      totalUnmatchedRows,
      errors: allErrors.length
    });

    // Return the interface expected by the upload UI
    return {
      totalRows: totalProcessedRecords + totalUnmatchedRows,
      matchedRows: totalMatchedRows,
      unmatchedRows: totalUnmatchedRows,
      processedRecords: totalProcessedRecords,
      matchingReport: {
        dcpsIdMatches: 0, // Enhanced adapter doesn't break down by match type
        flIdMatches: totalMatchedRows, // Most FAST matches are by FL ID
        nameMatches: 0,
        noMatches: totalUnmatchedRows
      },
      errors: allErrors
    };
  }

  private extractSubjectAndGrade(filename: string): { 
    subject: 'ELA' | 'Math' | 'Science' | 'Writing', 
    grade: string 
  } {
    const lower = filename.toLowerCase();
    
    // Extract subject from filename
    let subject: 'ELA' | 'Math' | 'Science' | 'Writing' = 'ELA';
    if (lower.includes('math')) {
      subject = 'Math';
    } else if (lower.includes('science')) {
      subject = 'Science';
    } else if (lower.includes('writing')) {
      subject = 'Writing';
    } else if (lower.includes('ela') || lower.includes('reading') || lower.includes('literacy')) {
      subject = 'ELA';
    }
    
    // Extract grade from filename using multiple patterns
    let grade = '3'; // default
    
    // Pattern 1: "GradeK", "Grade1", etc.
    const gradeMatch1 = filename.match(/grade([k\d]+)/i);
    if (gradeMatch1) {
      grade = gradeMatch1[1].toLowerCase() === 'k' ? 'K' : gradeMatch1[1];
    }
    
    // Pattern 2: "Grade K", "Grade 1", etc. (with space)
    const gradeMatch2 = filename.match(/grade\s+([k\d]+)/i);
    if (gradeMatch2) {
      grade = gradeMatch2[1].toLowerCase() === 'k' ? 'K' : gradeMatch2[1];
    }
    
    // Ensure grade is properly formatted
    if (grade.toLowerCase() === 'k' || grade === '0') {
      grade = 'K';
    } else {
      // Ensure it's a single digit for consistency
      grade = grade.replace(/^0+/, '') || '1';
    }
    
    console.log(`📝 Filename parsing: "${filename}" → Subject: ${subject}, Grade: ${grade}`);
    return { subject, grade };
  }

  // Standard adapter methods (delegated to enhanced adapter for consistency)
  async parseCSV(file: File): Promise<ParsedData> {
    // For ZIP files, this won't be used directly
    return {
      headers: [],
      rows: []
    };
  }

  getColumnMappings() {
    // Return basic column mappings for ZIP file processing
    return [
      { csvColumn: 'Student Name', dbField: 'studentName', required: true },
      { csvColumn: 'Student ID', dbField: 'studentId', required: true },
      { csvColumn: 'Date Taken', dbField: 'testDate', required: true },
    ];
  }
}