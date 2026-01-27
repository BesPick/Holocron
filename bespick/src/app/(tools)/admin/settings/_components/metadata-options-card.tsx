'use client';

import { useMemo, useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';

import { updateMetadataOptions } from '@/server/actions/site-settings';
import type {
  MetadataCustomSection,
  MetadataOptionsConfig,
} from '@/lib/metadata-options';
import {
  ENLISTED_RANKS,
  OFFICER_RANKS,
  RANK_CATEGORY_OPTIONS,
  type GroupOption,
} from '@/lib/org';

type MetadataOptionsCardProps = {
  initialConfig: MetadataOptionsConfig;
};

type StatusState = {
  message: string;
  variant: 'success' | 'error';
} | null;

type OptionListEditorProps = {
  options: string[];
  onChange: (next: string[]) => void;
  addLabel: string;
  emptyLabel?: string;
  disabled?: boolean;
  placeholder?: string;
};

const OptionListEditor = ({
  options,
  onChange,
  addLabel,
  emptyLabel = 'No options added yet.',
  disabled = false,
  placeholder = 'Option value',
}: OptionListEditorProps) => {
  const handleOptionChange = (index: number, value: string) => {
    const next = [...options];
    next[index] = value;
    onChange(next);
  };

  const handleRemove = (index: number) => {
    onChange(options.filter((_, optionIndex) => optionIndex !== index));
  };

  const handleAdd = () => {
    onChange([...options, '']);
  };

  return (
    <div className='space-y-2'>
      {options.length === 0 ? (
        <p className='text-xs text-muted-foreground'>{emptyLabel}</p>
      ) : null}
      {options.map((option, index) => (
        <div key={index} className='flex gap-2'>
          <input
            type='text'
            value={option}
            onChange={(event) =>
              handleOptionChange(index, event.target.value)
            }
            disabled={disabled}
            placeholder={placeholder}
            className='flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
          />
          <button
            type='button'
            onClick={() => handleRemove(index)}
            disabled={disabled}
            className='rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type='button'
        onClick={handleAdd}
        disabled={disabled}
        className='rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
      >
        {addLabel}
      </button>
    </div>
  );
};

const createCustomSection = (): MetadataCustomSection => ({
  id: `custom-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  label: '',
  options: [],
});

export function MetadataOptionsCard({
  initialConfig,
}: MetadataOptionsCardProps) {
  const [groupOptions, setGroupOptions] = useState<GroupOption[]>(
    initialConfig.groupOptions.map((group) => ({
      value: group.value,
      label: group.label,
      portfolios: [...group.portfolios],
    })),
  );
  const [teamOptions, setTeamOptions] = useState<string[]>(
    initialConfig.teamOptions.map((team) => team.value),
  );
  const [customSections, setCustomSections] = useState<MetadataCustomSection[]>(
    initialConfig.customSections.map((section) => ({
      id: section.id,
      label: section.label,
      options: [...section.options],
    })),
  );
  const [status, setStatus] = useState<StatusState>(null);
  const [isPending, startTransition] = useTransition();

  const roleOptions = useMemo(
    () => ['Admin', 'Moderator', 'Scheduler', 'Morale Member', 'Member'],
    [],
  );

  const handleGroupLabelChange = (index: number, value: string) => {
    setGroupOptions((prev) =>
      prev.map((group, groupIndex) =>
        groupIndex === index
          ? { ...group, value, label: value }
          : group,
      ),
    );
  };

  const handleGroupPortfoliosChange = (
    index: number,
    portfolios: string[],
  ) => {
    setGroupOptions((prev) =>
      prev.map((group, groupIndex) =>
        groupIndex === index ? { ...group, portfolios } : group,
      ),
    );
  };

  const handleAddGroup = () => {
    setGroupOptions((prev) => [
      ...prev,
      { value: '', label: '', portfolios: [] },
    ]);
  };

  const handleRemoveGroup = (index: number) => {
    setGroupOptions((prev) =>
      prev.filter((_, groupIndex) => groupIndex !== index),
    );
  };

  const handleSectionLabelChange = (index: number, label: string) => {
    setCustomSections((prev) =>
      prev.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, label } : section,
      ),
    );
  };

  const handleSectionOptionsChange = (index: number, options: string[]) => {
    setCustomSections((prev) =>
      prev.map((section, sectionIndex) =>
        sectionIndex === index ? { ...section, options } : section,
      ),
    );
  };

  const handleRemoveSection = (index: number) => {
    setCustomSections((prev) =>
      prev.filter((_, sectionIndex) => sectionIndex !== index),
    );
  };

  const handleAddSection = () => {
    setCustomSections((prev) => [...prev, createCustomSection()]);
  };

  const handleSave = () => {
    setStatus(null);
    startTransition(async () => {
      const config: MetadataOptionsConfig = {
        groupOptions,
        teamOptions: teamOptions.map((team) => ({
          value: team,
          label: team,
        })),
        customSections,
      };
      const result = await updateMetadataOptions(config);
      if (result.success && result.config) {
        setGroupOptions(
          result.config.groupOptions.map((group) => ({
            value: group.value,
            label: group.label,
            portfolios: [...group.portfolios],
          })),
        );
        setTeamOptions(result.config.teamOptions.map((team) => team.value));
        setCustomSections(
          result.config.customSections.map((section) => ({
            id: section.id,
            label: section.label,
            options: [...section.options],
          })),
        );
        setStatus({ message: result.message, variant: 'success' });
      } else {
        setStatus({ message: result.message, variant: 'error' });
      }
    });
  };

  return (
    <details className='group rounded-2xl border border-border bg-card/70 shadow-sm'>
      <summary className='flex cursor-pointer items-center justify-between gap-4 px-6 py-5 list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'>
        <div>
          <h2 className='text-xl font-semibold text-foreground'>
            Metadata options
          </h2>
          <p className='mt-2 text-sm text-muted-foreground'>
            Manage the options available for user metadata. Built-in sections
            cannot be deleted. Roles are read-only.
          </p>
        </div>
        <ChevronDown className='h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180' />
      </summary>

      <div className='border-t border-border/60 px-6 pb-6'>
        <div className='pt-5 space-y-6'>
        <div className='rounded-xl border border-border/60 bg-background/60 p-4'>
          <h3 className='text-sm font-semibold text-foreground'>Roles</h3>
          <p className='mt-1 text-xs text-muted-foreground'>
            Roles are managed by the system and are not editable.
          </p>
          <div className='mt-3 flex flex-wrap gap-2'>
            {roleOptions.map((role) => (
              <span
                key={role}
                className='rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-foreground'
              >
                {role}
              </span>
            ))}
          </div>
        </div>

        <div className='rounded-xl border border-border/60 bg-background/60 p-4'>
          <h3 className='text-sm font-semibold text-foreground'>Groups</h3>
          <p className='mt-1 text-xs text-muted-foreground'>
            Add or update groups, then manage the portfolios that belong to each
            group.
          </p>
          <div className='mt-4 space-y-4'>
            {groupOptions.length === 0 ? (
              <p className='text-xs text-muted-foreground'>
                No groups added yet.
              </p>
            ) : null}
            {groupOptions.map((group, index) => (
              <div
                key={index}
                className='rounded-lg border border-border/60 bg-background/80 p-4'
              >
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <label className='flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    Group name
                    <input
                      type='text'
                      value={group.value}
                      onChange={(event) =>
                        handleGroupLabelChange(index, event.target.value)
                      }
                      disabled={isPending}
                      placeholder='Group name'
                      className='mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                    />
                  </label>
                  <button
                    type='button'
                    onClick={() => handleRemoveGroup(index)}
                    disabled={isPending}
                    className='rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    Remove group
                  </button>
                </div>
                <div className='mt-4'>
                  <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    Portfolios
                  </p>
                  <OptionListEditor
                    options={[...group.portfolios]}
                    onChange={(next) =>
                      handleGroupPortfoliosChange(index, next)
                    }
                    addLabel='Add portfolio'
                    disabled={isPending}
                    placeholder='Portfolio name'
                    emptyLabel='No portfolios yet.'
                  />
                </div>
              </div>
            ))}
            <button
              type='button'
              onClick={handleAddGroup}
              disabled={isPending}
              className='rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
            >
              Add group
            </button>
          </div>
        </div>

        <div className='rounded-xl border border-border/60 bg-background/60 p-4'>
          <h3 className='text-sm font-semibold text-foreground'>Teams</h3>
          <p className='mt-1 text-xs text-muted-foreground'>
            Update the list of selectable teams.
          </p>
          <div className='mt-4'>
            <OptionListEditor
              options={teamOptions}
              onChange={setTeamOptions}
              addLabel='Add team'
              disabled={isPending}
              placeholder='Team name'
            />
          </div>
        </div>

        <div className='rounded-xl border border-border/60 bg-background/60 p-4'>
          <h3 className='text-sm font-semibold text-foreground'>
            Rank categories
          </h3>
          <p className='mt-1 text-xs text-muted-foreground'>
            Rank categories are managed by the system and are not
            editable.
          </p>
          <div className='mt-3 flex flex-wrap gap-2'>
            {RANK_CATEGORY_OPTIONS.map((option) => (
              <span
                key={option.value}
                className='rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-semibold text-foreground'
              >
                {option.label}
              </span>
            ))}
          </div>
        </div>

        <div className='rounded-xl border border-border/60 bg-background/60 p-4'>
          <h3 className='text-sm font-semibold text-foreground'>Ranks</h3>
          <p className='mt-1 text-xs text-muted-foreground'>
            Ranks are managed by the system and are not editable.
          </p>
          <div className='mt-4 grid gap-3 sm:grid-cols-2'>
            <div>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Enlisted
              </p>
              <div className='mt-2 flex flex-wrap gap-2'>
                {ENLISTED_RANKS.map((rank) => (
                  <span
                    key={rank}
                    className='rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-foreground'
                  >
                    {rank}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                Officer
              </p>
              <div className='mt-2 flex flex-wrap gap-2'>
                {OFFICER_RANKS.map((rank) => (
                  <span
                    key={rank}
                    className='rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-semibold text-foreground'
                  >
                    {rank}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className='rounded-xl border border-border/60 bg-background/60 p-4'>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <div>
              <h3 className='text-sm font-semibold text-foreground'>
                Custom metadata sections
              </h3>
              <p className='mt-1 text-xs text-muted-foreground'>
                Create additional metadata fields with allowed options. Only
                custom sections can be deleted.
              </p>
            </div>
            <button
              type='button'
              onClick={handleAddSection}
              disabled={isPending}
              className='rounded-md border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
            >
              Add section
            </button>
          </div>
          <div className='mt-4 space-y-4'>
            {customSections.length === 0 ? (
              <p className='text-xs text-muted-foreground'>
                No custom sections yet.
              </p>
            ) : null}
            {customSections.map((section, index) => (
              <div
                key={section.id}
                className='rounded-lg border border-border/60 bg-background/80 p-4'
              >
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <label className='flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    Section name
                    <input
                      type='text'
                      value={section.label}
                      onChange={(event) =>
                        handleSectionLabelChange(index, event.target.value)
                      }
                      disabled={isPending}
                      placeholder='Section label'
                      className='mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                    />
                  </label>
                  <button
                    type='button'
                    onClick={() => handleRemoveSection(index)}
                    disabled={isPending}
                    className='rounded-md border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-secondary/70 disabled:cursor-not-allowed disabled:opacity-60'
                  >
                    Delete section
                  </button>
                </div>
                <div className='mt-4'>
                  <p className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
                    Options
                  </p>
                  <OptionListEditor
                    options={section.options}
                    onChange={(next) => handleSectionOptionsChange(index, next)}
                    addLabel='Add option'
                    disabled={isPending}
                    placeholder='Option value'
                    emptyLabel='No options yet.'
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className='flex flex-wrap items-center gap-3'>
          <button
            type='button'
            onClick={handleSave}
            disabled={isPending}
            className='inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
          >
            {isPending ? 'Saving...' : 'Save metadata options'}
          </button>
        </div>

        {status ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              status.variant === 'success'
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-destructive/40 bg-destructive/10 text-destructive'
            }`}
          >
            {status.message}
          </div>
        ) : null}
        </div>
      </div>
    </details>
  );
}
