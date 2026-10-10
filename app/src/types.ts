export type Status = 'ok' | 'blocked' | 'error';
export type BucketSize = '1m' | '5m' | '1h';



export interface EventItem {
  id: string;
  timestamp: string;
  agent: string;
  tool: string;
  status: Status;
  latencyMs: number;
  argsPreview: string;
}

export interface EventsPage {
  items: EventItem[];
  nextCursor?: string | null;
  total: number;
}

export interface EventDetail {
  id: string;
  timestamp: string;
  agent: string;
  tool: string;
  status: Status;
  latencyMs: number;
  args: unknown;
  result: unknown;
  policyMatches: string[];
}


export interface HistogramBucket {
  t: string;
  count: number;
}

export interface Histogram {
  bucket: BucketSize;
  buckets: HistogramBucket[];
}