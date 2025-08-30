import { Link, useLocation } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  Flag, 
  BarChart3, 
  GraduationCap, 
  Settings,
  LogOut,
  Bot,
  Loader,
  Sparkles,
  ClipboardList,
  Eye
} from 'lucide-react';
import { useStore } from '../../store';
import { SpiralIcon } from './SpiralIcon';

const mainMenuItems = [
  { path: '/', label: 'Profile Search', icon: Users },
  { path: '/reports', label: 'Student Reports', icon: FileText },
  { path: '/flagging', label: 'Flagging System', icon: Flag },
  { path: '/class-analytics', label: 'Class Analytics', icon: BarChart3 },
  { path: '/grade-analytics', label: 'Grade Analytics', icon: GraduationCap },
  { path: '/exam-analytics', label: 'Exam Analytics', icon: ClipboardList },
  { path: '/soba', label: 'Observation', icon: Eye },
  { path: '/ai-assistant', label: 'Nori AI', icon: SpiralIcon },
];

const adminMenuItems = [
  { path: '/admin', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();
  const { sidebarOpen, toggleSidebar, currentUser } = useStore();

  const renderMenuItem = (item: typeof mainMenuItems[0]) => {
    const Icon = item.icon;
    const isActive = location.pathname === item.path;
    
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`
          flex items-center rounded-lg transition-colors duration-200
          ${sidebarOpen ? 'space-x-3 px-4 py-3' : 'justify-center px-2 py-3'}
          ${isActive 
            ? 'bg-wasabi-green text-white' 
            : 'text-gray-300 hover:bg-gray-800 hover:text-white'
          }
        `}
        title={!sidebarOpen ? item.label : undefined}
      >
        <Icon 
          size={item.path === '/soba' ? 22 : 20} 
          className="flex-shrink-0" 
        />
        {sidebarOpen && (
          <span className="truncate whitespace-nowrap overflow-hidden min-w-0 flex items-center gap-2">
            {item.label}
            {item.path === '/ai-assistant' && (
              <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium">
                BETA
              </span>
            )}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={toggleSidebar}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        absolute lg:static inset-y-0 left-0 z-40
        bg-wasabi-dark text-white
        border-r border-gray-700
        transform transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-64 translate-x-0' : 'w-16 -translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex flex-col h-full pt-20">
          {/* Main Navigation */}
          <nav className={`flex-1 py-4 space-y-1 ${sidebarOpen ? 'px-4' : 'px-2'}`}>
            {mainMenuItems.map(renderMenuItem)}
          </nav>

          {/* User section */}
          <div className={`border-t border-gray-700 py-4 ${sidebarOpen ? 'px-4' : 'px-2'}`}>
            <div className="space-y-3">
              {sidebarOpen && currentUser && (
                <div className="px-4 min-w-0">
                  <p className="text-sm text-gray-400 truncate">Logged in as</p>
                  <p className="font-medium truncate">{currentUser.name}</p>
                  <p className="text-sm text-gray-400 truncate">{currentUser.email}</p>
                  <p className="text-xs text-gray-500 capitalize truncate">{currentUser.role}</p>
                </div>
              )}
              
              {/* Settings - moved above logout */}
              {adminMenuItems.map(renderMenuItem)}
              
              <button
                onClick={() => useStore.setState({ currentUser: null })}
                className={`
                  flex items-center w-full py-2 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition-colors
                  ${sidebarOpen ? 'space-x-3 px-4' : 'justify-center px-2'}
                `}
                title={!sidebarOpen ? 'Logout' : undefined}
              >
                <LogOut size={20} className="flex-shrink-0" />
                {sidebarOpen && (
                  <span className="truncate whitespace-nowrap overflow-hidden min-w-0">
                    Logout
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}