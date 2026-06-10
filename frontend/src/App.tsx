import { Link, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import InkWashShell from './components/InkWashShell';
import RequireAuth from './components/RequireAuth';
import { AuthProvider } from './auth/AuthContext';
import HomePage from './app/page';
import WritingPage from './pages/WritingPage';
import HistoryPage from './pages/HistoryPage';
import ShenlunStudyPage from './pages/ShenlunStudyPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import SettingsPage from './pages/settings/SettingsPage';

function NotFoundPage() {
  return (
    <InkWashShell
      tone='fallback'
      title='智考AI'
      context='页面未找到'
      description='页面未找到，请从导航选择入口或返回首页继续学习。'
    >
      <div className='mt-8 flex flex-wrap justify-center gap-3'>
        <Link
          to='/'
          className='ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border border-ink bg-ink px-5 py-3 font-kaishu text-base text-paper shadow-sm transition hover:bg-ink-light'
        >
          返回首页
        </Link>
        <Link
          to='/writing'
          className='ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border border-ink-light/25 bg-paper-rice/82 px-5 py-3 font-kaishu text-base text-ink transition hover:bg-paper'
        >
          开始申论批改
        </Link>
      </div>
    </InkWashShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className='min-h-screen bg-background text-foreground'>
          <Routes>
            <Route path='/' element={<HomePage />} />
            <Route path='/shenlun-study' element={<ShenlunStudyPage />} />
            <Route path='/login' element={<LoginPage />} />
            <Route path='/register' element={<RegisterPage />} />
            <Route
              path='/writing'
              element={
                <RequireAuth>
                  <WritingPage />
                </RequireAuth>
              }
            />
            <Route
              path='/history'
              element={
                <RequireAuth>
                  <HistoryPage />
                </RequireAuth>
              }
            />
            <Route
              path='/settings'
              element={
                <RequireAuth>
                  <SettingsPage />
                </RequireAuth>
              }
            />
            <Route path='*' element={<NotFoundPage />} />
          </Routes>
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
