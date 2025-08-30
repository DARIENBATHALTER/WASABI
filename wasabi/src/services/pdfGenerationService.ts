import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { db } from '../lib/db';
import type { StudentSearchResult } from '../hooks/useStudentSearch';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AttendanceDataView from '../features/students/AttendanceDataView';
import GradeDataView from '../features/students/GradeDataView';
import IReadyReadingDataView from '../features/students/IReadyReadingDataView';
import IReadyMathDataView from '../features/students/IReadyMathDataView';
import FastElaDataView from '../features/students/FastElaDataView';
import FastMathDataView from '../features/students/FastMathDataView';

// Create a query client for offscreen rendering
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

export interface DatasetOption {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

export type ReportFormat = 'detailed' | 'parent-friendly';

interface StudentData {
  demographics: any;
  attendance: any[];
  grades: any[];
  discipline: any[];
  ireadyReading: any[];
  ireadyMath: any[];
  fastAssessments: any[];
}

interface AttendanceSummary {
  totalDays: number;
  presentDays: number;
  absentDays: number;
  tardyDays: number;
  attendanceRate: number;
}

interface GradeSummary {
  subjects: Array<{
    course: string;
    grade: string;
    gradePoints: number;
  }>;
  gpa: number;
}

// Color scheme for consistent PDF styling
const COLORS = {
  primary: '#16a34a', // wasabi green
  secondary: '#64748b',
  accent: '#3b82f6',
  text: '#1e293b',
  lightGray: '#f8fafc',
  gray: '#e2e8f0',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444'
};

export class PDFGenerationService {
  private static instance: PDFGenerationService;
  
  public static getInstance(): PDFGenerationService {
    if (!PDFGenerationService.instance) {
      PDFGenerationService.instance = new PDFGenerationService();
    }
    return PDFGenerationService.instance;
  }

  /**
   * Generate PDF reports based on selection criteria
   */
  async generateReports(
    reportType: 'single' | 'homeroom' | 'grade',
    selection: string,
    datasets: DatasetOption[],
    format: ReportFormat
  ): Promise<void> {
    const enabledDatasets = datasets.filter(d => d.enabled);
    
    let students: StudentSearchResult[] = [];
    
    // Get students based on report type
    switch (reportType) {
      case 'single':
        const singleStudent = await db.students.get(selection);
        if (singleStudent) {
          students = [{
            id: singleStudent.id,
            studentNumber: singleStudent.studentNumber,
            firstName: singleStudent.firstName,
            lastName: singleStudent.lastName,
            fullName: `${singleStudent.lastName}, ${singleStudent.firstName}`,
            grade: singleStudent.grade,
            className: singleStudent.className,
            gender: singleStudent.gender
          }];
        }
        break;
        
      case 'homeroom':
        const homeroomStudents = await db.students.where('className').equals(selection).toArray();
        students = homeroomStudents.map(student => ({
          id: student.id,
          studentNumber: student.studentNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: `${student.lastName}, ${student.firstName}`,
          grade: student.grade,
          className: student.className,
          gender: student.gender
        }));
        break;
        
      case 'grade':
        const gradeStudents = await db.students.where('grade').equals(selection).toArray();
        students = gradeStudents.map(student => ({
          id: student.id,
          studentNumber: student.studentNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: `${student.lastName}, ${student.firstName}`,
          grade: student.grade,
          className: student.className,
          gender: student.gender
        }));
        break;
    }

    // Generate individual reports for each student
    for (const student of students) {
      await this.generateStudentReport(student, enabledDatasets, format);
      // Small delay to prevent browser overload
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Generate a single student report
   */
  private async generateStudentReport(
    student: StudentSearchResult,
    datasets: DatasetOption[],
    format: ReportFormat
  ): Promise<void> {
    // Collect all student data
    const studentData = await this.collectStudentData(student.id, datasets);
    
    // Create PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    let currentY = margin;

    // Add header
    currentY = this.addHeader(pdf, student, currentY, pageWidth, margin, format);
    
    // Add each enabled dataset section
    for (const dataset of datasets) {
      // Check if we need a new page
      if (currentY > pageHeight - 40) {
        pdf.addPage();
        currentY = margin;
      }
      
      currentY = await this.addDatasetSection(
        pdf, 
        dataset, 
        studentData, 
        student.id, 
        currentY, 
        pageWidth, 
        margin, 
        format
      );
    }

    // Add footer
    this.addFooter(pdf, student, format);
    
    // Download the PDF
    const fileName = `${student.lastName}_${student.firstName}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    pdf.save(fileName);
  }

  /**
   * Collect all student data from database
   */
  private async collectStudentData(studentId: string, datasets: DatasetOption[]): Promise<StudentData> {
    const data: StudentData = {
      demographics: null,
      attendance: [],
      grades: [],
      discipline: [],
      ireadyReading: [],
      ireadyMath: [],
      fastAssessments: []
    };

    // Get student demographics
    data.demographics = await db.students.get(studentId);

    // Collect data for each enabled dataset
    for (const dataset of datasets) {
      switch (dataset.id) {
        case 'attendance':
          data.attendance = await db.attendance.where('studentId').equals(studentId).toArray();
          break;
        case 'grades':
          data.grades = await db.grades.where('studentId').equals(studentId).toArray();
          break;
        case 'discipline':
          data.discipline = await db.discipline.where('studentId').equals(studentId).toArray();
          break;
        case 'iready-reading':
          data.ireadyReading = await db.assessments
            .where('studentId').equals(studentId)
            .filter(a => a.source === 'iReady' && (a.subject === 'Reading' || a.subject === 'ELA'))
            .toArray();
          break;
        case 'iready-math':
          data.ireadyMath = await db.assessments
            .where('studentId').equals(studentId)
            .filter(a => a.source === 'iReady' && a.subject === 'Math')
            .toArray();
          break;
        case 'fast-assessments':
          data.fastAssessments = await db.assessments
            .where('studentId').equals(studentId)
            .filter(a => a.source === 'FAST')
            .toArray();
          break;
      }
    }

    return data;
  }

  /**
   * Add header to PDF
   */
  private addHeader(
    pdf: jsPDF, 
    student: StudentSearchResult, 
    y: number, 
    pageWidth: number, 
    margin: number, 
    format: ReportFormat
  ): number {
    // School header
    pdf.setFontSize(20);
    pdf.setTextColor(COLORS.primary);
    pdf.text('Wayman Academy of the Arts', pageWidth / 2, y, { align: 'center' });
    y += 10;
    
    pdf.setFontSize(16);
    pdf.setTextColor(COLORS.text);
    const reportTitle = format === 'parent-friendly' 
      ? 'Student Progress Report' 
      : 'Comprehensive Student Data Report';
    pdf.text(reportTitle, pageWidth / 2, y, { align: 'center' });
    y += 15;

    // Student info box
    pdf.setDrawColor(COLORS.gray);
    pdf.setFillColor(COLORS.lightGray);
    pdf.roundedRect(margin, y, pageWidth - 2 * margin, 25, 2, 2, 'FD');
    
    y += 8;
    pdf.setFontSize(14);
    pdf.setTextColor(COLORS.text);
    pdf.text(`Student: ${student.fullName}`, margin + 5, y);
    pdf.text(`Grade: ${student.grade === 'K' ? 'Kindergarten' : `Grade ${student.grade}`}`, pageWidth - margin - 5, y, { align: 'right' });
    
    y += 6;
    pdf.setFontSize(10);
    pdf.setTextColor(COLORS.secondary);
    pdf.text(`Student ID: ${student.studentNumber}`, margin + 5, y);
    pdf.text(`Homeroom: ${student.className || 'Not assigned'}`, pageWidth - margin - 5, y, { align: 'right' });
    
    y += 6;
    pdf.text(`Report Generated: ${new Date().toLocaleDateString()}`, margin + 5, y);
    
    return y + 15;
  }

  /**
   * Add dataset section to PDF
   */
  private async addDatasetSection(
    pdf: jsPDF,
    dataset: DatasetOption,
    studentData: StudentData,
    studentId: string,
    y: number,
    pageWidth: number,
    margin: number,
    format: ReportFormat
  ): Promise<number> {
    // Section header
    pdf.setFontSize(14);
    pdf.setTextColor(COLORS.primary);
    pdf.text(dataset.name, margin, y);
    y += 8;
    
    // Add section content based on dataset type
    switch (dataset.id) {
      case 'attendance':
        y = await this.addAttendanceSection(pdf, studentData.attendance, studentId, y, pageWidth, margin, format);
        break;
      case 'grades':
        y = await this.addGradesSection(pdf, studentData.grades, studentId, y, pageWidth, margin, format);
        break;
      case 'discipline':
        y = await this.addDisciplineSection(pdf, studentData.discipline, y, pageWidth, margin, format);
        break;
      case 'iready-reading':
        y = await this.addIReadySection(pdf, studentData.ireadyReading, studentId, 'Reading', y, pageWidth, margin, format);
        break;
      case 'iready-math':
        y = await this.addIReadySection(pdf, studentData.ireadyMath, studentId, 'Math', y, pageWidth, margin, format);
        break;
      case 'fast-assessments':
        y = await this.addFastSection(pdf, studentData.fastAssessments, studentId, y, pageWidth, margin, format);
        break;
    }
    
    return y + 10;
  }

  /**
   * Add attendance section with chart
   */
  private async addAttendanceSection(
    pdf: jsPDF,
    attendanceData: any[],
    studentId: string,
    y: number,
    pageWidth: number,
    margin: number,
    format: ReportFormat
  ): Promise<number> {
    if (attendanceData.length === 0) {
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.secondary);
      pdf.text('No attendance data available', margin, y);
      return y + 8;
    }

    const summary = this.calculateAttendanceSummary(attendanceData);
    
    if (format === 'parent-friendly') {
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.text);
      pdf.text('Your child\'s attendance this school year:', margin, y);
      y += 6;
      
      pdf.text(`• Total School Days: ${summary.totalDays}`, margin + 5, y);
      y += 5;
      pdf.text(`• Days Present: ${summary.presentDays}`, margin + 5, y);
      y += 5;
      pdf.text(`• Days Absent: ${summary.absentDays}`, margin + 5, y);
      y += 5;
      pdf.text(`• Attendance Rate: ${summary.attendanceRate.toFixed(1)}%`, margin + 5, y);
      y += 8;
      
      // Add interpretation
      if (summary.attendanceRate >= 95) {
        pdf.setTextColor(COLORS.success);
        pdf.text('Excellent attendance! This supports strong academic progress.', margin, y);
      } else if (summary.attendanceRate >= 90) {
        pdf.setTextColor(COLORS.warning);
        pdf.text('Good attendance. Try to maintain consistent daily attendance.', margin, y);
      } else {
        pdf.setTextColor(COLORS.danger);
        pdf.text('Attendance needs improvement. Regular attendance is crucial for academic success.', margin, y);
      }
    } else {
      // Detailed format
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.text);
      pdf.text(`Total Days: ${summary.totalDays} | Present: ${summary.presentDays} | Absent: ${summary.absentDays} | Rate: ${summary.attendanceRate.toFixed(1)}%`, margin, y);
    }
    
    y += 15;

    // Add attendance chart using offscreen rendering
    try {
      const chartImage = await this.captureChartFromProfileCard(
        studentId, 
        'attendance', 
        format
      );
      if (chartImage) {
        const chartWidth = (pageWidth - 2 * margin) * 0.8;
        const chartHeight = chartWidth * 0.6;
        
        // Check if chart fits on current page
        if (y + chartHeight > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          y = margin;
        }
        
        pdf.addImage(chartImage, 'PNG', margin, y, chartWidth, chartHeight);
        y += chartHeight + 10;
      }
    } catch (error) {
      console.error('Failed to generate attendance chart:', error);
    }
    
    return y;
  }

  /**
   * Add grades section with chart
   */
  private async addGradesSection(
    pdf: jsPDF,
    gradesData: any[],
    studentId: string,
    y: number,
    pageWidth: number,
    margin: number,
    format: ReportFormat
  ): Promise<number> {
    if (gradesData.length === 0) {
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.secondary);
      pdf.text('No grade data available', margin, y);
      return y + 8;
    }

    if (format === 'parent-friendly') {
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.text);
      pdf.text('Your child\'s current grades:', margin, y);
      y += 8;
      
      // Group by subject and show most recent grades
      const latestGrades = this.getLatestGradesBySubject(gradesData);
      
      for (const [subject, grade] of Object.entries(latestGrades)) {
        pdf.text(`• ${subject}: ${grade}`, margin + 5, y);
        y += 5;
      }
    } else {
      // Detailed format - show more comprehensive grade data
      const summary = this.calculateGradeSummary(gradesData);
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.text);
      pdf.text(`GPA: ${summary.gpa.toFixed(2)}`, margin, y);
      y += 6;
      
      summary.subjects.forEach(subject => {
        pdf.text(`${subject.course}: ${subject.grade}`, margin, y);
        y += 4;
      });
    }
    
    y += 15;

    // Add grades chart
    try {
      const chartImage = await this.captureChartFromProfileCard(
        studentId, 
        'grades', 
        format
      );
      if (chartImage) {
        const chartWidth = (pageWidth - 2 * margin) * 0.8;
        const chartHeight = chartWidth * 0.6;
        
        // Check if chart fits on current page
        if (y + chartHeight > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          y = margin;
        }
        
        pdf.addImage(chartImage, 'PNG', margin, y, chartWidth, chartHeight);
        y += chartHeight + 10;
      }
    } catch (error) {
      console.error('Failed to generate grades chart:', error);
    }
    
    return y;
  }

  /**
   * Add discipline section
   */
  private async addDisciplineSection(
    pdf: jsPDF,
    disciplineData: any[],
    y: number,
    pageWidth: number,
    margin: number,
    format: ReportFormat
  ): Promise<number> {
    if (disciplineData.length === 0) {
      if (format === 'parent-friendly') {
        pdf.setFontSize(10);
        pdf.setTextColor(COLORS.success);
        pdf.text('Great news! No discipline incidents recorded this year.', margin, y);
      } else {
        pdf.setFontSize(10);
        pdf.setTextColor(COLORS.secondary);
        pdf.text('No discipline records', margin, y);
      }
      return y + 8;
    }

    if (format === 'parent-friendly') {
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.text);
      pdf.text(`Total incidents this year: ${disciplineData.length}`, margin, y);
      y += 6;
      
      pdf.text('We are working together to support positive behavior choices.', margin, y);
    } else {
      // Detailed format
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.text);
      pdf.text(`Discipline Records: ${disciplineData.length} incidents`, margin, y);
      y += 6;
      
      // List recent incidents
      const recentIncidents = disciplineData.slice(0, 3);
      recentIncidents.forEach(incident => {
        const date = new Date(incident.incidentDate).toLocaleDateString();
        pdf.setFontSize(9);
        pdf.text(`${date}: ${incident.infraction || 'Behavioral concern'}`, margin + 5, y);
        y += 4;
      });
    }
    
    return y + 10;
  }

  /**
   * Add iReady section with charts
   */
  private async addIReadySection(
    pdf: jsPDF,
    ireadyData: any[],
    studentId: string,
    subject: string,
    y: number,
    pageWidth: number,
    margin: number,
    format: ReportFormat
  ): Promise<number> {
    if (ireadyData.length === 0) {
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.secondary);
      pdf.text(`No iReady ${subject} data available`, margin, y);
      return y + 8;
    }

    // Get most recent assessment
    const latest = ireadyData.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0];
    
    if (format === 'parent-friendly') {
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.text);
      pdf.text(`Latest iReady ${subject} Assessment (${new Date(latest.testDate).toLocaleDateString()}):`, margin, y);
      y += 6;
      
      pdf.text(`• Overall Level: ${latest.overallPlacement || 'Not available'}`, margin + 5, y);
      y += 5;
      
      if (latest.lexileMeasure && subject === 'Reading') {
        pdf.text(`• Reading Level: ${latest.lexileMeasure}`, margin + 5, y);
        y += 5;
      }
      
      // Add parent-friendly interpretation
      if (latest.overallPlacement?.includes('On Grade') || latest.overallPlacement?.includes('Above')) {
        pdf.setTextColor(COLORS.success);
        pdf.text('Your child is performing well in this subject!', margin, y);
      } else {
        pdf.setTextColor(COLORS.warning);
        pdf.text('We are working to support growth in this subject.', margin, y);
      }
    } else {
      // Detailed format
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.text);
      pdf.text(`Latest Assessment: ${new Date(latest.testDate).toLocaleDateString()}`, margin, y);
      y += 5;
      pdf.text(`Overall Score: ${latest.overallScore || 'N/A'} | Placement: ${latest.overallPlacement || 'N/A'}`, margin, y);
      y += 5;
      if (latest.percentile) {
        pdf.text(`Percentile: ${latest.percentile}`, margin, y);
        y += 5;
      }
    }
    
    y += 15;

    // Add iReady chart
    try {
      const componentType = subject === 'Reading' ? 'iready-reading' : 'iready-math';
      const chartImage = await this.captureChartFromProfileCard(
        studentId, 
        componentType, 
        format
      );
      if (chartImage) {
        const chartWidth = (pageWidth - 2 * margin) * 0.8;
        const chartHeight = chartWidth * 0.6;
        
        // Check if chart fits on current page
        if (y + chartHeight > pdf.internal.pageSize.getHeight() - margin) {
          pdf.addPage();
          y = margin;
        }
        
        pdf.addImage(chartImage, 'PNG', margin, y, chartWidth, chartHeight);
        y += chartHeight + 10;
      }
    } catch (error) {
      console.error('Failed to generate iReady chart:', error);
    }
    
    return y;
  }

  /**
   * Add FAST section with chart
   */
  private async addFastSection(
    pdf: jsPDF,
    fastData: any[],
    studentId: string,
    y: number,
    pageWidth: number,
    margin: number,
    format: ReportFormat
  ): Promise<number> {
    if (fastData.length === 0) {
      pdf.setFontSize(10);
      pdf.setTextColor(COLORS.secondary);
      pdf.text('No FAST assessment data available', margin, y);
      return y + 8;
    }

    // Group by subject
    const bySubject = fastData.reduce((acc, assessment) => {
      const subject = assessment.subject || 'Unknown';
      if (!acc[subject]) acc[subject] = [];
      acc[subject].push(assessment);
      return acc;
    }, {} as Record<string, any[]>);

    for (const [subject, assessments] of Object.entries(bySubject)) {
      const latest = assessments.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0];
      
      if (format === 'parent-friendly') {
        pdf.setFontSize(10);
        pdf.setTextColor(COLORS.text);
        pdf.text(`FAST ${subject} Assessment:`, margin, y);
        y += 6;
        
        if (latest.achievementLevel) {
          pdf.text(`• Achievement Level: ${latest.achievementLevel}`, margin + 5, y);
          y += 5;
        }
        
        if (latest.scaleScore) {
          pdf.text(`• Scale Score: ${latest.scaleScore}`, margin + 5, y);
          y += 5;
        }
      } else {
        // Detailed format
        pdf.setFontSize(10);
        pdf.setTextColor(COLORS.text);
        pdf.text(`FAST ${subject}: Level ${latest.achievementLevel || 'N/A'} | Score: ${latest.scaleScore || 'N/A'}`, margin, y);
        y += 5;
      }
    }
    
    y += 15;

    // Add FAST charts for each subject
    try {
      // Get unique subjects from the data
      const subjects = [...new Set(fastData.map(d => d.subject))];
      
      for (const subject of subjects) {
        let componentType: 'fast-ela' | 'fast-math' | null = null;
        
        if (subject === 'ELA' || subject === 'Reading') {
          componentType = 'fast-ela';
        } else if (subject === 'Math' || subject === 'Mathematics') {
          componentType = 'fast-math';
        }
        
        if (componentType) {
          const chartImage = await this.captureChartFromProfileCard(
            studentId, 
            componentType, 
            format
          );
          
          if (chartImage) {
            const chartWidth = (pageWidth - 2 * margin) * 0.8;
            const chartHeight = chartWidth * 0.6;
            
            // Check if chart fits on current page
            if (y + chartHeight > pdf.internal.pageSize.getHeight() - margin) {
              pdf.addPage();
              y = margin;
            }
            
            pdf.addImage(chartImage, 'PNG', margin, y, chartWidth, chartHeight);
            y += chartHeight + 10;
          }
        }
      }
    } catch (error) {
      console.error('Failed to generate FAST chart:', error);
    }
    
    return y;
  }

  /**
   * Add footer to PDF
   */
  private addFooter(pdf: jsPDF, student: StudentSearchResult, format: ReportFormat): void {
    const pageHeight = pdf.internal.pageSize.getHeight();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 20;
    
    pdf.setFontSize(8);
    pdf.setTextColor(COLORS.secondary);
    
    if (format === 'parent-friendly') {
      pdf.text('Questions about this report? Please contact your child\'s teacher or the school office.', margin, pageHeight - 15);
    }
    
    pdf.text(`Generated on ${new Date().toLocaleString()}`, margin, pageHeight - 8);
    pdf.text('Wayman Academy of the Arts', pageWidth - margin, pageHeight - 8, { align: 'right' });
  }

  /**
   * Helper methods for data calculations
   */
  private calculateAttendanceSummary(attendanceData: any[]): AttendanceSummary {
    const totalDays = attendanceData.length;
    const presentDays = attendanceData.filter(day => day.status === 'P' || day.status === 'Present').length;
    const absentDays = attendanceData.filter(day => day.status === 'U' || day.status === 'Absent').length;
    const tardyDays = attendanceData.filter(day => day.status === 'T' || day.status === 'Tardy').length;
    const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;

    return {
      totalDays,
      presentDays,
      absentDays,
      tardyDays,
      attendanceRate
    };
  }

  private calculateGradeSummary(gradesData: any[]): GradeSummary {
    const subjects = gradesData.map(grade => ({
      course: grade.course || grade.subject || 'Unknown',
      grade: grade.grade || grade.finalGrade || 'N/A',
      gradePoints: this.gradeToPoints(grade.grade || grade.finalGrade)
    }));

    const validGrades = subjects.filter(s => s.gradePoints > 0);
    const gpa = validGrades.length > 0 
      ? validGrades.reduce((sum, s) => sum + s.gradePoints, 0) / validGrades.length 
      : 0;

    return { subjects, gpa };
  }

  private gradeToPoints(grade: string): number {
    if (!grade) return 0;
    const gradeStr = grade.toString().toUpperCase().trim();
    
    const gradeMap: Record<string, number> = {
      'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7,
      'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'F': 0.0
    };
    
    return gradeMap[gradeStr] || 0;
  }

  private getLatestGradesBySubject(gradesData: any[]): Record<string, string> {
    const bySubject: Record<string, any[]> = {};
    
    gradesData.forEach(grade => {
      const subject = grade.course || grade.subject || 'Unknown';
      if (!bySubject[subject]) bySubject[subject] = [];
      bySubject[subject].push(grade);
    });

    const latest: Record<string, string> = {};
    for (const [subject, grades] of Object.entries(bySubject)) {
      const mostRecent = grades.sort((a, b) => new Date(b.date || b.gradeDate || 0).getTime() - new Date(a.date || a.gradeDate || 0).getTime())[0];
      latest[subject] = mostRecent.grade || mostRecent.finalGrade || 'N/A';
    }

    return latest;
  }

  /**
   * Chart generation methods using offscreen profile card rendering
   */

  /**
   * Generate attendance chart by rendering AttendanceDataView offscreen
   */
  private async generateAttendanceChart(studentId: string, format: ReportFormat): Promise<string | null> {
    return this.renderComponentOffscreen(
      React.createElement(AttendanceDataView, { studentId }),
      'attendance-chart'
    );
  }

  /**
   * Generate iReady chart by rendering the appropriate iReady component offscreen
   */
  private async generateIReadyChart(studentId: string, subject: string, format: ReportFormat): Promise<string | null> {
    const Component = subject === 'Reading' ? IReadyReadingDataView : IReadyMathDataView;
    return this.renderComponentOffscreen(
      React.createElement(Component, { studentId }),
      `iready-${subject.toLowerCase()}-chart`
    );
  }

  /**
   * Generate FAST chart by rendering FAST components offscreen
   */
  private async generateFastChart(studentId: string, subject: string, format: ReportFormat): Promise<string | null> {
    let Component;
    switch (subject.toLowerCase()) {
      case 'ela':
      case 'reading':
        Component = FastElaDataView;
        break;
      case 'math':
      case 'mathematics':
        Component = FastMathDataView;
        break;
      default:
        return null;
    }

    return this.renderComponentOffscreen(
      React.createElement(Component, { studentId }),
      `fast-${subject.toLowerCase()}-chart`
    );
  }

  /**
   * Generate grades chart by rendering GradeDataView offscreen
   */
  private async generateGradesChart(studentId: string, format: ReportFormat): Promise<string | null> {
    return this.renderComponentOffscreen(
      React.createElement(GradeDataView, { studentId }),
      'grades-chart'
    );
  }

  /**
   * Core method to render a React component offscreen and capture with html2canvas
   */
  private async renderComponentOffscreen(component: React.ReactElement, containerId: string): Promise<string | null> {
    // Create offscreen container
    const container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'absolute';
    container.style.top = '-10000px';
    container.style.left = '-10000px';
    container.style.width = '800px';
    container.style.minHeight = '400px';
    container.style.backgroundColor = 'white';
    container.style.padding = '20px';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
    
    document.body.appendChild(container);

    try {
      // Create React root and render component
      const root = createRoot(container);
      
      const WrappedComponent = React.createElement(
        QueryClientProvider,
        { client: queryClient },
        component
      );

      root.render(WrappedComponent);

      // Wait for component to render and any async data to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Look for the main content area (skip headers/titles)
      const contentElement = container.querySelector('[class*="overflow-x-auto"], canvas, svg, .chart-container') || 
                            container.querySelector('.bg-white, .dark\\:bg-gray-800') || 
                            container;

      if (!contentElement) {
        console.warn(`No suitable content found in ${containerId}`);
        return null;
      }

      // Capture with html2canvas
      const canvas = await html2canvas(contentElement as HTMLElement, {
        backgroundColor: 'white',
        scale: 2, // Higher quality
        logging: false,
        useCORS: true,
        allowTaint: true,
        width: 800,
        height: 400,
        windowWidth: 800,
        windowHeight: 400
      });

      const imageData = canvas.toDataURL('image/png', 0.95);

      // Cleanup
      root.unmount();
      return imageData;

    } catch (error) {
      console.error(`Error rendering ${containerId}:`, error);
      return null;
    } finally {
      // Always cleanup the container
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    }
  }

  /**
   * Enhanced method to capture specific chart elements from profile cards
   */
  private async captureChartFromProfileCard(
    studentId: string, 
    componentType: 'attendance' | 'grades' | 'iready-reading' | 'iready-math' | 'fast-ela' | 'fast-math',
    format: ReportFormat
  ): Promise<string | null> {
    const containerId = `pdf-capture-${componentType}-${Date.now()}`;
    
    // Create a more targeted container
    const container = document.createElement('div');
    container.id = containerId;
    container.style.position = 'absolute';
    container.style.top = '-10000px';
    container.style.left = '-10000px';
    container.style.width = '900px';
    container.style.minHeight = '500px';
    container.style.backgroundColor = 'white';
    container.style.padding = '20px';
    container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    container.style.fontSize = '14px';
    container.style.color = '#1e293b';

    // Add some basic styles to match the profile card appearance
    const styleSheet = document.createElement('style');
    styleSheet.textContent = `
      #${containerId} * {
        box-sizing: border-box;
      }
      #${containerId} table {
        width: 100%;
        border-collapse: collapse;
        margin: 10px 0;
      }
      #${containerId} th, #${containerId} td {
        padding: 8px 12px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
      }
      #${containerId} th {
        background-color: #f8fafc;
        font-weight: 600;
      }
      #${containerId} canvas {
        max-width: 100%;
        height: auto;
      }
    `;
    document.head.appendChild(styleSheet);
    
    document.body.appendChild(container);

    try {
      let Component;
      switch (componentType) {
        case 'attendance':
          Component = AttendanceDataView;
          break;
        case 'grades':
          Component = GradeDataView;
          break;
        case 'iready-reading':
          Component = IReadyReadingDataView;
          break;
        case 'iready-math':
          Component = IReadyMathDataView;
          break;
        case 'fast-ela':
          Component = FastElaDataView;
          break;
        case 'fast-math':
          Component = FastMathDataView;
          break;
        default:
          return null;
      }

      const root = createRoot(container);
      
      const WrappedComponent = React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(Component, { studentId })
      );

      root.render(WrappedComponent);

      // Wait longer for data to load and charts to render
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Try to find canvas elements first (for charts), then tables
      let targetElement = container.querySelector('canvas') || 
                         container.querySelector('table') ||
                         container.querySelector('[class*="chart"]') ||
                         container.querySelector('.overflow-x-auto') ||
                         container;

      const canvas = await html2canvas(targetElement as HTMLElement, {
        backgroundColor: 'white',
        scale: 1.5,
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (clonedDoc) => {
          // Ensure any dynamic content is visible in the clone
          const clonedElement = clonedDoc.getElementById(containerId);
          if (clonedElement) {
            clonedElement.style.position = 'static';
            clonedElement.style.top = 'auto';
            clonedElement.style.left = 'auto';
          }
        }
      });

      const imageData = canvas.toDataURL('image/png', 0.9);

      root.unmount();
      document.head.removeChild(styleSheet);
      
      return imageData;

    } catch (error) {
      console.error(`Error capturing ${componentType} for student ${studentId}:`, error);
      return null;
    } finally {
      if (container.parentNode) {
        document.body.removeChild(container);
      }
    }
  }
}

export const pdfService = PDFGenerationService.getInstance();