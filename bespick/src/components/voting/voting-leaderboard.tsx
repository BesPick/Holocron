import * as React from 'react';

import { GROUP_OPTIONS } from '@/lib/org';

export type LeaderboardMode = 'all' | 'group' | 'group_portfolio';

export type LeaderboardParticipant = {
  userId: string;
  name: string;
  votes: number;
  group: string | null;
  groupLabel: string;
  portfolio: string | null;
  portfolioLabel: string | null;
};

export type LeaderboardSection = {
  id: string;
  title: string;
  entries: LeaderboardParticipant[];
  context: LeaderboardContext;
  children?: LeaderboardSection[];
};

export type LeaderboardContext = 'all' | 'group' | 'portfolio';

type LeaderboardPanelProps = {
  sections: LeaderboardSection[];
  participantsCount: number;
  mode: LeaderboardMode;
  activeSection: LeaderboardSection | null;
  onSelectSection: (sectionId: string) => void;
};

type LeaderboardSectionCardProps = {
  section: LeaderboardSection;
};

type LeaderboardEntriesProps = {
  entries: LeaderboardParticipant[];
  context: LeaderboardContext;
  compact?: boolean;
};

type LeaderboardEntryRowProps = {
  entry: LeaderboardParticipant;
  rank: number;
  context: LeaderboardContext;
  compact?: boolean;
};

const UNGROUPED_KEY = '__ungrouped__';
const NO_PORTFOLIO_KEY = '__no_portfolio__';
const UNGROUPED_LABEL = 'Ungrouped';
const NO_PORTFOLIO_LABEL = 'No portfolio';

const GROUP_LABEL_MAP = new Map<string, string>(
  GROUP_OPTIONS.map((option) => [option.value, option.label]),
);
const KNOWN_GROUP_VALUES = new Set<string>(
  GROUP_OPTIONS.map((option) => option.value),
);

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

export function LeaderboardPanel({
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
        <p className='text-xs font-semibold uppercase tracking-wide text-primary'>
          Leaderboard
        </p>
        <h3 className='mt-1 text-lg font-semibold text-foreground'>
          {info.label}
        </h3>
        <p className='text-xs text-muted-foreground'>{info.description}</p>
        <p className='mt-2 text-xs text-muted-foreground'>
          Participants:{' '}
          <span className='font-semibold text-foreground'>
            {participantsCount}
          </span>
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
              <LeaderboardSectionCard
                key={activeSection.id}
                section={activeSection}
              />
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

export function buildLeaderboardSections(
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
      const children = buildPortfolioSections(
        entries,
        option.portfolios,
        option.value,
      );
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

export function getGroupLabel(group: string | null | undefined) {
  if (!group) return UNGROUPED_LABEL;
  return GROUP_LABEL_MAP.get(group) ?? group;
}

function LeaderboardSectionCard({ section }: LeaderboardSectionCardProps) {
  return (
    <div className='rounded-xl border border-border/70 bg-card/50 p-3'>
      <div className='flex items-center justify-between gap-3'>
        <h4 className='text-sm font-semibold text-foreground'>
          {section.title}
        </h4>
        {section.entries.length > 0 && (
          <span className='text-xs text-muted-foreground'>
            {section.entries.length} participant
            {section.entries.length === 1 ? '' : 's'}
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
                    {child.entries.length} participant
                    {child.entries.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              <LeaderboardEntries
                entries={child.entries}
                context={child.context}
                compact
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function LeaderboardEntries({
  entries,
  context,
  compact = false,
}: LeaderboardEntriesProps) {
  if (entries.length === 0) {
    return (
      <p className='mt-2 text-xs text-muted-foreground'>
        No participants assigned.
      </p>
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
          <p className={`${nameClass} font-semibold text-foreground`}>
            {entry.name}
          </p>
          {meta && <p className='text-[11px] text-muted-foreground'>{meta}</p>}
        </div>
      </div>
      <span className={`${valueClass} font-semibold text-foreground`}>
        {entry.votes}
      </span>
    </li>
  );
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

function sortParticipantsByVotes(
  entries: LeaderboardParticipant[],
): LeaderboardParticipant[] {
  return [...entries].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return a.name.localeCompare(b.name);
  });
}

function getEntryMeta(
  entry: LeaderboardParticipant,
  context: LeaderboardContext,
) {
  if (context === 'all') {
    if (entry.groupLabel === UNGROUPED_LABEL && !entry.portfolioLabel) {
      return UNGROUPED_LABEL;
    }
    if (entry.portfolioLabel) {
      return `${entry.groupLabel} - ${entry.portfolioLabel}`;
    }
    return entry.groupLabel;
  }
  if (context === 'group') {
    return entry.portfolioLabel ?? NO_PORTFOLIO_LABEL;
  }
  return entry.groupLabel;
}
