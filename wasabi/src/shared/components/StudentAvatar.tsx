import React from 'react';

interface StudentAvatarProps {
  firstName: string;
  lastName: string;
  gender?: 'male' | 'female' | 'other' | 'undisclosed';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export default function StudentAvatar({
  firstName,
  lastName,
  gender,
  size = 'md',
  className = '',
}: StudentAvatarProps) {
  // Get initials from first and last name
  const getInitials = (): string => {
    const firstInitial = firstName?.charAt(0) || '';
    const lastInitial = lastName?.charAt(0) || '';
    return (firstInitial + lastInitial).toUpperCase();
  };

  // Determine gradient based on gender (bottom to top)
  const getGradientColors = (): { from: string; to: string } => {
    // Handle both enum values and raw string values from database
    const genderStr = String(gender || '').toLowerCase();
    
    if (genderStr.includes('f') || genderStr === 'female') {
      return { from: '#e55b8a', to: '#f8a5c2' }; // Pinkish-magenta gradient
    } else if (genderStr.includes('m') || genderStr === 'male') {
      return { from: '#4682b4', to: '#87ceeb' }; // Darker blue to baby blue
    } else {
      return { from: '#6b7280', to: '#9ca3af' }; // Gray gradient for unknown
    }
  };

  // Size classes
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
  };

  const { from, to } = getGradientColors();
  const initials = getInitials();

  return (
    <div 
      className={`rounded-full flex items-center justify-center font-semibold text-white shadow-sm ${sizeClasses[size]} ${className}`}
      style={{
        background: `linear-gradient(to top, ${from}, ${to})`,
      }}
      title={`${firstName} ${lastName}`}
    >
      {initials}
    </div>
  );
}