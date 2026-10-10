export type Status = 'ok' | 'blocked' | 'error';

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