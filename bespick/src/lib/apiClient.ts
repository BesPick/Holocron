import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscribeLive } from '@/lib/liveEvents';

export async function callApi<TArgs, TResult>(
  action: string,
  args: TArgs,
): Promise<TResult> {
  const response = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, args }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof json?.error === 'string'
        ? json.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return json.result as TResult;
}

type UseApiQueryOptions = {
  enabled?: boolean;
  refreshInterval?: number;
  liveKeys?: string[];
};

export function useApiQuery<TArgs, TResult>(
  action: string,
  args: TArgs | 'skip',
  options: UseApiQueryOptions = {},
): TResult | undefined {
  const { enabled = true, refreshInterval = 0, liveKeys = [] } = options;
  const [data, setData] = useState<TResult | undefined>(undefined);
  const argsKey = useMemo(
    () => (args === 'skip' ? 'skip' : JSON.stringify(args)),
    [args],
  );
  const liveKey = useMemo(() => liveKeys.join(','), [liveKeys]);
  const isMounted = useRef(true);
  const fetchRef = useRef<() => void>(() => {});
  const argsRef = useRef<TArgs | null>(null);
  const liveKeysRef = useRef<string[]>([]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    argsRef.current = args === 'skip' ? null : (args as TArgs);
  }, [args]);

  useEffect(() => {
    liveKeysRef.current = liveKeys;
  }, [liveKeys]);

  useEffect(() => {
    if (!enabled || argsKey === 'skip') {
      return;
    }
    let cancelled = false;
    const fetchData = async () => {
      const currentArgs = argsRef.current;
      if (!currentArgs) return;
      try {
        const result = await callApi<TArgs, TResult>(action, currentArgs);
        if (!cancelled && isMounted.current) {
          setData(result);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled && isMounted.current) {
          setData(undefined);
        }
      }
    };
    fetchRef.current = fetchData;
    void fetchData();
    if (refreshInterval > 0) {
      const timer = setInterval(fetchData, refreshInterval);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }
    let unsubscribe = () => {};
    if (liveKey.length > 0) {
      unsubscribe = subscribeLive(liveKeysRef.current, () => {
        void fetchRef.current();
      });
    }
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [action, argsKey, enabled, refreshInterval, liveKey]);

  return enabled && argsKey !== 'skip' ? data : undefined;
}

export function useApiMutation<TArgs, TResult = unknown>(action: string) {
  return useCallback(
    async (args: TArgs) => {
      return callApi<TArgs, TResult>(action, args);
    },
    [action],
  );
}
