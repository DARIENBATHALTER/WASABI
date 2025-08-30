import { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { db } from '../../lib/db';
import { showToast } from '../../shared/components/Toast';

export default function ClearDatabase() {
  const [isClearing, setIsClearing] = useState(false);
  const queryClient = useQueryClient();

  const handleClearDatabase = async () => {
    if (!confirm('Are you sure you want to clear ALL data? This will delete everything including students, assessments, attendance, grades, and data sources. This action cannot be undone.')) {
      return;
    }

    if (!confirm('This is your final warning. ALL DATA WILL BE PERMANENTLY DELETED. Are you absolutely sure?')) {
      return;
    }

    setIsClearing(true);

    try {
      await db.transaction('rw', [db.students, db.assessments, db.attendance, db.grades, db.dataSources], async () => {
        await db.students.clear();
        await db.assessments.clear();
        await db.attendance.clear();
        await db.grades.clear();
        await db.dataSources.clear();
      });

      showToast({
        type: 'success',
        title: 'Database Cleared',
        message: 'All data has been permanently deleted.',
        duration: 5000,
      });

      // Invalidate all queries to refresh UI
      await queryClient.invalidateQueries();

    } catch (error) {
      console.error('Error clearing database:', error);
      showToast({
        type: 'error',
        title: 'Clear Failed',
        message: error instanceof Error ? error.message : 'Failed to clear database',
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="card border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20">
      <div className="flex items-start space-x-3">
        <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
        <div className="flex-1">
          <h3 className="font-semibold text-red-800 dark:text-red-200">
            Clear All Data
          </h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">
            Permanently delete all students, assessments, attendance, grades, and data sources from the local database.
          </p>
          <div className="mt-4">
            <button
              onClick={handleClearDatabase}
              disabled={isClearing}
              className="
                flex items-center space-x-2 px-4 py-2 
                bg-red-600 text-white rounded-lg
                hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              <Trash2 size={16} />
              <span>{isClearing ? 'Clearing...' : 'Clear All Data'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}