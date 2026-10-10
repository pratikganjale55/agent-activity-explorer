import { useCallback, useEffect, useRef, useState } from 'react';
import { getEvents } from './api';
import type { ApiError } from './api';
import type { EventItem } from './types';

interface Filters {
  q: string;
  agent: string;
  status: string;
}

interface State {
  phase: 'loading' | 'ready' | 'error';
  items: EventItem[];
  nextCursor: string | null;
  total: number;
  error: ApiError | null;
  loadingMore: boolean;
  moreError: ApiError | null;
}

const INITIAL: State = {
  phase: 'loading', items: [], nextCursor: null, total: 0,
  error: null, loadingMore: false, moreError: null,
};

function mergeUnique(a: EventItem[], b: EventItem[]): EventItem[] {
  const seen = new Set(a.map((e) => e.id));
  return [...a, ...b.filter((e) => !seen.has(e.id))];
}

export function useEvents({ q, agent, status }: Filters) {
  const [state, setState] = useState<State>(INITIAL);
  const [attempt, setAttempt] = useState(0);
  const moreCtl = useRef<AbortController | null>(null);
  const busy = useRef(false);

  // First page: runs on mount, whenever filters change, and on Retry.
  useEffect(() => {
    const ctl = new AbortController();
    busy.current = false;
    setState(INITIAL);
    getEvents({ q, agent, status }, ctl.signal)
      .then((page) =>
        setState({ ...INITIAL, phase: 'ready', items: page.items, nextCursor: page.nextCursor ?? null, total: page.total }),
      )
      .catch((e: ApiError) => {
        if (e.kind === 'abort') return;
        setState({ ...INITIAL, phase: 'error', error: e });
      });
    return () => {
      ctl.abort(); // a stale response can never overwrite newer results
      moreCtl.current?.abort();
    };
  }, [q, agent, status, attempt]);

  const loadMore = useCallback(() => {
    if (state.phase !== 'ready' || !state.nextCursor || busy.current) return;
    busy.current = true;
    const ctl = new AbortController();
    moreCtl.current = ctl;
    setState((s) => ({ ...s, loadingMore: true, moreError: null }));
    getEvents({ q, agent, status, cursor: state.nextCursor }, ctl.signal)
      .then((page) => {
        busy.current = false;
        setState((s) => ({
          ...s,
          items: mergeUnique(s.items, page.items),
          nextCursor: page.nextCursor ?? null,
          total: page.total,
          loadingMore: false,
        }));
      })
      .catch((e: ApiError) => {
        if (e.kind === 'abort') return;
        busy.current = false;
        setState((s) => ({ ...s, loadingMore: false, moreError: e })); // keep the rows already loaded
      });
  }, [state.phase, state.nextCursor, q, agent, status]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, hasMore: state.nextCursor !== null, loadMore, retry };
}