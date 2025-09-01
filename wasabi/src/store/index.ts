import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Student } from '../shared/types';
import type { StudentSearchResult } from '../hooks/useStudentSearch';

// Fallback UUID generation for environments without crypto.randomUUID
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  
  // Fallback implementation
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  sessionToken?: string;
  loginTime?: Date;
}

interface AppState {
  // UI State
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  
  // User State
  currentUser: User | null;
  
  // Nori State
  noriMinimized: boolean;
  noriMessages: ChatMessage[];
  
  // Student State
  selectedStudent: Student | null;
  selectedStudents: StudentSearchResult[];
  searchQuery: string;
  
  // Profile handlers
  studentSelectHandler: ((student: StudentSearchResult) => void) | null;
  viewProfilesHandler: ((students: StudentSearchResult[]) => void) | null;
  
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
  isSessionValid: () => boolean;
  setNoriMinimized: (minimized: boolean) => void;
  setNoriMessages: (messages: ChatMessage[]) => void;
  addNoriMessage: (message: ChatMessage) => void;
  updateNoriMessage: (id: string, update: Partial<ChatMessage>) => void;
  clearNoriMessages: () => void;
  selectStudent: (student: Student | null) => void;
  setSelectedStudents: (students: StudentSearchResult[]) => void;
  setSearchQuery: (query: string) => void;
  setStudentSelectHandler: (handler: (student: StudentSearchResult) => void) => void;
  setViewProfilesHandler: (handler: (students: StudentSearchResult[]) => void) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      theme: 'light',
      sidebarOpen: true,
      currentUser: null,
      noriMinimized: true,
      noriMessages: [],
      selectedStudent: null,
      selectedStudents: [],
      searchQuery: '',
      studentSelectHandler: null,
      viewProfilesHandler: null,
      
      // Actions
      setTheme: (theme) => {
        set({ theme });
        // Apply theme to document
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      },
      
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      setCurrentUser: (user) => {
        // Add session token and login time if user is being set
        if (user) {
          const sessionToken = generateUUID();
          const loginTime = new Date();
          user = { ...user, sessionToken, loginTime };
        }
        set({ currentUser: user });
      },
      
      logout: () => set({ currentUser: null }),
      
      isSessionValid: () => {
        const state = useStore.getState();
        if (!state.currentUser?.loginTime) return false;
        
        // Session expires after 7 days
        const sessionDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
        const loginTime = new Date(state.currentUser.loginTime);
        const now = new Date();
        
        return (now.getTime() - loginTime.getTime()) < sessionDuration;
      },
      
      setNoriMinimized: (minimized) => set({ noriMinimized: minimized }),
      
      setNoriMessages: (messages) => set({ noriMessages: messages }),
      
      addNoriMessage: (message) => set((state) => ({ 
        noriMessages: [...state.noriMessages, message] 
      })),
      
      updateNoriMessage: (id, update) => set((state) => ({
        noriMessages: state.noriMessages.map(msg => 
          msg.id === id ? { ...msg, ...update } : msg
        )
      })),
      
      clearNoriMessages: () => set({ noriMessages: [] }),
      
      selectStudent: (student) => set({ selectedStudent: student }),
      
      setSelectedStudents: (students) => set({ selectedStudents: students }),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      setStudentSelectHandler: (handler) => set({ studentSelectHandler: handler }),
      
      setViewProfilesHandler: (handler) => set({ viewProfilesHandler: handler }),
    }),
    {
      name: 'wasabi-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        currentUser: state.currentUser
        // noriMinimized not persisted - always starts as true (bubble visible)
      }),
    }
  )
);