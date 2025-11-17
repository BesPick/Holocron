'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { X, Search } from 'lucide-react';
import type { Doc } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';
import { formatDate, formatEventType } from '@/lib/announcements';
import { GROUP_OPTIONS } from '@/lib/org';

type Announcement = Doc<'announcements'>;

type VotingModalProps = {
  event: Announcement;
  onClose: () => void;
};

type VoteSelection = {
  add: number;
  remove: number;
};

type LeaderboardMode = 'all' | 'group' | 'group_portfolio';

type LeaderboardParticipant = {
  userId: string;
  name: string;
  votes: number;
  group: string | null;
  groupLabel: string;
  portfolio: string | null;
  portfolioLabel: string | null;
};

type LeaderboardSection = {
  id: string;
  title: string;
  entries: LeaderboardParticipant[];
  context: LeaderboardContext;
  children?: LeaderboardSection[];
};

type LeaderboardContext = 'all' | 'group' | 'portfolio';

const UNGROUPED_KEY = '__ungrouped__';
const NO_PORTFOLIO_KEY = '__no_portfolio__';
const UNGROUPED_LABEL = 'Ungrouped';
const NO_PORTFOLIO_LABEL = 'No portfolio';

const GROUP_LABEL_MAP = new Map(GROUP_OPTIONS.map((option) => [option.value, option.label]));
const KNOWN_GROUP_VALUES = new Set(GROUP_OPTIONS.map((option) => option.value));

const LEADERBOARD_MODE_INFO: Record<
  LeaderboardMode,
  { label: string; description: string }
> = {
  all: {
    label: 'Single leaderboard',
    description: 'Everyone competes together regardless of group.',
  },
  group: {
    label: 'Per group',
    description: 'Each group has an independent ranking.',
  },
  group_portfolio: {
    label: 'Group & Portfolio',
    description: 'Groups have their own ranking plus per-portfolio breakdowns.',
  },
};

export function VotingModal({ event, onClose }: VotingModalProps) {
  const liveEvent = useQuery(api.announcements.get, { id: event._id });
  const currentEvent = liveEvent ?? event;
  const eventId = currentEvent._id;
  const eventDescription = currentEvent.description;
  const allowRemovals = currentEvent.votingAllowRemovals ?? true;

  const normalizeParticipants = React.useCallback(() => {
    return (currentEvent.votingParticipants ?? []).map((participant) => ({
      ...participant,
      votes:
        typeof participant.votes === 'number' &&
        Number.isFinite(participant.votes)
          ? Math.max(0, participant.votes)
          : 0,
    }));
  }, [currentEvent.votingParticipants]);

  const [participants, setParticipants] = React.useState(normalizeParticipants);
  const addPrice = Math.max(0, currentEvent.votingAddVotePrice ?? 0);
  const removePrice = allowRemovals
    ? Math.max(0, currentEvent.votingRemoveVotePrice ?? 0)
    : 0;
  const [selections, setSelections] = React.useState<Record<string, VoteSelection>>({});
  const [search, setSearch] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const purchaseVotes = useMutation(api.announcements.purchaseVotes);
  React.useEffect(() => {
    if (liveEvent === null) {
      onClose();
    }
  }, [liveEvent, onClose]);
  const leaderboardMode: LeaderboardMode =
    currentEvent.votingLeaderboardMode === 'group' ||
    currentEvent.votingLeaderboardMode === 'group_portfolio'
      ? currentEvent.votingLeaderboardMode
      : 'all';

  const leaderboardParticipants = React.useMemo<LeaderboardParticipant[]>(() => {
    return participants
      .map((participant) => {
        const groupValue =
          typeof participant.group === 'string' && participant.group.trim().length > 0
            ? participant.group
            : null;
        const portfolioValue =
          typeof participant.portfolio === 'string' &&
          participant.portfolio.trim().length > 0
            ? participant.portfolio
            : null;
        const votes =
          typeof participant.votes === 'number' && Number.isFinite(participant.votes)
            ? Math.max(0, participant.votes)
            : 0;
        return {
          userId: participant.userId,
          name: getParticipantName(participant),
          votes,
          group: groupValue,
          groupLabel: getGroupLabel(groupValue),
          portfolio: portfolioValue,
          portfolioLabel: portfolioValue ?? null,
        };
      })
      .filter((participant) => participant.votes > 0);
  }, [participants]);

  const leaderboardSections = React.useMemo(
    () => buildLeaderboardSections(leaderboardParticipants, leaderboardMode),
    [leaderboardParticipants, leaderboardMode],
  );
  const [activeLeaderboardId, setActiveLeaderboardId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (leaderboardSections.length === 0) {
      setActiveLeaderboardId(null);
      return;
    }
    setActiveLeaderboardId((prev) => {
      if (prev && leaderboardSections.some((section) => section.id === prev)) {
        return prev;
      }
      return leaderboardSections[0]?.id ?? null;
    });
  }, [leaderboardSections]);

  const activeLeaderboardSection = React.useMemo(() => {
    if (!activeLeaderboardId) return leaderboardSections[0] ?? null;
    return leaderboardSections.find((section) => section.id === activeLeaderboardId) ?? null;
  }, [leaderboardSections, activeLeaderboardId]);

  React.useEffect(() => {
    setParticipants(normalizeParticipants());
    setSelections({});
    setSearch('');
    setStatusMessage(null);
    setErrorMessage(null);
  }, [normalizeParticipants]);

  React.useEffect(() => {
    if (allowRemovals) return;
    setSelections((prev) => {
      let changed = false;
      const next: typeof prev = {};
      for (const [userId, selection] of Object.entries(prev)) {
        if (selection.add === 0) {
          if (selection.remove !== 0) {
            changed = true;
          }
          continue;
        }
        if (selection.remove !== 0) {
          changed = true;
        }
        next[userId] = { ...selection, remove: 0 };
      }
      return changed ? next : prev;
    });
  }, [allowRemovals]);

  const setSelectionValue = React.useCallback(
    (
      userId: string,
      type: 'add' | 'remove',
      value: number,
      limit?: number,
    ) => {
      if (type === 'remove' && !allowRemovals) {
        return;
      }
      if (!userId || Number.isNaN(value)) return;
      const nextValue = Math.max(
        0,
        Math.floor(Number.isFinite(value) ? value : 0),
      );
      const clampedValue =
        type === 'remove' && typeof limit === 'number'
          ? Math.min(nextValue, limit)
          : nextValue;
      setSelections((prev) => {
        const current = prev[userId] ?? { add: 0, remove: 0 };
        if (current[type] === clampedValue) return prev;
        const updated = { ...current, [type]: clampedValue };
        const next = { ...prev };
        if (updated.add === 0 && updated.remove === 0) {
          delete next[userId];
        } else {
          next[userId] = updated;
        }
        return next;
      });
    },
    [allowRemovals],
  );

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const totals = React.useMemo(() => {
    const sums = Object.values(selections).reduce(
      (acc, entry) => {
        acc.add += entry.add;
        acc.remove += allowRemovals ? entry.remove : 0;
        return acc;
      },
      { add: 0, remove: 0 },
    );
    const addCost = sums.add * addPrice;
    const removeCost = sums.remove * removePrice;
    const totalPrice = addCost + removeCost;
    return { ...sums, addCost, removeCost, totalPrice };
  }, [selections, addPrice, removePrice, allowRemovals]);

  const hasCart = totals.add + (allowRemovals ? totals.remove : 0) > 0;
  const normalizedSearch = search.trim().toLowerCase();
  const filteredParticipants = React.useMemo(() => {
    if (!normalizedSearch) return participants;
    return participants.filter((participant) => {
      const fullName = getParticipantName(participant, false).toLowerCase();
      return fullName.includes(normalizedSearch);
    });
  }, [participants, normalizedSearch]);

  const handleCheckout = React.useCallback(async () => {
    const adjustments = Object.entries(selections)
      .map(([userId, selection]) => ({
        userId,
        add: selection.add,
        remove: allowRemovals ? selection.remove : 0,
      }))
      .filter((entry) => entry.add > 0 || (allowRemovals && entry.remove > 0));

    if (!adjustments.length) return;

    setSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      const result = await purchaseVotes({
        id: eventId,
        adjustments,
      });
      if (result.success && Array.isArray(result.participants)) {
        setParticipants(
          result.participants.map((participant) => ({
            ...participant,
            votes:
              typeof participant.votes === 'number' &&
              Number.isFinite(participant.votes)
                ? Math.max(0, participant.votes)
                : 0,
          })),
        );
        setSelections({});
        setStatusMessage('Votes updated successfully.');
      } else {
        setStatusMessage('No changes to submit.');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to submit votes.';
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }, [selections, purchaseVotes, eventId, allowRemovals]);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6'>
      <div className='w-full max-w-6xl rounded-2xl border border-border bg-card p-6 shadow-2xl'>
        <div className='grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]'>
          <LeaderboardPanel
            sections={leaderboardSections}
            participantsCount={leaderboardParticipants.length}
            mode={leaderboardMode}
            activeSection={activeLeaderboardSection}
            onSelectSection={setActiveLeaderboardId}
          />
          <div className='flex min-w-0 flex-col'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='text-xs font-semibold uppercase tracking-wide text-primary'>
              {formatEventType(currentEvent.eventType)}
            </p>
            <h2 className='mt-1 text-2xl font-semibold text-foreground'>
              {currentEvent.title}
            </h2>
            <p className='mt-1 text-xs text-muted-foreground'>
              Published {formatDate(currentEvent.publishAt)}
            </p>
              </div>
              <button
                type='button'
                onClick={onClose}
                className='rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground'
                aria-label='Close voting modal'
              >
                <X className='h-4 w-4' />
              </button>
            </div>

            {eventDescription && (
              <p className='mt-4 text-sm leading-relaxed text-foreground'>
                {eventDescription}
              </p>
            )}

            <div className='mt-6 rounded-xl border border-border bg-background/60 p-4'>
              <div className='flex flex-wrap items-center gap-4 text-sm text-muted-foreground'>
                <span>
                  Add vote price:{' '}
                  <span className='font-semibold text-foreground'>
                    ${addPrice.toFixed(2)}
                  </span>
                </span>
                {allowRemovals && (
                  <span>
                    Remove vote price:{' '}
                    <span className='font-semibold text-foreground'>
                      ${removePrice.toFixed(2)}
                    </span>
                  </span>
                )}
              </div>
              <p className='mt-2 text-xs text-muted-foreground'>
                Enter how many votes to add{allowRemovals ? ' or remove' : ''}, then submit your purchase to update totals.
              </p>
            </div>

            <div className='mt-6 flex flex-col gap-3'>
              <div className='relative'>
                <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                <input
                  type='search'
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Search participants by name...'
                  className='w-full rounded-lg border border-border bg-background pl-10 pr-3 py-2 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                />
              </div>

              <div className='max-h-[40vh] overflow-y-auto rounded-xl border border-dashed border-border'>
                {participants.length === 0 ? (
                  <p className='p-6 text-sm text-muted-foreground'>
                    No participants available for this event.
                  </p>
                ) : filteredParticipants.length === 0 ? (
                  <p className='p-6 text-sm text-muted-foreground'>
                    No participants match your search.
                  </p>
                ) : (
                  <ul>
                    {filteredParticipants.map((participant) => {
                      const userId = participant.userId;
                      const addCount = selections[userId]?.add ?? 0;
                  const removeCount = selections[userId]?.remove ?? 0;
                  const currentVotes = Math.max(0, participant.votes ?? 0);
                      const fullName = getParticipantName(participant);
                      return (
                        <li
                          key={userId}
                          className='flex flex-wrap items-center justify-between gap-4 border-b border-border/60 px-4 py-3 last:border-b-0'
                        >
                      <div>
                        <p className='font-medium text-foreground'>{fullName}</p>
                        <p className='text-xs text-muted-foreground'>
                          Current votes: {currentVotes}
                        </p>
                      </div>
                      <div className='flex flex-wrap items-center gap-4'>
                        {allowRemovals && (
                          <VoteAdjuster
                            label='Remove'
                            count={removeCount}
                            price={removePrice}
                            onSetCount={(value) =>
                              setSelectionValue(userId, 'remove', value, currentVotes)
                            }
                            max={currentVotes}
                          />
                        )}
                        <VoteAdjuster
                          label='Add'
                          count={addCount}
                          price={addPrice}
                          onSetCount={(value) =>
                            setSelectionValue(userId, 'add', value)
                          }
                        />
                      </div>
                    </li>
                  );
                    })}
                  </ul>
                )}
              </div>
            </div>

            <div className='mt-6 space-y-3 rounded-xl border border-border bg-background/70 p-4'>
              <SummaryRow label={`Add votes (${totals.add})`} value={totals.addCost} />
              {allowRemovals && (
                <SummaryRow label={`Remove votes (${totals.remove})`} value={totals.removeCost} />
              )}
              <div className='flex items-center justify-between border-t border-border pt-3 text-lg font-semibold text-foreground'>
                <span>Total price</span>
                <span>${totals.totalPrice.toFixed(2)}</span>
              </div>
            </div>

            <div className='mt-4 flex flex-col gap-2'>
              {statusMessage && (
                <p className='text-xs text-emerald-500'>{statusMessage}</p>
              )}
              {errorMessage && (
                <p className='text-xs text-destructive'>{errorMessage}</p>
              )}
              <div className='flex flex-wrap items-center justify-between gap-3'>
                <p className='text-xs text-muted-foreground'>
                  Submit purchases to update vote totals immediately.
                </p>
                <button
                  type='button'
                  disabled={!hasCart || submitting}
                  onClick={handleCheckout}
                  className='inline-flex items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
                >
                  {submitting ? 'Submitting…' : 'Submit purchase'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type SummaryRowProps = {
  label: string;
  value: number;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className='flex items-center justify-between text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-medium text-foreground'>${value.toFixed(2)}</span>
    </div>
  );
}

type VoteAdjusterProps = {
  label: 'Add' | 'Remove';
  count: number;
  price: number;
  onSetCount: (value: number) => void;
  max?: number;
};

function VoteAdjuster({
  label,
  count,
  price,
  onSetCount,
  max,
}: VoteAdjusterProps) {
  const handleManualChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      if (!rawValue || rawValue.trim().length === 0) {
        onSetCount(0);
        return;
      }
      const next = Number(rawValue);
      if (Number.isNaN(next)) {
        onSetCount(0);
        return;
      }
      onSetCount(next);
    },
    [onSetCount],
  );

  return (
    <div className='flex flex-col items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm text-foreground'>
      <span className='text-xs text-muted-foreground text-center'>{label} votes</span>
      <input
        type='number'
        min={0}
        max={typeof max === 'number' ? max : undefined}
        inputMode='numeric'
        value={Number.isFinite(count) && count !== 0 ? count : ''}
        onChange={handleManualChange}
        className='h-8 w-20 rounded border border-border bg-background px-2 text-center text-sm font-semibold text-foreground appearance-none [-moz-appearance:textfield] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        aria-label={`${label} vote quantity`}
      />
      <span className='text-[11px] text-muted-foreground text-center'>
        ${price.toFixed(2)} each
      </span>
    </div>
  );
}

type LeaderboardPanelProps = {
  sections: LeaderboardSection[];
  participantsCount: number;
  mode: LeaderboardMode;
  activeSection: LeaderboardSection | null;
  onSelectSection: (sectionId: string) => void;
};

function LeaderboardPanel({
  sections,
  participantsCount,
  mode,
  activeSection,
  onSelectSection,
}: LeaderboardPanelProps) {
  const info = LEADERBOARD_MODE_INFO[mode];
  const tabsAvailable = sections.length > 1;
  return (
    <div className='flex h-full min-w-0 flex-col rounded-2xl border border-border bg-background/60 p-4 lg:max-h-[75vh]'>
      <div className='border-b border-border/60 pb-4'>
        <p className='text-xs font-semibold uppercase tracking-wide text-primary'>Leaderboard</p>
        <h3 className='mt-1 text-lg font-semibold text-foreground'>{info.label}</h3>
        <p className='text-xs text-muted-foreground'>{info.description}</p>
        <p className='mt-2 text-xs text-muted-foreground'>
          Participants:{' '}
          <span className='font-semibold text-foreground'>{participantsCount}</span>
        </p>
      </div>
      {sections.length === 0 ? (
        <div className='mt-4 flex-1 overflow-y-auto pr-1'>
          <p className='text-sm text-muted-foreground'>
            No participants available for this leaderboard yet.
          </p>
        </div>
      ) : (
        <>
          {tabsAvailable && (
            <div className='mt-4 flex gap-2 overflow-x-auto pb-2'>
              {sections.map((section) => {
                const isActive = section.id === activeSection?.id;
                return (
                  <button
                    key={section.id}
                    type='button'
                    onClick={() => onSelectSection(section.id)}
                    className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      isActive
                        ? 'border-primary bg-primary/15 text-primary'
                        : 'border-border bg-background/80 text-muted-foreground hover:border-primary/40'
                    }`}
                  >
                    {section.title}
                  </button>
                );
              })}
            </div>
          )}
          <div className='mt-4 flex-1 overflow-y-auto pr-1'>
            {activeSection ? (
              <LeaderboardSectionCard key={activeSection.id} section={activeSection} />
            ) : (
              <p className='text-sm text-muted-foreground'>
                No leaderboard selected for this event.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

type LeaderboardSectionCardProps = {
  section: LeaderboardSection;
};

function LeaderboardSectionCard({ section }: LeaderboardSectionCardProps) {
  return (
    <div className='rounded-xl border border-border/70 bg-card/50 p-3'>
      <div className='flex items-center justify-between gap-3'>
        <h4 className='text-sm font-semibold text-foreground'>{section.title}</h4>
        {section.entries.length > 0 && (
          <span className='text-xs text-muted-foreground'>
            {section.entries.length} participant{section.entries.length === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <LeaderboardEntries entries={section.entries} context={section.context} />
      {section.children && section.children.length > 0 && (
        <div className='mt-3 space-y-3 border-t border-border/60 pt-3'>
          {section.children.map((child) => (
            <div
              key={child.id}
              className='rounded-lg border border-border/40 bg-background/70 p-3'
            >
              <div className='flex items-center justify-between gap-3'>
                <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                  {child.title}
                </p>
                {child.entries.length > 0 && (
                  <span className='text-[11px] text-muted-foreground'>
                    {child.entries.length} participant{child.entries.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <LeaderboardEntries entries={child.entries} context={child.context} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type LeaderboardEntriesProps = {
  entries: LeaderboardParticipant[];
  context: LeaderboardContext;
  compact?: boolean;
};

function LeaderboardEntries({ entries, context, compact = false }: LeaderboardEntriesProps) {
  if (entries.length === 0) {
    return (
      <p className='mt-2 text-xs text-muted-foreground'>No participants assigned.</p>
    );
  }
  return (
    <ol className='mt-3 space-y-2'>
      {entries.map((entry, index) => (
        <LeaderboardEntryRow
          key={entry.userId}
          entry={entry}
          rank={index + 1}
          context={context}
          compact={compact}
        />
      ))}
    </ol>
  );
}

type LeaderboardEntryRowProps = {
  entry: LeaderboardParticipant;
  rank: number;
  context: LeaderboardContext;
  compact?: boolean;
};

function LeaderboardEntryRow({
  entry,
  rank,
  context,
  compact = false,
}: LeaderboardEntryRowProps) {
  const meta = getEntryMeta(entry, context);
  const paddingClass = compact ? 'py-1.5' : 'py-2';
  const nameClass = compact ? 'text-sm' : 'text-base';
  const valueClass = compact ? 'text-sm' : 'text-base';
  return (
    <li
      className={`flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 ${paddingClass}`}
    >
      <div className='flex items-center gap-3'>
        <span className='text-xs font-semibold text-muted-foreground'>
          #{rank.toString().padStart(2, '0')}
        </span>
        <div>
          <p className={`${nameClass} font-semibold text-foreground`}>{entry.name}</p>
          {meta && <p className='text-[11px] text-muted-foreground'>{meta}</p>}
        </div>
      </div>
      <span className={`${valueClass} font-semibold text-foreground`}>{entry.votes}</span>
    </li>
  );
}

function buildLeaderboardSections(
  participants: LeaderboardParticipant[],
  mode: LeaderboardMode,
): LeaderboardSection[] {
  if (participants.length === 0) return [];

  if (mode === 'all') {
    return [
      {
        id: 'all',
        title: 'Overall leaderboard',
        entries: sortParticipantsByVotes(participants),
        context: 'all',
      },
    ];
  }

  const grouped = new Map<string, LeaderboardParticipant[]>();
  participants.forEach((participant) => {
    const key = participant.group ?? UNGROUPED_KEY;
    const next = grouped.get(key) ?? [];
    next.push(participant);
    grouped.set(key, next);
  });

  const sections: LeaderboardSection[] = [];

  for (const option of GROUP_OPTIONS) {
    const entries = grouped.get(option.value);
    if (!entries || entries.length === 0) continue;
    const section: LeaderboardSection = {
      id: option.value,
      title: option.label,
      entries: sortParticipantsByVotes(entries),
      context: 'group',
    };
    if (mode === 'group_portfolio') {
      const children = buildPortfolioSections(entries, option.portfolios, option.value);
      if (children.length > 0) {
        section.children = children;
      }
    }
    sections.push(section);
  }

  for (const [groupKey, entries] of grouped.entries()) {
    if (!entries || entries.length === 0) continue;
    if (KNOWN_GROUP_VALUES.has(groupKey) || groupKey === UNGROUPED_KEY) continue;
    const section: LeaderboardSection = {
      id: groupKey,
      title: GROUP_LABEL_MAP.get(groupKey) ?? groupKey,
      entries: sortParticipantsByVotes(entries),
      context: 'group',
    };
    if (mode === 'group_portfolio') {
      const children = buildPortfolioSections(entries, [], groupKey);
      if (children.length > 0) {
        section.children = children;
      }
    }
    sections.push(section);
  }

  const ungroupedEntries = grouped.get(UNGROUPED_KEY);
  if (ungroupedEntries && ungroupedEntries.length > 0) {
    const section: LeaderboardSection = {
      id: UNGROUPED_KEY,
      title: UNGROUPED_LABEL,
      entries: sortParticipantsByVotes(ungroupedEntries),
      context: 'group',
    };
    if (mode === 'group_portfolio') {
      const children = buildPortfolioSections(ungroupedEntries, [], UNGROUPED_KEY);
      if (children.length > 0) {
        section.children = children;
      }
    }
    sections.push(section);
  }

  return sections;
}

function buildPortfolioSections(
  entries: LeaderboardParticipant[],
  orderedPortfolios: readonly string[],
  groupKey: string,
): LeaderboardSection[] {
  if (entries.length === 0) return [];
  const portfolioMap = new Map<string, LeaderboardParticipant[]>();
  entries.forEach((participant) => {
    const key = participant.portfolio ?? NO_PORTFOLIO_KEY;
    const next = portfolioMap.get(key) ?? [];
    next.push(participant);
    portfolioMap.set(key, next);
  });

  const sections: LeaderboardSection[] = [];
  const seen = new Set<string>();

  orderedPortfolios.forEach((portfolio) => {
    const list = portfolioMap.get(portfolio);
    if (!list || list.length === 0) return;
    seen.add(portfolio);
    sections.push({
      id: `${groupKey}-${portfolio}`,
      title: portfolio,
      entries: sortParticipantsByVotes(list),
      context: 'portfolio',
    });
  });

  for (const [key, list] of portfolioMap.entries()) {
    if (!list || list.length === 0 || seen.has(key)) continue;
    const title = key === NO_PORTFOLIO_KEY ? NO_PORTFOLIO_LABEL : key;
    sections.push({
      id: `${groupKey}-${key}`,
      title,
      entries: sortParticipantsByVotes(list),
      context: 'portfolio',
    });
  }

  return sections;
}

function sortParticipantsByVotes(entries: LeaderboardParticipant[]): LeaderboardParticipant[] {
  return [...entries].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.name.localeCompare(b.name);
  });
}

function getEntryMeta(entry: LeaderboardParticipant, context: LeaderboardContext) {
  if (context === 'all') {
    if (entry.groupLabel === UNGROUPED_LABEL && !entry.portfolioLabel) {
      return UNGROUPED_LABEL;
    }
    if (entry.portfolioLabel) {
      return `${entry.groupLabel} • ${entry.portfolioLabel}`;
    }
    return entry.groupLabel;
  }
  if (context === 'group') {
    return entry.portfolioLabel ?? NO_PORTFOLIO_LABEL;
  }
  return entry.groupLabel;
}

function getGroupLabel(group: string | null | undefined) {
  if (!group) return UNGROUPED_LABEL;
  return GROUP_LABEL_MAP.get(group) ?? group;
}

function getParticipantName(
  participant: { firstName?: string | null; lastName?: string | null },
  withFallback = true,
) {
  const name = `${participant.firstName ?? ''} ${participant.lastName ?? ''}`
    .trim()
    .replace(/\s+/g, ' ');
  if (!name && withFallback) {
    return 'Unnamed user';
  }
  return name;
}
