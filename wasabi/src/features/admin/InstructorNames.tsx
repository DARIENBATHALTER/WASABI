import { useState, useEffect } from 'react';
import { Edit3, Save, X, Plus, AlertCircle } from 'lucide-react';
import { db } from '../../lib/db';
import { instructorNameMappingService } from '../../services/instructorNameMapping';
import { useInstructorNames } from '../../contexts/InstructorNameContext';
import type { Student } from '../../shared/types';

interface InstructorMapping {
  originalName: string;
  displayName: string;
  studentCount: number;
}

export default function InstructorNames() {
  const [instructors, setInstructors] = useState<InstructorMapping[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const { reloadMappings } = useInstructorNames();

  useEffect(() => {
    loadInstructors();
  }, []);

  const loadInstructors = async () => {
    try {
      setLoading(true);
      const students = await db.students.toArray();
      
      // Get all unique instructor names with student counts
      const instructorCounts = new Map<string, number>();
      students.forEach(student => {
        // Check both homeRoomTeacher and className fields (enrollment data may use either)
        const teacherName = student.homeRoomTeacher || student.className;
        if (teacherName) {
          instructorCounts.set(
            teacherName,
            (instructorCounts.get(teacherName) || 0) + 1
          );
        }
      });

      // Load any existing mappings from the service
      const mappings = await instructorNameMappingService.loadMappings();
      
      const instructorList: InstructorMapping[] = Array.from(instructorCounts.entries())
        .map(([name, count]) => ({
          originalName: name,
          displayName: mappings[name] || name,
          studentCount: count
        }))
        .sort((a, b) => a.originalName.localeCompare(b.originalName));

      setInstructors(instructorList);
    } catch (error) {
      console.error('Error loading instructors:', error);
    } finally {
      setLoading(false);
    }
  };


  const saveInstructorMappings = async (mappings: Record<string, string>) => {
    try {
      console.log('🔄 Saving instructor mappings:', mappings);
      await instructorNameMappingService.saveMappings(mappings);
      console.log('✅ Mappings saved successfully');
      
      // Trigger global context reload
      await reloadMappings();
      console.log('✅ Context reloaded');
    } catch (error) {
      console.error('❌ Error saving instructor mappings:', error);
      throw error;
    }
  };

  const handleEdit = (originalName: string, currentDisplayName: string) => {
    setEditingId(originalName);
    setEditValue(currentDisplayName);
  };

  const handleSave = async (originalName: string) => {
    if (editValue.trim() === '') {
      console.warn('❌ Cannot save empty instructor name');
      return;
    }

    try {
      console.log('🔄 Starting save for:', originalName, '→', editValue.trim());
      setSaving(originalName);
      
      // Load current mappings from service
      const currentMappings = await instructorNameMappingService.loadMappings();
      console.log('📋 Current mappings loaded:', currentMappings);
      
      // Update mapping
      const updatedMappings = {
        ...currentMappings,
        [originalName]: editValue.trim()
      };
      console.log('📝 Updated mappings:', updatedMappings);
      
      // Save to database
      await saveInstructorMappings(updatedMappings);
      
      // Update local state
      setInstructors(prev => prev.map(inst => 
        inst.originalName === originalName 
          ? { ...inst, displayName: editValue.trim() }
          : inst
      ));
      
      setEditingId(null);
      setEditValue('');
      console.log('✅ Save completed successfully');
    } catch (error) {
      console.error('❌ Error saving instructor name:', error);
    } finally {
      setSaving(null);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleReset = async (originalName: string) => {
    try {
      setSaving(originalName);
      
      // Load current mappings from service
      const currentMappings = await instructorNameMappingService.loadMappings();
      
      // Remove mapping (reset to original)
      const updatedMappings = { ...currentMappings };
      delete updatedMappings[originalName];
      
      // Save to database
      await saveInstructorMappings(updatedMappings);
      
      // Update local state
      setInstructors(prev => prev.map(inst => 
        inst.originalName === originalName 
          ? { ...inst, displayName: originalName }
          : inst
      ));
    } catch (error) {
      console.error('Error resetting instructor name:', error);
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h3 className="font-medium text-blue-900 dark:text-blue-100">Instructor Name Mapping</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Map original instructor names from enrollment data to display names that appear throughout the system.
              This affects search results, profile cards, SOBA observations, and analytics views.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Instructor Names ({instructors.length})
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Edit display names for instructors found in your enrollment data
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Original Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Display Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Students
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {instructors.map((instructor) => (
                <tr key={instructor.originalName} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {instructor.originalName}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === instructor.originalName ? (
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-wasabi-green focus:border-wasabi-green bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                          placeholder="Display name..."
                          autoFocus
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleSave(instructor.originalName);
                            } else if (e.key === 'Escape') {
                              handleCancel();
                            }
                          }}
                        />
                        <button
                          onClick={() => handleSave(instructor.originalName)}
                          disabled={saving === instructor.originalName || editValue.trim() === ''}
                          className="p-2 text-green-600 hover:text-green-800 disabled:opacity-50"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={handleCancel}
                          disabled={saving === instructor.originalName}
                          className="p-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span className={`text-sm ${
                          instructor.displayName !== instructor.originalName 
                            ? 'text-blue-600 dark:text-blue-400 font-medium' 
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {instructor.displayName}
                        </span>
                        {instructor.displayName !== instructor.originalName && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
                            (mapped)
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {instructor.studentCount} student{instructor.studentCount !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingId === instructor.originalName ? null : (
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(instructor.originalName, instructor.displayName)}
                          className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          <Edit3 size={16} />
                        </button>
                        {instructor.displayName !== instructor.originalName && (
                          <button
                            onClick={() => handleReset(instructor.originalName)}
                            disabled={saving === instructor.originalName}
                            className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                            title="Reset to original name"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {instructors.length === 0 && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <div className="text-lg font-medium mb-2">No instructors found</div>
            <div className="text-sm">Import enrollment data to see instructor names</div>
          </div>
        )}
      </div>
    </div>
  );
}