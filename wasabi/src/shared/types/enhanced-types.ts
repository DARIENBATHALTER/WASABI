// Enhanced type definitions for rich dataset integration

export interface EnhancedAttendanceRecord {
  studentId: string;
  date: Date;
  status: 'Present' | 'Absent' | 'Tardy' | 'Excused' | 'Suspended' | 'Other';
  attendanceCode: string;
  dayOfWeek: string;
  month: string;
  isAbsent: boolean;
  isTardy: boolean;
  isExcused: boolean;
  
  // Enhanced analytics
  totalAbsencesToDate: number;
  attendanceRate: number;
  consecutiveAbsences: number;
  
  // Matching metadata
  matchedBy?: 'id' | 'name' | 'criteria';
  matchConfidence?: number;
  originalStudentId?: string;
}

export interface EnhancedDisciplineRecord {
  studentId: string;
  incidentDate: Date;
  submissionDate?: Date;
  infractionCode: string;
  infractionDescription: string;
  
  // Incident details
  reporter: string;
  location?: string;
  incidentTime?: string;
  referralTime?: string;
  incidentNarrative?: string;
  
  // Administrative response
  actionsTaken?: string;
  adminFindings?: string;
  adminSummary?: string;
  administrator?: string;
  
  // Statements and evidence
  studentStatement?: string;
  witnessStatement?: string;
  
  // Previous interventions
  previousActions?: string;
  parentContactResult?: string;
  
  // Risk assessments
  threatAssessment: boolean;
  threatAssessmentDate?: Date;
  hopeFormInitiated: boolean;
  hopeFormDate?: Date;
  
  // Severity indicators
  schoolRelatedArrest: boolean;
  alcoholUse: boolean;
  drugUse: boolean;
  bullying: boolean;
  hateCrime: boolean;
  gangRelated: boolean;
  weaponUse: boolean;
  policeInvolved: boolean;
  
  // Action details
  actionTakenBy?: string;
  actionDaysCompleted?: number;
  actionLength?: number;
  actionBeginDate?: Date;
  actionEndDate?: Date;
  attendanceCode?: string;
  actionNotes?: string;
  
  // Enhanced analytics
  severityLevel: number; // 1-10 scale
  riskScore: number; // 0-100 scale
  interventionType: string;
  
  // Matching metadata
  matchedBy?: 'id' | 'name' | 'criteria';
  matchConfidence?: number;
  originalStudentId?: string;
}

export interface EnhancedAssessmentRecord {
  studentId: string;
  source: string; // 'iReady Reading', 'iReady Math', 'FAST ELA', 'FAST Math', etc.
  testDate: Date;
  subject: string;
  
  // Core scores
  score: number;
  level?: number;
  percentile?: number;
  performanceLevel?: string;
  
  // iReady Reading specific
  placement?: string;
  relativePlacement?: string;
  lexileLevel?: string;
  lexileRange?: string;
  phonologicalAwareness?: number;
  phonics?: number;
  highFrequencyWords?: number;
  vocabulary?: number;
  comprehensionLiterature?: number;
  comprehensionInformational?: number;
  overallReadingScore?: number;
  
  // iReady Reading placements
  phonologicalAwarenessPlacement?: string;
  phonicsPlacement?: string;
  highFrequencyWordsPlacement?: string;
  vocabularyPlacement?: string;
  comprehensionLiteraturePlacement?: string;
  comprehensionInformationalPlacement?: string;
  comprehensionOverallPlacement?: string;
  
  // iReady Math specific
  quantileMeasure?: string;
  quantileRange?: string;
  numberAndOperations?: number;
  algebraAndAlgebraicThinking?: number;
  measurementAndData?: number;
  geometry?: number;
  overallMathScore?: number;
  
  // iReady Math placements
  numberAndOperationsPlacement?: string;
  algebraAndAlgebraicThinkingPlacement?: string;
  measurementAndDataPlacement?: string;
  geometryPlacement?: string;
  
  // Growth metrics (both iReady subjects)
  diagnosticGain?: number;
  annualTypicalGrowth?: number;
  annualStretchGrowth?: number;
  percentProgressTypical?: number;
  percentProgressStretch?: number;
  
  // Test conditions
  duration?: number;
  readAloud?: boolean;
  rushFlag?: boolean;
  baseline?: boolean;
  mostRecentYTD?: boolean;
  
  // Risk indicators
  readingDifficultyIndicator?: boolean;
  riskLevel?: string;
  
  // FAST specific - Standards-based performance
  standardsPerformance?: Record<string, {
    pointsEarned: number;
    pointsPossible: number;
    masteryPercentage: number;
    mastered: boolean;
  }>;
  overallPerformancePercentage?: number;
  totalPointsEarned?: number;
  totalPointsPossible?: number;
  standardsMasteredCount?: number;
  totalStandardsAssessed?: number;
  
  // FAST Performance categories
  readingProsePoetryPerformance?: string;
  readingInformationalTextPerformance?: string;
  readingAcrossGenresVocabularyPerformance?: string;
  
  // Student demographics and support (FAST)
  ethnicity?: string;
  sex?: string;
  section504?: boolean;
  primaryExceptionality?: string;
  englishLanguageLearner?: boolean;
  
  // Test administration details (FAST)
  testReason?: string;
  testOpportunityNumber?: number;
  testCompletionDate?: Date;
  
  // Metadata
  gradeLevel?: string;
  academicYear?: string;
  normingWindow?: string;
  testingLocation?: string;
  enrolledSchool?: string;
  
  // Matching metadata
  matchedBy?: 'id' | 'name' | 'criteria';
  matchConfidence?: number;
  originalStudentId?: string;
}

export interface EnhancedGradeRecord {
  studentId: string;
  course: string;
  gradeLevel?: string;
  teacher?: string;
  section?: string;
  period?: string;
  
  // Grade periods with detailed data
  grades: Array<{
    period: string; // 'Quarter 1', 'Progress Period 1', etc.
    grade: string; // '80 S', '76 N', etc.
    numericGrade: number; // Parsed numeric value
    letterGrade: string; // S, N, U, E, etc.
    passingGrade: boolean;
  }>;
  
  // Analytics
  currentGPA: number;
  averageGrade: number;
  trend: 'improving' | 'declining' | 'stable';
  passingGradeCount: number;
  failingGradeCount: number;
  
  // Matching metadata
  matchedBy?: 'id' | 'name' | 'criteria';
  matchConfidence?: number;
  originalStudentId?: string;
}

// Enhanced student profile with comprehensive data integration
export interface EnhancedStudentProfile {
  student: {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    studentNumber?: string;
    flId?: string;
    grade: string;
    className?: string;
    teacher?: string;
    gender?: string;
    birthDate?: string;
    ethnicity?: string;
    englishLanguageLearner?: boolean;
    specialEducation?: boolean;
    section504?: boolean;
  };
  
  // Comprehensive attendance analysis
  attendance: {
    overallRate: number;
    presentDays: number;
    absentDays: number;
    tardyDays: number;
    excusedDays: number;
    totalDays: number;
    chronicAbsenteeism: boolean;
    consecutiveAbsences: number;
    attendanceTrend: 'improving' | 'declining' | 'stable';
    monthlyBreakdown: Array<{
      month: string;
      rate: number;
      present: number;
      absent: number;
      tardy: number;
    }>;
    dailyRecords: EnhancedAttendanceRecord[];
  };
  
  // Comprehensive academic performance
  academics: {
    overallGPA: number;
    currentGradeLevel: string;
    subjects: Array<{
      subject: string;
      currentGrade: number;
      trend: 'improving' | 'declining' | 'stable';
      passingGradePercentage: number;
      recentPerformance: Array<{
        period: string;
        grade: number;
        letterGrade: string;
      }>;
    }>;
    gradeTrend: 'improving' | 'declining' | 'stable';
    academicRiskLevel: 'High' | 'Medium' | 'Low';
  };
  
  // Comprehensive assessment results
  assessments: {
    iReadyReading?: {
      latestScore: number;
      placement: string;
      lexileLevel: string;
      riskLevel: string;
      domainBreakdown: Record<string, number>;
      growthMetrics: {
        diagnosticGain: number;
        progressToTypical: number;
        progressToStretch: number;
      };
      history: EnhancedAssessmentRecord[];
    };
    
    iReadyMath?: {
      latestScore: number;
      placement: string;
      quantileLevel: string;
      riskLevel: string;
      domainBreakdown: Record<string, number>;
      growthMetrics: {
        diagnosticGain: number;
        progressToTypical: number;
        progressToStretch: number;
      };
      history: EnhancedAssessmentRecord[];
    };
    
    fastELA?: {
      latestScore: number;
      achievementLevel: string;
      percentileRank: number;
      riskLevel: string;
      standardsMastery: Array<{
        standard: string;
        mastered: boolean;
        masteryPercentage: number;
      }>;
      performanceAreas: {
        readingProsePoetry: string;
        readingInformationalText: string;
        readingAcrossGenres: string;
      };
      history: EnhancedAssessmentRecord[];
    };
    
    fastMath?: {
      latestScore: number;
      achievementLevel: string;
      percentileRank: number;
      riskLevel: string;
      standardsMastery: Array<{
        standard: string;
        mastered: boolean;
        masteryPercentage: number;
      }>;
      history: EnhancedAssessmentRecord[];
    };
  };
  
  // Comprehensive behavioral analysis
  behavior: {
    totalIncidents: number;
    severityScore: number; // Average of all incidents
    riskScore: number; // Behavioral risk assessment
    recentIncidents: EnhancedDisciplineRecord[];
    incidentTypes: Record<string, number>;
    interventionsReceived: Array<{
      type: string;
      date: Date;
      effectiveness: 'Effective' | 'Partially Effective' | 'Not Effective';
    }>;
    behaviorTrend: 'improving' | 'worsening' | 'stable';
    threatAssessments: number;
    hopeFormsInitiated: number;
  };
  
  // Comprehensive risk analysis
  riskProfile: {
    overallRiskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
    academicRisk: 'High' | 'Medium' | 'Low';
    attendanceRisk: 'High' | 'Medium' | 'Low';
    behaviorRisk: 'High' | 'Medium' | 'Low';
    riskFactors: string[];
    protectiveFactors: string[];
    recommendedInterventions: string[];
  };
  
  // Intervention tracking
  interventions: {
    active: Array<{
      type: string;
      startDate: Date;
      description: string;
      provider: string;
      progress: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    }>;
    completed: Array<{
      type: string;
      startDate: Date;
      endDate: Date;
      outcome: 'Successful' | 'Partially Successful' | 'Unsuccessful';
    }>;
  };
  
  // Analytics summary for quick reference
  summary: {
    strengths: string[];
    concerns: string[];
    priorities: string[];
    lastUpdated: Date;
  };
}