'use client';

import { useCallback, useSyncExternalStore } from 'react';

type DismissibleHeaderProps = {
  storageKey: string;
  title: string;
  description: string;
  dismissLabel: string;
  collapsedTitle?: string;
};

const STORAGE_EVENT = 'bespick-storage-update';

const getStoredDismissed = (storageKey: string) => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(storageKey) === 'true';
};

const isStorageEvent = (event: Event): event is StorageEvent =>
  typeof StorageEvent !== 'undefined' && event instanceof StorageEvent;

export function DismissibleHeader({
  storageKey,
  title,
  description,
  dismissLabel,
  collapsedTitle,
}: DismissibleHeaderProps) {
  const isDismissed = useSyncExternalStore(
    useCallback(
      (onStoreChange) => {
        if (typeof window === 'undefined') {
          return () => undefined;
        }
        const handler = (event: Event) => {
          if (isStorageEvent(event) && event.key && event.key !== storageKey) {
            return;
          }
          onStoreChange();
        };
        window.addEventListener('storage', handler);
        window.addEventListener(STORAGE_EVENT, handler);
        return () => {
          window.removeEventListener('storage', handler);
          window.removeEventListener(STORAGE_EVENT, handler);
        };
      },
      [storageKey],
    ),
    useCallback(() => getStoredDismissed(storageKey), [storageKey]),
    useCallback(() => null, []),
  );

  const handleDismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, 'true');
      window.dispatchEvent(new Event(STORAGE_EVENT));
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
