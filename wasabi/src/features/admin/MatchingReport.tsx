import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Users, FileText, Target, TrendingUp } from 'lucide-react';
import type { MatchingReport } from '../../lib/studentMatcher';

interface MatchingReportProps {
  report: MatchingReport;
  datasetName: string;
  onClose?: () => void;
}

export default function MatchingReportComponent({ report, datasetName, onClose }: MatchingReportProps) {
  const getMatchRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600 dark:text-green-400';
    if (rate >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getMatchRateBgColor = (rate: number) => {
    if (rate >= 90) return 'bg-green-100 dark:bg-green-900/20';
    if (rate >= 70) return 'bg-yellow-100 dark:bg-yellow-900/20';
    return 'bg-red-100 dark:bg-red-900/20';
  };

  const getConfidenceIcon = (type: string) => {
    switch (type) {
      case 'high': return <CheckCircle className="text-green-500" size={16} />;
      case 'medium': return <Target className="text-yellow-500" size={16} />;
      case 'low': return <AlertTriangle className="text-orange-500" size={16} />;
      case 'uncertain': return <XCircle className="text-red-500" size={16} />;
      default: return null;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Matching Report: {datasetName}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Student data matching validation results
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XCircle size={24} />
          </button>
        )}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
          <Users className="mx-auto mb-2 text-blue-500" size={24} />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {report.totalStudentsInEnrollment}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Students</p>
        </div>

        <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
          <FileText className="mx-auto mb-2 text-purple-500" size={24} />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {report.totalRowsInDataset}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Dataset Rows</p>
        </div>

        <div className="text-center p-4 rounded-lg bg-gray-50 dark:bg-gray-700">
          <Target className="mx-auto mb-2 text-green-500" size={24} />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {report.matchedStudents}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Matched Students</p>
        </div>

        <div className={`text-center p-4 rounded-lg ${getMatchRateBgColor(report.matchRate)}`}>
          <TrendingUp className={`mx-auto mb-2 ${getMatchRateColor(report.matchRate)}`} size={24} />
          <p className={`text-2xl font-bold ${getMatchRateColor(report.matchRate)}`}>
            {report.matchRate}%
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Match Rate</p>
        </div>
      </div>

      {/* Match Rate Status */}
      <div className={`p-4 rounded-lg border-l-4 ${
        report.matchRate >= 90 
          ? 'border-green-500 bg-green-50 dark:bg-green-900/20' 
          : report.matchRate >= 70 
            ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
            : 'border-red-500 bg-red-50 dark:bg-red-900/20'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          {report.matchRate >= 90 ? (
            <CheckCircle className="text-green-600" size={20} />
          ) : report.matchRate >= 70 ? (
            <AlertTriangle className="text-yellow-600" size={20} />
          ) : (
            <XCircle className="text-red-600" size={20} />
          )}
          <h3 className={`font-semibold ${getMatchRateColor(report.matchRate)}`}>
            {report.matchRate >= 90 ? 'Excellent Match Rate' : 
             report.matchRate >= 70 ? 'Good Match Rate' : 'Low Match Rate'}
          </h3>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {report.matchRate >= 90 
            ? 'Most students were successfully matched. Data quality is excellent.'
            : report.matchRate >= 70 
              ? 'Good matching results. Review unmatched entries for potential issues.'
              : 'Many students could not be matched. Check data format and student names.'}
        </p>
      </div>

      {/* Confidence Breakdown */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Match Confidence Breakdown
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
            {getConfidenceIcon('high')}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {report.confidence.high}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">High (90-100%)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
            {getConfidenceIcon('medium')}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {report.confidence.medium}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Medium (70-89%)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20">
            {getConfidenceIcon('low')}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {report.confidence.low}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Low (50-69%)</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
            {getConfidenceIcon('uncertain')}
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">
                {report.confidence.uncertain}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Uncertain (&lt;50%)</p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Match Statistics */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Match Statistics</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Unmatched Rows:</span>
              <span className="text-gray-900 dark:text-gray-100">{report.unmatchedRows}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Duplicate Matches:</span>
              <span className="text-gray-900 dark:text-gray-100">{report.duplicateMatches}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Success Rate:</span>
              <span className={`font-medium ${getMatchRateColor(report.matchRate)}`}>
                {report.matchRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Unmatched Students */}
        {report.unmatchedStudentNames.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">
              Unmatched Students ({report.unmatchedStudentNames.length})
            </h4>
            <div className="max-h-32 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded p-3">
              <div className="space-y-1 text-sm">
                {report.unmatchedStudentNames.slice(0, 10).map((name, index) => (
                  <div key={index} className="text-gray-700 dark:text-gray-300">
                    {name}
                  </div>
                ))}
                {report.unmatchedStudentNames.length > 10 && (
                  <div className="text-gray-500 dark:text-gray-400 font-medium">
                    ... and {report.unmatchedStudentNames.length - 10} more
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {report.matchRate < 90 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
            Recommendations to Improve Matching
          </h4>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            {report.confidence.uncertain > 0 && (
              <li>• Check that student names are formatted correctly in the dataset</li>
            )}
            {report.unmatchedRows > 0 && (
              <li>• Verify that unmatched students exist in the enrollment file</li>
            )}
            {report.duplicateMatches > 0 && (
              <li>• Review duplicate matches - there may be students with similar names</li>
            )}
            <li>• Ensure grade levels and teacher names match between datasets</li>
          </ul>
        </div>
      )}
    </div>
  );
}