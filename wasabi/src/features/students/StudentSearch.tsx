import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStore } from '../../store';
import Welcome from './Welcome';
import StudentSearchResults from './StudentSearchResults';
import type { StudentSearchResult } from '../../hooks/useStudentSearch';

interface StudentSearchProps {
  onStudentSelect?: (student: StudentSearchResult) => void;
  onViewProfiles?: (students: StudentSearchResult[]) => void;
}

export default function StudentSearch({ onStudentSelect, onViewProfiles }: StudentSearchProps) {
  const [searchParams] = useSearchParams();
  const { searchQuery, setSearchQuery } = useStore();

  // Check for search parameter in URL and update store
  useEffect(() => {
    const urlSearchQuery = searchParams.get('search');
    if (urlSearchQuery && urlSearchQuery !== searchQuery) {
      setSearchQuery(urlSearchQuery);
    }
  }, [searchParams, searchQuery, setSearchQuery]);

  const handleStudentSelect = (student: StudentSearchResult) => {
    console.log('Selected student:', student);
    onStudentSelect?.(student);
    // TODO: Navigate to student profile page
  };

  const handleViewProfiles = (students: StudentSearchResult[]) => {
    console.log('View profiles for students:', students);
    onViewProfiles?.(students);
    // TODO: Navigate to multi-student profile comparison page
  };

  return (
    <div className="h-full flex flex-col">
      {searchQuery.trim() ? (
        <div className="flex-1 p-6">
          <StudentSearchResults 
            searchQuery={searchQuery}
            onStudentSelect={handleStudentSelect}
            onViewProfiles={handleViewProfiles}
          />
        </div>
      ) : (
        <Welcome />
      )}
    </div>
  );
}