import { useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BucketSize, HistogramBucket } from '../types';
import { BUCKET_MS, formatTick } from '../timeUtils';

const W = 800;
const H = 170;
const M = { top: 10, right: 10, bottom: 24, left: 46 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;
const MIN_DRAG = 4; 

interface Props {
  buckets: HistogramBucket[];
  bucket: BucketSize;
  from: string;
  to: string;
  onSelect: (from: string, to: string) => void;
}

export function TimelineChart({ buckets, bucket, from, to, onSelect }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);

  const bucketMs = BUCKET_MS[bucket];
  const points = buckets.map((b) => ({ t: Date.parse(b.t), count: b.count }));
  const hasRange = Boolean(from && to);
  if (!points.length && !hasRange) return null;

  // Time axis. Empty buckets are omitted by the API, so we position every bar by its timestamp.
  const t0 = hasRange ? Date.parse(from) : Math.min(...points.map((p) => p.t));
  const t1 = hasRange ? Date.parse(to) : Math.max(...points.map((p) => p.t)) + bucketMs;
  const span = t1 - t0;
  const max = Math.max(1, ...points.map((p) => p.count));

  const x = (ms: number) => ((ms - t0) / span) * PLOT_W;
  const timeAt = (px: number) => t0 + (px / PLOT_W) * span;
  const barW = Math.max(1, (bucketMs / span) * PLOT_W - 1);

  const toPlotX = (clientX: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * W;
    return Math.min(PLOT_W, Math.max(0, svgX - M.left));
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const px = toPlotX(e.clientX);
    setDrag({ a: px, b: px });
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drag) setDrag({ a: drag.a, b: toPlotX(e.clientX) });
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const end = toPlotX(e.clientX);
    const lo = Math.min(drag.a, end);
    const hi = Math.max(drag.a, end);
    setDrag(null);

    // Snap to bucket boundaries so the chart and the list agree exactly.
    let start: number;
    let stop: number;
    if (hi - lo < MIN_DRAG) {
      start = Math.floor(timeAt(lo) / bucketMs) * bucketMs;
      stop = start + bucketMs;
    } else {
      start = Math.floor(timeAt(lo) / bucketMs) * bucketMs;
      stop = Math.ceil(timeAt(hi) / bucketMs) * bucketMs;
      if (stop <= start) stop = start + bucketMs;
    }
    onSelect(new Date(start).toISOString(), new Date(stop).toISOString());
  };

  const ticks = Array.from({ length: 5 }, (_, i) => t0 + (span * i) / 4);
  const peak = points.reduce((a, p) => (p.count > a.count ? p : a), points[0]);
  const label = peak
    ? `Events over time. Peak of ${peak.count.toLocaleString()} events in the bucket starting ${formatTick(peak.t, span)} UTC.`
    : 'Events over time. No events in this range.';

  return (
    <svg
      ref={svgRef}
      className="timeline"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => setDrag(null)}
    >
      <g transform={`translate(${M.left},${M.top})`}>
        <line className="grid" x1={0} x2={PLOT_W} y1={0} y2={0} />
        <line className="axis" x1={0} x2={PLOT_W} y1={PLOT_H} y2={PLOT_H} />
        <text className="tick" x={-6} y={4} textAnchor="end">{max.toLocaleString()}</text>
        <text className="tick" x={-6} y={PLOT_H} textAnchor="end">0</text>

        {points.map((p) => {
          const h = (p.count / max) * PLOT_H;
          return (
            <rect key={p.t} className="bar" x={x(p.t)} y={PLOT_H - h} width={barW} height={h}>
              <title>{`${formatTick(p.t, span)} UTC: ${p.count.toLocaleString()} events`}</title>
            </rect>
          );
        })}

        {ticks.map((t, i) => (
          <text
            key={i}
            className="tick"
            x={x(t)}
            y={PLOT_H + 16}
            textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
          >
            {formatTick(t, span)}
          </text>
        ))}

        {drag && (
          <rect
            className="brush"
            x={Math.min(drag.a, drag.b)}
            y={0}
            width={Math.abs(drag.b - drag.a)}
            height={PLOT_H}
          />
        )}
      </g>
    </svg>
  );
}