import { db } from '../lib/db';

export interface StudentNameMap {
  wasabiId: string;
  name: string;
  studentNumber: string;
}

export class StudentNameTranslationService {
  private static studentNameMap: Map<string, StudentNameMap> = new Map();
  private static nameToWasabiMap: Map<string, string> = new Map();
  private static wasabiToNameMap: Map<string, string> = new Map();
  private static lastCacheUpdate: Date | null = null;
  private static readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Initialize/refresh the student name mapping cache
  static async refreshCache(): Promise<void> {
    console.log('🔄 Refreshing student name translation cache...');
    
    try {
      const students = await db.students.toArray();
      
      this.studentNameMap.clear();
      this.nameToWasabiMap.clear();
      this.wasabiToNameMap.clear();
      
      students.forEach(student => {
        const fullName = `${student.firstName} ${student.lastName}`.trim();
        const firstName = student.firstName?.trim().toLowerCase();
        const lastName = student.lastName?.trim().toLowerCase();
        const fullNameLower = fullName.toLowerCase();
        
        const studentMap: StudentNameMap = {
          wasabiId: student.id,
          name: fullName,
          studentNumber: student.studentNumber || student.id
        };
        
        // Store in main map
        this.studentNameMap.set(student.id, studentMap);
        
        // Create multiple name mappings for flexible matching
        this.nameToWasabiMap.set(fullNameLower, student.id);
        this.wasabiToNameMap.set(student.id, fullName);
        
        // Also map by first name + last initial (e.g., "John D")
        if (firstName && lastName) {
          const firstNameLastInitial = `${firstName} ${lastName.charAt(0)}`;
          this.nameToWasabiMap.set(firstNameLastInitial, student.id);
          
          // Map by last name, first name format
          const lastNameFirstName = `${lastName}, ${firstName}`;
          this.nameToWasabiMap.set(lastNameFirstName, student.id);
        }
        
        // Map by student number as well
        if (student.studentNumber) {
          this.nameToWasabiMap.set(student.studentNumber, student.id);
        }
      });
      
      this.lastCacheUpdate = new Date();
      console.log(`✅ Cached ${students.length} student name mappings`);
      
    } catch (error) {
      console.error('❌ Error refreshing student name cache:', error);
      throw error;
    }
  }
  
  // Ensure cache is fresh
  private static async ensureFreshCache(): Promise<void> {
    if (!this.lastCacheUpdate || 
        Date.now() - this.lastCacheUpdate.getTime() > this.CACHE_DURATION) {
      await this.refreshCache();
    }
  }
  
  // Find student by name (fuzzy matching)
  static async findStudentByName(nameQuery: string): Promise<StudentNameMap | null> {
    await this.ensureFreshCache();
    
    const queryLower = nameQuery.toLowerCase().trim();
    
    // Direct match first
    const directMatch = this.nameToWasabiMap.get(queryLower);
    if (directMatch) {
      return this.studentNameMap.get(directMatch) || null;
    }
    
    // Fuzzy matching
    const candidates: Array<{ student: StudentNameMap; score: number }> = [];
    
    this.studentNameMap.forEach(student => {
      const studentNameLower = student.name.toLowerCase();
      const score = this.calculateNameSimilarity(queryLower, studentNameLower);
      
      if (score > 0.6) { // Threshold for fuzzy matching
        candidates.push({ student, score });
      }
    });
    
    // Return the best match
    if (candidates.length > 0) {
      candidates.sort((a, b) => b.score - a.score);
      return candidates[0].student;
    }
    
    return null;
  }
  
  // Calculate name similarity (Levenshtein-based)
  private static calculateNameSimilarity(query: string, target: string): number {
    const queryNormalized = query.toLowerCase().trim();
    const targetNormalized = target.toLowerCase().trim();
    
    if (queryNormalized === targetNormalized) return 1.0;
    
    // Check if query is contained in target or vice versa
    if (targetNormalized.includes(queryNormalized) || queryNormalized.includes(targetNormalized)) {
      return 0.8;
    }
    
    // Simple word overlap scoring
    const queryWords = queryNormalized.split(' ').filter(w => w.length > 1);
    const targetWords = targetNormalized.split(' ').filter(w => w.length > 1);
    
    let matchingWords = 0;
    queryWords.forEach(queryWord => {
      if (targetWords.some(targetWord => 
          targetWord.startsWith(queryWord) || queryWord.startsWith(targetWord)
      )) {
        matchingWords++;
      }
    });
    
    return queryWords.length > 0 ? matchingWords / queryWords.length : 0;
  }
  
  // Get student name by WASABI ID
  static async getNameByWasabiId(wasabiId: string): Promise<string | null> {
    await this.ensureFreshCache();
    return this.wasabiToNameMap.get(wasabiId) || null;
  }
  
  // Get WASABI ID by name
  static async getWasabiIdByName(name: string): Promise<string | null> {
    const student = await this.findStudentByName(name);
    return student?.wasabiId || null;
  }
  
  // Translate user message: replace student names with WASABI IDs
  static async translateNamesToIds(message: string): Promise<{
    translatedMessage: string;
    translations: Array<{ originalName: string; wasabiId: string; studentName: string; }>;
  }> {
    await this.ensureFreshCache();
    console.log('🔄 Translating message:', message);
    
    let translatedMessage = message;
    const translations: Array<{ originalName: string; wasabiId: string; studentName: string; }> = [];
    
    // Look for potential student names in the message
    // This regex looks for quoted names, capitalized names, or student numbers
    const namePatterns = [
      /["']([^"']+)["']/g, // Quoted names
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g, // Traditional capitalized names (John Smith)
      /\b([A-Z]{2,}\s+[A-Z]{2,})\b/g, // All uppercase names (KIYOMI WILCOX)
      /\b([A-Z][A-Z\s]+[A-Z])\b/g, // Mixed case uppercase names
      /\b([a-z]+\s+[a-z]+)\b/g, // All lowercase names (john smith)
      /\b(\d{6,9})\b/g, // Student numbers
    ];
    
    for (const pattern of namePatterns) {
      const matches = [...message.matchAll(pattern)];
      
      for (const match of matches) {
        const potentialName = match[1] || match[0];
        console.log('🔍 Checking potential name:', potentialName);
        const student = await this.findStudentByName(potentialName);
        
        if (student) {
          console.log('✅ Found student:', potentialName, '→', student.wasabiId, student.name);
          // Replace the name with WASABI ID in the message
          translatedMessage = translatedMessage.replace(
            match[0], 
            `Student ${student.wasabiId}`
          );
          
          translations.push({
            originalName: potentialName,
            wasabiId: student.wasabiId,
            studentName: student.name
          });
        } else {
          console.log('❌ No student found for:', potentialName);
        }
      }
    }
    
    return { translatedMessage, translations };
  }
  
  // Translate AI response: replace WASABI IDs with student names
  static async translateIdsToNames(response: string): Promise<string> {
    await this.ensureFreshCache();
    console.log('🔍 Translating response:', response);
    
    let translatedResponse = response;
    
    // Look for WASABI ID patterns in various formats
    const patterns = [
      // Pattern 1: [Wasabi ID: wasabi_xxx] format
      /\[Wasabi ID:\s*(wasabi_[0-9_]+)\]/gi,
      // Pattern 2: (ID: wasabi_xxx) format  
      /\(ID:\s*(wasabi_[0-9_]+)\)/gi,
      // Pattern 3: Student wasabi_xxx format
      /Student\s+(wasabi_[0-9_]+)/gi,
      // Pattern 4: [Student Name] followed by actual name - this is a broken format we need to fix
      /\[Student Name\]\s+([A-Z][a-z]+(?:\s+[A-Z][a-z']+)*)/gi,
      // Pattern 5: "wasabi_xxx" in quotes
      /"(wasabi_[0-9_]+)"/gi,
      // Pattern 6: Common phrases with WASABI IDs
      /(?:belongs to|is|performer is|student is)\s+(wasabi_[0-9_]+)/gi,
      // Pattern 7: Just bare wasabi_xxx format (should be last to avoid conflicts)
      /(wasabi_[0-9_]+)/gi
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const matches = [...response.matchAll(pattern)];
      console.log(`🔍 Pattern ${i + 1} (${pattern}) found ${matches.length} matches`);
      
      for (const match of matches) {
        if (i === 3) { // Pattern 4: [Student Name] actual name - special handling
          const actualName = match[1];
          console.log('🔍 Found broken [Student Name] format with actual name:', actualName);
          // Just replace with the actual name
          translatedResponse = translatedResponse.replace(match[0], actualName);
          console.log('✅ Fixed broken format:', match[0], '→', actualName);
        } else if (i === 5) { // Pattern 6: Common phrases - extract the WASABI ID
          const wasabiId = match[1];
          console.log('🔍 Found WASABI ID in phrase:', wasabiId);
          const studentName = await this.getNameByWasabiId(wasabiId);
          
          if (studentName) {
            console.log('✅ Translating phrase:', match[0], '→', match[0].replace(wasabiId, studentName));
            translatedResponse = translatedResponse.replace(match[0], match[0].replace(wasabiId, studentName));
          } else {
            console.log('❌ No student found for WASABI ID in phrase:', wasabiId);
          }
        } else {
          const wasabiId = match[1];
          console.log('🔍 Checking WASABI ID:', wasabiId);
          const studentName = await this.getNameByWasabiId(wasabiId);
          
          if (studentName) {
            console.log('✅ Translating:', wasabiId, '→', studentName);
            // Replace the entire match with just the student name
            translatedResponse = translatedResponse.replace(match[0], studentName);
          } else {
            console.log('❌ No student found for WASABI ID:', wasabiId);
          }
        }
      }
    }
    
    // Final cleanup: Remove any remaining [Student Name] placeholders that weren't caught
    translatedResponse = translatedResponse.replace(/\[Student Name\]\s*/gi, '');
    
    console.log('🔄 Translation result:', translatedResponse);
    return translatedResponse;
  }
  
  // Get all students for reference (useful for debugging)
  static async getAllStudentMappings(): Promise<StudentNameMap[]> {
    await this.ensureFreshCache();
    return Array.from(this.studentNameMap.values());
  }
  
  // Search students by partial name
  static async searchStudentsByName(query: string, limit: number = 10): Promise<StudentNameMap[]> {
    await this.ensureFreshCache();
    
    if (!query || query.length < 2) return [];
    
    const queryLower = query.toLowerCase().trim();
    const matches: Array<{ student: StudentNameMap; score: number }> = [];
    
    this.studentNameMap.forEach(student => {
      const nameLower = student.name.toLowerCase();
      const score = this.calculateNameSimilarity(queryLower, nameLower);
      
      if (score > 0.3 || nameLower.includes(queryLower)) {
        matches.push({ student, score });
      }
    });
    
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(m => m.student);
  }
}