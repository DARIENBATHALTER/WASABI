import React from 'react';

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
  fullHeight?: boolean;
}

export default function PageWrapper({ 
  children, 
  className = '',
  fullHeight = true 
}: PageWrapperProps) {
  return (
    <div className={`
      bg-gray-50 dark:bg-gray-900 rounded-xl overflow-auto
      ${fullHeight ? 'h-full' : 'min-h-full'}
      ${className}
    `}>
      {children}
    </div>
  );
}