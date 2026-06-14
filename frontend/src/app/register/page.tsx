import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFormValidation } from '../../hooks/useFormValidation';
import { isValidEmail, isValidUsername, isValidPassword } from '../../utils/validation';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { AppError } from '../../types/domain';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
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
            return '用户名长度3-30字符，只能包含字母、数字、下划线、短横线';
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
          if (!isValidPassword(value)) return '密码至少6个字符';
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

  // Redirect if already authenticated (using Navigate component)
  if (isAuthenticated) {
    return <Navigate to={redirectToSettings ? '/app/settings' : '/app/writing'} replace />;
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
      // Navigation will happen via the Navigate component above after auth state updates
    } catch (error) {
      setIsLoading(false);
      setRedirectToSettings(false);
      if (error instanceof AppError) {
        const details = error.details as { status?: unknown } | undefined;
        if (details?.status === 409) {
          setServerError('用户名或邮箱已存在');
        } else if (error.type === 'network') {
          setServerError('无法连接到服务器，请检查网络');
        } else {
          setServerError(error.message || '注册失败，请稍后重试');
        }
      } else {
        setServerError('注册失败，请稍后重试');
      }
    }
  };

  return (
    <main id="main-content" className="min-h-screen bg-paper-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-medium text-deep-ink">注册</h1>
          <p className="mt-2 text-slate-gray">开始使用墨评AI</p>
        </div>

        {/* Form */}
        <div className="bg-card-cream rounded-lg shadow-md p-8">
          {serverError && (
            <div className="mb-6 p-4 bg-error-crimson/10 border border-error-crimson/30 rounded-md">
              <p className="text-sm text-error-crimson">{serverError}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
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
              type="password"
              placeholder="至少6个字符"
              value={values.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              error={touched.password ? errors.password : undefined}
              disabled={isLoading}
              autoComplete="new-password"
            />

            <Input
              label="确认密码"
              type="password"
              placeholder="再次输入密码"
              value={values.confirmPassword}
              onChange={(e) => handleChange('confirmPassword', e.target.value)}
              onBlur={() => handleBlur('confirmPassword')}
              error={touched.confirmPassword ? errors.confirmPassword : undefined}
              disabled={isLoading}
              autoComplete="new-password"
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              注册
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-gray">
              已有账号？{' '}
              <Link to="/login" className="text-vermilion hover:underline font-medium">
                立即登录
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
