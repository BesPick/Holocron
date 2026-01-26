'use client';

import { useCallback, useState } from 'react';
import type { Announcement } from '../_components/types';

export function useLocalActivities(activities?: Announcement[]) {
  const [localState, setLocalState] = useState(() => ({
    source: activities,
    items: activities ?? null,
  }));

  const resolvedActivities =
    localState.source === activities
      ? localState.items
      : activities ?? null;

  const setLocalActivities = useCallback(
    (
      value:
        | Announcement[]
        | null
        | ((previous: Announcement[] | null) => Announcement[] | null),
    ) => {
      setLocalState((prev) => {
        const base =
          prev.source === activities ? prev.items : activities ?? null;
        const nextItems =
          typeof value === 'function'
            ? value(base)
            : value;
        return { source: activities, items: nextItems };
      });
    },
    [activities],
  );

  return {
    activities: resolvedActivities ?? activities ?? [],
    setLocalActivities,
  };
}
