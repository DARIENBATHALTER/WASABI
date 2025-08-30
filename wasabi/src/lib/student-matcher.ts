import { db } from './db';
import type { Student } from '../shared/types';

export interface MatchResult {
  wasabiId: string;
  student: Student;
  matchType: 'dcps_id' | 'fl_id' | 'name';
  confidence: number; // 0-100
}

export class StudentMatcher {
  private studentsByDcpsId: Map<string, Student> = new Map();
  private studentsByFlId: Map<string, Student> = new Map();
  private studentsByName: Map<string, Student[]> = new Map();
  private initialized = false;
  private _debugLogged = false;

  async initialize() {
    if (this.initialized) return;

    // Load all students from enrollment
    const students = await db.students.toArray();
    
    // Build indexes
    for (const student of students) {
      // Index by DCPS ID
      if (student.studentNumber) {
        this.studentsByDcpsId.set(student.studentNumber, student);
      }
      
      // Index by FL ID
      if (student.flId) {
        this.studentsByFlId.set(student.flId, student);
      }
      
      // Index by normalized name
      const nameKey = this.normalizeNameForMatching(student.firstName, student.lastName);
      if (!this.studentsByName.has(nameKey)) {
        this.studentsByName.set(nameKey, []);
      }
      this.studentsByName.get(nameKey)!.push(student);
    }

    this.initialized = true;
    console.log(`StudentMatcher initialized with ${students.length} students`);
    console.log(`  - ${this.studentsByDcpsId.size} students with DCPS IDs`);
    console.log(`  - ${this.studentsByFlId.size} students with FL IDs`);
    console.log(`  - ${this.studentsByName.size} unique name combinations`);
    
    // Debug: Show a few FL IDs to verify format
    const sampleFlIds = Array.from(this.studentsByFlId.keys()).slice(0, 3);
    if (sampleFlIds.length > 0) {
      console.log(`  - Sample FL IDs:`, sampleFlIds);
    }
  }

  /**
   * Match a row from a dataset to a student in enrollment
   * Returns null if no match found
   */
  async matchStudent(row: Record<string, any>): Promise<MatchResult | null> {
    await this.initialize();

    // 1. Try DCPS ID match (highest confidence)
    const dcpsId = this.extractDcpsId(row);
    if (dcpsId) {
      const student = this.studentsByDcpsId.get(dcpsId);
      if (student) {
        return {
          wasabiId: student.id,
          student,
          matchType: 'dcps_id',
          confidence: 100
        };
      }
    }

    // 2. Try FL ID match (high confidence)
    const flId = this.extractFlId(row);
    if (flId) {
      const student = this.studentsByFlId.get(flId);
      if (student) {
        return {
          wasabiId: student.id,
          student,
          matchType: 'fl_id',
          confidence: 95
        };
      }
      // Debug: FL ID extracted but no match
      if (!this._debugLogged) {
        console.log(`🔍 FL ID extracted: "${flId}" but not found in enrollment`);
        const enrollmentFlIds = Array.from(this.studentsByFlId.keys());
        console.log(`   Available FL IDs sample:`, enrollmentFlIds.slice(0, 5));
        // Check if there's a formatting difference
        const similarFlId = enrollmentFlIds.find(id => 
          id.includes(flId.substring(2)) || flId.includes(id.substring(2))
        );
        if (similarFlId) {
          console.log(`   ⚠️ Found similar FL ID in enrollment: "${similarFlId}"`);
          console.log(`   Writing file FL ID: "${flId}" (length: ${flId.length})`);
          console.log(`   Enrollment FL ID:   "${similarFlId}" (length: ${similarFlId.length})`);
        }
        this._debugLogged = true;
      }
    }

    // 3. Try name match (variable confidence)
    const nameMatch = this.matchByName(row);
    if (nameMatch) {
      return nameMatch;
    }

    return null;
  }

  private extractDcpsId(row: Record<string, any>): string | null {
    const possibleFields = [
      'Student ID', 'StudentID', 'student_id', 'STUDENT_ID',
      'DCPS ID', 'DCPSID', 'dcps_id', 'DCPS_ID',
      'ID', 'id', 'Student Number', 'StudentNumber'
    ];

    for (const field of possibleFields) {
      if (row[field]) {
        const value = String(row[field]).trim();
        // DCPS IDs are 8 digits
        if (/^\d{8}$/.test(value)) {
          return value;
        }
      }
    }

    return null;
  }

  private extractFlId(row: Record<string, any>): string | null {
    const possibleFields = [
      'FL ID', 'FLID', 'fl_id', 'FL_ID',
      'Florida Education Identifier', 'Florida ID',
      'FLEID', 'State ID', 'StateID',
      // FAST files put FL ID in "Student ID" column
      'Student ID', 'student_id', 'studentid', 'StudentID'
    ];

    for (const field of possibleFields) {
      if (row[field]) {
        const value = String(row[field]).trim();
        // FL IDs start with "FL" and are 14 characters total
        if (value.startsWith('FL') && value.length === 14) {
          return value;
        }
      }
    }

    return null;
  }

  private matchByName(row: Record<string, any>): MatchResult | null {
    // Extract name from various formats
    const name = this.extractName(row);
    if (!name) return null;

    const nameKey = this.normalizeNameForMatching(name.firstName, name.lastName);
    const candidates = this.studentsByName.get(nameKey);

    if (candidates && candidates.length > 0) {
      // If exact match on normalized name
      if (candidates.length === 1) {
        return {
          wasabiId: candidates[0].id,
          student: candidates[0],
          matchType: 'name',
          confidence: 85
        };
      }

      // Multiple students with same name - try to disambiguate with grade
      const grade = this.extractGrade(row);
      if (grade) {
        const gradeMatch = candidates.find(s => s.grade === grade);
        if (gradeMatch) {
          return {
            wasabiId: gradeMatch.id,
            student: gradeMatch,
            matchType: 'name',
            confidence: 80
          };
        }
      }

      // Return first candidate with lower confidence
      return {
        wasabiId: candidates[0].id,
        student: candidates[0],
        matchType: 'name',
        confidence: 70
      };
    }

    // Try fuzzy name matching
    return this.fuzzyNameMatch(name.firstName, name.lastName);
  }

  private extractName(row: Record<string, any>): { firstName: string; lastName: string } | null {
    // Check for separate first/last columns
    const firstNameFields = ['First Name', 'FirstName', 'First', 'first_name', 'FIRST_NAME'];
    const lastNameFields = ['Last Name', 'LastName', 'Last', 'last_name', 'LAST_NAME'];

    let firstName = '';
    let lastName = '';

    for (const field of firstNameFields) {
      if (row[field]) {
        firstName = String(row[field]).trim();
        break;
      }
    }

    for (const field of lastNameFields) {
      if (row[field]) {
        lastName = String(row[field]).trim();
        break;
      }
    }

    if (firstName && lastName) {
      return { firstName, lastName };
    }

    // Check for combined name fields
    const combinedFields = ['Student Name', 'Student', 'Name', 'Full Name', 'FullName'];
    for (const field of combinedFields) {
      if (row[field]) {
        const fullName = String(row[field]).trim();
        
        // Handle "Last, First" format
        if (fullName.includes(',')) {
          const parts = fullName.split(',').map(p => p.trim());
          return {
            lastName: parts[0],
            firstName: parts[1] || ''
          };
        }

        // Handle "First Last" format
        const parts = fullName.split(/\s+/);
        if (parts.length >= 2) {
          return {
            firstName: parts[0],
            lastName: parts.slice(1).join(' ')
          };
        }
      }
    }

    return null;
  }

  private extractGrade(row: Record<string, any>): string | null {
    const gradeFields = ['Grade', 'grade', 'Grade Level', 'GradeLevel', 'GRADE'];
    
    for (const field of gradeFields) {
      if (row[field]) {
        return String(row[field]).trim();
      }
    }

    return null;
  }

  private normalizeNameForMatching(firstName: string, lastName: string): string {
    const normalize = (str: string) => 
      str.toLowerCase()
         .replace(/[^a-z]/g, '') // Remove all non-letter characters
         .trim();
    
    return `${normalize(lastName)}_${normalize(firstName)}`;
  }

  private fuzzyNameMatch(firstName: string, lastName: string): MatchResult | null {
    const targetKey = this.normalizeNameForMatching(firstName, lastName);
    
    // Simple fuzzy matching - check if any enrollment name is very similar
    for (const [nameKey, students] of this.studentsByName.entries()) {
      const similarity = this.calculateSimilarity(targetKey, nameKey);
      if (similarity > 0.85) { // 85% similarity threshold
        return {
          wasabiId: students[0].id,
          student: students[0],
          matchType: 'name',
          confidence: Math.round(similarity * 70) // Max 70% confidence for fuzzy match
        };
      }
    }

    return null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    // Simple character-based similarity
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer[i] === shorter[i]) {
        matches++;
      }
    }

    return matches / longer.length;
  }

  /**
   * Get summary statistics about the current matcher state
   */
  getStats() {
    return {
      totalStudents: this.studentsByDcpsId.size,
      studentsWithFlId: this.studentsByFlId.size,
      uniqueNames: this.studentsByName.size
    };
  }
}

// Global singleton instance
export const studentMatcher = new StudentMatcher();