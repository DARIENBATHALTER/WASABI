import React, { useState } from 'react';
import { ArrowLeft, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import StudentAvatar from '../../shared/components/StudentAvatar';
import InstructorName from '../../shared/components/InstructorName';
import type { StudentSearchResult } from '../../hooks/useStudentSearch';
import { useStore } from '../../store';
import { db } from '../../lib/db';

// Data view components
import AttendanceDataView from './AttendanceDataView';
import GradeDataView from './GradeDataView';
import DisciplineDataView from './DisciplineDataView';
import AssessmentDataView from './AssessmentDataView';
import IReadyMathDataView from './IReadyMathDataView';
import IReadyReadingDataView from './IReadyReadingDataView';
import FastMathDataView from './FastMathDataView';
import FastElaDataView from './FastElaDataView';
import FastScienceDataView from './FastScienceDataView';
import FastWritingDataView from './FastWritingDataView';
import SOBADataView from './SOBADataView';

// Helper function to properly capitalize names
const formatName = (name: string): string => {
  if (!name) return '';
  
  // Split by common name separators and capitalize each part
  return name
    .toLowerCase()
    .split(/(\s|'|-)/) // Split on space, apostrophe, or hyphen but keep separators
    .map((part, index, array) => {
      // If it's a separator, return as-is
      if (part.match(/(\s|'|-)/)) return part;
      
      // If it follows an apostrophe and is a common suffix, keep lowercase
      if (index > 0 && array[index - 1] === "'" && ['s', 't', 'd', 're', 'll', 've'].includes(part)) {
        return part;
      }
      
      // Otherwise capitalize first letter
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('');
};

interface StudentProfileCardsProps {
  students: StudentSearchResult[];
  onBack: () => void;
}

interface CollapsibleSectionProps {
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  hasFlag?: boolean;
  flagMessage?: string;
  flagColors?: string[];
  children: React.ReactNode;
}

function CollapsibleSection({ title, isOpen, onToggle, hasFlag, flagMessage, flagColors = [], children }: CollapsibleSectionProps) {
  // Helper function to get color styles
  const getColorStyles = (color: string) => {
    const colorMap = {
      red: { bg: 'bg-red-500', border: 'border-red-500' },
      orange: { bg: 'bg-orange-500', border: 'border-orange-500' },
      yellow: { bg: 'bg-yellow-500', border: 'border-yellow-500' },
      green: { bg: 'bg-green-500', border: 'border-green-500' },
      blue: { bg: 'bg-blue-500', border: 'border-blue-500' }
    };
    return colorMap[color as keyof typeof colorMap] || colorMap.red;
  };
  
  // Determine primary color (first flag color or green if no flags)
  const primaryColor = hasFlag && flagColors.length > 0 ? flagColors[0] : 'green';
  const primaryStyles = getColorStyles(primaryColor);
  
  return (
    <details open={isOpen} className="w-full mb-3">
      <summary 
        onClick={(e) => {
          e.preventDefault();
          onToggle();
        }}
        className={`flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer 
                   user-select-none transition-colors hover:bg-gray-100 dark:hover:bg-gray-600
                   border-l-4 ${primaryStyles.border}`}
      >
        {/* Flag indicator circle */}
        <div className="flex items-center mr-3" style={{ width: '16px' }}>
          <div 
            className={`w-4 h-4 rounded-full transition-colors ${primaryStyles.bg}`}
            title={hasFlag ? flagMessage : 'No flags'}
          />
        </div>
        
        <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">
          {title}
        </span>
        
        {/* Expand/collapse icon */}
        {isOpen ? (
          <ChevronDown size={20} className="text-gray-500 dark:text-gray-400" />
        ) : (
          <ChevronRight size={20} className="text-gray-500 dark:text-gray-400" />
        )}
      </summary>
      
      {isOpen && (
        <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600
                       animate-in fade-in-0 slide-in-from-top-2">
          {children}
        </div>
      )}
    </details>
  );
}

export default function StudentProfileCards({ students, onBack }: StudentProfileCardsProps) {
  const { setSelectedStudents } = useStore();
  const [openSections, setOpenSections] = useState<Record<string, Record<string, boolean>>>({});
  
  const removeStudent = (studentId: string) => {
    const updatedStudents = students.filter(s => s.id !== studentId);
    setSelectedStudents(updatedStudents);
  };
  
  const toggleSection = (studentId: string, sectionId: string) => {
    setOpenSections(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [sectionId]: !prev[studentId]?.[sectionId]
      }
    }));
  };
  
  const isSectionOpen = (studentId: string, sectionId: string) => {
    return openSections[studentId]?.[sectionId] ?? false;
  };

  // Hook to get flagged students
  const { data: flaggedStudentsMap = {} } = useQuery({
    queryKey: ['flagged-students-map', students.map(s => s.id)],
    queryFn: async (): Promise<Record<string, Array<{ category: string; flagName: string; message: string; color: string }>>> => {
      // Get flag rules from localStorage (same as flagging system)
      const stored = localStorage.getItem('wasabi-flag-rules');
      const flagRules = stored ? JSON.parse(stored) : [];
      
      if (flagRules.length === 0) return {};
      
      const flaggedMap: Record<string, Array<{ category: string; flagName: string; message: string; color: string }>> = {};
      
      // Check each student against flag rules
      for (const student of students) {
        const studentFlags: Array<{ category: string; flagName: string; message: string; color: string }> = [];
        
        // Find the correct student ID format (numeric or compound)
        let actualStudentId = student.id;
        
        // Try to find the compound ID if it exists by checking attendance data
        const testAttendance = await db.attendance.filter(record => 
          typeof record.studentId === 'string' && record.studentId.includes(`_${student.id}_`)
        ).limit(1).toArray();
        
        if (testAttendance.length > 0) {
          actualStudentId = testAttendance[0].studentId;
          console.log(`🔍 [ProfileCard] Using compound ID for ${student.firstName} ${student.lastName}: ${actualStudentId}`);
        } else {
          console.log(`🔍 [ProfileCard] Using numeric ID for ${student.firstName} ${student.lastName}: ${actualStudentId}`);
        }
        
        for (const rule of flagRules.filter((r: any) => r.isActive)) {
          // Check if student matches grade/class filters
          if (rule.filters) {
            if (rule.filters.grades && rule.filters.grades.length > 0) {
              if (!rule.filters.grades.includes(String(student.grade))) {
                continue; // Skip this rule for this student
              }
            }
            if (rule.filters.classes && rule.filters.classes.length > 0) {
              if (!rule.filters.classes.includes(student.className || '')) {
                continue; // Skip this rule for this student
              }
            }
          }
          
          let isFlagged = false;
          let message = '';
          
          try {
            switch (rule.category) {
              case 'attendance': {
                const attendanceRecords = await db.attendance.where('studentId').equals(actualStudentId).toArray();
                if (attendanceRecords.length > 0) {
                  const presentDays = attendanceRecords.filter(r => r.status === 'present').length;
                  const attendanceRate = (presentDays / attendanceRecords.length) * 100;
                  const threshold = Number(rule.criteria.threshold);
                  isFlagged = rule.criteria.condition === 'below' ? 
                    attendanceRate < threshold : 
                    rule.criteria.condition === 'above' ? attendanceRate > threshold : attendanceRate === threshold;
                  message = `Attendance rate: ${attendanceRate.toFixed(1)}% (${rule.criteria.condition} ${threshold}%)`;
                }
                break;
              }
              case 'discipline': {
                const disciplineRecords = await db.discipline.where('studentId').equals(actualStudentId).toArray();
                const count = disciplineRecords.length;
                const threshold = Number(rule.criteria.threshold);
                isFlagged = rule.criteria.condition === 'above' ? 
                  count > threshold : 
                  rule.criteria.condition === 'below' ? count < threshold : count === threshold;
                message = `${count} discipline record${count !== 1 ? 's' : ''} (${rule.criteria.condition} ${threshold})`;
                break;
              }
              case 'grades': {
                const gradeRecords = await db.grades.where('studentId').equals(actualStudentId).toArray();
                if (gradeRecords.length > 0) {
                  const averageGrade = gradeRecords.reduce((sum, g) => sum + (g.grade || 0), 0) / gradeRecords.length;
                  const threshold = Number(rule.criteria.threshold);
                  isFlagged = rule.criteria.condition === 'below' ? 
                    averageGrade < threshold : 
                    rule.criteria.condition === 'above' ? averageGrade > threshold : averageGrade === threshold;
                  message = `Average GPA: ${averageGrade.toFixed(2)} (${rule.criteria.condition} ${threshold})`;
                }
                break;
              }
              case 'iready-reading': {
                const assessments = await db.assessments
                  .where('studentId').equals(actualStudentId)
                  .filter(a => a.source === 'iReady Reading')
                  .toArray();
                if (assessments.length > 0) {
                  const latestScore = assessments
                    .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0].score || 0;
                  const threshold = Number(rule.criteria.threshold);
                  isFlagged = rule.criteria.condition === 'below' ? 
                    latestScore < threshold : 
                    rule.criteria.condition === 'above' ? latestScore > threshold : latestScore === threshold;
                  message = `iReady Reading: ${latestScore} (${rule.criteria.condition} ${threshold})`;
                }
                break;
              }
              case 'iready-math': {
                const assessments = await db.assessments
                  .where('studentId').equals(actualStudentId)
                  .filter(a => a.source === 'iReady Math')
                  .toArray();
                if (assessments.length > 0) {
                  const latestScore = assessments
                    .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0].score || 0;
                  const threshold = Number(rule.criteria.threshold);
                  isFlagged = rule.criteria.condition === 'below' ? 
                    latestScore < threshold : 
                    rule.criteria.condition === 'above' ? latestScore > threshold : latestScore === threshold;
                  message = `iReady Math: ${latestScore} (${rule.criteria.condition} ${threshold})`;
                }
                break;
              }
              case 'fast-math': {
                const assessments = await db.assessments
                  .where('studentId').equals(actualStudentId)
                  .filter(a => a.source === 'FAST Math')
                  .toArray();
                if (assessments.length > 0) {
                  const latestScore = assessments
                    .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0].score || 0;
                  const threshold = Number(rule.criteria.threshold);
                  isFlagged = rule.criteria.condition === 'below' ? 
                    latestScore < threshold : 
                    rule.criteria.condition === 'above' ? latestScore > threshold : latestScore === threshold;
                  message = `FAST Math: ${latestScore} (${rule.criteria.condition} ${threshold})`;
                }
                break;
              }
              case 'fast-ela': {
                const assessments = await db.assessments
                  .where('studentId').equals(actualStudentId)
                  .filter(a => a.source === 'FAST ELA')
                  .toArray();
                if (assessments.length > 0) {
                  const latestScore = assessments
                    .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0].score || 0;
                  const threshold = Number(rule.criteria.threshold);
                  isFlagged = rule.criteria.condition === 'below' ? 
                    latestScore < threshold : 
                    rule.criteria.condition === 'above' ? latestScore > threshold : latestScore === threshold;
                  message = `FAST ELA: ${latestScore} (${rule.criteria.condition} ${threshold})`;
                }
                break;
              }
              case 'fast-science': {
                const assessments = await db.assessments
                  .where('studentId').equals(actualStudentId)
                  .filter(a => a.source === 'FAST Science')
                  .toArray();
                if (assessments.length > 0) {
                  const latestScore = assessments
                    .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0].score || 0;
                  const threshold = Number(rule.criteria.threshold);
                  isFlagged = rule.criteria.condition === 'below' ? 
                    latestScore < threshold : 
                    rule.criteria.condition === 'above' ? latestScore > threshold : latestScore === threshold;
                  message = `FAST Science: ${latestScore} (${rule.criteria.condition} ${threshold})`;
                }
                break;
              }
              case 'fast-writing': {
                const assessments = await db.assessments
                  .where('studentId').equals(actualStudentId)
                  .filter(a => a.source === 'FAST Writing')
                  .toArray();
                if (assessments.length > 0) {
                  const latestScore = assessments
                    .sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime())[0].score || 0;
                  const threshold = Number(rule.criteria.threshold);
                  isFlagged = rule.criteria.condition === 'below' ? 
                    latestScore < threshold : 
                    rule.criteria.condition === 'above' ? latestScore > threshold : latestScore === threshold;
                  message = `FAST Writing: ${latestScore} (${rule.criteria.condition} ${threshold})`;
                }
                break;
              }
            }
            
            if (isFlagged) {
              studentFlags.push({
                category: rule.category,
                flagName: rule.name,
                message,
                color: rule.color || 'red'
              });
            }
          } catch (error) {
            console.error('Error evaluating flag for student:', error);
          }
        }
        
        if (studentFlags.length > 0) {
          flaggedMap[student.id] = studentFlags;
        }
      }
      
      return flaggedMap;
    },
    enabled: students.length > 0
  });

  // Hook to check data availability for ALL students at once
  const studentsDataAvailability = useQuery({
    queryKey: ['students-data-availability', students.map(s => s.id).sort().join(',')],
    queryFn: async () => {
      const availabilityMap: Record<string, any> = {};
      
      for (const student of students) {
        // Try both numeric ID and potential compound ID formats
        const numericId = student.id;
        const possibleIds = [
          numericId,
          String(numericId),
          `wasabi_${numericId}_*` // This won't work with equals, but let's see
        ];

        // First try direct queries, then try compound ID pattern matching if needed
        let [attendance, grades, discipline, assessments, sobaStudentNotes] = await Promise.all([
          db.attendance.where('studentId').anyOf([numericId, String(numericId)]).count(),
          db.grades.where('studentId').anyOf([numericId, String(numericId)]).count(), 
          db.discipline.where('studentId').anyOf([numericId, String(numericId)]).count(),
          db.assessments.where('studentId').anyOf([numericId, String(numericId)]).toArray(),
          db.sobaStudentNotes.where('studentId').equals(String(numericId)).count()
        ]);

        // If no data found, try searching for compound IDs that contain this numeric ID
        if (attendance === 0 && grades === 0 && discipline === 0 && assessments.length === 0) {
          console.log(`🔍 DEBUG: No data found with standard IDs, trying compound ID search for ${numericId}`);
          
          const [compoundAttendance, compoundGrades, compoundDiscipline, compoundAssessments] = await Promise.all([
            db.attendance.filter(record => 
              typeof record.studentId === 'string' && record.studentId.includes(`_${numericId}_`)
            ).count(),
            db.grades.filter(record => 
              typeof record.studentId === 'string' && record.studentId.includes(`_${numericId}_`)
            ).count(),
            db.discipline.filter(record => 
              typeof record.studentId === 'string' && record.studentId.includes(`_${numericId}_`)
            ).count(),
            db.assessments.filter(record => 
              typeof record.studentId === 'string' && record.studentId.includes(`_${numericId}_`)
            ).toArray(),
          ]);
          
          attendance = compoundAttendance;
          grades = compoundGrades;
          discipline = compoundDiscipline;
          assessments = compoundAssessments;
          
          console.log(`🔍 DEBUG: Compound ID search results - Attendance: ${attendance}, Grades: ${grades}, Discipline: ${discipline}, Assessments: ${assessments.length}`);
        }

        console.log(`🔍 DEBUG: Data availability check for studentId: ${student.id}`);
        console.log(`📊 DEBUG: Attendance count: ${attendance}, Grades count: ${grades}, Discipline count: ${discipline}, Assessments count: ${assessments.length}, SOBA notes count: ${sobaStudentNotes}`);
        
        // Debug: Check what studentIds actually exist in each table
        if (attendance === 0) {
          const sampleAttendance = await db.attendance.limit(3).toArray();
          console.log(`🔍 DEBUG: Sample attendance studentIds:`, sampleAttendance.map(a => ({ studentId: a.studentId, type: typeof a.studentId })));
        }
        if (grades === 0) {
          const sampleGrades = await db.grades.limit(3).toArray();
          console.log(`🔍 DEBUG: Sample grades studentIds:`, sampleGrades.map(g => ({ studentId: g.studentId, type: typeof g.studentId })));
        }
        if (assessments.length === 0) {
          const sampleAssessments = await db.assessments.limit(3).toArray();
          console.log(`🔍 DEBUG: Sample assessment studentIds:`, sampleAssessments.map(a => ({ studentId: a.studentId, type: typeof a.studentId })));
        }

        // Check for different assessment types
        const hasIReadyReading = assessments.some(a => 
          (a.source === 'iReady' || a.source === 'iReady Reading') && 
          (a.subject === 'Reading' || a.subject === 'ELA' || a.subject === 'Reading - Overall' || a.subject === 'Reading - Comprehensive' || a.subject?.includes('Reading'))
        );
        const hasIReadyMath = assessments.some(a => 
          (a.source === 'iReady' || a.source === 'iReady Math') && 
          (a.subject === 'Math' || a.subject === 'Math - Overall' || a.subject === 'Math - Comprehensive' || a.subject?.includes('Math'))
        );
        // Check for new FAST format (from ZIP adapter) - handles both legacy and enhanced formats
        const hasFastMath = assessments.some(a => 
          (a.source === 'FAST' || a.source?.includes('FAST')) && a.subject === 'Math'
        );
        const hasFastELA = assessments.some(a => 
          (a.source === 'FAST' || a.source?.includes('FAST')) && (a.subject === 'ELA' || a.subject === 'Reading')
        );
        const hasFastScience = assessments.some(a => 
          (a.source === 'FAST' || a.source?.includes('FAST')) && a.subject === 'Science'
        );
        const hasFastWriting = assessments.some(a => 
          (a.source === 'FAST' || a.source?.includes('FAST')) && a.subject === 'Writing'
        );
        
        // Legacy FAST format support
        const hasFastPM1KG2 = assessments.some(a => 
          a.source === 'FAST PM1 KG-2nd'
        );
        const hasFastPM1_3_5 = assessments.some(a => 
          a.source === 'FAST PM1 3rd-5th'
        );
        const hasFastPM2KG2 = assessments.some(a => 
          a.source === 'FAST PM2 KG-2nd'
        );
        const hasFastPM2_3_5 = assessments.some(a => 
          a.source === 'FAST PM2 3rd-5th'
        );
        const hasFastPM3KG2 = assessments.some(a => 
          a.source === 'FAST PM3 KG-2nd'
        );
        const hasFastPM3_3_5 = assessments.some(a => 
          a.source === 'FAST PM3 3rd-5th'
        );
        const hasFastWriting4_5 = assessments.some(a => 
          a.source === 'FAST Writing 4th-5th'
        );
        const hasFastScience5 = assessments.some(a => 
          a.source === 'FAST Science 5th'
        );

        availabilityMap[student.id] = {
          hasAttendance: attendance > 0,
          hasGrades: grades > 0,
          hasDiscipline: discipline > 0,
          hasIReadyReading,
          hasIReadyMath,
          hasFastMath,
          hasFastELA,
          hasFastScience,
          hasFastWriting,
          hasSobaStudentNotes: sobaStudentNotes > 0,
          // Legacy FAST support
          hasFastPM1KG2,
          hasFastPM1_3_5,
          hasFastPM2KG2,
          hasFastPM2_3_5,
          hasFastPM3KG2,
          hasFastPM3_3_5,
          hasFastWriting4_5,
          hasFastScience5
        };
      }
      
      return availabilityMap;
    }
  });

  // Helper function to check if a student has flags for a specific category
  const hasFlag = (studentId: string, category: string): { flagged: boolean; message?: string; colors: string[] } => {
    const studentFlags = flaggedStudentsMap[studentId] || [];
    const categoryFlags = studentFlags.filter(f => f.category === category);
    
    if (categoryFlags.length === 0) {
      return { flagged: false, message: undefined, colors: [] };
    }
    
    // Define color severity order (warmest/worst to coolest/best)
    const colorSeverity = { red: 5, orange: 4, yellow: 3, blue: 2, green: 1 };
    
    // Get the worst (highest severity) color only
    const worstColor = categoryFlags
      .map(f => f.color || 'red')
      .sort((a, b) => (colorSeverity[b as keyof typeof colorSeverity] || 5) - (colorSeverity[a as keyof typeof colorSeverity] || 5))[0];
    
    return {
      flagged: true,
      message: categoryFlags.map(f => f.message).join('; '),
      colors: [worstColor] // Only return the single worst color
    };
  };

  // Data sections - connected to actual database, filtered by availability
  const getStudentSections = (student: StudentSearchResult) => {
    const availability = studentsDataAvailability.data?.[student.id];
    
    if (!availability) return [];

    const allSections = [
      {
        id: 'attendance',
        title: 'Attendance Data',
        hasFlag: hasFlag(student.id, 'attendance').flagged,
        flagMessage: hasFlag(student.id, 'attendance').message,
        flagColors: hasFlag(student.id, 'attendance').colors,
        hasData: availability.hasAttendance,
        content: <AttendanceDataView studentId={student.id} />
      },
      {
        id: 'grades',
        title: 'Grade Data',
        hasFlag: hasFlag(student.id, 'grades').flagged,
        flagMessage: hasFlag(student.id, 'grades').message,
        flagColors: hasFlag(student.id, 'grades').colors,
        hasData: availability.hasGrades,
        content: <GradeDataView studentId={student.id} />
      },
      {
        id: 'discipline',
        title: 'Discipline Records',
        hasFlag: hasFlag(student.id, 'discipline').flagged || availability.hasDiscipline, // Show red flag if discipline records exist OR flagged
        flagMessage: hasFlag(student.id, 'discipline').message || (availability.hasDiscipline ? 'Has discipline records' : undefined),
        flagColors: hasFlag(student.id, 'discipline').flagged ? hasFlag(student.id, 'discipline').colors : ['red'],
        hasData: true, // Always show discipline section for transparency
        content: <DisciplineDataView studentId={student.id} />
      },
      {
        id: 'iready-reading',
        title: 'iReady Reading Assessment',
        hasFlag: hasFlag(student.id, 'iready-reading').flagged,
        flagMessage: hasFlag(student.id, 'iready-reading').message,
        flagColors: hasFlag(student.id, 'iready-reading').colors,
        hasData: availability.hasIReadyReading,
        content: <IReadyReadingDataView studentId={student.id} />
      },
      {
        id: 'iready-math',
        title: 'iReady Math Assessment',
        hasFlag: hasFlag(student.id, 'iready-math').flagged,
        flagMessage: hasFlag(student.id, 'iready-math').message,
        flagColors: hasFlag(student.id, 'iready-math').colors,
        hasData: availability.hasIReadyMath,
        content: <IReadyMathDataView studentId={student.id} />
      },
      {
        id: 'fast-math',
        title: 'FAST Mathematics',
        hasFlag: hasFlag(student.id, 'fast-math').flagged,
        flagMessage: hasFlag(student.id, 'fast-math').message,
        flagColors: hasFlag(student.id, 'fast-math').colors,
        hasData: availability.hasFastMath,
        content: <FastMathDataView studentId={student.id} />
      },
      {
        id: 'fast-ela',
        title: 'FAST ELA',
        hasFlag: hasFlag(student.id, 'fast-ela').flagged,
        flagMessage: hasFlag(student.id, 'fast-ela').message,
        flagColors: hasFlag(student.id, 'fast-ela').colors,
        hasData: availability.hasFastELA,
        content: <FastElaDataView studentId={student.id} />
      },
      {
        id: 'fast-science',
        title: 'FAST Science',
        hasFlag: hasFlag(student.id, 'fast-science').flagged,
        flagMessage: hasFlag(student.id, 'fast-science').message,
        flagColors: hasFlag(student.id, 'fast-science').colors,
        hasData: availability.hasFastScience,
        content: <FastScienceDataView studentId={student.id} />
      },
      {
        id: 'fast-writing',
        title: 'FAST Writing',
        hasFlag: hasFlag(student.id, 'fast-writing').flagged,
        flagMessage: hasFlag(student.id, 'fast-writing').message,
        flagColors: hasFlag(student.id, 'fast-writing').colors,
        hasData: availability.hasFastWriting,
        content: <FastWritingDataView studentId={student.id} />
      },
      // Legacy FAST sections (kept for backward compatibility)
      {
        id: 'fast-pm1-kg-2nd',
        title: 'FAST PM1 KG-2nd',
        hasFlag: false,
        hasData: availability.hasFastPM1KG2,
        content: <AssessmentDataView studentId={student.id} source="FAST PM1 KG-2nd" />
      },
      {
        id: 'fast-pm1-3rd-5th',
        title: 'FAST PM1 3rd-5th',
        hasFlag: false,
        hasData: availability.hasFastPM1_3_5,
        content: <AssessmentDataView studentId={student.id} source="FAST PM1 3rd-5th" />
      },
      {
        id: 'fast-pm2-kg-2nd',
        title: 'FAST PM2 KG-2nd',
        hasFlag: false,
        hasData: availability.hasFastPM2KG2,
        content: <AssessmentDataView studentId={student.id} source="FAST PM2 KG-2nd" />
      },
      {
        id: 'fast-pm2-3rd-5th',
        title: 'FAST PM2 3rd-5th',
        hasFlag: false,
        hasData: availability.hasFastPM2_3_5,
        content: <AssessmentDataView studentId={student.id} source="FAST PM2 3rd-5th" />
      },
      {
        id: 'fast-pm3-kg-2nd',
        title: 'FAST PM3 KG-2nd',
        hasFlag: false,
        hasData: availability.hasFastPM3KG2,
        content: <AssessmentDataView studentId={student.id} source="FAST PM3 KG-2nd" />
      },
      {
        id: 'fast-pm3-3rd-5th',
        title: 'FAST PM3 3rd-5th',
        hasFlag: false,
        hasData: availability.hasFastPM3_3_5,
        content: <AssessmentDataView studentId={student.id} source="FAST PM3 3rd-5th" />
      },
      {
        id: 'fast-writing-4th-5th',
        title: 'FAST Writing 4th-5th',
        hasFlag: false,
        hasData: availability.hasFastWriting4_5,
        content: <AssessmentDataView studentId={student.id} source="FAST Writing 4th-5th" />
      },
      {
        id: 'fast-science-5th',
        title: 'FAST Science 5th',
        hasFlag: false,
        hasData: availability.hasFastScience5,
        content: <AssessmentDataView studentId={student.id} source="FAST Science 5th" />
      },
      {
        id: 'soba-student-notes',
        title: 'SOBA Observations',
        hasFlag: false,
        hasData: true, // Always show SOBA section for note taking
        content: <SOBADataView studentId={student.id} />
      }
    ];

    // Always show attendance, discipline, and SOBA sections for transparency and note-taking
    const sectionsToShow = allSections.filter(section => {
      if (section.id === 'attendance' || section.id === 'discipline' || section.id === 'soba-student-notes') {
        // Always show attendance, discipline, and SOBA sections
        return true;
      }
      return section.hasData;
    });
    
    console.log(`🔍 DEBUG: Sections to show for student ${student.id}:`, sectionsToShow.map(s => `${s.id}: ${s.hasData}`));
    
    return sectionsToShow;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 
                     text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 
                     dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Search
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Student Profiles
          </h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            ({students.length} student{students.length !== 1 ? 's' : ''} selected)
          </span>
        </div>
      </div>

      {/* Profile Cards Container */}
      <div className="flex-1 overflow-auto">
        <div className="flex gap-6 min-h-full pb-6">
          {students.map((student) => {
            const sections = getStudentSections(student);
            
            return (
              <div
                key={student.id}
                className="flex-1 min-w-[400px] max-w-[600px] bg-white dark:bg-gray-800 
                         rounded-lg border border-gray-200 dark:border-gray-700 
                         shadow-sm relative animate-in slide-in-from-bottom-4"
                style={{ minHeight: 'fit-content' }}
              >
                {/* Close button (only show if multiple students) */}
                {students.length > 1 && (
                  <button
                    onClick={() => removeStudent(student.id)}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white 
                             rounded-full flex items-center justify-center hover:bg-red-600 
                             transition-colors z-10"
                    title="Remove student from comparison"
                  >
                    <X size={14} />
                  </button>
                )}

                <div className="p-6">
                  {/* Student Header with Demographics */}
                  <div className="flex items-start gap-4 mb-6">
                    <StudentAvatar
                      firstName={formatName(student.firstName || '')}
                      lastName={formatName(student.lastName || '')}
                      gender={student.gender}
                      size="lg"
                    />
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {formatName(student.fullName || '')}
                      </h2>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Student ID:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100">{student.studentNumber}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Grade Level:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100">Grade {student.grade}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">HR Teacher:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100">
                            <InstructorName 
                              originalName={student.className || ''} 
                              fallback="Not assigned"
                            />
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600 dark:text-gray-400">Gender:</span>
                          <span className="ml-2 text-gray-900 dark:text-gray-100 capitalize">{student.gender || 'Not specified'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Collapsible Sections */}
                  <div className="space-y-2">
                    {sections.map((section) => (
                      <CollapsibleSection
                        key={`${student.id}-${section.id}`}
                        title={section.title}
                        isOpen={isSectionOpen(student.id, section.id)}
                        onToggle={() => toggleSection(student.id, section.id)}
                        hasFlag={section.hasFlag}
                        flagMessage={section.flagMessage}
                        flagColors={section.flagColors}
                        children={section.content}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}