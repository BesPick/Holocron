'use client';

import { useCallback, useEffect, useState } from 'react';

type DismissibleHeaderProps = {
  storageKey: string;
  title: string;
  description: string;
  dismissLabel: string;
  collapsedTitle?: string;
};

export function DismissibleHeader({
  storageKey,
  title,
  description,
  dismissLabel,
  collapsedTitle,
}: DismissibleHeaderProps) {
  const [isDismissed, setIsDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    setIsDismissed(stored === 'true');
  }, [storageKey]);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, 'true');
    }
  }, [storageKey]);

  return (
    <header className='mb-10 sm:mb-12'>
      {isDismissed === null ? (
        <div className='h-32 animate-pulse rounded-2xl border border-border/60 bg-card/40' />
      ) : !isDismissed ? (
        <div className='relative rounded-2xl border border-border bg-card px-6 py-8 text-center shadow-sm'>
          <button
            type='button'
            onClick={handleDismiss}
            className='absolute right-4 top-4 rounded-full border border-transparent p-1 text-muted-foreground transition hover:border-border hover:bg-secondary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            aria-label={dismissLabel}
          >
            <span aria-hidden={true}>&times;</span>
          </button>
          <h1 className='text-4xl font-semibold tracking-tight text-foreground sm:text-5xl'>
            {title}
          </h1>
          <p className='mt-4 text-base text-muted-foreground sm:text-lg'>
            {description}
          </p>
        </div>
      ) : (
        <h1 className='text-3xl font-semibold text-foreground text-center sm:text-left'>
          {collapsedTitle ?? title}
        </h1>
      )}
    </header>
  );
}
