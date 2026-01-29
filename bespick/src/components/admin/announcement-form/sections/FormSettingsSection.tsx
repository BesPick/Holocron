'use client';

import type { FormSubmissionLimit } from '@/types/db';

type FormSettingsSectionProps = {
  isForm: boolean;
  submissionLimit: FormSubmissionLimit;
  onChangeSubmissionLimit: (value: FormSubmissionLimit) => void;
  paymentEnabled: boolean;
  onTogglePayment: (value: boolean) => void;
  price: string;
  onChangePrice: (value: string) => void;
};

export function FormSettingsSection({
  isForm,
  submissionLimit,
  onChangeSubmissionLimit,
  paymentEnabled,
  onTogglePayment,
  price,
  onChangePrice,
}: FormSettingsSectionProps) {
  if (!isForm) return null;

  const isUnlimited = submissionLimit === 'unlimited';

  return (
    <section className='rounded-2xl border border-border bg-card p-6 shadow-sm'>
      <header className='space-y-1'>
        <h2 className='text-xl font-semibold text-foreground'>Form Settings</h2>
        <p className='text-sm text-muted-foreground'>
          Control submission limits and optional PayPal pricing.
        </p>
      </header>

      <div className='mt-5 space-y-4'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <button
            type='button'
            onClick={() => onChangeSubmissionLimit('unlimited')}
            className={`rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              isUnlimited
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5'
            }`}
          >
            <p className='text-sm font-semibold'>Unlimited submissions</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Users can submit the form multiple times.
            </p>
          </button>
          <button
            type='button'
            onClick={() => onChangeSubmissionLimit('once')}
            className={`rounded-xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              !isUnlimited
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5'
            }`}
          >
            <p className='text-sm font-semibold'>One submission per user</p>
            <p className='mt-1 text-xs text-muted-foreground'>
              Users can submit only once.
            </p>
          </button>
        </div>

        <div className='rounded-xl border border-border bg-background/60 p-4'>
          <label className='flex items-center gap-2 text-sm text-foreground'>
            <input
              type='checkbox'
              checked={paymentEnabled}
              onChange={(event) => onTogglePayment(event.target.checked)}
              className='h-4 w-4 rounded border-border'
            />
            Require PayPal payment to submit
          </label>
          {paymentEnabled && (
            <label className='mt-3 flex flex-col gap-2 text-sm text-foreground'>
              Base price (USD)
              <input
                type='number'
                min='0'
                step='0.01'
                value={price}
                onChange={(event) => onChangePrice(event.target.value)}
                placeholder='Optional'
                className='w-48 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
              />
              <span className='text-xs text-muted-foreground'>
                Leave blank if pricing is set by question options.
              </span>
            </label>
          )}
          {!paymentEnabled && (
            <p className='mt-2 text-xs text-muted-foreground'>
              Free by default. Enable to require payment before submission.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
