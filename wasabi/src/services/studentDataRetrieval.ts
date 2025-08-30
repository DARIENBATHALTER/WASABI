import { db } from '../lib/db';
import type { 
  EnhancedStudentProfile, 
  EnhancedAttendanceRecord, 
  EnhancedDisciplineRecord, 
  EnhancedAssessmentRecord,
  EnhancedGradeRecord 
} from '../shared/types/enhanced-types';

export interface StudentDataContext {
  students: Array<{
    id: string;
    name: string;
    studentNumber: string;
    grade: string;
    className?: string;
    gender?: string;
    firstName?: string;
    lastName?: string;
    birthDate?: string;
  }>;
  attendance: Array<{
    studentId: string;
    studentName: string;
    rate: number;
    presentDays: number;
    totalDays: number;
    absentDays: number;
    tardyDays: number;
    chronicAbsenteeism: boolean;
    recentRecords: Array<{ date: string; status: string; attendanceCode?: string; }>;
    monthlyBreakdown: Array<{ month: string; rate: number; present: number; absent: number; }>;
    allAttendanceRecords: Array<{ date: string; status: string; attendanceCode: string; dayOfWeek: string; month: string; }>;
  }>;
  grades: Array<{
    studentId: string;
    studentName: string;
    averageGrade: number;
    gradeCount: number;
    subjects: Array<{ 
      subject: string; 
      grade: number; 
      recentGrades: Array<{ date: string; grade: number; assignment?: string; }>;
      allGrades: Array<{ date: string; grade: number; assignment?: string; }>;
      lowestGrade: number;
      highestGrade: number;
      gradeCount: number;
      passingGradeCount: number;
      failingGradeCount: number;
    }>;
    gpaScale: number; // 4.0 scale
    letterGrade: string;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  assessments: Array<{
    studentId: string;
    studentName: string;
    iReadyReading: Array<{
      testDate: string;
      score: number;
      gradeLevel: string;
      percentile: number;
      lexileLevel?: number;
      phonologicalAwareness: number;
      phonics: number;
      highFrequencyWords: number;
      vocabulary: number;
      comprehensionLiterature: number;
      comprehensionInformational: number;
      overallReadingScore: number;
      placement: string;
      diagnosticStatus: string;
    }>;
    iReadyMath: Array<{
      testDate: string;
      score: number;
      gradeLevel: string;
      percentile: number;
      numberAndOperations: number;
      algebraAndAlgebraicThinking: number;
      measurementAndData: number;
      geometry: number;
      overallMathScore: number;
      placement: string;
      diagnosticStatus: string;
    }>;
    fastELA: Array<{
      testDate: string;
      score: number;
      level: number;
      percentile: number;
      readingComprehension: number;
      vocabulary: number;
      languageUsage: number;
      readingFluency: number;
      writingScore: number;
      listeningComprehension: number;
      literaryText: string;
      informationalText: string;
      vocabularyAcquisition: string;
      readingFoundations: string;
      performanceLevel: string;
    }>;
    fastMath: Array<{
      testDate: string;
      score: number;
      level: number;
      percentile: number;
      operationsAndAlgebraicThinking: number;
      numberAndOperationsBase10: number;
      numberAndOperationsFractions: number;
      measurementAndData: number;
      geometry: number;
      additionSubtraction: string;
      multiplicationDivision: string;
      fractions: string;
      decimalOperations: string;
      geometryMeasurement: string;
      performanceLevel: string;
    }>;
    fastScience: Array<{
      testDate: string;
      score: number;
      level: number;
      percentile: number;
    }>;
    fastWriting: Array<{
      testDate: string;
      score: number;
      level: number;
      percentile: number;
    }>;
  }>;
  discipline: Array<{
    studentId: string;
    studentName: string;
    incidentCount: number;
    incidents: Array<{ 
      date: string;
      type: string;
      description: string;
      severity: string;
      action: string;
      location: string;
      timeOfDay: string;
      staffMember: string;
      followUp: string;
      outcome: string;
    }>;
    behaviorTrend: 'improving' | 'worsening' | 'stable';
    incidentsByMonth: Record<string, number>;
    mostCommonIncidentType: string;
    averageIncidentsPerMonth: number;
  }>;
  flags: Array<{
    studentId: string;
    studentName: string;
    flagName: string;
    category: string;
    color: string;
    message: string;
    dateCreated?: string;
    isActive: boolean;
  }>;
  summary: {
    totalStudents: number;
    averageAttendance: number;
    averageGrade: number;
    studentsWithFlags: number;
    riskCategories: {
      highRisk: number;
      mediumRisk: number;
      lowRisk: number;
    };
    queryType: 'individual' | 'group' | 'analysis';
    focusedStudents: string[]; // WASABI IDs of specific students in query
  };
}

export class StudentDataRetrieval {
  // Parse user query to identify what data they're asking about
  static parseQuery(query: string): {
    studentIdentifiers: string[];
    gradeLevel?: string;
    className?: string;
    dataTypes: string[];
    metrics: string[];
    intent: 'analysis' | 'individual' | 'comparison' | 'trend' | 'intervention';
  } {
    const lowercaseQuery = query.toLowerCase();
    
    // Extract student identifiers (names, student numbers)
    const studentIdentifiers: string[] = [];
    
    // Look for student numbers (typically 8 digits)
    const studentNumberMatches = query.match(/\b\d{6,9}\b/g);
    if (studentNumberMatches) {
      studentIdentifiers.push(...studentNumberMatches);
    }
    
    // Look for quoted names or capitalized names (various formats)
    const namePatterns = [
      /["']([^"']+)["']/g, // Quoted names
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, // Traditional capitalized (John Smith)
      /\b([A-Z]{2,} [A-Z]{2,})\b/g, // All uppercase (KIYOMI WILCOX)
      /\b([A-Z][A-Z\s]+[A-Z])\b/g, // Mixed uppercase
      /\b([a-z]+ [a-z]+)\b/g, // All lowercase (john smith)
    ];
    
    for (const pattern of namePatterns) {
      const matches = [...query.matchAll(pattern)];
      matches.forEach(match => {
        const name = match[1] || match[0];
        if (name && !studentIdentifiers.includes(name)) {
          studentIdentifiers.push(name.replace(/["']/g, '').trim());
        }
      });
    }
    
    // Extract grade level
    let gradeLevel: string | undefined;
    const gradeMatch = lowercaseQuery.match(/(?:grade\s*)?([kK]|kindergarten|\d{1,2})(?:th|st|nd|rd)?\s*grade?/);
    if (gradeMatch) {
      gradeLevel = gradeMatch[1].toUpperCase() === 'K' || gradeMatch[1].toLowerCase() === 'kindergarten' ? 'K' : gradeMatch[1];
    }
    
    // Extract class name (handles teacher names like "Ms. Portilla")
    let className: string | undefined;
    const classMatch = query.match(/(?:class(?:room)?|Ms\.?|Mr\.?|Mrs\.?|Dr\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    if (classMatch) {
      // Extract just the last name (e.g., "Portilla" from "Ms. Portilla's class")
      className = classMatch[1];
      console.log('🎓 Detected class/teacher name:', className);
    }
    
    // Identify data types mentioned
    const dataTypes: string[] = [];
    if (/attendance|absent|present|tardy/i.test(query)) dataTypes.push('attendance');
    if (/grade|gpa|academic|performance/i.test(query)) dataTypes.push('grades');
    if (/discipline|behavior|incident/i.test(query)) dataTypes.push('discipline');
    if (/iready|i-ready/i.test(query)) dataTypes.push('iready');
    if (/fast|assessment|test|score/i.test(query)) dataTypes.push('fast');
    if (/flag|flagged|alert/i.test(query)) dataTypes.push('flags');
    
    // Identify specific metrics
    const metrics: string[] = [];
    if (/struggling|at.risk|low.perform|failing/i.test(query)) metrics.push('at-risk');
    if (/improving|progress|growth/i.test(query)) metrics.push('improvement');
    if (/trend|pattern|over.time/i.test(query)) metrics.push('trends');
    if (/correlat|relationship|connect/i.test(query)) metrics.push('correlation');
    if (/intervention|support|help/i.test(query)) metrics.push('intervention');
    
    // Determine intent
    let intent: 'analysis' | 'individual' | 'comparison' | 'trend' | 'intervention' = 'analysis';
    if (studentIdentifiers.length === 1) intent = 'individual';
    else if (/compare|versus|vs|between/i.test(query)) intent = 'comparison';
    else if (/trend|over.time|pattern|chang/i.test(query)) intent = 'trend';
    else if (/help|support|intervention|recommend/i.test(query)) intent = 'intervention';
    
    return {
      studentIdentifiers,
      gradeLevel,
      className,
      dataTypes,
      metrics,
      intent
    };
  }
  
  // Retrieve comprehensive student data based on query with intelligent truncation
  static async retrieveRelevantData(query: string): Promise<StudentDataContext> {
    const parsedQuery = this.parseQuery(query);
    console.log('🔍 Parsed query:', parsedQuery);
    
    // Determine if this is a ranking/comparison query that needs more data
    const isRankingQuery = /(?:lowest|highest|top|bottom|best|worst|rank|compare|who are)/i.test(query);
    const isIndividualQuery = parsedQuery.studentIdentifiers.length > 0 && parsedQuery.studentIdentifiers.length <= 3;
    
    // Get all students first for filtering
    let students = await db.students.toArray();
    
    // Filter by identifiers if provided (now supports WASABI IDs)
    if (parsedQuery.studentIdentifiers.length > 0) {
      console.log('🔍 Looking for student identifiers:', parsedQuery.studentIdentifiers);
      const originalCount = students.length;
      
      students = students.filter(student => 
        parsedQuery.studentIdentifiers.some(identifier => {
          // Check WASABI ID (most common after translation)
          if (student.id === identifier) {
            console.log('✅ Found by WASABI ID:', student.id, `${student.firstName} ${student.lastName}`);
            return true;
          }
          
          // Check student number
          if (student.studentNumber?.includes(identifier)) {
            console.log('✅ Found by student number:', student.studentNumber, `${student.firstName} ${student.lastName}`);
            return true;
          }
          
          // Check names with multiple formats (case-insensitive)
          const fullName = `${student.firstName || ''} ${student.lastName || ''}`.toLowerCase().trim();
          const firstName = student.firstName?.toLowerCase().trim() || '';
          const lastName = student.lastName?.toLowerCase().trim() || '';
          const identifierLower = identifier.toLowerCase().trim();
          
          // Try multiple matching strategies
          const matches = [
            fullName === identifierLower, // Exact full name match
            fullName.includes(identifierLower), // Full name contains identifier
            identifierLower.includes(fullName), // Identifier contains full name
            firstName === identifierLower.split(' ')[0], // First name match
            lastName === identifierLower.split(' ')[1] || identifierLower.split(' ').slice(-1)[0], // Last name match
            firstName.includes(identifierLower.split(' ')[0] || ''), // Partial first name
            lastName.includes(identifierLower.split(' ')[1] || identifierLower.split(' ').slice(-1)[0] || '') // Partial last name
          ].some(match => match && identifierLower.length > 2);
          
          if (matches) {
            console.log('✅ Found by name match:', identifier, '→', `${student.firstName} ${student.lastName}`);
            return true;
          }
          
          return false;
        })
      );
      
      console.log(`🔍 Filtered from ${originalCount} to ${students.length} students`);
      if (students.length === 0) {
        console.warn('⚠️ No students found matching identifiers:', parsedQuery.studentIdentifiers);
      }
    }
    
    // Filter by grade level
    if (parsedQuery.gradeLevel) {
      console.log(`🔍 Filtering for grade level: "${parsedQuery.gradeLevel}"`);
      console.log('📊 Available grades in database:', [...new Set(students.map(s => s.grade))]);
      const beforeCount = students.length;
      students = students.filter(s => s.grade === parsedQuery.gradeLevel);
      console.log(`🔍 Grade filter: ${beforeCount} → ${students.length} students`);
      if (students.length === 0) {
        console.log('⚠️ No students found for grade level:', parsedQuery.gradeLevel);
        console.log('📋 Sample student grades:', students.slice(0, 5).map(s => ({ name: `${s.firstName} ${s.lastName}`, grade: s.grade })));
      }
    }
    
    // Filter by class
    if (parsedQuery.className) {
      const beforeCount = students.length;
      students = students.filter(s => 
        s.className?.toLowerCase().includes(parsedQuery.className!.toLowerCase())
      );
      console.log(`📚 Class filter for "${parsedQuery.className}": ${beforeCount} → ${students.length} students`);
      if (students.length > 0) {
        console.log(`📋 Students in ${parsedQuery.className}'s class:`, students.map(s => `${s.firstName} ${s.lastName}`));
      }
    }
    
    // If no specific filters, handle differently based on query intent
    if (students.length === 0) {
      console.log('🔍 No specific students found, checking query intent:', parsedQuery.intent);
      
      // For ranking/comparison queries, get all students
      if (parsedQuery.metrics.some(m => ['comparison', 'ranking', 'lowest', 'highest', 'best', 'worst'].some(keyword => 
          parsedQuery.studentIdentifiers.join(' ').toLowerCase().includes(keyword) ||
          query.toLowerCase().includes(keyword)
      ))) {
        console.log('🔄 Detected ranking/comparison query, getting all students');
        students = await db.students.toArray(); // Get ALL students for ranking
      } else {
        students = await db.students.limit(50).toArray(); // Sample for analysis
      }
    } else if (students.length > 100 && parsedQuery.intent === 'analysis' && !parsedQuery.gradeLevel) {
      // Only limit for general analysis, NOT for grade-level queries
      students = students.slice(0, 50); // Sample for analysis
    }
    
    const studentIds = students.map(s => s.id);
    console.log(`📊 Final student count for query "${query}": ${students.length} students`);
    if (parsedQuery.gradeLevel) {
      console.log(`📋 Grade ${parsedQuery.gradeLevel} students:`, students.map(s => `${s.firstName} ${s.lastName}`));
    }
    
    // Special handling for ranking queries - we need ALL students with grade data
    // Note: isRankingQuery already declared earlier in the function
    
    if (isRankingQuery) {
      console.log('🏆 Detected ranking query, ensuring comprehensive data for all students');
      students = await db.students.toArray();
      // Re-map student IDs for comprehensive analysis
      studentIds.length = 0;
      studentIds.push(...students.map(s => s.id));
    }
    console.log(`📊 Analyzing data for ${students.length} students:`, students.map(s => `${s.firstName} ${s.lastName} (${s.id})`));
    
    // Add debugging for database contents
    const totalGrades = await db.grades.count();
    const totalAssessments = await db.assessments.count();
    const totalAttendance = await db.attendance.count();
    console.log(`📈 Database totals: ${totalGrades} grades, ${totalAssessments} assessments, ${totalAttendance} attendance records`);
    
    if (totalGrades === 0) {
      console.warn('⚠️ WARNING: No grades found in database! Check if grade data has been uploaded.');
    }
    
    try {
      // Gather all relevant data in parallel with error handling
      const [attendanceData, gradeData, assessmentData, disciplineData] = await Promise.all([
        this.getAttendanceData(studentIds, students).catch(error => {
          console.error('Error getting attendance data:', error);
          return [];
        }),
        this.getGradeData(studentIds, students).catch(error => {
          console.error('Error getting grade data:', error);
          return [];
        }),
        this.getAssessmentData(studentIds, students, parsedQuery.dataTypes).catch(error => {
          console.error('Error getting assessment data:', error);
          return [];
        }),
        this.getDisciplineData(studentIds, students).catch(error => {
          console.error('Error getting discipline data:', error);
          return [];
        })
      ]);
      
      // Get flag data with error handling
      const flagData = await this.getFlagData(studentIds, students).catch(error => {
        console.error('Error getting flag data:', error);
        return [];
      });
    
      // Calculate summary statistics
      const summary = this.calculateSummary(students, attendanceData, gradeData, flagData);
      
      let result: StudentDataContext = {
        students: students.map(s => ({
          id: s.id, // WASABI ID for privacy
          name: s.id, // Use WASABI ID instead of actual name
          studentNumber: s.studentNumber || 'N/A',
          grade: s.grade,
          className: s.className,
          gender: s.gender,
          firstName: s.firstName,
          lastName: s.lastName,
          birthDate: s.birthDate ? s.birthDate.toISOString().split('T')[0] : undefined
        })),
        attendance: attendanceData,
        grades: gradeData,
        assessments: assessmentData,
        discipline: disciplineData,
        flags: flagData,
        summary
      };
      
      // Apply focused summary for large datasets to prevent token overflow
      if (students.length > 15 || isRankingQuery) {
        console.log(`🔧 Applying focused summary to prevent token overflow (${students.length} students, ranking query: ${isRankingQuery})`);
        result = this.createFocusedSummary(result, query);
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error in retrieveRelevantData:', error);
      // Return empty data structure on error
      return {
        students: [],
        attendance: [],
        grades: [],
        assessments: [],
        discipline: [],
        flags: [],
        summary: {
          totalStudents: 0,
          averageAttendance: 0,
          averageGrade: 0,
          studentsWithFlags: 0,
          riskCategories: { highRisk: 0, mediumRisk: 0, lowRisk: 0 }
        }
      };
    }
  }
  
  private static async getAttendanceData(studentIds: string[], students: any[], isIndividualQuery: boolean = false) {
    const attendanceRecords = await db.attendance
      .where('studentId')
      .anyOf(studentIds)
      .toArray();
    
    return students.map(student => {
      let records = attendanceRecords.filter(r => r.studentId === student.id);
      
      // For non-individual queries, limit attendance records to prevent token overflow
      if (!isIndividualQuery && records.length > 30) {
        // Keep most recent 20 records and sample 10 from earlier
        const sortedRecords = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const recentRecords = sortedRecords.slice(0, 20);
        const earlierRecords = sortedRecords.slice(20);
        const sampledEarlier = this.sampleArray(earlierRecords, 10);
        records = [...recentRecords, ...sampledEarlier];
      }
      
      const presentDays = records.filter(r => r.status === 'present').length;
      const absentDays = records.filter(r => r.status === 'absent').length;
      const tardyDays = records.filter(r => r.status === 'tardy').length;
      const totalDays = records.length;
      const rate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
      
      // Get recent attendance records (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentRecords = records
        .filter(r => new Date(r.date) >= thirtyDaysAgo)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10)
        .map(r => ({
          date: r.date.toISOString().split('T')[0],
          status: r.status,
          attendanceCode: r.attendanceCode
        }));
      
      // Calculate monthly breakdown
      const monthlyBreakdown = this.calculateMonthlyAttendance(records);
      
      // Get ALL attendance records for this student (not just recent)
      const allRecords = records.map(r => ({
        date: r.date.toISOString().split('T')[0],
        status: r.status,
        attendanceCode: r.attendanceCode || r.status.charAt(0).toUpperCase(),
        dayOfWeek: r.date.toLocaleDateString('en-US', { weekday: 'long' }),
        month: r.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      return {
        studentId: student.id,
        studentName: student.id, // Use WASABI ID instead of name
        rate,
        presentDays,
        totalDays,
        absentDays,
        tardyDays,
        chronicAbsenteeism: rate < 90,
        recentRecords,
        monthlyBreakdown,
        allAttendanceRecords: allRecords // Include ALL daily records
      };
    }).filter(a => a.totalDays > 0);
  }
  
  private static async getGradeData(studentIds: string[], students: any[]) {
    const gradeRecords = await db.grades
      .where('studentId')
      .anyOf(studentIds)
      .toArray();
    
    console.log(`📊 Found ${gradeRecords.length} grade records for ${studentIds.length} students`);
    
    return students.map(student => {
      const records = gradeRecords.filter(r => r.studentId === student.id);
      console.log(`📊 Student ${student.id}: ${records.length} grade records`);
      
      // Extract all individual grades from all records
      const allGrades: Array<{grade: number, subject: string, period: string, date: string, assignment: string}> = [];
      
      records.forEach(record => {
        const subject = record.course || 'General';
        
        // Extract grades from the grades array (format: [{period: "Quarter 1", grade: "80 S"}, ...])
        if (record.grades && Array.isArray(record.grades)) {
          record.grades.forEach((gradeEntry: any) => {
            const numericGrade = this.parseNumericGrade(gradeEntry.grade);
            if (numericGrade > 0) {
              allGrades.push({
                grade: numericGrade,
                subject: subject,
                period: gradeEntry.period || 'Unknown',
                date: 'Unknown', // Most grade records don't have specific dates
                assignment: gradeEntry.period || 'Grade Period'
              });
            }
          });
        }
      });
      
      console.log(`📊 Student ${student.id}: Extracted ${allGrades.length} valid grades`);
      
      const averageGrade = allGrades.length > 0 
        ? allGrades.reduce((sum, g) => sum + g.grade, 0) / allGrades.length 
        : 0;
      
      // Group by subject with detailed grade history
      const subjectGrades = allGrades.reduce((acc, gradeEntry) => {
        const subject = gradeEntry.subject;
        if (!acc[subject]) acc[subject] = [];
        acc[subject].push({
          grade: gradeEntry.grade,
          date: gradeEntry.date,
          assignment: gradeEntry.assignment
        });
        return acc;
      }, {} as Record<string, any[]>);
      
      const subjects = Object.entries(subjectGrades).map(([subject, gradeList]) => {
        const sortedGrades = gradeList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return {
          subject,
          grade: gradeList.reduce((sum, g) => sum + g.grade, 0) / gradeList.length,
          recentGrades: sortedGrades.slice(0, 5), // Last 5 grades per subject
          allGrades: sortedGrades, // ALL grades for detailed analysis
          lowestGrade: Math.min(...gradeList.map(g => g.grade)),
          highestGrade: Math.max(...gradeList.map(g => g.grade)),
          gradeCount: gradeList.length,
          passingGradeCount: gradeList.filter(g => g.grade >= 60).length,
          failingGradeCount: gradeList.filter(g => g.grade < 60).length
        };
      });
      
      // Calculate GPA on 4.0 scale
      const gpaScale = this.convertToGpaScale(averageGrade);
      const letterGrade = this.getLetterGrade(averageGrade);
      
      // Determine trend
      const trend = this.calculateGradeTrend(allGrades);
      
      const result = {
        studentId: student.id,
        studentName: student.id, // Use WASABI ID instead of name
        averageGrade,
        gradeCount: allGrades.length,
        subjects,
        gpaScale,
        letterGrade,
        trend
      };
      
      console.log(`📊 Student ${student.id}: Final GPA = ${averageGrade.toFixed(2)}, Letter = ${letterGrade}, Count = ${allGrades.length}`);
      return result;
    });
  }
  
  // NEW: Create comprehensive enhanced student profiles for deep analysis
  static async createEnhancedStudentProfiles(studentIds: string[]): Promise<EnhancedStudentProfile[]> {
    console.log(`🔍 Creating enhanced profiles for ${studentIds.length} students...`);
    
    // Get base student data
    const students = await db.students.where('id').anyOf(studentIds).toArray();
    
    const profiles: EnhancedStudentProfile[] = [];
    
    for (const student of students) {
      console.log(`📊 Processing enhanced profile for ${student.id}...`);
      
      // Get all data for this student
      const [attendanceRecords, disciplineRecords, assessmentRecords, gradeRecords] = await Promise.all([
        db.attendance.where('studentId').equals(student.id).toArray(),
        db.discipline.where('studentId').equals(student.id).toArray(),
        db.assessments.where('studentId').equals(student.id).toArray(),
        db.grades.where('studentId').equals(student.id).toArray()
      ]);
      
      // Create comprehensive attendance analysis
      const attendanceAnalysis = this.createAttendanceAnalysis(attendanceRecords);
      
      // Create comprehensive academic analysis
      const academicAnalysis = this.createAcademicAnalysis(gradeRecords, student);
      
      // Create comprehensive assessment analysis
      const assessmentAnalysis = this.createAssessmentAnalysis(assessmentRecords);
      
      // Create comprehensive behavioral analysis
      const behaviorAnalysis = this.createBehaviorAnalysis(disciplineRecords);
      
      // Create risk profile
      const riskProfile = this.createRiskProfile(
        attendanceAnalysis,
        academicAnalysis,
        assessmentAnalysis,
        behaviorAnalysis
      );
      
      // Create summary insights
      const summary = this.createStudentSummary(
        student,
        attendanceAnalysis,
        academicAnalysis,
        assessmentAnalysis,
        behaviorAnalysis,
        riskProfile
      );
      
      const profile: EnhancedStudentProfile = {
        student: {
          id: student.id,
          name: `${student.firstName} ${student.lastName}`.trim(),
          firstName: student.firstName,
          lastName: student.lastName,
          studentNumber: student.studentNumber,
          flId: student.flId,
          grade: student.grade,
          className: student.className,
          teacher: student.homeRoomTeacher,
          gender: student.gender,
          birthDate: student.birthDate,
          ethnicity: student.ethnicity,
          englishLanguageLearner: student.englishLanguageLearner,
          specialEducation: student.specialEducation,
          section504: student.section504
        },
        attendance: attendanceAnalysis,
        academics: academicAnalysis,
        assessments: assessmentAnalysis,
        behavior: behaviorAnalysis,
        riskProfile: riskProfile,
        interventions: {
          active: [], // Would be populated from intervention tracking system
          completed: []
        },
        summary: summary
      };
      
      profiles.push(profile);
    }
    
    console.log(`✅ Created ${profiles.length} enhanced student profiles`);
    return profiles;
  }
  
  private static createAttendanceAnalysis(records: any[]) {
    if (records.length === 0) {
      return {
        overallRate: 0,
        presentDays: 0,
        absentDays: 0,
        tardyDays: 0,
        excusedDays: 0,
        totalDays: 0,
        chronicAbsenteeism: false,
        consecutiveAbsences: 0,
        attendanceTrend: 'stable' as const,
        monthlyBreakdown: [],
        dailyRecords: []
      };
    }
    
    const presentDays = records.filter(r => r.status === 'Present').length;
    const absentDays = records.filter(r => r.isAbsent).length;
    const tardyDays = records.filter(r => r.isTardy).length;
    const excusedDays = records.filter(r => r.isExcused).length;
    const totalDays = records.length;
    const overallRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
    
    // Monthly breakdown
    const monthlyData: Record<string, {present: number; absent: number; tardy: number; total: number}> = {};
    records.forEach(record => {
      const month = record.month || 'Unknown';
      if (!monthlyData[month]) {
        monthlyData[month] = { present: 0, absent: 0, tardy: 0, total: 0 };
      }
      monthlyData[month].total++;
      if (record.status === 'Present') monthlyData[month].present++;
      if (record.isAbsent) monthlyData[month].absent++;
      if (record.isTardy) monthlyData[month].tardy++;
    });
    
    const monthlyBreakdown = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      rate: data.total > 0 ? (data.present / data.total) * 100 : 0,
      present: data.present,
      absent: data.absent,
      tardy: data.tardy
    }));
    
    // Calculate trend and consecutive absences
    const recentRecords = records.slice(-30); // Last 30 days
    const earlierRecords = records.slice(0, 30); // First 30 days
    
    const recentRate = recentRecords.length > 0 ? (recentRecords.filter(r => r.status === 'Present').length / recentRecords.length) * 100 : 0;
    const earlierRate = earlierRecords.length > 0 ? (earlierRecords.filter(r => r.status === 'Present').length / earlierRecords.length) * 100 : 0;
    
    let attendanceTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (recentRate > earlierRate + 5) attendanceTrend = 'improving';
    else if (recentRate < earlierRate - 5) attendanceTrend = 'declining';
    
    // Calculate current consecutive absences
    let consecutiveAbsences = 0;
    for (let i = records.length - 1; i >= 0; i--) {
      if (records[i].isAbsent) {
        consecutiveAbsences++;
      } else {
        break;
      }
    }
    
    return {
      overallRate: Math.round(overallRate * 100) / 100,
      presentDays,
      absentDays,
      tardyDays,
      excusedDays,
      totalDays,
      chronicAbsenteeism: overallRate < 90, // Standard definition
      consecutiveAbsences,
      attendanceTrend,
      monthlyBreakdown,
      dailyRecords: records
    };
  }
  
  private static createAcademicAnalysis(gradeRecords: any[], student: any) {
    if (gradeRecords.length === 0) {
      return {
        overallGPA: 0,
        currentGradeLevel: student.grade || 'Unknown',
        subjects: [],
        gradeTrend: 'stable' as const,
        academicRiskLevel: 'Low' as const
      };
    }
    
    const subjects: any[] = [];
    let totalGradePoints = 0;
    let totalGrades = 0;
    
    gradeRecords.forEach(record => {
      const subjectGrades: number[] = [];
      
      if (record.grades && Array.isArray(record.grades)) {
        record.grades.forEach((gradeEntry: any) => {
          const numericGrade = this.parseNumericGrade(gradeEntry.grade);
          if (numericGrade > 0) {
            subjectGrades.push(numericGrade);
            totalGradePoints += numericGrade;
            totalGrades++;
          }
        });
      }
      
      if (subjectGrades.length > 0) {
        const avgGrade = subjectGrades.reduce((a, b) => a + b, 0) / subjectGrades.length;
        const passingGrades = subjectGrades.filter(g => g >= 60);
        const passingPercentage = (passingGrades.length / subjectGrades.length) * 100;
        
        // Determine trend (simple: compare first half to second half of grades)
        const midpoint = Math.floor(subjectGrades.length / 2);
        const earlierGrades = subjectGrades.slice(0, midpoint);
        const laterGrades = subjectGrades.slice(midpoint);
        
        const earlierAvg = earlierGrades.length > 0 ? earlierGrades.reduce((a, b) => a + b, 0) / earlierGrades.length : avgGrade;
        const laterAvg = laterGrades.length > 0 ? laterGrades.reduce((a, b) => a + b, 0) / laterGrades.length : avgGrade;
        
        let trend: 'improving' | 'declining' | 'stable' = 'stable';
        if (laterAvg > earlierAvg + 3) trend = 'improving';
        else if (laterAvg < earlierAvg - 3) trend = 'declining';
        
        subjects.push({
          subject: record.course || 'Unknown',
          currentGrade: avgGrade,
          trend,
          passingGradePercentage: Math.round(passingPercentage * 100) / 100,
          recentPerformance: record.grades?.slice(-5).map((g: any) => ({
            period: g.period || 'Unknown',
            grade: this.parseNumericGrade(g.grade) || 0,
            letterGrade: g.grade?.split(' ')[1] || 'N/A'
          })) || []
        });
      }
    });
    
    const overallGPA = totalGrades > 0 ? totalGradePoints / totalGrades : 0;
    
    // Determine overall academic trend
    const improvingSubjects = subjects.filter(s => s.trend === 'improving').length;
    const decliningSubjects = subjects.filter(s => s.trend === 'declining').length;
    
    let gradeTrend: 'improving' | 'declining' | 'stable' = 'stable';
    if (improvingSubjects > decliningSubjects) gradeTrend = 'improving';
    else if (decliningSubjects > improvingSubjects) gradeTrend = 'declining';
    
    // Determine academic risk level
    let academicRiskLevel: 'High' | 'Medium' | 'Low' = 'Low';
    if (overallGPA < 60) academicRiskLevel = 'High';
    else if (overallGPA < 70) academicRiskLevel = 'Medium';
    
    return {
      overallGPA: Math.round(overallGPA * 100) / 100,
      currentGradeLevel: student.grade || 'Unknown',
      subjects,
      gradeTrend,
      academicRiskLevel
    };
  }
  
  private static createAssessmentAnalysis(assessmentRecords: any[]) {
    const iReadyReading = assessmentRecords.filter(r => r.source === 'iReady Reading');
    const iReadyMath = assessmentRecords.filter(r => r.source === 'iReady Math');
    const fastELA = assessmentRecords.filter(r => r.source === 'FAST ELA');
    const fastMath = assessmentRecords.filter(r => r.source === 'FAST Math');
    
    const analysis: any = {};
    
    if (iReadyReading.length > 0) {
      const latest = iReadyReading.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0];
      analysis.iReadyReading = {
        latestScore: latest.score || 0,
        placement: latest.placement || 'Unknown',
        lexileLevel: latest.lexileLevel || 'Unknown',
        riskLevel: latest.riskLevel || 'Unknown',
        domainBreakdown: {
          'Phonological Awareness': latest.phonologicalAwareness || 0,
          'Phonics': latest.phonics || 0,
          'High-Frequency Words': latest.highFrequencyWords || 0,
          'Vocabulary': latest.vocabulary || 0,
          'Comprehension: Literature': latest.comprehensionLiterature || 0,
          'Comprehension: Informational': latest.comprehensionInformational || 0
        },
        growthMetrics: {
          diagnosticGain: latest.diagnosticGain || 0,
          progressToTypical: latest.percentProgressTypical || 0,
          progressToStretch: latest.percentProgressStretch || 0
        },
        history: iReadyReading
      };
    }
    
    if (iReadyMath.length > 0) {
      const latest = iReadyMath.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0];
      analysis.iReadyMath = {
        latestScore: latest.score || 0,
        placement: latest.placement || 'Unknown',
        quantileLevel: latest.quantileMeasure || 'Unknown',
        riskLevel: latest.riskLevel || 'Unknown',
        domainBreakdown: {
          'Number and Operations': latest.numberAndOperations || 0,
          'Algebra and Algebraic Thinking': latest.algebraAndAlgebraicThinking || 0,
          'Measurement and Data': latest.measurementAndData || 0,
          'Geometry': latest.geometry || 0
        },
        growthMetrics: {
          diagnosticGain: latest.diagnosticGain || 0,
          progressToTypical: latest.percentProgressTypical || 0,
          progressToStretch: latest.percentProgressStretch || 0
        },
        history: iReadyMath
      };
    }
    
    if (fastELA.length > 0) {
      const latest = fastELA.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0];
      const standardsMastery = latest.standardsPerformance ? 
        Object.entries(latest.standardsPerformance).map(([standard, perf]: [string, any]) => ({
          standard,
          mastered: perf.mastered || false,
          masteryPercentage: perf.masteryPercentage || 0
        })) : [];
        
      analysis.fastELA = {
        latestScore: latest.score || 0,
        achievementLevel: latest.performanceLevel || 'Unknown',
        percentileRank: latest.percentile || 0,
        riskLevel: latest.riskLevel || 'Unknown',
        standardsMastery,
        performanceAreas: {
          readingProsePoetry: latest.readingProsePoetryPerformance || 'Unknown',
          readingInformationalText: latest.readingInformationalTextPerformance || 'Unknown',
          readingAcrossGenres: latest.readingAcrossGenresVocabularyPerformance || 'Unknown'
        },
        history: fastELA
      };
    }
    
    if (fastMath.length > 0) {
      const latest = fastMath.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0];
      const standardsMastery = latest.standardsPerformance ? 
        Object.entries(latest.standardsPerformance).map(([standard, perf]: [string, any]) => ({
          standard,
          mastered: perf.mastered || false,
          masteryPercentage: perf.masteryPercentage || 0
        })) : [];
        
      analysis.fastMath = {
        latestScore: latest.score || 0,
        achievementLevel: latest.performanceLevel || 'Unknown',
        percentileRank: latest.percentile || 0,
        riskLevel: latest.riskLevel || 'Unknown',
        standardsMastery,
        history: fastMath
      };
    }
    
    return analysis;
  }
  
  private static createBehaviorAnalysis(disciplineRecords: any[]) {
    if (disciplineRecords.length === 0) {
      return {
        totalIncidents: 0,
        severityScore: 0,
        riskScore: 0,
        recentIncidents: [],
        incidentTypes: {},
        interventionsReceived: [],
        behaviorTrend: 'stable' as const,
        threatAssessments: 0,
        hopeFormsInitiated: 0
      };
    }
    
    const totalIncidents = disciplineRecords.length;
    const avgSeverity = disciplineRecords.reduce((sum, r) => sum + (r.severityLevel || 1), 0) / totalIncidents;
    const avgRiskScore = disciplineRecords.reduce((sum, r) => sum + (r.riskScore || 0), 0) / totalIncidents;
    
    // Recent incidents (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentIncidents = disciplineRecords.filter(r => 
      new Date(r.incidentDate) >= ninetyDaysAgo
    );
    
    // Incident type breakdown
    const incidentTypes: Record<string, number> = {};
    disciplineRecords.forEach(r => {
      const type = r.interventionType || 'Unknown';
      incidentTypes[type] = (incidentTypes[type] || 0) + 1;
    });
    
    // Threat assessments and hope forms
    const threatAssessments = disciplineRecords.filter(r => r.threatAssessment).length;
    const hopeFormsInitiated = disciplineRecords.filter(r => r.hopeFormInitiated).length;
    
    // Determine behavior trend
    const recentSeverity = recentIncidents.reduce((sum, r) => sum + (r.severityLevel || 1), 0) / Math.max(recentIncidents.length, 1);
    const earlierIncidents = disciplineRecords.filter(r => new Date(r.incidentDate) < ninetyDaysAgo);
    const earlierSeverity = earlierIncidents.reduce((sum, r) => sum + (r.severityLevel || 1), 0) / Math.max(earlierIncidents.length, 1);
    
    let behaviorTrend: 'improving' | 'worsening' | 'stable' = 'stable';
    if (recentSeverity < earlierSeverity - 1) behaviorTrend = 'improving';
    else if (recentSeverity > earlierSeverity + 1) behaviorTrend = 'worsening';
    
    // Extract interventions
    const interventionsReceived = disciplineRecords.map(r => ({
      type: r.interventionType || 'Unknown',
      date: new Date(r.incidentDate),
      effectiveness: 'Not Effective' as const // Would need follow-up data to determine
    }));
    
    return {
      totalIncidents,
      severityScore: Math.round(avgSeverity * 100) / 100,
      riskScore: Math.round(avgRiskScore * 100) / 100,
      recentIncidents,
      incidentTypes,
      interventionsReceived,
      behaviorTrend,
      threatAssessments,
      hopeFormsInitiated
    };
  }
  
  private static createRiskProfile(attendanceAnalysis: any, academicAnalysis: any, assessmentAnalysis: any, behaviorAnalysis: any) {
    const riskFactors: string[] = [];
    const protectiveFactors: string[] = [];
    const recommendations: string[] = [];
    
    // Attendance risk factors
    let attendanceRisk: 'High' | 'Medium' | 'Low' = 'Low';
    if (attendanceAnalysis.overallRate < 85) {
      attendanceRisk = 'High';
      riskFactors.push('Chronic absenteeism (< 85% attendance rate)');
      recommendations.push('Implement attendance intervention plan');
    } else if (attendanceAnalysis.overallRate < 95) {
      attendanceRisk = 'Medium';
      riskFactors.push('Below target attendance rate');
      recommendations.push('Monitor attendance patterns closely');
    } else {
      protectiveFactors.push('Strong attendance record');
    }
    
    if (attendanceAnalysis.consecutiveAbsences >= 3) {
      riskFactors.push(`${attendanceAnalysis.consecutiveAbsences} consecutive absences`);
      recommendations.push('Immediate attendance conference with family');
    }
    
    // Academic risk factors
    let academicRisk: 'High' | 'Medium' | 'Low' = academicAnalysis.academicRiskLevel;
    if (academicAnalysis.overallGPA < 60) {
      riskFactors.push('Failing grades (GPA < 60)');
      recommendations.push('Academic support services and tutoring');
    } else if (academicAnalysis.overallGPA < 70) {
      riskFactors.push('Below grade-level performance');
      recommendations.push('Small group instruction and progress monitoring');
    } else {
      protectiveFactors.push('Satisfactory academic performance');
    }
    
    if (academicAnalysis.gradeTrend === 'declining') {
      riskFactors.push('Declining academic performance');
      recommendations.push('Review and adjust instructional strategies');
    }
    
    // Assessment-based risk factors
    if (assessmentAnalysis.iReadyReading?.riskLevel === 'High Risk') {
      riskFactors.push('High risk in reading (iReady assessment)');
      recommendations.push('Intensive reading intervention');
    }
    
    if (assessmentAnalysis.iReadyMath?.riskLevel === 'High Risk') {
      riskFactors.push('High risk in mathematics (iReady assessment)');
      recommendations.push('Intensive math intervention');
    }
    
    if (assessmentAnalysis.fastELA?.riskLevel === 'High Risk') {
      riskFactors.push('Level 1 performance on FAST ELA');
      recommendations.push('Reading intervention and progress monitoring');
    }
    
    // Behavioral risk factors
    let behaviorRisk: 'High' | 'Medium' | 'Low' = 'Low';
    if (behaviorAnalysis.riskScore >= 50 || behaviorAnalysis.threatAssessments > 0) {
      behaviorRisk = 'High';
      riskFactors.push('High behavioral risk score');
      recommendations.push('Behavioral intervention plan and counseling services');
    } else if (behaviorAnalysis.totalIncidents >= 3) {
      behaviorRisk = 'Medium';
      riskFactors.push('Multiple disciplinary incidents');
      recommendations.push('Proactive behavioral supports');
    } else if (behaviorAnalysis.totalIncidents === 0) {
      protectiveFactors.push('No disciplinary incidents');
    }
    
    if (behaviorAnalysis.behaviorTrend === 'worsening') {
      riskFactors.push('Escalating behavioral concerns');
      recommendations.push('Immediate behavioral assessment and intervention');
    }
    
    // Determine overall risk level
    let overallRiskLevel: 'Critical' | 'High' | 'Medium' | 'Low' = 'Low';
    
    const highRiskCount = [
      attendanceRisk === 'High' ? 1 : 0,
      academicRisk === 'High' ? 1 : 0,
      behaviorRisk === 'High' ? 1 : 0
    ].reduce((a, b) => a + b, 0);
    
    const mediumRiskCount = [
      attendanceRisk === 'Medium' ? 1 : 0,
      academicRisk === 'Medium' ? 1 : 0,
      behaviorRisk === 'Medium' ? 1 : 0
    ].reduce((a, b) => a + b, 0);
    
    if (highRiskCount >= 2) overallRiskLevel = 'Critical';
    else if (highRiskCount >= 1) overallRiskLevel = 'High';
    else if (mediumRiskCount >= 2) overallRiskLevel = 'High';
    else if (mediumRiskCount >= 1) overallRiskLevel = 'Medium';
    
    return {
      overallRiskLevel,
      academicRisk,
      attendanceRisk,
      behaviorRisk,
      riskFactors,
      protectiveFactors,
      recommendedInterventions: recommendations
    };
  }
  
  private static createStudentSummary(student: any, attendance: any, academics: any, assessments: any, behavior: any, riskProfile: any) {
    const strengths: string[] = [];
    const concerns: string[] = [];
    const priorities: string[] = [];
    
    // Identify strengths
    if (attendance.overallRate >= 95) {
      strengths.push('Excellent attendance');
    }
    
    if (academics.overallGPA >= 85) {
      strengths.push('Strong academic performance');
    }
    
    if (behavior.totalIncidents === 0) {
      strengths.push('No behavioral concerns');
    }
    
    if (assessments.iReadyReading?.riskLevel === 'Low Risk') {
      strengths.push('Grade-level reading performance');
    }
    
    if (assessments.iReadyMath?.riskLevel === 'Low Risk') {
      strengths.push('Grade-level math performance');
    }
    
    // Identify concerns
    riskProfile.riskFactors.forEach((factor: string) => concerns.push(factor));
    
    // Prioritize interventions
    if (riskProfile.overallRiskLevel === 'Critical') {
      priorities.push('IMMEDIATE: Multi-tiered intervention team meeting');
    }
    
    if (riskProfile.attendanceRisk === 'High') {
      priorities.push('Address chronic absenteeism');
    }
    
    if (riskProfile.academicRisk === 'High') {
      priorities.push('Intensive academic support');
    }
    
    if (riskProfile.behaviorRisk === 'High') {
      priorities.push('Behavioral intervention plan');
    }
    
    if (priorities.length === 0 && riskProfile.overallRiskLevel !== 'Low') {
      priorities.push('Preventive monitoring and support');
    }
    
    return {
      strengths,
      concerns,
      priorities,
      lastUpdated: new Date()
    };
  }
  
  // Helper method to sample array for token management
  private static sampleArray<T>(array: T[], maxSize: number): T[] {
    if (array.length <= maxSize) return array;
    
    const step = Math.floor(array.length / maxSize);
    const sampled: T[] = [];
    
    for (let i = 0; i < array.length; i += step) {
      sampled.push(array[i]);
      if (sampled.length >= maxSize) break;
    }
    
    return sampled;
  }
  
  // Helper method to parse numeric grade from string like "80 S" or "76"
  private static parseNumericGrade(gradeString: string): number {
    if (!gradeString) return 0;
    
    // Handle different grade formats
    const gradeStr = String(gradeString).trim();
    
    // Extract numeric part from strings like "80 S", "76 N", "100 E"
    const numericMatch = gradeStr.match(/^(\d+(?:\.\d+)?)/);
    if (numericMatch) {
      const num = parseFloat(numericMatch[1]);
      return isNaN(num) ? 0 : num;
    }
    
    // Try direct conversion for pure numbers
    const directNum = parseFloat(gradeStr);
    return isNaN(directNum) ? 0 : directNum;
  }
  
  private static async getAssessmentData(studentIds: string[], students: any[], dataTypes: string[], isIndividualQuery: boolean = false) {
    const assessments = await db.assessments
      .where('studentId')
      .anyOf(studentIds)
      .toArray();
    
    // Group assessments by student and type
    return students.map(student => {
      let studentAssessments = assessments.filter(a => a.studentId === student.id);
      
      // For non-individual queries, limit assessment history to prevent token overflow
      if (!isIndividualQuery) {
        // Keep only the most recent 3 assessments per type
        const assessmentsByType: Record<string, any[]> = {};
        studentAssessments.forEach(assessment => {
          const type = assessment.source || 'Unknown';
          if (!assessmentsByType[type]) assessmentsByType[type] = [];
          assessmentsByType[type].push(assessment);
        });
        
        // Sort each type by date and keep latest 3
        studentAssessments = [];
        Object.values(assessmentsByType).forEach(typeAssessments => {
          const sorted = typeAssessments.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime());
          studentAssessments.push(...sorted.slice(0, 3));
        });
      }
      
      return {
        studentId: student.id,
        studentName: student.id, // Use WASABI ID instead of name
        iReadyReading: studentAssessments
          .filter(a => a.source === 'iReady Reading')
          .map(a => ({
            testDate: a.testDate ? a.testDate.toISOString().split('T')[0] : 'Unknown',
            score: a.score || 0,
            gradeLevel: a.gradeLevel || student.grade,
            percentile: a.percentile || 0,
            lexileLevel: a.lexileLevel,
            // Add detailed iReady Reading domains
            phonologicalAwareness: a.phonologicalAwareness || 0,
            phonics: a.phonics || 0,
            highFrequencyWords: a.highFrequencyWords || 0,
            vocabulary: a.vocabulary || 0,
            comprehensionLiterature: a.comprehensionLiterature || 0,
            comprehensionInformational: a.comprehensionInformational || 0,
            overallReadingScore: a.overallReading || a.score || 0,
            placement: a.placement || 'Unknown',
            diagnosticStatus: a.diagnosticStatus || 'Unknown'
          }))
          .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()),
        
        iReadyMath: studentAssessments
          .filter(a => a.source === 'iReady Math')
          .map(a => ({
            testDate: a.testDate ? a.testDate.toISOString().split('T')[0] : 'Unknown',
            score: a.score || 0,
            gradeLevel: a.gradeLevel || student.grade,
            percentile: a.percentile || 0,
            // Add detailed iReady Math domains
            numberAndOperations: a.numberAndOperations || 0,
            algebraAndAlgebraicThinking: a.algebraAndAlgebraicThinking || 0,
            measurementAndData: a.measurementAndData || 0,
            geometry: a.geometry || 0,
            overallMathScore: a.overallMath || a.score || 0,
            placement: a.placement || 'Unknown',
            diagnosticStatus: a.diagnosticStatus || 'Unknown'
          }))
          .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()),
        
        fastELA: studentAssessments
          .filter(a => a.source === 'FAST ELA')
          .map(a => ({
            testDate: a.testDate ? a.testDate.toISOString().split('T')[0] : 'Unknown',
            score: a.score || 0,
            level: a.level || 0,
            percentile: a.percentile || 0,
            // Add detailed FAST ELA components
            readingComprehension: a.readingComprehension || 0,
            vocabulary: a.vocabulary || 0,
            languageUsage: a.languageUsage || 0,
            readingFluency: a.readingFluency || 0,
            writingScore: a.writingScore || 0,
            listeningComprehension: a.listeningComprehension || 0,
            // Standards-based reporting
            literaryText: a.literaryText || 'Not assessed',
            informationalText: a.informationalText || 'Not assessed',
            vocabularyAcquisition: a.vocabularyAcquisition || 'Not assessed',
            readingFoundations: a.readingFoundations || 'Not assessed',
            performanceLevel: a.performanceLevel || 'Unknown'
          }))
          .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()),
        
        fastMath: studentAssessments
          .filter(a => a.source === 'FAST Math')
          .map(a => ({
            testDate: a.testDate ? a.testDate.toISOString().split('T')[0] : 'Unknown',
            score: a.score || 0,
            level: a.level || 0,
            percentile: a.percentile || 0,
            // Add detailed FAST Math components
            operationsAndAlgebraicThinking: a.operationsAndAlgebraicThinking || 0,
            numberAndOperationsBase10: a.numberAndOperationsBase10 || 0,
            numberAndOperationsFractions: a.numberAndOperationsFractions || 0,
            measurementAndData: a.measurementAndData || 0,
            geometry: a.geometry || 0,
            // Standards-based reporting
            additionSubtraction: a.additionSubtraction || 'Not assessed',
            multiplicationDivision: a.multiplicationDivision || 'Not assessed',
            fractions: a.fractions || 'Not assessed',
            decimalOperations: a.decimalOperations || 'Not assessed',
            geometryMeasurement: a.geometryMeasurement || 'Not assessed',
            performanceLevel: a.performanceLevel || 'Unknown'
          }))
          .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()),
        
        fastScience: studentAssessments
          .filter(a => a.source === 'FAST Science')
          .map(a => ({
            testDate: a.testDate ? a.testDate.toISOString().split('T')[0] : 'Unknown',
            score: a.score || 0,
            level: a.level || 0,
            percentile: a.percentile || 0
          }))
          .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()),
        
        fastWriting: studentAssessments
          .filter(a => a.source === 'FAST Writing')
          .map(a => ({
            testDate: a.testDate ? a.testDate.toISOString().split('T')[0] : 'Unknown',
            score: a.score || 0,
            level: a.level || 0,
            percentile: a.percentile || 0
          }))
          .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())
      };
    }).filter(a => 
      a.iReadyReading.length > 0 || a.iReadyMath.length > 0 || 
      a.fastELA.length > 0 || a.fastMath.length > 0 || 
      a.fastScience.length > 0 || a.fastWriting.length > 0
    );
  }
  
  private static async getDisciplineData(studentIds: string[], students: any[], isIndividualQuery: boolean = false) {
    const disciplineRecords = await db.discipline
      .where('studentId')
      .anyOf(studentIds)
      .toArray();
    
    return students.map(student => {
      let records = disciplineRecords.filter(r => r.studentId === student.id);
      
      // For non-individual queries, limit discipline records to prevent token overflow
      if (!isIndividualQuery && records.length > 10) {
        // Keep most recent 10 incidents
        records = records
          .sort((a, b) => new Date(b.incidentDate).getTime() - new Date(a.incidentDate).getTime())
          .slice(0, 10);
      }
      
      const incidents = records
        .sort((a, b) => new Date(b.incidentDate || 0).getTime() - new Date(a.incidentDate || 0).getTime())
        .map(r => ({
          type: r.incidentType || 'General',
          date: r.incidentDate ? r.incidentDate.toISOString().split('T')[0] : 'Unknown',
          description: r.narrative || r.incident || 'No description',
          severity: r.severity || 'Minor',
          action: r.action || 'Warning',
          location: r.location || 'Unknown'
        }));
      
      const behaviorTrend = this.calculateBehaviorTrend(records);
      
      // Get detailed incident information
      const detailedIncidents = records
        .sort((a, b) => new Date(b.incidentDate || 0).getTime() - new Date(a.incidentDate || 0).getTime())
        .map(r => ({
          date: r.incidentDate ? r.incidentDate.toISOString().split('T')[0] : 'Unknown',
          type: r.incidentType || r.incident || 'General',
          description: r.narrative || r.incident || r.description || 'No description available',
          severity: r.severity || r.disciplineAction || 'Minor',
          action: r.action || r.disciplineAction || r.consequence || 'Warning',
          location: r.location || r.incidentLocation || 'Unknown',
          timeOfDay: r.timeOfIncident || r.time || 'Unknown',
          staffMember: r.reportingStaff || r.staff || 'Unknown',
          followUp: r.followUp || r.parentContact || 'None noted',
          outcome: r.outcome || r.resolution || 'Ongoing'
        }));
      
      return {
        studentId: student.id,
        studentName: student.id, // Use WASABI ID instead of name
        incidentCount: records.length,
        incidents: detailedIncidents, // Use detailed incidents instead
        behaviorTrend,
        incidentsByMonth: this.groupIncidentsByMonth(records),
        mostCommonIncidentType: this.getMostCommonIncidentType(records),
        averageIncidentsPerMonth: records.length > 0 ? (records.length / 12) : 0
      };
    }).filter(d => d.incidentCount > 0);
  }
  
  private static async getFlagData(studentIds: string[], students: any[]) {
    // Get flag rules
    const flagRulesData = localStorage.getItem('wasabi-flag-rules');
    const flagRules = flagRulesData ? JSON.parse(flagRulesData).filter((r: any) => r.isActive) : [];
    
    const flaggedData: any[] = [];
    
    for (const student of students) {
      for (const rule of flagRules) {
        // Simplified flag evaluation - you could import the full logic
        const hasFlag = await this.evaluateStudentFlag(student, rule);
        if (hasFlag.isFlagged) {
          flaggedData.push({
            studentId: student.id,
            studentName: student.id, // Use WASABI ID instead of name
            flagName: rule.name,
            category: rule.category,
            color: rule.color || 'red',
            message: hasFlag.message
          });
        }
      }
    }
    
    return flaggedData;
  }
  
  private static async evaluateStudentFlag(student: any, rule: any): Promise<{ isFlagged: boolean; message: string }> {
    // Simplified flag evaluation - could be expanded
    try {
      switch (rule.category) {
        case 'attendance': {
          const records = await db.attendance.where('studentId').equals(student.id).toArray();
          if (records.length === 0) return { isFlagged: false, message: '' };
          
          const presentDays = records.filter(r => r.status === 'present').length;
          const rate = (presentDays / records.length) * 100;
          const threshold = Number(rule.criteria.threshold);
          
          const isFlagged = rule.criteria.condition === 'below' ? rate < threshold : rate > threshold;
          return {
            isFlagged,
            message: `${rate.toFixed(1)}% attendance`
          };
        }
        case 'grades': {
          const grades = await db.grades.where('studentId').equals(student.id).toArray();
          if (grades.length === 0) return { isFlagged: false, message: '' };
          
          const avg = grades.reduce((sum, g) => sum + (g.grade || 0), 0) / grades.length;
          const threshold = Number(rule.criteria.threshold);
          
          const isFlagged = rule.criteria.condition === 'below' ? avg < threshold : avg > threshold;
          return {
            isFlagged,
            message: `${avg.toFixed(2)} GPA`
          };
        }
        default:
          return { isFlagged: false, message: '' };
      }
    } catch (error) {
      return { isFlagged: false, message: '' };
    }
  }
  
  private static calculateSummary(students: any[], attendance: any[], grades: any[], flags: any[]) {
    const totalStudents = students.length;
    const averageAttendance = attendance.length > 0 
      ? attendance.reduce((sum, a) => sum + a.rate, 0) / attendance.length 
      : 0;
    const averageGrade = grades.length > 0 
      ? grades.reduce((sum, g) => sum + g.averageGrade, 0) / grades.length 
      : 0;
    const studentsWithFlags = new Set(flags.map(f => f.studentId)).size;
    
    // Risk assessment based on flags and performance
    let highRisk = 0, mediumRisk = 0, lowRisk = 0;
    
    students.forEach(student => {
      const studentFlags = flags.filter(f => f.studentId === student.id);
      const studentAttendance = attendance.find(a => a.studentId === student.id);
      const studentGrades = grades.find(g => g.studentId === student.id);
      
      const redFlags = studentFlags.filter(f => f.color === 'red').length;
      const yellowFlags = studentFlags.filter(f => f.color === 'yellow' || f.color === 'orange').length;
      const lowAttendance = studentAttendance && studentAttendance.rate < 85;
      const lowGrades = studentGrades && studentGrades.averageGrade < 2.0;
      
      if (redFlags > 0 || (lowAttendance && lowGrades)) highRisk++;
      else if (yellowFlags > 0 || lowAttendance || lowGrades) mediumRisk++;
      else lowRisk++;
    });
    
    // Determine query type and focused students
    const focusedStudents = students.length <= 5 ? students.map(s => s.id) : [];
    const queryType: 'individual' | 'group' | 'analysis' = 
      students.length === 1 ? 'individual' : 
      students.length <= 10 ? 'group' : 'analysis';
    
    return {
      totalStudents,
      averageAttendance,
      averageGrade,
      studentsWithFlags,
      riskCategories: { highRisk, mediumRisk, lowRisk },
      queryType,
      focusedStudents
    };
  }
  
  // Create focused summary for ranking queries to prevent token overflow
  private static createFocusedSummary(context: StudentDataContext, query: string): StudentDataContext {
    const isGradeQuery = /gpa|grade|academic|lowest|highest|best|worst.*grade/i.test(query);
    const isAttendanceQuery = /attendance|absent|present/i.test(query);
    const isDisciplineQuery = /discipline|behavior|incident/i.test(query);
    
    console.log(`🔧 Creating focused summary for query type - Grade: ${isGradeQuery}, Attendance: ${isAttendanceQuery}, Discipline: ${isDisciplineQuery}`);
    
    if (isGradeQuery) {
      // Keep only essential grade data for GPA ranking
      return {
        ...context,
        attendance: context.attendance.map(a => ({
          ...a,
          allAttendanceRecords: [], // Remove detailed records
          monthlyBreakdown: a.monthlyBreakdown.slice(0, 3) // Latest 3 months
        })),
        discipline: context.discipline.map(d => ({
          ...d,
          incidents: [] // Remove detailed incidents for grade queries
        })),
        assessments: context.assessments.map(a => ({
          ...a,
          // Keep latest assessments only
          iReadyReading: a.iReadyReading.slice(0, 1),
          iReadyMath: a.iReadyMath.slice(0, 1),
          fastELA: a.fastELA.slice(0, 1),
          fastMath: a.fastMath.slice(0, 1),
          fastScience: [],
          fastWriting: []
        }))
      };
    } else if (isAttendanceQuery) {
      // Keep only attendance data
      return {
        ...context,
        grades: [], // Remove grades for attendance queries
        discipline: [],
        assessments: []
      };
    } else if (isDisciplineQuery) {
      // Keep only discipline data
      return {
        ...context,
        grades: [], // Remove grades for discipline queries
        attendance: context.attendance.map(a => ({
          ...a,
          allAttendanceRecords: [], // Keep summary only
          monthlyBreakdown: []
        })),
        assessments: []
      };
    }
    
    // Default: balanced summary
    return {
      ...context,
      attendance: context.attendance.map(a => ({
        ...a,
        allAttendanceRecords: a.allAttendanceRecords.slice(-5), // Last 5 records only
        monthlyBreakdown: a.monthlyBreakdown.slice(-6) // Last 6 months
      })),
      discipline: context.discipline.map(d => ({
        ...d,
        incidents: d.incidents.slice(0, 2) // Latest 2 incidents only
      })),
      assessments: context.assessments.map(a => ({
        ...a,
        iReadyReading: a.iReadyReading.slice(0, 1),
        iReadyMath: a.iReadyMath.slice(0, 1),
        fastELA: a.fastELA.slice(0, 1),
        fastMath: a.fastMath.slice(0, 1),
        fastScience: [],
        fastWriting: []
      }))
    };
  }
  
  // Helper method to calculate monthly attendance breakdown
  private static calculateMonthlyAttendance(records: any[]) {
    const monthlyData = records.reduce((acc, record) => {
      const month = new Date(record.date).toLocaleString('default', { month: 'short', year: 'numeric' });
      if (!acc[month]) acc[month] = { present: 0, absent: 0, total: 0 };
      
      acc[month].total++;
      if (record.status === 'present') acc[month].present++;
      else acc[month].absent++;
      
      return acc;
    }, {} as Record<string, any>);
    
    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      rate: data.total > 0 ? (data.present / data.total) * 100 : 0,
      present: data.present,
      absent: data.absent
    }));
  }
  
  // Helper method to convert numeric grade to GPA scale
  private static convertToGpaScale(grade: number): number {
    if (grade >= 97) return 4.0;
    if (grade >= 93) return 3.7;
    if (grade >= 90) return 3.3;
    if (grade >= 87) return 3.0;
    if (grade >= 83) return 2.7;
    if (grade >= 80) return 2.3;
    if (grade >= 77) return 2.0;
    if (grade >= 73) return 1.7;
    if (grade >= 70) return 1.3;
    if (grade >= 67) return 1.0;
    if (grade >= 65) return 0.7;
    return 0.0;
  }
  
  // Helper method to get letter grade
  private static getLetterGrade(grade: number): string {
    if (grade >= 97) return 'A+';
    if (grade >= 93) return 'A';
    if (grade >= 90) return 'A-';
    if (grade >= 87) return 'B+';
    if (grade >= 83) return 'B';
    if (grade >= 80) return 'B-';
    if (grade >= 77) return 'C+';
    if (grade >= 73) return 'C';
    if (grade >= 70) return 'C-';
    if (grade >= 67) return 'D+';
    if (grade >= 65) return 'D';
    return 'F';
  }
  
  // Helper method to calculate grade trend
  private static calculateGradeTrend(grades: any[]): 'improving' | 'declining' | 'stable' {
    if (grades.length < 3) return 'stable';
    
    // Since most grade records don't have specific dates, we'll use a simple approach
    // by comparing quarters/periods if available, or just first half vs second half
    const gradeValues = grades.map(g => g.grade);
    
    if (gradeValues.length < 6) {
      // For small datasets, compare first half to second half
      const midpoint = Math.floor(gradeValues.length / 2);
      const firstHalf = gradeValues.slice(0, midpoint);
      const secondHalf = gradeValues.slice(midpoint);
      
      const firstAvg = firstHalf.reduce((sum, g) => sum + g, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, g) => sum + g, 0) / secondHalf.length;
      
      const difference = secondAvg - firstAvg;
      if (difference > 3) return 'improving';
      if (difference < -3) return 'declining';
      return 'stable';
    } else {
      // For larger datasets, compare first third to last third
      const thirdSize = Math.floor(gradeValues.length / 3);
      const firstThird = gradeValues.slice(0, thirdSize);
      const lastThird = gradeValues.slice(-thirdSize);
      
      const firstAvg = firstThird.reduce((sum, g) => sum + g, 0) / firstThird.length;
      const lastAvg = lastThird.reduce((sum, g) => sum + g, 0) / lastThird.length;
      
      const difference = lastAvg - firstAvg;
      if (difference > 5) return 'improving';
      if (difference < -5) return 'declining';
      return 'stable';
    }
  }
  
  // Helper method to calculate behavior trend
  private static calculateBehaviorTrend(records: any[]): 'improving' | 'worsening' | 'stable' {
    if (records.length < 2) return 'stable';
    
    const sortedRecords = records
      .filter(r => r.incidentDate)
      .sort((a, b) => new Date(a.incidentDate).getTime() - new Date(b.incidentDate).getTime());
    
    if (sortedRecords.length < 2) return 'stable';
    
    // Look at incidents in last 30 days vs previous 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    
    const recentIncidents = sortedRecords.filter(r => new Date(r.incidentDate) >= thirtyDaysAgo).length;
    const olderIncidents = sortedRecords.filter(r => 
      new Date(r.incidentDate) >= sixtyDaysAgo && new Date(r.incidentDate) < thirtyDaysAgo
    ).length;
    
    if (recentIncidents > olderIncidents) return 'worsening';
    if (recentIncidents < olderIncidents) return 'improving';
    return 'stable';
  }
  
  // Helper method to group incidents by month
  private static groupIncidentsByMonth(records: any[]): Record<string, number> {
    return records.reduce((acc, record) => {
      const month = record.incidentDate ? 
        record.incidentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 
        'Unknown';
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
  
  // Helper method to get most common incident type
  private static getMostCommonIncidentType(records: any[]): string {
    if (records.length === 0) return 'None';
    
    const typeCounts = records.reduce((acc, record) => {
      const type = record.incidentType || record.incident || 'General';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
  }
  
  // Generate comprehensive subject analysis
  static buildSubjectAnalysis(context: any, subject: string): string {
    if (!context?.students?.length) return '';
    
    let analysis = `\n\n=== COMPREHENSIVE ${subject.toUpperCase()} ANALYSIS ===\n\n`;
    
    context.students.forEach((student: any, index: number) => {
      analysis += `STUDENT ${index + 1} (${student.id}) - ${subject} Analysis:\n`;
      
      // Reading/ELA Analysis
      if (subject.toLowerCase().includes('reading') || subject.toLowerCase().includes('ela')) {
        // Correlate grades, iReady Reading, and FAST ELA
        const grades = context.grades?.find((g: any) => g.studentId === student.id);
        const readingSubject = grades?.subjects?.find((s: any) => 
          s.subject.toLowerCase().includes('reading') || 
          s.subject.toLowerCase().includes('ela') || 
          s.subject.toLowerCase().includes('language arts')
        );
        
        const iReadyReading = context.assessments?.find((a: any) => a.studentId === student.id)?.iReadyReading?.[0];
        const fastELA = context.assessments?.find((a: any) => a.studentId === student.id)?.fastELA?.[0];
        
        analysis += `READING COMPREHENSIVE REPORT:\n`;
        
        if (readingSubject) {
          analysis += `  Classroom Reading Grade: ${readingSubject.grade.toFixed(1)}% (${readingSubject.gradeCount} assignments)\n`;
          analysis += `  Grade Range: ${readingSubject.lowestGrade}% - ${readingSubject.highestGrade}%\n`;
        }
        
        if (iReadyReading) {
          analysis += `  iReady Reading (${iReadyReading.testDate}):\n`;
          analysis += `    Overall Score: ${iReadyReading.overallReadingScore} (${iReadyReading.percentile}th percentile, Grade ${iReadyReading.gradeLevel} level)\n`;
          if (iReadyReading.lexileLevel) analysis += `    Lexile Level: ${iReadyReading.lexileLevel}\n`;
          analysis += `    Domain Breakdown:\n`;
          analysis += `      - Phonological Awareness: ${iReadyReading.phonologicalAwareness}\n`;
          analysis += `      - Phonics: ${iReadyReading.phonics}\n`;
          analysis += `      - Vocabulary: ${iReadyReading.vocabulary}\n`;
          analysis += `      - Literature Comprehension: ${iReadyReading.comprehensionLiterature}\n`;
          analysis += `      - Informational Comprehension: ${iReadyReading.comprehensionInformational}\n`;
          analysis += `    Diagnostic Status: ${iReadyReading.diagnosticStatus}\n`;
        }
        
        if (fastELA) {
          analysis += `  FAST ELA (${fastELA.testDate}):\n`;
          analysis += `    Overall Score: ${fastELA.score} (Level ${fastELA.level}, ${fastELA.percentile}th percentile)\n`;
          analysis += `    Performance Level: ${fastELA.performanceLevel}\n`;
          analysis += `    Component Scores:\n`;
          analysis += `      - Reading Comprehension: ${fastELA.readingComprehension}\n`;
          analysis += `      - Vocabulary: ${fastELA.vocabulary}\n`;
          analysis += `      - Reading Fluency: ${fastELA.readingFluency}\n`;
          analysis += `      - Language Usage: ${fastELA.languageUsage}\n`;
          analysis += `    Standards Mastery:\n`;
          analysis += `      - Literary Text: ${fastELA.literaryText}\n`;
          analysis += `      - Informational Text: ${fastELA.informationalText}\n`;
          analysis += `      - Vocabulary Acquisition: ${fastELA.vocabularyAcquisition}\n`;
          analysis += `      - Reading Foundations: ${fastELA.readingFoundations}\n`;
        }
        
        // Cross-correlation analysis
        if (readingSubject && iReadyReading && fastELA) {
          analysis += `  CROSS-CORRELATION ANALYSIS:\n`;
          const gradevsIready = readingSubject.grade - (iReadyReading.percentile * 0.9 + 10); // Rough correlation
          const gradevsFAST = readingSubject.grade - (fastELA.percentile * 0.9 + 10);
          
          analysis += `    Grade vs iReady alignment: ${gradevsIready > 0 ? 'Grade higher' : 'Assessment higher'} (${Math.abs(gradevsIready).toFixed(1)} point difference)\n`;
          analysis += `    Grade vs FAST alignment: ${gradevsFAST > 0 ? 'Grade higher' : 'Assessment higher'} (${Math.abs(gradevsFAST).toFixed(1)} point difference)\n`;
          
          if (Math.abs(gradevsIready) > 15) {
            analysis += `    ⚠️  SIGNIFICANT DISCREPANCY: Classroom grades and iReady scores show major difference\n`;
          }
        }
      }
      
      // Math Analysis
      if (subject.toLowerCase().includes('math')) {
        const grades = context.grades?.find((g: any) => g.studentId === student.id);
        const mathSubject = grades?.subjects?.find((s: any) => s.subject.toLowerCase().includes('math'));
        
        const iReadyMath = context.assessments?.find((a: any) => a.studentId === student.id)?.iReadyMath?.[0];
        const fastMath = context.assessments?.find((a: any) => a.studentId === student.id)?.fastMath?.[0];
        
        analysis += `MATH COMPREHENSIVE REPORT:\n`;
        
        if (mathSubject) {
          analysis += `  Classroom Math Grade: ${mathSubject.grade.toFixed(1)}% (${mathSubject.gradeCount} assignments)\n`;
          analysis += `  Grade Range: ${mathSubject.lowestGrade}% - ${mathSubject.highestGrade}%\n`;
        }
        
        if (iReadyMath) {
          analysis += `  iReady Math (${iReadyMath.testDate}):\n`;
          analysis += `    Overall Score: ${iReadyMath.overallMathScore} (${iReadyMath.percentile}th percentile, Grade ${iReadyMath.gradeLevel} level)\n`;
          analysis += `    Domain Breakdown:\n`;
          analysis += `      - Number & Operations: ${iReadyMath.numberAndOperations}\n`;
          analysis += `      - Algebra & Algebraic Thinking: ${iReadyMath.algebraAndAlgebraicThinking}\n`;
          analysis += `      - Measurement & Data: ${iReadyMath.measurementAndData}\n`;
          analysis += `      - Geometry: ${iReadyMath.geometry}\n`;
          analysis += `    Diagnostic Status: ${iReadyMath.diagnosticStatus}\n`;
        }
        
        if (fastMath) {
          analysis += `  FAST Math (${fastMath.testDate}):\n`;
          analysis += `    Overall Score: ${fastMath.score} (Level ${fastMath.level}, ${fastMath.percentile}th percentile)\n`;
          analysis += `    Performance Level: ${fastMath.performanceLevel}\n`;
          analysis += `    Domain Scores:\n`;
          analysis += `      - Operations & Algebraic Thinking: ${fastMath.operationsAndAlgebraicThinking}\n`;
          analysis += `      - Number & Operations Base 10: ${fastMath.numberAndOperationsBase10}\n`;
          analysis += `      - Fractions: ${fastMath.numberAndOperationsFractions}\n`;
          analysis += `      - Measurement & Data: ${fastMath.measurementAndData}\n`;
          analysis += `      - Geometry: ${fastMath.geometry}\n`;
          analysis += `    Standards Mastery:\n`;
          analysis += `      - Addition/Subtraction: ${fastMath.additionSubtraction}\n`;
          analysis += `      - Multiplication/Division: ${fastMath.multiplicationDivision}\n`;
          analysis += `      - Fractions: ${fastMath.fractions}\n`;
          analysis += `      - Decimals: ${fastMath.decimalOperations}\n`;
          analysis += `      - Geometry/Measurement: ${fastMath.geometryMeasurement}\n`;
        }
        
        // Cross-correlation for math
        if (mathSubject && iReadyMath && fastMath) {
          analysis += `  CROSS-CORRELATION ANALYSIS:\n`;
          const gradevsIready = mathSubject.grade - (iReadyMath.percentile * 0.9 + 10);
          const gradevsFAST = mathSubject.grade - (fastMath.percentile * 0.9 + 10);
          
          analysis += `    Grade vs iReady alignment: ${gradevsIready > 0 ? 'Grade higher' : 'Assessment higher'} (${Math.abs(gradevsIready).toFixed(1)} point difference)\n`;
          analysis += `    Grade vs FAST alignment: ${gradevsFAST > 0 ? 'Grade higher' : 'Assessment higher'} (${Math.abs(gradevsFAST).toFixed(1)} point difference)\n`;
          
          if (Math.abs(gradevsIready) > 15) {
            analysis += `    ⚠️  SIGNIFICANT DISCREPANCY: Classroom grades and assessment scores show major difference\n`;
          }
        }
      }
      
      analysis += '\n';
    });
    
    return analysis;
  }
}