import type { BucketSize } from './types';

export const BUCKET_MS: Record<BucketSize, number> = {
  '1m': 60_000,
  '5m': 300_000,
  '1h': 3_600_000,
};

const HOUR = 3_600_000;

export function pickBucket(from: string, to: string): BucketSize {
  if (!from || !to) return '1h';
  const span = Date.parse(to) - Date.parse(from);
  if (!(span > 0)) return '1h';
  if (span <= 2 * HOUR) return '1m';
  if (span <= 12 * HOUR) return '5m';
  return '1h';
}

export function formatTick(ms: number, spanMs: number): string {
  const iso = new Date(ms).toISOString();
  return spanMs <= 6 * HOUR ? iso.slice(11, 16) : `${iso.slice(5, 10)} ${iso.slice(11, 16)}`;
}

export function formatRange(from: string, to: string): string {
  const f = (s: string) => new Date(Date.parse(s)).toISOString().slice(0, 16).replace('T', ' ');
  return `${f(from)} → ${f(to)} UTC`;
}