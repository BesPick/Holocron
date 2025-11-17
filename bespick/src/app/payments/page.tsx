import { Sparkles, ShieldCheck, Clock3 } from 'lucide-react';

import { PayPalCheckout } from '@/components/payments/paypal-checkout';

export const metadata = {
  title: 'Payments | BESPICK',
};

export default function PaymentsPage() {
  return (
    <section className='mx-auto w-full max-w-5xl px-4 py-16 space-y-12'>
      <div className='rounded-3xl border border-border bg-gradient-to-br from-primary/5 via-background to-background px-8 py-10 shadow'>
        <p className='text-sm font-semibold uppercase tracking-[0.3em] text-primary'>
          Morale Fund
        </p>
        <h1 className='mt-4 text-4xl font-semibold text-foreground sm:text-5xl'>
          Fuel upcoming BESPICK experiences
        </h1>
        <p className='mt-4 text-base text-muted-foreground sm:text-lg'>
          Every contribution feeds directly into morale events, recognition
          drops, and squadron touchpoints. Use PayPal to send a secure payment in
          a few clicks—no invoices or manual tracking required.
        </p>
      </div>

      <PayPalCheckout />

      <div className='grid gap-4 sm:grid-cols-3'>
        {[
          {
            title: 'Instant receipts',
            description:
              'PayPal emails you proof of payment immediately after capture.',
            icon: Sparkles,
          },
          {
            title: 'Secure checkout',
            description:
              'Sensitive keys stay on the server; we never store payment data.',
            icon: ShieldCheck,
          },
          {
            title: 'Track impact',
            description:
              'Funds roll into the same dashboard admins use to schedule events.',
            icon: Clock3,
          },
        ].map((item) => (
          <div
            key={item.title}
            className='rounded-2xl border border-border bg-card/70 p-5 shadow-sm'
          >
            <item.icon className='h-6 w-6 text-primary' />
            <h2 className='mt-3 text-lg font-semibold text-foreground'>
              {item.title}
            </h2>
            <p className='mt-1 text-sm text-muted-foreground'>
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
