import type { BucketSize, EventDetail, EventsPage, Histogram } from "./types";

const BASE: string = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

export type ApiErrorKind =
  | "network"
  | "timeout"
  | "server"
  | "notfound"
  | "client"
  | "abort";

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(kind: ApiErrorKind, message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
  }
}

type Params = Record<string, string | undefined>;

function buildUrl(path: string, params: Params): string {
  const url = new URL(path, BASE);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }
  return url.toString();
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted)
      return reject(new ApiError("abort", "Request cancelled"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new ApiError("abort", "Request cancelled"));
      },
      { once: true },
    );
  });
}

async function requestOnce<T>(url: string, signal?: AbortSignal): Promise<T> {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) ctl.abort();

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, TIMEOUT_MS);

  const failure = (fallback: ApiError): ApiError => {
    if (signal?.aborted) return new ApiError("abort", "Request cancelled");
    if (timedOut)
      return new ApiError("timeout", "The server took too long to respond.");
    return fallback;
  };

  try {
    let res: Response;
    try {
      res = await fetch(url, { signal: ctl.signal });
    } catch {
      throw failure(new ApiError("network", "Can't reach the server."));
    }
    if (!res.ok) {
      if (res.status === 404) throw new ApiError("notfound", "Not found", 404);
      if (res.status >= 500)
        throw new ApiError("server", "The server had a problem.", res.status);
      throw new ApiError(
        "client",
        `Request failed (${res.status}).`,
        res.status,
      );
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw failure(
        new ApiError("server", "The server sent an invalid response."),
      );
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

async function request<T>(
  path: string,
  params: Params,
  signal?: AbortSignal,
): Promise<T> {
  const url = buildUrl(path, params);
  for (let attempt = 0; ; attempt++) {
    try {
      return await requestOnce<T>(url, signal);
    } catch (e) {
      const err = e as ApiError;
      const retryable =
        err.kind === "server" ||
        err.kind === "network" ||
        err.kind === "timeout";
      if (!retryable || attempt >= MAX_RETRIES) throw err;
      await sleep(400 * 2 ** attempt, signal);
    }
  }
}

export interface EventQuery {
  q?: string;
  agent?: string;
  status?: string;
  from?: string;
  to?: string;
  cursor?: string | null;
  limit?: number;
}

export function getEvents(
  query: EventQuery,
  signal?: AbortSignal,
): Promise<EventsPage> {
  return request<EventsPage>(
    "/events",
    {
      q: query.q?.trim(),
      agent: query.agent,
      status: query.status,
      from: query.from,
      to: query.to,
      cursor: query.cursor ?? undefined,
      limit: String(query.limit ?? 50),
    },
    signal,
  );
}

export function getEvent(
  id: string,
  signal?: AbortSignal,
): Promise<EventDetail> {
  return request<EventDetail>(`/events/${encodeURIComponent(id)}`, {}, signal);
}

export function getAgents(signal?: AbortSignal): Promise<string[]> {
  return request<string[]>("/agents", {}, signal);
}

export interface HistogramQuery {
  q?: string;
  agent?: string;
  status?: string;
  from?: string;
  to?: string;
  bucket: BucketSize;
}

export function getHistogram(query: HistogramQuery, signal?: AbortSignal): Promise<Histogram> {
  return request<Histogram>(
    '/events/histogram',
    {
      q: query.q?.trim(),
      agent: query.agent,
      status: query.status,
      from: query.from,
      to: query.to,
      bucket: query.bucket,
    },
    signal,
  );
}
