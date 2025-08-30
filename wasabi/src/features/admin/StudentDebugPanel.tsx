import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Users, 
  Search, 
  Eye, 
  FileText, 
  Calendar, 
  GraduationCap, 
  BarChart3, 
  ArrowLeft,
  User,
  Database,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';
import { db } from '../../lib/db';
import StudentAvatar from '../../shared/components/StudentAvatar';
import type { Student, AttendanceRecord, GradeRecord, AssessmentRecord } from '../../shared/types';

interface StudentDebugPanelProps {}

interface StudentWithData extends Student {
  attendanceCount: number;
  gradeCount: number;
  assessmentCount: number;
  totalRecords: number;
}

interface StudentDetailData {
  student: Student;
  attendance: AttendanceRecord[];
  grades: GradeRecord[];
  assessments: AssessmentRecord[];
}

export default function StudentDebugPanel({}: StudentDebugPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'attendance' | 'grades' | 'assessments'>('attendance');

  // Get all students with their data counts
  const { data: studentsWithData, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-with-data'],
    queryFn: async (): Promise<StudentWithData[]> => {
      const students = await db.students.toArray();
      console.log('Debug: Found students:', students.length, 'First student ID type:', students[0]?.id);
      
      // Sample some records to see ID patterns
      const sampleAttendance = await db.attendance.limit(5).toArray();
      const sampleGrades = await db.grades.limit(5).toArray();
      const sampleAssessments = await db.assessments.limit(5).toArray();
      
      console.log('Debug: Sample attendance studentIds:', sampleAttendance.map(r => r.studentId));
      console.log('Debug: Sample grade studentIds:', sampleGrades.map(r => r.studentId));
      console.log('Debug: Sample assessment studentIds:', sampleAssessments.map(r => r.studentId));
      
      const studentsWithCounts = await Promise.all(
        students.map(async (student) => {
          const [attendanceCount, gradeCount, assessmentCount] = await Promise.all([
            db.attendance.where('studentId').equals(student.id).count(),
            db.grades.where('studentId').equals(student.id).count(),
            db.assessments.where('studentId').equals(student.id).count(),
          ]);
          
          // Debug specific student
          if (student.firstName === 'Chloe' && student.lastName === 'Alexander') {
            console.log(`Debug: Chloe Alexander - ID: ${student.id}, Attendance: ${attendanceCount}, Grades: ${gradeCount}, Assessments: ${assessmentCount}`);
          }
          
          return {
            ...student,
            attendanceCount,
            gradeCount,
            assessmentCount,
            totalRecords: attendanceCount + gradeCount + assessmentCount,
          };
        })
      );
      
      // Sort by total records (most data first), then by name
      return studentsWithCounts.sort((a, b) => {
        if (b.totalRecords !== a.totalRecords) {
          return b.totalRecords - a.totalRecords;
        }
        return `${a.lastName}, ${a.firstName}`.localeCompare(`${b.lastName}, ${b.firstName}`);
      });
    },
  });

  // Get detailed data for selected student
  const { data: studentDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['student-detail', selectedStudent],
    queryFn: async (): Promise<StudentDetailData | null> => {
      if (!selectedStudent) return null;
      
      const [student, attendance, grades, assessments] = await Promise.all([
        db.students.where('id').equals(selectedStudent).first(),
        db.attendance.where('studentId').equals(selectedStudent).toArray(),
        db.grades.where('studentId').equals(selectedStudent).toArray(),
        db.assessments.where('studentId').equals(selectedStudent).toArray(),
      ]);
      
      if (!student) return null;
      
      return {
        student,
        attendance: attendance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        grades: grades.sort((a, b) => a.course.localeCompare(b.course)),
        assessments: assessments.sort((a, b) => new Date(b.testDate).getTime() - new Date(a.testDate).getTime()),
      };
    },
    enabled: !!selectedStudent,
  });

  // Filter students based on search term
  const filteredStudents = studentsWithData?.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.firstName.toLowerCase().includes(searchLower) ||
      student.lastName.toLowerCase().includes(searchLower) ||
      student.studentNumber.includes(searchLower) ||
      student.grade.toLowerCase().includes(searchLower) ||
      (student.className && student.className.toLowerCase().includes(searchLower))
    );
  }) || [];

  const getDataStatusIcon = (count: number) => {
    if (count === 0) return <XCircle className="w-4 h-4 text-red-500" />;
    if (count < 5) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getMatchingInfo = (record: any) => {
    if (!record.matchedBy) return null;
    
    return (
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Matched by: {record.matchedBy} 
        {record.matchConfidence && ` (${record.matchConfidence}% confidence)`}
        {record.originalStudentId && ` • Original ID: ${record.originalStudentId}`}
      </div>
    );
  };

  if (selectedStudent && studentDetail) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setSelectedStudent(null)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 
                       text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 
                       dark:hover:bg-gray-600 transition-colors"
            >
              <ArrowLeft size={20} />
              Back to Student List
            </button>
            
            <div className="flex items-center gap-4">
              <StudentAvatar
                firstName={studentDetail.student.firstName}
                lastName={studentDetail.student.lastName}
                gender={studentDetail.student.gender}
                size="lg"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {studentDetail.student.firstName} {studentDetail.student.lastName}
                </h1>
                <div className="text-gray-600 dark:text-gray-400 space-y-1">
                  <p>WASABI ID: {studentDetail.student.id}</p>
                  <p>Student #: {studentDetail.student.studentNumber}</p>
                  <p>Grade: {studentDetail.student.grade} • Teacher: {studentDetail.student.className || 'Not assigned'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Data Summary Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-8 h-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {studentDetail.attendance.length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Attendance Records</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <GraduationCap className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {studentDetail.grades.length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Grade Records</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-8 h-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {studentDetail.assessments.length}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Assessment Records</p>
                </div>
              </div>
            </div>
          </div>

          {/* Data Tabs */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex space-x-8 px-6" aria-label="Tabs">
                {[
                  { id: 'attendance', label: 'Attendance', icon: Calendar, count: studentDetail.attendance.length },
                  { id: 'grades', label: 'Grades', icon: GraduationCap, count: studentDetail.grades.length },
                  { id: 'assessments', label: 'Assessments', icon: BarChart3, count: studentDetail.assessments.length },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedTab(tab.id as any)}
                      className={`${
                        selectedTab === tab.id
                          ? 'border-wasabi-green text-wasabi-green'
                          : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                      } flex items-center gap-2 whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                    >
                      <Icon size={16} />
                      {tab.label}
                      <span className={`${
                        selectedTab === tab.id ? 'bg-wasabi-green text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      } inline-flex items-center justify-center px-2 py-1 text-xs font-bold rounded-full`}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="p-6">
              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
                </div>
              ) : (
                <>
                  {selectedTab === 'attendance' && (
                    <div className="space-y-4">
                      {studentDetail.attendance.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                          No attendance records found
                        </p>
                      ) : (
                        <div className="grid gap-3">
                          {studentDetail.attendance.slice(0, 20).map((record, index) => (
                            <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">
                                    {new Date(record.date).toLocaleDateString()}
                                  </p>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Status: {record.status}
                                  </p>
                                </div>
                                <div className="text-right text-sm">
                                  {getMatchingInfo(record)}
                                </div>
                              </div>
                            </div>
                          ))}
                          {studentDetail.attendance.length > 20 && (
                            <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                              Showing first 20 of {studentDetail.attendance.length} records
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTab === 'grades' && (
                    <div className="space-y-4">
                      {studentDetail.grades.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                          No grade records found
                        </p>
                      ) : (
                        <div className="grid gap-3">
                          {studentDetail.grades.map((record, index) => (
                            <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                    {record.course}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                    Teacher: {record.teacher || 'Not specified'}
                                  </p>
                                  <div className="grid grid-cols-4 gap-2 text-sm">
                                    {record.grades.map((grade, gradeIndex) => (
                                      <div key={gradeIndex} className="text-center">
                                        <p className="font-medium">{grade.period}</p>
                                        <p className="text-gray-600 dark:text-gray-400">{grade.grade || '-'}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="text-right text-sm ml-4">
                                  {getMatchingInfo(record)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTab === 'assessments' && (
                    <div className="space-y-4">
                      {studentDetail.assessments.length === 0 ? (
                        <p className="text-gray-500 dark:text-gray-400 text-center py-8">
                          No assessment records found
                        </p>
                      ) : (
                        <div className="grid gap-3">
                          {studentDetail.assessments.map((record, index) => (
                            <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-gray-100">
                                    {record.source} - {record.subject}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    Date: {new Date(record.testDate).toLocaleDateString()}
                                  </p>
                                  <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">Score:</span>
                                      <span className="ml-2 font-medium">{record.score}</span>
                                    </div>
                                    {record.percentile && (
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Percentile:</span>
                                        <span className="ml-2 font-medium">{record.percentile}</span>
                                      </div>
                                    )}
                                    {record.proficiency && (
                                      <div>
                                        <span className="text-gray-600 dark:text-gray-400">Proficiency:</span>
                                        <span className="ml-2 font-medium capitalize">{record.proficiency}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right text-sm ml-4">
                                  {getMatchingInfo(record)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Student Debug Panel
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              View all students and their associated data records
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Search */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search students by name, ID, grade, or teacher..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:ring-2 focus:ring-wasabi-green focus:border-transparent"
            />
          </div>
        </div>

        {/* Student List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <Users size={20} className="text-gray-600 dark:text-gray-400" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Students ({filteredStudents.length})
              </h2>
            </div>
          </div>

          <div className="p-4">
            {studentsLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <User size={48} className="mx-auto mb-4 opacity-50" />
                <p>{searchTerm ? 'No students found matching your search' : 'No students found'}</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                    onClick={() => setSelectedStudent(student.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <StudentAvatar
                          firstName={student.firstName}
                          lastName={student.lastName}
                          gender={student.gender}
                          size="md"
                        />
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-gray-100">
                            {student.firstName} {student.lastName}
                          </h3>
                          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <p>ID: {student.studentNumber} • Grade: {student.grade}</p>
                            <p>Teacher: {student.className || 'Not assigned'}</p>
                            <p className="text-xs text-gray-500">WASABI ID: {student.id}</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* Data Status Indicators */}
                        <div className="flex gap-2">
                          <div className="flex items-center gap-1" title={`${student.attendanceCount} attendance records`}>
                            {getDataStatusIcon(student.attendanceCount)}
                            <span className="text-sm text-gray-600 dark:text-gray-400">{student.attendanceCount}</span>
                          </div>
                          <div className="flex items-center gap-1" title={`${student.gradeCount} grade records`}>
                            {getDataStatusIcon(student.gradeCount)}
                            <span className="text-sm text-gray-600 dark:text-gray-400">{student.gradeCount}</span>
                          </div>
                          <div className="flex items-center gap-1" title={`${student.assessmentCount} assessment records`}>
                            {getDataStatusIcon(student.assessmentCount)}
                            <span className="text-sm text-gray-600 dark:text-gray-400">{student.assessmentCount}</span>
                          </div>
                        </div>
                        
                        <Eye size={20} className="text-gray-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}