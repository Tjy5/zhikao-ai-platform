import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { GraduationCap, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TopNavigationLink } from './topNavigation';
import { isRetainedRouteTopNavLinkActive } from './topNavigation';

export type NavLink = TopNavigationLink;

interface InkWashNavProps {
  variant?: 'dark' | 'light';
  links: readonly NavLink[];
  cta?: { label: string; href: string };
  logoText?: string;
}

function NavItem({
  link,
  className,
  onClick,
}: {
  link: NavLink;
  className: string;
  onClick?: () => void;
}) {
  if (link.href.startsWith('#')) {
    return (
      <a href={link.href} className={className} onClick={onClick}>
        {link.label}
      </a>
    );
  }
  return (
    <Link to={link.href} className={className} onClick={onClick}>
      {link.label}
    </Link>
  );
}

export default function InkWashNav({
  variant = 'light',
  links,
  cta,
  logoText = '智考AI',
}: InkWashNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const isDark = variant === 'dark';

  const isActive = (href: string) =>
    isRetainedRouteTopNavLinkActive(href, location);

  const desktopLinkClass = (href: string) =>
    cn(
      'ink-hover whitespace-nowrap rounded-[6px] px-3 py-2 font-kaishu text-sm font-normal tracking-normal transition duration-300 xl:px-5 xl:py-2.5 xl:text-base',
      isActive(href)
        ? 'bg-civic-blue text-paper shadow-sm'
        : 'text-ink-wash hover:bg-paper hover:text-civic-blue'
    );

  const mobileLinkClass = (href: string) =>
    cn(
      'rounded-[6px] border-l-2 px-4 py-3 font-kaishu text-base transition',
      isActive(href)
        ? 'border-civic-blue bg-civic-blue text-paper'
        : 'text-ink border-transparent hover:bg-paper-ivory'
    );

  return (
    <header className='absolute left-0 right-0 top-0 z-20'>
      <div className='mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-5 pt-6 sm:px-8 lg:px-10'>
        <Link
          to='/'
          className={cn(
            'group flex flex-none items-center gap-3 rounded-[10px] border border-ink-light/10 bg-paper/82 px-3 py-2 font-running-script text-2xl font-normal tracking-normal shadow-sm backdrop-blur transition duration-300 sm:text-3xl',
            isDark
              ? 'text-paper hover:text-paper-rice'
              : 'text-ink hover:text-civic-blue'
          )}
        >
          <span
            aria-hidden='true'
            className='flex h-9 w-9 items-center justify-center rounded-[6px] border border-civic-blue/20 bg-civic-blue text-paper shadow-sm'
          >
            <GraduationCap className='h-5 w-5' aria-hidden='true' />
          </span>
          <span>{logoText}</span>
        </Link>

        <nav
          aria-label='智考AI 导航'
          className='hidden max-w-[calc(100vw-12rem)] flex-wrap items-center justify-center gap-1 rounded-[10px] border border-ink-light/12 bg-paper-rice/86 px-2 py-2 shadow-sm backdrop-blur lg:flex xl:max-w-none'
        >
          {links.map(link => (
            <NavItem
              key={link.label}
              link={link}
              className={desktopLinkClass(link.href)}
            />
          ))}
          {cta && (
            <Link
              to={cta.href}
              className='ink-hover ml-2 whitespace-nowrap rounded-[4px] bg-seal-red px-4 py-2 font-kaishu text-sm text-paper transition duration-300 hover:bg-seal xl:px-5 xl:py-2.5 xl:text-base'
            >
              {cta.label}
            </Link>
          )}
        </nav>

        <button
          type='button'
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? '关闭导航菜单' : '打开导航菜单'}
          onClick={() => setMobileOpen(!mobileOpen)}
          className='inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-ink-light/12 bg-paper/86 text-ink shadow-sm transition-all lg:hidden'
        >
          {mobileOpen ? (
            <X className='h-6 w-6' aria-hidden='true' />
          ) : (
            <Menu className='h-6 w-6' aria-hidden='true' />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className='mx-auto w-full max-w-[1600px] px-5 pb-6 pt-3 sm:px-8 lg:hidden'>
          <nav
            aria-label='智考AI 移动导航'
            className='retained-surface flex flex-col gap-2 rounded-[10px] p-3 text-ink'
          >
            {links.map(link => (
              <NavItem
                key={link.label}
                link={link}
                className={mobileLinkClass(link.href)}
                onClick={() => setMobileOpen(false)}
              />
            ))}
            {cta && (
              <Link
                to={cta.href}
                className='mt-2 rounded-[4px] bg-seal-red px-4 py-3 text-center font-kaishu text-base text-paper'
                onClick={() => setMobileOpen(false)}
              >
                {cta.label}
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
