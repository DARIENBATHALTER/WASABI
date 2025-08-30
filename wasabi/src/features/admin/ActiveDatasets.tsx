import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Calendar, Users, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { db } from '../../lib/db';
import { StudentMatcher } from '../../lib/student-matching';
import { showToast } from '../../shared/components/Toast';
import type { DataSource } from '../../shared/types';

interface DataSourceWithStats extends DataSource {
  matchedStudents?: number;
  totalRecords?: number;
  matchPercentage?: number;
}

export default function ActiveDatasets() {
  const queryClient = useQueryClient();

  // Get all data sources
  const { data: dataSources, isLoading } = useQuery({
    queryKey: ['data-sources-with-stats'],
    queryFn: async (): Promise<DataSourceWithStats[]> => {
      const sources = await db.dataSources.orderBy('uploadDate').reverse().toArray();
      
      // For each non-enrollment data source, calculate matching stats
      const sourcesWithStats = await Promise.all(
        sources.map(async (source) => {
          if (source.type === 'student-enrollment') {
            // Enrollment data - no matching needed
            return {
              ...source,
              matchedStudents: source.recordCount,
              totalRecords: source.recordCount,
              matchPercentage: 100,
            };
          } else {
            // Assessment/other data - calculate matching stats
            let matchedCount = 0;
            let totalCount = 0;
            
            try {
              // Get all records for this data source
              if (source.type === 'attendance') {
                const records = await db.attendance.toArray();
                totalCount = records.length;
                matchedCount = records.length; // All records are pre-matched during import
              } else if (source.type === 'grades') {
                const records = await db.grades.toArray();
                totalCount = records.length;
                matchedCount = records.length;
              } else {
                // Assessment data
                const records = await db.assessments.toArray();
                totalCount = records.length;
                matchedCount = records.length;
              }
            } catch (error) {
              console.warn('Error calculating stats for source:', source.id, error);
            }
            
            return {
              ...source,
              matchedStudents: matchedCount,
              totalRecords: totalCount,
              matchPercentage: totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) : 0,
            };
          }
        })
      );
      
      return sourcesWithStats;
    },
    staleTime: 30 * 1000, // 30 seconds
  });

  // Get enrollment stats for context
  const { data: enrollmentStats } = useQuery({
    queryKey: ['enrollment-stats'],
    queryFn: () => StudentMatcher.getEnrollmentStats(),
    staleTime: 30 * 1000,
  });

  const getDataSourceTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'student-enrollment': 'Student Enrollment',
      iready: 'iReady Assessment',
      fast: 'FAST Assessment',
      star: 'STAR Assessment',
      achieve3000: 'Achieve3000',
      attendance: 'Attendance Data',
      grades: 'Grade Data',
    };
    return labels[type] || type.toUpperCase();
  };

  const getMatchingStatusColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 dark:text-green-400';
    if (percentage >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getMatchingStatusIcon = (percentage: number) => {
    if (percentage >= 90) return CheckCircle;
    return AlertCircle;
  };

  const handleDeleteDataset = async (source: DataSourceWithStats) => {
    if (!confirm(`Are you sure you want to delete "${source.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await db.transaction('rw', [db.dataSources, db.students, db.assessments, db.attendance, db.grades], async () => {
        // Delete the data source
        await db.dataSources.delete(source.id);
        
        // Delete the associated data based on type
        if (source.type === 'student-enrollment') {
          console.log('Deleting student enrollment - clearing all data');
          // Clear all students (since this is the master index)
          await db.students.clear();
          console.log('Students cleared');
          // Also clear all other data since they depend on students
          await db.assessments.clear();
          await db.attendance.clear();
          await db.grades.clear();
          console.log('All dependent data cleared');
          
          showToast({
            type: 'warning',
            title: 'All Data Cleared',
            message: 'Student enrollment deleted. All dependent data has been cleared.',
            duration: 6000,
          });
        } else if (source.type === 'attendance') {
          // Delete all attendance records (we could be more specific, but for now delete all)
          await db.attendance.clear();
        } else if (source.type === 'grades') {
          // Delete all grade records
          await db.grades.clear();
        } else {
          // Assessment data - delete all assessments (we could filter by source, but for now delete all)
          await db.assessments.clear();
        }
      });

      showToast({
        type: 'success',
        title: 'Dataset Deleted',
        message: `"${source.name}" has been deleted successfully.`,
      });

      // Force immediate refresh of all related data
      console.log('Invalidating all queries after deletion');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['data-sources-with-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['has-enrollment'] }),
        queryClient.invalidateQueries({ queryKey: ['enrollment-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-stats'] }),
        queryClient.invalidateQueries({ queryKey: ['data-sources'] })
      ]);
      
      // Also manually refetch the enrollment check
      await queryClient.refetchQueries({ queryKey: ['has-enrollment'] });
      console.log('All queries invalidated and refetched');

    } catch (error) {
      console.error('Error deleting dataset:', error);
      showToast({
        type: 'error',
        title: 'Delete Failed',
        message: error instanceof Error ? error.message : 'Failed to delete dataset',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
      </div>
    );
  }

  if (!dataSources || dataSources.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-16 w-16 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          No Datasets Found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Use the "Upload Datasets" tab to add your first dataset.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      {enrollmentStats && (
        <div className="card border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20">
          <div className="flex items-start space-x-3">
            <Users className="h-5 w-5 text-green-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-green-800 dark:text-green-200">
                Student Enrollment Active
              </h3>
              <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                <strong>{enrollmentStats.totalStudents}</strong> students enrolled
                {enrollmentStats.lastUpdated && (
                  <span> • Last updated {enrollmentStats.lastUpdated.toLocaleDateString()}</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Datasets Table */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Active Datasets ({dataSources.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dataset
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Records
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Student Matching
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {dataSources.map((source) => {
                const StatusIcon = getMatchingStatusIcon(source.matchPercentage || 0);
                
                return (
                  <tr key={source.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 text-gray-400 mr-3" />
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {source.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {getDataSourceTypeLabel(source.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {source.uploadDate.toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {source.recordCount?.toLocaleString() || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {source.type === 'student-enrollment' ? (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Master Index
                        </span>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <StatusIcon 
                            className={`h-4 w-4 ${getMatchingStatusColor(source.matchPercentage || 0)}`} 
                          />
                          <span className={`text-sm font-medium ${getMatchingStatusColor(source.matchPercentage || 0)}`}>
                            {source.matchedStudents || 0}/{source.totalRecords || 0} ({source.matchPercentage || 0}%)
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                        onClick={() => handleDeleteDataset(source)}
                        title="Delete dataset"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}