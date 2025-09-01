import Dexie, { type Table } from 'dexie';
import type { 
  Student, 
  DataSource, 
  AttendanceRecord, 
  GradeRecord, 
  AssessmentRecord,
  DisciplineRecord,
  MatchingReport
} from '../../shared/types';
import type { SOBAObservation, SOBAStudentNote } from '../../services/sobaService';

export interface User {
  id?: number;
  email: string;
  name: string;
  role: string;
  password: string;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export interface Settings {
  id?: number;
  key: string;
  value: any;
}

class WasabiDatabase extends Dexie {
  // Declare tables
  users!: Table<User>;
  students!: Table<Student>;
  dataSources!: Table<DataSource>;
  attendance!: Table<AttendanceRecord>;
  grades!: Table<GradeRecord>;
  discipline!: Table<DisciplineRecord>;
  assessments!: Table<AssessmentRecord>;
  sobaObservations!: Table<SOBAObservation>;
  sobaStudentNotes!: Table<SOBAStudentNote>;
  matchingReports!: Table<MatchingReport>;
  settings!: Table<Settings>;

  constructor() {
    super('wasabi-db');
    
    this.version(1).stores({
      users: '++id, username',
      students: 'id, studentNumber, firstName, lastName, grade',
      dataSources: 'id, type, uploadDate',
      attendance: '[studentId+date], studentId, date',
      grades: '[studentId+term], studentId, term',
      assessments: '++id, studentId, source, testDate, subject',
      settings: 'key'
    });

    // Version 2: Drop and recreate grades table with new schema
    this.version(2).stores({
      users: '++id, username',
      students: 'id, studentNumber, firstName, lastName, grade',
      dataSources: 'id, type, uploadDate',
      attendance: '[studentId+date], studentId, date',
      grades: null, // Drop the old grades table
      assessments: '++id, studentId, source, testDate, subject',
      settings: 'key'
    });

    // Version 3: Recreate grades table with new schema
    this.version(3).stores({
      users: '++id, username',
      students: 'id, studentNumber, firstName, lastName, grade',
      dataSources: 'id, type, uploadDate',
      attendance: '[studentId+date], studentId, date',
      grades: '++id, studentId, course',
      assessments: '++id, studentId, source, testDate, subject',
      settings: 'key'
    });

    // Version 4: Add matching system support
    this.version(4).stores({
      users: '++id, username',
      students: 'id, studentNumber, firstName, lastName, grade, dateOfBirth',
      dataSources: 'id, type, uploadDate',
      attendance: '[studentId+date], studentId, date, matchedBy, matchConfidence',
      grades: '++id, studentId, course, matchedBy, matchConfidence',
      assessments: '++id, studentId, source, testDate, subject, matchedBy, matchConfidence',
      matchingReports: '++id, datasetType, uploadDate',
      settings: 'key'
    });

    // Version 5: Add FL ID support
    this.version(5).stores({
      users: '++id, username',
      students: 'id, studentNumber, flId, firstName, lastName, grade, dateOfBirth',
      dataSources: 'id, type, uploadDate',
      attendance: '[studentId+date], studentId, date, matchedBy, matchConfidence',
      grades: '++id, studentId, course, matchedBy, matchConfidence',
      assessments: '++id, studentId, source, testDate, subject, matchedBy, matchConfidence',
      matchingReports: '++id, datasetType, uploadDate',
      settings: 'key'
    });

    // Version 6: Add discipline support
    this.version(6).stores({
      users: '++id, username',
      students: 'id, studentNumber, flId, firstName, lastName, grade, dateOfBirth',
      dataSources: 'id, type, uploadDate',
      attendance: '[studentId+date], studentId, date, matchedBy, matchConfidence',
      grades: '++id, studentId, course, matchedBy, matchConfidence',
      discipline: '++id, studentId, incidentDate, infractionCode, matchedBy, matchConfidence',
      assessments: '++id, studentId, source, testDate, subject, matchedBy, matchConfidence',
      matchingReports: '++id, datasetType, uploadDate',
      settings: 'key'
    });

    // Version 7: Add SOBA support
    this.version(7).stores({
      users: '++id, username',
      students: 'id, studentNumber, flId, firstName, lastName, grade, dateOfBirth',
      dataSources: 'id, type, uploadDate',
      attendance: '[studentId+date], studentId, date, matchedBy, matchConfidence',
      grades: '++id, studentId, course, matchedBy, matchConfidence',
      discipline: '++id, studentId, incidentDate, infractionCode, matchedBy, matchConfidence',
      assessments: '++id, studentId, source, testDate, subject, matchedBy, matchConfidence',
      sobaObservations: 'observationId, homeroom, observationTimestamp',
      sobaStudentNotes: 'noteId, observationId, studentId, homeroom, noteTimestamp',
      matchingReports: '++id, datasetType, uploadDate',
      settings: 'key'
    });

    // Version 8: Update users table for admin system
    this.version(8).stores({
      users: '++id, email, name, role, isActive',
      students: 'id, studentNumber, flId, firstName, lastName, grade, dateOfBirth',
      dataSources: 'id, type, uploadDate',
      attendance: '[studentId+date], studentId, date, matchedBy, matchConfidence',
      grades: '++id, studentId, course, matchedBy, matchConfidence',
      discipline: '++id, studentId, incidentDate, infractionCode, matchedBy, matchConfidence',
      assessments: '++id, studentId, source, testDate, subject, matchedBy, matchConfidence',
      sobaObservations: 'observationId, homeroom, observationTimestamp',
      sobaStudentNotes: 'noteId, observationId, studentId, homeroom, noteTimestamp',
      matchingReports: '++id, datasetType, uploadDate',
      settings: 'key'
    }).upgrade(trans => {
      // Initialize default admin user
      return trans.table('users').add({
        email: 'techsupport@wayman.org',
        name: 'Tech Support',
        role: 'Administrator',
        password: 'OOoo00))',
        createdAt: new Date(),
        isActive: true
      });
    });
  }
}

export const db = new WasabiDatabase();