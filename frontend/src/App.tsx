import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import RequireAuth from './components/RequireAuth';

// Pages (to be created)
import HomePage from './app/page';
import LoginPage from './app/login/page';
import RegisterPage from './app/register/page';
import WritingPage from './app/writing/page';
import GradingPage from './app/writing/grading/page';
import HistoryPage from './app/history/page';
import SettingsPage from './app/settings/page';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected routes */}
          <Route
            path="/app/writing"
            element={
              <RequireAuth>
                <WritingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/app/writing/grading"
            element={
              <RequireAuth>
                <GradingPage />
              </RequireAuth>
            }
          />
          <Route
            path="/app/history"
            element={
              <RequireAuth>
                <HistoryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/app/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
