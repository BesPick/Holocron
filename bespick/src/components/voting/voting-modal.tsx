'use client';

import * as React from 'react';
import {
  PayPalButtons,
  PayPalScriptProvider,
  usePayPalScriptReducer,
  type PayPalButtonsComponentProps,
  type ReactPayPalScriptOptions,
} from '@paypal/react-paypal-js';
import { X, Search, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/apiClient';
import type { PurchaseVotesArgs } from '@/server/services/announcements';
import type { Doc, Id, VotingParticipant } from '@/types/db';
import { formatDate, formatEventType } from '@/lib/announcements';
import {
  buildLeaderboardSections,
  getGroupLabel,
  LeaderboardPanel,
  type LeaderboardMode,
  type LeaderboardParticipant,
} from './voting-leaderboard';

type Announcement = Doc<'announcements'>;

type VotingModalProps = {
  event: Announcement;
  onClose: () => void;
};

type VoteSelection = {
  add: number;
  remove: number;
};

type VoteAdjustmentPayload = {
  userId: string;
  add: number;
  remove: number;
};

type FundingButtonConfig = {
  id: string;
  fundingSource: NonNullable<PayPalButtonsComponentProps['fundingSource']>;
  helper?: string;
};

type PayPalNamespace = {
  Buttons?: (
    options: { fundingSource?: unknown },
  ) => { isEligible?: () => boolean } | null;
  FUNDING?: Record<string, unknown>;
};

const PAYMENT_METHOD_BUTTONS: FundingButtonConfig[] = [
  {
    id: 'paypal',
    fundingSource: 'paypal',
  },
  {
    id: 'venmo',
    fundingSource: 'venmo',
    helper: 'Shows on US mobile browsers when paying in USD.',
  },
  {
    id: 'card',
    fundingSource: 'card',
  },
];

const FUNDING_STYLE_OVERRIDES: Partial<
  Record<
    FundingButtonConfig['fundingSource'],
    NonNullable<PayPalButtonsComponentProps['style']>
  >
> = {
  venmo: {
    color: 'blue',
  },
  card: {
    label: 'pay',
    color: 'black',
  },
};

const createCurrencyFormatter = (currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

const getEligibleFundingSources = (buttons: FundingButtonConfig[]) => {
  const paypal = (window as typeof window & { paypal?: PayPalNamespace }).paypal;
  if (!paypal?.Buttons) return null;
  const eligible = new Set<FundingButtonConfig['fundingSource']>();
  for (const { fundingSource } of buttons) {
    const source =
      paypal.FUNDING?.[String(fundingSource).toUpperCase()] ?? fundingSource;
    try {
      const instance = paypal.Buttons({ fundingSource: source });
      if (instance?.isEligible?.()) {
        eligible.add(fundingSource);
      }
    } catch {
      // Ignore eligibility failures and fall back to default rendering.
    }
  }
  return eligible;
};

export function VotingModal({ event, onClose }: VotingModalProps) {
  const liveEvent = useApiQuery<
    { id: Id<'announcements'> },
    Announcement | null
  >(
    api.announcements.get,
    { id: event._id },
    { liveKeys: ['announcements', 'voting'] },
  );
  const currentEvent = liveEvent ?? event;
  const eventId = currentEvent._id;
  const eventDescription = currentEvent.description;
  const allowRemovals = currentEvent.votingAllowRemovals ?? true;
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const paypalCurrency =
    process.env.NEXT_PUBLIC_PAYPAL_CURRENCY?.toUpperCase() ?? 'USD';
  const paypalBuyerCountry =
    process.env.NEXT_PUBLIC_PAYPAL_BUYER_COUNTRY?.toUpperCase() ?? undefined;
  const enableVenmo = paypalCurrency === 'USD';
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const updateMobile = () => setIsMobile(window.innerWidth < 768);
    updateMobile();
    window.addEventListener('resize', updateMobile);
    return () => window.removeEventListener('resize', updateMobile);
  }, []);
  const allowVenmo = enableVenmo && isMobile;
  const enabledFunding = React.useMemo(() => {
    const sources = ['card'];
    if (allowVenmo) sources.unshift('venmo');
    return sources.join(',');
  }, [allowVenmo]);
  const paymentButtons = React.useMemo(
    () =>
      PAYMENT_METHOD_BUTTONS.filter((button) =>
        button.fundingSource === 'venmo' ? allowVenmo : true,
      ),
    [allowVenmo],
  );

  const normalizeParticipants = React.useCallback(() => {
    return (currentEvent.votingParticipants ?? []).map((participant) => ({
      ...participant,
      votes:
        typeof participant.votes === 'number' &&
        Number.isFinite(participant.votes)
          ? Math.max(0, participant.votes)
          : 0,
    }));
  }, [currentEvent.votingParticipants]);

  const [participants, setParticipants] = React.useState(normalizeParticipants);
  const addPrice = Math.max(0, currentEvent.votingAddVotePrice ?? 0);
  const removePrice = allowRemovals
    ? Math.max(0, currentEvent.votingRemoveVotePrice ?? 0)
    : 0;
  const addVoteLimit =
    typeof currentEvent.votingAddVoteLimit === 'number'
      ? Math.max(0, Math.floor(currentEvent.votingAddVoteLimit))
      : null;
  const removeVoteLimit =
    typeof currentEvent.votingRemoveVoteLimit === 'number'
      ? Math.max(0, Math.floor(currentEvent.votingRemoveVoteLimit))
      : null;
  const [selections, setSelections] = React.useState<Record<string, VoteSelection>>({});
  const [search, setSearch] = React.useState('');
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [statusState, setStatusState] = React.useState<'success' | 'cancelled' | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [transactionId, setTransactionId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const clearCheckoutFeedback = React.useCallback(() => {
    setStatusMessage(null);
    setStatusState(null);
    setErrorMessage(null);
  }, []);
  const showErrorMessage = React.useCallback((message: string) => {
    setStatusMessage(null);
    setStatusState(null);
    setErrorMessage(message);
  }, []);
  const purchaseVotes = useApiMutation<
    PurchaseVotesArgs,
    {
      success: boolean;
      participants?: VotingParticipant[];
      message?: string;
    }
  >(api.announcements.purchaseVotes);
  const adjustmentsRef = React.useRef<VoteAdjustmentPayload[]>([]);
  React.useEffect(() => {
    if (liveEvent === null) {
      onClose();
    }
  }, [liveEvent, onClose]);
  const leaderboardMode: LeaderboardMode =
    currentEvent.votingLeaderboardMode === 'group' ||
    currentEvent.votingLeaderboardMode === 'group_portfolio'
      ? currentEvent.votingLeaderboardMode
      : 'all';

  const leaderboardParticipants = React.useMemo<LeaderboardParticipant[]>(() => {
    return participants
      .map((participant) => {
        const groupValue =
          typeof participant.group === 'string' && participant.group.trim().length > 0
            ? participant.group
            : null;
        const portfolioValue =
          typeof participant.portfolio === 'string' &&
          participant.portfolio.trim().length > 0
            ? participant.portfolio
            : null;
        const votes =
          typeof participant.votes === 'number' && Number.isFinite(participant.votes)
            ? Math.max(0, participant.votes)
            : 0;
        return {
          userId: participant.userId,
          name: getParticipantName(participant),
          votes,
          group: groupValue,
          groupLabel: getGroupLabel(groupValue),
          portfolio: portfolioValue,
          portfolioLabel: portfolioValue ?? null,
        };
      })
      .filter((participant) => participant.votes > 0);
  }, [participants]);

  const leaderboardSections = React.useMemo(
    () => buildLeaderboardSections(leaderboardParticipants, leaderboardMode),
    [leaderboardParticipants, leaderboardMode],
  );
  const [activeLeaderboardId, setActiveLeaderboardId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (leaderboardSections.length === 0) {
      setActiveLeaderboardId(null);
      return;
    }
    setActiveLeaderboardId((prev) => {
      if (prev && leaderboardSections.some((section) => section.id === prev)) {
        return prev;
      }
      return leaderboardSections[0]?.id ?? null;
    });
  }, [leaderboardSections]);

  const activeLeaderboardSection = React.useMemo(() => {
    if (!activeLeaderboardId) return leaderboardSections[0] ?? null;
    return leaderboardSections.find((section) => section.id === activeLeaderboardId) ?? null;
  }, [leaderboardSections, activeLeaderboardId]);

  React.useEffect(() => {
    setParticipants(normalizeParticipants());
    setSelections({});
    setSearch('');
    clearCheckoutFeedback();
  }, [normalizeParticipants, clearCheckoutFeedback]);

  React.useEffect(() => {
    if (allowRemovals) return;
    setSelections((prev) => {
      let changed = false;
      const next: typeof prev = {};
      for (const [userId, selection] of Object.entries(prev)) {
        if (selection.add === 0) {
          if (selection.remove !== 0) {
            changed = true;
          }
          continue;
        }
        if (selection.remove !== 0) {
          changed = true;
        }
        next[userId] = { ...selection, remove: 0 };
      }
      return changed ? next : prev;
    });
  }, [allowRemovals]);

  const setSelectionValue = React.useCallback(
    (
      userId: string,
      type: 'add' | 'remove',
      value: number,
      maxValue?: number,
    ) => {
      if (type === 'remove' && !allowRemovals) {
        return;
      }
      if (!userId || Number.isNaN(value)) return;
      const nextValue = Math.max(
        0,
        Math.floor(Number.isFinite(value) ? value : 0),
      );
      const clampedValue =
        typeof maxValue === 'number' ? Math.min(nextValue, maxValue) : nextValue;
      setSelections((prev) => {
        const current = prev[userId] ?? { add: 0, remove: 0 };
        if (current[type] === clampedValue) return prev;
        const updated = { ...current, [type]: clampedValue };
        const next = { ...prev };
        if (updated.add === 0 && updated.remove === 0) {
          delete next[userId];
        } else {
          next[userId] = updated;
        }
        return next;
      });
    },
    [allowRemovals],
  );

  React.useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const totals = React.useMemo(() => {
    const sums = Object.values(selections).reduce(
      (acc, entry) => {
        acc.add += entry.add;
        acc.remove += allowRemovals ? entry.remove : 0;
        return acc;
      },
      { add: 0, remove: 0 },
    );
    const addCost = sums.add * addPrice;
    const removeCost = sums.remove * removePrice;
    const totalPrice = addCost + removeCost;
    return { ...sums, addCost, removeCost, totalPrice };
  }, [selections, addPrice, removePrice, allowRemovals]);

  const buildAdjustments = React.useCallback((): VoteAdjustmentPayload[] => {
    return Object.entries(selections)
      .map(([userId, selection]) => ({
        userId,
        add: selection.add,
        remove: allowRemovals ? selection.remove : 0,
      }))
      .filter((entry) => entry.add > 0 || entry.remove > 0);
  }, [selections, allowRemovals]);

  const limitError = React.useMemo(() => {
    if (typeof addVoteLimit === 'number' && totals.add > addVoteLimit) {
      return `Add vote limit is ${addVoteLimit} per user.`;
    }
    if (
      allowRemovals &&
      typeof removeVoteLimit === 'number' &&
      totals.remove > removeVoteLimit
    ) {
      return `Remove vote limit is ${removeVoteLimit} per user.`;
    }
    return null;
  }, [addVoteLimit, removeVoteLimit, totals.add, totals.remove, allowRemovals]);

  const limitSummary = React.useMemo(() => {
    const parts: string[] = [];
    if (typeof addVoteLimit === 'number') {
      parts.push(`Add up to ${addVoteLimit}`);
    }
    if (allowRemovals && typeof removeVoteLimit === 'number') {
      parts.push(`Remove up to ${removeVoteLimit}`);
    }
    return parts.length ? `Per-user limits: ${parts.join(', ')}.` : null;
  }, [addVoteLimit, removeVoteLimit, allowRemovals]);

  const hasCart = totals.add + (allowRemovals ? totals.remove : 0) > 0;
  const totalAmount = totals.totalPrice > 0 ? totals.totalPrice.toFixed(2) : '0.00';
  const amountFormatter = React.useMemo(
    () => createCurrencyFormatter(paypalCurrency),
    [paypalCurrency],
  );
  const amountLabel = React.useMemo(() => {
    if (!hasCart) return null;
    const parsed = Number.parseFloat(totalAmount);
    if (!Number.isFinite(parsed)) return null;
    return amountFormatter.format(parsed);
  }, [amountFormatter, hasCart, totalAmount]);
  const requiresPayment = totals.totalPrice > 0;
  const paypalOptions = React.useMemo<ReactPayPalScriptOptions>(
    () => ({
      clientId: paypalClientId ?? '',
      currency: paypalCurrency,
      intent: 'capture',
      enableFunding: enabledFunding,
      components: 'buttons',
      ...(paypalBuyerCountry ? { buyerCountry: paypalBuyerCountry } : {}),
    }),
    [enabledFunding, paypalBuyerCountry, paypalClientId, paypalCurrency],
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredParticipants = React.useMemo(() => {
    if (!normalizedSearch) return participants;
    return participants.filter((participant) => {
      const fullName = getParticipantName(participant, false).toLowerCase();
      return fullName.includes(normalizedSearch);
    });
  }, [participants, normalizedSearch]);

  const applyAdjustmentsLocal = React.useCallback(
    (current: Announcement['votingParticipants'] | undefined, adjustments: VoteAdjustmentPayload[]) => {
      const list = (current ?? []).map((participant) => ({
        ...participant,
        votes:
          typeof participant.votes === 'number' && Number.isFinite(participant.votes)
            ? Math.max(0, Math.floor(participant.votes))
            : 0,
      }));
      const map = new Map(list.map((participant) => [participant.userId, { ...participant }]));
      let changed = false;
      for (const adjustment of adjustments) {
        const participant = map.get(adjustment.userId);
        if (!participant) {
          throw new Error('Participant not found.');
        }
        const add = Math.max(0, Math.floor(adjustment.add));
        const remove = allowRemovals
          ? Math.max(0, Math.floor(adjustment.remove))
          : 0;
        if (!allowRemovals && adjustment.remove > 0) {
          throw new Error('Removing votes is disabled for this event.');
        }
        if (add === 0 && remove === 0) continue;
        if (remove > participant.votes) {
          throw new Error(
            `${participant.firstName ?? 'Participant'} does not have enough votes to remove.`,
          );
        }
        const nextVotes = Math.max(0, participant.votes + add - remove);
        if (nextVotes !== participant.votes) {
          map.set(participant.userId, { ...participant, votes: nextVotes });
          changed = true;
        }
      }
      return { participants: Array.from(map.values()), changed };
    },
    [allowRemovals],
  );

  const applyVoteAdjustments = React.useCallback(
    async (
      adjustments: VoteAdjustmentPayload[],
    ): Promise<{ success: boolean; message?: string }> => {
      if (!adjustments.length) {
        return { success: false, message: 'Select at least one vote change.' };
      }
      const previousParticipants = participants;
      try {
        const optimistic = applyAdjustmentsLocal(previousParticipants, adjustments);
        if (!optimistic.changed) {
          return { success: false, message: 'No changes to submit.' };
        }
        setParticipants(optimistic.participants);

        const result = await purchaseVotes({
          id: eventId,
          adjustments,
        });
        if (result.success && Array.isArray(result.participants)) {
          setParticipants(
            result.participants.map((participant) => ({
              ...participant,
              votes:
                typeof participant.votes === 'number' &&
                Number.isFinite(participant.votes)
                  ? Math.max(0, participant.votes)
                  : 0,
            })),
          );
          setSelections({});
          return { success: true };
        }
        setParticipants(previousParticipants);
        return { success: false, message: result.message ?? 'No changes to submit.' };
      } catch (error) {
        setParticipants(previousParticipants);
        const message =
          error instanceof Error ? error.message : 'Failed to submit votes.';
        return { success: false, message };
      }
    },
    [applyAdjustmentsLocal, purchaseVotes, eventId, participants],
  );

  const paypalButtonsProps = React.useMemo<PayPalButtonsComponentProps>(() => {
    return {
      style: {
        background: 'transparent',
        shape: 'sharp',
        label: 'pay',
        layout: 'vertical',
        height: 48,
      },
      disabled:
        !hasCart ||
        !paypalClientId ||
        Number.parseFloat(totalAmount) <= 0 ||
        Boolean(limitError),
      forceReRender: [
        paypalClientId ?? '',
        paypalCurrency,
        enabledFunding,
        hasCart ? 'cart' : 'empty',
        totalAmount,
      ],
      createOrder: async () => {
        const adjustments = buildAdjustments();
        if (!adjustments.length) {
          showErrorMessage('Select at least one vote change before checking out.');
          throw new Error('No adjustments to purchase.');
        }
        if (limitError) {
          showErrorMessage(limitError);
          throw new Error(limitError);
        }
        adjustmentsRef.current = adjustments;
        clearCheckoutFeedback();
        setTransactionId(null);
        const response = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: totalAmount,
            currency: paypalCurrency,
            description: `${currentEvent.title} vote purchase`,
            referenceId: eventId,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload || typeof payload !== 'object') {
          const message =
            (payload as { error?: string }).error ??
            'Unable to start PayPal checkout.';
          showErrorMessage(message);
          throw new Error(message);
        }
        const orderId = (payload as { id?: string }).id;
        if (!orderId) {
          showErrorMessage('PayPal did not return an order reference.');
          throw new Error('Missing PayPal order id');
        }
        return orderId;
      },
      onApprove: async (data) => {
        if (!data.orderID) {
          showErrorMessage('Missing PayPal order reference.');
          return;
        }
        try {
          const response = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ orderId: data.orderID }),
          });
          const capturePayload = await response.json().catch(() => ({}));
          if (!response.ok) {
            const message =
              (capturePayload as { error?: string }).error ??
              'Unable to capture PayPal payment.';
            showErrorMessage(message);
            return;
          }
          const captureId =
            capturePayload?.purchase_units?.[0]?.payments?.captures?.[0]?.id ??
            capturePayload?.id ??
            data.orderID;
          const adjustments = adjustmentsRef.current;
          if (!adjustments.length) {
            showErrorMessage('Vote selections expired, please try again.');
            return;
          }
          const voteResult = await applyVoteAdjustments(adjustments);
          if (!voteResult.success) {
            showErrorMessage(
              voteResult.message ??
                'Payment captured but votes could not be updated.',
            );
            return;
          }
          setErrorMessage(null);
          setStatusMessage(
            captureId
              ? `Payment captured successfully. Votes updated.`
              : 'Payment captured successfully. Votes updated.',
          );
          setStatusState('success');
          setTransactionId(captureId ?? null);
        } catch (error) {
          console.error('PayPal capture error', error);
          showErrorMessage(
            'Something went wrong while finalizing the payment. Please try again.',
          );
        } finally {
          adjustmentsRef.current = [];
        }
      },
      onCancel: () => {
        setStatusMessage('Checkout cancelled. Your selections are still editable.');
        setStatusState('cancelled');
        setErrorMessage(null);
        adjustmentsRef.current = [];
      },
      onError: (err) => {
        console.error('PayPal checkout error', err);
        showErrorMessage('PayPal checkout failed. Please try again.');
        adjustmentsRef.current = [];
      },
    };
  }, [
    hasCart,
    paypalClientId,
    paypalCurrency,
    enabledFunding,
    totalAmount,
    buildAdjustments,
    currentEvent.title,
    eventId,
    applyVoteAdjustments,
    showErrorMessage,
    clearCheckoutFeedback,
    limitError,
  ]);

  const handleFreeSubmit = React.useCallback(async () => {
    const adjustments = buildAdjustments();
    if (!adjustments.length) {
      showErrorMessage('Select at least one vote change before submitting.');
      return;
    }
    if (limitError) {
      showErrorMessage(limitError);
      return;
    }
    clearCheckoutFeedback();
    setTransactionId(null);
    setIsSubmitting(true);
    try {
      const result = await applyVoteAdjustments(adjustments);
      if (!result.success) {
        showErrorMessage(result.message ?? 'Unable to submit votes.');
      } else {
        setErrorMessage(null);
        setStatusMessage('Votes updated successfully.');
        setStatusState('success');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [
    buildAdjustments,
    applyVoteAdjustments,
    limitError,
    showErrorMessage,
    clearCheckoutFeedback,
  ]);

  const checkoutFeedbackVariant = React.useMemo(() => {
    if (errorMessage) {
      return 'error' as const;
    }
    return statusState;
  }, [errorMessage, statusState]);

  const checkoutFeedbackMessage = errorMessage ?? statusMessage;

  const checkoutFeedbackClass = React.useMemo(() => {
    switch (checkoutFeedbackVariant) {
      case 'success':
        return 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200';
      case 'cancelled':
        return 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-100';
      case 'error':
        return 'border-destructive/60 bg-destructive/10 text-destructive';
      default:
        return 'border-border/60 bg-card/60 text-muted-foreground';
    }
  }, [checkoutFeedbackVariant]);

  return (
    <div className='fixed inset-0 z-50 overflow-y-auto bg-black/60 px-3 py-4 sm:px-4 sm:py-6'>
      <div className='mx-auto flex min-h-full items-start justify-center sm:items-center'>
        <div className='w-full max-w-6xl rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-6 lg:max-h-[95vh] lg:overflow-hidden'>
          <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]'>
            <div className='min-w-0 lg:col-start-2 lg:row-start-1'>
              <div className='flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4'>
                <div>
                  <p className='text-xs font-semibold uppercase tracking-wide text-primary'>
                    {formatEventType(currentEvent.eventType)}
                  </p>
                  <h2 className='mt-1 text-2xl font-semibold text-foreground'>
                    {currentEvent.title}
                  </h2>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    Published {formatDate(currentEvent.publishAt)}
                  </p>
                </div>
                <div className='flex justify-end sm:justify-start'>
                  <button
                    type='button'
                    onClick={onClose}
                    className='rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground'
                    aria-label='Close voting modal'
                  >
                    <X className='h-4 w-4' />
                  </button>
                </div>
              </div>

              {eventDescription && (
                <p className='mt-4 text-sm leading-relaxed text-foreground'>
                  {eventDescription}
                </p>
              )}
            </div>

            <div className='min-w-0 lg:col-start-1 lg:row-start-1 lg:row-span-2'>
              <LeaderboardPanel
                sections={leaderboardSections}
                participantsCount={leaderboardParticipants.length}
                mode={leaderboardMode}
                activeSection={activeLeaderboardSection}
                onSelectSection={setActiveLeaderboardId}
              />
            </div>

            <div className='min-w-0 lg:col-start-2 lg:row-start-2'>
              <div className='flex min-w-0 flex-col gap-6 lg:max-h-[80vh] lg:overflow-y-auto lg:pr-2'>
                <div className='rounded-xl border border-border bg-background/60 p-4'>
                  <div className='flex flex-wrap items-center gap-4 text-sm text-muted-foreground'>
                    <span>
                      Add vote price:{' '}
                      <span className='font-semibold text-foreground'>
                        ${addPrice.toFixed(2)}
                      </span>
                    </span>
                    {allowRemovals && (
                      <span>
                        Remove vote price:{' '}
                        <span className='font-semibold text-foreground'>
                          ${removePrice.toFixed(2)}
                        </span>
                      </span>
                    )}
                  </div>
                  <p className='mt-2 text-xs text-muted-foreground'>
                    Enter how many votes to add{allowRemovals ? ' or remove' : ''}, then submit your purchase to update totals.
                  </p>
                  {limitSummary && (
                    <p className='mt-2 text-xs text-muted-foreground'>
                      {limitSummary}
                    </p>
                  )}
                </div>

                <div className='flex flex-col gap-3'>
                  <div className='relative'>
                    <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground' />
                    <input
                      type='search'
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder='Search participants by name...'
                      className='w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                    />
                  </div>

                  <div className='max-h-[50vh] overflow-y-auto rounded-xl border border-dashed border-border [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:max-h-[40vh]'>
                    {participants.length === 0 ? (
                      <p className='p-6 text-sm text-muted-foreground'>
                        No participants available for this event.
                      </p>
                    ) : filteredParticipants.length === 0 ? (
                      <p className='p-6 text-sm text-muted-foreground'>
                        No participants match your search.
                      </p>
                    ) : (
                      <ul>
                        {filteredParticipants.map((participant) => {
                          const userId = participant.userId;
                          const addCount = selections[userId]?.add ?? 0;
                          const removeCount = selections[userId]?.remove ?? 0;
                          const currentVotes = Math.max(0, participant.votes ?? 0);
                          const remainingAddLimit =
                            typeof addVoteLimit === 'number'
                              ? Math.max(0, addVoteLimit - (totals.add - addCount))
                              : null;
                          const remainingRemoveLimit =
                            allowRemovals && typeof removeVoteLimit === 'number'
                              ? Math.max(
                                  0,
                                  removeVoteLimit - (totals.remove - removeCount),
                                )
                              : null;
                          const addMax =
                            typeof remainingAddLimit === 'number'
                              ? remainingAddLimit
                              : undefined;
                          const removeMax =
                            typeof remainingRemoveLimit === 'number'
                              ? Math.min(currentVotes, remainingRemoveLimit)
                              : currentVotes;
                          const fullName = getParticipantName(participant);
                          return (
                            <li
                              key={userId}
                              className='flex flex-col gap-4 border-b border-border/60 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between'
                            >
                              <div className='space-y-1'>
                                <p className='font-medium text-foreground'>{fullName}</p>
                                <p className='text-xs text-muted-foreground'>
                                  Current votes: {currentVotes}
                                </p>
                              </div>
                              <div className='flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end'>
                                {allowRemovals && (
                                  <VoteAdjuster
                                    label='Remove'
                                    count={removeCount}
                                    price={removePrice}
                                    onSetCount={(value) =>
                                      setSelectionValue(userId, 'remove', value, removeMax)
                                    }
                                    max={removeMax}
                                  />
                                )}
                                <VoteAdjuster
                                  label='Add'
                                  count={addCount}
                                  price={addPrice}
                                  onSetCount={(value) =>
                                    setSelectionValue(userId, 'add', value, addMax)
                                  }
                                  max={addMax}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>

                <div className='space-y-3 rounded-xl border border-border bg-background/70 p-4'>
                  <SummaryRow label={`Add votes (${totals.add})`} value={totals.addCost} />
                  {allowRemovals && (
                    <SummaryRow label={`Remove votes (${totals.remove})`} value={totals.removeCost} />
                  )}
                  <div className='flex items-center justify-between border-t border-border pt-3 text-lg font-semibold text-foreground'>
                    <span>Total price</span>
                    <span>${totals.totalPrice.toFixed(2)}</span>
                  </div>
                </div>

                <div className='rounded-2xl border border-border bg-background/80 p-5 shadow-inner'>
                  {requiresPayment ? (
                    !paypalClientId ? (
                      <div className='flex flex-col items-center gap-3 text-center text-sm text-muted-foreground'>
                        <ShieldAlert className='h-6 w-6 text-destructive' />
                        <p>
                          PayPal is not configured. Set{' '}
                          <code className='rounded bg-muted px-1 py-0.5 text-[0.8em]'>
                            NEXT_PUBLIC_PAYPAL_CLIENT_ID
                          </code>{' '}
                          and related env vars to enable checkout.
                        </p>
                      </div>
                    ) : (
                      <PayPalScriptProvider deferLoading={false} options={paypalOptions}>
                        <VotingPayPalPanel
                          amountLabel={amountLabel}
                          paymentButtons={paymentButtons}
                          paypalButtonsProps={paypalButtonsProps}
                          checkoutFeedbackMessage={checkoutFeedbackMessage}
                          checkoutFeedbackClass={checkoutFeedbackClass}
                          checkoutFeedbackVariant={checkoutFeedbackVariant}
                          transactionId={transactionId}
                        />
                      </PayPalScriptProvider>
                    )
                  ) : (
                    <VotingFreePanel
                      hasCart={hasCart}
                      isSubmitting={isSubmitting}
                      limitError={limitError}
                      onSubmit={handleFreeSubmit}
                      checkoutFeedbackMessage={checkoutFeedbackMessage}
                      checkoutFeedbackClass={checkoutFeedbackClass}
                      checkoutFeedbackVariant={checkoutFeedbackVariant}
                      transactionId={transactionId}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type SummaryRowProps = {
  label: string;
  value: number;
};

function SummaryRow({ label, value }: SummaryRowProps) {
  return (
    <div className='flex items-center justify-between text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='font-medium text-foreground'>${value.toFixed(2)}</span>
    </div>
  );
}

type VoteAdjusterProps = {
  label: 'Add' | 'Remove';
  count: number;
  price: number;
  onSetCount: (value: number) => void;
  max?: number;
};

function VoteAdjuster({
  label,
  count,
  price,
  onSetCount,
  max,
}: VoteAdjusterProps) {
  const handleManualChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = event.target.value;
      if (!rawValue || rawValue.trim().length === 0) {
        onSetCount(0);
        return;
      }
      const next = Number(rawValue);
      if (Number.isNaN(next)) {
        onSetCount(0);
        return;
      }
      onSetCount(next);
    },
    [onSetCount],
  );

  return (
    <div className='flex w-full flex-col items-center gap-1 rounded-lg border border-border px-3 py-3 text-sm text-foreground sm:w-auto sm:py-2'>
      <span className='text-xs text-muted-foreground text-center w-full'>{label} votes</span>
      <input
        type='number'
        min={0}
        max={typeof max === 'number' ? max : undefined}
        inputMode='numeric'
        value={Number.isFinite(count) && count !== 0 ? count : ''}
        onChange={handleManualChange}
        className='h-10 w-full rounded border border-border bg-background px-2 text-center text-sm font-semibold text-foreground appearance-none [-moz-appearance:textfield] focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:h-8 sm:w-20'
        aria-label={`${label} vote quantity`}
      />
      <span className='text-[11px] text-muted-foreground text-center'>
        ${price.toFixed(2)} each
      </span>
    </div>
  );
}

type VotingFreePanelProps = {
  hasCart: boolean;
  isSubmitting: boolean;
  limitError: string | null;
  onSubmit: () => void;
  checkoutFeedbackMessage: string | null;
  checkoutFeedbackClass: string;
  checkoutFeedbackVariant: 'success' | 'cancelled' | 'error' | null;
  transactionId: string | null;
};

type VotingPayPalPanelProps = {
  amountLabel: string | null;
  paymentButtons: FundingButtonConfig[];
  paypalButtonsProps: PayPalButtonsComponentProps;
  checkoutFeedbackMessage: string | null;
  checkoutFeedbackClass: string;
  checkoutFeedbackVariant: 'success' | 'cancelled' | 'error' | null;
  transactionId: string | null;
};

function VotingFreePanel({
  hasCart,
  isSubmitting,
  limitError,
  onSubmit,
  checkoutFeedbackMessage,
  checkoutFeedbackClass,
  checkoutFeedbackVariant,
  transactionId,
}: VotingFreePanelProps) {
  const disabled = !hasCart || Boolean(limitError) || isSubmitting;
  return (
    <div className='space-y-4'>
      <div>
        <p className='text-sm font-medium text-muted-foreground'>Amount due</p>
        <div className='mt-1 text-3xl font-semibold'>$0.00</div>
      </div>
      <div className='space-y-2 rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground'>
        <div className='flex items-start gap-2'>
          <CheckCircle2 className='h-4 w-4 shrink-0 text-primary' />
          <p>No payment is required for these selections.</p>
        </div>
        <div className='flex items-start gap-2'>
          <Info className='h-4 w-4 shrink-0 text-primary' />
          <p>Submit your selections to update the vote totals.</p>
        </div>
      </div>
      <div className='space-y-3'>
        <button
          type='button'
          disabled={disabled}
          onClick={onSubmit}
          className='inline-flex w-full items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
        >
          {isSubmitting ? 'Submitting...' : 'Submit votes'}
        </button>
        {!hasCart && (
          <p className='text-xs text-muted-foreground'>
            Select votes to enable submission.
          </p>
        )}
        {limitError && (
          <p className='text-xs text-destructive'>{limitError}</p>
        )}
      </div>
      {checkoutFeedbackMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${checkoutFeedbackClass}`}>
          {checkoutFeedbackMessage}
          {transactionId && checkoutFeedbackVariant === 'success' && (
            <p className='mt-2 text-xs font-mono'>Reference: {transactionId}</p>
          )}
        </div>
      )}
    </div>
  );
}

function VotingPayPalPanel({
  amountLabel,
  paymentButtons,
  paypalButtonsProps,
  checkoutFeedbackMessage,
  checkoutFeedbackClass,
  checkoutFeedbackVariant,
  transactionId,
}: VotingPayPalPanelProps) {
  const [{ isPending, isRejected, isResolved }] = usePayPalScriptReducer();
  const showButtons = isResolved && !isRejected;
  const [eligibleFunding, setEligibleFunding] = React.useState<
    Set<FundingButtonConfig['fundingSource']> | null
  >(null);

  React.useEffect(() => {
    if (!showButtons) {
      setEligibleFunding(null);
      return;
    }
    setEligibleFunding(getEligibleFundingSources(paymentButtons));
  }, [paymentButtons, showButtons]);

  const visibleButtons = React.useMemo(() => {
    if (!showButtons) return [];
    if (!eligibleFunding) {
      return paymentButtons.filter((button) => button.fundingSource !== 'venmo');
    }
    const filtered = paymentButtons.filter((button) =>
      eligibleFunding.has(button.fundingSource),
    );
    return filtered.length
      ? filtered
      : paymentButtons.filter((button) => button.fundingSource !== 'venmo');
  }, [eligibleFunding, paymentButtons, showButtons]);

  return (
    <div className='space-y-4'>
      <div>
        <p className='text-sm font-medium text-muted-foreground'>Amount due</p>
        <div className='mt-1 text-3xl font-semibold'>{amountLabel ?? '--'}</div>
      </div>
      <div className='space-y-2 rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground'>
        <div className='flex items-start gap-2'>
          <Info className='h-4 w-4 shrink-0 text-primary' />
          <p>
            Your contribution helps the morale team fund upcoming
            events, supplies, and recognition moments.
          </p>
        </div>
        <div className='flex items-start gap-2'>
          <CheckCircle2 className='h-4 w-4 shrink-0 text-primary' />
          <p>
            PayPal sends you a receipt immediately after we capture the payment.
          </p>
        </div>
      </div>
      <div className='space-y-5'>
        {isRejected && (
          <div className='rounded-xl border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
            PayPal failed to load. Disable blockers and confirm your
            client ID is valid.
          </div>
        )}
        {isPending && !isRejected && (
          <p className='text-xs text-muted-foreground'>
            Loading PayPal checkout...
          </p>
        )}
        {showButtons &&
          visibleButtons.map(({ id, fundingSource, helper }) => (
            <div key={id} className='space-y-1'>
              <PayPalButtons
                {...paypalButtonsProps}
                fundingSource={fundingSource}
                style={{
                  ...(paypalButtonsProps.style ?? {}),
                  ...(FUNDING_STYLE_OVERRIDES[fundingSource] ?? {}),
                }}
              />
              {helper && (
                <p className='text-[11px] text-muted-foreground'>{helper}</p>
              )}
            </div>
          ))}
      </div>
      {checkoutFeedbackMessage && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${checkoutFeedbackClass}`}>
          {checkoutFeedbackMessage}
          {transactionId && checkoutFeedbackVariant === 'success' && (
            <p className='mt-2 text-xs font-mono'>Reference: {transactionId}</p>
          )}
        </div>
      )}
    </div>
  );
}

function getParticipantName(
  participant: { firstName?: string | null; lastName?: string | null },
  withFallback = true,
) {
  const name = `${participant.firstName ?? ''} ${participant.lastName ?? ''}`
    .trim()
    .replace(/\s+/g, ' ');
  if (!name && withFallback) {
    return 'Unnamed user';
  }
  return name;
}
