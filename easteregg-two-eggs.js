/* TMGS Easter Eggs
   Eggs included:
   - Dog (Wandern-in-table-only): triggers when hovering a table cell containing the word "Wandern"
   - Konami (Windows 95 Style, no marquee): toggle via ↑↑↓↓←→←→ B A
   Usage: <script src="easteregg-two-eggs.js" defer></script>
   Disable entirely: add ?noegg=1 to URL or <html data-disable-easteregg>
*/
(() => {
  const DISABLED = new URLSearchParams(location.search).has('noegg') ||
                   document.documentElement.hasAttribute('data-disable-easteregg');
  if (DISABLED) return;

  const KEYWORD = 'wandern'; // standalone word match, case-insensitive
  const onReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn)
    : fn());

  // ========== Egg #A: Wandern-Hund (table cells only) ==========
  function wandernDogEgg() {
    // Config
    const SPEED_MS = 7000;        // slower for readability
    const MAX_RUNS = 1;           // only once per page impression
    const DIRECTION = 'ltr';      // 'ltr' or 'rtl'
    let runs = 0;

    injectStyle(`
      .egg-dog {
        position: fixed; z-index: 9999; left: -16vw;
        font-size: clamp(28px, 4.6vw, 56px); line-height: 1;
        pointer-events: none; user-select: none; white-space: nowrap;
        filter: drop-shadow(0 6px 14px rgba(0,0,0,.35));
      }
      .egg-dog.run-ltr { animation: egg-dog-run-ltr var(--dog-speed, 7s) linear forwards; }
      .egg-dog.run-rtl { right: -16vw; left: auto; animation: egg-dog-run-rtl var(--dog-speed, 7s) linear forwards; }
      .egg-dog .trail { opacity:.9; }
      .egg-dog .gap { display:inline-block; width:.2em; }
      @keyframes egg-dog-run-ltr {
        from { transform: translateX(-12vw); }
        to   { transform: translateX(112vw); }
      }
      @keyframes egg-dog-run-rtl {
        from { transform: translateX(12vw); }
        to   { transform: translateX(-112vw); }
      }
      @media (prefers-reduced-motion: reduce) {
        .egg-dog.run-ltr, .egg-dog.run-rtl {
          animation: egg-dog-fade var(--dog-speed, 4s) ease-in-out forwards; left: 50%; right: auto; transform: translateX(-50%);
        }
        @keyframes egg-dog-fade {
          0%{ opacity:0 } 10%{ opacity:1 } 90%{ opacity:1 } 100%{ opacity:0 }
        }
      }
    `, 'egg-dog-style');

    // Attach listeners only to table cells; do not modify the DOM (no tabindex)
    setupTableCellListeners();
    observeFutureTables();

    function setupTableCellListeners(ctx = document) {
      const cells = Array.from(ctx.querySelectorAll('table td, table th'));
      for (const cell of cells) {
        if (!cell.__eggDogBound) {
          cell.__eggDogBound = true;
          cell.addEventListener('pointerenter', onCellEnter, { passive: true });
        }
      }
    }

    function onCellEnter(e) {
      const cell = e.currentTarget;
      if (runs >= MAX_RUNS) return;
      if (!containsKeyword(cell)) return;
      runs++;

      const dir = DIRECTION;
      const dog = document.createElement('div');
      dog.className = 'egg-dog ' + (dir === 'rtl' ? 'run-rtl' : 'run-ltr');
      dog.style.setProperty('--dog-speed', `${SPEED_MS}ms`);

      // Place along Y near the hovered cell
      const rect = cell.getBoundingClientRect();
      const y = (window.scrollY + rect.top + Math.min(rect.height * 0.6, 180));
      dog.style.top = `${Math.max(16, Math.min(y, window.scrollY + innerHeight - 64))}px`;

      const dogEmoji = '🐕‍🦺';  // faces right on most platforms
      const trailEmoji = '💨';
      if (dir === 'rtl') {
        dog.innerHTML = `<span class="dog" aria-hidden="true" style="display:inline-block; transform: scaleX(-1)">${dogEmoji}</span><span class="gap"></span><span class="trail" aria-hidden="true">${trailEmoji}</span><span class="sr-only" style="position:absolute;left:-9999px">Hund läuft von rechts nach links</span>`;
      } else {
        dog.innerHTML = `<span class="trail" aria-hidden="true">${trailEmoji}</span><span class="gap"></span><span class="dog" aria-hidden="true">${dogEmoji}</span><span class="sr-only" style="position:absolute;left:-9999px">Hund läuft von links nach rechts</span>`;
      }

      document.body.appendChild(dog);
      setTimeout(() => dog.remove(), SPEED_MS + 300);
    }

    function containsKeyword(cell) {
      const text = (cell.innerText || cell.textContent || '').toLowerCase();
      return new RegExp(`\\b${KEYWORD}\\b`, 'i').test(text);
    }

    function observeFutureTables() {
      const mo = new MutationObserver((muts) => {
        for (const mut of muts) {
          for (const node of mut.addedNodes) {
            if (!(node instanceof Element)) continue;
            if (node.matches && (node.matches('table') || node.matches('table *'))) {
              setupTableCellListeners(node.matches('table') ? node : node.closest('table') || node);
            } else {
              const tables = node.querySelectorAll ? node.querySelectorAll('table') : [];
              tables.forEach(t => setupTableCellListeners(t));
            }
          }
        }
      });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  // ========== Egg #B: Konami → Windows 95 Style (toggle) ==========
  function konamiWin95Egg() {
    const SEQ = [38,38,40,40,37,39,37,39,66,65]; // ↑↑↓↓←→←→BA
    let buf = [];
    let on = false;

    injectStyle(`
      /* Windows 95-esque UI styling */
      html[data-win95] body {
        background-color: #008080; /* teal desktop */
        color: #000;
        font-family: "MS Sans Serif", Tahoma, Verdana, system-ui, sans-serif;
      }
      html[data-win95] a { color: #0000ee !important; }
      html[data-win95] a:visited { color: #551a8b !important; }

      /* 3D controls */
      html[data-win95] button,
      html[data-win95] input[type="button"],
      html[data-win95] input[type="submit"],
      html[data-win95] input[type="text"],
      html[data-win95] input[type="search"],
      html[data-win95] input[type="email"],
      html[data-win95] input[type="number"],
      html[data-win95] select,
      html[data-win95] textarea {
        background: #c0c0c0;
        color: #000;
        border: 2px solid;
        border-top-color: #ffffff;
        border-left-color: #ffffff;
        border-right-color: #808080;
        border-bottom-color: #808080;
        box-shadow: inset -1px -1px 0 #dfdfdf, inset 1px 1px 0 #000;
      }
      html[data-win95] button:active,
      html[data-win95] input[type="button"]:active,
      html[data-win95] input[type="submit"]:active {
        border-top-color: #808080;
        border-left-color: #808080;
        border-right-color: #ffffff;
        border-bottom-color: #ffffff;
        box-shadow: inset 1px 1px 0 #dfdfdf, inset -1px -1px 0 #000;
      }
      /* field look */
      html[data-win95] input[type="text"],
      html[data-win95] input[type="search"],
      html[data-win95] input[type="email"],
      html[data-win95] input[type="number"],
      html[data-win95] select,
      html[data-win95] textarea {
        padding: 2px 4px;
      }

      /* Title bar simulation on native headings */
      html[data-win95] h1, html[data-win95] h2, html[data-win95] .titlebar {
        background: linear-gradient(#000080, #000060);
        color: #ffffff;
        padding: 4px 8px;
        border: 2px solid;
        border-top-color: #ffffff;
        border-left-color: #ffffff;
        border-right-color: #000000;
        border-bottom-color: #000000;
        box-shadow: inset -1px -1px 0 #003, inset 1px 1px 0 #66a;
      }

      /* Taskbar overlay (visual only) */
      #win95-taskbar {
        position: fixed; left: 0; right: 0; bottom: 0; height: 34px;
        background: #c0c0c0; border-top: 2px solid #ffffff; z-index: 9999;
        box-shadow: inset 0 2px 0 #808080, inset 0 -1px 0 #000;
        display: flex; align-items: center; gap: 8px; padding: 4px; pointer-events: none;
      }
      #win95-start {
        pointer-events: none;
        display: inline-flex; align-items: center; gap: 6px;
        background: #c0c0c0; color: #000; padding: 2px 8px;
        border: 2px solid; border-top-color:#fff; border-left-color:#fff; border-right-color:#808080; border-bottom-color:#808080;
        box-shadow: inset -1px -1px 0 #dfdfdf, inset 1px 1px 0 #000;
        font-weight: 600;
      }
      #win95-clock {
        margin-left: auto; padding: 2px 8px; background:#c0c0c0;
        border: 2px solid; border-top-color:#fff; border-left-color:#fff; border-right-color:#808080; border-bottom-color:#808080;
        box-shadow: inset -1px -1px 0 #dfdfdf, inset 1px 1px 0 #000;
        min-width: 80px; text-align: center; font-variant-numeric: tabular-nums;
      }

      /* Window-like panels (generic) */
      html[data-win95] .card, html[data-win95] .panel, html[data-win95] .box {
        background: #c0c0c0 !important; color: #000 !important;
        border: 2px solid;
        border-top-color: #ffffff;
        border-left-color: #ffffff;
        border-right-color: #808080;
        border-bottom-color: #808080;
        box-shadow: inset -1px -1px 0 #dfdfdf, inset 1px 1px 0 #000;
      }

      /* Remove previous retro flags if any */
      html[data-retro90s] body { filter: none !important; }
    `, 'egg-win95-style');

    const onKey = (e) => {
      buf.push(e.keyCode);
      if (buf.length > SEQ.length) buf.shift();
      if (SEQ.every((c, i) => buf[i] === c)) {
        buf = [];
        on = !on;
        toggleWin95(on);
        toast(on ? 'Windows 95 MODE: ON — erneut Konami zum Beenden' : 'Windows 95 MODE: OFF');
      }
    };
    document.addEventListener('keydown', onKey, { passive: true });

    function toggleWin95(state) {
      if (state) {
        // ensure old retro is off
        document.documentElement.removeAttribute('data-retro90s');
        document.documentElement.setAttribute('data-win95', 'true');
        ensureTaskbar();
      } else {
        document.documentElement.removeAttribute('data-win95');
        removeById('win95-taskbar');
      }
    }

    function ensureTaskbar() {
      if (document.getElementById('win95-taskbar')) return;
      const bar = document.createElement('div'); bar.id = 'win95-taskbar';
      const start = document.createElement('div'); start.id = 'win95-start'; start.textContent = 'Start';
      const clock = document.createElement('div'); clock.id = 'win95-clock';
      bar.appendChild(start); bar.appendChild(clock);
      document.body.appendChild(bar);
      updateClock(clock); setInterval(() => updateClock(clock), 30000);
    }
    function updateClock(el) {
      const d = new Date();
      const h = String(d.getHours()).padStart(2,'0');
      const m = String(d.getMinutes()).padStart(2,'0');
      el.textContent = `${h}:${m}`;
    }

    function toast(msg) {
      const n = document.createElement('div');
      n.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:44px;z-index:10001;background:#c0c0c0;color:#000;border:2px solid;border-top-color:#fff;border-left-color:#fff;border-right-color:#808080;border-bottom-color:#808080;box-shadow:inset -1px -1px 0 #dfdfdf, inset 1px 1px 0 #000;border-radius:2px;padding:6px 10px;font-size:12px;font-family:"MS Sans Serif",Tahoma,Verdana,sans-serif';
      n.textContent = msg;
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 2400);
    }
  }

  // ---------- helpers ----------
  function injectStyle(cssText, id) {
    if (id && document.getElementById(id)) return;
    const s = document.createElement('style');
    if (id) s.id = id;
    s.textContent = cssText;
    document.head.appendChild(s);
  }
  function removeById(id) { const el = document.getElementById(id); if (el) el.remove(); }

  // ---------- boot ----------
  onReady(() => {
    try { wandernDogEgg(); } catch(e) { /* noop */ }
    try { konamiWin95Egg(); } catch(e) { /* noop */ }
  });
})();
