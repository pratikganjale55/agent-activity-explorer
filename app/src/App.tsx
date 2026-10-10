import { useCallback } from 'react';
import { navigate, useUrlState } from './useUrlState';
import { useEvents } from './useEvents';
import { useSlow } from './useSlow';
import { EventTable } from './components/EventTable';
import { EmptyState, ErrorBox, TableSkeleton } from './components/States';

export default function App() {
  const { q, agent, status, event } = useUrlState();
  const events = useEvents({ q, agent, status });
  const slow = useSlow(events.phase === 'loading');

  const select = useCallback((id: string) => navigate({ event: id }), []);
  const clearFilters = useCallback(() => navigate({ q: '', agent: '', status: '' }), []);
  const hasFilters = Boolean(q || agent || status);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Agent Activity Explorer</h1>
      </header>

      <main>
        {events.phase === 'loading' && (
          <>
            <TableSkeleton />
            {slow && <p className="slow" role="status">Still loading… the server is responding slowly.</p>}
          </>
        )}

        {events.phase === 'error' && events.error && <ErrorBox error={events.error} onRetry={events.retry} />}

        {events.phase === 'ready' &&
          (events.items.length === 0 ? (
            <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
          ) : (
            <>
              <p className="count" aria-live="polite">{events.total.toLocaleString()} events</p>
              <EventTable
                items={events.items}
                selectedId={event || null}
                onSelect={select}
                hasMore={events.hasMore}
                loadingMore={events.loadingMore}
                moreError={events.moreError}
                onLoadMore={events.loadMore}
              />
            </>
          ))}
      </main>
    </div>
  );
}