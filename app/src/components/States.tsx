import type { ApiError } from '../api';

function describe(e: ApiError): string {
  switch (e.kind) {
    case 'network': return "Can't reach the API. Check that it is running on localhost:4000.";
    case 'timeout': return 'The server took too long to respond.';
    case 'server': return 'The server hit an error. This is usually temporary.';
    case 'notfound': return 'That item was not found. The link may be wrong.';
    default: return e.message;
  }
}

export function ErrorBox({ error, onRetry, compact = false }: { error: ApiError; onRetry?: () => void; compact?: boolean }) {
  return (
    <div className={`box error${compact ? ' compact' : ''}`} role="alert">
      <h2>Something went wrong</h2>
      <p>{describe(error)}</p>
      {onRetry && error.kind !== 'notfound' && <button onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function TableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading events">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row" />
      ))}
    </div>
  );
}

export function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <div className="box">
      <h2>No events found</h2>
      <p className="muted">{hasFilters ? 'Nothing matches your search or filters.' : 'There are no events yet.'}</p>
      {hasFilters && <button onClick={onClear}>Clear filters</button>}
    </div>
  );
}