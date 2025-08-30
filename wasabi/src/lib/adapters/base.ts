import type { ParsedData, ValidationResult, MatchingReport } from '../../shared/types';

export interface DataSourceAdapter<T = any> {
  name: string;
  description: string;
  
  // Parse CSV file into structured data
  parseCSV(file: File): Promise<ParsedData>;
  
  // Validate the parsed data
  validateData(data: ParsedData): ValidationResult;
  
  // Transform parsed data into database records
  transformData(data: ParsedData): Promise<T[]>;
  
  // Get column mappings for this data source
  getColumnMappings(): ColumnMapping[];
}

export interface ColumnMapping {
  csvColumn: string;
  dbField: string;
  required: boolean;
  transform?: (value: any) => any;
}

// Interface for adapters that support student matching
export interface DataAdapter<T = any> {
  name: string;
  type: string;
  
  // Parse CSV file into structured data
  parseCSV(file: File): Promise<ParsedData>;
  
  // Validate the parsed data
  validateData(data: ParsedData): ValidationResult;
  
  // Transform parsed data into database records with student matching
  transformData(data: ParsedData): Promise<T[]>;
  
  // Transform data with student matching and return both data and matching report
  transformDataWithMatching?(data: ParsedData): Promise<{
    data: T[];
    matchingReport: MatchingReport;
  }>;
}

// Base adapter class with common functionality
export abstract class BaseAdapter<T = any> implements DataSourceAdapter<T> {
  abstract name: string;
  abstract description: string;
  
  async parseCSV(file: File): Promise<ParsedData> {
    const Papa = (await import('papaparse')).default;
    
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          resolve({
            headers: results.meta.fields || [],
            rows: results.data as Record<string, any>[]
          });
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  }
  
  abstract validateData(data: ParsedData): ValidationResult;
  abstract transformData(data: ParsedData): Promise<T[]>;
  abstract getColumnMappings(): ColumnMapping[];
  
  // Helper method to validate required columns
  protected validateRequiredColumns(data: ParsedData, mappings: ColumnMapping[]): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    const requiredColumns = mappings.filter(m => m.required);
    const missingColumns = requiredColumns.filter(
      m => !data.headers.includes(m.csvColumn)
    );
    
    if (missingColumns.length > 0) {
      errors.push(
        `Missing required columns: ${missingColumns.map(m => m.csvColumn).join(', ')}`
      );
    }
    
    // Check for empty data
    if (data.rows.length === 0) {
      errors.push('CSV file contains no data rows');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}