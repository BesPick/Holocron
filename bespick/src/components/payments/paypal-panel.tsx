'use client';

import * as React from 'react';
import { CheckCircle2, Info } from 'lucide-react';
import {
  PayPalButtons,
  PayPalScriptProvider,
  usePayPalScriptReducer,
  type PayPalButtonsComponentProps,
  type ReactPayPalScriptOptions,
} from '@paypal/react-paypal-js';

export type FundingButtonConfig = {
  id: string;
  fundingSource: NonNullable<PayPalButtonsComponentProps['fundingSource']>;
  helper?: string;
};

export const VENMO_PAYMENT_BUTTON: FundingButtonConfig = {
  id: 'venmo',
  fundingSource: 'venmo',
  helper: 'Shows on US mobile browsers when paying in USD.',
};

export const DEFAULT_PAYMENT_METHOD_BUTTONS: FundingButtonConfig[] = [
  {
    id: 'paypal',
    fundingSource: 'paypal',
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

type PayPalPanelProps = {
  amountLabel: string | null;
  paypalOptions: ReactPayPalScriptOptions;
  paypalButtonsProps: PayPalButtonsComponentProps;
  paymentButtons?: FundingButtonConfig[];
};

export function PayPalPanel({
  amountLabel,
  paypalOptions,
  paypalButtonsProps,
  paymentButtons = DEFAULT_PAYMENT_METHOD_BUTTONS,
}: PayPalPanelProps) {
  const clientId = paypalOptions.clientId ?? '';

  if (!clientId) {
    return (
      <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
        PayPal is not configured. Set `NEXT_PUBLIC_PAYPAL_CLIENT_ID` to enable
        payments.
      </div>
    );
  }

  return (
    <div className='w-full space-y-4'>
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
      <PayPalScriptProvider deferLoading={false} options={paypalOptions}>
        <PayPalButtonsPanel
          paypalButtonsProps={paypalButtonsProps}
          paymentButtons={paymentButtons}
        />
      </PayPalScriptProvider>
    </div>
  );
}

function PayPalButtonsPanel({
  paypalButtonsProps,
  paymentButtons,
}: {
  paypalButtonsProps: PayPalButtonsComponentProps;
  paymentButtons: FundingButtonConfig[];
}) {
  const [{ isPending, isRejected, isResolved }] = usePayPalScriptReducer();
  const showButtons = isResolved && !isRejected;
  const visibleButtons = showButtons ? paymentButtons : [];

  return (
    <div className='w-full space-y-5'>
      {isRejected && (
        <div className='rounded-xl border border-destructive/60 bg-destructive/10 px-4 py-3 text-sm text-destructive'>
          PayPal failed to load. Disable blockers and confirm your client ID is
          valid.
        </div>
      )}
      {isPending && !isRejected && (
        <p className='text-xs text-muted-foreground'>
          Loading PayPal checkout...
        </p>
      )}
      {visibleButtons.map(({ id, fundingSource, helper }) => (
          <div
            key={id}
            className='w-full space-y-1 [&_.paypal-buttons]:w-full [&_.paypal-buttons]:min-w-full [&_.paypal-buttons]:max-w-full [&_.paypal-buttons>div]:w-full [&_iframe]:w-full [&_iframe]:min-w-full [&_iframe]:max-w-full'
          >
            <div className='w-full'>
              <PayPalButtons
                {...paypalButtonsProps}
                fundingSource={fundingSource}
                style={{
                  ...(paypalButtonsProps.style ?? {}),
                  ...(FUNDING_STYLE_OVERRIDES[fundingSource] ?? {}),
                }}
              />
            </div>
            {helper && (
              <p className='text-[11px] text-muted-foreground'>{helper}</p>
            )}
          </div>
        ))}
    </div>
  );
}
