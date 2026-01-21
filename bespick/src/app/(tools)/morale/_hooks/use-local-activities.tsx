'use client';

import { useEffect, useState } from 'react';
import type { Announcement } from '../_components/types';

export function useLocalActivities(activities?: Announcement[]) {
  const [localActivities, setLocalActivities] = useState<
    Announcement[] | null
  >(null);

  useEffect(() => {
    if (activities) {
      setLocalActivities(activities);
    }
  }, [activities]);

  return {
    activities: localActivities ?? activities ?? [],
    setLocalActivities,
  };
}
