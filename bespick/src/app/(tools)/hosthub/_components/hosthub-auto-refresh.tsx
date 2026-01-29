'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeLive } from '@/lib/liveEvents';

export function HostHubAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = subscribeLive(['hosthubSchedule'], () => {
      router.refresh();
    });
    return () => {
      unsubscribe();
    };
  }, [router]);

  return null;
}
