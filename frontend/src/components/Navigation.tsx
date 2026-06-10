import { useState } from 'react';
import { GraduationCap, Menu, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  getRetainedRouteTopNavLinks,
  isRetainedRouteTopNavLinkActive,
} from './topNavigation';

export default function Navigation() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const primaryItems = getRetainedRouteTopNavLinks(location.pathname);

  const isActive = (href: string) =>
    isRetainedRouteTopNavLinkActive(href, location);

  const linkClass = (href: string) =>
    cn(
      'rounded-md px-4 py-2 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      'border',
      isActive(href)
        ? 'border-civic-blue bg-civic-blue text-paper shadow-sm'
        : 'border-transparent text-ink hover:border-civic-blue/30 hover:bg-paper-ivory hover:shadow-sm'
    );

  return (
    <nav className='fixed left-0 right-0 top-0 z-50 border-b border-ink-light/20 bg-paper-rice/90 backdrop-blur-md shadow-sm'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <div className='flex h-20 items-center justify-between gap-4'>
          <Link
            to='/'
            className='group flex flex-shrink-0 items-center gap-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <span
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-xl text-lg font-kaishu transition-transform group-hover:-rotate-3',
                'border border-civic-blue bg-civic-blue text-paper shadow-sm'
              )}
            >
              <GraduationCap className='h-5 w-5' aria-hidden='true' />
            </span>
            <span
              className={cn(
                'font-cursive-title text-2xl font-normal',
                'text-ink'
              )}
            >
              智考AI
            </span>
          </Link>

          <div className='hidden items-center gap-2 md:flex'>
            {primaryItems.map(item => (
              <Link
                key={item.href}
                to={item.href}
                className={linkClass(item.href)}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <button
            type='button'
            aria-expanded={isMobileMenuOpen}
            aria-controls='mobile-navigation'
            aria-label={isMobileMenuOpen ? '关闭导航菜单' : '打开导航菜单'}
            onClick={() => setIsMobileMenuOpen(open => !open)}
            className={cn(
              'inline-flex h-11 w-11 items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seal/30 md:hidden',
              'border border-ink-light/20 bg-paper-rice text-ink shadow-sm hover:bg-paper-ivory'
            )}
          >
            {isMobileMenuOpen ? (
              <X className='h-6 w-6' aria-hidden='true' />
            ) : (
              <Menu className='h-6 w-6' aria-hidden='true' />
            )}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div
            id='mobile-navigation'
            className='border-t border-ink-light/20 py-4 md:hidden'
          >
            <div className='grid gap-2'>
              {primaryItems.map(item => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={linkClass(item.href)}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
