'use client';

import { ChevronDown } from 'lucide-react';

import { formatShortDateLabel } from '@/lib/hosthub-schedule-utils';

import type { EventOverride } from './calendar-types';

export type Building892Entry = {
  weekKey: string;
  weekStart: Date;
  weekEnd: Date;
  teamValue: string | null;
  teamLabel: string;
  override?: EventOverride;
  hasHistory?: boolean;
};

type Building892PanelProps = {
  entries: Building892Entry[];
  isAdmin: boolean;
  buildingEditWeek: string | null;
  buildingEditTeam: string;
  buildingEditMessage: string | null;
  eligibleTeamOptions: Array<{ value: string; label: string }>;
  isSaving: boolean;
  onOpenHistory: (weekKey: string) => void;
  onOpenEdit: (weekKey: string) => void;
  onCloseEdit: () => void;
  onSaveEdit: (weekKey: string) => void;
  onResetEdit: (weekKey: string) => void;
  onEditTeamChange: (value: string) => void;
};

export function Building892Panel({
  entries,
  isAdmin,
  buildingEditWeek,
  buildingEditTeam,
  buildingEditMessage,
  eligibleTeamOptions,
  isSaving,
  onOpenHistory,
  onOpenEdit,
  onCloseEdit,
  onSaveEdit,
  onResetEdit,
  onEditTeamChange,
}: Building892PanelProps) {
  return (
    <details
      id='building-892-panel'
      className='group rounded-2xl border border-border bg-background/70 p-4 shadow-sm'
    >
      <summary className='flex cursor-pointer list-none items-center justify-between text-left'>
        <div>
          <p className='text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground'>
            892 Manning
          </p>
          <h3 className='mt-2 text-lg font-semibold text-foreground'>
            Weekly team assignments
          </h3>
          <p className='mt-2 text-xs text-muted-foreground'>
            Assigned teams work at 892 Monday through Friday and are
            excluded from other HostHub shifts that week.
          </p>
        </div>
        <ChevronDown
          className='ml-4 h-4 w-4 text-muted-foreground transition group-open:rotate-180'
          aria-hidden={true}
        />
      </summary>
      <div className='mt-4 space-y-3'>
        {entries.map((entry) => {
          const rangeLabel = `${formatShortDateLabel(
            entry.weekStart,
          )} - ${formatShortDateLabel(entry.weekEnd)}`;
          const hasOverride = Boolean(entry.override);
          const isCanceled = entry.override?.isCanceled ?? false;
          const isEditing = buildingEditWeek === entry.weekKey;
          const teamDisplay = isCanceled ? 'Canceled' : entry.teamLabel;
          return (
            <div
              key={entry.weekKey}
              className={`rounded-xl border border-border bg-background px-3 py-3 ${
                isCanceled ? 'opacity-60' : ''
              }`}
            >
              <div className='flex items-start justify-between gap-3'>
                <div>
                  <p className='text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground'>
                    Week of {formatShortDateLabel(entry.weekStart)}
                  </p>
                  <p className='mt-1 text-sm font-semibold text-foreground'>
                    {teamDisplay}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {rangeLabel} • Mon-Fri
                  </p>
                </div>
                {entry.hasHistory ? (
                  <button
                    type='button'
                    onClick={() => onOpenHistory(entry.weekKey)}
                    className='rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-teal-700 transition hover:bg-teal-500/20'
                  >
                    Updated
                  </button>
                ) : null}
              </div>

              {isAdmin ? (
                <div className='mt-3 border-t border-border/60 pt-3'>
                  {!isEditing ? (
                    <button
                      type='button'
                      onClick={() => onOpenEdit(entry.weekKey)}
                      className='rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground transition hover:bg-secondary/70'
                    >
                      Change team
                    </button>
                  ) : (
                    <div className='space-y-2'>
                      <label className='flex flex-col gap-2 text-xs font-semibold text-muted-foreground'>
                        Team override
                        <select
                          value={buildingEditTeam}
                          onChange={(eventValue) =>
                            onEditTeamChange(eventValue.target.value)
                          }
                          disabled={isSaving}
                          className='w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          <option value=''>
                            Use assigned team ({entry.teamLabel})
                          </option>
                          {eligibleTeamOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className='flex flex-wrap items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => onSaveEdit(entry.weekKey)}
                          disabled={isSaving}
                          className='rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        {hasOverride ? (
                          <button
                            type='button'
                            onClick={() => onResetEdit(entry.weekKey)}
                            disabled={isSaving}
                            className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
                          >
                            Reset
                          </button>
                        ) : null}
                        <button
                          type='button'
                          onClick={onCloseEdit}
                          className='rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70'
                        >
                          Close
                        </button>
                      </div>
                      {buildingEditMessage ? (
                        <p className='text-xs text-muted-foreground'>
                          {buildingEditMessage}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </details>
  );
}
