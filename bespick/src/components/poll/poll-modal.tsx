'use client';

import * as React from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Loader2, X } from 'lucide-react';
import type { Id } from '../../../convex/_generated/dataModel';
import { api } from '../../../convex/_generated/api';

type PollModalProps = {
  pollId: Id<'announcements'>;
  onClose: () => void;
  isAdmin: boolean;
  canVote: boolean;
};

export function PollModal({
  pollId,
  onClose,
  isAdmin,
  canVote,
}: PollModalProps) {
  const poll = useQuery(api.announcements.getPoll, { id: pollId });
  const imageUrls = useQuery(
    api.storage.getImageUrls,
    poll?.imageIds && poll.imageIds.length ? { ids: poll.imageIds } : 'skip',
  );
  const votePoll = useMutation(api.announcements.votePoll);

  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [selections, setSelections] = React.useState<string[]>([]);
  const [newOption, setNewOption] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [showBreakdown, setShowBreakdown] = React.useState(false);

  React.useEffect(() => {
    if (!poll) return;
    setSelections(poll.currentUserSelections ?? []);
  }, [poll]);

  const breakdownArgs =
    isAdmin && showBreakdown ? { id: pollId } : 'skip';
  const pollBreakdown = useQuery(
    api.announcements.getPollVoteBreakdown,
    breakdownArgs,
  );

  React.useEffect(() => {
    if (!previewImage) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewImage(null);
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [previewImage]);

  const showResults = !poll?.pollAnonymous || isAdmin;
  const maxSelections = poll?.pollMaxSelections ?? 1;
  const pollClosed = Boolean(poll?.isClosed);
  const pollArchived = Boolean(poll?.isArchived);
  const votingDisabled = pollClosed || pollArchived;

  const toggleSelection = React.useCallback(
    (option: string) => {
      setSelections((prev) => {
        if (maxSelections === 1) {
          return prev.includes(option) ? [] : [option];
        }
        if (prev.includes(option)) {
          return prev.filter((item) => item !== option);
        }
        if (prev.length >= maxSelections) {
          const [, ...rest] = prev;
          return [...rest, option];
        }
        return [...prev, option];
      });
    },
    [maxSelections],
  );

  const handleSubmit = React.useCallback(async () => {
    if (!poll) return;
    if (votingDisabled) {
      setLocalError('This poll is read-only.');
      return;
    }
    setLocalError(null);
    const trimmedNewOption =
      poll.pollAllowAdditionalOptions && newOption.trim().length > 0
        ? newOption.trim()
        : '';
    const submissionSelections = trimmedNewOption.length
      ? Array.from(new Set([...selections, trimmedNewOption]))
      : selections;

    if (submissionSelections.length === 0) {
      setLocalError('Select at least one option.');
      return;
    }

    if (submissionSelections.length > poll.pollMaxSelections) {
      setLocalError(
        `You can select up to ${poll.pollMaxSelections} option${
          poll.pollMaxSelections > 1 ? 's' : ''
        }.`,
      );
      return;
    }

    try {
      setSubmitting(true);
      await votePoll({
        id: pollId,
        selections: submissionSelections,
        newOption: trimmedNewOption || undefined,
      });
      setNewOption('');
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Failed to submit vote.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    poll,
    votePoll,
    pollId,
    newOption,
    selections,
    votingDisabled,
  ]);

  if (!poll) {
    return (
      <div
        className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4'
        onClick={onClose}
      >
        <div
          className='rounded-2xl border border-border bg-card p-6 text-center shadow-2xl'
          onClick={(event) => event.stopPropagation()}
        >
          <Loader2 className='mx-auto h-6 w-6 animate-spin text-primary' />
          <p className='mt-2 text-sm text-muted-foreground'>
            Loading poll details...
          </p>
        </div>
      </div>
    );
  }

  const totalVotes = poll.totalVotes;

  return (
    <>
      <div
        className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6'
        role='dialog'
        aria-modal='true'
        onClick={onClose}
      >
        <div
          className='w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl'
          onClick={(event) => event.stopPropagation()}
        >
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-xs font-medium uppercase tracking-wide text-primary'>
                Poll
              </p>
              <h2 className='mt-1 text-2xl font-semibold text-foreground'>
                {poll.question}
              </h2>
              {poll.description && (
                <p className='mt-2 text-sm text-muted-foreground'>
                  {poll.description}
                </p>
              )}
              {imageUrls && imageUrls.length > 0 && (
                <div className='mt-3 grid gap-3 sm:grid-cols-2'>
                  {imageUrls.map((image) => (
                    <button
                      type='button'
                      key={image.id}
                      onClick={() => setPreviewImage(image.url)}
                      className='group relative overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.url}
                        alt='Poll image'
                        className='h-40 w-full object-cover transition duration-200 group-hover:scale-105'
                      />
                      <span className='sr-only'>View full-size image</span>
                    </button>
                  ))}
                </div>
              )}
              <p className='mt-3 text-xs text-muted-foreground'>
                {maxSelections === 1
                  ? 'Select one option.'
                  : `Select up to ${maxSelections} options.`}
              </p>
              {poll.pollAnonymous && !isAdmin && (
                <p className='mt-1 text-xs text-amber-500'>
                  This poll is anonymous. Only your selections will be visible.
                </p>
              )}
              {pollClosed && (
                <p className='mt-1 text-xs text-red-500'>
                  Poll closed to new votes.
                </p>
              )}
              {pollArchived && (
                <p className='mt-1 text-xs text-red-500'>
                  Poll archived; read-only mode.
                </p>
              )}
            </div>
            <button
              type='button'
              onClick={onClose}
              className='rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground'
              aria-label='Close poll'
            >
              <X className='h-4 w-4' aria-hidden='true' />
            </button>
          </div>

          <div className='mt-6 space-y-3'>
            {poll.options.map((option) => {
              const isSelected = selections.includes(option.value);
              const percent =
                totalVotes === 0
                  ? 0
                  : Math.round((option.votes / totalVotes) * 100);
              return (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-sm transition ${
                    isSelected ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <input
                    type='checkbox'
                    checked={isSelected}
                    disabled={!canVote || submitting || votingDisabled}
                    onChange={() => toggleSelection(option.value)}
                    className='h-4 w-4 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
                  />
                  <div className='flex flex-1 flex-col gap-1'>
                    <span className='font-medium text-foreground'>
                      {option.value}
                    </span>
                    {showResults ? (
                      <span className='text-xs text-muted-foreground'>
                        {option.votes} vote{option.votes === 1 ? '' : 's'} (
                        {percent}%)
                      </span>
                    ) : (
                      isSelected && (
                        <span className='text-xs text-muted-foreground'>
                          You selected this option.
                        </span>
                      )
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {poll.pollAllowAdditionalOptions && (
            <label className='mt-4 flex flex-col gap-2 text-sm text-foreground'>
              Suggest a new option
              <input
                type='text'
                value={newOption}
                onChange={(event) => setNewOption(event.target.value)}
                className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                placeholder='Add a new option'
                disabled={!canVote || submitting || votingDisabled}
              />
              <span className='text-xs text-muted-foreground'>
                The option will be included in your vote submission.
              </span>
            </label>
          )}

          {localError && (
            <div className='mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {localError}
            </div>
          )}

          <div className='mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground'>
            <div className='space-y-1'>
              <p>
                Total votes:{' '}
                <span className='font-semibold text-foreground'>
                  {totalVotes}
                </span>
              </p>
              {poll.closesAt && (
                <p className='text-xs text-muted-foreground'>
                  Poll {pollClosed ? 'closed' : 'closes'} on{' '}
                  {new Intl.DateTimeFormat(undefined, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(poll.closesAt))}
                </p>
              )}
              {pollClosed && (
                <p className='text-xs text-amber-500'>
                  This poll has ended. Voting is disabled.
                </p>
              )}
              {pollArchived && (
                <p className='text-xs text-amber-500'>
                  This poll is archived and read-only.
                </p>
              )}
              {isAdmin && (
                <button
                  type='button'
                  onClick={() => setShowBreakdown((prev) => !prev)}
                  className='mt-2 text-xs font-semibold text-primary underline-offset-2 hover:underline'
                >
                  {showBreakdown
                    ? 'Hide voter breakdown'
                    : 'View voter breakdown'}
                </button>
              )}
            </div>
            <div className='flex items-center gap-2'>
              {!canVote && (
                <span className='text-xs text-muted-foreground'>
                  Sign in to vote.
                </span>
              )}
              <button
                type='button'
                onClick={handleSubmit}
                disabled={!canVote || submitting || votingDisabled}
                className='inline-flex items-center justify-center rounded-md border border-primary bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60'
              >
                {submitting ? (
                  <>
                    <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    Submitting...
                  </>
                ) : (
                  'Save Vote'
                )}
              </button>
            </div>
          </div>

          {isAdmin && showBreakdown && (
            <div className='mt-6 rounded-xl border border-border bg-muted/20 p-4'>
              <p className='text-sm font-semibold text-foreground'>
                Voter breakdown
              </p>
              <p className='text-xs text-muted-foreground'>
                Names reflect the most recent information shared with BESPICK.
              </p>
              {pollBreakdown === undefined ? (
                <div className='mt-4 flex items-center gap-2 text-sm text-muted-foreground'>
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Loading voter details...
                </div>
              ) : pollBreakdown.totalVotes === 0 ? (
                <p className='mt-4 text-sm text-muted-foreground'>
                  No votes recorded yet.
                </p>
              ) : (
                <div className='mt-4 space-y-4'>
                  {pollBreakdown.options.map((option) => (
                    <div key={option.value}>
                      <div className='flex items-center justify-between text-sm'>
                        <span className='font-medium text-foreground'>
                          {option.value}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                          {option.voteCount} vote
                          {option.voteCount === 1 ? '' : 's'}
                        </span>
                      </div>
                      {option.voters.length > 0 ? (
                        <ul className='mt-2 flex flex-wrap gap-2'>
                          {option.voters.map((voter, index) => (
                            <li
                              key={`${option.value}-${voter.userId}-${index}`}
                              className='rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground'
                            >
                              {voter.userName ?? voter.userId}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className='mt-2 text-xs text-muted-foreground'>
                          No votes for this option yet.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {previewImage && (
        <div
          className='fixed inset-0 z-[60] flex items-center justify-center bg-black/80 px-4 py-6'
          role='dialog'
          aria-modal='true'
          onClick={() => setPreviewImage(null)}
        >
          <div
            className='max-h-[90vh] w-full max-w-4xl'
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt='Full-size poll image'
              className='h-full w-full rounded-xl object-contain'
            />
            <p className='mt-2 text-center text-xs text-muted-foreground'>
              Click outside or press Escape to close.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
