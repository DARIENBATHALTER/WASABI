import { type ReactNode, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ToastContainer from './Toast';
import NoriBubble from './NoriBubble';
import StudentProfileCards from '../../features/students/StudentProfileCards';
import { useStore } from '../../store';
import type { StudentSearchResult } from '../../hooks/useStudentSearch';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const { selectedStudents, setSelectedStudents, sidebarOpen, toggleSidebar, theme, setNoriMinimized } = useStore();
  const [showProfiles, setShowProfiles] = useState(false);
  const location = useLocation();
  
  const handleViewProfiles = () => {
    if (selectedStudents.length > 0) {
      setShowProfiles(true);
    }
  };
  
  const handleBackToSearch = () => {
    setShowProfiles(false);
  };
  
  const handleStudentSelect = (student: StudentSearchResult) => {
    // Set the selected student and show profile
    setSelectedStudents([student]);
    setShowProfiles(true);
  };
  
  const handleViewMultipleProfiles = (students: StudentSearchResult[]) => {
    // Set multiple students and show profiles
    setSelectedStudents(students);
    setShowProfiles(true);
  };
  
  // Store the handlers in the global store for components to access
  const { setStudentSelectHandler, setViewProfilesHandler } = useStore();
  
  // Set handlers in store so child components can access them
  useEffect(() => {
    setStudentSelectHandler(handleStudentSelect);
    setViewProfilesHandler(handleViewMultipleProfiles);
  }, [setStudentSelectHandler, setViewProfilesHandler]);

  // Close profile views when navigating to a different route
  useEffect(() => {
    setShowProfiles(false);
    
    // Show Nori bubble when navigating away from AI Assistant page
    if (location.pathname !== '/ai-assistant') {
      setNoriMinimized(true);
    }
  }, [location.pathname, setNoriMinimized]);
  
  return (
    <div className="h-full w-full dark:bg-gray-900 overflow-hidden relative" style={{backgroundColor: theme === 'dark' ? undefined : '#d1d9e3'}}>
      {/* Header overlays everything */}
      <Header onViewProfiles={handleViewProfiles} onToggleSidebar={toggleSidebar} onBackToSearch={handleBackToSearch} />
      
      
      {/* Main layout with sidebar and content */}
      <div className="flex h-full">
        <Sidebar />
        <div className="flex-1 flex flex-col pt-20 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-6">
            {showProfiles && selectedStudents.length > 0 ? (
              <StudentProfileCards 
                students={selectedStudents} 
                onBack={handleBackToSearch}
              />
            ) : (
              children
            )}
          </main>
        </div>
      </div>
      
      <ToastContainer />
      <NoriBubble />
    </div>
  );
}