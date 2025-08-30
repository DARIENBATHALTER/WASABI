import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../lib/db';
import { useStore } from '../store';

export interface StudentSearchResult {
  id: number;
  studentNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  grade: string;
  className?: string;
  gender?: 'male' | 'female' | 'other' | 'undisclosed';
}

export type SortField = 'name' | 'grade' | 'homeroom';
export type SortDirection = 'asc' | 'desc';

export function useStudentSearch(
  searchQuery: string, 
  pageSize: number = 50,
  sortField: SortField = 'name',
  sortDirection: SortDirection = 'asc'
) {
  const { selectedStudents, setSelectedStudents } = useStore();
  const [currentPage, setCurrentPage] = useState(0);
  
  // Create a Set of selected student IDs for efficient lookup
  const selectedStudentIds = useMemo(() => 
    new Set(selectedStudents.map(s => s.id)), 
    [selectedStudents]
  );
  
  // Fetch all students and search in memory for better performance
  const { data: allStudents = [], isLoading } = useQuery({
    queryKey: ['students'],
    queryFn: async () => {
      const students = await db.students.toArray();
      return students.map(student => {
        // If student.id is a wasabi compound ID, extract the numeric part
        // Otherwise use the ID as-is
        let numericId = student.id;
        if (typeof student.id === 'string' && student.id.startsWith('wasabi_')) {
          const match = student.id.match(/wasabi_(\d+)_/);
          if (match) {
            numericId = parseInt(match[1], 10);
          }
        }
        
        return {
          id: numericId,
          studentNumber: student.studentNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: `${student.lastName}, ${student.firstName}`,
          grade: student.grade,
          className: student.className,
          gender: student.gender,
        };
      });
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Helper function for proper grade sorting (K, 1, 2, 3, 4, 5, etc.)
  const getGradeSortValue = (grade: string): number => {
    const gradeStr = grade.toLowerCase().trim();
    if (gradeStr === 'k' || gradeStr === 'kg' || gradeStr === 'kindergarten') {
      return -1; // Kindergarten comes before grade 1
    }
    const num = parseInt(gradeStr);
    return isNaN(num) ? 999 : num; // Unknown grades go to end
  };

  // Helper function for applying sorts
  const applySorting = (students: StudentSearchResult[]): StudentSearchResult[] => {
    return [...students].sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          const aName = `${a.lastName}, ${a.firstName}`.toLowerCase();
          const bName = `${b.lastName}, ${b.firstName}`.toLowerCase();
          comparison = aName.localeCompare(bName);
          break;
        case 'grade':
          const aGrade = getGradeSortValue(a.grade);
          const bGrade = getGradeSortValue(b.grade);
          comparison = aGrade - bGrade;
          break;
        case 'homeroom':
          const aTeacher = (a.className || 'zzz').toLowerCase(); // Unassigned goes to end
          const bTeacher = (b.className || 'zzz').toLowerCase();
          comparison = aTeacher.localeCompare(bTeacher);
          break;
        default:
          return 0;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Filter students based on search query
  const { totalResults, searchResults, hasMore } = useMemo(() => {
    const query = searchQuery.trim();
    
    // Handle empty search
    if (!query) {
      return { 
        filteredStudents: [], 
        totalResults: 0, 
        searchResults: [], 
        hasMore: false 
      };
    }

    let filtered: StudentSearchResult[];

    // Handle "List All" special query
    if (query === '*') {
      filtered = applySorting(allStudents);
    } else {
      // Normal search
      const queryLower = query.toLowerCase();
      const words = queryLower.split(/\s+/);
      
      const matchingStudents = allStudents.filter(student => {
        // Search in multiple fields
        const searchableText = [
          student.firstName,
          student.lastName,
          student.fullName,
          student.studentNumber,
          student.grade,
          student.className || '',
        ].join(' ').toLowerCase();

        // All search words must match
        return words.every(word => searchableText.includes(word));
      });
      
      filtered = applySorting(matchingStudents);
    }

    const totalResults = filtered.length;
    const endIndex = (currentPage + 1) * pageSize;
    const paginatedResults = filtered.slice(0, endIndex);
    const hasMore = endIndex < totalResults;

    return {
      totalResults,
      searchResults: paginatedResults,
      hasMore
    };
  }, [allStudents, searchQuery, currentPage, pageSize, sortField, sortDirection]);

  // Reset pagination when search query or sorting changes
  useEffect(() => {
    setCurrentPage(0);
  }, [searchQuery, sortField, sortDirection]);

  const toggleStudentSelection = (studentId: string) => {
    const student = searchResults.find(s => s.id === studentId);
    if (!student) return;
    
    if (selectedStudentIds.has(studentId)) {
      // Remove student from selection
      setSelectedStudents(selectedStudents.filter(s => s.id !== studentId));
    } else {
      // Add student to selection (limit to 8 students)
      if (selectedStudents.length >= 8) {
        // TODO: Show a toast or alert that maximum is 8 students
        return;
      }
      setSelectedStudents([...selectedStudents, student]);
    }
  };

  const selectAllVisible = () => {
    // Add all visible students to selection (avoiding duplicates, limit to 8 total)
    const newStudents = searchResults.filter(student => !selectedStudentIds.has(student.id));
    const remainingSlots = 8 - selectedStudents.length;
    const studentsToAdd = newStudents.slice(0, remainingSlots);
    setSelectedStudents([...selectedStudents, ...studentsToAdd]);
  };

  const clearSelection = () => {
    setSelectedStudents([]);
  };

  const loadMore = () => {
    if (hasMore) {
      setCurrentPage(prev => prev + 1);
    }
  };

  return {
    searchResults,
    selectedStudentIds,
    selectedStudents,
    isLoading,
    totalStudents: allStudents.length,
    totalResults,
    hasMore,
    currentPage,
    toggleStudentSelection,
    selectAllVisible,
    clearSelection,
    loadMore,
  };
}