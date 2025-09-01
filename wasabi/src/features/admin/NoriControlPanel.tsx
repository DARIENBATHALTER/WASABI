import React, { useState, useEffect } from 'react';
import { Bot, Database, Users, FileText, BarChart3, AlertTriangle, CheckCircle, Sparkles, Eye, EyeOff, ClipboardList } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { StudentDataRetrieval, type StudentDataContext } from '../../services/studentDataRetrieval';
import { StudentNameTranslationService } from '../../services/studentNameTranslation';

interface DatasetStats {
  name: string;
  count: number;
  latestRecord?: string;
  icon: React.ComponentType<any>;
  description: string;
}

export default function NoriControlPanel() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'data-access' | 'sample-query' | 'privacy'>('overview');
  const [sampleQuery, setSampleQuery] = useState('');
  const [sampleResults, setSampleResults] = useState<StudentDataContext | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [showSensitiveData, setShowSensitiveData] = useState(false);

  // Fetch comprehensive database statistics
  const { data: dbStats, isLoading } = useQuery({
    queryKey: ['nori-db-stats'],
    queryFn: async () => {
      const [
        studentsCount,
        attendanceCount,
        gradesCount,
        assessmentsCount,
        disciplineCount,
        latestAttendance,
        latestGrade,
        latestAssessment
      ] = await Promise.all([
        db.students.count(),
        db.attendance.count(),
        db.grades.count(),
        db.assessments.count(),
        db.discipline.count(),
        db.attendance.orderBy('date').reverse().first(),
        db.grades.orderBy('assignmentDate').reverse().first(),
        db.assessments.orderBy('testDate').reverse().first()
      ]);

      const datasets: DatasetStats[] = [
        {
          name: 'Student Enrollment',
          count: studentsCount,
          icon: Users,
          description: 'Complete student roster with demographics and enrollment data'
        },
        {
          name: 'Attendance Records',
          count: attendanceCount,
          latestRecord: latestAttendance?.date ? latestAttendance.date.toLocaleDateString() : 'No records',
          icon: FileText,
          description: 'Daily attendance tracking with absence patterns and chronic absenteeism detection'
        },
        {
          name: 'Academic Grades',
          count: gradesCount,
          latestRecord: latestGrade?.assignmentDate ? latestGrade.assignmentDate.toLocaleDateString() : 'No records',
          icon: BarChart3,
          description: 'Subject-specific grades, GPA calculations, and academic trend analysis'
        },
        {
          name: 'Assessment Scores',
          count: assessmentsCount,
          latestRecord: latestAssessment?.testDate ? latestAssessment.testDate.toLocaleDateString() : 'No records',
          icon: Database,
          description: 'iReady, FAST, and other standardized assessment results with percentiles'
        },
        {
          name: 'Discipline Records',
          count: disciplineCount,
          icon: AlertTriangle,
          description: 'Behavioral incidents, interventions, and discipline tracking'
        }
      ];

      return datasets;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Get flag rules count
  const { data: flagsCount = 0 } = useQuery({
    queryKey: ['nori-flags-count'],
    queryFn: async () => {
      const flagRulesData = localStorage.getItem('wasabi-flag-rules');
      const flagRules = flagRulesData ? JSON.parse(flagRulesData) : [];
      return flagRules.length;
    }
  });

  const handleSampleQuery = async () => {
    if (!sampleQuery.trim()) return;
    
    setIsLoadingSample(true);
    try {
      const results = await StudentDataRetrieval.retrieveRelevantData(sampleQuery);
      setSampleResults(results);
    } catch (error) {
      console.error('Error running sample query:', error);
    }
    setIsLoadingSample(false);
  };

  const sampleQueries = [
    'Which students need immediate intervention?',
    'Show me Grade 3 performance patterns',
    'Find students with low attendance and failing grades',
    'What are the trends in iReady Math scores?'
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Nori Control Panel
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Monitor and analyze data available to the AI Assistant
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
        {[
          { id: 'overview', label: 'Data Overview', icon: Database },
          { id: 'data-access', label: 'Data Access', icon: Eye },
          { id: 'sample-query', label: 'Test Query', icon: Bot },
          { id: 'privacy', label: 'Privacy Settings', icon: AlertTriangle }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                selectedTab === tab.id
                  ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-full text-center py-12">
              <Database className="w-12 h-12 mx-auto mb-4 text-gray-400 animate-pulse" />
              <p className="text-gray-600 dark:text-gray-400">Loading database statistics...</p>
            </div>
          ) : (
            dbStats?.map((dataset) => {
              const Icon = dataset.icon;
              return (
                <div
                  key={dataset.name}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                      <Icon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {dataset.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {dataset.count.toLocaleString()} records
                      </p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {dataset.description}
                  </p>
                  
                  {dataset.latestRecord && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                      <CheckCircle className="w-3 h-3" />
                      <span>Latest: {dataset.latestRecord}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Flag Rules Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  Active Flag Rules
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {flagsCount} rules
                </p>
              </div>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Automated flagging rules for identifying at-risk students and intervention needs
            </p>
          </div>
        </div>
      )}

      {selectedTab === 'data-access' && (
        <div className="space-y-6">
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Nori's Data Access Capabilities
            </h3>
            <p className="text-blue-700 dark:text-blue-300 mb-4">
              The AI Assistant has comprehensive read-only access to all student data through a secure RAG (Retrieval-Augmented Generation) system.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Individual Student Queries</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Complete attendance history with daily records</li>
                <li>• All academic grades by subject and time period</li>
                <li>• Assessment scores (iReady, FAST) with trends</li>
                <li>• Discipline records and behavioral patterns</li>
                <li>• Active flags and risk assessments</li>
                <li>• Demographic and enrollment information</li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Group Analysis</h4>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <li>• Grade-level performance comparisons</li>
                <li>• Classroom and teacher analytics</li>
                <li>• Cohort trend analysis over time</li>
                <li>• Cross-dataset correlations</li>
                <li>• Risk factor identification</li>
                <li>• Intervention effectiveness tracking</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'sample-query' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Test Nori's Data Access
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Enter a query to test data retrieval:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={sampleQuery}
                    onChange={(e) => setSampleQuery(e.target.value)}
                    placeholder="e.g., Show me students in Grade 3 with attendance below 85%"
                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSampleQuery}
                    disabled={!sampleQuery.trim() || isLoadingSample}
                    className="bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-6 py-3 rounded-lg transition-colors disabled:cursor-not-allowed"
                  >
                    {isLoadingSample ? 'Running...' : 'Test Query'}
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Sample queries:</p>
                <div className="flex flex-wrap gap-2">
                  {sampleQueries.map((query) => (
                    <button
                      key={query}
                      onClick={() => setSampleQuery(query)}
                      className="text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-1 rounded transition-colors"
                    >
                      {query}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {sampleResults && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Query Results</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {sampleResults.summary.totalStudents}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Students</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {sampleResults.summary.averageAttendance.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Attendance</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {sampleResults.summary.averageGrade.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Avg Grade</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {sampleResults.summary.studentsWithFlags}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Flagged</div>
                </div>
              </div>
              
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Query Type:</strong> {sampleResults.summary.queryType} | 
                <strong> Data Retrieved:</strong> {sampleResults.attendance.length} attendance, {sampleResults.grades.length} grades, {sampleResults.assessments.length} assessments, {sampleResults.discipline.length} discipline, {sampleResults.flags.length} flags
              </div>
            </div>
          )}
        </div>
      )}

      {selectedTab === 'privacy' && (
        <div className="space-y-6">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-green-900 dark:text-green-100">
                Privacy Protection Active
              </h3>
            </div>
            <p className="text-green-700 dark:text-green-300">
              All student data is protected through a comprehensive name translation system that uses WASABI IDs instead of student names when communicating with external AI services.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">How Privacy Works</h4>
              <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400 list-decimal list-inside">
                <li>Student names in queries are translated to WASABI IDs</li>
                <li>Only WASABI IDs are sent to external AI services</li>
                <li>AI responses with WASABI IDs are translated back to names</li>
                <li>No personally identifiable information leaves the system</li>
              </ol>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">Data Visibility</h4>
                <button
                  onClick={() => setShowSensitiveData(!showSensitiveData)}
                  className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300"
                >
                  {showSensitiveData ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showSensitiveData ? 'Hide' : 'Show'} Details
                </button>
              </div>
              {showSensitiveData ? (
                <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <p><strong>Stored locally:</strong> All student data remains in browser</p>
                  <p><strong>External access:</strong> Only anonymized WASABI IDs</p>
                  <p><strong>AI service:</strong> Cannot identify individual students</p>
                  <p><strong>Translation layer:</strong> Active for all queries</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Click "Show Details" to view privacy protection specifics.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}