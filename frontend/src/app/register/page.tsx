import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFormValidation } from '../../hooks/useFormValidation';
import { isValidEmail, isValidUsername, isValidPassword } from '../../utils/validation';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { Toast } from '../../components/ui/Toast';
import { CommandBar } from '../../components/CommandBar';
import { AppError } from '../../types/domain';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

/**
 * /register — design.md §10 (auth-page conventions) + Phase 2.
 *
 * Public page (no AppLayout): renders its own `<CommandBar variant="public">`
 * and `<main id="main-content">` (the global skip-link target).
 *
 * Redirect rules:
 *  - Already authenticated -> `/app` (design.md §6).
 *  - On submit success -> auto-login (handled by AuthContext.register) ->
 *    `/app/settings` so the user is coached to configure AI before writing.
 *  - 409 conflict (duplicate username/email) -> inline error.
 *  - Network error -> Toast; validation errors -> inline per field.
 */
export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'info' } | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [redirectToSettings, setRedirectToSettings] = useState(false);

  const { values, errors, touched, handleChange, handleBlur, validate } = useFormValidation<RegisterFormData>(
    {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    [
      {
        field: 'username',
        validate: (value) => {
          if (!value || value.trim() === '') return '请输入用户名';
          if (!isValidUsername(value)) {
            return '用户名长度 3-30 字符，只能包含字母、数字、下划线、短横线';
          }
          return null;
        },
        trigger: 'blur',
      },
      {
        field: 'email',
        validate: (value) => {
          if (!value || value.trim() === '') return '请输入邮箱';
          if (!isValidEmail(value)) return '邮箱格式不正确';
          return null;
        },
        trigger: 'blur',
      },
      {
        field: 'password',
        validate: (value) => {
          if (!value) return '请输入密码';
          if (!isValidPassword(value)) return '密码至少 6 个字符';
          return null;
        },
        trigger: 'blur',
      },
      {
        field: 'confirmPassword',
        validate: (value, formData) => {
          if (!value) return '请确认密码';
          if (value !== formData.password) return '两次密码输入不一致';
          return null;
        },
        trigger: 'blur',
      },
    ]
  );

  // Redirect if already authenticated. After a successful submit we set the
  // settings flag so the user is coached to configure AI before writing.
  if (isAuthenticated) {
    return <Navigate to={redirectToSettings ? '/app/settings' : '/app'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);
    setRedirectToSettings(true);

    try {
      await register(
        values.username.trim(),
        values.email.trim().toLowerCase(),
        values.password
      );
      // Navigation happens via the <Navigate> above once auth state updates.
    } catch (error) {
      setIsLoading(false);
      setRedirectToSettings(false);
      if (error instanceof AppError) {
        const details = error.details as { status?: unknown } | undefined;
        if (details?.status === 409) {
          setServerError('该用户名或邮箱已被注册，请直接登录或换一个');
        } else if (error.type === 'network') {
          setToast({
            message: '无法连接到服务器，请检查网络后重试',
            type: 'error',
          });
        } else {
          setServerError(error.message || '注册失败，请稍后重试');
        }
      } else {
        setServerError('注册失败，请稍后重试');
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      <CommandBar variant="public" />

      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-10 md:py-14">
        <div className="w-full max-w-[460px]">
          {/* Header */}
          <div className="mb-7">
            <h1 className="text-[26px] md:text-[28px] font-semibold tracking-tight text-ink">
              创建你的成公账号
            </h1>
            <p className="mt-1.5 text-[13.5px] text-mute leading-relaxed">
              注册后接入你自己的 OpenAI 兼容模型，30 秒拿到第一份结构化批阅。
            </p>
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
                label="用户名"
                type="text"
                placeholder="字母、数字、下划线、短横线"
                value={values.username}
                onChange={(e) => handleChange('username', e.target.value)}
                onBlur={() => handleBlur('username')}
                error={touched.username ? errors.username : undefined}
                disabled={isLoading}
                autoComplete="username"
                autoFocus
              />

              <Input
                label="邮箱"
                type="email"
                placeholder="your@example.com"
                value={values.email}
                onChange={(e) => handleChange('email', e.target.value)}
                onBlur={() => handleBlur('email')}
                error={touched.email ? errors.email : undefined}
                disabled={isLoading}
                autoComplete="email"
              />

              <Input
                label="密码"
                type={showPassword ? 'text' : 'password'}
                placeholder="至少 6 个字符"
                value={values.password}
                onChange={(e) => handleChange('password', e.target.value)}
                onBlur={() => handleBlur('password')}
                error={touched.password ? errors.password : undefined}
                disabled={isLoading}
                autoComplete="new-password"
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

              <Input
                label="确认密码"
                type={showConfirm ? 'text' : 'password'}
                placeholder="再次输入密码"
                value={values.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                error={touched.confirmPassword ? errors.confirmPassword : undefined}
                disabled={isLoading}
                autoComplete="new-password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowConfirm((show) => !show)}
                    className="grid place-items-center w-8 h-8 rounded text-faint hover:text-ink transition-ui"
                    aria-label={showConfirm ? '隐藏密码' : '显示密码'}
                    aria-pressed={showConfirm}
                  >
                    {showConfirm ? (
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

              <Button type="submit" className="w-full" isLoading={isLoading}>
                注册并开始
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-line text-center">
              <p className="text-[13px] text-mute">
                已有账号？{' '}
                <Link to="/login" className="text-oxblood hover:text-oxblood-ink font-medium transition-ui">
                  立即登录
                </Link>
              </p>
            </div>
          </div>

          <p className="mt-5 text-center text-[12px] text-faint leading-relaxed">
            成公不会代你调用付费模型——你填入的 API key 仅用于你自己的批改请求。
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
