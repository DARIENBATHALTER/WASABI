import { db } from './db';
import type { Student, AssessmentRecord, AttendanceRecord, GradeRecord, DisciplineRecord } from '../shared/types';

export interface FlagRule {
  id: string;
  name: string;
  category: 'attendance' | 'grades' | 'discipline' | 'iready-reading' | 'iready-math' | 'fast-math' | 'fast-ela' | 'fast-science' | 'fast-writing';
  criteria: {
    type: string;
    threshold: number | string;
    condition: 'above' | 'below' | 'equals';
    timeframe?: string;
  };
  filters?: {
    grades?: string[];
    classes?: string[];
  };
  description: string;
  isActive: boolean;
  createdAt: Date;
}

export interface StudentFlag {
  flagId: string;
  flagName: string;
  category: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

export interface SectionFlags {
  [sectionKey: string]: StudentFlag[];
}

/**
 * Get all active flag rules from storage
 */
export function getFlagRules(): FlagRule[] {
  const stored = localStorage.getItem('wasabi-flag-rules');
  return stored ? JSON.parse(stored) : [];
}

/**
 * Evaluate all flags for a student and return flags organized by profile section
 */
export async function evaluateStudentFlags(studentId: string): Promise<SectionFlags> {
  const flagRules = getFlagRules().filter(rule => rule.isActive);
  const student = await db.students.get(studentId);
  
  if (!student || flagRules.length === 0) {
    return {};
  }

  const sectionFlags: SectionFlags = {};
  
  // Evaluate each active flag rule
  for (const rule of flagRules) {
    const flagResult = await evaluateFlag(student, rule);
    if (flagResult.isFlagged) {
      const flag: StudentFlag = {
        flagId: rule.id,
        flagName: rule.name,
        category: rule.category,
        message: flagResult.message,
        severity: determineSeverity(rule, flagResult)
      };
      
      // Map flag to appropriate profile section(s)
      const sections = mapFlagToSections(rule.category);
      sections.forEach(section => {
        if (!sectionFlags[section]) {
          sectionFlags[section] = [];
        }
        sectionFlags[section].push(flag);
      });
    }
  }
  
  return sectionFlags;
}

/**
 * Evaluate a single flag rule against student data
 */
export async function evaluateFlag(student: Student, rule: FlagRule): Promise<{ isFlagged: boolean; message: string }> {
  try {
    switch (rule.category) {
      case 'attendance': {
        return await evaluateAttendanceFlag(student, rule);
      }
      
      case 'discipline': {
        return await evaluateDisciplineFlag(student, rule);
      }
      
      case 'grades': {
        return await evaluateGPAFlag(student, rule);
      }
      
      case 'iready-reading': 
      case 'iready-math': {
        return await evaluateIReadyFlag(student, rule);
      }
      
      case 'fast-math':
      case 'fast-ela': 
      case 'fast-science':
      case 'fast-writing': {
        return await evaluateFASTFlag(student, rule);
      }
      
      default:
        return { isFlagged: false, message: '' };
    }
  } catch (error) {
    console.error('Error evaluating flag:', rule.name, error);
    return { isFlagged: false, message: '' };
  }
}

/**
 * Evaluate attendance-based flags
 */
async function evaluateAttendanceFlag(student: Student, rule: FlagRule): Promise<{ isFlagged: boolean; message: string }> {
  const attendanceRecords = await db.attendance.where('studentId').equals(student.id).toArray();
  
  if (attendanceRecords.length === 0) {
    return { isFlagged: false, message: 'No attendance data' };
  }
  
  const presentDays = attendanceRecords.filter(r => r.status === 'present').length;
  const attendanceRate = (presentDays / attendanceRecords.length) * 100;
  const threshold = Number(rule.criteria.threshold);
  
  let isFlagged = false;
  switch (rule.criteria.condition) {
    case 'below':
      isFlagged = attendanceRate < threshold;
      break;
    case 'above':
      isFlagged = attendanceRate > threshold;
      break;
    case 'equals':
      isFlagged = Math.abs(attendanceRate - threshold) < 0.1;
      break;
  }
  
  return {
    isFlagged,
    message: `Attendance rate: ${attendanceRate.toFixed(1)}% (${rule.criteria.condition} ${threshold}%)`
  };
}

/**
 * Evaluate discipline-based flags
 */
async function evaluateDisciplineFlag(student: Student, rule: FlagRule): Promise<{ isFlagged: boolean; message: string }> {
  const disciplineRecords = await db.discipline.where('studentId').equals(student.id).toArray();
  const count = disciplineRecords.length;
  const threshold = Number(rule.criteria.threshold);
  
  let isFlagged = false;
  switch (rule.criteria.condition) {
    case 'above':
      isFlagged = count > threshold;
      break;
    case 'below':
      isFlagged = count < threshold;
      break;
    case 'equals':
      isFlagged = count === threshold;
      break;
  }
  
  return {
    isFlagged,
    message: `${count} discipline record${count !== 1 ? 's' : ''} (${rule.criteria.condition} ${threshold})`
  };
}

/**
 * Evaluate GPA-based flags
 */
async function evaluateGPAFlag(student: Student, rule: FlagRule): Promise<{ isFlagged: boolean; message: string }> {
  const gradeRecords = await db.grades.where('studentId').equals(student.id).toArray();
  
  console.log(`🔍 GPA FLAG DEBUG: Student ${student.id}, Found ${gradeRecords.length} grade records`);
  
  if (gradeRecords.length === 0) {
    return { isFlagged: false, message: 'No grade data' };
  }
  
  // Debug grade data
  console.log(`📊 GPA FLAG DEBUG: Sample grades:`, gradeRecords.slice(0, 3).map(g => ({
    course: g.course,
    finalGrade: g.finalGrade,
    gradeType: typeof g.finalGrade
  })));
  
  // Calculate current GPA using finalGrade instead of nested grade structure
  let totalGradePoints = 0;
  let validGradeCount = 0;
  
  gradeRecords.forEach(grade => {
    const gpaValue = convertGradeToGPA(grade.finalGrade);
    console.log(`🧮 GPA FLAG DEBUG: Grade ${grade.finalGrade} → GPA ${gpaValue}`);
    if (gpaValue !== null) {
      totalGradePoints += gpaValue;
      validGradeCount++;
    } else {
      console.log(`❌ GPA FLAG DEBUG: Skipping unparseable grade "${grade.finalGrade}"`);
    }
  });
  
  if (validGradeCount === 0) {
    console.log(`❌ GPA FLAG DEBUG: No valid grades found for conversion`);
    return { isFlagged: false, message: 'No valid grade data for GPA calculation' };
  }
  
  const currentGPA = totalGradePoints / validGradeCount;
  const threshold = Number(rule.criteria.threshold);
  
  console.log(`📈 GPA FLAG DEBUG: Calculated GPA: ${currentGPA.toFixed(2)}, Threshold: ${threshold}, Condition: ${rule.criteria.condition}`);
  
  let isFlagged = false;
  switch (rule.criteria.condition) {
    case 'below':
      isFlagged = currentGPA < threshold;
      break;
    case 'above':
      isFlagged = currentGPA > threshold;
      break;
    case 'equals':
      isFlagged = Math.abs(currentGPA - threshold) < 0.1;
      break;
  }
  
  console.log(`🚩 GPA FLAG DEBUG: Result - isFlagged: ${isFlagged}`);
  
  return {
    isFlagged,
    message: `Current GPA: ${currentGPA.toFixed(2)} (${rule.criteria.condition} ${threshold}) - ${validGradeCount} grades`
  };
}

/**
 * Evaluate iReady-based flags
 */
async function evaluateIReadyFlag(student: Student, rule: FlagRule): Promise<{ isFlagged: boolean; message: string }> {
  // Filter assessments based on the specific rule category (iready-reading vs iready-math)
  let assessments;
  let subject;
  
  if (rule.category === 'iready-reading') {
    assessments = await db.assessments
      .where('studentId')
      .equals(student.id)
      .and(a => 
        (a.source === 'iReady Reading' || a.source === 'iReady') && 
        (a.subject === 'Reading' || a.subject === 'ELA' || a.subject === 'Reading - Overall' || a.subject === 'Reading - Comprehensive' || a.subject?.includes('Reading'))
      )
      .toArray();
    subject = 'Reading';
  } else { // iready-math
    assessments = await db.assessments
      .where('studentId')
      .equals(student.id)
      .and(a => 
        (a.source === 'iReady Math' || a.source === 'iReady') && 
        (a.subject === 'Math' || a.subject === 'Math - Overall' || a.subject === 'Math - Comprehensive' || a.subject?.includes('Math'))
      )
      .toArray();
    subject = 'Math';
  }
  
  if (assessments.length === 0) {
    return { isFlagged: false, message: `No iReady ${subject} data` };
  }
  
  // Get most recent assessment
  const latestAssessment = assessments.sort((a, b) => 
    new Date(b.testDate).getTime() - new Date(a.testDate).getTime()
  )[0];
  
  const score = latestAssessment.score || 0;
  const threshold = Number(rule.criteria.threshold);
  
  let isFlagged = false;
  switch (rule.criteria.condition) {
    case 'below':
      isFlagged = score < threshold;
      break;
    case 'above':
      isFlagged = score > threshold;
      break;
    case 'equals':
      isFlagged = Math.abs(score - threshold) < 1;
      break;
  }
  
  return {
    isFlagged,
    message: `Latest iReady ${subject} score: ${score} (${rule.criteria.condition} ${threshold})`
  };
}

/**
 * Evaluate FAST-based flags
 */
async function evaluateFASTFlag(student: Student, rule: FlagRule): Promise<{ isFlagged: boolean; message: string }> {
  const assessments = await db.assessments
    .where('studentId')
    .equals(student.id)
    .and(a => a.source === 'FAST')
    .toArray();
  
  if (assessments.length === 0) {
    return { isFlagged: false, message: 'No FAST data' };
  }
  
  // Get most recent assessment
  const latestAssessment = assessments.sort((a, b) => 
    new Date(b.testDate).getTime() - new Date(a.testDate).getTime()
  )[0];
  
  const score = latestAssessment.score || 0;
  const threshold = Number(rule.criteria.threshold);
  
  let isFlagged = false;
  switch (rule.criteria.condition) {
    case 'below':
      isFlagged = score < threshold;
      break;
    case 'above':
      isFlagged = score > threshold;
      break;
    case 'equals':
      isFlagged = Math.abs(score - threshold) < 1;
      break;
  }
  
  return {
    isFlagged,
    message: `Latest FAST score: ${score} (${rule.criteria.condition} ${threshold})`
  };
}

/**
 * Map flag categories to profile sections
 */
function mapFlagToSections(category: string): string[] {
  switch (category) {
    case 'attendance':
      return ['attendance'];
    case 'grades':
      return ['grades'];
    case 'discipline':
      return ['discipline'];
    case 'iready-reading':
      return ['iready-reading'];
    case 'iready-math':
      return ['iready-math'];
    case 'fast-math':
      return ['fast-math'];
    case 'fast-ela':
      return ['fast-ela'];
    case 'fast-science':
      return ['fast-science'];
    case 'fast-writing':
      return ['fast-writing'];
    default:
      return [];
  }
}

/**
 * Determine flag severity based on rule and result
 */
function determineSeverity(rule: FlagRule, result: { message: string }): 'low' | 'medium' | 'high' {
  // This is simplified - in a real system you'd have more sophisticated logic
  const threshold = Number(rule.criteria.threshold);
  
  if (rule.category === 'attendance') {
    if (threshold < 80) return 'high';
    if (threshold < 90) return 'medium';
    return 'low';
  }
  
  if (rule.category === 'discipline') {
    if (threshold > 3) return 'high';
    if (threshold > 1) return 'medium';
    return 'low';
  }
  
  return 'medium'; // Default
}

/**
 * Convert grade to GPA value - consistent with analytics-utils.ts
 */
function convertGradeToGPA(grade: string | number): number | null {
  console.log(`🔍 GPA FLAG DEBUG: Converting grade "${grade}" (type: ${typeof grade})`);
  
  // Handle direct letter grades
  if (typeof grade === 'string') {
    const upperGrade = grade.toUpperCase().trim();
    
    // Handle pure letter grades first
    if (['A', 'B', 'C', 'D', 'F'].includes(upperGrade)) {
      const gpaMap = { 'A': 4.0, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0 };
      const result = gpaMap[upperGrade as keyof typeof gpaMap];
      console.log(`🎯 GPA FLAG DEBUG: Pure letter grade ${upperGrade} → ${result}`);
      return result;
    }
    
    // Handle format like "77 C" or "82 B" - extract the number first
    const numericMatch = grade.match(/^\d+(\.\d+)?/);
    if (numericMatch) {
      const numericGrade = parseFloat(numericMatch[0]);
      console.log(`🔢 GPA FLAG DEBUG: Extracted numeric ${numericGrade} from "${grade}"`);
      return convertNumericToGPA(numericGrade);
    }
    
    // Try to parse entire string as number (fallback)
    const numericGrade = parseFloat(grade);
    if (!isNaN(numericGrade)) {
      console.log(`🔢 GPA FLAG DEBUG: Parsed entire string as ${numericGrade}`);
      return convertNumericToGPA(numericGrade);
    }
  } else if (typeof grade === 'number') {
    return convertNumericToGPA(grade);
  }
  
  console.log(`⚠️ GPA FLAG DEBUG: Could not convert grade "${grade}" to GPA, returning null`);
  return null; // Return null for unparseable grades
}

/**
 * Convert numeric percentage to GPA (consistent with analytics-utils.ts)
 */
function convertNumericToGPA(grade: number): number {
  if (grade >= 90) return 4.0; // A
  if (grade >= 80) return 3.0; // B
  if (grade >= 70) return 2.0; // C
  if (grade >= 60) return 1.0; // D
  return 0.0; // F
}