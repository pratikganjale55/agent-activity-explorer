import { useEffect, useMemo, useRef, useState } from 'react';
import { getEvent } from '../api';
import { useFetch } from '../useFetch';
import { useSlow } from '../useSlow';
import { ErrorBox } from './States';

const LIMIT = 20_000;

function JsonBlock({ value }: { value: unknown }) {
  const [full, setFull] = useState(false);
  const text = useMemo(() => JSON.stringify(value, null, 2) ?? 'null', [value]);
  const long = text.length > LIMIT;
  return (
    <>
      <pre className="json" tabIndex={0}>{long && !full ? text.slice(0, LIMIT) + '\n…' : text}</pre>
      {long && !full && <button onClick={() => setFull(true)}>Show all ({text.length.toLocaleString()} characters)</button>}
    </>
  );
}

export function DetailPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const panelRef = useRef<HTMLElement>(null);
  const detail = useFetch((signal) => getEvent(id, signal), id);
  const slow = useSlow(detail.loading);

  // Esc closes the panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus moves into the panel on open and returns to the previous element on close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const d = detail.data;

  return (
    <aside ref={panelRef} className="panel" role="dialog" aria-label="Event details" tabIndex={-1}>
      <div className="panel-head">
        <h2>Event details</h2>
        <button onClick={onClose} aria-label="Close details (Esc)">Close ✕</button>
      </div>

      {detail.loading && (
        <div role="status">
          <p className="muted">Loading event…</p>
          {slow && <p className="slow">Still loading… the server is responding slowly.</p>}
        </div>
      )}

      {detail.error && <ErrorBox error={detail.error} onRetry={detail.reload} />}

      {d && (
        <>
          <dl>
            <dt>ID</dt><dd>{d.id}</dd>
            <dt>Timestamp</dt><dd>{d.timestamp}</dd>
            <dt>Agent</dt><dd>{d.agent}</dd>
            <dt>Tool</dt><dd>{d.tool}</dd>
            <dt>Status</dt><dd><span className={`status status-${d.status}`}>{d.status}</span></dd>
            <dt>Latency</dt><dd>{d.latencyMs} ms</dd>
            <dt>Policies</dt>
            <dd>{d.policyMatches.length ? d.policyMatches.join(', ') : <span className="muted">None fired</span>}</dd>
          </dl>
          <h3>Args</h3>
          <JsonBlock value={d.args} />
          <h3>Result</h3>
          <JsonBlock value={d.result} />
        </>
      )}
    </aside>
  );
}