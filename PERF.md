1. Search freezes the page on every keystroke
Symptom: Typing in the search box lags badly. Each character takes a noticeable fraction of a second (longer for common letters) to appear, and the list updates late.
How I found it: Performance panel, record while typing. Each input event is a long task; the bottom-up view is dominated by JSON.stringify, Array.prototype.sort and Date construction inside search().
Root cause: On every keystroke search() ran JSON.stringify(event).toLowerCase() on all 100,000 events, then sorted the matches with a comparator that built two Date objects per comparison. There was also no debounce, so fast typing queued several of these full scans.
Fix: Sort once at startup (events stay newest-first); build one pre-lowercased search string per event once; filter with a plain loop and includes; debounce the input by 150 ms.
Before / after: TODO (e.g. scripting time per keystroke and INP, before vs after).

2. Scrolling is janky
Symptom: Scrolling the page stutters, worst while the results list is on screen.
How I found it: Performance panel, record a scroll. Every scroll event shows a long task with forced reflow warnings (purple "Layout" blocks), getBoundingClientRect, and a filter over all events.
Root cause: The scroll handler ran on every event with no batching and did far too much: it measured every result row with getBoundingClientRect and toggled classes (layout reads and writes interleaved); it re-scanned all 100,000 events (new Date(...).toISOString()) just to count calls in one minute; it changed the top bar's padding (layout, which also moved the content below it); and it animated the progress bar's width (layout).
Fix: Batch scroll work into one requestAnimationFrame per frame; use an IntersectionObserver to know which rows are in the focus band; precompute per-minute counts once; drive the progress bar with transform: scaleX(); stop animating the top bar's padding; register the listener as passive.
Before / after: TODO (e.g. scripting + rendering ms per scroll frame, long tasks during a scroll). 

3. Blank page for a while on load (100k events built in a blocking script)
Symptom: The page stays blank/frozen at startup before anything appears.
How I found it: Performance panel, record a reload. A single long "Evaluate Script" task for config.js runs before first paint; Lighthouse reports long main-thread tasks and a slow FCP/LCP.
Root cause: config.js is a synchronous <script> in <head> that generated all 100,000 events (with string building and Date objects) in one task, blocking HTML parsing and first paint.
Fix: config.js now only defines constants and a generateActivity() function. The data is built in 2,000-event chunks that yield to the browser (scheduler.yield or setTimeout), both scripts are deferred, the page shows "Loading tool calls…" immediately, and aggregates (agent counts, per-minute counts, sorted order, search index) are computed once during generation. The data is byte-for-byte the same.
Before / after: TODO (e.g. FCP/LCP, longest task during load, Total Blocking Time). <!-- hint: Node reference: one ~400 ms blocking task before; after, no single task over ~50 ms. Total CPU work is actually higher now (sort + search index are built here instead of per keystroke), it just never blocks. -->

4. Oversized images
Symptom: Slow load on a normal connection; the hero appears late; avatars pop in; the layout shifts.
How I found it: Network panel (sorted by size) shows hero.png as the biggest request; Lighthouse flags "Properly size images", "Serve images in next-gen formats" and "Image elements have no explicit width and height".
Root cause: hero.png is a 1700x950 PNG of 4,270,977 bytes. The 12 avatar PNGs are 320x320 (about 160 KB each, 1,935,286 bytes in total) but are displayed at 48x48, and the 12 files are only 6 distinct images (01=07, 02=08, ...). No image had width/height, so the page shifted as they loaded.
Fix: Hero converted to WebP (328,800 bytes), preloaded with fetchpriority="high", with width/height. Avatars resized to 96x96 (2x for retina) WebP, 6 files totalling 2,242 bytes, with width/height, loading="lazy" and decoding="async".
Before / after: hero 4,270,977 B -> 328,800 B; avatars 1,935,286 B -> 2,242 B. TODO: LCP and CLS before/after.

5. 327 KB of unused, render-blocking CSS
Symptom: Slower first paint; the Coverage panel shows almost the whole stylesheet unused.
How I found it: Coverage panel (about 100% unused for theme.css); Network panel shows it blocking render; I also checked that none of the page's classes appear in it.
Root cause: theme.css is a 326,878-byte utility-class library (about 8,600 rules). The page uses none of those classes, but a <link rel="stylesheet"> blocks rendering until it is downloaded and parsed.
Fix: Removed the file and the <link>. Also preloaded the web font and added font-display: swap so text is not invisible while the font loads.
Before / after: 326,878 B of render-blocking CSS removed. TODO: FCP / render-blocking time from Lighthouse.

6. Forced synchronous layout in loops (summary fitting and card heights)
Symptom: Jank on load, on every search result update, on window resize, and each time an avatar loads.
How I found it: Performance panel shows many purple "Recalculate style / Layout" blocks with "Forced reflow" in fitSummaries and equalizeCardHeights.
Root cause: Both functions alternated style writes and layout reads (scrollWidth, offsetTop, offsetHeight) inside loops, forcing a full layout per iteration (about 200 rows per render; the card function was O(n^2) and re-ran on every image load and resize).
Fix: Deleted both. Equal-height cards are now align-items: stretch plus min-height in CSS; summaries use a fixed font size with text-overflow: ellipsis (the full text is in the hover preview).
Before / after: TODO (e.g. number of forced reflows and total layout time per render).

7. Live ticker leaks (timer, listeners and DOM nodes)
Symptom: After toggling "Show live calls" on and off a few times, the page gets slower and memory climbs, even with the ticker closed.
How I found it: Memory panel, heap snapshots (or the Performance monitor) while opening/closing the ticker several times; the JS heap, DOM node count and listener count only go up.
Root cause: openTicker() started a new setInterval and added resize and keydown listeners every time, but closeTicker() never cleared them, so each open left another timer running against a detached list. A Map also cached a DOM node for every event ever shown, and was never cleared.
Fix: Keep the interval id and clear it on close, remove both listeners on close (named functions), and drop the unbounded cache.
Before / after: After 5 open/close cycles: 5 live intervals and 10 listeners left behind -> 0 (checked in a DOM test harness). TODO: your heap / node-count numbers from the Memory panel.

8. Hover preview scans all events on every mouse move
Symptom: Moving the mouse over the list stutters.
How I found it: Performance panel while moving the mouse over rows: mousemove handler time is dominated by Array.prototype.find.
Root cause: Each mousemove ran ACTIVITY.find(...) (a linear scan over up to 100,000 events) and set top/left (layout) on every event.
Fix: Rows carry their index (data-i) so the event is a direct array lookup; position updates are batched per frame and use transform; only update the text when the hovered row changes.
Before / after: TODO (handler time per mousemove).

9. 200 synchronous localStorage writes on every render
Symptom: Each search/render has an extra stall; it gets worse over time as more events are marked "viewed".
How I found it: Performance panel shows repeated JSON.stringify and Storage.setItem calls inside rememberViewed on every render.
Root cause: rememberViewed re-parsed the whole stored JSON array, checked membership with Array.includes (O(n)), and called JSON.stringify + localStorage.setItem inside the loop, once per row.
Fix: Load the ids once into a Set, check with has, and persist once per batch from requestIdleCallback.
Before / after: 200 synchronous writes per render -> at most 1, deferred. TODO: time spent in rememberViewed.

10. Non-passive wheel / touch listeners
Symptom: Scrolling over the results list can feel delayed, especially on touch devices.
How I found it: Lighthouse "Does not use passive listeners to improve scrolling performance", or the Performance panel showing scroll waiting on wheel/touchstart handlers.
Root cause: wheel and touchstart listeners on a non-document element are non-passive by default, so the browser must wait for the handler before it may scroll in case it calls preventDefault().
Fix: Added { passive: true } (these handlers only hide the preview).
Before / after: TODO (Lighthouse audit passes / scroll-start latency).

11. Marquee animates left, forcing layout every frame
Symptom: Constant background main-thread work and extra jank while the alerts bar scrolls.
How I found it: Performance panel idle recording shows layout/style work every frame; Rendering panel "Layout shift / paint flashing" highlights the bar.
Root cause: @keyframes alerts-scroll animated left, which is a layout property and cannot run on the compositor. It also ignored prefers-reduced-motion.
Fix: Animate transform: translateX() with will-change: transform; added a prefers-reduced-motion fallback. Also added content-visibility: auto to result rows so off-screen rows are skipped by layout and paint.
Before / after: TODO (layout/style time per idle frame).

12. toLocaleTimeString called for every row
Symptom: Slightly slower renders (about 200 rows per render, plus every ticker row).
How I found it: Performance panel bottom-up: Date.prototype.toLocaleTimeString / Intl.DateTimeFormat near the top.
Root cause: toLocaleTimeString with options builds an Intl formatter on every call, and the value is already an ISO UTC string.
Fix: iso.slice(11, 19), identical output (compared against the old function across a full day of timestamps).
Before / after: TODO. 