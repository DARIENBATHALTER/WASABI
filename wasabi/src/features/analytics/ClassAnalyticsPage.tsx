import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { 
  Users,
  ChevronUp,
  ChevronDown,
  TrendingUp,
  Calendar,
  GraduationCap,
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

interface ClassSummary {
  className: string;
  studentCount: number;
  avgAttendanceRate: number;
  avgGPA: number;
  avgIReadyMath: number;
  avgIReadyReading: number;
  avgFastMath: number;
  avgFastReading: number;
}

type SortField = 'name' | 'attendance' | 'gpa' | 'iReadyMath' | 'iReadyReading' | 'fastMath' | 'fastReading' | 'trend';
type SortDirection = 'asc' | 'desc';

export default function ClassAnalyticsPage() {
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  // Get list of available classes/teachers
  const { data: availableClasses } = useQuery({
    queryKey: ['available-classes'],
    queryFn: async () => {
      const students = await db.students.toArray();
      // Check both className and homeRoomTeacher fields
      const classes = new Set<string>();
      students.forEach(student => {
        if (student.className) classes.add(student.className);
        if (student.homeRoomTeacher) classes.add(student.homeRoomTeacher);
      });
      return Array.from(classes).filter(Boolean).sort();
    }
  });

  // Auto-select first class when classes are loaded
  useEffect(() => {
    if (availableClasses && availableClasses.length > 0 && !selectedClass) {
      setSelectedClass(availableClasses[0]);
    }
  }, [availableClasses, selectedClass]);

  // Get class data when a class is selected
  const { data: classData, isLoading } = useQuery({
    queryKey: ['class-analytics', selectedClass],
    queryFn: async (): Promise<{ summary: ClassSummary; studentMetrics: StudentMetrics[] }> => {
      if (!selectedClass) throw new Error('No class selected');

      console.log(`🏫 Loading analytics for class: ${selectedClass}`);
      
      // Get students in this class - need to filter in memory since className is not indexed
      const allStudents = await db.students.toArray();
      const students = allStudents.filter(student => 
        student.className === selectedClass || student.homeRoomTeacher === selectedClass
      );

      console.log(`👥 Found ${students.length} students in ${selectedClass}`);

      if (students.length === 0) {
        return {
          summary: {
            className: selectedClass,
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

      // Fetch all data for this class
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
        const iReadyMath = studentAssessments
          .filter(a => a.source === 'iReady Math')
          .reduce((sum, a, _, arr) => sum + (a.score || 0) / arr.length, 0);
        
        const iReadyReading = studentAssessments
          .filter(a => a.source === 'iReady Reading')
          .reduce((sum, a, _, arr) => sum + (a.score || 0) / arr.length, 0);
          
        const fastMath = studentAssessments
          .filter(a => (a.source === 'FAST' || a.source?.includes('FAST')) && a.subject === 'Math')
          .reduce((sum, a, _, arr) => sum + (a.score || 0) / arr.length, 0);
          
        const fastReading = studentAssessments
          .filter(a => (a.source === 'FAST' || a.source?.includes('FAST')) && (a.subject === 'Reading' || a.subject === 'ELA'))
          .reduce((sum, a, _, arr) => sum + (a.score || 0) / arr.length, 0);

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

      // Calculate class summary
      const summary: ClassSummary = {
        className: selectedClass,
        studentCount: students.length,
        avgAttendanceRate: Math.round(studentMetrics.reduce((sum, s) => sum + s.attendanceRate, 0) / students.length),
        avgGPA: Math.round((studentMetrics.reduce((sum, s) => sum + s.currentGPA, 0) / students.length) * 100) / 100,
        avgIReadyMath: Math.round(studentMetrics.reduce((sum, s) => sum + s.iReadyMathAvg, 0) / students.length),
        avgIReadyReading: Math.round(studentMetrics.reduce((sum, s) => sum + s.iReadyReadingAvg, 0) / students.length),
        avgFastMath: Math.round(studentMetrics.reduce((sum, s) => sum + s.fastMathAvg, 0) / students.length),
        avgFastReading: Math.round(studentMetrics.reduce((sum, s) => sum + s.fastReadingAvg, 0) / students.length)
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
    enabled: !!selectedClass
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

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronUp className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' ? 
      <ChevronUp className="w-4 h-4 text-gray-600 dark:text-gray-300" /> : 
      <ChevronDown className="w-4 h-4 text-gray-600 dark:text-gray-300" />;
  };

  // Sort the student metrics
  const sortedStudentMetrics = useMemo(() => {
    if (!classData?.studentMetrics) return [];
    
    const sorted = [...classData.studentMetrics].sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortField) {
        case 'name':
          aValue = `${a.student.lastName}, ${a.student.firstName}`.toLowerCase();
          bValue = `${b.student.lastName}, ${b.student.firstName}`.toLowerCase();
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
  }, [classData?.studentMetrics, sortField, sortDirection]);

  return (
    <PageWrapper>
      <PageHeader
        title="Class Analytics Dashboard"
        description="Detailed performance insights for individual classes"
        icon={BarChart3}
        iconColor="text-blue-600"
      >
        <div className="flex items-center space-x-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            Select Class:
          </label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="py-2 px-3 rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-wasabi-green focus:ring-wasabi-green"
          >
            <option value="">Choose a class...</option>
            {availableClasses?.map((className) => (
              <option key={className} value={className}>
                {className}
              </option>
            ))}
          </select>
        </div>
      </PageHeader>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

      {selectedClass && classData && (
        <>
          {/* Class Summary Tiles */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Attendance Tile */}
            <div className={`${getAttendancePastelColor(classData.summary.avgAttendanceRate).bgClassName} ${getAttendancePastelColor(classData.summary.avgAttendanceRate).borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <Calendar className={`w-10 h-10 mx-auto mb-2 ${borderToTextColor(getAttendancePastelColor(classData.summary.avgAttendanceRate).borderClassName)}`} />
                <p className={`${borderToTextColor(getAttendancePastelColor(classData.summary.avgAttendanceRate).borderClassName)} text-sm font-medium`}>Class Attendance</p>
                <p className={`text-2xl font-bold ${borderToTextColor(getAttendancePastelColor(classData.summary.avgAttendanceRate).borderClassName)}`}>{classData.summary.avgAttendanceRate}%</p>
              </div>
            </div>

            {/* GPA Tile */}
            <div className={`${getGPAPastelColor(classData.summary.avgGPA).bgClassName} ${getGPAPastelColor(classData.summary.avgGPA).borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <GraduationCap className={`w-10 h-10 mx-auto mb-2 ${borderToTextColor(getGPAPastelColor(classData.summary.avgGPA).borderClassName)}`} />
                <p className={`${borderToTextColor(getGPAPastelColor(classData.summary.avgGPA).borderClassName)} text-sm font-medium`}>Class Average GPA</p>
                <p className={`text-2xl font-bold ${borderToTextColor(getGPAPastelColor(classData.summary.avgGPA).borderClassName)}`}>{classData.summary.avgGPA}</p>
              </div>
            </div>

            {/* iReady Math Tile */}
            <div className={`${classData.summary.avgIReadyMath ? getIReadyPercentilePastelColor(classData.summary.avgIReadyMath, classData.scoreArrays.iReadyMath).bgClassName : getNeutralPastelColor().bgClassName} ${classData.summary.avgIReadyMath ? getIReadyPercentilePastelColor(classData.summary.avgIReadyMath, classData.scoreArrays.iReadyMath).borderClassName : getNeutralPastelColor().borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <Calculator className={`w-10 h-10 mx-auto mb-2 ${classData.summary.avgIReadyMath ? borderToTextColor(getIReadyPercentilePastelColor(classData.summary.avgIReadyMath, classData.scoreArrays.iReadyMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`} />
                <p className={`${classData.summary.avgIReadyMath ? borderToTextColor(getIReadyPercentilePastelColor(classData.summary.avgIReadyMath, classData.scoreArrays.iReadyMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)} text-sm font-medium`}>iReady Math Avg</p>
                <p className={`text-2xl font-bold ${classData.summary.avgIReadyMath ? borderToTextColor(getIReadyPercentilePastelColor(classData.summary.avgIReadyMath, classData.scoreArrays.iReadyMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`}>{classData.summary.avgIReadyMath || 'N/A'}</p>
              </div>
            </div>

            {/* iReady Reading Tile */}
            <div className={`${classData.summary.avgIReadyReading ? getIReadyPercentilePastelColor(classData.summary.avgIReadyReading, classData.scoreArrays.iReadyReading).bgClassName : getNeutralPastelColor().bgClassName} ${classData.summary.avgIReadyReading ? getIReadyPercentilePastelColor(classData.summary.avgIReadyReading, classData.scoreArrays.iReadyReading).borderClassName : getNeutralPastelColor().borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <BookOpen className={`w-10 h-10 mx-auto mb-2 ${classData.summary.avgIReadyReading ? borderToTextColor(getIReadyPercentilePastelColor(classData.summary.avgIReadyReading, classData.scoreArrays.iReadyReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`} />
                <p className={`${classData.summary.avgIReadyReading ? borderToTextColor(getIReadyPercentilePastelColor(classData.summary.avgIReadyReading, classData.scoreArrays.iReadyReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)} text-sm font-medium`}>iReady Reading Avg</p>
                <p className={`text-2xl font-bold ${classData.summary.avgIReadyReading ? borderToTextColor(getIReadyPercentilePastelColor(classData.summary.avgIReadyReading, classData.scoreArrays.iReadyReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`}>{classData.summary.avgIReadyReading || 'N/A'}</p>
              </div>
            </div>

            {/* FAST Math Tile */}
            <div className={`${classData.summary.avgFastMath ? getFASTPercentilePastelColor(classData.summary.avgFastMath, classData.scoreArrays.fastMath).bgClassName : getNeutralPastelColor().bgClassName} ${classData.summary.avgFastMath ? getFASTPercentilePastelColor(classData.summary.avgFastMath, classData.scoreArrays.fastMath).borderClassName : getNeutralPastelColor().borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <BarChart3 className={`w-10 h-10 mx-auto mb-2 ${classData.summary.avgFastMath ? borderToTextColor(getFASTPercentilePastelColor(classData.summary.avgFastMath, classData.scoreArrays.fastMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`} />
                <p className={`${classData.summary.avgFastMath ? borderToTextColor(getFASTPercentilePastelColor(classData.summary.avgFastMath, classData.scoreArrays.fastMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)} text-sm font-medium`}>FAST Math Avg</p>
                <p className={`text-2xl font-bold ${classData.summary.avgFastMath ? borderToTextColor(getFASTPercentilePastelColor(classData.summary.avgFastMath, classData.scoreArrays.fastMath).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`}>{classData.summary.avgFastMath || 'N/A'}</p>
              </div>
            </div>

            {/* FAST Reading Tile */}
            <div className={`${classData.summary.avgFastReading ? getFASTPercentilePastelColor(classData.summary.avgFastReading, classData.scoreArrays.fastReading).bgClassName : getNeutralPastelColor().bgClassName} ${classData.summary.avgFastReading ? getFASTPercentilePastelColor(classData.summary.avgFastReading, classData.scoreArrays.fastReading).borderClassName : getNeutralPastelColor().borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <FileText className={`w-10 h-10 mx-auto mb-2 ${classData.summary.avgFastReading ? borderToTextColor(getFASTPercentilePastelColor(classData.summary.avgFastReading, classData.scoreArrays.fastReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`} />
                <p className={`${classData.summary.avgFastReading ? borderToTextColor(getFASTPercentilePastelColor(classData.summary.avgFastReading, classData.scoreArrays.fastReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)} text-sm font-medium`}>FAST Reading Avg</p>
                <p className={`text-2xl font-bold ${classData.summary.avgFastReading ? borderToTextColor(getFASTPercentilePastelColor(classData.summary.avgFastReading, classData.scoreArrays.fastReading).borderClassName) : borderToTextColor(getNeutralPastelColor().borderClassName)}`}>{classData.summary.avgFastReading || 'N/A'}</p>
              </div>
            </div>

            {/* Overall Trend Tile */}
            <div className={`${getOverallTrendPastelColor(
              classData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
              classData.studentMetrics.filter(s => s.overallTrend === 'good').length,
              classData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
              classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
              classData.summary.studentCount
            ).bgClassName} ${getOverallTrendPastelColor(
              classData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
              classData.studentMetrics.filter(s => s.overallTrend === 'good').length,
              classData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
              classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
              classData.summary.studentCount
            ).borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <TrendingUp className={`w-10 h-10 mx-auto mb-2 ${getOverallTrendPastelColor(
                  classData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
                  classData.studentMetrics.filter(s => s.overallTrend === 'good').length,
                  classData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
                  classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
                  classData.summary.studentCount
                ).textClassName}`} />
                <p className={`${getOverallTrendPastelColor(
                  classData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
                  classData.studentMetrics.filter(s => s.overallTrend === 'good').length,
                  classData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
                  classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
                  classData.summary.studentCount
                ).textClassName} text-sm font-medium`}>Overall Trend</p>
                <p className={`text-xl font-bold ${getOverallTrendPastelColor(
                  classData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
                  classData.studentMetrics.filter(s => s.overallTrend === 'good').length,
                  classData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
                  classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
                  classData.summary.studentCount
                ).textClassName}`}>
                  {getOverallTrendDescription(
                    classData.studentMetrics.filter(s => s.overallTrend === 'excellent').length,
                    classData.studentMetrics.filter(s => s.overallTrend === 'good').length,
                    classData.studentMetrics.filter(s => s.overallTrend === 'needs-attention').length,
                    classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length,
                    classData.summary.studentCount
                  )}
                </p>
              </div>
            </div>

            {/* At Risk Count Tile */}
            <div className={`${getAtRiskPastelColor(classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, classData.summary.studentCount).bgClassName} ${getAtRiskPastelColor(classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, classData.summary.studentCount).borderClassName} shadow rounded-lg p-6 border-2`}>
              <div className="text-center">
                <AlertTriangle className={`w-10 h-10 mx-auto mb-2 ${borderToTextColor(getAtRiskPastelColor(classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, classData.summary.studentCount).borderClassName)}`} />
                <p className={`${borderToTextColor(getAtRiskPastelColor(classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, classData.summary.studentCount).borderClassName)} text-sm font-medium`}>At-Risk Students</p>
                <p className={`text-2xl font-bold ${borderToTextColor(getAtRiskPastelColor(classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length, classData.summary.studentCount).borderClassName)}`}>
                  {classData.studentMetrics.filter(s => s.overallTrend === 'at-risk').length}
                </p>
              </div>
            </div>
          </div>

          {/* Student Performance Table */}
          <div className="bg-white dark:bg-gray-800 shadow overflow-hidden rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-gray-100">
                <FileText className="inline w-5 h-5 mr-2" />Individual Student Performance ({classData.summary.studentCount})
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Detailed metrics for each student in {selectedClass}
              </p>
            </div>
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                  <tr>
                    <th 
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                      onClick={() => handleSort('name')}
                    >
                      Student Name
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
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
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Grade {studentData.student.grade}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${getAttendanceColor(studentData.attendanceRate).className}`}>
                          {studentData.attendanceRate.toFixed(1)}%
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${getGPAColor(studentData.currentGPA).className}`}>
                          {studentData.currentGPA.toFixed(2)}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.iReadyMathAvg > 0 ? getIReadyPercentileColor(studentData.iReadyMathAvg, classData.scoreArrays.iReadyMath).className : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {studentData.iReadyMathAvg || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.iReadyReadingAvg > 0 ? getIReadyPercentileColor(studentData.iReadyReadingAvg, classData.scoreArrays.iReadyReading).className : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {studentData.iReadyReadingAvg || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.fastMathAvg > 0 ? getFASTPercentileColor(studentData.fastMathAvg, classData.scoreArrays.fastMath).className : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {studentData.fastMathAvg || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className={`text-sm font-semibold ${
                          studentData.fastReadingAvg > 0 ? getFASTPercentileColor(studentData.fastReadingAvg, classData.scoreArrays.fastReading).className : 'text-gray-500 dark:text-gray-400'
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

      {!selectedClass && (
        <div className="text-center py-12">
          <Users className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-lg font-medium text-gray-900 dark:text-gray-100">Select a Class</h3>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Choose a class from the dropdown above to view detailed analytics.
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading class data...</span>
        </div>
      )}
      </div>
    </PageWrapper>
  );
}