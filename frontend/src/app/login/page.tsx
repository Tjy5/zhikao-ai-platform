import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useFormValidation } from '../../hooks/useFormValidation';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import { AppError } from '../../types/domain';

interface LoginFormData {
  usernameOrEmail: string;
  password: string;
  rememberMe: boolean;
}

interface LoginLocationState {
  from?: { pathname?: string };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Redirect if already authenticated
  if (isAuthenticated) {
    const from = (location.state as LoginLocationState | null)?.from?.pathname || '/app/writing';
    navigate(from, { replace: true });
  }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      await login(values.usernameOrEmail.trim(), values.password, values.rememberMe);
      const from = (location.state as LoginLocationState | null)?.from?.pathname || '/app/writing';
      navigate(from, { replace: true });
    } catch (error) {
      setIsLoading(false);
      if (error instanceof AppError) {
        if (error.type === 'auth') {
          setServerError('用户名或密码错误');
        } else if (error.type === 'network') {
          setServerError('无法连接到服务器，请检查网络');
        } else {
          setServerError(error.message || '登录失败，请稍后重试');
        }
      } else {
        setServerError('登录失败，请稍后重试');
      }
    }
  };

  return (
    <div className="min-h-screen bg-paper-white flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-medium text-deep-ink">登录</h1>
          <p className="mt-2 text-slate-gray">欢迎回到墨评AI</p>
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
              type="password"
              placeholder="请输入密码"
              value={values.password}
              onChange={(e) => handleChange('password', e.target.value)}
              onBlur={() => handleBlur('password')}
              error={touched.password ? errors.password : undefined}
              disabled={isLoading}
              autoComplete="current-password"
            />

            <div className="flex items-center">
              <input
                id="remember-me"
                type="checkbox"
                checked={values.rememberMe}
                onChange={(e) => handleChange('rememberMe', e.target.checked)}
                className="h-4 w-4 text-vermilion focus:ring-vermilion border-slate-gray/30 rounded"
                disabled={isLoading}
              />
              <label htmlFor="remember-me" className="ml-2 text-sm text-slate-gray">
                记住我
              </label>
            </div>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              登录
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-gray">
              还没有账号？{' '}
              <Link to="/register" className="text-vermilion hover:underline font-medium">
                立即注册
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
