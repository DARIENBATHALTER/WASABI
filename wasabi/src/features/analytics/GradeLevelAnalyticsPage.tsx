import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { 
  Users, 
  GraduationCap,
  TrendingUp,
  Calendar,
  Calculator,
  BookOpen,
  BarChart3,
  FileText,
  AlertTriangle,
  Star,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { calculateAttendanceSummary, calculateAssessmentSummary, calculateGradeSummary, assessStudentRisk } from '../../lib/analytics-utils';
import { getAttendanceColor, getGPAColor, getIReadyColor, getFASTColor, getAttendancePastelColor, getGPAPastelColor, getIReadyPastelColor, getFASTPastelColor, getNeutralPastelColor, getAtRiskPastelColor, getIReadyPercentileColor, getFASTPercentileColor, getIReadyPercentilePastelColor, getFASTPercentilePastelColor, getOverallTrendPastelColor, getOverallTrendDescription, type PastelColorResult } from '../../lib/score-colors';
import type { Student, AssessmentRecord, AttendanceRecord, GradeRecord, DisciplineRecord } from '../../shared/types';
import PageHeader from '../../shared/components/PageHeader';
import PageWrapper from '../../shared/components/PageWrapper';

interface StudentMetrics {
  student: Student;
  attendanceRate: number;
  currentGPA: number;
  iReadyMathAvg: number;
  iReadyReadingAvg: number;
  fastMathAvg: number;
  fastReadingAvg: number;
  overallTrend: 'excellent' | 'good' | 'needs-attention' | 'at-risk';
  riskFactors: string[];
}

interface GradeSummary {
  gradeLevel: string;
  studentCount: number;
  avgAttendanceRate: number;
  avgGPA: number;
  avgIReadyMath: number;
  avgIReadyReading: number;
  avgFastMath: number;
  avgFastReading: number;
}

type SortField = 'name' | 'class' | 'attendance' | 'gpa' | 'iReadyMath' | 'iReadyReading' | 'fastMath' | 'fastReading' | 'trend';
type SortDirection = 'asc' | 'desc';

export default function GradeLevelAnalyticsPage() {
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Get list of available grade levels
  const { data: availableGrades } = useQuery({
    queryKey: ['available-grades'],
    queryFn: async () => {
      const students = await db.students.toArray();
      console.log('Sample student for grade field analysis:', students[0]);
      // Use 'grade' field which is the correct field name in the database
      const grades = new Set(students.map(s => s.grade?.toString()).filter(Boolean));
      console.log('Found grades:', Array.from(grades));
      return Array.from(grades).sort((a, b) => {
        // Sort grades numerically
        const numA = a === 'K' ? 0 : parseInt(a, 10);
        const numB = b === 'K' ? 0 : parseInt(b, 10);
        return numA - numB;
      });
    }
  });

  // Auto-select first grade when grades are loaded
  useEffect(() => {
    if (availableGrades && availableGrades.length > 0 && !selectedGrade) {
      setSelectedGrade(availableGrades[0]);
    }
  }, [availableGrades, selectedGrade]);

  // Get grade data when a grade is selected
  const { data: gradeData, isLoading } = useQuery({
    queryKey: ['grade-analytics', selectedGrade],
    queryFn: async (): Promise<{ summary: GradeSummary; studentMetrics: StudentMetrics[] }> => {
      if (!selectedGrade) throw new Error('No grade selected');

      console.log(`Loading analytics for grade: ${selectedGrade}`);
      
      // Get students in this grade level - filter in memory since we need string comparison
      const allStudents = await db.students.toArray();
      const students = allStudents.filter(student => student.grade === selectedGrade);

      console.log(`Found ${students.length} students in Grade ${selectedGrade}`);

      if (students.length === 0) {
        return {
          summary: {
            gradeLevel: selectedGrade,
            studentCount: 0,
            avgAttendanceRate: 0,
            avgGPA: 0,
            avgIReadyMath: 0,
            avgIReadyReading: 0,
            avgFastMath: 0,
            avgFastReading: 0
          },
          studentMetrics: []
        };
      }

      const studentIds = students.map(s => s.id);

      // Fetch all data for this grade level
      const [attendance, assessments, grades, discipline] = await Promise.all([
        db.attendance.where('studentId').anyOf(studentIds).toArray(),
        db.assessments.where('studentId').anyOf(studentIds).toArray(),
        db.grades.where('studentId').anyOf(studentIds).toArray(),
        db.discipline.where('studentId').anyOf(studentIds).toArray()
      ]);

      // Calculate metrics for each student
      const studentMetrics: StudentMetrics[] = students.map(student => {
        const studentAttendance = attendance.filter(a => a.studentId === student.id);
        const studentAssessments = assessments.filter(a => a.studentId === student.id);
        const studentGrades = grades.filter(g => g.studentId === student.id);
        const studentDiscipline = discipline.filter(d => d.studentId === student.id);

        // Calculate attendance rate
        const attendanceSummary = calculateAttendanceSummary(studentAttendance);
        
        // Calculate current GPA
        const gradeSummary = calculateGradeSummary(studentGrades);
        
        // Calculate subject-specific assessment averages
        const iReadyMathAssessments = studentAssessments.filter(a => a.source === 'iReady Math');
        const iReadyMath = iReadyMathAssessments.length > 0 
          ? iReadyMathAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / iReadyMathAssessments.length
          : 0;
        
        const iReadyReadingAssessments = studentAssessments.filter(a => a.source === 'iReady Reading');
        const iReadyReading = iReadyReadingAssessments.length > 0
          ? iReadyReadingAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / iReadyReadingAssessments.length
          : 0;
          
        const fastMathAssessments = studentAssessments.filter(a => (a.source === 'FAST' || a.source?.includes('FAST')) && a.subject === 'Math');
        const fastMath = fastMathAssessments.length > 0
          ? fastMathAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / fastMathAssessments.length
          : 0;
          
        const fastReadingAssessments = studentAssessments.filter(a => 
          (a.source === 'FAST' || a.source?.includes('FAST')) && (a.subject === 'Reading' || a.subject === 'ELA')
        );
        const fastReading = fastReadingAssessments.length > 0
          ? fastReadingAssessments.reduce((sum, a) => sum + (a.score || 0), 0) / fastReadingAssessments.length
          : 0;

        // Assess risk and trend
        const riskProfile = assessStudentRisk(student, studentAttendance, studentAssessments, studentGrades, studentDiscipline);
        
        // Determine overall trend
        let overallTrend: StudentMetrics['overallTrend'] = 'good';
        if (riskProfile.riskScore >= 70) overallTrend = 'at-risk';
        else if (riskProfile.riskScore >= 40) overallTrend = 'needs-attention';
        else if (attendanceSummary.attendanceRate >= 95 && gradeSummary.averageGrade >= 3.5) overallTrend = 'excellent';

        return {
          student,
          attendanceRate: attendanceSummary.attendanceRate,
          currentGPA: gradeSummary.averageGrade,
          iReadyMathAvg: Math.round(iReadyMath),
          iReadyReadingAvg: Math.round(iReadyReading),
          fastMathAvg: Math.round(fastMath),
          fastReadingAvg: Math.round(fastReading),
          overallTrend,
          riskFactors: riskProfile.riskFactors
        };
      });

      // Calculate grade summary
      const validAttendance = studentMetrics.filter(s => s.attendanceRate > 0);
      const validGPA = studentMetrics.filter(s => s.currentGPA > 0);
      const validIReadyMath = studentMetrics.filter(s => s.iReadyMathAvg > 0);
      const validIReadyReading = studentMetrics.filter(s => s.iReadyReadingAvg > 0);
      const validFastMath = studentMetrics.filter(s => s.fastMathAvg > 0);
      const validFastReading = studentMetrics.filter(s => s.fastReadingAvg > 0);

      const summary: GradeSummary = {
        gradeLevel: selectedGrade,
        studentCount: students.length,
        avgAttendanceRate: validAttendance.length > 0 
          ? Math.round(validAttendance.reduce((sum, s) => sum + s.attendanceRate, 0) / validAttendance.length)
          : 0,
        avgGPA: validGPA.length > 0
          ? Math.round((validGPA.reduce((sum, s) => sum + s.currentGPA, 0) / validGPA.length) * 100) / 100
          : 0,
        avgIReadyMath: validIReadyMath.length > 0
          ? Math.round(validIReadyMath.reduce((sum, s) => sum + s.iReadyMathAvg, 0) / validIReadyMath.length)
          : 0,
        avgIReadyReading: validIReadyReading.length > 0
          ? Math.round(validIReadyReading.reduce((sum, s) => sum + s.iReadyReadingAvg, 0) / validIReadyReading.length)
          : 0,
        avgFastMath: validFastMath.length > 0
          ? Math.round(validFastMath.reduce((sum, s) => sum + s.fastMathAvg, 0) / validFastMath.length)
          : 0,
        avgFastReading: validFastReading.length > 0
          ? Math.round(validFastReading.reduce((sum, s) => sum + s.fastReadingAvg, 0) / validFastReading.length)
          : 0
      };

      // Calculate score arrays for percentile coloring
      const allIReadyMathScores = studentMetrics.map(s => s.iReadyMathAvg).filter(s => s > 0);
      const allIReadyReadingScores = studentMetrics.map(s => s.iReadyReadingAvg).filter(s => s > 0);
      const allFastMathScores = studentMetrics.map(s => s.fastMathAvg).filter(s => s > 0);
      const allFastReadingScores = studentMetrics.map(s => s.fastReadingAvg).filter(s => s > 0);

      return { 
        summary, 
        studentMetrics,
        scoreArrays: {
          iReadyMath: allIReadyMathScores,
          iReadyReading: allIReadyReadingScores,
          fastMath: allFastMathScores,
          fastReading: allFastReadingScores
        }
      };
    },
    enabled: !!selectedGrade
  });

  const getTrendColor = (trend: StudentMetrics['overallTrend']) => {
    switch (trend) {
      case 'excellent': return 'text-green-700 bg-green-100 border-green-300 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800';
      case 'good': return 'text-blue-700 bg-blue-100 border-blue-300 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800';
      case 'needs-attention': return 'text-yellow-700 bg-yellow-100 border-yellow-300 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'at-risk': return 'text-red-700 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    }
  };

  const getTrendIcon = (trend: StudentMetrics['overallTrend']) => {
    switch (trend) {
      case 'excellent': return <Star className="w-3 h-3" />;
      case 'good': return <CheckCircle className="w-3 h-3" />;
      case 'needs-attention': return <AlertTriangle className="w-3 h-3" />;
      case 'at-risk': return <AlertCircle className="w-3 h-3" />;
    }
  };

  // Convert border class to text color class for icons and text (darker than border)
  const borderToTextColor = (borderClass: string) => {
    if (borderClass.includes('border-blue-300')) return 'text-blue-800 dark:text-blue-300';
    if (borderClass.includes('border-green-300')) return 'text-green-800 dark:text-green-300';
    if (borderClass.includes('border-yellow-300')) return 'text-yellow-800 dark:text-yellow-300';
    if (borderClass.includes('border-orange-300')) return 'text-orange-800 dark:text-orange-300';
    if (borderClass.includes('border-red-300')) return 'text-red-800 dark:text-red-300';
    if (borderClass.includes('border-gray-300')) return 'text-gray-700 dark:text-gray-300';
    return 'text-gray-700 dark:text-gray-300';
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };


  // Sort the student metrics
  const sortedStudentMetrics = useMemo(() => {
    if (!gradeData?.studentMetrics) return [];
    
    const sorted = [...gradeData.studentMetrics].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = `${a.student.lastName}, ${a.student.firstName}`.toLowerCase();
          bValue = `${b.student.lastName}, ${b.student.firstName}`.toLowerCase();
          break;
        case 'class':
          aValue = (a.student.className || '').toLowerCase();
          bValue = (b.student.className || '').toLowerCase();
          break;
        case 'attendance':
          aValue = a.attendanceRate;
          bValue = b.attendanceRate;
          break;
        case 'gpa':
          aValue = a.currentGPA;
          bValue = b.currentGPA;
          break;
        case 'iReadyMath':
          aValue = a.iReadyMathAvg || 0;
          bValue = b.iReadyMathAvg || 0;
          break;
        case 'iReadyReading':
          aValue = a.iReadyReadingAvg || 0;
          bValue = b.iReadyReadingAvg || 0;
          break;
        case 'fastMath':
          aValue = a.fastMathAvg || 0;
          bValue = b.fastMathAvg || 0;
          break;
        case 'fastReading':
          aValue = a.fastReadingAvg || 0;
          bValue = b.fastReadingAvg || 0;
          break;
        case 'trend':
          const trendOrder = { 'excellent': 4, 'good': 3, 'needs-attention': 2, 'at-risk': 1 };
          aValue = trendOrder[a.overallTrend];
          bValue = trendOrder[b.overallTrend];
          break;
        default:
          return 0;
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [gradeData?.studentMetrics, sortField, sortDirection]);

  return (
    <PageWrapper>
      <PageHeader
        title="Grade Level Analytics Dashboard"
        description="Performance insights by grade level across all classes"
        icon={GraduationCap}
        iconColor="text-green-600"
      >
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Select Grade Level:
          </label>
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="py-2 px-3 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-wasabi-green focus:ring-wasabi-green"
          >
            <option value="">Choose a grade level...</option>
            {availableGrades?.map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

      {selectedGrade && gradeData && (
        <>
          {/* Grade Summary Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Attendance Tile */}
            <div className={`${getAttendancePastelColor(gradeData.summary.avgAttendanceRate).bgClassName} ${getAttendancePastelColor(gradeData.summary.avgAttendanceRate).borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <Calendar className={`w-10 h-10 mx-auto mb-2 ${borderToTextColor(getAttendancePastelColor(gradeData.summary.avgAttendanceRate).borderClassName)}`} />
                <p className={`${borderToTextColor(getAttendancePastelColor(gradeData.summary.avgAttendanceRate).borderClassName)} text-sm font-medium`}>Grade Attendance</p>
                <p className={`text-2xl font-bold ${borderToTextColor(getAttendancePastelColor(gradeData.summary.avgAttendanceRate).borderClassName)}`}>{gradeData.summary.avgAttendanceRate}%</p>
              </div>
            </div>

            {/* GPA Tile */}
            <div className={`${getGPAPastelColor(gradeData.summary.avgGPA).bgClassName} ${getGPAPastelColor(gradeData.summary.avgGPA).borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <GraduationCap className={`w-10 h-10 mx-auto mb-2 ${borderToTextColor(getGPAPastelColor(gradeData.summary.avgGPA).borderClassName)}`} />
                <p className={`${borderToTextColor(getGPAPastelColor(gradeData.summary.avgGPA).borderClassName)} text-sm font-medium`}>Grade Average GPA</p>
                <p className={`text-2xl font-bold ${borderToTextColor(getGPAPastelColor(gradeData.summary.avgGPA).borderClassName)}`}>{gradeData.summary.avgGPA}</p>
              </div>
            </div>

            {/* iReady Math Tile */}
            <div className={`${gradeData.summary.avgIReadyMath ? getIReadyPercentilePastelColor(gradeData.summary.avgIReadyMath, gradeData.scoreArrays.iReadyMath).bgClassName : getNeutralPastelColor().bgClassName} ${gradeData.summary.avgIReadyMath ? getIReadyPercentilePastelColor(gradeData.summary.avgIReadyMath, gradeData.scoreArrays.iReadyMath).borderClassName : getNeutralPastelColor().borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <Calculator className={`w-10 h-10 mx-auto mb-2 ${gradeData.summary.avgIReadyMath ? borderToTextColor(getIReadyPercentilePastelColor(gradeData.summary.avgIReadyMath, gradeData.scoreArrays.iReadyMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`} />
                <p className={`${gradeData.summary.avgIReadyMath ? borderToTextColor(getIReadyPercentilePastelColor(gradeData.summary.avgIReadyMath, gradeData.scoreArrays.iReadyMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)} text-sm font-medium`}>iReady Math Avg</p>
                <p className={`text-2xl font-bold ${gradeData.summary.avgIReadyMath ? borderToTextColor(getIReadyPercentilePastelColor(gradeData.summary.avgIReadyMath, gradeData.scoreArrays.iReadyMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`}>{gradeData.summary.avgIReadyMath || 'N/A'}</p>
              </div>
            </div>

            {/* iReady Reading Tile */}
            <div className={`${gradeData.summary.avgIReadyReading ? getIReadyPercentilePastelColor(gradeData.summary.avgIReadyReading, gradeData.scoreArrays.iReadyReading).bgClassName : getNeutralPastelColor().bgClassName} ${gradeData.summary.avgIReadyReading ? getIReadyPercentilePastelColor(gradeData.summary.avgIReadyReading, gradeData.scoreArrays.iReadyReading).borderClassName : getNeutralPastelColor().borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <BookOpen className={`w-10 h-10 mx-auto mb-2 ${gradeData.summary.avgIReadyReading ? borderToTextColor(getIReadyPercentilePastelColor(gradeData.summary.avgIReadyReading, gradeData.scoreArrays.iReadyReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`} />
                <p className={`${gradeData.summary.avgIReadyReading ? borderToTextColor(getIReadyPercentilePastelColor(gradeData.summary.avgIReadyReading, gradeData.scoreArrays.iReadyReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)} text-sm font-medium`}>iReady Reading Avg</p>
                <p className={`text-2xl font-bold ${gradeData.summary.avgIReadyReading ? borderToTextColor(getIReadyPercentilePastelColor(gradeData.summary.avgIReadyReading, gradeData.scoreArrays.iReadyReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`}>{gradeData.summary.avgIReadyReading || 'N/A'}</p>
              </div>
            </div>

            {/* FAST Math Tile */}
            <div className={`${gradeData.summary.avgFastMath ? getFASTPercentilePastelColor(gradeData.summary.avgFastMath, gradeData.scoreArrays.fastMath).bgClassName : getNeutralPastelColor().bgClassName} ${gradeData.summary.avgFastMath ? getFASTPercentilePastelColor(gradeData.summary.avgFastMath, gradeData.scoreArrays.fastMath).borderClassName : getNeutralPastelColor().borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <BarChart3 className={`w-10 h-10 mx-auto mb-2 ${gradeData.summary.avgFastMath ? borderToTextColor(getFASTPercentilePastelColor(gradeData.summary.avgFastMath, gradeData.scoreArrays.fastMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`} />
                <p className={`${gradeData.summary.avgFastMath ? borderToTextColor(getFASTPercentilePastelColor(gradeData.summary.avgFastMath, gradeData.scoreArrays.fastMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)} text-sm font-medium`}>FAST Math Avg</p>
                <p className={`text-2xl font-bold ${gradeData.summary.avgFastMath ? borderToTextColor(getFASTPercentilePastelColor(gradeData.summary.avgFastMath, gradeData.scoreArrays.fastMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`}>{gradeData.summary.avgFastMath || 'N/A'}</p>
              </div>
            </div>

            {/* FAST Reading Tile */}
            <div className={`${gradeData.summary.avgFastReading ? getFASTPercentilePastelColor(gradeData.summary.avgFastReading, gradeData.scoreArrays.fastReading).bgClassName : getNeutralPastelColor().bgClassName} ${gradeData.summary.avgFastReading ? getFASTPercentilePastelColor(gradeData.summary.avgFastReading, gradeData.scoreArrays.fastReading).borderClassName : getNeutralPastelColor().borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <FileText className={`w-10 h-10 mx-auto mb-2 ${gradeData.summary.avgFastReading ? borderToTextColor(getFASTPercentilePastelColor(gradeData.summary.avgFastReading, gradeData.scoreArrays.fastReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`} />
                <p className={`${gradeData.summary.avgFastReading ? borderToTextColor(getFASTPercentilePastelColor(gradeData.summary.avgFastReading, gradeData.scoreArrays.fastReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)} text-sm font-medium`}>FAST Reading Avg</p>
                <p className={`text-2xl font-bold ${gradeData.summary.avgFastReading ? borderToTextColor(getFASTPercentilePastelColor(gradeData.summary.avgFastReading, gradeData.scoreArrays.fastReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`}>{gradeData.summary.avgFastReading || 'N/A'}</p>
              </div>
            </div>

            {/* Overall Trend Tile */}
            <div className={`${getOverallTrendPastelColor(
              gradeData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
              gradeData.studentMetrics.filter(s => s.overallTrend === 'good').length,
              gradeData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
              gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
              gradeData.summary.studentCount
            ).bgClassName} ${getOverallTrendPastelColor(
              gradeData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
              gradeData.studentMetrics.filter(s => s.overallTrend === 'good').length,
              gradeData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
              gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
              gradeData.summary.studentCount
            ).borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <TrendingUp className={`w-10 h-10 mx-auto mb-2 ${getOverallTrendPastelColor(
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'good').length,
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
                  gradeData.summary.studentCount
                ).textClassName}`} />
                <p className={`${getOverallTrendPastelColor(
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'good').length,
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
                  gradeData.summary.studentCount
                ).textClassName} text-sm font-medium`}>Overall Trend</p>
                <p className={`text-xl font-bold ${getOverallTrendPastelColor(
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'good').length,
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
                  gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
                  gradeData.summary.studentCount
                ).textClassName}`}>
                  {getOverallTrendDescription(
                    gradeData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
                    gradeData.studentMetrics.filter(s => s.overallTrend === 'good').length,
                    gradeData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
                    gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
                    gradeData.summary.studentCount
                  )}
                </p>
              </div>
            </div>

            {/* At Risk Count Tile */}
            <div className={`${getAtRiskPastelColor(gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, gradeData.summary.studentCount).bgClassName} ${getAtRiskPastelColor(gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, gradeData.summary.studentCount).borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <AlertTriangle className={`w-10 h-10 mx-auto mb-2 ${borderToTextColor(getAtRiskPastelColor(gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, gradeData.summary.studentCount).borderClassName)}`} />
                <p className={`${borderToTextColor(getAtRiskPastelColor(gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, gradeData.summary.studentCount).borderClassName)} text-sm font-medium`}>At-Risk Students</p>
                <p className={`text-2xl font-bold ${borderToTextColor(getAtRiskPastelColor(gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, gradeData.summary.studentCount).borderClassName)}`}>
                  {gradeData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length}
                </p>
              </div>
            </div>
          </div>

          {/* Student Performance Table */}
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                <FileText className="inline w-5 h-5 mr-2" />Individual Student Performance - Grade {selectedGrade} ({gradeData.summary.studentCount})
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Detailed metrics for each student across all classes in Grade {selectedGrade}
              </p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                      onClick={() => handleSort('name')}
                    >
                      Student Name
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                      onClick={() => handleSort('class')}
                    >
                      Class
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-24"
                      onClick={() => handleSort('attendance')}
                    >
Attendance
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-20"
                      onClick={() => handleSort('gpa')}
                    >
Current GPA
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-24"
                      onClick={() => handleSort('iReadyMath')}
                    >
iReady Math
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-28"
                      onClick={() => handleSort('iReadyReading')}
                    >
iReady Reading
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-24"
                      onClick={() => handleSort('fastMath')}
                    >
FAST Math
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none w-28"
                      onClick={() => handleSort('fastReading')}
                    >
FAST Reading
                    </th>
                    <th 
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                      onClick={() => handleSort('trend')}
                    >
Overall Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {sortedStudentMetrics.map((studentData) => (
                    <tr key={studentData.student.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {studentData.student.firstName} {studentData.student.lastName}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {studentData.student.className || 'No class assigned'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.attendanceRate > 0 ? getAttendanceColor(studentData.attendanceRate).className : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {studentData.attendanceRate > 0 ? `${studentData.attendanceRate.toFixed(1)}%` : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.currentGPA > 0 ? getGPAColor(studentData.currentGPA).className : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {studentData.currentGPA > 0 ? studentData.currentGPA.toFixed(2) : '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.iReadyMathAvg > 0 ? getIReadyPercentileColor(studentData.iReadyMathAvg, gradeData.scoreArrays.iReadyMath).className : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {studentData.iReadyMathAvg || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.iReadyReadingAvg > 0 ? getIReadyPercentileColor(studentData.iReadyReadingAvg, gradeData.scoreArrays.iReadyReading).className : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {studentData.iReadyReadingAvg || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.fastMathAvg > 0 ? getFASTPercentileColor(studentData.fastMathAvg, gradeData.scoreArrays.fastMath).className : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {studentData.fastMathAvg || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.fastReadingAvg > 0 ? getFASTPercentileColor(studentData.fastReadingAvg, gradeData.scoreArrays.fastReading).className : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {studentData.fastReadingAvg || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getTrendColor(studentData.overallTrend)}`}>
                          <span className="inline-flex items-center gap-1">{getTrendIcon(studentData.overallTrend)} {studentData.overallTrend.replace('-', ' ').toUpperCase()}</span>
                        </span>
                        {studentData.riskFactors.length > 0 && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {studentData.riskFactors.slice(0, 2).join(', ')}
                            {studentData.riskFactors.length > 2 && '...'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedGrade && (
        <div className="text-center py-12">
          <GraduationCap className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">Select a Grade Level</h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Choose a grade level from the dropdown above to view detailed analytics.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading grade level data...</span>
        </div>
      )}
      </div>
    </PageWrapper>
  );
}