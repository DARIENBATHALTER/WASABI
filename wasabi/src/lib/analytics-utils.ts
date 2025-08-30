import type { Student, AssessmentRecord, AttendanceRecord, GradeRecord, DisciplineRecord } from '../shared/types';

export interface ProficiencyDistribution {
  exceeds: number;
  meets: number;
  approaching: number;
  below: number;
}

export interface AssessmentSummary {
  totalAssessments: number;
  averageScore: number;
  proficiencyDistribution: ProficiencyDistribution;
}

export interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  attendanceRate: number;
}

export interface GradeSummary {
  totalGrades: number;
  averageGrade: number;
  gradeDistribution: {
    A: number;
    B: number;
    C: number;
    D: number;
    F: number;
  };
}

export interface StudentRiskProfile {
  isAtRisk: boolean;
  riskFactors: string[];
  riskScore: number; // 0-100
}

/**
 * Calculate proficiency distribution from assessment records
 */
export function calculateProficiencyDistribution(assessments: AssessmentRecord[]): ProficiencyDistribution {
  const distribution: ProficiencyDistribution = {
    exceeds: 0,
    meets: 0,
    approaching: 0,
    below: 0
  };

  assessments.forEach(assessment => {
    if (assessment.proficiency) {
      distribution[assessment.proficiency]++;
    }
  });

  return distribution;
}

/**
 * Calculate assessment summary statistics
 */
export function calculateAssessmentSummary(assessments: AssessmentRecord[]): AssessmentSummary {
  const totalAssessments = assessments.length;
  
  if (totalAssessments === 0) {
    return {
      totalAssessments: 0,
      averageScore: 0,
      proficiencyDistribution: { exceeds: 0, meets: 0, approaching: 0, below: 0 }
    };
  }

  const validScores = assessments.filter(a => a.score && !isNaN(a.score)).map(a => a.score!);
  const averageScore = validScores.length > 0 
    ? Math.round(validScores.reduce((sum, score) => sum + score, 0) / validScores.length)
    : 0;

  const proficiencyDistribution = calculateProficiencyDistribution(assessments);

  return {
    totalAssessments,
    averageScore,
    proficiencyDistribution
  };
}

/**
 * Calculate attendance summary from attendance records
 */
export function calculateAttendanceSummary(attendance: AttendanceRecord[]): AttendanceSummary {
  const totalDays = attendance.length;
  const presentDays = attendance.filter(record => record.status === 'present').length;
  const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

  return {
    totalDays,
    presentDays,
    attendanceRate: Math.round(attendanceRate * 10) / 10 // Round to 1 decimal
  };
}

/**
 * Calculate grade summary from grade records
 */
export function calculateGradeSummary(grades: GradeRecord[]): GradeSummary {
  const totalGrades = grades.length;
  
  if (totalGrades === 0) {
    return {
      totalGrades: 0,
      averageGrade: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0, F: 0 }
    };
  }

  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  let totalGradePoints = 0;

  grades.forEach(grade => {
    const letterGrade = convertToLetterGrade(grade.finalGrade);
    if (letterGrade && gradeDistribution.hasOwnProperty(letterGrade)) {
      gradeDistribution[letterGrade as keyof typeof gradeDistribution]++;
    }
    
    const gradePoint = convertToGradePoint(grade.finalGrade);
    if (gradePoint !== null) {
      totalGradePoints += gradePoint;
    }
  });

  const averageGrade = totalGrades > 0 ? Math.round((totalGradePoints / totalGrades) * 10) / 10 : 0;

  return {
    totalGrades,
    averageGrade,
    gradeDistribution
  };
}

/**
 * Convert numeric or letter grade to letter grade
 */
function convertToLetterGrade(grade: string | number): string | null {
  if (typeof grade === 'string') {
    const upperGrade = grade.toUpperCase().trim();
    if (['A', 'B', 'C', 'D', 'F'].includes(upperGrade)) {
      return upperGrade;
    }
    // Try to parse as number if it's a string number
    const numericGrade = parseFloat(grade);
    if (!isNaN(numericGrade)) {
      return convertNumericToLetter(numericGrade);
    }
  } else if (typeof grade === 'number') {
    return convertNumericToLetter(grade);
  }
  return null;
}

/**
 * Convert numeric grade to letter grade
 */
function convertNumericToLetter(grade: number): string {
  if (grade >= 90) return 'A';
  if (grade >= 80) return 'B';
  if (grade >= 70) return 'C';
  if (grade >= 60) return 'D';
  return 'F';
}

/**
 * Convert grade to grade point (4.0 scale)
 */
function convertToGradePoint(grade: string | number): number | null {
  const letterGrade = convertToLetterGrade(grade);
  
  switch (letterGrade) {
    case 'A': return 4.0;
    case 'B': return 3.0;
    case 'C': return 2.0;
    case 'D': return 1.0;
    case 'F': return 0.0;
    default: return null;
  }
}

/**
 * Assess student risk profile based on various factors
 */
export function assessStudentRisk(
  student: Student,
  attendance: AttendanceRecord[],
  assessments: AssessmentRecord[],
  grades: GradeRecord[],
  discipline: DisciplineRecord[]
): StudentRiskProfile {
  const riskFactors: string[] = [];
  let riskScore = 0;

  // Attendance risk factors
  const attendanceSummary = calculateAttendanceSummary(attendance);
  if (attendanceSummary.attendanceRate < 90) {
    riskFactors.push('Low Attendance');
    riskScore += 20;
  }
  if (attendanceSummary.attendanceRate < 80) {
    riskScore += 15; // Additional penalty for very low attendance
  }

  // Academic performance risk factors
  const gradeSummary = calculateGradeSummary(grades);
  if (gradeSummary.averageGrade < 2.0) {
    riskFactors.push('Low GPA');
    riskScore += 25;
  }

  // Assessment performance risk factors
  const assessmentSummary = calculateAssessmentSummary(assessments);
  const belowProficiencyRate = assessmentSummary.totalAssessments > 0 
    ? (assessmentSummary.proficiencyDistribution.below / assessmentSummary.totalAssessments) * 100
    : 0;
  
  if (belowProficiencyRate > 50) {
    riskFactors.push('Below Proficiency');
    riskScore += 20;
  }

  // Discipline risk factors
  const majorInfractions = discipline.filter(d => parseInt(d.infractionCode, 10) >= 200).length;
  const suspensions = discipline.filter(d => 
    d.suspensionType === 'out-of-school' || 
    (d.action && d.action.toLowerCase().includes('out-of-school'))
  ).length;

  if (majorInfractions > 0) {
    riskFactors.push('Discipline Issues');
    riskScore += 15;
  }
  if (suspensions > 0) {
    riskFactors.push('Suspensions');
    riskScore += 20;
  }

  // Cap risk score at 100
  riskScore = Math.min(riskScore, 100);

  return {
    isAtRisk: riskScore >= 40, // Consider at-risk if score is 40 or above
    riskFactors,
    riskScore
  };
}

/**
 * Calculate growth metrics between two assessment periods
 */
export function calculateGrowthMetrics(
  currentAssessments: AssessmentRecord[],
  previousAssessments: AssessmentRecord[]
): {
  growthRate: number;
  studentsWithGrowth: number;
  studentsWithDecline: number;
  averageGrowth: number;
} {
  if (currentAssessments.length === 0 || previousAssessments.length === 0) {
    return {
      growthRate: 0,
      studentsWithGrowth: 0,
      studentsWithDecline: 0,
      averageGrowth: 0
    };
  }

  let totalGrowth = 0;
  let studentsWithGrowth = 0;
  let studentsWithDecline = 0;
  let studentsCompared = 0;

  // Group assessments by student
  const currentByStudent = new Map<string, AssessmentRecord[]>();
  const previousByStudent = new Map<string, AssessmentRecord[]>();

  currentAssessments.forEach(assessment => {
    if (!currentByStudent.has(assessment.studentId)) {
      currentByStudent.set(assessment.studentId, []);
    }
    currentByStudent.get(assessment.studentId)!.push(assessment);
  });

  previousAssessments.forEach(assessment => {
    if (!previousByStudent.has(assessment.studentId)) {
      previousByStudent.set(assessment.studentId, []);
    }
    previousByStudent.get(assessment.studentId)!.push(assessment);
  });

  // Compare student performance between periods
  currentByStudent.forEach((currentRecords, studentId) => {
    const previousRecords = previousByStudent.get(studentId);
    if (!previousRecords) return;

    const currentAvg = currentRecords
      .filter(r => r.score && !isNaN(r.score))
      .reduce((sum, r, _, arr) => sum + r.score! / arr.length, 0);
    
    const previousAvg = previousRecords
      .filter(r => r.score && !isNaN(r.score))
      .reduce((sum, r, _, arr) => sum + r.score! / arr.length, 0);

    if (currentAvg > 0 && previousAvg > 0) {
      const growth = currentAvg - previousAvg;
      totalGrowth += growth;
      studentsCompared++;

      if (growth > 0) {
        studentsWithGrowth++;
      } else if (growth < 0) {
        studentsWithDecline++;
      }
    }
  });

  const growthRate = studentsCompared > 0 ? (studentsWithGrowth / studentsCompared) * 100 : 0;
  const averageGrowth = studentsCompared > 0 ? totalGrowth / studentsCompared : 0;

  return {
    growthRate: Math.round(growthRate * 10) / 10,
    studentsWithGrowth,
    studentsWithDecline,
    averageGrowth: Math.round(averageGrowth * 10) / 10
  };
}

/**
 * Group students by a specific field
 */
export function groupStudentsBy<T extends keyof Student>(
  students: Student[],
  field: T
): Map<Student[T], Student[]> {
  const groups = new Map<Student[T], Student[]>();
  
  students.forEach(student => {
    const key = student[field];
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(student);
  });
  
  return groups;
}

/**
 * Calculate percentile rank for a score within a group
 */
export function calculatePercentileRank(score: number, allScores: number[]): number {
  if (allScores.length === 0) return 0;
  
  const validScores = allScores.filter(s => !isNaN(s)).sort((a, b) => a - b);
  const rank = validScores.filter(s => s <= score).length;
  
  return Math.round((rank / validScores.length) * 100);
}