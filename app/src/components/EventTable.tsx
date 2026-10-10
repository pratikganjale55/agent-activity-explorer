import { useEffect, useRef } from 'react';
import type { ApiError } from '../api';
import type { EventItem } from '../types';
import { ErrorBox } from './States';

interface Props {
  items: EventItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  moreError: ApiError | null;
  onLoadMore: () => void;
}

const formatTime = (iso: string) => iso.replace('T', ' ').replace('Z', '');

export function EventTable({ items, selectedId, onSelect, hasMore, loadingMore, moreError, onLoadMore }: Props) {
  const sentinel = useRef<HTMLDivElement>(null);

  // Auto-load the next page when the bottom is near. Disabled after an error so it can't loop.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loadingMore || moreError) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onLoadMore(); },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, moreError, onLoadMore]);

  return (
    <>
      <div className="table-wrap">
        <table className="events">
          <thead>
            <tr>
              <th scope="col">Timestamp (UTC)</th>
              <th scope="col">Agent</th>
              <th scope="col">Tool</th>
              <th scope="col">Status</th>
              <th scope="col" className="num">Latency</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr
                key={e.id}
                tabIndex={0}
                aria-current={e.id === selectedId ? 'true' : undefined}
                onClick={() => onSelect(e.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    onSelect(e.id);
                  }
                }}
              >
                <td>{formatTime(e.timestamp)}</td>
                <td>{e.agent}</td>
                <td>{e.tool}</td>
                <td><span className={`status status-${e.status}`}>{e.status}</span></td>
                <td className="num">{e.latencyMs} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        {moreError && <ErrorBox compact error={moreError} onRetry={onLoadMore} />}
        {loadingMore && <p role="status" className="muted">Loading more…</p>}
        {hasMore && !loadingMore && !moreError && <button onClick={onLoadMore}>Load more</button>}
        {!hasMore && <p className="muted">End of results.</p>}
        <div ref={sentinel} aria-hidden="true" />
      </div>
    </>
  );
}