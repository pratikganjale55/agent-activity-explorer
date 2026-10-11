const { pageSize, tickerIntervalMs, tickerVisibleRows, storageKey } =
  window.APP_CONFIG;

const grid = document.getElementById("agents");
const searchInput = document.getElementById("search");
const resultsList = document.getElementById("results");
const resultsCount = document.getElementById("results-count");
const topbar = document.querySelector(".topbar");
const backToTop = document.getElementById("back-to-top");
const progress = document.getElementById("read-progress");
const tickerToggle = document.getElementById("ticker-toggle");
const preview = document.getElementById("row-preview");
const scrollContext = document.getElementById("scroll-context");

let currentPage = []; // events currently rendered, indexed by each row's data-i
const state = {
  ready: false,
  events: [],
  haystack: [],
  agentCounts: {},
  minuteCounts: new Map(),
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTime(iso) {
  // ISO strings are already UTC: 'YYYY-MM-DDTHH:MM:SS.mmmZ' -> 'HH:MM:SS'.
  // (toLocaleTimeString builds an Intl formatter on every call, which is slow when called per row.)
  return iso.slice(11, 19);
}

function renderAgents() {
  grid.innerHTML = window.AGENTS.map((agent, index) => {
    const image =
      "assets/agents/agent-" +
      String((index % 6) + 1).padStart(2, "0") +
      ".webp";
    return (
      '<article class="agent-card">' +
      '<img class="agent-avatar" src="' +
      image +
      '" width="48" height="48" loading="lazy" decoding="async" alt="">' +
      "<h3>" +
      escapeHtml(agent.name) +
      "</h3>" +
      '<p class="agent-owner">' +
      escapeHtml(agent.owner) +
      "</p>" +
      '<p class="agent-description">' +
      escapeHtml(agent.description) +
      "</p>" +
      '<p class="agent-count" data-agent="' +
      escapeHtml(agent.name) +
      '">… calls today</p>' +
      "</article>"
    );
  }).join("");
}

function updateAgentCounts() {
  grid.querySelectorAll(".agent-count").forEach((el) => {
    el.textContent =
      (state.agentCounts[el.dataset.agent] || 0).toLocaleString() +
      " calls today";
  });
}

// Viewed ids are loaded once into a Set (O(1) lookups) and written back to localStorage at most once
// per batch, off the critical path. The original re-parsed the whole JSON on every render, used
// Array.includes (O(n)) and called JSON.stringify + setItem once per row (200 synchronous writes).
function loadViewed() {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey) || "[]"));
  } catch {
    return new Set();
  }
}

const viewed = loadViewed();
let persistQueued = false;

function persistViewed() {
  if (persistQueued) return;
  persistQueued = true;
  const write = () => {
    persistQueued = false;
    try {
      localStorage.setItem(storageKey, JSON.stringify([...viewed]));
    } catch {
      /* storage full or unavailable: the badge is cosmetic, so ignore */
    }
  };
  if ("requestIdleCallback" in window)
    requestIdleCallback(write, { timeout: 2000 });
  else setTimeout(write, 200);
}

function rememberViewed(items) {
  let changed = false;
  for (const item of items) {
    if (!viewed.has(item.id)) {
      viewed.add(item.id);
      changed = true;
    }
  }
  if (changed) persistViewed();
}

function search(query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return state.events; // already sorted newest-first
  const { events, haystack } = state;
  const matches = [];
  for (let i = 0; i < haystack.length; i++) {
    if (haystack[i].includes(needle)) matches.push(events[i]);
  }
  return matches;
}

function renderResults(query) {
  const matches = search(query);
  const page = matches.slice(0, pageSize);
  resultsCount.textContent =
    matches.length.toLocaleString() + " matching tool calls";
  currentPage = page;
  resultsList.innerHTML = page
    .map((event, index) => {
      const isNew = !viewed.has(event.id);
      return (
        '<li class="result-row status-' +
        event.status +
        '" data-i="' +
        index +
        '" data-id="' +
        event.id +
        '" data-minute="' +
        event.timestamp.slice(11, 16) +
        '">' +
        '<span class="result-time">' +
        formatTime(event.timestamp) +
        "</span>" +
        '<span class="result-agent">' +
        escapeHtml(event.agent) +
        "</span>" +
        '<span class="result-tool">' +
        escapeHtml(event.tool) +
        "</span>" +
        '<span class="result-status">' +
        event.status +
        "</span>" +
        '<span class="result-latency">' +
        event.latencyMs +
        " ms</span>" +
        '<span class="result-summary">' +
        escapeHtml(event.summary) +
        "</span>" +
        (isNew ? '<span class="badge-new">New</span>' : "") +
        "</li>"
      );
    })
    .join("");
  rememberViewed(page);
  observeRows();
}

// Scroll work is batched into one animation frame per frame and only touches what changed.
// The progress bar uses transform (compositor-only) instead of width (layout), and the topbar no
// longer changes its padding on every scroll tick (that re-laid-out the whole page).
let maxScroll = 0;
let scrollQueued = false;

function measureScroll() {
  maxScroll = document.documentElement.scrollHeight - window.innerHeight;
}

function applyScroll() {
  scrollQueued = false;
  const scrolled = window.scrollY;
  progress.style.transform =
    "scaleX(" + (maxScroll > 0 ? Math.min(1, scrolled / maxScroll) : 0) + ")";
  topbar.classList.toggle("topbar-raised", scrolled > 8);
  backToTop.classList.toggle("visible", scrolled > window.innerHeight);
}

function onScroll() {
  if (scrollQueued) return;
  scrollQueued = true;
  requestAnimationFrame(applyScroll);
}

// "In focus" rows: the browser tells us when rows enter/leave the 30%-60% viewport band, instead of
// calling getBoundingClientRect() on every row on every scroll event.
let rowObserver = null;

function observeRows() {
  if (rowObserver) rowObserver.disconnect();
  rowObserver = new IntersectionObserver(onFocusBand, {
    rootMargin: "-30% 0px -40% 0px",
  });
  resultsList
    .querySelectorAll(".result-row")
    .forEach((row) => rowObserver.observe(row));
}

function onFocusBand(entries) {
  entries.forEach((entry) =>
    entry.target.classList.toggle("in-focus", entry.isIntersecting),
  );
  const focused = resultsList.querySelector(".in-focus");
  if (focused) {
    const minute = focused.dataset.minute;
    // Per-minute totals are precomputed once; the original re-scanned all 100k events with new Date().
    scrollContext.textContent =
      minute +
      " UTC · " +
      (state.minuteCounts.get(minute) || 0) +
      " calls that minute";
  } else {
    scrollContext.textContent = "";
  }
}

// Hover preview: the row index is read from the DOM (no search through 100k events), position updates
// are batched to one per frame, and the tooltip is moved with transform (no layout).
let pendingPreview = null;
let previewQueued = false;
let shownIndex = -1;

function hidePreview() {
  pendingPreview = null;
  shownIndex = -1;
  preview.hidden = true;
}

function flushPreview() {
  previewQueued = false;
  if (!pendingPreview) return;
  const { index, x, y } = pendingPreview;
  if (index !== shownIndex) {
    const item = currentPage[index];
    if (!item) return;
    preview.textContent = item.summary;
    shownIndex = index;
  }
  preview.style.transform = "translate(" + (x + 12) + "px, " + (y + 12) + "px)";
  preview.hidden = false;
}

function showPreview(event) {
  const row = event.target.closest(".result-row");
  if (!row) return;
  pendingPreview = {
    index: Number(row.dataset.i),
    x: event.clientX,
    y: event.clientY,
  };
  if (!previewQueued) {
    previewQueued = true;
    requestAnimationFrame(flushPreview);
  }
}

// Everything the ticker starts (timer, listeners) is now stopped in closeTicker(). Before, every
// open added another setInterval and two more window listeners that were never removed, and a
// Map cached a DOM node for every event ever shown (an unbounded, slowly growing leak).
let tickerPanel = null;
let tickerTimer = 0;

function tickerRow(event) {
  const row = document.createElement("li");
  row.className = "ticker-row status-" + event.status;
  row.innerHTML =
    '<span class="ticker-time">' +
    formatTime(event.timestamp) +
    "</span>" +
    '<span class="ticker-agent">' +
    escapeHtml(event.agent) +
    "</span>" +
    '<span class="ticker-tool">' +
    escapeHtml(event.tool) +
    "</span>";
  return row;
}

function positionTicker() {
  if (!tickerPanel) return;
  tickerPanel.style.maxHeight = window.innerHeight - 120 + "px";
}

function onTickerKey(event) {
  if (event.key === "Escape") closeTicker();
}

function openTicker() {
  const panel = document.createElement("aside");
  panel.className = "ticker";
  panel.innerHTML =
    '<header class="ticker-header">Live tool calls</header><ul class="ticker-list"></ul>';
  document.body.appendChild(panel);
  tickerPanel = panel;
  const list = panel.querySelector(".ticker-list");

  tickerTimer = setInterval(() => {
    if (!state.events.length) return;
    const event = state.events[Math.floor(Math.random() * state.events.length)];
    list.prepend(tickerRow(event));
    while (list.children.length > tickerVisibleRows) {
      list.lastElementChild.remove();
    }
  }, tickerIntervalMs);

  window.addEventListener("resize", positionTicker);
  window.addEventListener("keydown", onTickerKey);
  positionTicker();
  tickerToggle.setAttribute("aria-pressed", "true");
  tickerToggle.textContent = "Hide live calls";
}

function closeTicker() {
  if (!tickerPanel) return;
  clearInterval(tickerTimer);
  tickerTimer = 0;
  window.removeEventListener("resize", positionTicker);
  window.removeEventListener("keydown", onTickerKey);
  tickerPanel.remove();
  tickerPanel = null;
  tickerToggle.setAttribute("aria-pressed", "false");
  tickerToggle.textContent = "Show live calls";
}

let searchTimer = 0;
searchInput.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (state.ready) renderResults(searchInput.value);
  }, 150);
});
window.addEventListener("scroll", onScroll, { passive: true });
window.addEventListener("resize", measureScroll);
new ResizeObserver(measureScroll).observe(document.body);
resultsList.addEventListener("mousemove", showPreview, { passive: true });
resultsList.addEventListener("mouseleave", hidePreview);
// Passive: a non-passive wheel/touchstart listener makes the browser wait for JS before it may scroll.
resultsList.addEventListener("wheel", hidePreview, { passive: true });
resultsList.addEventListener("touchstart", hidePreview, { passive: true });
backToTop.addEventListener("click", () => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
});
tickerToggle.addEventListener("click", () =>
  tickerPanel ? closeTicker() : openTicker(),
);

renderAgents();
resultsList.innerHTML =
  '<li class="results-loading" role="status">Loading tool calls…</li>';
window.generateActivity(100000).then((data) => {
  Object.assign(state, data, { ready: true });
  updateAgentCounts();
  renderResults(searchInput.value);
});
