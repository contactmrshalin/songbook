/* Songbook custom JS (theme imports this file) */

(() => {
  const STORAGE_KEY = "songbook:notationMode";
  const MODES = new Set(["indian", "western", "both"]);

  function getInitialMode() {
    const saved = (localStorage.getItem(STORAGE_KEY) || "").toLowerCase();
    if (MODES.has(saved)) return saved;
    return "indian";
  }

  function applyMode(mode) {
    if (!MODES.has(mode)) mode = "indian";
    const root = document.documentElement;
    root.classList.remove("notation--indian", "notation--western", "notation--both");
    root.classList.add(`notation--${mode}`);
    localStorage.setItem(STORAGE_KEY, mode);

    // mark active buttons
    document.querySelectorAll("button[data-notation-mode]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.getAttribute("data-notation-mode") === mode);
    });
  }

  function initNotationToggle() {
    applyMode(getInitialMode());
    document.addEventListener("click", (e) => {
      const btn = e.target && e.target.closest && e.target.closest("button[data-notation-mode]");
      if (!btn) return;
      const mode = (btn.getAttribute("data-notation-mode") || "").toLowerCase();
      applyMode(mode);
    });
  }

  function initSearch() {
    const input = document.querySelector("[data-songbook-search]");
    const cards = Array.from(document.querySelectorAll("[data-songbook-card]"));
    const countEl = document.querySelector("[data-songbook-count]");
    if (!input || cards.length === 0) return;

    function norm(s) {
      return (s || "").toLowerCase().trim();
    }

    function applyFilter() {
      const q = norm(input.value);
      let visible = 0;
      for (const el of cards) {
        const hay = norm(el.getAttribute("data-songbook-hay"));
        const show = !q || hay.includes(q);
        el.style.display = show ? "" : "none";
        if (show) visible++;
      }
      if (countEl) countEl.textContent = String(visible);
    }

    input.addEventListener("input", applyFilter);
    applyFilter();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      initNotationToggle();
      initSearch();
    });
  } else {
    initNotationToggle();
    initSearch();
  }
})();

