'use client';

import * as React from 'react';
import { ChevronDown, X } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiQuery } from '@/lib/apiClient';
import { formatDate } from '@/lib/announcements';
import type { FormSubmissionSummary } from '@/server/services/announcements';
import type { Id } from '@/types/db';

type FormSubmissionsModalProps = {
  formId: Id<'announcements'>;
  onClose: () => void;
};

export function FormSubmissionsModal({
  formId,
  onClose,
}: FormSubmissionsModalProps) {
  const data = useApiQuery<{ id: Id<'announcements'> }, FormSubmissionSummary>(
    api.announcements.listFormSubmissions,
    { id: formId },
    { liveKeys: ['formSubmissions'] },
  );

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const questionsById = React.useMemo(() => {
    const map = new Map<string, string>();
    data?.questions.forEach((question) => {
      map.set(question.id, question.prompt);
    });
    return map;
  }, [data?.questions]);

  const questionSummaries = React.useMemo(() => {
    if (!data) return [];
    const answersByQuestion = new Map<
      string,
      Array<string | string[]>
    >();
    data.submissions.forEach((submission) => {
      submission.answers.forEach((answer) => {
        const list = answersByQuestion.get(answer.questionId) ?? [];
        list.push(answer.displayValue ?? answer.value);
        answersByQuestion.set(answer.questionId, list);
      });
    });

    return data.questions.map((question) => {
      const answers = answersByQuestion.get(question.id) ?? [];
      const flatAnswers = answers.flatMap((value) =>
        Array.isArray(value) ? value : [value],
      );
      const normalized = flatAnswers
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0);
      const totalResponses = normalized.length;

      if (question.type === 'number') {
        const numbers = normalized
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value));
        const total = numbers.reduce((sum, value) => sum + value, 0);
        const average = numbers.length ? total / numbers.length : 0;
        const min = numbers.length ? Math.min(...numbers) : null;
        const max = numbers.length ? Math.max(...numbers) : null;
        return {
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          totalResponses: numbers.length,
          stats: {
            total,
            average,
            min,
            max,
          },
        };
      }

      if (question.type === 'free_text') {
        return {
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          totalResponses,
          responses: normalized,
        };
      }

      if (
        question.type === 'multiple_choice' ||
        question.type === 'dropdown' ||
        question.type === 'user_select'
      ) {
        const counts = new Map<string, number>();
        normalized.forEach((value) => {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        });
        const items = Array.from(counts.entries()).sort(
          (a, b) => b[1] - a[1],
        );
        return {
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          totalResponses,
          counts: items.map(([value, count]) => ({
            value,
            count,
            percent: totalResponses
              ? Math.round((count / totalResponses) * 100)
              : 0,
          })),
        };
      }

      return {
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        totalResponses,
      };
    });
  }, [data]);

  const groupedSubmissions = React.useMemo(() => {
    if (!data) return [];
    const map = new Map<
      string,
      { userId: string; userName: string | null; submissions: FormSubmissionSummary['submissions'] }
    >();
    data.submissions.forEach((submission) => {
      const entry = map.get(submission.userId);
      if (entry) {
        entry.submissions.push(submission);
      } else {
        map.set(submission.userId, {
          userId: submission.userId,
          userName: submission.userName ?? null,
          submissions: [submission],
        });
      }
    });
    return Array.from(map.values());
  }, [data]);

  const [activeTab, setActiveTab] = React.useState<'summary' | 'individual'>(
    'summary',
  );

  const piePalette = [
    '#2563EB',
    '#DC2626',
    '#16A34A',
    '#D97706',
    '#7C3AED',
    '#0E7490',
    '#DB2777',
    '#4D7C0F',
    '#CA8A04',
    '#475569',
  ];

  const getPieGradient = (counts: Array<{ percent: number }>) => {
    let current = 0;
    const segments = counts.map((item, index) => {
      const color = piePalette[index % piePalette.length];
      const start = current;
      const end = current + item.percent;
      current = end;
      return `${color} ${start}% ${end}%`;
    });
    return segments.length > 0
      ? `conic-gradient(${segments.join(', ')})`
      : 'none';
  };

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6'
      role='dialog'
      aria-modal='true'
      onClick={onClose}
    >
      <div
        className='w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl'
        onClick={(event) => event.stopPropagation()}
      >
        <div className='flex items-start justify-between gap-4'>
          <div>
            <h2 className='text-2xl font-semibold text-foreground'>
              Form Data
            </h2>
            <div className='mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
              <span className='rounded-full border border-border px-2 py-0.5 text-[11px] uppercase tracking-wide'>
                {activeTab === 'summary' ? 'Summary' : 'Individual'}
              </span>
              <span>
                {data
                  ? `${data.submissions.length} response${
                      data.submissions.length === 1 ? '' : 's'
                    }`
                  : 'Loading responses...'}
              </span>
            </div>
          </div>
          <button
            type='button'
            onClick={onClose}
            className='rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground'
            aria-label='Close submissions'
          >
            <X className='h-4 w-4' aria-hidden={true} />
          </button>
        </div>

        <div className='mt-6 max-h-[65vh] overflow-y-auto pr-1'>
          <div className='mb-4 flex items-center gap-2'>
            <button
              type='button'
              onClick={() => setActiveTab('summary')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activeTab === 'summary'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Summary
            </button>
            <button
              type='button'
              onClick={() => setActiveTab('individual')}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                activeTab === 'individual'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              Individual
            </button>
          </div>
          {!data && (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              Loading submissions...
            </div>
          )}
          {data && questionSummaries.length === 0 && (
            <p className='rounded-lg border border-dashed border-border/60 bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground'>
              No submissions yet.
            </p>
          )}
          {data && questionSummaries.length > 0 && activeTab === 'summary' && (
            <div className='space-y-4'>
              {questionSummaries.map((summary) => (
                <div
                  key={summary.id}
                  className='rounded-xl border border-border bg-background/60 p-4'
                >
                  <div className='flex flex-wrap items-start justify-between gap-2'>
                    <div>
                      <p className='text-sm font-semibold text-foreground'>
                        {summary.prompt}
                      </p>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        {summary.totalResponses} response
                        {summary.totalResponses === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  {'counts' in summary && summary.counts ? (
                    <div className='mt-3 space-y-3'>
                      {summary.counts.length > 0 ? (
                        <div className='flex flex-wrap items-start gap-4'>
                          <div
                            className='relative h-24 w-24 shrink-0 rounded-full border border-border'
                            style={{
                              background: getPieGradient(summary.counts),
                            }}
                            aria-hidden={true}
                          >
                            <div className='absolute inset-2 rounded-full bg-card' />
                            <div className='absolute inset-0 flex flex-col items-center justify-center text-center text-[11px] font-semibold text-foreground'>
                              <span>{summary.totalResponses}</span>
                              <span className='text-[10px] font-normal text-muted-foreground'>
                                responses
                              </span>
                            </div>
                          </div>
                          <div className='flex-1 space-y-2'>
                            {summary.counts.map((item, index) => (
                              <div
                                key={`${summary.id}-${item.value}`}
                                className='space-y-1 text-sm'
                              >
                                <div className='flex items-center justify-between'>
                                  <div className='flex items-center gap-2'>
                                    <span
                                      className='h-2 w-2 rounded-full'
                                      style={{
                                        backgroundColor:
                                          piePalette[index % piePalette.length],
                                      }}
                                    />
                                    <span className='text-foreground'>
                                      {item.value}
                                    </span>
                                  </div>
                                  <span className='text-xs text-muted-foreground'>
                                    {item.count} ({item.percent}%)
                                  </span>
                                </div>
                                <div className='h-2 w-full overflow-hidden rounded-full bg-border/60'>
                                  <div
                                    className='h-full rounded-full opacity-70'
                                    style={{
                                      width: `${item.percent}%`,
                                      backgroundColor:
                                        piePalette[index % piePalette.length],
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className='text-xs text-muted-foreground'>
                          No responses yet.
                        </p>
                      )}
                    </div>
                  ) : null}

                  {'stats' in summary && summary.stats ? (
                    <div className='mt-3 grid gap-3 rounded-lg border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground sm:grid-cols-2'>
                      <p>
                        Total: {summary.stats.total.toFixed(2)}
                      </p>
                      <p>
                        Average: {summary.stats.average.toFixed(2)}
                      </p>
                      <p>
                        Min:{' '}
                        {summary.stats.min !== null
                          ? summary.stats.min
                          : '—'}
                      </p>
                      <p>
                        Max:{' '}
                        {summary.stats.max !== null
                          ? summary.stats.max
                          : '—'}
                      </p>
                    </div>
                  ) : null}

                  {'responses' in summary && summary.responses ? (
                    <div className='mt-3 space-y-2'>
                      {summary.responses.length === 0 ? (
                        <p className='text-xs text-muted-foreground'>
                          No responses yet.
                        </p>
                      ) : (
                        summary.responses.slice(0, 5).map((response, idx) => (
                          <div
                            key={`${summary.id}-response-${idx}`}
                            className='rounded-md border border-border/60 bg-card/60 px-3 py-2 text-sm text-foreground'
                          >
                            {response}
                          </div>
                        ))
                      )}
                      {summary.responses.length > 5 && (
                        <p className='text-xs text-muted-foreground'>
                          +{summary.responses.length - 5} more responses
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {data && activeTab === 'individual' && (
            <div className='space-y-4'>
              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <span>Individual responses</span>
                <span>
                  {groupedSubmissions.reduce(
                    (count, entry) => count + entry.submissions.length,
                    0,
                  )}{' '}
                  total
                </span>
              </div>
              {groupedSubmissions.length === 0 && (
                <p className='rounded-lg border border-dashed border-border/60 bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground'>
                  No submissions yet.
                </p>
              )}
              {groupedSubmissions.map((entry) => (
                <details
                  key={entry.userId}
                  className='group rounded-xl border border-border bg-card/60 px-4 py-3'
                >
                  <summary className='flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-foreground'>
                    <span>{entry.userName ?? 'Unknown user'}</span>
                    <span className='flex items-center gap-2 text-xs text-muted-foreground'>
                      {entry.submissions.length} submission
                      {entry.submissions.length === 1 ? '' : 's'}
                      <ChevronDown
                        className='h-4 w-4 transition group-open:rotate-180'
                        aria-hidden={true}
                      />
                    </span>
                  </summary>
                  <div className='mt-3 space-y-4'>
                    {entry.submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className='rounded-lg border border-border/60 bg-card/60 p-3'
                      >
                        <p className='text-xs text-muted-foreground'>
                          Submitted {formatDate(submission.createdAt)}
                        </p>
                        <div className='mt-3 space-y-2'>
                          {submission.answers.map((answer) => {
                            const prompt =
                              questionsById.get(answer.questionId) ??
                              'Question';
                            const value = answer.displayValue ?? answer.value;
                            const renderedValue = Array.isArray(value)
                              ? value.join(', ')
                              : value;
                            return (
                              <div key={answer.questionId}>
                                <p className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
                                  {prompt}
                                </p>
                                <p className='text-sm text-foreground'>
                                  {renderedValue || 'No response'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
