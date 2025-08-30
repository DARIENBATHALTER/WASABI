import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<any>;
  iconColor?: string;
  children?: React.ReactNode;
  variant?: 'default' | 'compact';
}

export default function PageHeader({ 
  title, 
  description, 
  icon: Icon, 
  iconColor = 'text-wasabi-green',
  children,
  variant = 'default'
}: PageHeaderProps) {
  const isCompact = variant === 'compact';
  
  return (
    <div className={`
      bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700
      ${isCompact ? 'px-4 py-3' : 'px-6 py-4'}
    `}>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {Icon && (
            <Icon className={`
              ${isCompact ? 'w-7 h-7 mr-2' : 'w-10 h-10 mr-3'} 
              ${iconColor}
            `} />
          )}
          <div>
            <h1 className={`
              font-semibold text-gray-900 dark:text-gray-100
              ${isCompact ? 'text-lg' : 'text-xl'}
            `}>
              {title}
            </h1>
            {description && (
              <p className={`
                text-gray-600 dark:text-gray-400
                ${isCompact ? 'text-xs mt-0.5' : 'text-sm mt-1'}
              `}>
                {description}
              </p>
            )}
          </div>
        </div>
        {children && (
          <div className="flex items-center gap-2">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}