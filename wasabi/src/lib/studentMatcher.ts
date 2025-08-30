import { db } from './db';

export interface StudentMatch {
  wasabiId: string;
  confidence: number; // 0-100
  matchedBy: 'id' | 'name' | 'criteria';
  matchDetails: {
    idMatch?: boolean;
    nameMatch?: number; // similarity score 0-100
    gradeMatch?: boolean;
    teacherMatch?: boolean;
    dobMatch?: boolean;
  };
}

export interface MatchingReport {
  totalStudentsInEnrollment: number;
  totalRowsInDataset: number;
  matchedStudents: number;
  unmatchedRows: number;
  duplicateMatches: number;
  matchRate: number; // percentage
  confidence: {
    high: number; // 90-100%
    medium: number; // 70-89%
    low: number; // 50-69%
    uncertain: number; // below 50%
  };
  unmatchedStudentNames: string[];
}

export interface ParsedName {
  firstName: string;
  lastName: string;
  originalFormat: string;
}

export interface DatasetRow {
  [key: string]: any;
}

export interface MatchedDatasetRow extends DatasetRow {
  wasabiId?: string;
  matchInfo?: StudentMatch;
}

export class StudentMatcher {
  private enrollmentStudents: Map<string, any> = new Map();
  private nameIndex: Map<string, string[]> = new Map(); // normalized name → wasabiIds[]
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    // Load all enrollment students
    const students = await db.students.toArray();
    
    for (const student of students) {
      const wasabiId = student.id;
      this.enrollmentStudents.set(wasabiId, student);
      
      // Build name index for fuzzy matching
      const normalizedName = this.normalizeStudentName(student.firstName, student.lastName);
      if (!this.nameIndex.has(normalizedName)) {
        this.nameIndex.set(normalizedName, []);
      }
      this.nameIndex.get(normalizedName)!.push(wasabiId);
    }

    this.initialized = true;
  }

  /**
   * Parse various name formats into firstName/lastName
   */
  parseName(nameInput: string | { firstName?: string; lastName?: string; [key: string]: any }): ParsedName {
    if (typeof nameInput === 'object' && nameInput.firstName && nameInput.lastName) {
      return {
        firstName: nameInput.firstName.trim(),
        lastName: nameInput.lastName.trim(),
        originalFormat: 'separate_columns'
      };
    }

    const nameStr = typeof nameInput === 'string' ? nameInput.trim() : String(nameInput || '');
    
    // Remove quotes that might be around names in CSV files
    const cleanNameStr = nameStr.replace(/^["']|["']$/g, '');
    
    // Handle Last, First format (like "Bowden, Dallas" or "JACKSON, KAY'DEN")
    if (cleanNameStr.includes(',')) {
      const parts = cleanNameStr.split(',').map(p => p.trim());
      return {
        lastName: parts[0] || '',
        firstName: parts[1] || '',
        originalFormat: 'last_first_comma'
      };
    }

    // Handle First Last format (space separated)
    const parts = cleanNameStr.split(/\s+/);
    if (parts.length >= 2) {
      return {
        firstName: parts[0],
        lastName: parts.slice(1).join(' '),
        originalFormat: 'first_last_space'
      };
    }

    // Single name or unrecognized format
    return {
      firstName: parts[0] || '',
      lastName: '',
      originalFormat: 'single_or_unknown'
    };
  }

  /**
   * Normalize name for comparison (remove special chars, lowercase, etc.)
   */
  private normalizeStudentName(firstName: string, lastName: string): string {
    const normalize = (str: string) => 
      str.toLowerCase()
         .replace(/[^a-z\s]/g, '') // Remove special characters and apostrophes
         .replace(/\s+/g, ' ')     // Normalize spaces
         .trim();
    
    return `${normalize(lastName)} ${normalize(firstName)}`;
  }

  /**
   * Calculate similarity between two names using Levenshtein distance
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalize = (str: string) => str.toLowerCase().replace(/[^a-z]/g, '');
    const n1 = normalize(name1);
    const n2 = normalize(name2);

    if (n1 === n2) return 100;
    if (n1.length === 0 || n2.length === 0) return 0;

    // Levenshtein distance implementation
    const matrix = Array(n2.length + 1).fill(null).map(() => Array(n1.length + 1).fill(null));

    for (let i = 0; i <= n1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= n2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= n2.length; j++) {
      for (let i = 1; i <= n1.length; i++) {
        if (n1[i - 1] === n2[j - 1]) {
          matrix[j][i] = matrix[j - 1][i - 1];
        } else {
          matrix[j][i] = Math.min(
            matrix[j - 1][i - 1] + 1, // substitution
            matrix[j][i - 1] + 1,     // insertion
            matrix[j - 1][i] + 1      // deletion
          );
        }
      }
    }

    const distance = matrix[n2.length][n1.length];
    const maxLength = Math.max(n1.length, n2.length);
    return Math.round((1 - distance / maxLength) * 100);
  }

  /**
   * Extract student ID from various possible column names and formats
   */
  private extractStudentId(row: DatasetRow): string | null {
    const idColumns = [
      'Student ID', 'student id', 'studentid', 'StudentID', 'STUDENT_ID',
      'student_id', 'ID', 'id', 'StudentNumber', 'Student Number'
    ];

    for (const col of idColumns) {
      if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
        let id = String(row[col]).trim();
        // Remove Excel formula prefixes like ="20107825"
        id = id.replace(/^="?/, '').replace(/"?$/, '');
        if (id && id !== '0') {
          return id;
        }
      }
    }

    return null;
  }

  /**
   * Extract grade from various possible formats
   */
  private extractGrade(row: DatasetRow): string | null {
    const gradeColumns = [
      'Grade', 'grade', 'Grade Level', 'Student Grade', 'GRADE', 'grade_level'
    ];

    for (const col of gradeColumns) {
      if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
        let grade = String(row[col]).trim();
        // Remove Excel formula prefixes and leading zeros
        grade = grade.replace(/^="?0*/, '').replace(/"?$/, '');
        if (grade) {
          return grade;
        }
      }
    }

    return null;
  }

  /**
   * Extract teacher name from various formats
   */
  private extractTeacher(row: DatasetRow): string | null {
    const teacherColumns = [
      'Teacher', 'teacher', 'Class Teacher(s)', 'Teacher Name', 'Home Room Teacher',
      'Homeroom Teacher', 'homeroom_teacher'
    ];

    for (const col of teacherColumns) {
      if (row[col] !== undefined && row[col] !== null && row[col] !== '') {
        return String(row[col]).trim();
      }
    }

    return null;
  }

  /**
   * Match a single dataset row to a student
   */
  async matchStudentRow(row: DatasetRow): Promise<StudentMatch | null> {
    await this.initialize();

    const studentId = this.extractStudentId(row);
    const grade = this.extractGrade(row);
    const teacher = this.extractTeacher(row);

    // Stage 1: Direct ID matching (highest confidence)
    if (studentId) {
      for (const [wasabiId, student] of this.enrollmentStudents) {
        if (student.studentNumber === studentId) {
          return {
            wasabiId,
            confidence: 95,
            matchedBy: 'id',
            matchDetails: {
              idMatch: true,
              gradeMatch: grade ? String(student.grade) === grade : undefined,
            }
          };
        }
      }
    }

    // Stage 2: Name-based matching
    // Try to extract name from row
    const possibleNameColumns = [
      'Student', 'student', 'Student Name', 'Name', 'name',
      'Last Name', 'First Name', 'LastName', 'FirstName',
      'Full Name', 'FullName', 'full_name'
    ];

    let parsedName: ParsedName | null = null;

    // Check if we have separate first/last name columns (enrollment format)
    if (row['First'] && row['Last']) {
      parsedName = this.parseName({
        firstName: row['First'],
        lastName: row['Last']
      });
    } else if (row['First Name'] && row['Last Name']) {
      parsedName = this.parseName({
        firstName: row['First Name'],
        lastName: row['Last Name']
      });
    } else if (row['FirstName'] && row['LastName']) {
      parsedName = this.parseName({
        firstName: row['FirstName'],
        lastName: row['LastName']
      });
    } else {
      // Look for single name column (FAST format: "Last, First")
      for (const col of possibleNameColumns) {
        if (row[col] && String(row[col]).trim()) {
          parsedName = this.parseName(row[col]);
          break;
        }
      }
    }

    if (!parsedName || (!parsedName.firstName && !parsedName.lastName)) {
      return null; // Can't match without name
    }

    // Debug logging for FAST matching
    const nameToMatch = this.normalizeStudentName(parsedName.firstName, parsedName.lastName);
    console.log(`🔍 Matching: "${parsedName.lastName}, ${parsedName.firstName}" (${parsedName.originalFormat}) → normalized: "${nameToMatch}"`);
    
    // Show first few enrollment students for comparison
    if (this.enrollmentStudents.size > 0) {
      const firstFewStudents = Array.from(this.enrollmentStudents.values()).slice(0, 3);
      console.log(`📚 Sample enrollment names:`, firstFewStudents.map(s => `${s.firstName} ${s.lastName} → "${this.normalizeStudentName(s.firstName, s.lastName)}"`));
    }
    
    // Find potential matches by name similarity
    let bestMatch: StudentMatch | null = null;
    let bestSimilarity = 0;

    for (const [wasabiId, student] of this.enrollmentStudents) {
      const enrollmentName = this.normalizeStudentName(student.firstName, student.lastName);
      const similarity = this.calculateNameSimilarity(nameToMatch, enrollmentName);
      
      // Debug for first few matches and specific cases
      if (similarity > 50 || (student.firstName === 'Kendale' && student.lastName === 'Campbell')) {
        console.log(`  → ${student.firstName} ${student.lastName} (${enrollmentName}) = ${similarity}% match`);
      }

      if (similarity > bestSimilarity && similarity >= 70) { // Minimum 70% similarity
        const gradeMatch = grade ? String(student.grade) === grade : undefined;
        const teacherMatch = teacher ? this.compareTeacher(teacher, student.className) : undefined;

        // Calculate final confidence based on multiple factors
        let confidence = similarity;
        
        // Boost confidence for additional matches
        if (gradeMatch === true) confidence += 10;
        if (teacherMatch === true) confidence += 5;
        
        // Reduce confidence for mismatches
        if (gradeMatch === false) confidence -= 15;
        if (teacherMatch === false) confidence -= 5;

        confidence = Math.min(100, Math.max(0, confidence));

        if (confidence > bestSimilarity) {
          bestSimilarity = confidence;
          bestMatch = {
            wasabiId,
            confidence,
            matchedBy: 'name',
            matchDetails: {
              nameMatch: similarity,
              gradeMatch,
              teacherMatch,
            }
          };
        }
      }
    }

    return bestMatch;
  }

  /**
   * Compare teacher names (handle various formats)
   */
  private compareTeacher(datasetTeacher: string, enrollmentTeacher: string | null): boolean {
    if (!enrollmentTeacher) return false;
    
    const normalize = (str: string) => 
      str.toLowerCase()
         .replace(/[^a-z\s]/g, '')
         .replace(/\s+/g, ' ')
         .trim();

    const t1 = normalize(datasetTeacher);
    const t2 = normalize(enrollmentTeacher);

    // Check if either name contains the other
    return t1.includes(t2) || t2.includes(t1) || this.calculateNameSimilarity(t1, t2) > 80;
  }

  /**
   * Match an entire dataset and generate report
   */
  async matchDataset(rows: DatasetRow[]): Promise<{
    matchedRows: MatchedDatasetRow[];
    report: MatchingReport;
  }> {
    await this.initialize();
    
    console.log(`\n🔍 STARTING DATASET MATCHING - ${rows.length} rows to process`);
    console.log(`📚 Available students in enrollment: ${this.enrollmentStudents.size}`);
    
    // Show a few enrollment students for debugging
    const sampleStudents = Array.from(this.enrollmentStudents.values()).slice(0, 5);
    console.log(`📋 Sample enrollment students:`, sampleStudents.map(s => `${s.firstName} ${s.lastName}`));

    const matchedRows: MatchedDatasetRow[] = [];
    const matchedStudentIds = new Set<string>();
    const unmatchedStudentNames: string[] = [];
    let highConfidence = 0, mediumConfidence = 0, lowConfidence = 0, uncertain = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const match = await this.matchStudentRow(row);
      
      const matchedRow: MatchedDatasetRow = { ...row };
      
      if (match) {
        matchedRow.wasabiId = match.wasabiId;
        matchedRow.matchInfo = match;
        matchedStudentIds.add(match.wasabiId);

        // Categorize confidence
        if (match.confidence >= 90) highConfidence++;
        else if (match.confidence >= 70) mediumConfidence++;
        else if (match.confidence >= 50) lowConfidence++;
        else uncertain++;
        
        console.log(`✅ Row ${i+1}: MATCHED with ${match.confidence}% confidence`);
      } else {
        // Try to extract name for unmatched report
        const possibleNameColumns = ['Student', 'Student Name', 'Name', 'Last Name', 'First Name'];
        let extractedName = '';
        for (const col of possibleNameColumns) {
          if (row[col]) {
            extractedName = String(row[col]);
            unmatchedStudentNames.push(extractedName);
            break;
          }
        }
        uncertain++;
        console.log(`❌ Row ${i+1}: NO MATCH for "${extractedName}"`);
      }

      matchedRows.push(matchedRow);
    }

    const totalStudentsInEnrollment = this.enrollmentStudents.size;
    const matchedStudents = matchedStudentIds.size;
    const totalMatched = highConfidence + mediumConfidence + lowConfidence;
    const matchRate = rows.length > 0 
      ? Math.round((totalMatched / rows.length) * 100)
      : 0;
    
    console.log(`📊 MATCH REPORT: ${totalMatched}/${rows.length} rows matched = ${matchRate}% match rate`);
    console.log(`📊 Confidence breakdown: High=${highConfidence}, Med=${mediumConfidence}, Low=${lowConfidence}, Uncertain=${uncertain}`);

    const report: MatchingReport = {
      totalStudentsInEnrollment,
      totalRowsInDataset: rows.length,
      matchedStudents,
      unmatchedRows: rows.length - (highConfidence + mediumConfidence + lowConfidence),
      duplicateMatches: (highConfidence + mediumConfidence + lowConfidence) - matchedStudents,
      matchRate,
      confidence: {
        high: highConfidence,
        medium: mediumConfidence,
        low: lowConfidence,
        uncertain: uncertain
      },
      unmatchedStudentNames
    };

    return { matchedRows, report };
  }

  /**
   * Generate a WASABI ID for a new student (used during enrollment import)
   */
  static generateWasabiId(): string {
    return `wasabi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Global instance
export const studentMatcher = new StudentMatcher();