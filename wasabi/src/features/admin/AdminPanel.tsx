import { useState } from 'react';
import AdminDashboard from './AdminDashboard';
import SinglePageDatasetManagement from './SinglePageDatasetManagement';
import DatabaseViewer from './DatabaseViewer';
import StudentDebugPanel from './StudentDebugPanel';

type AdminView = 'dashboard' | 'datasets' | 'database' | 'debug';

export default function AdminPanel() {
  const [currentView, setCurrentView] = useState<AdminView>('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <AdminDashboard 
            onManageDatasets={() => setCurrentView('datasets')}
            onViewDatabase={() => setCurrentView('database')}
            onViewDebugPanel={() => setCurrentView('debug')}
          />
        );
      case 'datasets':
        return (
          <SinglePageDatasetManagement 
            onBack={() => setCurrentView('dashboard')}
          />
        );
      case 'database':
        return (
          <DatabaseViewer />
        );
      case 'debug':
        return (
          <StudentDebugPanel onBack={() => setCurrentView('dashboard')} />
        );
      default:
        return null;
    }
  };

  return renderView();
}