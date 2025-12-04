import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from './config/firebase';

import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import SessionChecker from './components/SessionChecker';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ApplicantsPage from './pages/ApplicantsPage';
import ApplicantDetailPage from './pages/ApplicantDetailPage';
import QuestionsPage from './pages/QuestionsPage';
import AnswersPage from './pages/AnswersPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const [user, loading] = useAuthState(auth);



  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full" style={{ 
          width: '2rem', 
          height: '2rem', 
          border: '2px solid #e5e7eb', 
          borderTop: '2px solid #009EE4' 
        }}></div>
      </div>
    );
  }

  return (
    <Router>
      <SessionChecker>
        <div className="App">
          <Toaster position="top-right" />
        
        {user ? (
          <div className="flex">
            <Sidebar />
            <div className="flex-1 bg-gray-50 min-h-screen">
              <Routes>
                <Route path="/" element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } />
                <Route path="/applicants" element={
                  <ProtectedRoute>
                    <ApplicantsPage />
                  </ProtectedRoute>
                } />
                <Route path="/applicants/:id" element={
                  <ProtectedRoute>
                    <ApplicantDetailPage />
                  </ProtectedRoute>
                } />
                <Route path="/questions" element={
                  <ProtectedRoute>
                    <QuestionsPage />
                  </ProtectedRoute>
                } />
                <Route path="/answers" element={
                  <ProtectedRoute>
                    <AnswersPage />
                  </ProtectedRoute>
                } />
                <Route path="/reports" element={
                  <ProtectedRoute>
                    <ReportsPage />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                } />
              </Routes>
            </div>
          </div>
        ) : (
          <Routes>
            <Route path="*" element={<LoginPage />} />
          </Routes>
        )}
        </div>
      </SessionChecker>
    </Router>
  );
}

export default App;