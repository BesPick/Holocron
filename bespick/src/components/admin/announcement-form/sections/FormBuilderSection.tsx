'use client';

import * as React from 'react';
import { ENLISTED_RANKS, OFFICER_RANKS } from '@/lib/org';
import { useMetadataOptions } from '@/components/metadata/metadata-options-provider';
import type { FormQuestion, FormQuestionType } from '@/types/db';
import {
  MAX_QUESTIONS,
  QUESTION_TYPES,
  createQuestion,
} from './form-builder/form-builder-constants';
import { FormBuilderQuestionCard } from './form-builder/form-builder-question-card';

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

        {questions.map((question, index) => (
          <FormBuilderQuestionCard
            key={question.id}
            question={question}
            index={index}
            questions={questions}
            groupOptions={groupOptions}
            teamOptions={teamOptions}
            allPortfolios={allPortfolios}
            allRanks={allRanks}
            updateQuestion={updateQuestion}
            updateQuestionType={updateQuestionType}
            updateQuestionOptions={updateQuestionOptions}
            updateOptionLabel={updateOptionLabel}
            updateOptionPrice={updateOptionPrice}
            onRemove={(id) =>
              setQuestions((prev) => prev.filter((entry) => entry.id !== id))
            }
          />
        ))}
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
