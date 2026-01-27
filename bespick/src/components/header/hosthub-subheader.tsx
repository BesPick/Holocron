'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Menu,
  Settings,
  X,
} from 'lucide-react';

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  adminOnly?: boolean;
  matches?: (pathname: string) => boolean;
};

const baseClasses =
  'inline-flex items-center gap-2 rounded-full border border-border bg-secondary/70 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background';
const activeClasses = 'border-primary/30 bg-primary/15 text-primary';

export function HostHubSubHeader() {
  const pathname = usePathname();
  const { user } = useUser();
  const [mobileState, setMobileState] = useState(() => ({
    open: false,
    pathname,
  }));
  const role = user?.publicMetadata?.role as string | null | undefined;
  const isAdmin =
    role === 'admin' || role === 'moderator' || role === 'scheduler';

  const navItems = useMemo<NavItem[]>(
    () => [
      {
        href: '/hosthub',
        label: 'My Schedule',
        icon: CalendarCheck,
        matches: (path) => path === '/hosthub',
      },
      {
        href: '/hosthub/calendar',
        label: 'Calendar',
        icon: CalendarDays,
      },
      {
        href: '/hosthub/docs',
        label: 'Docs',
        icon: BookOpen,
      },
      {
        href: '/hosthub/schedule',
        label: 'Schedule',
        icon: Settings,
        adminOnly: true,
      },
    ],
    [],
  );
  const visibleNavItems = navItems.filter((item) =>
    item.adminOnly ? isAdmin : true,
  );

  const mobileOpen =
    mobileState.pathname === pathname && mobileState.open;
  const toggleMobile = () => {
    setMobileState((prev) => {
      const samePath = prev.pathname === pathname;
      return {
        pathname,
        open: samePath ? !prev.open : true,
      };
    });
  };

  return (
    <div className='mb-8 rounded-2xl border border-border bg-card/70 px-5 py-4 shadow-sm backdrop-blur'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex items-center justify-between gap-3'>
          <h2 className='mt-1 text-xl font-semibold text-foreground'>
            HostHub
          </h2>
          <button
            type='button'
            onClick={toggleMobile}
            aria-expanded={mobileOpen}
            aria-controls='hosthub-subheader-nav'
            className='inline-flex items-center justify-center rounded-full border border-border bg-background/80 p-2 text-foreground transition hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:hidden'
          >
            {mobileOpen ? (
              <X className='h-4 w-4' aria-hidden={true} />
            ) : (
              <Menu className='h-4 w-4' aria-hidden={true} />
            )}
          </button>
        </div>
        <nav className='hidden flex-wrap items-center gap-2 sm:flex'>
          {visibleNavItems.map((item) => {
            const isActive = item.matches
              ? item.matches(pathname)
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={`${baseClasses} ${isActive ? activeClasses : ''}`}
              >
                <Icon className='h-4 w-4' aria-hidden={true} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <nav
        id='hosthub-subheader-nav'
        className={`mt-4 flex flex-col gap-2 sm:hidden ${
          mobileOpen ? 'block' : 'hidden'
        }`}
      >
        {visibleNavItems.map((item) => {
          const isActive = item.matches
            ? item.matches(pathname)
            : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`${baseClasses} w-full justify-between ${
                isActive ? activeClasses : ''
              }`}
            >
              <span className='inline-flex items-center gap-2'>
                <Icon className='h-4 w-4' aria-hidden={true} />
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className='mt-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700'>
        <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden={true} />
        <span>
          HostHub is still in development. None of the information shown is accurate. Expect frequent changes.
        </span>
      </div>
    </div>
  );
}
