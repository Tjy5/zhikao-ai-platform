import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';

import { useAuth } from '../../auth/AuthContext';
import InkWashShell from '../../components/InkWashShell';

export default function RegisterPage() {
  const { isAuthenticated, register } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/writing';
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
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
      await register({ username, email, password });
      navigate(next, { replace: true });
    } catch {
      setError('注册失败，请检查账号、邮箱或密码');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InkWashShell
      tone='form'
      title='注册'
      context='注册'
      description='创建账号后即可保存模型配置、申论批改记录和个人复盘档案。'
    >
      <form
        onSubmit={handleSubmit}
        className='retained-form-card mx-auto mt-6 max-w-xl p-6 sm:p-8'
      >
        <div className='grid gap-5'>
          <label className='grid gap-2 font-kaishu text-sm text-ink'>
            用户名
            <input
              value={username}
              onChange={event => setUsername(event.target.value)}
              className='retained-input rounded-[6px] px-4 py-3 font-sans text-base outline-none'
              autoComplete='username'
              minLength={3}
              required
            />
          </label>
          <label className='grid gap-2 font-kaishu text-sm text-ink'>
            邮箱
            <input
              type='email'
              value={email}
              onChange={event => setEmail(event.target.value)}
              className='retained-input rounded-[6px] px-4 py-3 font-sans text-base outline-none'
              autoComplete='email'
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
              autoComplete='new-password'
              minLength={8}
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
            <UserPlus className='h-4 w-4' aria-hidden='true' />
            {submitting ? '注册中' : '注册'}
          </button>
          <Link
            to={`/login?next=${encodeURIComponent(next)}`}
            className='ink-hover inline-flex items-center justify-center gap-2 rounded-[6px] border border-ink-light/20 bg-paper-rice/82 px-5 py-3 font-kaishu text-base text-ink transition hover:bg-paper'
          >
            <LogIn className='h-4 w-4' aria-hidden='true' />
            登录
          </Link>
        </div>
      </form>
      <p className='mx-auto mt-5 max-w-xl text-center font-kaishu text-xs text-ink-wash'>
        会话状态：{isAuthenticated ? '已登录' : '待登录'}
      </p>
    </InkWashShell>
  );
}
