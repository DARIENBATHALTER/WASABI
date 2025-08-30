import React, { useState } from 'react';
import { FileText, Users, School, User, Download, Settings, HelpCircle, AlertCircle, CheckCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { htmlPrintService } from '../../services/htmlPrintService';
import PageHeader from '../../shared/components/PageHeader';
import PageWrapper from '../../shared/components/PageWrapper';

type ReportType = 'single' | 'homeroom' | 'grade';
type ReportFormat = 'detailed' | 'parent-friendly';

interface DatasetOption {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}

const defaultDatasets: DatasetOption[] = [
  {
    id: 'demographics',
    name: 'Student Demographics',
    description: 'Basic student information',
    enabled: true
  },
  {
    id: 'attendance',
    name: 'Attendance Records',
    description: 'Daily attendance records',
    enabled: true
  },
  {
    id: 'grades',
    name: 'Academic Grades',
    description: 'Academic performance',
    enabled: true
  },
  {
    id: 'discipline',
    name: 'Discipline Records',
    description: 'Behavioral incidents',
    enabled: false
  },
  {
    id: 'iready-reading',
    name: 'iReady Reading Assessment',
    description: 'Reading diagnostics',
    enabled: true
  },
  {
    id: 'iready-math',
    name: 'iReady Math Assessment',
    description: 'Math diagnostics',
    enabled: true
  },
  {
    id: 'fast-assessments',
    name: 'FAST Assessments',
    description: 'State assessments',
    enabled: true
  }
];

export default function StudentReportsPage() {
  const [reportType, setReportType] = useState<ReportType>('single');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('detailed');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedHomeroom, setSelectedHomeroom] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('');
  const [datasets, setDatasets] = useState<DatasetOption[]>(defaultDatasets);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  // Fetch students for dropdown
  const { data: students = [] } = useQuery({
    queryKey: ['students-for-reports'],
    queryFn: async () => {
      const allStudents = await db.students.toArray();
      return allStudents.map(student => ({
        id: student.id,
        name: `${student.lastName}, ${student.firstName}`,
        grade: student.grade,
        homeroom: student.className
      })).sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  // Get unique homerooms and grades
  const homerooms = [...new Set(students.map(s => s.homeroom).filter(Boolean))].sort();
  const grades = [...new Set(students.map(s => s.grade))].sort((a, b) => {
    if (a.toLowerCase() === 'k') return -1;
    if (b.toLowerCase() === 'k') return 1;
    return parseInt(a) - parseInt(b);
  });

  const toggleDataset = (datasetId: string) => {
    setDatasets(prev => prev.map(dataset => 
      dataset.id === datasetId 
        ? { ...dataset, enabled: !dataset.enabled }
        : dataset
    ));
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setGenerationStatus({ type: null, message: '' });
    
    try {
      // Get student IDs based on report type
      let studentIds: (string | number)[] = [];
      
      switch (reportType) {
        case 'single':
          if (selectedStudent) {
            studentIds = [selectedStudent];
          }
          break;
        case 'homeroom':
          studentIds = students
            .filter(s => s.homeroom === selectedHomeroom)
            .map(s => s.id)
            .filter(id => id != null);
          break;
        case 'grade':
          studentIds = students
            .filter(s => s.grade === selectedGrade)
            .map(s => s.id)
            .filter(id => id != null);
          break;
      }

      if (studentIds.length === 0) {
        throw new Error('No students found for the selected criteria.');
      }

      // Generate the reports using the HTML print service
      await htmlPrintService.generateReports(studentIds, reportFormat);

      setGenerationStatus({
        type: 'success',
        message: `Successfully opened ${studentIds.length} print window${studentIds.length !== 1 ? 's' : ''}! Use the print button in each window to print.`
      });
      
    } catch (error) {
      console.error('Error generating reports:', error);
      setGenerationStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to generate reports. Please check your data and try again.'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const canGenerate = () => {
    if (reportType === 'single' && !selectedStudent) return false;
    if (reportType === 'homeroom' && !selectedHomeroom) return false;
    if (reportType === 'grade' && !selectedGrade) return false;
    return datasets.some(d => d.enabled);
  };

  return (
    <PageWrapper>
      <PageHeader
        title="Student Reports"
        description="Generate comprehensive student reports for parent conferences and administrative review. Reports open in print-ready windows."
        icon={FileText}
      />
      
      <div className="max-w-7xl mx-auto px-6 py-8">

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Report Type Selection */}
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Select Report Type
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Single Student */}
                <button
                  onClick={() => setReportType('single')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    reportType === 'single'
                      ? 'border-wasabi-green bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <User className={`w-8 h-8 mx-auto mb-3 ${
                    reportType === 'single' ? 'text-wasabi-green' : 'text-gray-400'
                  }`} />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Single Student</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Generate a report for one specific student
                  </p>
                </button>

                {/* By Homeroom */}
                <button
                  onClick={() => setReportType('homeroom')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    reportType === 'homeroom'
                      ? 'border-wasabi-green bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <School className={`w-8 h-8 mx-auto mb-3 ${
                    reportType === 'homeroom' ? 'text-wasabi-green' : 'text-gray-400'
                  }`} />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">By Homeroom</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Generate reports for all students in a homeroom
                  </p>
                </button>

                {/* By Grade Level */}
                <button
                  onClick={() => setReportType('grade')}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    reportType === 'grade'
                      ? 'border-wasabi-green bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <Users className={`w-8 h-8 mx-auto mb-3 ${
                    reportType === 'grade' ? 'text-wasabi-green' : 'text-gray-400'
                  }`} />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">By Grade Level</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Generate reports for all students in a grade
                  </p>
                </button>
              </div>
            </div>

            {/* Selection Options */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {reportType === 'single' && 'Select Student'}
                {reportType === 'homeroom' && 'Select Homeroom'}
                {reportType === 'grade' && 'Select Grade Level'}
              </h2>

              {reportType === 'single' && (
                <select
                  value={selectedStudent}
                  onChange={(e) => setSelectedStudent(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-wasabi-green focus:border-wasabi-green"
                >
                  <option value="">Choose a student...</option>
                  {students.map(student => (
                    <option key={student.id} value={student.id}>
                      {student.name} - Grade {student.grade}
                    </option>
                  ))}
                </select>
              )}

              {reportType === 'homeroom' && (
                <select
                  value={selectedHomeroom}
                  onChange={(e) => setSelectedHomeroom(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-wasabi-green focus:border-wasabi-green"
                >
                  <option value="">Choose a homeroom teacher...</option>
                  {homerooms.map(homeroom => (
                    <option key={homeroom} value={homeroom}>
                      {homeroom}
                    </option>
                  ))}
                </select>
              )}

              {reportType === 'grade' && (
                <select
                  value={selectedGrade}
                  onChange={(e) => setSelectedGrade(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-xl 
                           bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                           focus:ring-2 focus:ring-wasabi-green focus:border-wasabi-green"
                >
                  <option value="">Choose a grade level...</option>
                  {grades.map(grade => (
                    <option key={grade} value={grade}>
                      {grade === 'K' ? 'Kindergarten' : `Grade ${grade}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Report Format */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Report Format
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setReportFormat('detailed')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    reportFormat === 'detailed'
                      ? 'border-wasabi-green bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <Settings className={`w-6 h-6 mb-2 ${
                    reportFormat === 'detailed' ? 'text-wasabi-green' : 'text-gray-400'
                  }`} />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Detailed Report</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Technical format for educators and administrators
                  </p>
                </button>

                <button
                  onClick={() => setReportFormat('parent-friendly')}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    reportFormat === 'parent-friendly'
                      ? 'border-wasabi-green bg-green-50 dark:bg-green-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                >
                  <HelpCircle className={`w-6 h-6 mb-2 ${
                    reportFormat === 'parent-friendly' ? 'text-wasabi-green' : 'text-gray-400'
                  }`} />
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">Parent-Friendly</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Clear explanations and plain language for parents
                  </p>
                </button>
              </div>
            </div>
          </div>

          {/* Dataset Selection Sidebar */}
          <div className="space-y-6">
            {/* Generate Button */}
            <button
              onClick={handleGenerateReport}
              disabled={!canGenerate() || isGenerating}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                canGenerate() && !isGenerating
                  ? 'bg-wasabi-green text-white hover:bg-green-600'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download size={20} />
                  Generate Report
                </>
              )}
            </button>

            {/* Report Preview Info */}
            {canGenerate() && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <FileText size={16} className="text-blue-600 mt-0.5" />
                  <div className="text-sm">
                    <div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Report Preview
                    </div>
                    <div className="text-blue-700 dark:text-blue-200">
                      {reportType === 'single' && selectedStudent && (
                        <>Report for {students.find(s => s.id === selectedStudent)?.name}</>
                      )}
                      {reportType === 'homeroom' && selectedHomeroom && (
                        <>Reports for {selectedHomeroom}'s class</>
                      )}
                      {reportType === 'grade' && selectedGrade && (
                        <>Reports for Grade {selectedGrade === 'K' ? 'Kindergarten' : selectedGrade}</>
                      )}
                      <br />
                      Format: {reportFormat === 'detailed' ? 'Detailed (Educator)' : 'Parent-Friendly'}
                      <br />
                      Sections: {datasets.filter(d => d.enabled).length} included
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Include Data Sections
              </h2>
              
              <div className="space-y-1">
                {datasets.map(dataset => (
                  <label
                    key={dataset.id}
                    className={`flex items-start gap-3 p-2 rounded-xl ${
                      dataset.id === 'demographics' 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={dataset.enabled}
                      onChange={() => dataset.id !== 'demographics' && toggleDataset(dataset.id)}
                      disabled={dataset.id === 'demographics'}
                      className={`mt-1 rounded border-gray-300 focus:ring-wasabi-green ${
                        dataset.id === 'demographics' 
                          ? 'text-gray-400 cursor-not-allowed' 
                          : 'text-wasabi-green'
                      }`}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {dataset.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {dataset.description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Status Message */}
            {generationStatus.type && (
              <div className={`p-4 rounded-xl border ${
                generationStatus.type === 'success' 
                  ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
                  : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {generationStatus.type === 'success' ? (
                    <CheckCircle size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span className="text-sm font-medium">
                    {generationStatus.message}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}