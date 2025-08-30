import { db } from '../lib/db';

export interface InstructorNameMapping {
  [originalName: string]: string;
}

class InstructorNameMappingService {
  private mappings: InstructorNameMapping = {};
  private loaded = false;

  // Load mappings from database
  async loadMappings(): Promise<InstructorNameMapping> {
    try {
      const settings = await db.settings.get('instructorNameMappings');
      this.mappings = settings?.value || {};
      this.loaded = true;
      return this.mappings;
    } catch (error) {
      console.error('Error loading instructor name mappings:', error);
      this.mappings = {};
      this.loaded = true;
      return {};
    }
  }

  // Get display name for an instructor (with automatic loading if needed)
  async getDisplayName(originalName: string): Promise<string> {
    if (!this.loaded) {
      await this.loadMappings();
    }
    return this.mappings[originalName] || originalName;
  }

  // Get display name synchronously (mappings must be pre-loaded)
  getDisplayNameSync(originalName: string): string {
    if (!this.loaded) {
      console.warn('Instructor mappings not loaded, returning original name');
      return originalName;
    }
    return this.mappings[originalName] || originalName;
  }

  // Apply mappings to a list of instructor names
  async mapInstructorNames(originalNames: string[]): Promise<string[]> {
    if (!this.loaded) {
      await this.loadMappings();
    }
    return originalNames.map(name => this.mappings[name] || name);
  }

  // Apply mappings to instructor names in student data
  async applyMappingsToStudents(students: any[]): Promise<any[]> {
    if (!this.loaded) {
      await this.loadMappings();
    }
    
    return students.map(student => ({
      ...student,
      homeRoomTeacher: student.homeRoomTeacher ? 
        (this.mappings[student.homeRoomTeacher] || student.homeRoomTeacher) : 
        student.homeRoomTeacher,
      className: student.className ? 
        (this.mappings[student.className] || student.className) : 
        student.className
    }));
  }

  // Save mappings to database
  async saveMappings(mappings: InstructorNameMapping): Promise<void> {
    try {
      await db.settings.put({
        key: 'instructorNameMappings',
        value: mappings
      });
      this.mappings = mappings;
      this.loaded = true;
    } catch (error) {
      console.error('Error saving instructor name mappings:', error);
      throw error;
    }
  }

  // Clear all mappings
  async clearMappings(): Promise<void> {
    try {
      await db.settings.delete('instructorNameMappings');
      this.mappings = {};
      this.loaded = true;
    } catch (error) {
      console.error('Error clearing instructor name mappings:', error);
      throw error;
    }
  }

  // Force reload mappings from database
  async reloadMappings(): Promise<InstructorNameMapping> {
    this.loaded = false;
    return await this.loadMappings();
  }
}

export const instructorNameMappingService = new InstructorNameMappingService();