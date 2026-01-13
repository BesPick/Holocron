'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
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
  Layers,
  Menu,
  Users,
  X,
} from 'lucide-react';

import { HeaderButton } from '@/components/header/header-button';
import {
  GROUP_OPTIONS,
  getPortfoliosForGroup,
  isValidGroup,
  isValidPortfolioForGroup,
  type Group,
  type Portfolio,
} from '@/lib/org';
import { updateMyAssignments } from '@/server/actions/assignments';

type AssignmentInfoProps = {
  groupLabel: string;
  portfolioLabel: string;
  onEditGroup: () => void;
  onEditPortfolio: () => void;
};

function UserAssignmentMenu({
  groupLabel,
  portfolioLabel,
  onEditGroup,
  onEditPortfolio,
}: AssignmentInfoProps) {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Action
          label={`Group: ${groupLabel}`}
          labelIcon={<Users className='h-4 w-4' aria-hidden='true' />}
          onClick={onEditGroup}
        />
        <UserButton.Action
          label={`Portfolio: ${portfolioLabel}`}
          labelIcon={<Layers className='h-4 w-4' aria-hidden='true' />}
          onClick={onEditPortfolio}
        />
      </UserButton.MenuItems>
    </UserButton>
  );
}

export function HeaderActions() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [assignmentFocus, setAssignmentFocus] = useState<
    'group' | 'portfolio'
  >('group');
  const [assignmentGroup, setAssignmentGroup] = useState<Group | ''>('');
  const [assignmentPortfolio, setAssignmentPortfolio] = useState<
    Portfolio | ''
  >('');
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [isAssignmentPending, startAssignmentTransition] = useTransition();

  const isAdmin =
    (user?.publicMetadata?.role as string | null | undefined) === 'admin';
  const rawGroup = user?.publicMetadata?.group;
  const normalizedGroup = isValidGroup(rawGroup) ? rawGroup : null;
  const rawPortfolio = user?.publicMetadata?.portfolio;
  const normalizedPortfolio =
    normalizedGroup &&
    isValidPortfolioForGroup(normalizedGroup, rawPortfolio)
      ? rawPortfolio
      : null;
  const groupLabel = normalizedGroup ?? 'No group assigned';
  const portfolioLabel = normalizedPortfolio ?? 'No portfolio assigned';

  const openAssignmentModal = (focus: 'group' | 'portfolio') => {
    setAssignmentGroup(normalizedGroup ?? '');
    setAssignmentPortfolio(normalizedPortfolio ?? '');
    setAssignmentFocus(focus);
    setAssignmentError(null);
    setIsAssignmentOpen(true);
  };

  const closeAssignmentModal = () => {
    if (isAssignmentPending) return;
    setIsAssignmentOpen(false);
    setAssignmentError(null);
  };

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
  const availablePortfolios = assignmentGroup
    ? getPortfoliosForGroup(assignmentGroup)
    : [];
  const portfolioSelectDisabled =
    !assignmentGroup || availablePortfolios.length === 0;

  const handleAssignmentGroupChange = (value: string) => {
    const nextGroup = value ? (value as Group) : '';
    const nextPortfolios = nextGroup ? getPortfoliosForGroup(nextGroup) : [];
    setAssignmentGroup(nextGroup);
    setAssignmentPortfolio((current) =>
      current && nextPortfolios.includes(current as Portfolio) ? current : '',
    );
  };

  const handleAssignmentPortfolioChange = (value: string) => {
    setAssignmentPortfolio(value ? (value as Portfolio) : '');
  };

  const handleAssignmentSave = () => {
    startAssignmentTransition(async () => {
      setAssignmentError(null);
      const result = await updateMyAssignments({
        group: assignmentGroup ? assignmentGroup : null,
        portfolio: assignmentPortfolio ? assignmentPortfolio : null,
      });
      if (!result.success) {
        setAssignmentError(result.message);
        return;
      }
      await user?.reload();
      setIsAssignmentOpen(false);
    });
  };

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
                <UserAssignmentMenu
                  groupLabel={groupLabel}
                  portfolioLabel={portfolioLabel}
                  onEditGroup={() => openAssignmentModal('group')}
                  onEditPortfolio={() => openAssignmentModal('portfolio')}
                />
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
            <UserAssignmentMenu
              groupLabel={groupLabel}
              portfolioLabel={portfolioLabel}
              onEditGroup={() => openAssignmentModal('group')}
              onEditPortfolio={() => openAssignmentModal('portfolio')}
            />
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

      {isAssignmentOpen ? (
        <div
          className='fixed inset-0 z-60 grid place-items-center bg-black/50 p-4'
          role='dialog'
          aria-modal='true'
          aria-label='Update assignments'
          onClick={closeAssignmentModal}
        >
          <div
            className='w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl'
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className='text-lg font-semibold text-foreground'>
              Update assignments
            </h2>
            <p className='mt-1 text-sm text-muted-foreground'>
              Choose a group and portfolio for your profile.
            </p>

            <div className='mt-5 space-y-4'>
              <label className='flex flex-col gap-2 text-sm text-foreground'>
                Group
                <select
                  value={assignmentGroup}
                  onChange={(event) =>
                    handleAssignmentGroupChange(event.target.value)
                  }
                  autoFocus={assignmentFocus === 'group'}
                  className='rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                >
                  <option value=''>No group assigned</option>
                  {GROUP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className='flex flex-col gap-2 text-sm text-foreground'>
                Portfolio
                <select
                  value={assignmentPortfolio}
                  onChange={(event) =>
                    handleAssignmentPortfolioChange(event.target.value)
                  }
                  disabled={portfolioSelectDisabled}
                  autoFocus={assignmentFocus === 'portfolio'}
                  className='rounded-md border border-border bg-background px-3 py-2 text-sm shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                >
                  <option value=''>No portfolio assigned</option>
                  {availablePortfolios.map((portfolioOption) => (
                    <option key={portfolioOption} value={portfolioOption}>
                      {portfolioOption}
                    </option>
                  ))}
                </select>
                <span className='text-xs text-muted-foreground'>
                  {portfolioSelectDisabled
                    ? 'Select a group with portfolios to enable this field.'
                    : ''}
                </span>
              </label>
            </div>

            {assignmentError ? (
              <p className='mt-4 text-sm text-destructive'>
                {assignmentError}
              </p>
            ) : null}

            <div className='mt-6 flex items-center justify-end gap-3'>
              <button
                type='button'
                onClick={closeAssignmentModal}
                className='rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                disabled={isAssignmentPending}
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleAssignmentSave}
                className='rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                disabled={isAssignmentPending}
              >
                {isAssignmentPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
