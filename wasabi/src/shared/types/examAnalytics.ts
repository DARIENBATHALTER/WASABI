// Types for exam analytics functionality

export interface StandardPerformance {
  standardCode: string;
  standardDescription: string;
  category: string;
  studentsCount: number;
  averageScore: number;
  averagePercentage: number;
  pointsEarned: number;
  pointsPossible: number;
  studentScores: Array<{
    studentName: string;
    studentId: string;
    pointsEarned: number;
    pointsPossible: number;
    percentage: number;
  }>;
}

export interface TimeSeriesData {
  period: string;
  averageScaleScore: number;
  averagePercentile: number;
  studentCount: number;
}

export interface TestAnalytics {
  testName: string;
  totalStudents: number;
  overallAverage: number;
  standardsPerformance: StandardPerformance[];
  categoryAverages: Record<string, number>;
  timeSeriesData: TimeSeriesData[];
}

export type TestType = 'FAST_ELA_K' | 'FAST_ELA_1' | 'FAST_ELA_2' | 'FAST_ELA_3' | 'FAST_ELA_4' | 'FAST_ELA_5' | 
                     'FAST_MATH_K' | 'FAST_MATH_1' | 'FAST_MATH_2' | 'FAST_MATH_3' | 'FAST_MATH_4' | 'FAST_MATH_5' |
                     'FAST_WRITING_4' | 'FAST_WRITING_5' | 'FAST_SCIENCE_5' |
                     'IREADY_ELA_K' | 'IREADY_ELA_1' | 'IREADY_ELA_2' | 'IREADY_ELA_3' | 'IREADY_ELA_4' | 'IREADY_ELA_5' |
                     'IREADY_MATH_K' | 'IREADY_MATH_1' | 'IREADY_MATH_2' | 'IREADY_MATH_3' | 'IREADY_MATH_4' | 'IREADY_MATH_5';