import { db } from './db';
import type { Student } from '../shared/types';

export interface StudentMatchCandidate {
  studentId?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  grade?: string;
  className?: string;
  [key: string]: any; // Allow additional fields from source data
}

export interface MatchResult {
  success: boolean;
  matchedStudent?: Student;
  confidence: 'exact' | 'high' | 'medium' | 'low';
  matchedBy: 'id' | 'name-grade' | 'name-only' | 'fuzzy';
  reason: string;
  alternatives?: Student[]; // Other possible matches for manual review
}

export interface MatchSummary {
  totalRecords: number;
  exactMatches: number;
  fuzzyMatches: number;
  noMatches: number;
  multipleMatches: number;
  details: Array<{
    sourceData: StudentMatchCandidate;
    result: MatchResult;
  }>;
}

export class StudentMatcher {
  private enrolledStudents: Student[] = [];

  async initialize(): Promise<void> {
    this.enrolledStudents = await db.students.toArray();
  }

  async matchStudent(candidate: StudentMatchCandidate): Promise<MatchResult> {
    // Strategy 1: Exact ID match (highest confidence)
    if (candidate.studentId) {
      const exactMatch = this.enrolledStudents.find(s => 
        s.id === candidate.studentId || s.studentNumber === candidate.studentId
      );
      
      if (exactMatch) {
        return {
          success: true,
          matchedStudent: exactMatch,
          confidence: 'exact',
          matchedBy: 'id',
          reason: `Matched by student ID: ${candidate.studentId}`
        };
      }
    }

    // Strategy 2: Name + Grade match (high confidence)
    const nameGradeMatches = this.findNameGradeMatches(candidate);
    if (nameGradeMatches.length === 1) {
      return {
        success: true,
        matchedStudent: nameGradeMatches[0],
        confidence: 'high',
        matchedBy: 'name-grade',
        reason: `Matched by name and grade: ${this.formatName(candidate)} in grade ${candidate.grade}`
      };
    }

    // Strategy 3: Exact name match (medium confidence if unique)
    const nameMatches = this.findNameMatches(candidate);
    if (nameMatches.length === 1) {
      return {
        success: true,
        matchedStudent: nameMatches[0],
        confidence: 'medium',
        matchedBy: 'name-only',
        reason: `Matched by name only: ${this.formatName(candidate)} (unique match)`
      };
    }

    // Strategy 4: Fuzzy name matching (low confidence)
    const fuzzyMatches = this.findFuzzyMatches(candidate);
    if (fuzzyMatches.length === 1) {
      return {
        success: true,
        matchedStudent: fuzzyMatches[0],
        confidence: 'low',
        matchedBy: 'fuzzy',
        reason: `Fuzzy name match: ${this.formatName(candidate)} → ${fuzzyMatches[0].firstName} ${fuzzyMatches[0].lastName}`
      };
    }

    // No unique match found
    const allPossibleMatches = [...nameGradeMatches, ...nameMatches, ...fuzzyMatches];
    const uniqueMatches = this.deduplicateStudents(allPossibleMatches);

    return {
      success: false,
      confidence: 'low',
      matchedBy: 'name-only',
      reason: uniqueMatches.length === 0 
        ? `No matching student found for: ${this.formatName(candidate)}`
        : `Multiple possible matches found for: ${this.formatName(candidate)} (${uniqueMatches.length} candidates)`,
      alternatives: uniqueMatches.slice(0, 5) // Limit to 5 alternatives
    };
  }

  async matchBatch(candidates: StudentMatchCandidate[]): Promise<MatchSummary> {
    await this.initialize();
    
    const details: MatchSummary['details'] = [];
    let exactMatches = 0;
    let fuzzyMatches = 0;
    let noMatches = 0;
    let multipleMatches = 0;

    for (const candidate of candidates) {
      const result = await this.matchStudent(candidate);
      details.push({ sourceData: candidate, result });

      if (result.success) {
        if (result.confidence === 'exact') {
          exactMatches++;
        } else {
          fuzzyMatches++;
        }
      } else {
        if (result.alternatives && result.alternatives.length > 0) {
          multipleMatches++;
        } else {
          noMatches++;
        }
      }
    }

    return {
      totalRecords: candidates.length,
      exactMatches,
      fuzzyMatches,
      noMatches,
      multipleMatches,
      details
    };
  }

  private findNameGradeMatches(candidate: StudentMatchCandidate): Student[] {
    if (!candidate.grade) return [];

    return this.enrolledStudents.filter(student => {
      const nameMatch = this.isNameMatch(candidate, student);
      const gradeMatch = this.normalizeGrade(student.grade) === this.normalizeGrade(candidate.grade);
      return nameMatch && gradeMatch;
    });
  }

  private findNameMatches(candidate: StudentMatchCandidate): Student[] {
    return this.enrolledStudents.filter(student => 
      this.isNameMatch(candidate, student)
    );
  }

  private findFuzzyMatches(candidate: StudentMatchCandidate): Student[] {
    return this.enrolledStudents.filter(student => 
      this.isFuzzyNameMatch(candidate, student)
    );
  }

  private isNameMatch(candidate: StudentMatchCandidate, student: Student): boolean {
    const candidateFirst = this.normalizeName(candidate.firstName || '');
    const candidateLast = this.normalizeName(candidate.lastName || '');
    const studentFirst = this.normalizeName(student.firstName);
    const studentLast = this.normalizeName(student.lastName);

    // Try different name combinations
    if (candidateFirst && candidateLast) {
      return candidateFirst === studentFirst && candidateLast === studentLast;
    }

    // Handle full name field
    if (candidate.fullName) {
      const fullName = this.normalizeName(candidate.fullName);
      const studentFullName = this.normalizeName(`${student.firstName} ${student.lastName}`);
      const reverseStudentFullName = this.normalizeName(`${student.lastName} ${student.firstName}`);
      
      return fullName === studentFullName || fullName === reverseStudentFullName;
    }

    return false;
  }

  private isFuzzyNameMatch(candidate: StudentMatchCandidate, student: Student): boolean {
    const candidateName = this.formatName(candidate).toLowerCase();
    const studentName = `${student.firstName} ${student.lastName}`.toLowerCase();
    const reverseStudentName = `${student.lastName} ${student.firstName}`.toLowerCase();

    // Simple fuzzy matching - could be enhanced with Levenshtein distance
    const similarity1 = this.calculateSimilarity(candidateName, studentName);
    const similarity2 = this.calculateSimilarity(candidateName, reverseStudentName);
    
    return Math.max(similarity1, similarity2) > 0.8; // 80% similarity threshold
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const substitutionCost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + substitutionCost // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private normalizeName(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z]/g, '');
  }

  private normalizeGrade(grade: string | undefined): string {
    if (!grade) return '';
    
    // Handle various grade formats: "1st", "1", "First", "K", "Kindergarten"
    const normalized = grade.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const gradeMap: Record<string, string> = {
      'k': 'k',
      'kindergarten': 'k',
      'pre': 'pre',
      'prek': 'pre',
      'prekindergarten': 'pre',
      '1st': '1',
      '2nd': '2',
      '3rd': '3',
      '4th': '4',
      '5th': '5',
      '6th': '6',
      '7th': '7',
      '8th': '8',
      '9th': '9',
      '10th': '10',
      '11th': '11',
      '12th': '12',
      'first': '1',
      'second': '2',
      'third': '3',
      'fourth': '4',
      'fifth': '5',
      'sixth': '6',
      'seventh': '7',
      'eighth': '8',
      'ninth': '9',
      'tenth': '10',
      'eleventh': '11',
      'twelfth': '12'
    };

    return gradeMap[normalized] || normalized;
  }

  private formatName(candidate: StudentMatchCandidate): string {
    if (candidate.fullName) return candidate.fullName;
    if (candidate.firstName && candidate.lastName) {
      return `${candidate.firstName} ${candidate.lastName}`;
    }
    if (candidate.firstName) return candidate.firstName;
    if (candidate.lastName) return candidate.lastName;
    return 'Unknown';
  }

  private deduplicateStudents(students: Student[]): Student[] {
    const seen = new Set<string>();
    return students.filter(student => {
      if (seen.has(student.id)) return false;
      seen.add(student.id);
      return true;
    });
  }

  // Check if student enrollment data has been uploaded
  static async hasEnrollmentData(): Promise<boolean> {
    const count = await db.students.count();
    console.log('hasEnrollmentData check:', { count, hasData: count > 0 });
    return count > 0;
  }

  // Get enrollment statistics
  static async getEnrollmentStats(): Promise<{
    totalStudents: number;
    gradeDistribution: Record<string, number>;
    lastUpdated?: Date;
  }> {
    const students = await db.students.toArray();
    const gradeDistribution: Record<string, number> = {};
    
    students.forEach(student => {
      const grade = student.grade || 'Unknown';
      gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });

    // Get last enrollment upload date from data sources
    const enrollmentSource = await db.dataSources
      .where('type')
      .equals('focus')
      .orderBy('uploadDate')
      .last();

    return {
      totalStudents: students.length,
      gradeDistribution,
      lastUpdated: enrollmentSource?.uploadDate
    };
  }
}