import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import EnrollmentUploadPage from './EnrollmentUploadPage';
import DatabaseViewer from './DatabaseViewer';
import StudentDebugPanel from './StudentDebugPanel';
import { Database, Search, Bug, Upload } from 'lucide-react';

type DataManagementView = 'upload' | 'database' | 'debug';

interface ConsoleMessage {
  type: 'info' | 'success' | 'error' | 'warning';
  message: string;
  timestamp: Date;
}

interface DatasetInfo {
  id: string;
  name: string;
  fileType: string;
  uploaded: boolean;
  uploadDate?: Date;
}

const STORAGE_KEYS = {
  UPLOAD_STATE: 'wasabi_upload_state',
  CONSOLE_MESSAGES: 'wasabi_console_messages',
  DATASETS: 'wasabi_datasets'
};

const defaultDatasets: DatasetInfo[] = [
  {
    id: 'attendance',
    name: 'Attendance Records',
    fileType: '.csv',
    uploaded: false
  },
  {
    id: 'grades',
    name: 'Academic Grades',
    fileType: '.xls,.xlsx',
    uploaded: false
  },
  {
    id: 'discipline',
    name: 'Discipline Records',
    fileType: '.csv',
    uploaded: false
  },
  {
    id: 'iready-reading',
    name: 'iReady Reading Assessment',
    fileType: '.csv',
    uploaded: false
  },
  {
    id: 'iready-math',
    name: 'iReady Math Assessment',
    fileType: '.csv',
    uploaded: false
  },
  {
    id: 'fast-pm1-kg-2nd',
    name: 'FAST PM1 KG-2nd',
    fileType: '.zip',
    uploaded: false
  },
  {
    id: 'fast-pm1-3rd-5th',
    name: 'FAST PM1 3rd-5th',
    fileType: '.zip',
    uploaded: false
  },
  {
    id: 'fast-pm2-kg-2nd',
    name: 'FAST PM2 KG-2nd',
    fileType: '.zip',
    uploaded: false
  },
  {
    id: 'fast-pm2-3rd-5th',
    name: 'FAST PM2 3rd-5th',
    fileType: '.zip',
    uploaded: false
  },
  {
    id: 'fast-pm3-kg-2nd',
    name: 'FAST PM3 KG-2nd',
    fileType: '.zip',
    uploaded: false
  },
  {
    id: 'fast-pm3-3rd-5th',
    name: 'FAST PM3 3rd-5th',
    fileType: '.zip',
    uploaded: false
  },
  {
    id: 'fast-writing-4th-5th',
    name: 'FAST Writing 4th-5th',
    fileType: '.zip',
    uploaded: false
  },
  {
    id: 'fast-science-5th',
    name: 'FAST Science 5th',
    fileType: '.zip',
    uploaded: false
  }
];

// Helper functions for localStorage
const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects for console messages
      if (key === STORAGE_KEYS.CONSOLE_MESSAGES && Array.isArray(parsed)) {
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })) as T;
      }
      // Convert date strings back to Date objects for datasets
      if (key === STORAGE_KEYS.DATASETS && Array.isArray(parsed)) {
        return parsed.map((dataset: any) => ({
          ...dataset,
          uploadDate: dataset.uploadDate ? new Date(dataset.uploadDate) : undefined
        })) as T;
      }
      return parsed;
    }
  } catch (error) {
    console.warn(`Failed to load ${key} from localStorage:`, error);
  }
  return defaultValue;
};

const saveToStorage = <T,>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to save ${key} to localStorage:`, error);
  }
};

interface DataManagementPanelProps {
  onBack: () => void;
}

export default function DataManagementPanel({ onBack }: DataManagementPanelProps) {
  const [currentView, setCurrentView] = useState<DataManagementView>('upload');
  
  // Initialize persistent state from localStorage
  const [isUploaded, setIsUploaded] = useState(() => 
    loadFromStorage(STORAGE_KEYS.UPLOAD_STATE, false)
  );
  const [isProcessing, setIsProcessing] = useState(false); // Don't persist processing state
  const [consoleMessages, setConsoleMessages] = useState<ConsoleMessage[]>(() => 
    loadFromStorage(STORAGE_KEYS.CONSOLE_MESSAGES, [])
  );
  const [datasets, setDatasets] = useState<DatasetInfo[]>(() => {
    const storedDatasets = loadFromStorage(STORAGE_KEYS.DATASETS, []);
    
    // Merge stored datasets with new defaults, preserving upload status
    const mergedDatasets = defaultDatasets.map(defaultDataset => {
      const stored = storedDatasets.find((d: DatasetInfo) => d.id === defaultDataset.id);
      return stored ? { ...defaultDataset, uploaded: stored.uploaded, uploadDate: stored.uploadDate } : defaultDataset;
    });
    
    return mergedDatasets;
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveToStorage(STORAGE_KEYS.UPLOAD_STATE, isUploaded);
  }, [isUploaded]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.CONSOLE_MESSAGES, consoleMessages);
  }, [consoleMessages]);

  useEffect(() => {
    saveToStorage(STORAGE_KEYS.DATASETS, datasets);
  }, [datasets]);

  // Function to clear all localStorage data
  const clearAllStoredData = () => {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    // Reset state to defaults
    setIsUploaded(false);
    setConsoleMessages([]);
    setDatasets(defaultDatasets);
  };

  const renderView = () => {
    switch (currentView) {
      case 'upload':
        return (
          <EnrollmentUploadPage 
            isUploaded={isUploaded}
            setIsUploaded={setIsUploaded}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
            consoleMessages={consoleMessages}
            setConsoleMessages={setConsoleMessages}
            datasets={datasets}
            setDatasets={setDatasets}
            clearAllStoredData={clearAllStoredData}
          />
        );
      case 'database':
        return <DatabaseViewer />;
      case 'debug':
        return <StudentDebugPanel />;
      default:
        return null;
    }
  };

  const navItems = [
    { id: 'back', label: 'Go Back', icon: ArrowLeft, isBack: true },
    { id: 'upload', label: 'Student Data Management', icon: Upload },
    { id: 'database', label: 'Database Viewer', icon: Database },
    { id: 'debug', label: 'Student Debug', icon: Bug },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8 px-6" aria-label="Data management tabs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const isBackButton = item.isBack;
            
            return (
              <button
                key={item.id}
                onClick={() => isBackButton ? onBack() : setCurrentView(item.id as DataManagementView)}
                className={`
                  py-3 px-1 border-b-2 font-medium text-sm flex items-center gap-2
                  transition-colors
                  ${isActive
                    ? 'border-wasabi-green text-wasabi-green'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon size={16} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
      
      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {renderView()}
      </div>
    </div>
  );
}