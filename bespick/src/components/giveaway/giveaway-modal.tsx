'use client';

import * as React from 'react';
import { ChevronDown, X } from 'lucide-react';
import {
  type PayPalButtonsComponentProps,
  type ReactPayPalScriptOptions,
} from '@paypal/react-paypal-js';
import { api } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/apiClient';
import { formatCreator, formatDate, formatEventType } from '@/lib/announcements';
import { PayPalPanel } from '@/components/payments/paypal-panel';
import type {
  CloseGiveawayArgs,
  EnterGiveawayArgs,
  GiveawayDetails,
  ReopenGiveawayArgs,
  RedrawGiveawayArgs,
} from '@/server/services/announcements';
import type { Id, StorageImage } from '@/types/db';

type GiveawayModalProps = {
  giveawayId: Id<'announcements'>;
  onClose: () => void;
  canEnter: boolean;
  isAdmin: boolean;
};

type PaymentState = {
  orderId: string | null;
  captured: boolean;
  error: string | null;
};

type GiveawayPayPalPanelProps = {
  amount: number;
  description: string;
  referenceId: string;
  onPaid: (orderId: string) => void;
  onError: (message: string) => void;
};

function GiveawayPayPalPanel({
  amount,
  description,
  referenceId,
  onPaid,
  onError,
}: GiveawayPayPalPanelProps) {
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const paypalCurrency =
    process.env.NEXT_PUBLIC_PAYPAL_CURRENCY ?? 'USD';
  const paypalBuyerCountry =
    process.env.NEXT_PUBLIC_PAYPAL_BUYER_COUNTRY;

  const paypalOptions = React.useMemo<ReactPayPalScriptOptions>(
    () => ({
      clientId: paypalClientId ?? '',
      currency: paypalCurrency,
      intent: 'capture',
      ...(paypalBuyerCountry ? { buyerCountry: paypalBuyerCountry } : {}),
    }),
    [paypalBuyerCountry, paypalClientId, paypalCurrency],
  );
  const amountLabel = React.useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: paypalCurrency,
        minimumFractionDigits: 2,
      }).format(amount),
    [amount, paypalCurrency],
  );

  const paypalButtonsProps = React.useMemo<PayPalButtonsComponentProps>(
    () => ({
      style: {
        background: 'transparent',
        shape: 'sharp',
        layout: 'vertical',
        label: 'pay',
        height: 48,
      },
      forceReRender: [amount, paypalCurrency, paypalClientId ?? ''],
      async createOrder() {
        if (!paypalClientId) {
          onError('PayPal is not configured.');
          throw new Error('Missing PayPal client id');
        }
        const response = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            description,
            referenceId,
            currency: paypalCurrency,
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message =
            typeof body?.error === 'string'
              ? body.error
              : 'Unable to start PayPal checkout.';
          onError(message);
          throw new Error(message);
        }
        const order = (await response.json()) as { id?: string };
        if (!order?.id) {
          const message = 'PayPal did not return an order id.';
          onError(message);
          throw new Error(message);
        }
        return order.id;
      },
      async onApprove(data) {
        try {
          const response = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: data.orderID }),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const message =
              typeof body?.error === 'string'
                ? body.error
                : 'Unable to capture PayPal payment.';
            onError(message);
            return;
          }
          onPaid(data.orderID);
        } catch (error) {
          console.error('PayPal capture error', error);
          onError('PayPal checkout failed. Please try again.');
        }
      },
      onError() {
        onError('PayPal checkout failed. Please try again.');
      },
    }),
    [
      amount,
      description,
      referenceId,
      paypalClientId,
      paypalCurrency,
      onError,
      onPaid,
    ],
  );

  return (
    <PayPalPanel
      amountLabel={amountLabel}
      paypalOptions={paypalOptions}
      paypalButtonsProps={paypalButtonsProps}
    />
  );
}

export function GiveawayModal({
  giveawayId,
  onClose,
  canEnter,
  isAdmin,
}: GiveawayModalProps) {
  const giveaway = useApiQuery<{ id: Id<'announcements'> }, GiveawayDetails>(
    api.announcements.getGiveaway,
    { id: giveawayId },
    { liveKeys: ['announcements', 'giveawayEntries'] },
  );
  const imageUrls = useApiQuery<
    { ids: Id<'_storage'>[] },
    StorageImage[]
  >(
    api.storage.getImageUrls,
    giveaway?.imageIds && giveaway.imageIds.length
      ? { ids: giveaway.imageIds }
      : 'skip',
  );
  const enterGiveaway = useApiMutation<EnterGiveawayArgs, { success: boolean }>(
    api.announcements.enterGiveaway,
  );
  const closeGiveaway = useApiMutation<CloseGiveawayArgs, { closed: boolean }>(
    api.announcements.closeGiveaway,
  );
  const reopenGiveaway = useApiMutation<
    ReopenGiveawayArgs,
    { reopened: boolean }
  >(api.announcements.reopenGiveaway);
  const redrawGiveaway = useApiMutation<
    RedrawGiveawayArgs,
    { redrawn: boolean }
  >(api.announcements.redrawGiveaway);

  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [localGiveaway, setLocalGiveaway] =
    React.useState<GiveawayDetails | null>(null);
  const [tickets, setTickets] = React.useState('1');
  const [submitting, setSubmitting] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [payment, setPayment] = React.useState<PaymentState>({
    orderId: null,
    captured: false,
    error: null,
  });
  const successTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    setTickets('1');
    setLocalError(null);
    setSuccessMessage(null);
    setLocalGiveaway(null);
    setPayment({ orderId: null, captured: false, error: null });
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [giveawayId]);

  React.useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (giveaway) {
      setLocalGiveaway(null);
    }
  }, [
    giveaway?.totalEntries,
    giveaway?.currentUserTickets,
    giveaway?.giveawayIsClosed,
    giveaway?.updatedAt,
    giveaway?.winners?.length,
    giveaway?.winners?.[0]?.createdAt,
  ]);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
          return;
        }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, previewImage]);

  const displayGiveaway = localGiveaway ?? giveaway ?? null;

  const parsedTickets = React.useMemo(() => {
    const value = parseInt(tickets, 10);
    if (!Number.isFinite(value)) return 1;
    return Math.max(1, value);
  }, [tickets]);

  const allowMultiple = displayGiveaway?.giveawayAllowMultipleEntries ?? false;
  const entryCap = displayGiveaway?.giveawayEntryCap ?? null;
  const entryPrice =
    typeof displayGiveaway?.giveawayEntryPrice === 'number'
      ? displayGiveaway.giveawayEntryPrice
      : null;
  const paymentRequired = Boolean(entryPrice && entryPrice > 0);
  const totalPayment =
    paymentRequired && entryPrice ? entryPrice * parsedTickets : 0;

  const isPublished = displayGiveaway?.status === 'published';
  const isClosed = Boolean(displayGiveaway?.giveawayIsClosed);
  const canEnterNow = Boolean(canEnter && isPublished && !isClosed);
  const shouldDisableTickets = !allowMultiple || !canEnterNow;
  const hasReachedEntryCap =
    displayGiveaway &&
    (allowMultiple
      ? entryCap !== null &&
        displayGiveaway.currentUserTickets >= entryCap
      : displayGiveaway.currentUserTickets >= 1);
  const shouldShowEnterSection = Boolean(
    displayGiveaway && !displayGiveaway.giveawayIsClosed && !hasReachedEntryCap,
  );

  const handlePaymentError = React.useCallback((message: string) => {
    setPayment((prev) => ({ ...prev, error: message }));
    setLocalError(message);
  }, []);

  const handleEnter = React.useCallback(async () => {
    if (!displayGiveaway) return;
    if (!canEnter) {
      setLocalError('You must be signed in to enter.');
      return;
    }
    if (!canEnterNow) {
      setLocalError('This giveaway is not accepting entries.');
      return;
    }
    if (
      entryCap !== null &&
      parsedTickets + displayGiveaway.currentUserTickets > entryCap
    ) {
      setLocalError(`You can enter up to ${entryCap} tickets.`);
      return;
    }
    try {
      setSubmitting(true);
      setLocalError(null);
      const addedTickets = allowMultiple ? parsedTickets : 1;
      await enterGiveaway({
        id: displayGiveaway._id,
        tickets: addedTickets,
        paypalOrderId: payment.orderId ?? undefined,
        paymentAmount: paymentRequired ? totalPayment : undefined,
      });
      setLocalGiveaway((prev) => {
        const base = prev ?? displayGiveaway;
        if (!base) return prev;
        return {
          ...base,
          totalEntries: (base.totalEntries ?? 0) + addedTickets,
          currentUserTickets: (base.currentUserTickets ?? 0) + addedTickets,
        };
      });
      setSuccessMessage('Entry submitted!');
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      setTickets('1');
      setPayment({ orderId: null, captured: false, error: null });
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Failed to enter giveaway.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    displayGiveaway,
    canEnter,
    canEnterNow,
    entryCap,
    parsedTickets,
    allowMultiple,
    payment,
    paymentRequired,
    totalPayment,
    enterGiveaway,
  ]);

  const handlePaymentPaid = React.useCallback(
    async (orderId: string) => {
      setPayment({ orderId, captured: true, error: null });
      if (!paymentRequired) return;
      await handleEnter();
    },
    [handleEnter, paymentRequired],
  );

  const handleCloseGiveaway = React.useCallback(async () => {
    if (!displayGiveaway) return;
    const confirmed = window.confirm(
      'Close this giveaway and draw winners now?',
    );
    if (!confirmed) return;
    try {
      setSubmitting(true);
      await closeGiveaway({ id: displayGiveaway._id });
      setLocalGiveaway(null);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Failed to close giveaway.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [closeGiveaway, displayGiveaway]);

  const handleReopenGiveaway = React.useCallback(async () => {
    if (!displayGiveaway) return;
    const confirmed = window.confirm(
      'Reopen this giveaway and clear existing winners?',
    );
    if (!confirmed) return;
    try {
      setSubmitting(true);
      await reopenGiveaway({ id: displayGiveaway._id });
      setLocalGiveaway(null);
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Failed to reopen giveaway.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [displayGiveaway, reopenGiveaway]);

  const handleRedrawGiveaway = React.useCallback(async () => {
    if (!displayGiveaway) return;
    const confirmed = window.confirm('Redraw winners for this giveaway?');
    if (!confirmed) return;
    try {
      setSubmitting(true);
      await redrawGiveaway({ id: displayGiveaway._id });
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Failed to redraw winners.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [displayGiveaway, redrawGiveaway]);

  if (!displayGiveaway) {
    return (
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
          <p className='text-sm text-muted-foreground'>Loading giveaway...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6'
        role='dialog'
        aria-modal='true'
        onClick={onClose}
      >
        <div
          className='max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl'
          onClick={(event) => event.stopPropagation()}
        >
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-xs font-medium uppercase tracking-wide text-primary'>
                {formatEventType('giveaway')}
              </p>
              <h2 className='mt-1 text-2xl font-semibold text-foreground'>
                {displayGiveaway.title}
              </h2>
              <p className='mt-2 text-xs text-muted-foreground'>
                {displayGiveaway.status === 'scheduled'
                  ? 'Scheduled for'
                  : 'Published'}{' '}
                {formatDate(displayGiveaway.publishAt)}
              </p>
              {displayGiveaway.updatedAt && displayGiveaway.updatedBy && (
                <p className='mt-1 text-xs text-muted-foreground'>
                  Updated by {formatCreator(displayGiveaway.updatedBy)} on{' '}
                  {formatDate(displayGiveaway.updatedAt)}
                </p>
              )}
            </div>
            <div className='flex items-center gap-2'>
              {isAdmin && (
                <button
                  type='button'
                  onClick={
                    displayGiveaway.giveawayIsClosed
                      ? handleReopenGiveaway
                      : handleCloseGiveaway
                  }
                  className='rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10'
                >
                  {displayGiveaway.giveawayIsClosed
                    ? 'Reopen giveaway'
                    : 'Close giveaway'}
                </button>
              )}
              <button
                type='button'
                onClick={onClose}
                className='rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground'
                aria-label='Close giveaway'
              >
                <X className='h-4 w-4' aria-hidden={true} />
              </button>
            </div>
          </div>

          <div className='mt-4 space-y-4'>
            <p className='whitespace-pre-wrap text-sm leading-relaxed text-foreground'>
              {displayGiveaway.description}
            </p>
            {imageUrls && imageUrls.length > 0 && (
              <div className='grid gap-3 sm:grid-cols-2'>
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
                      alt='Giveaway image'
                      className='h-48 w-full object-cover transition duration-200 group-hover:scale-105'
                    />
                    <span className='sr-only'>View full-size image</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className='mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]'>
            <div className='rounded-xl border border-border/60 bg-card/60 p-4'>
              <div className='flex items-center justify-between gap-3'>
                <h3 className='text-sm font-semibold text-foreground'>Entries</h3>
              </div>
              <div className='mt-3 text-xs text-muted-foreground'>
                {allowMultiple
                  ? `Up to ${entryCap ?? '∞'} tickets per user.`
                  : 'One entry per user.'}
              </div>
              <p className='mt-2 text-xs font-semibold text-foreground'>
                Your Tickets: {displayGiveaway.currentUserTickets ?? 0}
              </p>
              {displayGiveaway.giveawayIsClosed && (
                <p className='mt-2 text-xs text-muted-foreground'>
                  Giveaway closed on{' '}
                  {displayGiveaway.giveawayClosedAt
                    ? formatDate(displayGiveaway.giveawayClosedAt)
                    : '—'}
                  .
                </p>
              )}
            </div>

            <div className='rounded-xl border border-border/60 bg-card/60 p-4'>
              <div className='flex items-center justify-between gap-3'>
                <h3 className='text-sm font-semibold text-foreground'>
                  {displayGiveaway.giveawayWinnersCount === 1
                    ? 'Winner'
                    : 'Winners'}
                </h3>
                {isAdmin && displayGiveaway.giveawayIsClosed && (
                  <button
                    type='button'
                    onClick={handleRedrawGiveaway}
                    disabled={submitting}
                    className='rounded-full border border-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary transition hover:bg-primary/10 disabled:opacity-60'
                  >
                    {submitting ? 'Redrawing...' : 'Redraw'}
                  </button>
                )}
              </div>
              <div className='mt-3 space-y-2 text-sm'>
                {displayGiveaway.winners.length === 0 ? (
                  <p className='text-xs text-muted-foreground'>
                    {displayGiveaway.giveawayIsClosed
                      ? 'No entries were made.'
                      : 'Winners will appear once the giveaway is closed.'}
                  </p>
                ) : (
                  (() => {
                    const createdAtValues = Array.from(
                      new Set(
                        displayGiveaway.winners.map(
                          (winner) => winner.createdAt ?? 0,
                        ),
                      ),
                    ).sort((a, b) => a - b);
                    const latestCreatedAt =
                      createdAtValues[createdAtValues.length - 1] ?? 0;
                    const hasRedraw = createdAtValues.length > 1;
                    const redrawRoundByCreatedAt = new Map<number, number>();
                    createdAtValues.slice(1).forEach((value, index) => {
                      redrawRoundByCreatedAt.set(value, index + 1);
                    });

                    return displayGiveaway.winners.map((winner) => {
                      const createdAt = winner.createdAt ?? 0;
                      const isLatest = createdAt === latestCreatedAt;
                      const redrawRound =
                        redrawRoundByCreatedAt.get(createdAt) ?? 0;
                      const redrawLabel = redrawRound
                        ? redrawRound === 1
                          ? 'Redraw Winner'
                          : `Redraw Winner ${redrawRound}`
                        : hasRedraw
                          ? 'Original Winner'
                          : 'Winner';
                      return (
                        <div
                          key={`${winner.userId}-${winner.drawOrder}-${winner.createdAt}`}
                          className={`flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs text-foreground ${
                            hasRedraw && !isLatest
                              ? 'text-foreground/70'
                              : ''
                          }`}
                        >
                          <span className={isLatest ? 'font-semibold' : ''}>
                            #{winner.drawOrder}{' '}
                            {winner.userName ?? 'Anonymous'}
                          </span>
                          <span className='text-muted-foreground'>
                            {redrawLabel}
                          </span>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>
          </div>

          <div className='mt-6 grid gap-6 lg:grid-cols-[1fr,1fr]'>
            {shouldShowEnterSection && (
              <div className='rounded-xl border border-border/60 bg-card/60 p-4'>
                <h3 className='text-sm font-semibold text-foreground'>
                  Enter giveaway
                </h3>

                <div className='mt-4 grid gap-3 sm:grid-cols-[1fr,auto] sm:items-end'>
                  {allowMultiple ? (
                    <label className='flex flex-col gap-2 text-sm text-foreground'>
                      Tickets
                      <input
                        type='number'
                        min='1'
                        step='1'
                        value={tickets}
                        onChange={(event) => setTickets(event.target.value)}
                        disabled={shouldDisableTickets}
                        className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                      />
                    </label>
                  ) : (
                    <span className='text-xs text-muted-foreground'>
                    </span>
                  )}
                </div>

                <div className='mt-4'>
                  {!canEnter && (
                    <p className='text-xs text-muted-foreground'>
                      Sign in to enter the giveaway.
                    </p>
                  )}
                  {paymentRequired ? (
                    canEnterNow && (
                      <div className='mx-auto w-full max-w-180'>
                        <GiveawayPayPalPanel
                          amount={totalPayment}
                          description={`Giveaway entry: ${displayGiveaway.title}`}
                          referenceId={`giveaway:${displayGiveaway._id}`}
                          onPaid={handlePaymentPaid}
                          onError={handlePaymentError}
                        />
                      </div>
                    )
                  ) : (
                    <button
                      type='button'
                      onClick={handleEnter}
                      disabled={!canEnterNow || submitting}
                      className='rounded-full border border-primary px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-60'
                    >
                      {submitting ? 'Submitting...' : 'Submit entry'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {isAdmin && (
              <details className='group rounded-xl border border-border/60 bg-card/60 p-4'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-foreground'>
                  <span>Entrants</span>
                  <span className='flex items-center gap-2 text-xs text-muted-foreground'>
                    {displayGiveaway.entrants.length} entrant
                    {displayGiveaway.entrants.length === 1 ? '' : 's'}
                    <ChevronDown
                      className='h-4 w-4 transition group-open:rotate-180'
                      aria-hidden={true}
                    />
                  </span>
                </summary>
                <div className='mt-3 max-h-48 space-y-2 overflow-y-auto pr-1 text-xs'>
                  {displayGiveaway.entrants.length === 0 ? (
                    <p className='text-xs text-muted-foreground'>
                      No entrants yet.
                    </p>
                  ) : (
                    displayGiveaway.entrants.map((entrant) => (
                      <div
                        key={entrant.userId}
                        className='flex items-center justify-between border-b border-border/40 pb-2 last:border-b-0 last:pb-0'
                      >
                        <span className='text-foreground'>
                          {entrant.userName ?? entrant.userId}
                        </span>
                        <span className='text-muted-foreground'>
                          {entrant.tickets} ticket
                          {entrant.tickets === 1 ? '' : 's'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </details>
            )}
          </div>

          {payment.error && (
            <div className='mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {payment.error}
            </div>
          )}
          {localError && (
            <div className='mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
              {localError}
            </div>
          )}
          {successMessage && (
            <div className='mt-4 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600'>
              {successMessage}
            </div>
          )}
        </div>
      </div>

      {previewImage && (
        <div
          className='fixed inset-0 z-60 flex items-center justify-center bg-black/80 px-4 py-6'
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
              alt='Full-size giveaway image'
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
