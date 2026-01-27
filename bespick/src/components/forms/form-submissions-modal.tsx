'use client';

import * as React from 'react';
import { X } from 'lucide-react';
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
              Form submissions
            </h2>
            <p className='mt-1 text-sm text-muted-foreground'>
              Review responses grouped by user. Latest submissions appear first.
            </p>
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
          {!data && (
            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
              Loading submissions...
            </div>
          )}
          {data && groupedSubmissions.length === 0 && (
            <p className='rounded-lg border border-dashed border-border/60 bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground'>
              No submissions yet.
            </p>
          )}
          {data &&
            groupedSubmissions.map((entry) => (
              <details
                key={entry.userId}
                className='mb-3 rounded-xl border border-border bg-background/60 px-4 py-3'
              >
                <summary className='flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-foreground'>
                  <span>{entry.userName ?? 'Unknown user'}</span>
                  <span className='text-xs text-muted-foreground'>
                    {entry.submissions.length} submission
                    {entry.submissions.length === 1 ? '' : 's'}
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
                          const value =
                            answer.displayValue ?? answer.value;
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
      </div>
    </div>
  );
}
