import { X, Users, UserCheck, ChevronDown, ChevronUp, ArrowUpDown, Flag, Search, Filter, Check } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStudentSearch, type SortField, type SortDirection } from '../../hooks/useStudentSearch';
import StudentAvatar from '../../shared/components/StudentAvatar';
import InstructorName from '../../shared/components/InstructorName';
import { useInstructorDisplayNames } from '../../contexts/InstructorNameContext';
import { useStore } from '../../store';
import { useState, useEffect, useRef } from 'react';
import type { StudentSearchResult } from '../../hooks/useStudentSearch';
import PageHeader from '../../shared/components/PageHeader';
import PageWrapper from '../../shared/components/PageWrapper';
import { evaluateFlag } from '../../lib/flag-evaluator';

interface StudentSearchResultsProps {
  searchQuery: string;
  onStudentSelect?: (student: StudentSearchResult) => void;
  onViewProfiles?: (students: StudentSearchResult[]) => void;
}

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

export default function StudentSearchResults({ 
  searchQuery, 
  onStudentSelect,
  onViewProfiles 
}: StudentSearchResultsProps) {
  const { studentSelectHandler, viewProfilesHandler } = useStore();
  const [sortField, setSortField] = useState<SortField>('grade');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Filter states
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [genderFilter, setGenderFilter] = useState<string[]>([]);
  const [homeroomFilter, setHomeroomFilter] = useState<string[]>([]);
  
  // Dropdown states
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [genderDropdownOpen, setGenderDropdownOpen] = useState(false);
  const [homeroomDropdownOpen, setHomeroomDropdownOpen] = useState(false);
  
  // Refs for dropdown click outside handling
  const gradeDropdownRef = useRef<HTMLDivElement>(null);
  const genderDropdownRef = useRef<HTMLDivElement>(null);
  const homeroomDropdownRef = useRef<HTMLDivElement>(null);
  
  const { 
    searchResults, 
    selectedStudentIds, 
    selectedStudents,
    isLoading,
    totalStudents,
    totalResults,
    hasMore,
    toggleStudentSelection,
    selectAllVisible,
    clearSelection,
    loadMore
  } = useStudentSearch(searchQuery, 50, sortField, sortDirection);
  
  // Query to get all available filter options from the database
  const { data: filterOptions } = useQuery({
    queryKey: ['filter-options'],
    queryFn: async () => {
      const { db } = await import('../../lib/db');
      const allStudents = await db.students.toArray();
      
      const grades = [...new Set(allStudents.map(s => s.grade?.toString()).filter(Boolean))].sort();
      const genders = [...new Set(allStudents.map(s => s.gender).filter(Boolean))];
      const originalHomerooms = [...new Set(allStudents.map(s => s.className).filter(Boolean))].sort();
      
      return { grades, genders, homerooms: originalHomerooms };
    },
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
  
  // Get mapped homeroom names for the filter dropdown
  const mappedHomeroomNames = useInstructorDisplayNames(filterOptions?.homerooms || []);
  
  // Get flagged students with their flag information
  const { data: flaggedStudentData = new Map() } = useQuery({
    queryKey: ['flagged-students-for-search', searchResults.map(s => s.id)],
    queryFn: async () => {
      const flagRulesData = localStorage.getItem('wasabi-flag-rules');
      if (!flagRulesData) return new Map();
      
      const flagRules = JSON.parse(flagRulesData).filter((rule: any) => rule.isActive);
      if (flagRules.length === 0) return new Map();
      
      const flaggedData = new Map<string, { flagNames: string[], messages: string[], colors: string[] }>();
      
      // Import the db and evaluation logic
      const { db } = await import('../../lib/db');
      
      // Check each student in search results against active flag rules
      // First, get all students from database to get full student records
      const allStudents = await db.students.toArray();
      const studentMap = new Map(allStudents.map(s => [s.id, s]));
      
      for (const searchStudent of searchResults) {
        const studentFlags: string[] = [];
        const studentMessages: string[] = [];
        const studentColors: string[] = [];
        
        // Find the full student record by matching the search result ID to database ID
        let fullStudent = null;
        
        // Try direct ID match first (in case searchStudent.id is already correct)
        fullStudent = studentMap.get(searchStudent.id.toString());
        
        // If not found, try matching by student number or other identifiers
        if (!fullStudent) {
          fullStudent = allStudents.find(s => 
            s.studentNumber === searchStudent.studentNumber ||
            (s.firstName === searchStudent.firstName && s.lastName === searchStudent.lastName && s.grade === searchStudent.grade)
          );
        }
        
        if (!fullStudent) {
          continue;
        }
        
        for (const rule of flagRules) {
          // Check if student matches grade/class filters
          if (rule.filters) {
            if (rule.filters.grades && rule.filters.grades.length > 0) {
              if (!rule.filters.grades.includes(String(fullStudent.grade))) {
                continue; // Skip this rule for this student
              }
            }
            if (rule.filters.classes && rule.filters.classes.length > 0) {
              if (!rule.filters.classes.includes(fullStudent.className || '')) {
                continue; // Skip this rule for this student
              }
            }
          }
          
          // Evaluate the flag criteria
          const flagResult = await evaluateFlag(fullStudent, rule);
          if (flagResult.isFlagged) {
            studentFlags.push(rule.name);
            studentMessages.push(flagResult.message);
            studentColors.push(rule.color || 'red');
          }
        }
        
        if (studentFlags.length > 0) {
          flaggedData.set(searchStudent.id, { 
            flagNames: studentFlags, 
            messages: studentMessages,
            colors: studentColors
          });
        }
      }
      
      return flaggedData;
    },
    enabled: searchResults.length > 0, // Only run when we have search results
    staleTime: 30000, // Cache for 30 seconds
  });

  // Use handlers from store if available, fallback to props
  const handleStudentSelect = studentSelectHandler || onStudentSelect;
  const handleViewProfiles = viewProfilesHandler || onViewProfiles;

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Render sort icon for table headers
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown size={14} className="opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ChevronUp size={14} className="text-wasabi-green" />
      : <ChevronDown size={14} className="text-wasabi-green" />;
  };

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (gradeDropdownRef.current && !gradeDropdownRef.current.contains(event.target as Node)) {
        setGradeDropdownOpen(false);
      }
      if (genderDropdownRef.current && !genderDropdownRef.current.contains(event.target as Node)) {
        setGenderDropdownOpen(false);
      }
      if (homeroomDropdownRef.current && !homeroomDropdownRef.current.contains(event.target as Node)) {
        setHomeroomDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper functions for filter dropdowns
  const getFilterLabel = (filterArray: string[], totalOptions: number, type: string) => {
    if (filterArray.length === 0) return `All ${type}`;
    if (filterArray.length === totalOptions) return `All ${type}`;
    return `${filterArray.length} selected`;
  };

  const toggleFilter = (value: string, filterArray: string[], setFilter: (arr: string[]) => void) => {
    if (filterArray.includes(value)) {
      setFilter(filterArray.filter(item => item !== value));
    } else {
      setFilter([...filterArray, value]);
    }
  };

  const selectAllFilter = (setFilter: (arr: string[]) => void) => {
    setFilter([]);
  };

  if (!searchQuery.trim()) {
    return (
      <PageWrapper>
        <PageHeader
          title="Student Search"
          description="Search and filter students to view detailed profiles"
          icon={Search}
          iconColor="text-blue-600"
        />
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Users size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">Start typing to search students</p>
            <p className="text-sm">Search by name, student number, grade, or homeroom teacher</p>
            {totalStudents > 0 && (
              <p className="text-xs mt-4 opacity-75">{totalStudents} students in database</p>
            )}
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (isLoading) {
    return (
      <PageWrapper>
        <PageHeader
          title="Student Search"
          description="Search and filter students to view detailed profiles"
          icon={Search}
          iconColor="text-blue-600"
        />
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-wasabi-green mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Searching students...</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (searchResults.length === 0) {
    return (
      <PageWrapper>
        <PageHeader
          title="Student Search"
          description="Search and filter students to view detailed profiles"
          icon={Search}
          iconColor="text-blue-600"
        />
        
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <X size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg mb-2">No students found</p>
            <p className="text-sm">Try adjusting your search terms</p>
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Helper function to evaluate if a student meets flag criteria

  // Apply client-side filters to search results
  const filteredResults = searchResults.filter(student => {
    if (gradeFilter.length > 0 && !gradeFilter.includes(student.grade?.toString() || '')) return false;
    if (genderFilter.length > 0 && !genderFilter.includes(student.gender || '')) return false;
    if (homeroomFilter.length > 0 && !homeroomFilter.includes(student.className || '')) return false;
    return true;
  });

  return (
    <PageWrapper className="overflow-visible">
      <PageHeader
        title="Student Search"
        description="Search and filter students to view detailed profiles"
        icon={Search}
        iconColor="text-blue-600"
      />

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6 overflow-visible">

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 overflow-visible">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Search Results
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {filteredResults.length} of {totalResults} student{totalResults !== 1 ? 's' : ''} shown
              {filteredResults.length !== searchResults.length && ` (${searchResults.length - filteredResults.length} filtered out)`}
            </span>
          </div>
          
          {filteredResults.length > 0 && (
            <div className="flex items-center gap-2">
              {/* Compact Filter Dropdowns */}
              {filterOptions && (
                <div className="flex items-center gap-2 mr-4">
                  <Filter size={16} className="text-gray-500 dark:text-gray-400" />
                  
                  {/* Grade Filter Dropdown */}
                  <div className="relative" ref={gradeDropdownRef}>
                    <button
                      onClick={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      {getFilterLabel(gradeFilter, filterOptions.grades.length, 'Grades')}
                      <ChevronDown size={14} />
                    </button>
                    
                    {gradeDropdownOpen && (
                      <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 min-w-[200px]">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                          <button
                            onClick={() => selectAllFilter(setGradeFilter)}
                            className="flex items-center gap-2 w-full text-left px-2 py-1 text-sm text-wasabi-green hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                          >
                            <Check size={14} />
                            All Grades
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filterOptions.grades.map(grade => (
                            <label key={grade} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={gradeFilter.includes(grade)}
                                onChange={(e) => toggleFilter(grade, gradeFilter, setGradeFilter)}
                                className="rounded border-gray-300 text-wasabi-green focus:ring-wasabi-green"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Grade {grade}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Gender Filter Dropdown */}
                  <div className="relative" ref={genderDropdownRef}>
                    <button
                      onClick={() => setGenderDropdownOpen(!genderDropdownOpen)}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      {getFilterLabel(genderFilter, filterOptions.genders.length, 'Genders')}
                      <ChevronDown size={14} />
                    </button>
                    
                    {genderDropdownOpen && (
                      <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 min-w-[160px]">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                          <button
                            onClick={() => selectAllFilter(setGenderFilter)}
                            className="flex items-center gap-2 w-full text-left px-2 py-1 text-sm text-wasabi-green hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                          >
                            <Check size={14} />
                            All Genders
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filterOptions.genders.map(gender => (
                            <label key={gender} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={genderFilter.includes(gender)}
                                onChange={(e) => toggleFilter(gender, genderFilter, setGenderFilter)}
                                className="rounded border-gray-300 text-wasabi-green focus:ring-wasabi-green"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{gender}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Homeroom Filter Dropdown */}
                  <div className="relative" ref={homeroomDropdownRef}>
                    <button
                      onClick={() => setHomeroomDropdownOpen(!homeroomDropdownOpen)}
                      className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                    >
                      {getFilterLabel(homeroomFilter, filterOptions.homerooms.length, 'Teachers')}
                      <ChevronDown size={14} />
                    </button>
                    
                    {homeroomDropdownOpen && (
                      <div className="absolute top-full mt-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-50 min-w-[200px]">
                        <div className="p-2 border-b border-gray-200 dark:border-gray-600">
                          <button
                            onClick={() => selectAllFilter(setHomeroomFilter)}
                            className="flex items-center gap-2 w-full text-left px-2 py-1 text-sm text-wasabi-green hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
                          >
                            <Check size={14} />
                            All Teachers
                          </button>
                        </div>
                        <div className="max-h-48 overflow-y-auto">
                          {filterOptions.homerooms.map((homeroom, index) => (
                            <label key={homeroom} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={homeroomFilter.includes(homeroom)}
                                onChange={(e) => toggleFilter(homeroom, homeroomFilter, setHomeroomFilter)}
                                className="rounded border-gray-300 text-wasabi-green focus:ring-wasabi-green"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {mappedHomeroomNames[index] || homeroom}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {selectedStudents.length > 0 && (
                <>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {selectedStudents.length} selected
                  </span>
                  <button
                    onClick={() => handleViewProfiles?.(selectedStudents)}
                    className="px-3 py-1 bg-wasabi-green text-white rounded-md hover:bg-green-600 transition-colors text-sm"
                  >
                    View Profiles
                  </button>
                  <button
                    onClick={clearSelection}
                    className="px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm"
                  >
                    Clear
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results Table */}
      <div className="overflow-visible">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="w-12 px-4 py-3 text-left">
                {/* Removed select all checkbox */}
              </th>
              <th className="w-12 px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                Flags
              </th>
              <th className="w-12 px-4 py-3 text-left"></th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-2 hover:text-wasabi-green transition-colors"
                >
                  Student Name
                  {renderSortIcon('name')}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                Student ID
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                <button
                  onClick={() => handleSort('grade')}
                  className="flex items-center gap-2 hover:text-wasabi-green transition-colors"
                >
                  Grade
                  {renderSortIcon('grade')}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-900 dark:text-gray-100">
                <button
                  onClick={() => handleSort('homeroom')}
                  className="flex items-center gap-2 hover:text-wasabi-green transition-colors"
                >
                  HR Teacher
                  {renderSortIcon('homeroom')}
                </button>
              </th>
              <th className="w-24 px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredResults.map((student) => (
              <tr 
                key={student.id}
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selectedStudentIds.has(student.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.has(student.id)}
                    onChange={() => toggleStudentSelection(student.id)}
                    className="rounded border-gray-300 text-wasabi-green focus:ring-wasabi-green"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  {(() => {
                    const flagInfo = flaggedStudentData.get(student.id);
                    if (!flagInfo || flagInfo.flagNames.length === 0) {
                      return (
                        <div className="flex items-center justify-center">
                          <div className="w-2 h-2 bg-gray-300 rounded-full" title="No flags" />
                        </div>
                      );
                    }
                    
                    const colors = flagInfo.colors || ['red'];
                    const colorStyles = {
                      red: 'text-red-500',
                      orange: 'text-orange-500', 
                      yellow: 'text-yellow-500',
                      green: 'text-green-500',
                      blue: 'text-blue-500'
                    };
                    
                    return (
                      <div className="relative group inline-flex items-center justify-center">
                        <div className="flex items-center" style={{ width: `${Math.max(16, 16 + (colors.length - 1) * 6)}px` }}>
                          {colors.map((color, index) => (
                            <Flag
                              key={index}
                              size={16}
                              className={`${colorStyles[color as keyof typeof colorStyles] || 'text-red-500'} fill-current cursor-help absolute`}
                              style={{
                                left: `${index * 6}px`,
                                zIndex: colors.length - index
                              }}
                            />
                          ))}
                        </div>
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-[9999] min-w-max">
                          <div className="max-w-xs">
                            {flagInfo.flagNames.length === 1 ? (
                              <div className="flex items-center gap-2">
                                <div className={`w-3 h-3 rounded-full ${
                                  colors[0] === 'red' ? 'bg-red-500' :
                                  colors[0] === 'orange' ? 'bg-orange-500' :
                                  colors[0] === 'yellow' ? 'bg-yellow-500' :
                                  colors[0] === 'green' ? 'bg-green-500' :
                                  colors[0] === 'blue' ? 'bg-blue-500' : 'bg-red-500'
                                }`} />
                                <span>Flag: {flagInfo.flagNames[0]}</span>
                              </div>
                            ) : (
                              <div>
                                <div className="font-medium mb-2">Active Flags:</div>
                                {flagInfo.flagNames.map((flag, index) => {
                                  const color = colors[index] || 'red';
                                  return (
                                    <div key={index} className="flex items-center gap-2 text-sm mb-1">
                                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                                        color === 'red' ? 'bg-red-500' :
                                        color === 'orange' ? 'bg-orange-500' :
                                        color === 'yellow' ? 'bg-yellow-500' :
                                        color === 'green' ? 'bg-green-500' :
                                        color === 'blue' ? 'bg-blue-500' : 'bg-red-500'
                                      }`} />
                                      <span>{flag}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 z-[9999]"></div>
                        </div>
                      </div>
                    );
                  })()}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleStudentSelection(student.id)}
                    className="hover:opacity-75 transition-opacity cursor-pointer"
                    title={`Select ${formatName(student.firstName || '')} ${formatName(student.lastName || '')}`}
                  >
                    <StudentAvatar
                      firstName={formatName(student.firstName || '')}
                      lastName={formatName(student.lastName || '')}
                      gender={student.gender}
                      size="sm"
                    />
                  </button>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleStudentSelect?.(student)}
                    className="font-medium text-gray-900 dark:text-gray-100 hover:text-wasabi-green transition-colors text-left"
                  >
                    {formatName(student.fullName || '')}
                  </button>
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  {student.studentNumber}
                </td>
                <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                  {(() => {
                    const gradeStr = student.grade?.toString() || '';
                    if (gradeStr.toLowerCase() === 'kg') return 'KG';
                    
                    const gradeNum = parseInt(gradeStr, 10);
                    if (isNaN(gradeNum)) return gradeStr; // fallback for non-numeric values
                    
                    if (gradeNum === 0) return 'KG';
                    if (gradeNum === 1) return '1st';
                    if (gradeNum === 2) return '2nd';
                    if (gradeNum === 3) return '3rd';
                    if (gradeNum === 4) return '4th';
                    if (gradeNum === 5) return '5th';
                    if (gradeNum === 6) return '6th';
                    if (gradeNum === 7) return '7th';
                    if (gradeNum === 8) return '8th';
                    if (gradeNum === 9) return '9th';
                    if (gradeNum === 10) return '10th';
                    if (gradeNum === 11) return '11th';
                    if (gradeNum === 12) return '12th';
                    return `${gradeNum}th`; // fallback with ordinal for any other numbers
                  })()}
                </td>
                <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                  <InstructorName 
                    originalName={student.className || ''} 
                    fallback="Not assigned"
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => handleStudentSelect?.(student)}
                    className="px-3 py-1.5 bg-wasabi-green text-white text-sm font-medium rounded-md hover:bg-green-600 transition-colors"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer with Load More */}
      {hasMore && (
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <button
            onClick={loadMore}
            className="inline-flex items-center gap-2 px-4 py-2 bg-wasabi-green text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <ChevronDown size={16} />
            Load More ({totalResults - searchResults.length} remaining)
          </button>
        </div>
      )}
      
      {!hasMore && searchResults.length > 0 && totalResults > 50 && (
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            All {totalResults} results loaded
          </p>
        </div>
      )}
        </div>
      </div>
    </PageWrapper>
  );
}