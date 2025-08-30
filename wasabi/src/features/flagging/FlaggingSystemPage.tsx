import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Trash2, 
  Users, 
  AlertTriangle, 
  Filter,
  Search,
  Flag,
  Eye,
  Settings,
  BookOpen,
  GraduationCap,
  Calendar,
  Target,
  TrendingUp,
  Calculator,
  FileText
} from 'lucide-react';
import { db } from '../../lib/db';
import { evaluateFlag } from '../../lib/flag-evaluator';
import type { FlagRule } from '../../lib/flag-evaluator';
import PageHeader from '../../shared/components/PageHeader';
import PageWrapper from '../../shared/components/PageWrapper';

interface FlaggedStudent {
  studentId: string;
  studentName: string;
  grade: string;
  className: string;
  flags: Array<{
    flagId: string;
    flagName: string;
    category: string;
    color: string;
    message: string;
  }>;
}

export default function FlaggingSystemPage() {
  const [activeTab, setActiveTab] = useState<'rules' | 'students'>('rules');
  const [showCreateFlag, setShowCreateFlag] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FlagRule | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Invalidate flag-related queries when component unmounts (leaving flagging system)
  React.useEffect(() => {
    return () => {
      // Cleanup function runs when component unmounts
      queryClient.invalidateQueries({ queryKey: ['flagged-students-for-search'] });
      queryClient.invalidateQueries({ queryKey: ['flagged-students-map'] });
      console.log('🔄 Refreshing flag data after leaving flagging system');
    };
  }, [queryClient]);

  // Get all flag rules
  const { data: flagRules = [] } = useQuery({
    queryKey: ['flag-rules'],
    queryFn: async (): Promise<FlagRule[]> => {
      // For now, we'll store flag rules in localStorage
      // In a real app, this would be in a database
      const stored = localStorage.getItem('wasabi-flag-rules');
      return stored ? JSON.parse(stored) : [];
    }
  });

  // Get flagged students
  const { data: flaggedStudents = [] } = useQuery({
    queryKey: ['flagged-students', flagRules],
    queryFn: async (): Promise<FlaggedStudent[]> => {
      console.log('🚩 Evaluating flag rules against student data...');
      
      const students = await db.students.toArray();
      const flaggedResults: FlaggedStudent[] = [];
      
      for (const student of students) {
        const studentFlags: FlaggedStudent['flags'] = [];
        
        // Check each active flag rule against this student
        for (const rule of flagRules.filter(r => r.isActive)) {
          // Check if student matches grade/class filters
          if (rule.filters) {
            if (rule.filters.grades && rule.filters.grades.length > 0) {
              if (!rule.filters.grades.includes(student.grade)) {
                continue; // Skip this rule for this student
              }
            }
            if (rule.filters.classes && rule.filters.classes.length > 0) {
              if (!rule.filters.classes.includes(student.className || '')) {
                continue; // Skip this rule for this student
              }
            }
          }
          
          const flagResult = await evaluateFlag(student, rule);
          if (flagResult.isFlagged) {
            // Determine color based on category
            const getColorForCategory = (category: string): string => {
              switch (category) {
                case 'attendance': return 'blue';
                case 'grades': return 'red';
                case 'discipline': return 'orange';
                case 'iready-reading': 
                case 'iready-math': return 'green';
                case 'fast-math':
                case 'fast-ela':
                case 'fast-science':
                case 'fast-writing': return 'yellow';
                default: return 'gray';
              }
            };

            studentFlags.push({
              flagId: rule.id,
              flagName: rule.name,
              category: rule.category,
              color: getColorForCategory(rule.category),
              message: flagResult.message
            });
          }
        }
        
        if (studentFlags.length > 0) {
          flaggedResults.push({
            studentId: student.id,
            studentName: `${student.firstName} ${student.lastName}`,
            grade: student.grade,
            className: student.className || 'Not assigned',
            flags: studentFlags
          });
        }
      }
      
      console.log(`🚩 Found ${flaggedResults.length} flagged students`);
      return flaggedResults;
    },
    enabled: flagRules.length > 0
  });

  // Mutation to save flag rules
  const saveRulesMutation = useMutation({
    mutationFn: async (rules: FlagRule[]) => {
      localStorage.setItem('wasabi-flag-rules', JSON.stringify(rules));
      return rules;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['flag-rules'] });
      queryClient.invalidateQueries({ queryKey: ['flagged-students'] });
    }
  });

  const addFlagRule = (rule: Omit<FlagRule, 'id' | 'createdAt'>) => {
    const newRule: FlagRule = {
      ...rule,
      id: `flag_${Date.now()}`,
      createdAt: new Date()
    };
    const updatedRules = [...flagRules, newRule];
    saveRulesMutation.mutate(updatedRules);
    setShowCreateFlag(false);
  };

  const updateFlagRule = (updatedRule: FlagRule) => {
    const updatedRules = flagRules.map(r => r.id === updatedRule.id ? updatedRule : r);
    saveRulesMutation.mutate(updatedRules);
    setEditingFlag(null);
  };

  const deleteFlagRule = (ruleId: string) => {
    const updatedRules = flagRules.filter(r => r.id !== ruleId);
    saveRulesMutation.mutate(updatedRules);
  };

  const toggleRuleActive = (ruleId: string) => {
    const updatedRules = flagRules.map(r => 
      r.id === ruleId ? { ...r, isActive: !r.isActive } : r
    );
    saveRulesMutation.mutate(updatedRules);
  };

  const categoryIcons = {
    attendance: Calendar,
    grades: GraduationCap,
    discipline: AlertTriangle,
    'iready-reading': BookOpen,
    'iready-math': Calculator,
    'fast-math': Target,
    'fast-ela': FileText,
    'fast-science': Users,
    'fast-writing': Settings
  };

  const categoryColors = {
    attendance: 'bg-green-100 text-green-800 border-green-300',
    grades: 'bg-blue-100 text-blue-800 border-blue-300',
    discipline: 'bg-red-100 text-red-800 border-red-300',
    'iready-reading': 'bg-purple-100 text-purple-800 border-purple-300',
    'iready-math': 'bg-indigo-100 text-indigo-800 border-indigo-300',
    'fast-math': 'bg-orange-100 text-orange-800 border-orange-300',
    'fast-ela': 'bg-yellow-100 text-yellow-800 border-yellow-300',
    'fast-science': 'bg-teal-100 text-teal-800 border-teal-300',
    'fast-writing': 'bg-pink-100 text-pink-800 border-pink-300'
  };

  const filteredRules = flagRules.filter(rule => {
    const matchesCategory = filterCategory === 'all' || rule.category === filterCategory;
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredStudents = flaggedStudents.filter(student => {
    const matchesCategory = filterCategory === 'all' || 
                           student.flags.some(f => f.category === filterCategory);
    const matchesSearch = student.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         student.className.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <PageWrapper>
      <PageHeader
        title="Student Flagging System" 
        description="Create automated rules to identify students who need attention or intervention"
        icon={Flag}
        iconColor="text-red-500"
      >
        {/* Tab Navigation */}
        <div className="flex bg-gray-100 dark:bg-gray-700 rounded-xl p-1">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'rules'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Settings className="h-4 w-4 mr-2 inline" />
            Flag Rules ({flagRules.length})
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'students'
                ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            <Users className="h-4 w-4 mr-2 inline" />
            Flagged Students ({flaggedStudents.length})
          </button>
        </div>
      </PageHeader>
      
      <div className="p-6 space-y-6">
        {/* Search and Filters */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeTab === 'rules' ? 'flag rules' : 'students'}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 py-2 w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Categories</option>
              <option value="attendance">Attendance</option>
              <option value="grades">GPA</option>
              <option value="iready-reading">iReady Reading</option>
              <option value="iready-math">iReady Math</option>
              <option value="fast-math">FAST Math</option>
              <option value="fast-ela">FAST ELA</option>
              <option value="fast-science">FAST Science</option>
              <option value="fast-writing">FAST Writing</option>
              <option value="discipline">Discipline</option>
            </select>
          </div>
          {activeTab === 'rules' && (
            <button
              onClick={() => setShowCreateFlag(true)}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create Flag
            </button>
          )}
        </div>
      </div>

      {activeTab === 'rules' ? (
        /* Flag Rules Tab */
        <div className="space-y-4">
          {filteredRules.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 shadow rounded-xl p-12 text-center">
              <Flag className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No Flag Rules</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Create your first flag rule to automatically identify students who need attention.
              </p>
              <button
                onClick={() => setShowCreateFlag(true)}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md font-medium mt-4"
              >
                <Plus className="h-4 w-4 mr-2 inline" />
                Create First Flag
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredRules.map((rule) => {
                const CategoryIcon = categoryIcons[rule.category];
                return (
                  <div key={rule.id} className="bg-white dark:bg-gray-800 shadow rounded-xl p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CategoryIcon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <div className={`w-4 h-4 rounded-full ${
                            rule.color === 'red' ? 'bg-red-500' :
                            rule.color === 'orange' ? 'bg-orange-500' :
                            rule.color === 'yellow' ? 'bg-yellow-500' :
                            rule.color === 'green' ? 'bg-green-500' :
                            rule.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'
                          }`} title={`Flag Color: ${rule.color}`} />
                          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                            {rule.name}
                          </h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${categoryColors[rule.category]}`}>
                            {rule.category.toUpperCase()}
                          </span>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            rule.isActive 
                              ? 'bg-green-100 text-green-800 border-green-300' 
                              : 'bg-gray-100 text-gray-800 border-gray-300'
                          }`}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                          {rule.description}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-500">
                          Created {new Date(rule.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingFlag(rule)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleRuleActive(rule.id)}
                          className={`px-3 py-1 rounded-md text-sm font-medium ${
                            rule.isActive
                              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          {rule.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteFlagRule(rule.id)}
                          className="text-red-600 hover:text-red-700 p-2 rounded-md hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Flagged Students Tab */
        <div className="bg-white dark:bg-gray-800 shadow rounded-xl">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No Flagged Students</h3>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                No students currently match your active flag criteria.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Grade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Class
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Flags
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredStudents.map((student) => (
                    <tr key={student.studentId} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {student.studentName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        Grade {student.grade}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {student.className}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {student.flags.map((flag, index) => (
                            <span
                              key={index}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${categoryColors[flag.category as keyof typeof categoryColors]}`}
                              title={flag.message}
                            >
                              {flag.flagName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            // Navigate to student profile and trigger search
                            navigate(`/?search=${encodeURIComponent(student.studentName)}`);
                          }}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Eye className="h-4 w-4 mr-1 inline" />
                          View Profile
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Flag Modal */}
      {showCreateFlag && (
        <CreateFlagModal
          onSave={addFlagRule}
          onCancel={() => setShowCreateFlag(false)}
        />
      )}
      
      {/* Edit Flag Modal */}
      {editingFlag && (
        <CreateFlagModal
          editingRule={editingFlag}
          onSave={updateFlagRule}
          onCancel={() => setEditingFlag(null)}
        />
      )}
      </div>
    </PageWrapper>
  );
}


// Create Flag Modal Component
interface CreateFlagModalProps {
  editingRule?: FlagRule;
  onSave: (rule: Omit<FlagRule, 'id' | 'createdAt'> | FlagRule) => void;
  onCancel: () => void;
}

function CreateFlagModal({ editingRule, onSave, onCancel }: CreateFlagModalProps) {
  const [formData, setFormData] = useState({
    name: editingRule?.name || '',
    category: editingRule?.category || 'attendance' as FlagRule['category'],
    color: editingRule?.color || 'red' as FlagRule['color'],
    criteria: {
      type: editingRule?.criteria.type || '',
      threshold: editingRule?.criteria.threshold?.toString() || '',
      condition: editingRule?.criteria.condition || 'below' as 'above' | 'below' | 'equals'
    },
    filters: {
      grades: editingRule?.filters?.grades || [] as string[],
      classes: editingRule?.filters?.classes || [] as string[]
    },
    description: editingRule?.description || '',
    isActive: editingRule?.isActive ?? true
  });

  // Define category-specific parameter suggestions
  const categoryParameters = {
    attendance: {
      defaultCondition: 'below' as const,
      thresholdLabel: 'Attendance Rate (%)',
      thresholdPlaceholder: '85',
      thresholdMin: 0,
      thresholdMax: 100,
      thresholdStep: 1,
      suggestions: [
        { label: 'Chronic Absenteeism', condition: 'below', value: 90 },
        { label: 'Severe Absenteeism', condition: 'below', value: 80 },
        { label: 'Perfect Attendance', condition: 'equals', value: 100 },
      ],
      helpText: 'Set attendance rate threshold (0-100%). Students are flagged when their attendance falls below this percentage.',
    },
    grades: {
      defaultCondition: 'below' as const,
      thresholdLabel: 'GPA Score',
      thresholdPlaceholder: '2.5',
      thresholdMin: 0,
      thresholdMax: 4.0,
      thresholdStep: 0.1,
      suggestions: [
        { label: 'Academic Probation', condition: 'below', value: 2.0 },
        { label: 'At Risk', condition: 'below', value: 2.5 },
        { label: 'Honor Roll', condition: 'above', value: 3.5 },
      ],
      helpText: 'Set GPA threshold (0.0-4.0). Flag students based on their grade point average.',
    },
    discipline: {
      defaultCondition: 'above' as const,
      thresholdLabel: 'Number of Incidents',
      thresholdPlaceholder: '3',
      thresholdMin: 0,
      thresholdMax: 50,
      thresholdStep: 1,
      suggestions: [
        { label: 'Any Incident', condition: 'above', value: 0 },
        { label: 'Multiple Incidents', condition: 'above', value: 2 },
        { label: 'Severe Pattern', condition: 'above', value: 5 },
      ],
      helpText: 'Set the number of discipline incidents. Flag students who exceed this count.',
    },
    'iready-reading': {
      defaultCondition: 'below' as const,
      thresholdLabel: 'Scale Score',
      thresholdPlaceholder: '450',
      thresholdMin: 100,
      thresholdMax: 800,
      thresholdStep: 1,
      suggestions: [
        { label: '2+ Grades Below', condition: 'below', value: 400 },
        { label: '1 Grade Below', condition: 'below', value: 450 },
        { label: 'On Grade Level', condition: 'below', value: 500 },
      ],
      helpText: 'Set iReady Reading scale score (100-800). Lower scores indicate students needing intervention.',
    },
    'iready-math': {
      defaultCondition: 'below' as const,
      thresholdLabel: 'Scale Score',
      thresholdPlaceholder: '450',
      thresholdMin: 100,
      thresholdMax: 800,
      thresholdStep: 1,
      suggestions: [
        { label: '2+ Grades Below', condition: 'below', value: 400 },
        { label: '1 Grade Below', condition: 'below', value: 450 },
        { label: 'On Grade Level', condition: 'below', value: 500 },
      ],
      helpText: 'Set iReady Math scale score (100-800). Lower scores indicate students needing intervention.',
    },
    'fast-math': {
      defaultCondition: 'below' as const,
      thresholdLabel: 'Achievement Level',
      thresholdPlaceholder: '3',
      thresholdMin: 1,
      thresholdMax: 5,
      thresholdStep: 1,
      suggestions: [
        { label: 'Level 1 (Inadequate)', condition: 'equals', value: 1 },
        { label: 'Below Satisfactory', condition: 'below', value: 3 },
        { label: 'Proficient or Above', condition: 'above', value: 3 },
      ],
      helpText: 'Set FAST Math achievement level (1-5). Level 3 is satisfactory, levels 4-5 are proficient/mastery.',
    },
    'fast-ela': {
      defaultCondition: 'below' as const,
      thresholdLabel: 'Achievement Level',
      thresholdPlaceholder: '3',
      thresholdMin: 1,
      thresholdMax: 5,
      thresholdStep: 1,
      suggestions: [
        { label: 'Level 1 (Inadequate)', condition: 'equals', value: 1 },
        { label: 'Below Satisfactory', condition: 'below', value: 3 },
        { label: 'Proficient or Above', condition: 'above', value: 3 },
      ],
      helpText: 'Set FAST ELA achievement level (1-5). Level 3 is satisfactory, levels 4-5 are proficient/mastery.',
    },
    'fast-science': {
      defaultCondition: 'below' as const,
      thresholdLabel: 'Achievement Level',
      thresholdPlaceholder: '3',
      thresholdMin: 1,
      thresholdMax: 5,
      thresholdStep: 1,
      suggestions: [
        { label: 'Level 1 (Inadequate)', condition: 'equals', value: 1 },
        { label: 'Below Satisfactory', condition: 'below', value: 3 },
        { label: 'Proficient or Above', condition: 'above', value: 3 },
      ],
      helpText: 'Set FAST Science achievement level (1-5). Level 3 is satisfactory, levels 4-5 are proficient/mastery.',
    },
    'fast-writing': {
      defaultCondition: 'below' as const,
      thresholdLabel: 'Achievement Level',
      thresholdPlaceholder: '3',
      thresholdMin: 1,
      thresholdMax: 5,
      thresholdStep: 1,
      suggestions: [
        { label: 'Level 1 (Inadequate)', condition: 'equals', value: 1 },
        { label: 'Below Satisfactory', condition: 'below', value: 3 },
        { label: 'Proficient or Above', condition: 'above', value: 3 },
      ],
      helpText: 'Set FAST Writing achievement level (1-5). Level 3 is satisfactory, levels 4-5 are proficient/mastery.',
    },
  };

  const currentCategoryParams = categoryParameters[formData.category] || categoryParameters.attendance;

  // Auto-generate description based on form data
  const generateDescription = () => {
    if (!formData.criteria.threshold || !formData.category) return '';
    
    const categoryLabels = {
      attendance: 'Attendance',
      grades: 'GPA',
      discipline: 'Discipline Records',
      'iready-reading': 'iReady Reading',
      'iready-math': 'iReady Math',
      'fast-math': 'FAST Math',
      'fast-ela': 'FAST ELA',
      'fast-science': 'FAST Science',
      'fast-writing': 'FAST Writing',
    };
    
    const categoryLabel = categoryLabels[formData.category];
    const condition = formData.criteria.condition;
    const threshold = formData.criteria.threshold;
    
    return `Flag students when ${categoryLabel} is ${condition} ${threshold}${formData.category === 'attendance' ? '%' : ''}. This rule helps identify students who may need additional support or intervention.`;
  };

  // Get available grades and classes for filtering options
  const { data: availableGrades = [] } = useQuery({
    queryKey: ['available-grades'],
    queryFn: async () => {
      const students = await db.students.toArray();
      return [...new Set(students.map(s => s.grade).filter(Boolean))].sort();
    }
  });

  const { data: availableClasses = [] } = useQuery({
    queryKey: ['available-classes'],
    queryFn: async () => {
      const students = await db.students.toArray();
      return [...new Set(students.map(s => s.className).filter(Boolean))].sort();
    }
  });

  // Handle ESC key to close modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  // Set default values when component mounts or when editing rule changes
  React.useEffect(() => {
    if (!editingRule) {
      // Only set defaults for new rules, not when editing
      const params = categoryParameters[formData.category] || categoryParameters.attendance;
      setFormData(prev => ({
        ...prev,
        criteria: {
          ...prev.criteria,
          condition: params.defaultCondition,
          threshold: params.thresholdPlaceholder
        }
      }));
    }
  }, [editingRule, formData.category]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.criteria.threshold) return;

    const ruleData = {
      ...formData,
      criteria: {
        ...formData.criteria,
        threshold: Number(formData.criteria.threshold)
      }
    };

    if (editingRule) {
      // Update existing rule
      onSave({
        ...ruleData,
        id: editingRule.id,
        createdAt: editingRule.createdAt
      } as FlagRule);
    } else {
      // Create new rule
      onSave(ruleData);
    }
    
    // Close the modal after successful save
    onCancel();
  };

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-8 py-6 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {editingRule ? 'Edit Flag Rule' : 'Create New Flag Rule'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {editingRule ? 'Update automated flagging rule' : 'Set up automated flagging for student intervention and support'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Flag className="w-6 h-6 text-wasabi-green" />
            </div>
          </div>
        </div>
        
        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Flag Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-3 px-4 focus:ring-2 focus:ring-wasabi-green focus:border-transparent"
                  placeholder="e.g., Low Attendance Warning"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Flag Color
                </label>
                <div className="flex gap-3">
                  {(['red', 'orange', 'yellow', 'green', 'blue'] as const).map((color) => {
                    const colorStyles = {
                      red: 'bg-red-500 border-red-600 hover:bg-red-600',
                      orange: 'bg-orange-500 border-orange-600 hover:bg-orange-600', 
                      yellow: 'bg-yellow-500 border-yellow-600 hover:bg-yellow-600',
                      green: 'bg-green-500 border-green-600 hover:bg-green-600',
                      blue: 'bg-blue-500 border-blue-600 hover:bg-blue-600'
                    };
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormData({ ...formData, color })}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${colorStyles[color]} ${
                          formData.color === color 
                            ? 'ring-4 ring-gray-300 dark:ring-gray-500 scale-110' 
                            : 'hover:scale-105'
                        }`}
                        title={color.charAt(0).toUpperCase() + color.slice(1)}
                      />
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Selected: {formData.color.charAt(0).toUpperCase() + formData.color.slice(1)}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Data Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => {
                  const newCategory = e.target.value as FlagRule['category'];
                  const params = categoryParameters[newCategory];
                  setFormData({ 
                    ...formData, 
                    category: newCategory,
                    criteria: {
                      ...formData.criteria,
                      condition: params.defaultCondition,
                      threshold: params.thresholdPlaceholder
                    }
                  });
                }}
                className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-3 px-4 focus:ring-2 focus:ring-wasabi-green focus:border-transparent"
              >
                <option value="attendance">Attendance</option>
                <option value="grades">Grades (GPA)</option>
                <option value="discipline">Discipline Records</option>
                <option value="iready-reading">iReady Reading</option>
                <option value="iready-math">iReady Math</option>
                <option value="fast-math">FAST Math</option>
                <option value="fast-ela">FAST ELA</option>
                <option value="fast-science">FAST Science</option>
                <option value="fast-writing">FAST Writing</option>
              </select>
            </div>

            {/* Parameter Help Text */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                    <Settings className="w-3 h-3 text-blue-600 dark:text-blue-200" />
                  </div>
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                  {currentCategoryParams.helpText}
                </p>
              </div>
            </div>

            {/* Quick Suggestion Buttons */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Quick Presets
              </label>
              <div className="flex flex-wrap gap-2">
                {currentCategoryParams.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      criteria: {
                        ...formData.criteria,
                        condition: suggestion.condition,
                        threshold: suggestion.value.toString()
                      },
                      name: formData.name || suggestion.label
                    })}
                    className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Condition
                </label>
                <select
                  value={formData.criteria.condition}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    criteria: { ...formData.criteria, condition: e.target.value as 'above' | 'below' | 'equals' }
                  })}
                  className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-3 px-4 focus:ring-2 focus:ring-wasabi-green focus:border-transparent"
                >
                  <option value="below">Below</option>
                  <option value="above">Above</option>
                  <option value="equals">Equals</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {currentCategoryParams.thresholdLabel}
                </label>
                <input
                  type="number"
                  value={formData.criteria.threshold}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    criteria: { ...formData.criteria, threshold: e.target.value }
                  })}
                  className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-3 px-4 focus:ring-2 focus:ring-wasabi-green focus:border-transparent"
                  placeholder={currentCategoryParams.thresholdPlaceholder}
                  min={currentCategoryParams.thresholdMin}
                  max={currentCategoryParams.thresholdMax}
                  step={currentCategoryParams.thresholdStep}
                  required
                />
              </div>
            </div>

            {/* Filters Section */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-4">
                Apply to Specific Students (Optional)
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Grade Levels
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border-2 border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.filters.grades.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ 
                              ...formData, 
                              filters: { ...formData.filters, grades: [] }
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">All Grades</span>
                    </label>
                    {availableGrades.map(grade => (
                      <label key={grade} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.filters.grades.includes(grade)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ 
                                ...formData, 
                                filters: { 
                                  ...formData.filters, 
                                  grades: [...formData.filters.grades, grade]
                                }
                              });
                            } else {
                              setFormData({ 
                                ...formData, 
                                filters: { 
                                  ...formData.filters, 
                                  grades: formData.filters.grades.filter(g => g !== grade)
                                }
                              });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">Grade {grade}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Classes
                  </label>
                  <div className="space-y-2 max-h-32 overflow-y-auto border-2 border-gray-300 dark:border-gray-600 rounded-xl p-3 bg-gray-50 dark:bg-gray-700">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.filters.classes.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ 
                              ...formData, 
                              filters: { ...formData.filters, classes: [] }
                            });
                          }
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">All Classes</span>
                    </label>
                    {availableClasses.map(className => (
                      <label key={className} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.filters.classes.includes(className)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({ 
                                ...formData, 
                                filters: { 
                                  ...formData.filters, 
                                  classes: [...formData.filters.classes, className]
                                }
                              });
                            } else {
                              setFormData({ 
                                ...formData, 
                                filters: { 
                                  ...formData.filters, 
                                  classes: formData.filters.classes.filter(c => c !== className)
                                }
                              });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{className}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Description
                </label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, description: generateDescription() })}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-md transition-colors"
                >
                  Auto-generate
                </button>
              </div>
              <textarea
                value={formData.description || generateDescription()}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 py-3 px-4 focus:ring-2 focus:ring-wasabi-green focus:border-transparent"
                rows={3}
                placeholder={generateDescription()}
              />
            </div>

            <div className="flex justify-end gap-4 pt-6 border-t border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={onCancel}
                className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-500 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 bg-wasabi-green text-white rounded-xl hover:bg-wasabi-green/90 font-medium transition-colors flex items-center gap-2"
              >
                <Flag className="w-4 h-4" />
                {editingRule ? 'Update Flag Rule' : 'Create Flag Rule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}