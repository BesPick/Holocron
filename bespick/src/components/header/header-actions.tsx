'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  useUser,
} from '@clerk/nextjs';
import {
  Gamepad2,
  HeartPulse,
  Menu,
  Server,
  Users,
  X,
} from 'lucide-react';

import { HeaderButton } from '@/components/header/header-button';
import { AssignmentModal } from '@/components/header/assignment-modal';
import { UserAssignmentMenu } from '@/components/header/user-assignment-menu';
import {
  getPortfoliosForGroup,
  getRanksForCategory,
  isValidGroup,
  isValidPortfolioForGroup,
  isValidRankCategory,
  isValidRankForCategory,
  type Group,
  type Portfolio,
  type Rank,
  type RankCategory,
} from '@/lib/org';
import { updateMyAssignments } from '@/server/actions/assignments';

export function HeaderActions() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [isAssignmentOpen, setIsAssignmentOpen] = useState(false);
  const [assignmentFocus, setAssignmentFocus] = useState<
    'group' | 'portfolio' | 'rankCategory' | 'rank'
  >('group');
  const [assignmentGroup, setAssignmentGroup] = useState<Group | ''>('');
  const [assignmentPortfolio, setAssignmentPortfolio] = useState<
    Portfolio | ''
  >('');
  const [assignmentRankCategory, setAssignmentRankCategory] = useState<
    RankCategory | ''
  >('');
  const [assignmentRank, setAssignmentRank] = useState<Rank | ''>('');
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [isAssignmentPending, startAssignmentTransition] = useTransition();

  const role = user?.publicMetadata?.role as string | null | undefined;
  const isAdmin = role === 'admin';
  const isMoraleAdmin = isAdmin || role === 'moderator';
  const rawGroup = user?.publicMetadata?.group;
  const normalizedGroup = isValidGroup(rawGroup) ? rawGroup : null;
  const rawPortfolio = user?.publicMetadata?.portfolio;
  const normalizedPortfolio =
    normalizedGroup &&
    isValidPortfolioForGroup(normalizedGroup, rawPortfolio)
      ? rawPortfolio
      : null;
  const rawRankCategory = user?.publicMetadata?.rankCategory;
  const normalizedRankCategory = isValidRankCategory(rawRankCategory)
    ? rawRankCategory
    : null;
  const rawRank = user?.publicMetadata?.rank;
  const normalizedRank =
    normalizedRankCategory &&
    isValidRankForCategory(normalizedRankCategory, rawRank)
      ? rawRank
      : null;
  const groupLabel = normalizedGroup ?? 'No group assigned';
  const portfolioLabel = normalizedPortfolio ?? 'No portfolio assigned';
  const rankCategoryLabel = normalizedRankCategory ?? 'No rank category';
  const rankLabel =
    normalizedRank ??
    (normalizedRankCategory === 'Civilian'
      ? 'N/A'
      : 'No rank assigned');

  const openAssignmentModal = (
    focus: 'group' | 'portfolio' | 'rankCategory' | 'rank',
  ) => {
    setAssignmentGroup(normalizedGroup ?? '');
    setAssignmentPortfolio(normalizedPortfolio ?? '');
    setAssignmentRankCategory(normalizedRankCategory ?? '');
    setAssignmentRank(normalizedRank ?? '');
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
      { href: '/hosthub', label: 'HostHub', icon: Server },
      { href: '/morale', label: 'Morale', icon: HeartPulse },
      { href: '/games', label: 'Games', icon: Gamepad2 },
    ];

    if (isMoraleAdmin) {
      items.push({
        href: '/morale/admin/roster',
        label: 'Roster',
        icon: Users,
      });
    }

    return items;
  }, [isMoraleAdmin]);

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
    !assignmentGroup || availablePortfolios.length === 0 || isAssignmentPending;
  const availableRanks = assignmentRankCategory
    ? getRanksForCategory(assignmentRankCategory)
    : [];
  const rankSelectDisabled =
    !assignmentRankCategory ||
    availableRanks.length === 0 ||
    isAssignmentPending;

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

  const handleAssignmentRankCategoryChange = (value: string) => {
    const nextCategory = value ? (value as RankCategory) : '';
    setAssignmentRankCategory(nextCategory);
    setAssignmentRank((current) =>
      current && isValidRankForCategory(nextCategory || null, current)
        ? current
        : '',
    );
  };

  const handleAssignmentRankChange = (value: string) => {
    setAssignmentRank(value ? (value as Rank) : '');
  };

  const handleAssignmentSave = () => {
    startAssignmentTransition(async () => {
      setAssignmentError(null);
      const result = await updateMyAssignments({
        group: assignmentGroup ? assignmentGroup : null,
        portfolio: assignmentPortfolio ? assignmentPortfolio : null,
        rankCategory: assignmentRankCategory ? assignmentRankCategory : null,
        rank: assignmentRank ? assignmentRank : null,
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
                  rankCategoryLabel={rankCategoryLabel}
                  rankLabel={rankLabel}
                  onEditGroup={() => openAssignmentModal('group')}
                  onEditPortfolio={() => openAssignmentModal('portfolio')}
                  onEditRankCategory={() => openAssignmentModal('rankCategory')}
                  onEditRank={() => openAssignmentModal('rank')}
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
              <X className='h-5 w-5' aria-hidden={true} />
            ) : (
              <Menu className='h-5 w-5' aria-hidden={true} />
            )}
            <span className='sr-only'>Toggle navigation</span>
          </button>
          <SignedIn>
            <UserAssignmentMenu
              groupLabel={groupLabel}
              portfolioLabel={portfolioLabel}
              rankCategoryLabel={rankCategoryLabel}
              rankLabel={rankLabel}
              onEditGroup={() => openAssignmentModal('group')}
              onEditPortfolio={() => openAssignmentModal('portfolio')}
              onEditRankCategory={() => openAssignmentModal('rankCategory')}
              onEditRank={() => openAssignmentModal('rank')}
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

      <AssignmentModal
        open={isAssignmentOpen}
        focus={assignmentFocus}
        rankCategory={assignmentRankCategory}
        rank={assignmentRank}
        group={assignmentGroup}
        portfolio={assignmentPortfolio}
        availableRanks={availableRanks}
        availablePortfolios={availablePortfolios}
        rankSelectDisabled={rankSelectDisabled}
        portfolioSelectDisabled={portfolioSelectDisabled}
        error={assignmentError}
        pending={isAssignmentPending}
        onClose={closeAssignmentModal}
        onSave={handleAssignmentSave}
        onChangeRankCategory={handleAssignmentRankCategoryChange}
        onChangeRank={handleAssignmentRankChange}
        onChangeGroup={handleAssignmentGroupChange}
        onChangePortfolio={handleAssignmentPortfolioChange}
      />
    </>
  );
}
