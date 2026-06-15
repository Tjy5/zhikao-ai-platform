import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import RequireAuth from './components/RequireAuth';
import RequireAdmin from './components/RequireAdmin';
import AppLayout from './components/AppLayout';
import AdminLayout from './components/AdminLayout';
import ApiClientSync from './components/ApiClientSync';

// Pages
import LandingPage from './app/page';
import LoginPage from './app/login/page';
import RegisterPage from './app/register/page';
import DashboardPage from './app/dashboard/page';
import StudyPage from './app/study/page';
import WritingPage from './app/writing/page';
import GradingPage from './app/writing/grading/page';
import HistoryPage from './app/history/page';
import SettingsPage from './app/settings/page';
import AdminDashboardPage from './app/admin/page';
import AdminStudyPage from './app/admin/study/page';
import AdminStudyReviewsPage from './app/admin/study/reviews/page';
import AdminStudySectionPage from './app/admin/study/section/page';
import AdminUsersPage from './app/admin/users/page';
import AdminSettingsPage from './app/admin/settings/page';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        {/*
          Wire the apiClient 401 hook to router navigation (no window.location
          hard jump — design.md §7/§8). Must live inside <BrowserRouter> and
          under <AuthProvider>.
        */}
        <ApiClientSync />

        {/*
          SettingsProvider caches AI config (5-min TTL) so every /app surface —
          the CommandBar readiness dot, the dashboard stat bar, and the
          SettingsConsole — shares one source of truth (design.md §7). Mounted
          inside <BrowserRouter> (no router dep) and under <AuthProvider>.
        */}
        <SettingsProvider>

        {/* Skip to main content (a11y) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-shell focus:text-shell-txt focus:rounded-md focus:shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.30)]"
        >
          跳转到主内容
        </a>

        <Routes>
          {/* Public routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/*
            Protected workspace. All /app/* share the AppLayout shell
            (dark CommandBar + main region). RequireAuth falls back to
            /login?from=<path> when unauthenticated (design.md §6).
          */}
          <Route
            path="/app"
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="study" element={<StudyPage />} />
            <Route path="writing" element={<WritingPage />} />
            <Route path="writing/grading" element={<GradingPage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Protected admin workspace. RequireAuth preserves /login?from=...;
              RequireAdmin then redirects authenticated non-admin users to /app. */}
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminLayout />
                </RequireAdmin>
              </RequireAuth>
            }
          >
            <Route index element={<AdminDashboardPage />} />
            <Route path="study" element={<AdminStudyPage />} />
            <Route path="study/reviews" element={<AdminStudyReviewsPage />} />
            <Route path="study/sections/:key" element={<AdminStudySectionPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          {/* Legacy compat redirects (design.md §6) */}
          <Route path="/writing" element={<Navigate to="/app/writing" replace />} />
          <Route path="/history" element={<Navigate to="/app/history" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </SettingsProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
