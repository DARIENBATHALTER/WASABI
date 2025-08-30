// Core data types for WASABI

export interface Student {
  id: string; // This is now the WASABI ID
  studentNumber: string; // District student ID (DCPS ID - 8 digits)
  flId?: string; // Florida Education Identifier (14 chars starting with FL)
  firstName: string;
  lastName: string;
  grade: string;
  className?: string;
  photo?: string;
  gender?: 'male' | 'female' | 'other' | 'undisclosed';
  flags: StudentFlag[];
  // Additional fields for enhanced matching
  dateOfBirth?: string;
  homeRoomTeacher?: string;
  createdAt?: Date;
  lastUpdated?: Date;
}

export interface StudentFlag {
  id: string;
  type: 'attendance' | 'academic' | 'behavior';
  severity: 'low' | 'medium' | 'high';
  message: string;
  date: Date;
}

export interface DataSource {
  id: string;
  name: string;
  type: 'student-enrollment' | 'attendance' | 'grades' | 'discipline' | 'iready' | 'fast' | 'star' | 'achieve3000';
  uploadDate: Date;
  recordCount: number;
}

export interface AttendanceRecord {
  studentId: string; // WASABI ID
  date: Date;
  status: 'present' | 'absent' | 'tardy' | 'early_dismissal';
  // Matching metadata
  matchedBy?: 'id' | 'name' | 'criteria';
  matchConfidence?: number;
  originalStudentId?: string; // Original ID from source dataset
  [key: string]: any; // Allow additional dynamic fields from CSV
}

export interface GradeRecord {
  studentId: string; // WASABI ID
  studentName?: string;
  course: string;
  gradeLevel?: string;
  teacher?: string;
  grades: GradePeriod[];
  // Matching metadata
  matchedBy?: 'id' | 'name' | 'criteria';
  matchConfidence?: number;
  originalStudentId?: string; // Original ID from source dataset
  [key: string]: any; // Allow additional dynamic fields from CSV
}

export interface GradePeriod {
  period: string;
  grade: string;
}

export interface DisciplineRecord {
  studentId: string; // WASABI ID
  studentName?: string;
  incidentDate: Date;
  submissionDate?: Date;
  infraction: string;
  infractionCode: string;
  incident?: string;
  action: string;
  location: string;
  reporter?: string;
  administrator?: string;
  // Detailed incident info
  narrative?: string;
  previousActions?: string;
  adminFindings?: string;
  adminSummary?: string;
  // Categorization fields
  bullying?: boolean;
  gangRelated?: boolean;
  weaponUse?: boolean;
  alcoholUse?: boolean;
  drugUse?: boolean;
  hateCrime?: boolean;
  // Action details
  actionDays?: number;
  actionStart?: Date;
  actionEnd?: Date;
  suspensionType?: 'in-school' | 'out-of-school' | 'other';
  // Matching metadata
  matchedBy?: 'id' | 'name' | 'criteria';
  matchConfidence?: number;
  originalStudentId?: string;
  [key: string]: any; // Allow additional dynamic fields from CSV
}

export interface AssessmentRecord {
  studentId: string; // WASABI ID
  source: string;
  testDate: Date;
  subject: string;
  score: number;
  percentile?: number;
  gradeLevel?: string;
  proficiency?: 'below' | 'approaching' | 'meets' | 'exceeds';
  // Matching metadata
  matchedBy?: 'id' | 'name' | 'criteria';
  matchConfidence?: number;
  originalStudentId?: string; // Original ID from source dataset
  [key: string]: any; // Allow additional dynamic fields from CSV
}

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  matchingReport?: MatchingReport;
}

// Student matching types
export interface MatchingReport {
  id?: number;
  datasetType: string;
  datasetName: string;
  uploadDate: Date;
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

export interface StudentMatchMetadata {
  wasabiId: string;
  confidence: number;
  matchedBy: 'id' | 'name' | 'criteria';
  matchDetails: {
    idMatch?: boolean;
    nameMatch?: number;
    gradeMatch?: boolean;
    teacherMatch?: boolean;
    dobMatch?: boolean;
  };
}