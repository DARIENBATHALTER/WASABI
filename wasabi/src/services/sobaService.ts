import { db } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';

// SOBA Observation Types
export interface SOBAObservation {
  observationId: string;
  homeroom: string;
  teacherName: string;
  observationTimestamp: Date;
  classEngagementScore: number;
  classEngagementNotes: string;
  teacherFeedbackNotes: string;
  teacherScorePlanning: number;
  teacherScoreDelivery: number;
  teacherScoreEnvironment: number;
  teacherScoreFeedback: number;
  createdBy: string; // User who created observation
}

export interface SOBAStudentNote {
  noteId: string;
  observationId?: string; // Optional - can be standalone note
  studentId: string; // WASABI student ID
  studentName: string; // Denormalized for quick access
  homeroom: string;
  noteTimestamp: Date;
  noteText: string;
  category?: 'engagement' | 'behavior' | 'academic' | 'strategy' | 'other';
  createdBy: string;
}

class SOBAService {
  // Initialize SOBA tables in IndexedDB
  async initializeSOBATables() {
    // Check if SOBA tables exist, if not create them
    const currentVersion = db.version;
    
    // We'll add observations and studentNotes to the existing db structure
    // This happens in the db.ts file upgrade
  }

  // Create new observation
  async createObservation(observation: Omit<SOBAObservation, 'observationId'>): Promise<SOBAObservation> {
    const newObservation: SOBAObservation = {
      ...observation,
      observationId: uuidv4(),
      observationTimestamp: new Date(observation.observationTimestamp)
    };

    await db.sobaObservations.add(newObservation);
    return newObservation;
  }

  // Get observations by homeroom
  async getObservationsByHomeroom(homeroom: string): Promise<SOBAObservation[]> {
    return await db.sobaObservations
      .where('homeroom')
      .equals(homeroom)
      .reverse()
      .sortBy('observationTimestamp');
  }

  // Get all observations
  async getAllObservations(): Promise<SOBAObservation[]> {
    return await db.sobaObservations
      .reverse()
      .sortBy('observationTimestamp');
  }

  // Create student note
  async createStudentNote(note: Omit<SOBAStudentNote, 'noteId'>): Promise<SOBAStudentNote> {
    const newNote: SOBAStudentNote = {
      ...note,
      noteId: uuidv4(),
      noteTimestamp: new Date(note.noteTimestamp)
    };

    await db.sobaStudentNotes.add(newNote);
    return newNote;
  }

  // Get notes for a specific student
  async getNotesByStudentId(studentId: string): Promise<SOBAStudentNote[]> {
    console.log(`🔍 SOBA SERVICE DEBUG: Querying notes for studentId: "${studentId}"`);
    
    // First, let's see all notes in the database
    const allNotes = await db.sobaStudentNotes.toArray();
    console.log(`📝 SOBA SERVICE DEBUG: Total notes in database: ${allNotes.length}`);
    console.log(`📝 SOBA SERVICE DEBUG: Sample notes:`, allNotes.slice(0, 3));
    
    // Check if any notes match the studentId (with different formats)
    const matchingNotes = allNotes.filter(note => 
      note.studentId === studentId ||
      note.studentId === String(studentId) ||
      note.studentId === Number(studentId)
    );
    console.log(`🎯 SOBA SERVICE DEBUG: Matching notes for "${studentId}":`, matchingNotes);
    
    // Since the Dexie query isn't working, use the manual filter approach for now
    // This is a workaround until we fix the indexing issue
    const filteredResults = allNotes
      .filter(note => 
        note.studentId === studentId ||
        note.studentId === String(studentId) ||
        String(note.studentId) === String(studentId)
      )
      .sort((a, b) => new Date(b.noteTimestamp).getTime() - new Date(a.noteTimestamp).getTime());
    
    console.log(`📋 SOBA SERVICE DEBUG: Filtered results:`, filteredResults);
    
    // Also try the original query for comparison
    const dexieResults = await db.sobaStudentNotes
      .where('studentId')
      .equals(studentId)
      .reverse()
      .sortBy('noteTimestamp');
      
    console.log(`🔍 SOBA SERVICE DEBUG: Dexie query results:`, dexieResults);
    
    return filteredResults; // Use manual filtering for now
  }

  // Get notes for an observation
  async getNotesByObservationId(observationId: string): Promise<SOBAStudentNote[]> {
    return await db.sobaStudentNotes
      .where('observationId')
      .equals(observationId)
      .toArray();
  }

  // Get notes by homeroom
  async getNotesByHomeroom(homeroom: string): Promise<SOBAStudentNote[]> {
    return await db.sobaStudentNotes
      .where('homeroom')
      .equals(homeroom)
      .reverse()
      .sortBy('noteTimestamp');
  }

  // Update observation
  async updateObservation(observationId: string, updates: Partial<SOBAObservation>): Promise<void> {
    await db.sobaObservations.update(observationId, updates);
  }

  // Delete observation and associated notes
  async deleteObservation(observationId: string): Promise<void> {
    // Delete observation
    await db.sobaObservations.delete(observationId);
    
    // Delete associated notes
    const notes = await this.getNotesByObservationId(observationId);
    for (const note of notes) {
      await db.sobaStudentNotes.delete(note.noteId);
    }
  }

  // Delete student note
  async deleteStudentNote(noteId: string): Promise<void> {
    await db.sobaStudentNotes.delete(noteId);
  }

  // Get recent activity for dashboard
  async getRecentActivity(limit: number = 10): Promise<{
    observations: SOBAObservation[];
    notes: SOBAStudentNote[];
  }> {
    const observations = await db.sobaObservations
      .reverse()
      .limit(limit)
      .sortBy('observationTimestamp');
    
    const notes = await db.sobaStudentNotes
      .reverse()
      .limit(limit)
      .sortBy('noteTimestamp');

    return { observations, notes };
  }

  // Get statistics for a homeroom
  async getHomeroomStats(homeroom: string): Promise<{
    totalObservations: number;
    averageEngagement: number;
    totalNotes: number;
    recentObservation?: SOBAObservation;
  }> {
    const observations = await this.getObservationsByHomeroom(homeroom);
    const notes = await this.getNotesByHomeroom(homeroom);
    
    const avgEngagement = observations.length > 0
      ? observations.reduce((sum, obs) => sum + obs.classEngagementScore, 0) / observations.length
      : 0;

    return {
      totalObservations: observations.length,
      averageEngagement: Math.round(avgEngagement * 10) / 10,
      totalNotes: notes.length,
      recentObservation: observations[0]
    };
  }

  // Get unique homerooms from students
  async getHomerooms(): Promise<string[]> {
    const students = await db.students.toArray();
    const homerooms = [...new Set(students.map(s => s.className).filter(Boolean))];
    return homerooms.sort();
  }

  // Get unique instructors with mapped names
  async getInstructors(): Promise<string[]> {
    const { instructorNameMappingService } = await import('./instructorNameMapping');
    const students = await db.students.toArray();
    
    // Get unique original instructor names (check both homeRoomTeacher and className)
    const instructorNames: string[] = [];
    students.forEach(student => {
      const teacherName = student.homeRoomTeacher || student.className;
      if (teacherName) {
        instructorNames.push(teacherName);
      }
    });
    
    const originalInstructors = [...new Set(instructorNames)].filter(Boolean);
    
    // Apply mappings
    const mappedInstructors = await instructorNameMappingService.mapInstructorNames(originalInstructors);
    return mappedInstructors.sort();
  }

  // Get a single observation by ID
  async getObservation(observationId: string): Promise<SOBAObservation | null> {
    try {
      const observation = await db.sobaObservations.get(observationId);
      return observation || null;
    } catch (error) {
      console.error('Error fetching observation:', error);
      return null;
    }
  }

  // Get student notes by observation ID
  async getStudentNotesByObservation(observationId: string): Promise<SOBAStudentNote[]> {
    try {
      const notes = await db.sobaStudentNotes
        .where('observationId')
        .equals(observationId)
        .toArray();
      
      return notes.sort((a, b) => new Date(b.noteTimestamp).getTime() - new Date(a.noteTimestamp).getTime());
    } catch (error) {
      console.error('Error fetching student notes:', error);
      return [];
    }
  }

  // Update an existing observation
  async updateObservation(observationId: string, observationData: Partial<SOBAObservation>): Promise<SOBAObservation | null> {
    try {
      const existingObservation = await db.sobaObservations.get(observationId);
      if (!existingObservation) {
        throw new Error('Observation not found');
      }

      const updatedObservation: SOBAObservation = {
        ...existingObservation,
        ...observationData,
        observationTimestamp: observationData.observationTimestamp || existingObservation.observationTimestamp
      };

      await db.sobaObservations.put(updatedObservation);
      return updatedObservation;
    } catch (error) {
      console.error('Error updating observation:', error);
      throw error;
    }
  }

  // Delete student notes by observation ID (for updates)
  async deleteStudentNotesByObservation(observationId: string): Promise<void> {
    try {
      await db.sobaStudentNotes
        .where('observationId')
        .equals(observationId)
        .delete();
    } catch (error) {
      console.error('Error deleting student notes:', error);
      throw error;
    }
  }
}

export const sobaService = new SOBAService();