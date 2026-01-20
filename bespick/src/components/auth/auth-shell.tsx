import type { ReactNode } from 'react';

export const authAppearance = {
  elements: {
    rootBox: 'flex w-full min-w-0 items-center justify-center',
    cardBox: 'w-full min-w-0 max-w-full',
    card:
      'w-full min-w-0 max-w-full rounded-2xl border border-border bg-card p-5 shadow-lg sm:max-w-sm sm:p-6',
    headerTitle: 'text-xl font-semibold text-foreground sm:text-2xl',
    headerSubtitle: 'text-xs text-muted-foreground sm:text-sm',
    socialButtons: 'flex flex-col gap-2',
    socialButtonsBlockButton:
      'inline-flex items-center justify-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    socialButtonsBlockButtonText: 'text-sm font-medium',
    form: 'space-y-4',
    formField: 'space-y-2',
    formFieldLabel: 'text-sm font-medium text-foreground',
    formFieldInput:
      'block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    formButtonPrimary:
      'mt-2 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    identityPreview:
      'rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs text-foreground sm:text-sm',
    backButton: 'text-sm text-muted-foreground hover:text-primary',
    footer: 'hidden',
  },
  variables: {
    colorPrimary: 'hsl(var(--primary))',
    colorText: 'hsl(var(--foreground))',
    colorBackground: 'transparent',
    borderRadius: '0.75rem',
  },
} as const;

type AuthShellProps = {
  heading: string;
  subheading: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function AuthShell({
  heading,
  subheading,
  footer,
  children,
}: AuthShellProps) {
  return (
    <section className='mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-4xl items-start justify-center px-4 py-10 sm:py-16'>
      <div className='grid w-full overflow-hidden rounded-2xl border border-border bg-card/85 shadow-lg backdrop-blur supports-backdrop-filter:bg-card/75 sm:rounded-3xl sm:shadow-xl md:grid-cols-[1.05fr,minmax(0,420px)]'>
        <div className='hidden flex-col justify-between bg-linear-to-br from-primary via-primary to-primary/80 p-10 text-primary-foreground md:flex'>
          <div className='space-y-5'>
            <span className='inline-flex w-fit items-center gap-2 rounded-full bg-primary-foreground/15 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-primary-foreground'>
              BESPIN Holocron
            </span>
            <h1 className='text-3xl font-semibold leading-tight'>{heading}</h1>
            <p className='text-sm text-primary-foreground/80'>{subheading}</p>
          </div>
        </div>

        <div className='flex h-full flex-col bg-card/95 p-6 sm:p-8 md:p-10'>
          <div className='mb-6 space-y-2 text-center md:hidden'>
            <h1 className='text-2xl font-semibold text-foreground'>
              {heading}
            </h1>
            <p className='text-sm text-muted-foreground'>{subheading}</p>
          </div>

          <div className='flex flex-1 items-start justify-center'>
            <div className='w-full min-w-0 max-w-sm space-y-6'>
              {children}
              {footer ? (
                <div className='border-t border-border pt-6 text-center text-sm text-muted-foreground'>
                  {footer}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
