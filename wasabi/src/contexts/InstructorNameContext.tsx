import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { instructorNameMappingService, type InstructorNameMapping } from '../services/instructorNameMapping';

interface InstructorNameContextType {
  getDisplayName: (originalName: string) => string;
  mapInstructorNames: (names: string[]) => string[];
  mappings: InstructorNameMapping;
  isLoaded: boolean;
  reloadMappings: () => Promise<void>;
}

const InstructorNameContext = createContext<InstructorNameContextType | null>(null);

interface InstructorNameProviderProps {
  children: ReactNode;
}

export function InstructorNameProvider({ children }: InstructorNameProviderProps) {
  const [mappings, setMappings] = useState<InstructorNameMapping>({});
  const [isLoaded, setIsLoaded] = useState(false);

  const loadMappings = async () => {
    try {
      const loadedMappings = await instructorNameMappingService.loadMappings();
      setMappings(loadedMappings);
      setIsLoaded(true);
      console.log('📚 Loaded instructor name mappings:', Object.keys(loadedMappings).length, 'mappings');
    } catch (error) {
      console.error('Error loading instructor mappings:', error);
      setMappings({});
      setIsLoaded(true);
    }
  };

  const reloadMappings = async () => {
    setIsLoaded(false);
    await loadMappings();
  };

  // Load mappings on mount and subscribe to changes
  useEffect(() => {
    loadMappings();
    
    // Subscribe to mapping changes
    const unsubscribe = instructorNameMappingService.subscribe(() => {
      console.log('📚 Instructor mappings changed, reloading...');
      const currentMappings = instructorNameMappingService.getCurrentMappings();
      setMappings(currentMappings);
      setIsLoaded(instructorNameMappingService.isLoaded());
    });

    return unsubscribe;
  }, []);

  // Synchronous display name getter using preloaded mappings
  const getDisplayName = (originalName: string): string => {
    if (!originalName) return originalName;
    return mappings[originalName] || originalName;
  };

  // Map multiple instructor names
  const mapInstructorNames = (names: string[]): string[] => {
    return names.map(name => getDisplayName(name));
  };

  const contextValue: InstructorNameContextType = {
    getDisplayName,
    mapInstructorNames,
    mappings,
    isLoaded,
    reloadMappings
  };

  return (
    <InstructorNameContext.Provider value={contextValue}>
      {children}
    </InstructorNameContext.Provider>
  );
}

// Hook to use instructor name mapping
export function useInstructorNames(): InstructorNameContextType {
  const context = useContext(InstructorNameContext);
  if (!context) {
    throw new Error('useInstructorNames must be used within an InstructorNameProvider');
  }
  return context;
}

// Convenience hook for single name translation
export function useInstructorDisplayName(originalName: string): string {
  const { getDisplayName } = useInstructorNames();
  return getDisplayName(originalName);
}

// Convenience hook for array of names translation  
export function useInstructorDisplayNames(originalNames: string[]): string[] {
  const { mapInstructorNames } = useInstructorNames();
  return mapInstructorNames(originalNames);
}