'use client';

import * as React from 'react';
import { ChevronDown, X } from 'lucide-react';
import {
  type PayPalButtonsComponentProps,
  type ReactPayPalScriptOptions,
} from '@paypal/react-paypal-js';
import { api } from '@/lib/api';
import { callApi, useApiMutation, useApiQuery } from '@/lib/apiClient';
import { formatCreator, formatDate, formatEventType } from '@/lib/announcements';
import { PayPalPanel } from '@/components/payments/paypal-panel';
import type {
  FundraiserDetails,
  SubmitFundraiserDonationArgs,
} from '@/server/services/announcements';
import type { FundraiserAnonymityMode, Id, StorageImage } from '@/types/db';

type FundraiserModalProps = {
  fundraiserId: Id<'announcements'>;
  onClose: () => void;
  canDonate: boolean;
  isAdmin: boolean;
};

type PaymentState = {
  orderId: string | null;
  captured: boolean;
  error: string | null;
};

type FundraiserPayPalPanelProps = {
  amount: number;
  description: string;
  referenceId: string;
  onPaid: (orderId: string) => void;
  onError: (message: string) => void;
};

const currency = process.env.NEXT_PUBLIC_PAYPAL_CURRENCY ?? 'USD';
const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency,
});

function FundraiserPayPalPanel({
  amount,
  description,
  referenceId,
  onPaid,
  onError,
}: FundraiserPayPalPanelProps) {
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
    () => currencyFormatter.format(amount),
    [amount],
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

function formatDonationLabel(
  anonymityMode: FundraiserAnonymityMode,
  donation: { isAnonymous: boolean; userName: string | null },
) {
  if (anonymityMode === 'anonymous' || donation.isAnonymous) {
    return 'Anonymous Donation';
  }
  return donation.userName ?? 'Anonymous Donation';
}

export function FundraiserModal({
  fundraiserId,
  onClose,
  canDonate,
  isAdmin,
}: FundraiserModalProps) {
  const fundraiser = useApiQuery<{ id: Id<'announcements'> }, FundraiserDetails>(
    api.announcements.getFundraiser,
    { id: fundraiserId },
    { liveKeys: ['announcements', 'fundraiserDonations'] },
  );
  const imageUrls = useApiQuery<
    { ids: Id<'_storage'>[] },
    StorageImage[]
  >(
    api.storage.getImageUrls,
    fundraiser?.imageIds && fundraiser.imageIds.length
      ? { ids: fundraiser.imageIds }
      : 'skip',
  );
  const submitDonation = useApiMutation<
    SubmitFundraiserDonationArgs,
    { id: Id<'fundraiserDonations'> }
  >(api.announcements.submitFundraiserDonation);

  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [localFundraiser, setLocalFundraiser] =
    React.useState<FundraiserDetails | null>(null);
  const [amount, setAmount] = React.useState('');
  const [donateAnonymously, setDonateAnonymously] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [payment, setPayment] = React.useState<PaymentState>({
    orderId: null,
    captured: false,
    error: null,
  });
  const [animatedProgress, setAnimatedProgress] = React.useState(0);
  const [historySort, setHistorySort] = React.useState<
    'newest' | 'oldest' | 'amount_desc' | 'amount_asc'
  >('newest');
  const optimisticSnapshotRef = React.useRef<FundraiserDetails | null>(null);
  const successTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    setAmount('');
    setDonateAnonymously(false);
    setPayment({ orderId: null, captured: false, error: null });
    setLocalError(null);
    setSuccessMessage(null);
    setLocalFundraiser(null);
    setHistorySort('newest');
    optimisticSnapshotRef.current = null;
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, [fundraiserId]);

  React.useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

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

  React.useEffect(() => {
    if (!fundraiser) return;
    setLocalFundraiser(fundraiser);
  }, [fundraiser]);

  const displayFundraiser = localFundraiser ?? fundraiser ?? null;
  const parsedAmount = React.useMemo(() => {
    const value = parseFloat(amount);
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100) / 100;
  }, [amount]);

  const isPublished = displayFundraiser?.status === 'published';
  const anonymityMode =
    displayFundraiser?.fundraiserAnonymityMode ?? 'user_choice';
  const canDonateNow = Boolean(canDonate && isPublished);
  const canPay = Boolean(parsedAmount && parsedAmount > 0 && canDonateNow);
  const progressPercent = displayFundraiser?.fundraiserGoal
    ? Math.min(
        100,
        Math.max(
          0,
          (displayFundraiser.totalRaised / displayFundraiser.fundraiserGoal) *
            100,
        ),
      )
    : 0;
  React.useEffect(() => {
    if (animatedProgress === progressPercent) return;
    const id = requestAnimationFrame(() => {
      setAnimatedProgress(progressPercent);
    });
    return () => cancelAnimationFrame(id);
  }, [animatedProgress, progressPercent]);
  const goalReached = Boolean(
    displayFundraiser &&
      displayFundraiser.fundraiserGoal > 0 &&
      displayFundraiser.totalRaised >= displayFundraiser.fundraiserGoal,
  );
  const sortedDonations = React.useMemo(() => {
    const donations = displayFundraiser?.donations ?? fundraiser?.donations ?? [];
    const sorted = [...donations];
    switch (historySort) {
      case 'oldest':
        sorted.sort((a, b) => a.createdAt - b.createdAt);
        break;
      case 'amount_desc':
        sorted.sort((a, b) => b.amount - a.amount);
        break;
      case 'amount_asc':
        sorted.sort((a, b) => a.amount - b.amount);
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => b.createdAt - a.createdAt);
        break;
    }
    return sorted;
  }, [displayFundraiser, fundraiser, historySort]);

  const handlePaymentError = React.useCallback((message: string) => {
    setPayment((prev) => ({ ...prev, error: message }));
    setLocalError(message);
  }, []);

  const handlePaymentPaid = React.useCallback(
    async (orderId: string) => {
      setPayment({ orderId, captured: true, error: null });
    if (!fundraiser) {
      setLocalError('Fundraiser is still loading.');
      return;
    }
    if (!canDonate) {
      setLocalError('You must be signed in to donate.');
      return;
    }
    if (!parsedAmount || parsedAmount <= 0) {
      setLocalError('Enter a donation amount.');
      return;
    }
    try {
      setSubmitting(true);
      setLocalError(null);
      const isAnonymous =
        anonymityMode === 'anonymous' ? true : donateAnonymously;
      if (displayFundraiser) {
        optimisticSnapshotRef.current = displayFundraiser;
        const optimisticDonation = {
          id: `temp-${Date.now()}` as Id<'fundraiserDonations'>,
          userName: isAnonymous ? null : 'You',
          isAnonymous,
          amount: parsedAmount,
          createdAt: Date.now(),
        };
        setLocalFundraiser({
          ...displayFundraiser,
          totalRaised: displayFundraiser.totalRaised + parsedAmount,
          donations: [optimisticDonation, ...displayFundraiser.donations],
        });
      }
      await submitDonation({
        id: fundraiser._id,
        amount: parsedAmount,
        paypalOrderId: orderId,
        isAnonymous,
      });
        try {
          const refreshed = await callApi<
            { id: Id<'announcements'> },
            FundraiserDetails
          >(api.announcements.getFundraiser, { id: fundraiser._id });
          setLocalFundraiser(refreshed);
        } catch (refreshError) {
          console.error('Failed to refresh fundraiser data', refreshError);
        }
        setSuccessMessage('Thank you for your donation!');
        if (successTimeoutRef.current) {
          clearTimeout(successTimeoutRef.current);
        }
        successTimeoutRef.current = setTimeout(() => {
          setSuccessMessage(null);
        }, 3000);
        setAmount('');
        setDonateAnonymously(false);
        setPayment({ orderId: null, captured: false, error: null });
        optimisticSnapshotRef.current = null;
      } catch (error) {
        if (optimisticSnapshotRef.current) {
          setLocalFundraiser(optimisticSnapshotRef.current);
          optimisticSnapshotRef.current = null;
        }
        setLocalError(
          error instanceof Error ? error.message : 'Failed to submit donation.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      fundraiser,
      canDonate,
      parsedAmount,
      anonymityMode,
      donateAnonymously,
      submitDonation,
    ],
  );

  if (!fundraiser) {
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
          <p className='text-sm text-muted-foreground'>Loading fundraiser...</p>
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
                {formatEventType('fundraiser')}
              </p>
              <h2 className='mt-1 text-2xl font-semibold text-foreground'>
                {displayFundraiser?.title ?? fundraiser.title}
              </h2>
              <p className='mt-2 text-xs text-muted-foreground'>
                {displayFundraiser?.status === 'scheduled'
                  ? 'Scheduled for'
                  : 'Published'}{' '}
                {formatDate(displayFundraiser?.publishAt ?? fundraiser.publishAt)}
              </p>
              {displayFundraiser?.updatedAt && displayFundraiser.updatedBy && (
                <p className='mt-1 text-xs text-muted-foreground'>
                  Updated by {formatCreator(displayFundraiser.updatedBy)} on{' '}
                  {formatDate(displayFundraiser.updatedAt)}
                </p>
              )}
            </div>
            <button
              type='button'
              onClick={onClose}
              className='rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground'
              aria-label='Close fundraiser'
            >
              <X className='h-4 w-4' aria-hidden={true} />
            </button>
          </div>

          <div className='mt-4 space-y-4'>
            <p className='whitespace-pre-wrap text-sm leading-relaxed text-foreground'>
              {displayFundraiser?.description ?? fundraiser.description}
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
                      alt='Fundraiser image'
                      className='h-48 w-full object-cover transition duration-200 group-hover:scale-105'
                    />
                    <span className='sr-only'>View full-size image</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className='mt-6 grid gap-6 lg:grid-cols-[140px,1fr]'>
            <div className='flex flex-col items-center gap-3'>
              <div className='relative h-64 w-6 overflow-hidden rounded-full bg-muted'>
                <div
                  className='absolute bottom-0 left-0 w-full rounded-full bg-primary transition-[height] duration-700 ease-out'
                  style={{ height: `${animatedProgress}%` }}
                />
              </div>
              <div className='text-center text-xs text-muted-foreground'>
                <p className='font-medium text-foreground'>
                  {currencyFormatter.format(
                    displayFundraiser?.totalRaised ?? fundraiser.totalRaised,
                  )}
                </p>
                <p>
                  raised of{' '}
                  {currencyFormatter.format(
                    displayFundraiser?.fundraiserGoal ??
                      fundraiser.fundraiserGoal,
                  )}
                </p>
                <p>{Math.round(progressPercent)}% of goal</p>
                {goalReached && (
                  <div className='mt-3 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 animate-pulse'>
                    Goal reached!
                  </div>
                )}
              </div>
            </div>

            <div className='space-y-6'>
              <div className='rounded-xl border border-border/60 bg-card/50 p-4'>
                <details className='group'>
                  <summary className='flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-foreground'>
                    <span>Donation history</span>
                    <span className='flex items-center gap-2 text-xs font-normal text-muted-foreground'>
                      {displayFundraiser?.donations.length ??
                        fundraiser.donations.length}{' '}
                      total
                      <ChevronDown className='h-4 w-4 transition-transform group-open:rotate-180' />
                    </span>
                  </summary>
                  <div className='mt-3 flex flex-wrap items-center justify-between gap-2'>
                    <label className='text-[11px] uppercase tracking-wide text-muted-foreground'>
                      Sort by
                    </label>
                    <select
                      value={historySort}
                      onChange={(event) =>
                        setHistorySort(
                          event.target.value as typeof historySort,
                        )
                      }
                      className='rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                    >
                      <option value='newest'>Newest to oldest</option>
                      <option value='oldest'>Oldest to newest</option>
                      <option value='amount_desc'>Most to least</option>
                      <option value='amount_asc'>Least to most</option>
                    </select>
                  </div>
                  <div className='mt-3 max-h-48 space-y-3 overflow-y-auto pr-1'>
                    {(displayFundraiser?.donations.length ??
                      fundraiser.donations.length) === 0 ? (
                      <p className='text-xs text-muted-foreground'>
                        No donations yet. Be the first to contribute!
                      </p>
                    ) : (
                      sortedDonations.map(
                        (donation) => (
                          <div
                            key={donation.id}
                            className='flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-b-0 last:pb-0'
                          >
                            <div>
                              <p className='text-sm font-medium text-foreground'>
                                {formatDonationLabel(anonymityMode, donation)}
                              </p>
                              <p className='text-xs text-muted-foreground'>
                                {formatDate(donation.createdAt)}
                              </p>
                            </div>
                            <span className='text-sm font-semibold text-foreground'>
                              {currencyFormatter.format(donation.amount)}
                            </span>
                          </div>
                        ),
                      )
                    )}
                  </div>
                </details>
              </div>

              <div className='rounded-xl border border-border/60 bg-card/60 p-4'>
                <h3 className='text-sm font-semibold text-foreground'>
                  Make a donation
                </h3>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Donations are processed securely with PayPal.
                </p>

                <div className='mt-4 grid gap-3 sm:grid-cols-[1fr,auto] sm:items-end'>
                  <label className='flex flex-col gap-2 text-sm text-foreground'>
                    Amount
                    <input
                      type='number'
                      min='1'
                      step='0.01'
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      placeholder='25.00'
                      disabled={!canDonateNow || submitting}
                      className='rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60'
                    />
                  </label>
                  {anonymityMode === 'user_choice' && (
                    <label className='flex items-center gap-2 text-xs text-muted-foreground'>
                      <input
                        type='checkbox'
                        checked={donateAnonymously}
                        onChange={(event) =>
                          setDonateAnonymously(event.target.checked)
                        }
                        disabled={!canDonateNow || submitting}
                        className='h-4 w-4 rounded border-border'
                      />
                      Donate anonymously
                    </label>
                  )}
                  {anonymityMode === 'anonymous' && (
                    <p className='text-xs text-muted-foreground sm:col-span-2'>
                      All donations are anonymous for this fundraiser.
                    </p>
                  )}
                </div>

                <div className='mt-4'>
                  {!canDonate && (
                    <p className='text-xs text-muted-foreground'>
                      Sign in to make a donation.
                    </p>
                  )}
                  {canDonate && !isPublished && (
                    <p className='text-xs text-muted-foreground'>
                      Donations open once this fundraiser is published.
                    </p>
                  )}
                  {canPay && (
                    <div className='mx-auto w-full max-w-[720px]'>
                      <FundraiserPayPalPanel
                        amount={parsedAmount ?? 0}
                        description={`Fundraiser donation: ${fundraiser.title}`}
                        referenceId={`fundraiser:${fundraiser._id}`}
                        onPaid={handlePaymentPaid}
                        onError={handlePaymentError}
                      />
                    </div>
                  )}
                </div>
              </div>

              {payment.error && (
                <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                  {payment.error}
                </div>
              )}
              {localError && (
                <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                  {localError}
                </div>
              )}
              {successMessage && (
                <div className='rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600'>
                  {successMessage}
                </div>
              )}

              {isAdmin && displayFundraiser?.status === 'archived' && (
                <p className='text-xs text-muted-foreground'>
                  This fundraiser is archived and read-only.
                </p>
              )}
            </div>
          </div>
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
              alt='Full-size fundraiser image'
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
