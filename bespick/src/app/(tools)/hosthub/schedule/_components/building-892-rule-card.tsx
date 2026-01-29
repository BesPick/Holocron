'use client';

import { useMemo, useState, useTransition } from 'react';
import { AlertTriangle } from 'lucide-react';

import { updateBuilding892Rule } from '@/server/actions/hosthub-schedule-rules';
import { refreshScheduleAssignments } from '@/server/actions/hosthub-schedule-refresh';
import type { Building892RuleConfig } from '@/lib/hosthub-schedule-rules';

type Building892RuleCardProps = {
  initialConfig: Building892RuleConfig;
  teamOptions: Array<{ value: string; label: string }>;
};

type StatusState = {
  message: string;
  variant: 'success' | 'error';
} | null;

const toggleValue = (values: string[], value: string) => {
  const next = new Set(values);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return Array.from(next);
};

export function Building892RuleCard({
  initialConfig,
  teamOptions,
}: Building892RuleCardProps) {
  const [excludedTeams, setExcludedTeams] = useState<string[]>(
    initialConfig.excludedTeams,
  );
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

  const handleSave = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await updateBuilding892Rule({ excludedTeams });
      if (result.success && result.config) {
        setExcludedTeams(result.config.excludedTeams);
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
        <h2 className='text-xl font-semibold text-foreground'>
          892 Manning eligibility
        </h2>
        <p className='mt-2 text-sm text-muted-foreground'>
          Exclude teams that should never be assigned to 892. Only teams with
          active members are considered.
        </p>
      </div>

      <div className='mt-6 space-y-5'>
        <div>
          <p className='text-sm font-semibold text-foreground'>
            Excluded teams
          </p>
          <div className='mt-3 flex flex-wrap gap-2'>
            {teamOptions.length > 0 ? (
              teamOptions.map((option) => {
                const isExcluded = excludedTeams.includes(option.value);
                return (
                  <label
                    key={option.value}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm shadow-sm ${
                      isExcluded
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border-border bg-background/70 text-foreground'
                    }`}
                  >
                    <input
                      type='checkbox'
                      className='h-4 w-4 accent-primary'
                      checked={isExcluded}
                      onChange={() =>
                        setExcludedTeams(
                          toggleValue(excludedTeams, option.value),
                        )
                      }
                      disabled={isPending}
                    />
                    {option.label}
                  </label>
                );
              })
            ) : (
              <p className='text-sm text-muted-foreground'>
                No team options are configured yet.
              </p>
            )}
          </div>
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
                new rules. This may swap out ineligible teams.
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
