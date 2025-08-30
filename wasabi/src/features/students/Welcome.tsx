import { Search, User, BarChart3, AlertTriangle, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../store';

export default function Welcome() {
  const navigate = useNavigate();
  const { setSearchQuery } = useStore();
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-12 flex items-center justify-center">
          <img 
            src="/wasabilogo.png" 
            alt="WASABI Logo" 
            className="h-16 w-16 mr-6"
          />
          <div className="text-left">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
              Welcome to WASABI
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Wide Array Student Analytics and Benchmarking Interface
            </p>
          </div>
        </div>

        <div className="glass-effect rounded-xl p-8">
          <div className="flex items-center justify-center mb-4">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              Get Started
            </h2>
          </div>
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
            Start typing a student name in the search bar above, 
            or use the sidebar navigation to access analytics and reports.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={() => {
                setSearchQuery('*'); // Set "list all" search query
                navigate('/');
              }}
              className="bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 
                         rounded-lg p-4 text-left transition-colors cursor-pointer
                         transform hover:scale-105 transition-transform duration-200"
            >
              <div className="flex items-center mb-2">
                <User className="text-wasabi-green mr-2" size={20} />
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  Profile Search
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                View comprehensive student data including attendance, grades, and assessment scores
              </p>
            </button>
            <button 
              onClick={() => navigate('/class-analytics')}
              className="bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 
                         rounded-lg p-4 text-left transition-colors cursor-pointer
                         transform hover:scale-105 transition-transform duration-200"
            >
              <div className="flex items-center mb-2">
                <BarChart3 className="text-wasabi-green mr-2" size={20} />
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  Class Analytics
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Analyze trends across classes and grade levels to identify patterns
              </p>
            </button>
            <button 
              onClick={() => navigate('/flagging')}
              className="bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 
                         rounded-lg p-4 text-left transition-colors cursor-pointer
                         transform hover:scale-105 transition-transform duration-200"
            >
              <div className="flex items-center mb-2">
                <AlertTriangle className="text-wasabi-green mr-2" size={20} />
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  Flagging System
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Flag students approaching academic crisis for timely early intervention support
              </p>
            </button>
            <button 
              onClick={() => navigate('/reports')}
              className="bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 
                         rounded-lg p-4 text-left transition-colors cursor-pointer
                         transform hover:scale-105 transition-transform duration-200"
            >
              <div className="flex items-center mb-2">
                <FileText className="text-wasabi-green mr-2" size={20} />
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  Student Reports
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Generate and export customizable reports for students and classes
              </p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}