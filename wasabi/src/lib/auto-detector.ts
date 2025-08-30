import type { ParsedData } from '../shared/types';

export interface DetectionResult {
  type: 'student-enrollment' | 'iready-reading' | 'iready-math' | 'fast-reading' | 'fast-math' | 'star-early-literacy' | 'star-math' | 'attendance' | 'grades' | 'achieve3000' | 'unknown';
  confidence: number; // 0-1
  reason: string;
  suggestedName?: string;
}

export class DataSourceDetector {
  static detect(filename: string, data: ParsedData): DetectionResult {
    const name = filename.toLowerCase();
    const headers = data.headers.map(h => h.toLowerCase());
    
    // Check filename patterns first (highest confidence)
    if (name.includes('student') && (name.includes('enrollment') || name.includes('w:dob') || name.includes('demographics'))) {
      return this.detectStudent(headers, filename);
    }
    
    if (name.includes('iready')) {
      return this.detectIReady(headers, filename);
    }
    
    if (name.includes('fast')) {
      return this.detectFAST(headers, filename);
    }
    
    if (name.includes('star')) {
      return this.detectSTAR(headers, filename);
    }
    
    if (name.includes('attendance')) {
      return this.detectAttendance(headers, filename);
    }
    
    if (name.includes('gpa') || name.includes('grade')) {
      return this.detectGPA(headers, filename);
    }
    
    // Fallback to header-based detection
    return this.detectByHeaders(headers, filename);
  }
  
  private static detectStudent(headers: string[], filename: string): DetectionResult {
    const studentIndicators = [
      'student id', 'first', 'last', 'grade', 'dob', 'date of birth',
      'home room teacher', 'homeroom', 'gender'
    ];
    
    const matches = studentIndicators.filter(indicator => 
      headers.some(header => header.includes(indicator))
    );
    
    const confidence = matches.length >= 3 ? 0.95 : 0.7;
    
    return {
      type: 'student-enrollment',
      confidence,
      reason: `Student enrollment data detected (${matches.length} student fields found)`,
      suggestedName: `Student Enrollment - ${this.extractDate(filename)}`
    };
  }
  
  private static detectIReady(headers: string[], filename: string): DetectionResult {
    const ireadyIndicators = [
      'scale score', 'placement', 'diagnostic', 'lesson', 'overall scale score',
      'percentile', 'growth measure', 'mid-on-grade', 'end-on-grade'
    ];
    
    const matches = ireadyIndicators.filter(indicator =>
      headers.some(header => header.includes(indicator))
    );
    
    const confidence = matches.length >= 2 ? 0.9 : 0.6;
    
    // Determine specific type based on filename
    let type: 'iready-reading' | 'iready-math' = 'iready-reading'; // default to reading
    let subject = 'Reading';
    
    if (filename.includes('math')) {
      type = 'iready-math';
      subject = 'Math';
    } else if (filename.includes('reading')) {
      type = 'iready-reading';
      subject = 'Reading';
    }
    
    return {
      type,
      confidence,
      reason: `iReady ${subject} assessment data detected (${matches.length} iReady fields found)`,
      suggestedName: `iReady ${subject} - ${this.extractDate(filename)}`
    };
  }
  
  private static detectFAST(headers: string[], filename: string): DetectionResult {
    const fastIndicators = [
      'scale score', 'achievement level', 'performance level', 'standard error',
      'test date', 'grade level equivalent', 'national percentile'
    ];
    
    const matches = fastIndicators.filter(indicator =>
      headers.some(header => header.includes(indicator))
    );
    
    const confidence = matches.length >= 2 ? 0.9 : 0.7;
    
    // Determine specific type based on filename
    let type: 'fast-reading' | 'fast-math' = 'fast-reading'; // default to reading
    let subject = 'Reading';
    
    if (filename.includes('math')) {
      type = 'fast-math';
      subject = 'Math';
    } else if (filename.includes('ela') || filename.includes('reading')) {
      type = 'fast-reading';
      subject = 'Reading';
    }
    
    const period = this.extractPeriod(filename);
    
    return {
      type,
      confidence,
      reason: `FAST ${subject} assessment data detected (${matches.length} FAST fields found)`,
      suggestedName: `FAST ${subject}${period ? ` ${period}` : ''} - ${this.extractDate(filename)}`
    };
  }
  
  private static detectSTAR(headers: string[], filename: string): DetectionResult {
    const starIndicators = [
      'scaled score', 'percentile rank', 'grade equivalent', 'instructional reading level',
      'student growth percentile', 'benchmark', 'tier', 'unified score', 'activity name'
    ];
    
    const matches = starIndicators.filter(indicator =>
      headers.some(header => header.includes(indicator))
    );
    
    const confidence = matches.length >= 2 ? 0.9 : 0.7;
    
    // Determine if this is Math or Early Literacy based on content
    let type: 'star-early-literacy' | 'star-math' = 'star-early-literacy'; // default
    let subject = 'Early Literacy';
    
    // Check filename for math indicators
    if (filename.toLowerCase().includes('math')) {
      type = 'star-math';
      subject = 'Math';
    } else {
      // Check data content for math vs literacy indicators
      const hasActivityName = headers.some(h => h.toLowerCase().includes('activity name'));
      if (hasActivityName) {
        // In practice, we'd need to examine actual data rows to determine test types
        // For now, default to Early Literacy unless filename suggests otherwise
        subject = 'Early Literacy/Math'; // Mixed file
      }
    }
    
    return {
      type,
      confidence,
      reason: `STAR ${subject} assessment data detected (${matches.length} STAR fields found)`,
      suggestedName: `STAR ${subject} - ${this.extractDate(filename)}`
    };
  }
  
  private static detectAttendance(headers: string[], filename: string): DetectionResult {
    const attendanceIndicators = [
      'absent', 'present', 'tardy', 'attendance', 'days enrolled', 'excused', 'unexcused'
    ];
    
    const matches = attendanceIndicators.filter(indicator =>
      headers.some(header => header.includes(indicator))
    );
    
    // Check for daily matrix format (date columns like "8/12", "9/3", etc.)
    const dateColumns = headers.filter(header => {
      const cleanHeader = header.replace(/^=\"?/, '').replace(/\"?$/, '');
      return /^\d{1,2}\/\d{1,2}$/.test(cleanHeader);
    });
    
    let confidence = 0.8;
    let reason = '';
    
    if (matches.length >= 2) {
      confidence = 0.95;
      reason = `Attendance data detected (${matches.length} attendance fields found)`;
    } else if (dateColumns.length >= 10) {
      confidence = 0.9;
      reason = `Daily attendance matrix detected (${dateColumns.length} date columns found)`;
    } else if (dateColumns.length >= 5) {
      confidence = 0.8;
      reason = `Possible daily attendance matrix (${dateColumns.length} date columns found)`;
    } else {
      confidence = matches.length > 0 ? 0.7 : 0.6;
      reason = `Attendance data detected (${matches.length} attendance fields found)`;
    }
    
    return {
      type: 'attendance',
      confidence,
      reason,
      suggestedName: `Attendance Records - ${this.extractDate(filename)}`
    };
  }
  
  private static detectGPA(headers: string[], filename: string): DetectionResult {
    const gradeIndicators = [
      'gpa', 'grade point average', 'semester', 'quarter', 'course', 'credit'
    ];
    
    const matches = gradeIndicators.filter(indicator =>
      headers.some(header => header.includes(indicator))
    );
    
    const confidence = matches.length >= 2 ? 0.9 : 0.7;
    
    return {
      type: 'grades',
      confidence,
      reason: `GPA/Grade data detected (${matches.length} grade fields found)`,
      suggestedName: `Academic Performance - ${this.extractDate(filename)}`
    };
  }
  
  private static detectByHeaders(headers: string[], filename: string): DetectionResult {
    // Try to detect based on headers alone
    const hasStudentId = headers.some(h => h.includes('student') && h.includes('id'));
    
    if (hasStudentId) {
      const hasScores = headers.some(h => h.includes('score') || h.includes('percentile'));
      const hasGrades = headers.some(h => h.includes('gpa') || h.includes('grade'));
      const hasAttendance = headers.some(h => h.includes('absent') || h.includes('present'));
      
      if (hasScores) {
        return {
          type: 'unknown',
          confidence: 0.5,
          reason: 'Assessment data detected but specific platform unclear',
          suggestedName: `Assessment Data - ${this.extractDate(filename)}`
        };
      }
      
      if (hasGrades) {
        return {
          type: 'grades',
          confidence: 0.6,
          reason: 'Grade/GPA data detected',
          suggestedName: `Grade Data - ${this.extractDate(filename)}`
        };
      }
      
      if (hasAttendance) {
        return {
          type: 'attendance',
          confidence: 0.7,
          reason: 'Attendance data detected',
          suggestedName: `Attendance Data - ${this.extractDate(filename)}`
        };
      }
    }
    
    return {
      type: 'unknown',
      confidence: 0.1,
      reason: 'Unable to determine data type from filename or headers',
      suggestedName: `Unknown Data - ${this.extractDate(filename)}`
    };
  }
  
  private static extractDate(filename: string): string {
    // Extract academic year pattern like "24-25" or "2024-25"
    const yearMatch = filename.match(/(\d{2,4}[-_]\d{2,4})/);
    if (yearMatch) {
      return yearMatch[1];
    }
    
    // Extract simple year pattern
    const simpleYearMatch = filename.match(/20\d{2}/);
    if (simpleYearMatch) {
      return simpleYearMatch[0];
    }
    
    return new Date().getFullYear().toString();
  }
  
  private static extractPeriod(filename: string): string | null {
    const periodMatch = filename.match(/PM(\d+)|Progress Monitoring (\d+)|Quarter (\d+)|Semester (\d+)/i);
    if (periodMatch) {
      const period = periodMatch[1] || periodMatch[2] || periodMatch[3] || periodMatch[4];
      if (periodMatch[0].toLowerCase().includes('pm')) {
        return `PM${period}`;
      } else if (periodMatch[0].toLowerCase().includes('quarter')) {
        return `Q${period}`;
      } else if (periodMatch[0].toLowerCase().includes('semester')) {
        return `S${period}`;
      }
    }
    return null;
  }
}