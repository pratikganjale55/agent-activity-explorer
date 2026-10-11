import { getHistogram } from '../api';
import { useFetch } from '../useFetch';
import { useSlow } from '../useSlow';
import { navigate } from '../useUrlState';
import { formatRange, pickBucket } from '../timeUtils';
import { ErrorBox } from './States';
import { TimelineChart } from './TimelineChart';

interface Props {
  q: string;
  agent: string;
  status: string;
  from: string;
  to: string;
}

export function TimelinePanel({ q, agent, status, from, to }: Props) {
  const bucket = pickBucket(from, to);
  const key = [q, agent, status, from, to, bucket].join('|');
  const hist = useFetch((signal) => getHistogram({ q, agent, status, from, to, bucket }, signal), key);
  const slow = useSlow(hist.loading);
  const hasRange = Boolean(from && to);

  return (
    <section className="timeline-panel" aria-label="Events over time">
      <div className="timeline-head">
        <h2>Events over time</h2>
        <span className="muted">
          {hasRange ? formatRange(from, to) : 'All time'} · {bucket} buckets
        </span>
        {hasRange && <button onClick={() => navigate({ from: '', to: '' })}>Reset time range</button>}
      </div>

      <div className="timeline-body">
        {hist.loading && (
          <div role="status">
            <div className="skeleton-row" style={{ height: 150 }} />
            {slow && <p className="slow">Still loading the chart… the server is responding slowly.</p>}
          </div>
        )}

        {hist.error && <ErrorBox compact error={hist.error} onRetry={hist.reload} />}

        {hist.data && hist.data.buckets.length === 0 && (
          <p className="box">No events in this time range for the current filters.</p>
        )}

        {hist.data && hist.data.buckets.length > 0 && (
          <TimelineChart
            buckets={hist.data.buckets}
            bucket={bucket}
            from={from}
            to={to}
            onSelect={(f, t) => navigate({ from: f, to: t })}
          />
        )}
      </div>

      <p className="muted hint">Drag across the chart (or click a bar) to filter the list to that time range.</p>
    </section>
  );
}