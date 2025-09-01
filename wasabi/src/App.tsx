import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStore } from './store';
import { InstructorNameProvider } from './contexts/InstructorNameContext';
import Layout from './shared/components/Layout';
import ProtectedRoute from './shared/components/ProtectedRoute';
import LoginPage from './features/auth/LoginPage';
import StudentSearch from './features/students/StudentSearch';
import AdminDashboard from './features/admin/AdminDashboard';
import StudentReportsPage from './features/reports/StudentReportsPage';
import ClassAnalyticsPage from './features/analytics/ClassAnalyticsPage';
import GradeLevelAnalyticsPage from './features/analytics/GradeLevelAnalyticsPage';
import FlaggingSystemPage from './features/flagging/FlaggingSystemPage';
import AIAssistantPage from './features/ai-assistant/AIAssistantPage';
import SOBAObservations from './pages/SOBAObservations';
import SOBAObservationForm from './pages/SOBAObservationForm';
import SOBAObservationDetail from './pages/SOBAObservationDetail';
import SOBAAnalytics from './pages/SOBAAnalytics';
import ExamAnalytics from './pages/ExamAnalytics';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  const theme = useStore((state) => state.theme);
  const currentUser = useStore((state) => state.currentUser);
  const logout = useStore((state) => state.logout);
  const setNoriMinimized = useStore((state) => state.setNoriMinimized);

  // Add logout function to global window object for dev testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).wasabiLogout = logout;
      console.log('🔐 Dev tool: Use window.wasabiLogout() to test logout functionality');
    }
  }, [logout]);

  useEffect(() => {
    // Apply theme on mount
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  useEffect(() => {
    // Ensure Nori bubble is visible by default (minimized = true means bubble is shown)
    setNoriMinimized(true);
  }, [setNoriMinimized]);

  return (
    <QueryClientProvider client={queryClient}>
      <InstructorNameProvider>
        <Router>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout>
                <StudentSearch />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/students" element={
            <ProtectedRoute>
              <Layout>
                <div>Students Page</div>
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute>
              <Layout>
                <StudentReportsPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/flagging" element={
            <ProtectedRoute>
              <Layout>
                <FlaggingSystemPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/ai-assistant" element={
            <ProtectedRoute>
              <Layout>
                <AIAssistantPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/class-analytics" element={
            <ProtectedRoute>
              <Layout>
                <ClassAnalyticsPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/grade-analytics" element={
            <ProtectedRoute>
              <Layout>
                <GradeLevelAnalyticsPage />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/exam-analytics" element={
            <ProtectedRoute>
              <Layout>
                <ExamAnalytics />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute>
              <Layout>
                <AdminDashboard />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/soba" element={
            <ProtectedRoute>
              <Layout>
                <SOBAObservations />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/soba/new" element={
            <ProtectedRoute>
              <Layout>
                <SOBAObservationForm />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/soba/:id" element={
            <ProtectedRoute>
              <Layout>
                <SOBAObservationDetail />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/soba/:id/edit" element={
            <ProtectedRoute>
              <Layout>
                <SOBAObservationForm />
              </Layout>
            </ProtectedRoute>
          } />
          <Route path="/soba/analytics" element={
            <ProtectedRoute>
              <Layout>
                <SOBAAnalytics />
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
        </Router>
      </InstructorNameProvider>
    </QueryClientProvider>
  );
}

export default App
