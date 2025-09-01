import { useInstructorDisplayName } from '../../contexts/InstructorNameContext';

interface InstructorNameProps {
  /** The original instructor name from the database */
  originalName: string;
  /** Additional CSS classes */
  className?: string;
  /** Fallback text if originalName is empty */
  fallback?: string;
}

/**
 * A component that automatically displays the mapped instructor name.
 * 
 * Usage:
 * <InstructorName originalName={student.homeRoomTeacher} />
 * <InstructorName originalName={observation.teacherName} className="font-bold" />
 */
export default function InstructorName({ 
  originalName, 
  className = '', 
  fallback = 'Unknown Teacher' 
}: InstructorNameProps) {
  const displayName = useInstructorDisplayName(originalName || '');
  
  if (!originalName) {
    return <span className={className}>{fallback}</span>;
  }
  
  return (
    <span className={className} title={`Original: ${originalName}`}>
      {displayName}
    </span>
  );
}

// Utility function version for use in data processing/non-React contexts
export { useInstructorDisplayName, useInstructorDisplayNames } from '../../contexts/InstructorNameContext';