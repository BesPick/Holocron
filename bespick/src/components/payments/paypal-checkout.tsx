'use client';

import { useMemo, useState } from 'react';
import {
  PayPalButtons,
  PayPalScriptProvider,
  type PayPalButtonsComponentProps,
} from '@paypal/react-paypal-js';
import { CheckCircle2, Info, ShieldAlert } from 'lucide-react';

type FundingTier = {
  id: string;
  title: string;
  description: string;
  amount: number;
};

const FUNDING_TIERS: FundingTier[] = [
  {
    id: 'refreshments',
    title: 'Refreshments Boost',
    description: 'Cover snacks and drinks for a morale drop-in.',
    amount: 25,
  },
  {
    id: 'experience',
    title: 'Team Experience',
    description: 'Unlock supplies for a themed morale activity.',
    amount: 50,
  },
  {
    id: 'full-event',
    title: 'Full Event Sponsor',
    description: 'Fund an entire morale session for the squadron.',
    amount: 150,
  },
];

const currencyFormatter = (currency: string) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

function clampAmount(input: number) {
  if (Number.isNaN(input)) return NaN;
  return Math.min(input, 10_000);
}

export function PayPalCheckout() {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const currency =
    process.env.NEXT_PUBLIC_PAYPAL_CURRENCY?.toUpperCase() ?? 'USD';
  const formatter = useMemo(() => currencyFormatter(currency), [currency]);

  const [selectedTier, setSelectedTier] = useState<string>(
    FUNDING_TIERS[1]?.id ?? 'custom',
  );
  const [customAmount, setCustomAmount] = useState('');
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error' | 'cancelled'>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);

  const activeTier = FUNDING_TIERS.find((tier) => tier.id === selectedTier);
  const numericAmount = activeTier
    ? activeTier.amount
    : clampAmount(Number.parseFloat(customAmount));
  const isCustom = !activeTier;
  const isValidAmount =
    typeof numericAmount === 'number' &&
    !Number.isNaN(numericAmount) &&
    numericAmount >= 1;
  const amountLabel = isValidAmount ? formatter.format(numericAmount) : null;

  const paypalOptions = useMemo(
    () => ({
      'client-id': clientId ?? '',
      currency,
      intent: 'capture',
      components: 'buttons',
    }),
    [clientId, currency],
  );

  const disabled = !clientId;

  const resetStatus = () => {
    setStatus('idle');
    setStatusMessage(null);
    setTransactionId(null);
  };

  const handleSelectTier = (tierId: string) => {
    setSelectedTier(tierId);
    resetStatus();
  };

  const handleCustomAmountChange = (value: string) => {
    setSelectedTier('custom');
    setCustomAmount(value);
    resetStatus();
  };

  const paypalButtonProps: PayPalButtonsComponentProps = {
    style: {
      shape: 'rect',
      color: 'gold',
      label: 'pay',
      height: 48,
    },
    disabled: !isValidAmount || disabled,
    forceReRender: [
      clientId ?? '',
      currency,
      isValidAmount ? 'valid' : 'invalid',
      Number.isFinite(numericAmount) ? numericAmount : 0,
    ],
    createOrder: async () => {
      if (!isValidAmount) {
        setStatus('error');
        setStatusMessage('Enter a valid contribution amount first.');
        throw new Error('Invalid amount');
      }
      setStatus('processing');
      setStatusMessage(null);
      setTransactionId(null);
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: numericAmount,
          currency,
          description: activeTier
            ? `${activeTier.title} contribution`
            : 'Custom morale contribution',
          referenceId: activeTier?.id ?? 'custom',
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setStatus('error');
        setStatusMessage(
          (error as { error?: string }).error ??
            'Could not start PayPal checkout. Please try again.',
        );
        throw new Error('Failed to create order');
      }

      const data = (await response.json()) as { id?: string };
      if (!data.id) {
        setStatus('error');
        setStatusMessage('PayPal did not return an order id.');
        throw new Error('Missing order id');
      }
      return data.id;
    },
    onApprove: async (data) => {
      if (!data.orderID) {
        setStatus('error');
        setStatusMessage('Missing PayPal order reference.');
        return;
      }

      const response = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ orderId: data.orderID }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        setStatus('error');
        setStatusMessage(
          (error as { error?: string }).error ??
            'We could not capture the payment. PayPal may have voided the transaction.',
        );
        return;
      }

      const capture = await response.json();
      const captureId =
        capture?.purchase_units?.[0]?.payments?.captures?.[0]?.id ??
        capture?.id ??
        data.orderID;
      setStatus('success');
      setStatusMessage(
        'Payment captured successfully. A receipt has been sent to your PayPal email.',
      );
      setTransactionId(captureId ?? null);
    },
    onCancel: () => {
      setStatus('cancelled');
      setStatusMessage('Checkout was cancelled before completion.');
      setTransactionId(null);
    },
    onError: (err) => {
      console.error('PayPal checkout error', err);
      setStatus('error');
      setStatusMessage(
        'Something went wrong while processing the payment. Please try again or contact an admin.',
      );
      setTransactionId(null);
    },
  };

  return (
    <div className='rounded-2xl border border-border bg-card px-6 py-8 shadow-sm'>
      <div className='grid gap-8 lg:grid-cols-[1.2fr_1fr]'>
        <div>
          <p className='text-sm font-semibold uppercase tracking-wide text-muted-foreground'>
            Choose a contribution
          </p>
          <div className='mt-4 grid gap-4 sm:grid-cols-2'>
            {FUNDING_TIERS.map((tier) => {
              const isActive = tier.id === activeTier?.id;
              return (
                <button
                  key={tier.id}
                  type='button'
                  onClick={() => handleSelectTier(tier.id)}
                  className={`rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-secondary/40 text-foreground hover:border-primary/40'
                  }`}
                >
                  <div className='flex items-center justify-between'>
                    <span className='text-base font-semibold'>
                      {tier.title}
                    </span>
                    <span className='text-sm font-semibold'>
                      {formatter.format(tier.amount)}
                    </span>
                  </div>
                  <p className='mt-2 text-sm text-muted-foreground'>
                    {tier.description}
                  </p>
                </button>
              );
            })}
          </div>

          <div className='mt-6'>
            <label
              htmlFor='custom-amount'
              className='text-sm font-medium text-muted-foreground'
            >
              Or enter a custom amount
            </label>
            <div className='mt-2 flex items-center gap-3'>
              <div className='relative flex-1'>
                <span className='pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-semibold text-muted-foreground'>
                  {currency}
                </span>
                <input
                  id='custom-amount'
                  type='number'
                  min='1'
                  step='0.01'
                  placeholder='100'
                  value={customAmount}
                  onChange={(event) =>
                    handleCustomAmountChange(event.target.value)
                  }
                  className='h-12 w-full rounded-xl border border-border bg-background pl-14 pr-4 text-base text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40'
                />
              </div>
              <button
                type='button'
                onClick={() => handleSelectTier('custom')}
                className={`h-12 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isCustom
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'border border-border bg-secondary/60 text-foreground hover:border-primary/50'
                }`}
              >
                Use custom
              </button>
            </div>
            <p className='mt-2 text-xs text-muted-foreground'>
              Minimum $1.00, maximum $10,000.00 per PayPal transaction.
            </p>
          </div>
        </div>

        <div className='rounded-2xl border border-border bg-background/80 p-5 shadow-inner'>
          {!clientId ? (
            <div className='flex flex-col items-center gap-3 text-center text-sm text-muted-foreground'>
              <ShieldAlert className='h-6 w-6 text-destructive' />
              <p>
                PayPal is not configured yet. Set{' '}
                <code className='rounded bg-muted px-1 py-0.5 text-[0.8em]'>
                  NEXT_PUBLIC_PAYPAL_CLIENT_ID
                </code>{' '}
                in your environment.
              </p>
            </div>
          ) : (
            <PayPalScriptProvider deferLoading={false} options={paypalOptions}>
              <div className='space-y-4'>
                <div>
                  <p className='text-sm font-medium text-muted-foreground'>
                    Amount due
                  </p>
                  <div className='mt-1 text-3xl font-semibold'>
                    {amountLabel ?? '--'}
                  </div>
                </div>
                <div className='space-y-2 rounded-xl border border-border bg-card/60 p-4 text-sm text-muted-foreground'>
                  <div className='flex items-start gap-2'>
                    <Info className='h-4 w-4 flex-shrink-0 text-primary' />
                    <p>
                      Your contribution helps the morale team fund upcoming
                      events, supplies, and recognition moments.
                    </p>
                  </div>
                  <div className='flex items-start gap-2'>
                    <CheckCircle2 className='h-4 w-4 flex-shrink-0 text-primary' />
                    <p>
                      PayPal sends you a receipt immediately after we capture
                      the payment.
                    </p>
                  </div>
                </div>
                <PayPalButtons {...paypalButtonProps} />
                {statusMessage && (
                  <div
                    className={`rounded-xl border px-4 py-3 text-sm ${
                      status === 'success'
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                        : status === 'processing'
                          ? 'border-blue-500/50 bg-blue-500/10 text-blue-800 dark:text-blue-200'
                          : status === 'cancelled'
                            ? 'border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-100'
                            : 'border-destructive/60 bg-destructive/10 text-destructive'
                    }`}
                  >
                    {statusMessage}
                    {transactionId && (
                      <p className='mt-2 text-xs font-mono'>
                        Reference: {transactionId}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </PayPalScriptProvider>
          )}
        </div>
      </div>
    </div>
  );
}
