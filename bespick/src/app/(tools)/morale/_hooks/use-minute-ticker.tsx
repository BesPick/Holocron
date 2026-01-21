'use client';

import { useCallback, useEffect, useState } from 'react';

export function useMinuteTicker() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  const refresh = useCallback(() => {
    setNow(Date.now());
  }, []);

  return { now, refresh };
}
