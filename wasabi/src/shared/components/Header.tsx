import { Search, Sun, Moon } from 'lucide-react';
import { useStore } from '../../store';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StudentAvatar from './StudentAvatar';

interface HeaderProps {
  onViewProfiles?: () => void;
  onToggleSidebar?: () => void;
  onBackToSearch?: () => void;
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

export default function Header({ onViewProfiles, onToggleSidebar, onBackToSearch }: HeaderProps = {}) {
  const { theme, setTheme, searchQuery, setSearchQuery, selectedStudents, setSelectedStudents } = useStore();
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [savedSearchText, setSavedSearchText] = useState(''); // Store search text when students are selected
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Update global search query in real-time as user types (only when no students selected)
  useEffect(() => {
    if (selectedStudents.length === 0) {
      const timeoutId = setTimeout(() => {
        setSearchQuery(localSearch);
      }, 300); // 300ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [localSearch, setSearchQuery, selectedStudents.length]);

  // Clear search text when students are selected, restore when all are removed
  useEffect(() => {
    if (selectedStudents.length > 0) {
      // Save current search text and clear it
      if (localSearch && savedSearchText === '') {
        setSavedSearchText(localSearch);
      }
      setLocalSearch('');
    } else if (selectedStudents.length === 0 && savedSearchText) {
      // Restore saved search text when all students are removed
      setLocalSearch(savedSearchText);
      setSavedSearchText('');
    }
  }, [selectedStudents.length, localSearch, savedSearchText]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    
    // If students are selected, load their profile cards
    if (selectedStudents.length > 0) {
      onViewProfiles?.();
      return;
    }
    
    // Otherwise, perform a normal search
    setSearchQuery(localSearch);
  };

  const handleListAll = () => {
    setLocalSearch('');
    setSearchQuery('*'); // Special query to show all students
    setSavedSearchText(''); // Clear any saved search text
    navigate('/'); // Navigate to home/search view
    onBackToSearch?.(); // Also call the callback for profile view management
  };

  const removeSelectedStudent = (studentId: string) => {
    const updatedStudents = selectedStudents.filter(s => s.id !== studentId);
    setSelectedStudents(updatedStudents);
    // No longer navigate when removing students - just update the selection
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle backspace when input is empty and there are selected students
    if (e.key === 'Backspace' && localSearch === '' && selectedStudents.length > 0) {
      e.preventDefault();
      // Remove the last selected student
      const lastStudent = selectedStudents[selectedStudents.length - 1];
      removeSelectedStudent(lastStudent.id);
      // Focus the input
      inputRef.current?.focus();
    }
  };

  return (
    <header className="absolute top-0 left-0 right-0 bg-gray-800 shadow-lg border-b border-gray-700 z-50">
      <div className="px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* WASABI Logo */}
          <button 
            onClick={onToggleSidebar}
            className="flex items-center space-x-3 -ml-1.5 hover:opacity-80 transition-opacity cursor-pointer"
            title="Toggle sidebar"
          >
            <img 
              src="/wasabilogo.png" 
              alt="WASABI Logo" 
              className="w-8 h-8 object-contain"
            />
            <span className="text-2xl font-semibold text-gray-100">WASABI</span>
          </button>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
              
              {/* Selected students avatars inside search bar */}
              {selectedStudents.length > 0 && (
                <div className="absolute left-10 top-1/2 transform -translate-y-1/2 flex gap-1 z-10">
                  {selectedStudents.map((student) => (
                    <div
                      key={student.id}
                      className="relative group cursor-pointer"
                      onClick={() => removeSelectedStudent(student.id)}
                      title={`Remove ${formatName(student.firstName || '')} ${formatName(student.lastName || '')}`}
                    >
                      <StudentAvatar
                        firstName={formatName(student.firstName || '')}
                        lastName={formatName(student.lastName || '')}
                        gender={student.gender}
                        size="xs"
                        className="transition-opacity group-hover:opacity-75"
                      />
                      {/* Visual indicator on hover - solid red overlay */}
                      <div className="absolute inset-0 bg-red-500 rounded-full 
                                    opacity-0 group-hover:opacity-100 transition-opacity
                                    flex items-center justify-center">
                        <span className="text-white text-xs font-bold">×</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <input
                ref={inputRef}
                type="text"
                placeholder={selectedStudents.length > 0 ? "" : "Search by student name..."}
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  // Return to search view when user starts typing (but not when clearing)
                  if (e.target.value.trim() !== '') {
                    navigate('/'); // Navigate to home/search view
                    onBackToSearch?.(); // Also call the callback for profile view management
                  }
                }}
                onKeyDown={handleKeyDown}
                className="w-full py-2 rounded-lg border border-gray-600 
                         bg-gray-700 text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-wasabi-green focus:border-transparent
                         placeholder-gray-400 pr-32"
                style={{
                  paddingLeft: selectedStudents.length > 0 
                    ? `${40 + (selectedStudents.length * 28)}px` 
                    : '40px'
                }}
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-2">
                <button
                  type="submit"
                  className="px-3 py-1 text-sm bg-wasabi-green text-white rounded hover:bg-green-600 transition-colors"
                >
                  {selectedStudents.length > 0 ? 'View' : 'Go'}
                </button>
                <button
                  type="button"
                  onClick={handleListAll}
                  className="px-3 py-1 text-sm bg-gray-600 text-gray-200 rounded hover:bg-gray-500 transition-colors"
                >
                  List All
                </button>
              </div>
            </div>
          </form>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2 rounded-lg bg-gray-700 text-gray-300 
                     hover:bg-gray-600 transition-colors"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        </div>
      </div>
    </header>
  );
}