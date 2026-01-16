'use client';

import { useMemo, useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';

import { updateScheduleRule } from '@/server/actions/hosthub-schedule-rules';
import { refreshScheduleAssignments } from '@/server/actions/hosthub-schedule-refresh';
import {
  ENLISTED_RANKS,
  OFFICER_RANKS,
  RANK_CATEGORY_OPTIONS,
  type EnlistedRank,
  type OfficerRank,
  type RankCategory,
} from '@/lib/org';
import {
  type ScheduleRuleConfig,
  type ScheduleRuleId,
} from '@/lib/hosthub-schedule-rules';

type ScheduleRuleCardProps = {
  ruleId: ScheduleRuleId;
  title: string;
  description: string;
  initialConfig: ScheduleRuleConfig;
};

type StatusState = {
  message: string;
  variant: 'success' | 'error';
} | null;

const categoryOrder = RANK_CATEGORY_OPTIONS.map((option) => option.value);

const toggleOrderedValue = <T,>(
  values: T[],
  value: T,
  order: readonly T[],
) => {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return order.filter((entry) => next.has(entry));
};

export function ScheduleRuleCard({
  ruleId,
  title,
  description,
  initialConfig,
}: ScheduleRuleCardProps) {
  const [eligibleRankCategories, setEligibleRankCategories] = useState<
    RankCategory[]
  >(initialConfig.eligibleRankCategories);
  const [eligibleEnlistedRanks, setEligibleEnlistedRanks] = useState<
    EnlistedRank[]
  >(initialConfig.eligibleEnlistedRanks);
  const [eligibleOfficerRanks, setEligibleOfficerRanks] = useState<
    OfficerRank[]
  >(initialConfig.eligibleOfficerRanks);
  const [defaultTime, setDefaultTime] = useState(initialConfig.defaultTime);
  const [status, setStatus] = useState<StatusState>(null);
  const [refreshStatus, setRefreshStatus] = useState<StatusState>(null);
  const [showRefreshPrompt, setShowRefreshPrompt] = useState(false);
  const [confirmRefresh, setConfirmRefresh] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, startRefresh] = useTransition();
  const nextRefreshLabel = useMemo(() => {
    const now = new Date();
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
      nextMonthStart,
    );
  }, []);

  const hasEnlisted = eligibleRankCategories.includes('Enlisted');
  const hasOfficer = eligibleRankCategories.includes('Officer');

  const handleSave = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await updateScheduleRule({
        ruleId,
        eligibleRankCategories,
        eligibleEnlistedRanks,
        eligibleOfficerRanks,
        defaultTime,
      });

      if (result.success && result.config) {
        setEligibleRankCategories(result.config.eligibleRankCategories);
        setEligibleEnlistedRanks(result.config.eligibleEnlistedRanks);
        setEligibleOfficerRanks(result.config.eligibleOfficerRanks);
        setDefaultTime(result.config.defaultTime);
        setStatus({ message: result.message, variant: 'success' });
        setShowRefreshPrompt(true);
        setConfirmRefresh(false);
        setRefreshStatus(null);
      } else {
        setStatus({ message: result.message, variant: 'error' });
      }
    });
  };

  const handleRefreshRequest = () => {
    setConfirmRefresh(true);
  };

  const handleRefreshCancel = () => {
    setConfirmRefresh(false);
  };

  const handleDismissPrompt = () => {
    setShowRefreshPrompt(false);
  };

  const handleRefreshAssignments = () => {
    setRefreshStatus(null);
    startRefresh(async () => {
      const result = await refreshScheduleAssignments();
      if (result.success) {
        setRefreshStatus({ message: result.message, variant: 'success' });
        setConfirmRefresh(false);
      } else {
        setRefreshStatus({ message: result.message, variant: 'error' });
      }
    });
  };

  return (
    <div className='rounded-2xl border border-border bg-card/70 p-6 shadow-sm'>
      <div>
        <h2 className='text-xl font-semibold text-foreground'>{title}</h2>
        <p className='mt-2 text-sm text-muted-foreground'>{description}</p>
      </div>

      <div className='mt-6 space-y-5'>
        <div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-sm font-semibold text-foreground'>
              Default time
            </p>
            <button
              type='button'
              onClick={() => setDefaultTime('')}
              disabled={isPending}
              className='rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60'
            >
              Clear
            </button>
          </div>
          <input
            type='time'
            value={defaultTime}
            onChange={(event) => setDefaultTime(event.target.value)}
            disabled={isPending}
            className='mt-2 w-full max-w-50 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
          />
          <p className='mt-2 text-xs text-muted-foreground'>
            Leave blank to show TBD for this event type.
          </p>
        </div>
        <div>
          <p className='text-sm font-semibold text-foreground'>
            Eligible rank categories
          </p>
          <div className='mt-3 flex flex-wrap gap-3'>
            {RANK_CATEGORY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className='inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-sm text-foreground shadow-sm'
              >
                <input
                  type='checkbox'
                  className='h-4 w-4 accent-primary'
                  checked={eligibleRankCategories.includes(option.value)}
                  onChange={() =>
                    setEligibleRankCategories(
                      toggleOrderedValue(
                        eligibleRankCategories,
                        option.value,
                        categoryOrder,
                      ),
                    )
                  }
                  disabled={isPending}
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-sm font-semibold text-foreground'>
              Enlisted ranks
            </p>
            <div className='flex gap-2 text-xs text-muted-foreground'>
              <button
                type='button'
                onClick={() => setEligibleEnlistedRanks([...ENLISTED_RANKS])}
                disabled={!hasEnlisted || isPending}
                className='rounded-full border border-border px-2.5 py-1 transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60'
              >
                All
              </button>
              <button
                type='button'
                onClick={() => setEligibleEnlistedRanks([])}
                disabled={!hasEnlisted || isPending}
                className='rounded-full border border-border px-2.5 py-1 transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60'
              >
                None
              </button>
            </div>
          </div>
          <div className='mt-3 flex flex-wrap gap-2'>
            {ENLISTED_RANKS.map((rank) => (
              <label
                key={rank}
                className='inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-sm text-foreground shadow-sm'
              >
                <input
                  type='checkbox'
                  className='h-4 w-4 accent-primary'
                  checked={eligibleEnlistedRanks.includes(rank)}
                  onChange={() =>
                    setEligibleEnlistedRanks(
                      toggleOrderedValue(
                        eligibleEnlistedRanks,
                        rank,
                        ENLISTED_RANKS,
                      ),
                    )
                  }
                  disabled={!hasEnlisted || isPending}
                />
                {rank}
              </label>
            ))}
          </div>
          {!hasEnlisted ? (
            <p className='mt-2 text-xs text-muted-foreground'>
              Enable Enlisted above to include enlisted ranks.
            </p>
          ) : null}
        </div>

        <div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-sm font-semibold text-foreground'>
              Officer ranks
            </p>
            <div className='flex gap-2 text-xs text-muted-foreground'>
              <button
                type='button'
                onClick={() => setEligibleOfficerRanks([...OFFICER_RANKS])}
                disabled={!hasOfficer || isPending}
                className='rounded-full border border-border px-2.5 py-1 transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60'
              >
                All
              </button>
              <button
                type='button'
                onClick={() => setEligibleOfficerRanks([])}
                disabled={!hasOfficer || isPending}
                className='rounded-full border border-border px-2.5 py-1 transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-60'
              >
                None
              </button>
            </div>
          </div>
          <div className='mt-3 flex flex-wrap gap-2'>
            {OFFICER_RANKS.map((rank) => (
              <label
                key={rank}
                className='inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-sm text-foreground shadow-sm'
              >
                <input
                  type='checkbox'
                  className='h-4 w-4 accent-primary'
                  checked={eligibleOfficerRanks.includes(rank)}
                  onChange={() =>
                    setEligibleOfficerRanks(
                      toggleOrderedValue(
                        eligibleOfficerRanks,
                        rank,
                        OFFICER_RANKS,
                      ),
                    )
                  }
                  disabled={!hasOfficer || isPending}
                />
                {rank}
              </label>
            ))}
          </div>
          {!hasOfficer ? (
            <p className='mt-2 text-xs text-muted-foreground'>
              Enable Officer above to include officer ranks.
            </p>
          ) : null}
        </div>
      </div>

      {status ? (
        <p
          className={`mt-4 text-sm ${
            status.variant === 'success'
              ? 'text-emerald-600'
              : 'text-destructive'
          }`}
        >
          {status.message}
        </p>
      ) : null}

      {showRefreshPrompt ? (
        <div className='mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700'>
          <div className='flex items-start gap-2'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
            <div>
              <p className='font-semibold text-amber-800'>
                Eligibility updated
              </p>
              <p className='text-xs text-amber-700'>
                Refresh assignments to re-check scheduled assignees against the
                new rules. This may swap out ineligible or removed members.
              </p>
              <p className='mt-1 text-xs text-amber-700'>
                If you skip refresh, the new rules apply starting{' '}
                <span className='font-semibold text-amber-800'>
                  {nextRefreshLabel}
                </span>
                .
              </p>
            </div>
          </div>
          <div className='mt-3 flex flex-wrap gap-2'>
            {confirmRefresh ? (
              <>
                <button
                  type='button'
                  onClick={handleRefreshAssignments}
                  disabled={isRefreshing}
                  className='inline-flex items-center justify-center rounded-md border border-border bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  {isRefreshing ? 'Refreshing...' : 'Confirm refresh'}
                </button>
                <button
                  type='button'
                  onClick={handleRefreshCancel}
                  disabled={isRefreshing}
                  className='inline-flex items-center justify-center rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  type='button'
                  onClick={handleRefreshRequest}
                  disabled={isRefreshing}
                  className='inline-flex items-center justify-center rounded-md border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  Refresh assignments
                </button>
                <button
                  type='button'
                  onClick={handleDismissPrompt}
                  disabled={isRefreshing}
                  className='inline-flex items-center justify-center rounded-md border border-transparent px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  Dismiss
                </button>
              </>
            )}
          </div>
          {refreshStatus ? (
            <div
              className={`mt-3 rounded-md border px-3 py-2 text-xs ${
                refreshStatus.variant === 'success'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                  : 'border-destructive/40 bg-destructive/10 text-destructive'
              }`}
            >
              {refreshStatus.message}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className='mt-6 flex items-center justify-end'>
        <button
          type='button'
          onClick={handleSave}
          disabled={isPending}
          className='rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}
