import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';

import { useAuth } from '../../auth/AuthContext';
import InkWashShell from '../../components/InkWashShell';

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/writing';
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(next, { replace: true });
    }
  }, [isAuthenticated, navigate, next]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login({
        username_or_email: usernameOrEmail,
        password,
      });
      navigate(next, { replace: true });
    } catch {
      setError('登录失败，请检查账号和密码');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InkWashShell
      tone='form'
      title='登录'
      context='登录'
      description='登录后进入申论批改、复盘档案和模型设置，继续你的公考备考节奏。'
    >
      <form
        onSubmit={handleSubmit}
        className='retained-form-card mx-auto mt-6 max-w-xl p-6 sm:p-8'
      >
        <div className='grid gap-5'>
          <label className='grid gap-2 font-kaishu text-sm text-ink'>
            账号或邮箱
            <input
              value={usernameOrEmail}
              onChange={event => setUsernameOrEmail(event.target.value)}
              className='retained-input rounded-[6px] px-4 py-3 font-sans text-base outline-none'
              autoComplete='username'
              required
            />
          </label>
          <label className='grid gap-2 font-kaishu text-sm text-ink'>
            密码
            <input
              type='password'
              value={password}
              onChange={event => setPassword(event.target.value)}
              className='retained-input rounded-[6px] px-4 py-3 font-sans text-base outline-none'
              autoComplete='current-password'
              required
            />
          </label>
          {error && (
            <p
              role='alert'
              className='rounded-[6px] border border-seal-red/30 bg-seal-red/8 px-4 py-2 font-kaishu text-sm text-seal-red'
            >
              {error}
            </p>
          )}
          <button
            type='submit'
            disabled={submitting}
            className='ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border border-ink bg-ink px-5 py-3 font-kaishu text-base text-paper transition hover:bg-ink-light disabled:opacity-60'
          >
            <LogIn className='h-4 w-4' aria-hidden='true' />
            {submitting ? '登录中' : '登录'}
          </button>
          <Link
            to={`/register?next=${encodeURIComponent(next)}`}
            className='ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border border-ink-light/20 bg-paper-rice/82 px-5 py-3 font-kaishu text-base text-ink transition hover:bg-paper'
          >
            <UserPlus className='h-4 w-4' aria-hidden='true' />
            注册账号
          </Link>
        </div>
      </form>
      <p className='mx-auto mt-5 max-w-xl text-center font-kaishu text-xs text-ink-wash'>
        会话状态：{isAuthenticated ? '已登录' : '待登录'}
      </p>
    </InkWashShell>
  );
}
