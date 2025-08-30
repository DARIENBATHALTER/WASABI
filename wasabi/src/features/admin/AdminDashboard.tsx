import { useState } from 'react';
import { Database, Shield, Users, UserCheck } from 'lucide-react';
import { SpiralIcon } from '../../shared/components/SpiralIcon';
import DataManagementPanel from './DataManagementPanel';
import NoriControlPanel from './NoriControlPanel';
import UserManagementPage from './UserManagementPage';
import InstructorNames from './InstructorNames';

type AdminView = 'dashboard' | 'data-management' | 'nori-control' | 'user-management' | 'instructor-names';

interface AdminTile {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  view: AdminView;
  enabled: boolean;
}

const adminTiles: AdminTile[] = [
  {
    id: 'data-management',
    title: 'Data Management',
    description: 'Upload enrollment data, manage datasets, and view database contents',
    icon: Database,
    color: 'green',
    view: 'data-management',
    enabled: true
  },
  {
    id: 'instructor-names',
    title: 'Instructor Names',
    description: 'Map instructor names from enrollment data to display names used throughout the system',
    icon: UserCheck,
    color: 'orange',
    view: 'instructor-names',
    enabled: true
  },
  {
    id: 'nori-control',
    title: 'Nori Control Panel',
    description: 'Monitor AI Assistant data access, test queries, and manage privacy settings',
    icon: SpiralIcon,
    color: 'purple',
    view: 'nori-control',
    enabled: true
  },
  {
    id: 'user-management',
    title: 'User Management',
    description: 'Manage user accounts, roles, and permissions for system access',
    icon: Users,
    color: 'blue',
    view: 'user-management',
    enabled: true
  }
];

const getColorClasses = (color: string, enabled: boolean) => {
  const baseColors = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-950',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400',
      title: 'text-blue-900 dark:text-blue-100',
      description: 'text-blue-700 dark:text-blue-300',
      hover: 'hover:bg-blue-100 dark:hover:bg-blue-900'
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-950',
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400',
      title: 'text-green-900 dark:text-green-100',
      description: 'text-green-700 dark:text-green-300',
      hover: 'hover:bg-green-100 dark:hover:bg-green-900'
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-950',
      border: 'border-purple-200 dark:border-purple-800',
      icon: 'text-purple-600 dark:text-purple-400',
      title: 'text-purple-900 dark:text-purple-100',
      description: 'text-purple-700 dark:text-purple-300',
      hover: 'hover:bg-purple-100 dark:hover:bg-purple-900'
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-950',
      border: 'border-orange-200 dark:border-orange-800',
      icon: 'text-orange-600 dark:text-orange-400',
      title: 'text-orange-900 dark:text-orange-100',
      description: 'text-orange-700 dark:text-orange-300',
      hover: 'hover:bg-orange-100 dark:hover:bg-orange-900'
    }
  };

  const disabledColors = {
    bg: 'bg-gray-50 dark:bg-gray-900',
    border: 'border-gray-200 dark:border-gray-700',
    icon: 'text-gray-400 dark:text-gray-600',
    title: 'text-gray-500 dark:text-gray-500',
    description: 'text-gray-400 dark:text-gray-600',
    hover: ''
  };
  
  return enabled ? (baseColors[color as keyof typeof baseColors] || baseColors.blue) : disabledColors;
};

export default function AdminDashboard() {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');

  const handleTileClick = (tile: AdminTile) => {
    if (!tile.enabled) {
      return; // Don't do anything for disabled tiles
    }
    
    if (tile.view === 'data-management') {
      setCurrentView('data-management');
    } else if (tile.view === 'instructor-names') {
      setCurrentView('instructor-names');
    } else if (tile.view === 'nori-control') {
      setCurrentView('nori-control');
    } else if (tile.view === 'user-management') {
      setCurrentView('user-management');
    } else {
      // For now, other tiles just show placeholder
      console.log(`Clicked ${tile.title} - not yet implemented`);
    }
  };

  const handleBackToDashboard = () => {
    setCurrentView('dashboard');
  };

  if (currentView === 'data-management') {
    return (
      <DataManagementPanel onBack={handleBackToDashboard} />
    );
  }
  
  if (currentView === 'instructor-names') {
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBackToDashboard}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            ← Back to Dashboard
          </button>
        </div>
        <InstructorNames />
      </div>
    );
  }
  
  if (currentView === 'nori-control') {
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBackToDashboard}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            ← Back to Dashboard
          </button>
        </div>
        <NoriControlPanel />
      </div>
    );
  }
  
  if (currentView === 'user-management') {
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={handleBackToDashboard}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            ← Back to Dashboard
          </button>
        </div>
        <UserManagementPage />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-wasabi-green" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Admin Panel
          </h1>
        </div>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage system data, generate reports, and configure application settings
        </p>
      </div>

      {/* Tiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
        {adminTiles.map((tile) => {
          const Icon = tile.icon;
          const colors = getColorClasses(tile.color, tile.enabled);
          
          return (
            <button
              key={tile.id}
              onClick={() => handleTileClick(tile)}
              disabled={!tile.enabled}
              className={`
                ${colors.bg} ${colors.border} ${tile.enabled ? colors.hover : ''}
                p-6 rounded-lg border-2 text-left transition-all duration-200
                ${tile.enabled ? 'hover:shadow-lg hover:scale-105 transform cursor-pointer' : 'cursor-not-allowed opacity-75'}
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-wasabi-green
                ${tile.enabled ? '' : 'focus:ring-gray-400'}
              `}
            >
              <div className="flex items-start space-x-4">
                <div className={`p-3 rounded-lg ${colors.bg} ${colors.border}`}>
                  <Icon className={`w-6 h-6 ${colors.icon}`} />
                </div>
                <div className="flex-1">
                  <h3 className={`text-xl font-semibold ${colors.title} mb-2 flex items-center gap-2`}>
                    {tile.title}
                    {!tile.enabled && (
                      <span className="text-xs font-normal px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-400">
                        Coming Soon
                      </span>
                    )}
                  </h3>
                  <p className={`text-sm ${colors.description} leading-relaxed`}>
                    {tile.description}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}