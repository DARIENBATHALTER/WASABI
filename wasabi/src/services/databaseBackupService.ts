import { db } from '../lib/db';
import type { Student } from '../lib/db';

interface DatabaseBackup {
  version: string;
  exportDate: string;
  schoolName?: string;
  schoolYear?: string;
  data: {
    users: any[];
    students: any[];
    assessments: any[];
    attendance: any[];
    discipline: any[];
    grades: any[];
    sobaStudentNotes: any[];
    sobaObservations: any[];
    settings: any[];
    flagRules: any[];
  };
  metadata: {
    userCount: number;
    studentCount: number;
    assessmentCount: number;
    attendanceCount: number;
    disciplineCount: number;
    gradeCount: number;
    sobaNotesCount: number;
    sobaObservationsCount: number;
    settingsCount: number;
    flagRulesCount: number;
  };
}

class DatabaseBackupService {
  private readonly BACKUP_VERSION = '1.0.0';

  async exportDatabase(): Promise<Blob> {
    try {
      console.log('📦 Starting database export...');
      
      // Collect all data from each table
      const [
        users,
        students,
        assessments,
        attendance,
        discipline,
        grades,
        sobaStudentNotes,
        sobaObservations,
        settings,
        flagRules
      ] = await Promise.all([
        db.users.toArray(),
        db.students.toArray(),
        db.assessments.toArray(),
        db.attendance.toArray(),
        db.discipline.toArray(),
        db.grades.toArray(),
        db.sobaStudentNotes?.toArray() || Promise.resolve([]),
        db.sobaObservations?.toArray() || Promise.resolve([]),
        db.settings.toArray(),
        // Flag rules are stored in localStorage, get them from there
        new Promise(resolve => {
          const flagRulesData = localStorage.getItem('wasabi-flag-rules');
          const rules = flagRulesData ? JSON.parse(flagRulesData) : [];
          resolve(rules);
        })
      ]);

      // Create backup object
      const backup: DatabaseBackup = {
        version: this.BACKUP_VERSION,
        exportDate: new Date().toISOString(),
        schoolName: 'Wayman Academy', // Could make this configurable
        schoolYear: '2024-2025', // Could make this configurable
        data: {
          users,
          students,
          assessments,
          attendance,
          discipline,
          grades,
          sobaStudentNotes,
          sobaObservations,
          settings,
          flagRules
        },
        metadata: {
          userCount: users.length,
          studentCount: students.length,
          assessmentCount: assessments.length,
          attendanceCount: attendance.length,
          disciplineCount: discipline.length,
          gradeCount: grades.length,
          sobaNotesCount: sobaStudentNotes.length,
          sobaObservationsCount: sobaObservations.length,
          settingsCount: settings.length,
          flagRulesCount: flagRules.length
        }
      };

      console.log('📊 Export summary:', backup.metadata);
      
      // Convert to JSON and create blob
      const jsonString = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      console.log('✅ Database export complete');
      return blob;
    } catch (error) {
      console.error('❌ Database export failed:', error);
      throw new Error('Failed to export database: ' + (error as Error).message);
    }
  }

  async importDatabase(file: File, replaceExisting: boolean = false): Promise<void> {
    try {
      console.log('📥 Starting database import...');
      
      // Read and parse the file
      const text = await file.text();
      const backup: DatabaseBackup = JSON.parse(text);
      
      // Validate backup structure
      if (!backup.version || !backup.data) {
        throw new Error('Invalid backup file format');
      }
      
      console.log('📋 Import summary:', backup.metadata);
      console.log(`📅 Backup date: ${new Date(backup.exportDate).toLocaleDateString()}`);
      
      if (replaceExisting) {
        console.log('🗑️ Clearing existing data...');
        // Clear all database tables before import
        await Promise.all([
          db.users.clear(),
          db.students.clear(),
          db.assessments.clear(),
          db.attendance.clear(),
          db.discipline.clear(),
          db.grades.clear(),
          db.sobaStudentNotes?.clear() || Promise.resolve(),
          db.sobaObservations?.clear() || Promise.resolve(),
          db.settings.clear()
        ]);
        
        // Clear localStorage flag rules
        localStorage.removeItem('wasabi-flag-rules');
      }
      
      // Import data with progress tracking
      console.log('👥 Importing users...');
      if (backup.data.users?.length > 0) {
        await db.users.bulkAdd(backup.data.users).catch(error => {
          if (!replaceExisting && error.name === 'ConstraintError') {
            console.log('⚠️ Some users already exist, skipping duplicates');
          } else {
            throw error;
          }
        });
      }
      
      console.log('📝 Importing students...');
      if (backup.data.students?.length > 0) {
        await db.students.bulkAdd(backup.data.students).catch(error => {
          if (!replaceExisting && error.name === 'ConstraintError') {
            console.log('⚠️ Some students already exist, skipping duplicates');
          } else {
            throw error;
          }
        });
      }
      
      console.log('📊 Importing assessments...');
      if (backup.data.assessments?.length > 0) {
        await db.assessments.bulkAdd(backup.data.assessments).catch(error => {
          if (!replaceExisting && error.name === 'ConstraintError') {
            console.log('⚠️ Some assessments already exist, skipping duplicates');
          } else {
            throw error;
          }
        });
      }
      
      console.log('📅 Importing attendance...');
      if (backup.data.attendance?.length > 0) {
        await db.attendance.bulkAdd(backup.data.attendance).catch(error => {
          if (!replaceExisting) {
            console.log('⚠️ Some attendance records already exist, skipping duplicates');
          }
        });
      }
      
      console.log('⚠️ Importing discipline...');
      if (backup.data.discipline?.length > 0) {
        await db.discipline.bulkAdd(backup.data.discipline).catch(error => {
          if (!replaceExisting) {
            console.log('⚠️ Some discipline records already exist, skipping duplicates');
          }
        });
      }
      
      console.log('📚 Importing grades...');
      if (backup.data.grades?.length > 0) {
        await db.grades.bulkAdd(backup.data.grades).catch(error => {
          if (!replaceExisting) {
            console.log('⚠️ Some grade records already exist, skipping duplicates');
          }
        });
      }
      
      console.log('📝 Importing SOBA notes...');
      if (backup.data.sobaStudentNotes?.length > 0) {
        await db.sobaStudentNotes?.bulkAdd(backup.data.sobaStudentNotes).catch(error => {
          if (!replaceExisting) {
            console.log('⚠️ Some SOBA notes already exist, skipping duplicates');
          }
        });
      }
      
      console.log('👁️ Importing SOBA observations...');
      if (backup.data.sobaObservations?.length > 0) {
        await db.sobaObservations?.bulkAdd(backup.data.sobaObservations).catch(error => {
          if (!replaceExisting) {
            console.log('⚠️ Some SOBA observations already exist, skipping duplicates');
          }
        });
      }
      
      console.log('⚙️ Importing settings (including instructor mappings)...');
      if (backup.data.settings?.length > 0) {
        await db.settings.bulkAdd(backup.data.settings).catch(error => {
          if (!replaceExisting && error.name === 'ConstraintError') {
            console.log('⚠️ Some settings already exist, skipping duplicates');
          } else {
            throw error;
          }
        });
      }
      
      console.log('🚩 Importing flag rules...');
      if (backup.data.flagRules?.length > 0) {
        // Flag rules are stored in localStorage
        if (replaceExisting) {
          localStorage.setItem('wasabi-flag-rules', JSON.stringify(backup.data.flagRules));
        } else {
          // Merge with existing flag rules
          const existingFlagRulesData = localStorage.getItem('wasabi-flag-rules');
          const existingFlagRules = existingFlagRulesData ? JSON.parse(existingFlagRulesData) : [];
          const mergedFlagRules = [...existingFlagRules, ...backup.data.flagRules];
          
          // Remove duplicates based on rule name/id
          const uniqueFlagRules = mergedFlagRules.filter((rule, index, self) => 
            index === self.findIndex(r => r.name === rule.name)
          );
          
          localStorage.setItem('wasabi-flag-rules', JSON.stringify(uniqueFlagRules));
        }
      }
      
      console.log('✅ Database import complete!');
      
      // Verify import
      const counts = await this.getDatabaseCounts();
      console.log('📊 Current database counts:', counts);
      
    } catch (error) {
      console.error('❌ Database import failed:', error);
      throw new Error('Failed to import database: ' + (error as Error).message);
    }
  }

  async getDatabaseCounts() {
    const [
      userCount,
      studentCount,
      assessmentCount,
      attendanceCount,
      disciplineCount,
      gradeCount,
      sobaNotesCount,
      sobaObservationsCount,
      settingsCount
    ] = await Promise.all([
      db.users.count(),
      db.students.count(),
      db.assessments.count(),
      db.attendance.count(),
      db.discipline.count(),
      db.grades.count(),
      db.sobaStudentNotes?.count() || Promise.resolve(0),
      db.sobaObservations?.count() || Promise.resolve(0),
      db.settings.count()
    ]);

    // Get flag rules count from localStorage
    const flagRulesData = localStorage.getItem('wasabi-flag-rules');
    const flagRulesCount = flagRulesData ? JSON.parse(flagRulesData).length : 0;

    return {
      userCount,
      studentCount,
      assessmentCount,
      attendanceCount,
      disciplineCount,
      gradeCount,
      sobaNotesCount,
      sobaObservationsCount,
      settingsCount,
      flagRulesCount
    };
  }

  downloadBackup(blob: Blob, filename?: string) {
    const date = new Date().toISOString().split('T')[0];
    const defaultFilename = `wasabi_backup_${date}.json`;
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || defaultFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const databaseBackupService = new DatabaseBackupService();