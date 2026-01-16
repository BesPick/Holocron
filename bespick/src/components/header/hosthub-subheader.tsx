'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import type { ComponentType } from 'react';
import { useUser } from '@clerk/nextjs';
import {
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Settings,
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
  const isAdmin =
    (user?.publicMetadata?.role as string | null | undefined) === 'admin';

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

  return (
    <div className='mb-8 rounded-2xl border border-border bg-card/70 px-5 py-4 shadow-sm backdrop-blur'>
      <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
        <div>
          <h2 className='mt-1 text-xl font-semibold text-foreground'>
            HostHub
          </h2>
        </div>
        <nav className='flex flex-wrap items-center gap-2'>
          {navItems
            .filter((item) => (item.adminOnly ? isAdmin : true))
            .map((item) => {
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
      <div className='mt-4 flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700'>
        <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' aria-hidden={true} />
        <span>
          HostHub is still in development. None of the information shown is accurate. Expect frequent changes.
        </span>
      </div>
    </div>
  );
}
