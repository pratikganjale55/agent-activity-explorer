import { useEffect, useState } from 'react';
import type { ApiError } from './api';

interface FetchState<T> {
  data?: T;
  error?: ApiError;
  loading: boolean;
}

export function useFetch<T>(fetcher: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<FetchState<T>>({ loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctl = new AbortController();
    setState({ loading: true });
    fetcher(ctl.signal)
      .then((data) => setState({ data, loading: false }))
      .catch((e: ApiError) => {
        if (e.kind === 'abort') return;
        setState({ error: e, loading: false });
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` identifies the request
  }, [key, attempt]);

  return { ...state, reload: () => setAttempt((n) => n + 1) };
}