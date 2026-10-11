# NOTES

## What I built
**Part A: Agent Activity Explorer** (`app/`, React + Vite + TypeScript). I chose Vite because this is a
client-side dashboard over a separate API, so it needs no SSR or SEO, and Vite is the simpler setup.

- **Core:** cursor-paged event table (infinite scroll plus a Load more button); search and agent/status filters
  stored in the URL (survive refresh, back/forward and copied links); a detail panel linked by `?event=` and
  closed with Esc (focus returns to the row); loading, empty, error and slow ("still loading…") states for the
  list, the agents filter, the detail panel and the chart, each with Retry where it makes sense.
- **Optional item: events-over-time chart.** Hand-built SVG over `/events/histogram`, following the current
  filters. Dragging (or clicking a bar) sets `from`/`to` in the URL, which filters the list and zooms the chart.
  I picked one item and did it fully, since the brief rewards that. It also reuses the URL-state design.
  Dark mode follows the system setting and `prefers-reduced-motion` is respected.

**Part B: Perf Clinic.** 12 problems fixed, one commit each, documented in `PERF.md` with measurements.

## Tradeoffs and what I'd do differently
- The URL is the single source of truth (filters are never copied into component state). Typing uses
  `replaceState`; filter changes use `pushState`.
- Stale responses are prevented with `AbortController`. GETs retry twice with backoff on 5xx/network errors,
  then show a manual Retry. Pages are de-duplicated by event id.
- Chart selections snap to bucket boundaries so the chart and the list agree on counts.
- Perf Clinic: the search index costs about 20 MB of memory, and chunked data generation does more total CPU
  work than before; it just never blocks the main thread.
- With more time: a hand-built virtualized list, tests, and keyboard-accessible range inputs for the chart.

## Known broken or incomplete
- No automated tests yet. The best candidates are `pickBucket`, `validRange`, the selection snapping and the retry logic.
- The table keeps every loaded row in the DOM, so it slows down after many thousands of rows.
- Chart range selection is pointer-only, and `touch-action: none` blocks page scroll while a finger is on the chart.
- The chart shows a skeleton on every refetch instead of keeping the old bars.
- The detail panel is not a modal (no focus trap) and the Esc handler is global.
- Keyboard navigation is only Tab/Enter on rows; no tablet-width layout pass was done.


## How I used AI tools
I used Claude (claude.ai chat) throughout, and it generated most of the code.

- **Planning:** summarized the brief, proposed the build order, and read the starter repo and mock API behavior.
- **Part A:** Claude wrote the first version of the API client, hooks, table, filters, detail panel and chart.
- **Part B:** Claude analyzed `perf-clinic/`, wrote the fixes as separate patches and drafted `PERF.md`.
 
- Claude also checked its changes in a Node/simulated-DOM harness, not in a real browser; the browser
  measurements in `PERF.md` are mine. 
