import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFormValidation } from '../../hooks/useFormValidation';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Toast } from '../../components/ui/Toast';
import { CommandBar } from '../../components/CommandBar';
import { AppError } from '../../types/domain';

interface LoginFormData {
  usernameOrEmail: string;
  password: string;
  rememberMe: boolean;
}

/**
 * /login — design.md §10 (auth-page conventions) + Phase 2.
 *
 * Public page (no AppLayout): renders its own `<CommandBar variant="public">`
 * and `<main id="main-content">` (the global skip-link target).
 *
 * Redirect rules:
 *  - Already authenticated -> `?from=` query param or `/app` (design.md §6).
 *  - On submit success -> same `from` resolution. RequireAuth and
 *    ApiClientSync write `?from=<path>` to the URL, which we read via
 *    useSearchParams (NOT location.state — that was the buggy old path).
 *  - 401 (wrong credentials) -> inline error. Network error -> Toast.
 */
export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const fromParam = searchParams.get('from');
  // Validate the redirect target so we never bounce back to /login itself.
  const safeFrom =
    fromParam && fromParam !== '/login' && fromParam.startsWith('/app')
      ? fromParam
      : '/app';

  const { values, errors, touched, handleChange, handleBlur, validate } = useFormValidation<LoginFormData>(
    {
      usernameOrEmail: '',
      password: '',
      rememberMe: true,
    },
    [
      {
        field: 'usernameOrEmail',
        validate: (value) => {
          if (!value || value.trim() === '') return '请输入用户名或邮箱';
          return null;
        },
        trigger: 'blur',
      },
      {
        field: 'password',
        validate: (value) => {
          if (!value || value.trim() === '') return '请输入密码';
          return null;
        },
        trigger: 'blur',
      },
    ]
  );

  // Redirect if already authenticated.
  if (isAuthenticated) {
    return <Navigate to={safeFrom} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      await login(values.usernameOrEmail.trim(), values.password, values.rememberMe);
      // Navigation happens via the <Navigate> above once auth state updates.
    } catch (error) {
      setIsLoading(false);
      if (error instanceof AppError) {
        if (error.type === 'auth') {
          // 401 / 403: bad credentials — persist inline so the user can fix it.
          setServerError('用户名或密码错误');
        } else if (error.type === 'network') {
          // Transient infrastructure failure — Toast, keep the form editable.
          setToast({
            message: '无法连接到服务器，请检查网络后重试',
            type: 'error',
          });
        } else {
          setServerError(error.message || '登录失败，请稍后重试');
        }
      } else {
        setServerError('登录失败，请稍后重试');
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <CommandBar variant="public" />

      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-[420px]">
          {/* Header */}
          <div className="mb-7">
            <h1 className="text-[26px] md:text-[28px] font-semibold tracking-tight text-ink">
              欢迎回来
            </h1>
            <p className="mt-1.5 text-[13.5px] text-mute">登录成公，继续你的申论批改训练。</p>
          </div>

          {/* Form card */}
          <div className="rounded-lg border border-line bg-paper p-6 md:p-7 shadow-[0_10px_30px_-12px_oklch(0.24_0.02_262/0.10)]">
            {serverError && (
              <div
                role="alert"
                className="mb-5 p-3 rounded-md border border-mark/30 bg-mark-soft/60"
              >
                <p className="text-[13px] text-mark leading-relaxed">{serverError}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <Input
                label="用户名或邮箱"
                type="text"
                placeholder="请输入用户名或邮箱"
                value={values.usernameOrEmail}
                onChange={(e) => handleChange('usernameOrEmail', e.target.value)}
                onBlur={() => handleBlur('usernameOrEmail')}
                error={touched.usernameOrEmail ? errors.usernameOrEmail : undefined}
                disabled={isLoading}
                autoComplete="username"
                autoFocus
              />

              <Input
                label="密码"
                type={showPassword ? 'text' : 'password'}
                placeholder="请输入密码"
                value={values.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                error={touched.password ? errors.password : undefined}
                disabled={isLoading}
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((show) => !show)}
                    className="grid place-items-center w-8 h-8 rounded text-faint hover:text-ink transition-ui"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                        <path d="M3 3l18 18" strokeLinecap="round" />
                        <path d="M10.6 5.1A10.9 10.9 0 0112 5c5 0 9.3 3.1 11 7.5a11.4 11.4 0 01-3.3 4.6M6.2 6.2C4 7.5 2.4 9.5 1.5 11.5 3.2 16 7.5 19 12 19c1.2 0 2.4-.2 3.5-.6" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M9.9 9.9a3 3 0 104.2 4.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
                        <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                }
              />

              <div className="flex items-center">
                <label
                  htmlFor="remember-me"
                  className="flex items-center gap-2 cursor-pointer p-2 -m-2 rounded-md hover:bg-panel/60 transition-ui"
                >
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={values.rememberMe}
                    onChange={(e) => handleChange('rememberMe', e.target.checked)}
                    disabled={isLoading}
                    className="h-4 w-4 rounded border-line text-mark focus:ring-mark cursor-pointer"
                  />
                  <span className="text-[13px] text-mute">记住我（30 天内免登录）</span>
                </label>
              </div>

              <Button type="submit" className="w-full" isLoading={isLoading}>
                登录
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-line text-center">
              <p className="text-[13px] text-mute">
                还没有账号？{' '}
                <Link to="/register" className="text-oxblood hover:text-oxblood-ink font-medium transition-ui">
                  立即注册
                </Link>
              </p>
            </div>
          </div>

          {/* Subtle footnote: this is a public page; reinforce trust */}
          <p className="mt-5 text-center text-[12px] text-mute leading-relaxed">
            注册后可接入你自己的 OpenAI 兼容模型，批改历史仅保存在你的账号下。
          </p>
        </div>
      </main>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
