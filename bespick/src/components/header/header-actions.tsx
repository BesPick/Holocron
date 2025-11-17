'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  UserButton,
  useUser,
} from '@clerk/nextjs';
import {
  Archive,
  CalendarClock,
  CirclePlus,
  CreditCard,
  Menu,
  Users,
  X,
} from 'lucide-react';

import { HeaderButton } from '@/components/header/header-button';

export function HeaderActions() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const isAdmin =
    (user?.publicMetadata?.role as string | null | undefined) === 'admin';

  const navItems = useMemo(() => {
    const items = [
      { href: '/archive', label: 'Archive', icon: Archive },
      { href: '/boost', label: 'Boost', icon: CreditCard },
    ];

    if (isAdmin) {
      items.unshift(
        { href: '/admin/create', label: 'Create', icon: CirclePlus },
        { href: '/admin/roster', label: 'Roster', icon: Users },
        { href: '/admin/scheduled', label: 'Scheduled', icon: CalendarClock }
      );
    }

    return items;
  }, [isAdmin]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleClick = (event: MouseEvent) => {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const toggleMenu = () => setOpen((prev) => !prev);
  const closeMenu = () => setOpen(false);

  return (
    <>
      <div className='hidden items-center gap-3 md:flex'>
        <ClerkLoaded>
          <div className='flex items-center gap-3'>
            <SignedIn>
              <div className='flex items-center gap-3'>
                {navItems.map(({ href, label, icon }) => (
                  <HeaderButton
                    key={href}
                    href={href}
                    label={label}
                    icon={icon}
                  />
                ))}
                <UserButton/>
              </div>
            </SignedIn>
          </div>
        </ClerkLoaded>
        <ClerkLoading>
          <div className='h-14 w-14 rounded-full bg-muted animate-pulse' />
        </ClerkLoading>
      </div>

      <div className='flex items-center gap-2 md:hidden'>
        <ClerkLoaded>
          <button
            type='button'
            onClick={toggleMenu}
            aria-expanded={open}
            aria-controls='mobile-header-menu'
            className='inline-flex items-center justify-center rounded-md border border-border bg-secondary/80 p-2 text-foreground transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          >
            {open ? (
              <X className='h-5 w-5' aria-hidden='true' />
            ) : (
              <Menu className='h-5 w-5' aria-hidden='true' />
            )}
            <span className='sr-only'>Toggle navigation</span>
          </button>
          <SignedIn>
            <UserButton/>
          </SignedIn>
        </ClerkLoaded>
        <ClerkLoading>
          <div className='h-10 w-10 rounded-md bg-muted animate-pulse' />
        </ClerkLoading>
      </div>

      {open && (
        <div
          ref={menuRef}
          id='mobile-header-menu'
          className='absolute right-0 top-16 z-50 w-60 space-y-3 rounded-lg border border-border bg-popover p-4 shadow-lg md:hidden'
        >
          <ClerkLoaded>
            <div className='flex flex-col gap-3'>
              <SignedIn>
                {navItems.map(({ href, label, icon }) => (
                  <HeaderButton
                    key={href}
                    href={href}
                    label={label}
                    icon={icon}
                    className='w-full'
                    onClick={closeMenu}
                  />
                ))}
              </SignedIn>
            </div>
          </ClerkLoaded>
          <ClerkLoading>
            <div className='h-14 w-full rounded-md bg-muted animate-pulse' />
          </ClerkLoading>
        </div>
      )}
    </>
  );
}
