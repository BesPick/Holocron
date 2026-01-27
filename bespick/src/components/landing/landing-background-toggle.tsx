'use client';

import * as React from 'react';

import { VantaNetBackground } from './vanta-net-background';

const STORAGE_KEY = 'bespickLandingBackgroundEnabled';

export function LandingBackgroundToggle() {
  const [enabled, setEnabled] = React.useState(true);

  React.useEffect(() => {
    const stored =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(STORAGE_KEY)
        : null;
    if (stored === 'false') {
      setEnabled(false);
    }
  }, []);

  const handleToggle = () => {
    setEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, String(next));
      }
      return next;
    });
  };

  return (
    <>
      {enabled ? <VantaNetBackground /> : null}
      <div className='fixed bottom-6 right-6 z-50 flex items-center rounded-full border border-border bg-background/90 px-2 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground shadow-lg backdrop-blur'>
        <div className='group flex items-center gap-2'>
          <span className='max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 group-hover:max-w-40 group-hover:opacity-100'>
            Background
          </span>
          <button
            type='button'
            role='switch'
            aria-checked={enabled}
            onClick={handleToggle}
            className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
              enabled
                ? 'border-primary/50 bg-primary/30'
                : 'border-border bg-secondary/60'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-foreground transition ${
                enabled ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>
    </>
  );
}
