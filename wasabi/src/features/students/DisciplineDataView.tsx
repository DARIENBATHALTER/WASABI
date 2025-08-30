import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Calendar, MapPin, User, FileText, Clock, Shield } from 'lucide-react';
import { db } from '../../lib/db';
import { queryByStudentId } from '../../utils/studentIdQuery';
import type { DisciplineRecord } from '../../shared/types';

interface DisciplineDataViewProps {
  studentId: number;
}

export default function DisciplineDataView({ studentId }: DisciplineDataViewProps) {
  const { data: disciplineRecords = [], isLoading, error } = useQuery({
    queryKey: ['discipline', studentId],
    queryFn: async () => {
      console.log(`📋 Fetching discipline records for student: ${studentId}`);
      const records = await queryByStudentId(db.discipline, studentId);
      
      // Sort by incident date, most recent first
      records.sort((a, b) => new Date(b.incidentDate).getTime() - new Date(a.incidentDate).getTime());
      
      console.log(`📋 Found ${records.length} discipline records`);
      return records;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-wasabi-green"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading discipline data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-600 dark:text-red-400">
        <AlertTriangle className="h-5 w-5 mx-auto mb-2" />
        <p>Failed to load discipline data</p>
      </div>
    );
  }

  if (disciplineRecords.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <Shield className="h-8 w-8 mx-auto mb-2 text-green-500" />
        <p>No discipline records found</p>
        <p className="text-sm">This student has a clean disciplinary record.</p>
      </div>
    );
  }

  const getSeverityColor = (infractionCode: string) => {
    const code = parseInt(infractionCode, 10);
    if (code >= 300) return 'text-red-700 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
    if (code >= 200) return 'text-orange-700 bg-orange-100 border-orange-300 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
    return 'text-yellow-700 bg-yellow-100 border-yellow-300 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
  };

  const getSeverityLabel = (infractionCode: string) => {
    const code = parseInt(infractionCode, 10);
    if (code >= 300) return 'Level 3-4 (Severe)';
    if (code >= 200) return 'Level 2 (Moderate)';
    return 'Level 1 (Minor)';
  };

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const getActionColor = (action: string) => {
    const actionLower = action.toLowerCase();
    if (actionLower.includes('out-of-school') || actionLower.includes('suspension') || actionLower.includes('expulsion')) {
      return 'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
    }
    if (actionLower.includes('in-school') || actionLower.includes('detention')) {
      return 'text-orange-700 bg-orange-100 dark:text-orange-400 dark:bg-orange-900/20';
    }
    return 'text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20';
  };

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {disciplineRecords.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Incidents
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {disciplineRecords.filter(r => parseInt(r.infractionCode, 10) >= 200).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Major Infractions
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {disciplineRecords.filter(r => 
                r.suspensionType === 'out-of-school' || 
                (r.action && r.action.toLowerCase().includes('out-of-school'))
              ).length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Suspensions
            </div>
          </div>
        </div>
      </div>

      {/* Discipline Records */}
      <div className="space-y-3">
        {disciplineRecords.map((record, index) => (
          <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 space-y-3">
            {/* Header with date and severity */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatDate(record.incidentDate)}
                </span>
                <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(record.infractionCode)}`}>
                  {getSeverityLabel(record.infractionCode)}
                </span>
              </div>
              {record.actionDays && (
                <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4" />
                  <span>{record.actionDays} day{record.actionDays !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Infraction */}
            <div>
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {record.infractionCode}: {record.infraction}
              </div>
            </div>

            {/* Key Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {record.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">Location:</span>
                  <span className="text-gray-900 dark:text-gray-100">{record.location}</span>
                </div>
              )}
              {record.reporter && (
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-400">Reporter:</span>
                  <span className="text-gray-900 dark:text-gray-100">{record.reporter}</span>
                </div>
              )}
            </div>

            {/* Action Taken */}
            {record.action && (
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5" />
                <div className="flex-1">
                  <span className="text-gray-600 dark:text-gray-400 text-sm">Action:</span>
                  <div className={`inline-block ml-2 px-2 py-1 rounded text-sm ${getActionColor(record.action)}`}>
                    {record.action}
                  </div>
                </div>
              </div>
            )}

            {/* Narrative */}
            {record.narrative && record.narrative.trim() && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-3">
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                      Incident Description:
                    </div>
                    <div className="text-sm text-gray-800 dark:text-gray-200">
                      {record.narrative}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Special Flags */}
            <div className="flex flex-wrap gap-2">
              {record.bullying && (
                <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-xs rounded-full">
                  Bullying
                </span>
              )}
              {record.gangRelated && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 text-xs rounded-full">
                  Gang Related
                </span>
              )}
              {record.weaponUse && (
                <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-xs rounded-full">
                  Weapon
                </span>
              )}
              {record.drugUse && (
                <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-xs rounded-full">
                  Drugs
                </span>
              )}
              {record.alcoholUse && (
                <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-xs rounded-full">
                  Alcohol
                </span>
              )}
              {record.hateCrime && (
                <span className="px-2 py-1 bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400 text-xs rounded-full">
                  Hate Crime
                </span>
              )}
            </div>

            {/* Administrative Summary */}
            {record.adminSummary && record.adminSummary.trim() && (
              <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
                <div className="text-sm">
                  <span className="font-medium text-gray-600 dark:text-gray-400">Admin Summary:</span>
                  <div className="text-gray-800 dark:text-gray-200 mt-1">
                    {record.adminSummary}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}