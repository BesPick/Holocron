'use client';

import * as React from 'react';
import type { FormQuestion, FormQuestionType } from '@/types/db';
import {
  ENLISTED_RANKS,
  OFFICER_RANKS,
  RANK_CATEGORY_OPTIONS,
  getPortfoliosForGroup,
  getRanksForCategory,
  isValidGroup,
  type GroupOption,
  type TeamOption,
} from '@/lib/org';
import { QUESTION_TYPES, UNASSIGNED_VALUE } from './form-builder-constants';

type UpdateQuestion = (
  id: string,
  updater: (question: FormQuestion) => FormQuestion,
) => void;

type UpdateQuestionOptions = (
  id: string,
  options: string[],
  nextMaxSelections?: number,
) => void;

type FormBuilderQuestionCardProps = {
  question: FormQuestion;
  index: number;
  questions: FormQuestion[];
  groupOptions: GroupOption[];
  teamOptions: TeamOption[];
  allPortfolios: string[];
  allRanks: string[];
  updateQuestion: UpdateQuestion;
  updateQuestionType: (id: string, nextType: FormQuestionType) => void;
  updateQuestionOptions: UpdateQuestionOptions;
  updateOptionLabel: (
    questionId: string,
    optionIndex: number,
    nextValue: string,
  ) => void;
  updateOptionPrice: (questionId: string, option: string, value: string) => void;
  onRemove: (id: string) => void;
};

export function FormBuilderQuestionCard({
  question,
  index,
  questions,
  groupOptions,
  teamOptions,
  allPortfolios,
  allRanks,
  updateQuestion,
  updateQuestionType,
  updateQuestionOptions,
  updateOptionLabel,
  updateOptionPrice,
  onRemove,
}: FormBuilderQuestionCardProps) {
  const groupValue = question.userFilters?.group ?? '';
  const rankCategoryValue = question.userFilters?.rankCategory ?? '';
  const pricingSources = questions
    .slice(0, index)
    .filter(
      (entry) => entry.type === 'dropdown' || entry.type === 'multiple_choice',
    );
  const portfolioOptions =
    groupValue && isValidGroup(groupValue, groupOptions)
      ? getPortfoliosForGroup(groupValue, groupOptions).map(
          (value) => value as string,
        )
      : allPortfolios;
  const rankOptions =
    rankCategoryValue === 'Enlisted' || rankCategoryValue === 'Officer'
      ? getRanksForCategory(rankCategoryValue).map((value) => value as string)
      : rankCategoryValue === 'Civilian'
        ? []
        : allRanks;

  return (
    <article className='rounded-xl border border-border bg-background/60 p-4'>
      <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='flex-1 space-y-3'>
          <label className='flex flex-col gap-2 text-sm text-foreground'>
            Prompt
            <input
              type='text'
              value={question.prompt}
              onChange={(event) =>
                updateQuestion(question.id, (current) => ({
                  ...current,
                  prompt: event.target.value,
                }))
              }
              placeholder='Type your question...'
              className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            />
          </label>

          <label className='flex flex-col gap-2 text-sm text-foreground'>
            Question type
            <select
              value={question.type}
              onChange={(event) =>
                updateQuestionType(
                  question.id,
                  event.target.value as FormQuestionType,
                )
              }
              className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            >
              {QUESTION_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>

          <label className='flex items-center gap-2 text-sm text-foreground'>
            <input
              type='checkbox'
              checked={question.required ?? true}
              onChange={(event) =>
                updateQuestion(question.id, (current) => ({
                  ...current,
                  required: event.target.checked,
                }))
              }
              className='h-4 w-4 rounded border-border'
            />
            Required
          </label>
        </div>

        <button
          type='button'
          onClick={() => onRemove(question.id)}
          className='inline-flex items-center justify-center rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground'
        >
          Remove
        </button>
      </div>

      {question.type === 'multiple_choice' && (
        <div className='mt-4 space-y-3'>
          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Max selections
              <input
                type='number'
                min={2}
                max={10}
                value={question.maxSelections ?? 2}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  updateQuestionOptions(
                    question.id,
                    question.options ?? [],
                    Number.isFinite(nextValue) ? nextValue : 2,
                  );
                }}
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              />
            </label>
            <label className='flex items-center gap-2 text-sm text-foreground'>
              <input
                type='checkbox'
                checked={Boolean(question.allowAdditionalOptions)}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    allowAdditionalOptions: event.target.checked,
                  }))
                }
                className='h-4 w-4 rounded border-border'
              />
              Allow users to add their own options
            </label>
          </div>

          <div className='space-y-2'>
            <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
              Options
            </p>
            <p className='text-xs text-muted-foreground'>
              Optional: assign prices per option to influence the payment total.
            </p>
            {(question.options ?? []).map((option, optionIndex) => (
              <div
                key={`${question.id}-option-${optionIndex}`}
                className='flex flex-col gap-2 sm:flex-row sm:items-center'
              >
                <input
                  type='text'
                  value={option}
                  onChange={(event) => {
                    updateOptionLabel(
                      question.id,
                      optionIndex,
                      event.target.value,
                    );
                  }}
                  className='flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                />
                <div className='flex items-center gap-2'>
                  <span className='text-xs text-muted-foreground'>$</span>
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={question.optionPrices?.[option] ?? ''}
                    onChange={(event) =>
                      updateOptionPrice(
                        question.id,
                        option,
                        event.target.value,
                      )
                    }
                    placeholder='0.00'
                    className='w-28 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                  />
                </div>
                <button
                  type='button'
                  onClick={() => {
                    const currentOptions = question.options ?? [];
                    if (currentOptions.length <= 2) return;
                    const next = currentOptions.filter(
                      (_, idx) => idx !== optionIndex,
                    );
                    updateQuestionOptions(
                      question.id,
                      next,
                      question.maxSelections,
                    );
                  }}
                  disabled={(question.options ?? []).length <= 2}
                  className='rounded-md border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60'
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type='button'
              onClick={() => {
                const currentOptions = question.options ?? [];
                if (currentOptions.length >= 10) return;
                const next = [...currentOptions, ''];
                updateQuestionOptions(
                  question.id,
                  next,
                  question.maxSelections,
                );
              }}
              disabled={(question.options ?? []).length >= 10}
              className='inline-flex items-center justify-center rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60'
            >
              Add option
            </button>
          </div>
        </div>
      )}

      {question.type === 'dropdown' && (
        <div className='mt-4 space-y-2'>
          <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            Dropdown options
          </p>
          <p className='text-xs text-muted-foreground'>
            Optional: assign prices per option to influence the payment total.
          </p>
          {(question.options ?? []).map((option, optionIndex) => (
            <div
              key={`${question.id}-dropdown-${optionIndex}`}
              className='flex flex-col gap-2 sm:flex-row sm:items-center'
            >
              <input
                type='text'
                value={option}
                onChange={(event) => {
                  updateOptionLabel(
                    question.id,
                    optionIndex,
                    event.target.value,
                  );
                }}
                className='flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              />
              <div className='flex items-center gap-2'>
                <span className='text-xs text-muted-foreground'>$</span>
                <input
                  type='number'
                  min='0'
                  step='0.01'
                  value={question.optionPrices?.[option] ?? ''}
                  onChange={(event) =>
                    updateOptionPrice(
                      question.id,
                      option,
                      event.target.value,
                    )
                  }
                  placeholder='0.00'
                  className='w-28 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                />
              </div>
              <button
                type='button'
                onClick={() => {
                  const currentOptions = question.options ?? [];
                  if (currentOptions.length <= 2) return;
                  const next = currentOptions.filter(
                    (_, idx) => idx !== optionIndex,
                  );
                  updateQuestionOptions(question.id, next);
                }}
                disabled={(question.options ?? []).length <= 2}
                className='rounded-md border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground disabled:cursor-not-allowed disabled:opacity-60'
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type='button'
            onClick={() => {
              const currentOptions = question.options ?? [];
              if (currentOptions.length >= 10) return;
              const next = [...currentOptions, ''];
              updateQuestionOptions(question.id, next);
            }}
            disabled={(question.options ?? []).length >= 10}
            className='inline-flex items-center justify-center rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60'
          >
            Add option
          </button>
        </div>
      )}

      {question.type === 'free_text' && (
        <p className='mt-4 text-sm text-muted-foreground'>
          Free text responses are limited to 250 characters.
        </p>
      )}

      {question.type === 'user_select' && (
        <div className='mt-4 space-y-3'>
          <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            User filters
          </p>
          <label className='text-sm text-foreground' htmlFor={`search-${question.id}`}>
            Search
            <input
              id={`search-${question.id}`}
              type='text'
              value={question.userFilters?.search ?? ''}
              onChange={(event) =>
                updateQuestion(question.id, (current) => ({
                  ...current,
                  userFilters: {
                    ...current.userFilters,
                    search: event.target.value,
                  },
                }))
              }
              placeholder='Filter by name or email'
              className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            />
          </label>

          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
            <label className='text-sm text-foreground'>
              Role
              <select
                value={question.userFilters?.role ?? ''}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    userFilters: {
                      ...current.userFilters,
                      role: event.target.value,
                    },
                  }))
                }
                className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              >
                <option value=''>All roles</option>
                <option value='admin'>Admin</option>
                <option value='moderator'>Moderator</option>
                <option value='scheduler'>Scheduler</option>
                <option value='morale-member'>Morale Member</option>
                <option value='member'>Member</option>
              </select>
            </label>

            <label className='text-sm text-foreground'>
              Rank category
              <select
                value={question.userFilters?.rankCategory ?? ''}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    userFilters: {
                      ...current.userFilters,
                      rankCategory: event.target.value,
                      rank: '',
                    },
                  }))
                }
                className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              >
                <option value=''>All categories</option>
                <option value={UNASSIGNED_VALUE}>Unassigned</option>
                {RANK_CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className='text-sm text-foreground'>
              Rank
              <select
                value={question.userFilters?.rank ?? ''}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    userFilters: {
                      ...current.userFilters,
                      rank: event.target.value,
                    },
                  }))
                }
                className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              >
                <option value=''>All ranks</option>
                <option value={UNASSIGNED_VALUE}>Unassigned</option>
                {rankOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className='text-sm text-foreground'>
              Group
              <select
                value={question.userFilters?.group ?? ''}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    userFilters: {
                      ...current.userFilters,
                      group: event.target.value,
                      portfolio: '',
                    },
                  }))
                }
                className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              >
                <option value=''>All groups</option>
                <option value={UNASSIGNED_VALUE}>Unassigned</option>
                {groupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className='text-sm text-foreground'>
              Portfolio
              <select
                value={question.userFilters?.portfolio ?? ''}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    userFilters: {
                      ...current.userFilters,
                      portfolio: event.target.value,
                    },
                  }))
                }
                className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              >
                <option value=''>All portfolios</option>
                <option value={UNASSIGNED_VALUE}>Unassigned</option>
                {portfolioOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className='text-sm text-foreground'>
              Team
              <select
                value={question.userFilters?.team ?? ''}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    userFilters: {
                      ...current.userFilters,
                      team: event.target.value,
                    },
                  }))
                }
                className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              >
                <option value=''>All teams</option>
                <option value={UNASSIGNED_VALUE}>Unassigned</option>
                {teamOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      )}

      {question.type === 'number' && (
        <div className='mt-4 space-y-3'>
          <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
            Allowed range
          </p>
          <label className='flex items-center gap-2 text-sm text-foreground'>
            <input
              type='checkbox'
              checked={Boolean(question.allowAnyNumber)}
              onChange={(event) =>
                updateQuestion(question.id, (current) => ({
                  ...current,
                  allowAnyNumber: event.target.checked,
                }))
              }
              className='h-4 w-4 rounded border-border'
            />
            Allow any number (no bounds)
          </label>
          <div className='grid gap-3 sm:grid-cols-2'>
            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Minimum
              <input
                type='number'
                value={question.minValue ?? 0}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    minValue: Number(event.target.value),
                  }))
                }
                disabled={Boolean(question.allowAnyNumber)}
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              />
            </label>
            <label className='flex flex-col gap-2 text-sm text-foreground'>
              Maximum
              <input
                type='number'
                value={question.maxValue ?? 0}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    maxValue: Number(event.target.value),
                  }))
                }
                disabled={Boolean(question.allowAnyNumber)}
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              />
            </label>
          </div>
          <div className='flex flex-wrap items-center gap-4 text-sm text-foreground'>
            <label className='inline-flex items-center gap-2'>
              <input
                type='checkbox'
                checked={question.includeMin ?? true}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    includeMin: event.target.checked,
                  }))
                }
                disabled={Boolean(question.allowAnyNumber)}
                className='h-4 w-4 rounded border-border'
              />
              Include minimum
            </label>
            <label className='inline-flex items-center gap-2'>
              <input
                type='checkbox'
                checked={question.includeMax ?? true}
                onChange={(event) =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    includeMax: event.target.checked,
                  }))
                }
                disabled={Boolean(question.allowAnyNumber)}
                className='h-4 w-4 rounded border-border'
              />
              Include maximum
            </label>
          </div>
          <div className='space-y-2'>
            <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
              Pricing
            </p>
            <div className='flex flex-wrap items-center gap-2'>
              <button
                type='button'
                onClick={() =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    priceSourceQuestionId: undefined,
                    priceSourceQuestionIds: undefined,
                  }))
                }
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  !question.priceSourceQuestionIds?.length &&
                  !question.priceSourceQuestionId
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Fixed per unit
              </button>
              <button
                type='button'
                disabled={pricingSources.length === 0}
                onClick={() =>
                  updateQuestion(question.id, (current) => ({
                    ...current,
                    pricePerUnit: undefined,
                    priceSourceQuestionId: undefined,
                    priceSourceQuestionIds: pricingSources[0]
                      ? [pricingSources[0].id]
                      : undefined,
                  }))
                }
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  question.priceSourceQuestionIds?.length
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                From option price
              </button>
            </div>

            {!question.priceSourceQuestionIds?.length &&
              !question.priceSourceQuestionId && (
                <label className='flex flex-col gap-2 text-sm text-foreground'>
                  Price per unit (optional)
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={question.pricePerUnit ?? ''}
                    onChange={(event) =>
                      updateQuestion(question.id, (current) => {
                        const raw = event.target.value;
                        if (raw === '') {
                          return { ...current, pricePerUnit: undefined };
                        }
                        const parsed = Number(raw);
                        if (!Number.isFinite(parsed) || parsed < 0) {
                          return current;
                        }
                        return { ...current, pricePerUnit: parsed };
                      })
                    }
                    placeholder='0.00'
                    className='w-40 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                  />
                </label>
              )}

            {(question.priceSourceQuestionIds?.length ||
              question.priceSourceQuestionId) && (
              <div className='space-y-2'>
                <p className='text-xs text-muted-foreground'>
                  Use option prices from
                </p>
                <div className='space-y-2'>
                  {pricingSources.map((source) => {
                    const selected = (
                      question.priceSourceQuestionIds ??
                      (question.priceSourceQuestionId
                        ? [question.priceSourceQuestionId]
                        : [])
                    ).includes(source.id);
                    return (
                      <label
                        key={source.id}
                        className='flex items-center gap-2 text-sm text-foreground'
                      >
                        <input
                          type='checkbox'
                          checked={selected}
                          onChange={(event) =>
                            updateQuestion(question.id, (current) => {
                              const currentIds =
                                current.priceSourceQuestionIds ??
                                (current.priceSourceQuestionId
                                  ? [current.priceSourceQuestionId]
                                  : []);
                              const nextIds = event.target.checked
                                ? Array.from(
                                    new Set([...currentIds, source.id]),
                                  )
                                : currentIds.filter((id) => id !== source.id);
                              return {
                                ...current,
                                priceSourceQuestionId: undefined,
                                priceSourceQuestionIds:
                                  nextIds.length > 0 ? nextIds : undefined,
                              };
                            })
                          }
                          className='h-4 w-4 rounded border-border'
                        />
                        <span>{source.prompt || 'Untitled question'}</span>
                      </label>
                    );
                  })}
                  {pricingSources.length === 0 && (
                    <span className='text-xs text-muted-foreground'>
                      Add a dropdown or multiple choice question above to map
                      pricing.
                    </span>
                  )}
                </div>
                {pricingSources.length > 0 && (
                  <span className='text-xs text-muted-foreground'>
                    Selected option prices are summed to set the per-unit cost.
                  </span>
                )}
              </div>
            )}
          </div>
          <p className='text-xs text-muted-foreground'>
            {question.allowAnyNumber
              ? 'Users can enter any number.'
              : 'Users must enter a number within the range. Excluding a bound means the number must be greater than or less than that value.'}
          </p>
        </div>
      )}
    </article>
  );
}
