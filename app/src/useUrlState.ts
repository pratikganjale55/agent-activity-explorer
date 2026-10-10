import { useMemo, useSyncExternalStore } from "react";

export interface UrlState {
  q: string;
  agent: string;
  status: string;
  from: string;
  to: string;
  event: string;
}

const STATUSES = ["ok", "blocked", "error"];
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("popstate", cb); // back/forward
  return () => {
    listeners.delete(cb);
    window.removeEventListener("popstate", cb);
  };
}

function validRange(from: string | null, to: string | null) {
  const f = Date.parse(from ?? "");
  const t = Date.parse(to ?? "");
  return Number.isFinite(f) && Number.isFinite(t) && f < t
    ? { from: from as string, to: to as string }
    : { from: "", to: "" };
}

const getSnapshot = () => window.location.search;

function parse(search: string): UrlState {
  const p = new URLSearchParams(search);
  const status = p.get("status") ?? "";
  return {
    q: p.get("q") ?? "",
    agent: p.get("agent") ?? "",
    status: STATUSES.includes(status) ? status : "",
    ...validRange(p.get("from"), p.get("to")),
    event: p.get("event") ?? "",
  };
}

/** Update the URL. 'push' creates a history entry, 'replace' does not (use while typing). */
export function navigate(
  patch: Partial<UrlState>,
  mode: "push" | "replace" = "push",
) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  const next = window.location.pathname + (qs ? `?${qs}` : "");
  if (next === window.location.pathname + window.location.search) return;
  if (mode === "push") window.history.pushState(null, "", next);
  else window.history.replaceState(null, "", next);
  listeners.forEach((l) => l());
}

/** The URL is the single source of truth: components read from it, never copy it into state. */
export function useUrlState(): UrlState {
  const search = useSyncExternalStore(subscribe, getSnapshot);
  return useMemo(() => parse(search), [search]);
}
