'use client';

import * as React from 'react';
import {
  ENLISTED_RANKS,
  OFFICER_RANKS,
  RANK_CATEGORY_OPTIONS,
  getPortfoliosForGroup,
  getRanksForCategory,
  isValidGroup,
} from '@/lib/org';
import { useMetadataOptions } from '@/components/metadata/metadata-options-provider';
import type { FormQuestion, FormQuestionType } from '@/types/db';

const MAX_QUESTIONS = 5;
const UNASSIGNED_VALUE = 'unassigned';

const QUESTION_TYPES: Array<{
  value: FormQuestionType;
  label: string;
  description: string;
}> = [
  {
    value: 'multiple_choice',
    label: 'Multiple Choice',
    description: 'Choose several options from a list.',
  },
  {
    value: 'dropdown',
    label: 'Dropdown',
    description: 'Pick one option from a dropdown.',
  },
  {
    value: 'free_text',
    label: 'Free Text',
    description: 'Short response (up to 250 characters).',
  },
  {
    value: 'user_select',
    label: 'User Select',
    description: 'Pick a user from the roster.',
  },
  {
    value: 'number',
    label: 'Numbers',
    description: 'Accept a number within a defined range.',
  },
];

const createQuestion = (type: FormQuestionType): FormQuestion => {
  const id = crypto.randomUUID();
  if (type === 'multiple_choice') {
    return {
      id,
      type,
      prompt: '',
      required: true,
      options: ['Option 1', 'Option 2'],
      allowAdditionalOptions: false,
      maxSelections: 2,
    };
  }
  if (type === 'dropdown') {
    return {
      id,
      type,
      prompt: '',
      required: true,
      options: ['Option 1', 'Option 2'],
    };
  }
  if (type === 'free_text') {
    return {
      id,
      type,
      prompt: '',
      required: true,
      maxLength: 250,
    };
  }
  if (type === 'number') {
    return {
      id,
      type,
      prompt: '',
      required: true,
      minValue: 1,
      maxValue: 10,
      includeMin: true,
      includeMax: true,
      allowAnyNumber: false,
      pricePerUnit: undefined,
      priceSourceQuestionId: undefined,
      priceSourceQuestionIds: undefined,
    };
  }
  return {
    id,
    type: 'user_select',
    prompt: '',
    required: true,
    userFilters: {},
  };
};

type FormBuilderSectionProps = {
  isForm: boolean;
  questions: FormQuestion[];
  setQuestions: React.Dispatch<React.SetStateAction<FormQuestion[]>>;
};

export function FormBuilderSection({
  isForm,
  questions,
  setQuestions,
}: FormBuilderSectionProps) {
  const { groupOptions, teamOptions } = useMetadataOptions();
  const [newQuestionType, setNewQuestionType] =
    React.useState<FormQuestionType>('multiple_choice');
  const allPortfolios = React.useMemo(
    () =>
      groupOptions.flatMap((option) => option.portfolios).map(
        (value) => value as string,
      ),
    [groupOptions],
  );
  const allRanks = React.useMemo(
    () =>
      [...ENLISTED_RANKS, ...OFFICER_RANKS].map(
        (value) => value as string,
      ),
    [],
  );

  if (!isForm) return null;

  const updateQuestion = (
    id: string,
    updater: (question: FormQuestion) => FormQuestion,
  ) => {
    setQuestions((prev) =>
      prev.map((question) =>
        question.id === id ? updater(question) : question,
      ),
    );
  };

  const updateQuestionType = (id: string, nextType: FormQuestionType) => {
    setQuestions((prev) =>
      prev.map((question) => {
        if (question.id !== id) return question;
        if (question.type === nextType) return question;
        const next = createQuestion(nextType);
        return { ...next, id: question.id, prompt: question.prompt };
      }),
    );
  };

  const updateQuestionOptions = (
    id: string,
    options: string[],
    nextMaxSelections?: number,
  ) => {
    updateQuestion(id, (question) => {
      if (question.type !== 'multiple_choice' && question.type !== 'dropdown') {
        return question;
      }
      const maxSelections =
        question.type === 'multiple_choice'
          ? Math.min(
              Math.max(2, nextMaxSelections ?? question.maxSelections ?? 2),
              options.length,
            )
          : question.maxSelections;
      let optionPrices = question.optionPrices
        ? { ...question.optionPrices }
        : undefined;
      if (optionPrices) {
        for (const key of Object.keys(optionPrices)) {
          if (!options.includes(key)) {
            delete optionPrices[key];
          }
        }
        if (Object.keys(optionPrices).length === 0) {
          optionPrices = undefined;
        }
      }
      return {
        ...question,
        options,
        maxSelections,
        optionPrices,
      };
    });
  };

  const updateOptionLabel = (
    questionId: string,
    optionIndex: number,
    nextValue: string,
  ) => {
    updateQuestion(questionId, (question) => {
      if (question.type !== 'multiple_choice' && question.type !== 'dropdown') {
        return question;
      }
      const options = [...(question.options ?? [])];
      const previous = options[optionIndex] ?? '';
      options[optionIndex] = nextValue;
      let optionPrices = question.optionPrices
        ? { ...question.optionPrices }
        : undefined;
      if (optionPrices && previous && previous !== nextValue) {
        if (
          optionPrices[previous] !== undefined &&
          optionPrices[nextValue] === undefined
        ) {
          optionPrices[nextValue] = optionPrices[previous];
        }
        delete optionPrices[previous];
      }
      if (optionPrices && Object.keys(optionPrices).length === 0) {
        optionPrices = undefined;
      }
      return {
        ...question,
        options,
        optionPrices,
      };
    });
  };

  const updateOptionPrice = (
    questionId: string,
    option: string,
    value: string,
  ) => {
    updateQuestion(questionId, (question) => {
      if (question.type !== 'multiple_choice' && question.type !== 'dropdown') {
        return question;
      }
      if (!option.trim()) {
        return question;
      }
      const nextValue = value.trim();
      let optionPrices = question.optionPrices
        ? { ...question.optionPrices }
        : {};
      if (!nextValue) {
        delete optionPrices[option];
      } else {
        const parsed = Number(nextValue);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return question;
        }
        optionPrices[option] = Math.round(parsed * 100) / 100;
      }
      if (Object.keys(optionPrices).length === 0) {
        optionPrices = {};
      }
      return {
        ...question,
        optionPrices:
          Object.keys(optionPrices).length > 0 ? optionPrices : undefined,
      };
    });
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => {
      if (prev.length >= MAX_QUESTIONS) return prev;
      return [...prev, createQuestion(newQuestionType)];
    });
  };

  return (
    <section className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
      <header className='space-y-1'>
        <h2 className='text-xl font-semibold text-foreground'>Form Builder</h2>
        <p className='text-sm text-muted-foreground'>
          Add up to {MAX_QUESTIONS} questions. Each question is required by default.
        </p>
      </header>

      <div className='mt-6 space-y-4'>
        {questions.length === 0 && (
          <p className='rounded-lg border border-dashed border-border/60 bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground'>
            No questions yet. Add your first question below.
          </p>
        )}

        {questions.map((question, index) => {
          const groupValue = question.userFilters?.group ?? '';
          const rankCategoryValue = question.userFilters?.rankCategory ?? '';
          const pricingSources = questions
            .slice(0, index)
            .filter(
              (entry) =>
                entry.type === 'dropdown' || entry.type === 'multiple_choice',
            );
          const portfolioOptions =
            groupValue && isValidGroup(groupValue, groupOptions)
              ? getPortfoliosForGroup(groupValue, groupOptions).map(
                  (value) => value as string,
                )
              : allPortfolios;
          const rankOptions =
            rankCategoryValue === 'Enlisted' ||
            rankCategoryValue === 'Officer'
              ? getRanksForCategory(rankCategoryValue).map(
                  (value) => value as string,
                )
              : rankCategoryValue === 'Civilian'
                ? []
                : allRanks;

          return (
            <article
              key={question.id}
              className='rounded-xl border border-border bg-background/60 p-4'
            >
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
                  onClick={() =>
                    setQuestions((prev) =>
                      prev.filter((entry) => entry.id !== question.id),
                    )
                  }
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
                          <span className='text-xs text-muted-foreground'>
                            $
                          </span>
                          <input
                            type='number'
                            min='0'
                            step='0.01'
                            value={
                              question.optionPrices?.[option] ?? ''
                            }
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
                                        : currentIds.filter(
                                            (id) => id !== source.id,
                                          );
                                      return {
                                        ...current,
                                        priceSourceQuestionId: undefined,
                                        priceSourceQuestionIds:
                                          nextIds.length > 0
                                            ? nextIds
                                            : undefined,
                                      };
                                    })
                                  }
                                  className='h-4 w-4 rounded border-border'
                                />
                                <span>
                                  {source.prompt || 'Untitled question'}
                                </span>
                              </label>
                            );
                          })}
                          {pricingSources.length === 0 && (
                            <span className='text-xs text-muted-foreground'>
                              Add a dropdown or multiple choice question above
                              to map pricing.
                            </span>
                          )}
                        </div>
                        {pricingSources.length > 0 && (
                          <span className='text-xs text-muted-foreground'>
                            Selected option prices are summed to set the per-unit
                            cost.
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
        })}
      </div>

      <div className='mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex flex-1 items-center gap-2'>
          <select
            value={newQuestionType}
            onChange={(event) =>
              setNewQuestionType(event.target.value as FormQuestionType)
            }
            className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <button
            type='button'
            onClick={handleAddQuestion}
            disabled={questions.length >= MAX_QUESTIONS}
            className='inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
          >
            Add question
          </button>
        </div>
        <p className='text-xs text-muted-foreground'>
          {questions.length}/{MAX_QUESTIONS} questions
        </p>
      </div>
    </section>
  );
}
