/* TMGS Easter Eggs
   Eggs included:
   - Dog (Wandern-in-table-only): triggers when hovering a table cell containing the word "Wandern"
   - Konami (Strong 90s CRT look, NO marquee): toggle via ↑↑↓↓←→←→ B A
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

  // ========== Egg #B: Konami → Strong 90s CRT Look (no marquee) ==========
  function konami90sEgg() {
    const SEQ = [38,38,40,40,37,39,37,39,66,65]; // ↑↑↓↓←→←→BA
    let buf = [];
    let on = false;

    injectStyle(`
      /* Strong CRT look: greenish tint, chromatic aberration, scanlines, vignette, flicker */
      html[data-retro90s] body {
        background-color: #060a0f;
        filter: saturate(1.35) contrast(1.25) hue-rotate(125deg) brightness(0.95);
        color-scheme: dark;
      }
      html[data-retro90s] * {
        text-shadow:
          0 0 6px rgba(0,255,170,.75),
          1px 0 0 rgba(255,60,80,.45),
          -1px 0 0 rgba(0,120,255,.45);
        letter-spacing: .2px;
      }
      html[data-retro90s] a { color: #7fffd4 !important; text-decoration: underline !important; cursor: crosshair; }
      html[data-retro90s] img, html[data-retro90s] canvas, html[data-retro90s] video { image-rendering: pixelated; }
      html[data-retro90s] code, html[data-retro90s] pre, html[data-retro90s] kbd, html[data-retro90s] samp {
        background: rgba(0, 30, 25, .6); border: 1px solid rgba(95, 255, 210, .35); padding: .15em .35em; border-radius: 3px;
      }

      /* Overlays */
      #crt-scan, #crt-vignette, #crt-flicker {
        position: fixed; inset: 0; pointer-events: none; z-index: 10000;
      }
      #crt-scan {
        background: repeating-linear-gradient(
          to bottom,
          rgba(255,255,255,.04) 0px,
          rgba(255,255,255,.04) 1px,
          rgba(0,0,0,0) 3px,
          rgba(0,0,0,0) 4px
        );
        mix-blend-mode: multiply;
        animation: scan-opacity 6s linear infinite;
      }
      @keyframes scan-opacity {
        0% { opacity:.18; }
        50% { opacity:.33; }
        100% { opacity:.18; }
      }
      #crt-vignette {
        background:
          radial-gradient(80% 70% at 50% 50%, rgba(0,0,0,0) 60%, rgba(0,0,0,.35) 85%, rgba(0,0,0,.55) 100%);
        mix-blend-mode: multiply;
      }
      #crt-flicker {
        background: radial-gradient(40% 20% at 50% 0%, rgba(255,255,255,.06), rgba(0,0,0,0) 70%);
        animation: flicker 1.7s steps(2, start) infinite;
        opacity: .25;
      }
      @keyframes flicker {
        0% { opacity: .18; } 50% { opacity: .32; } 100% { opacity: .18; }
      }

      /* Slight perspective (optional) */
      html[data-retro90s] body {
        transform: perspective(1200px) translateZ(0) scale(1) skewX(0deg);
      }

      /* Chunky focus ring */
      html[data-retro90s] :focus {
        outline: 2px dashed #59ffc9 !important;
        outline-offset: 2px;
      }
    `, 'egg-retro90s-style');

    const onKey = (e) => {
      buf.push(e.keyCode);
      if (buf.length > SEQ.length) buf.shift();
      if (SEQ.every((c, i) => buf[i] === c)) {
        buf = [];
        on = !on;
        toggle90s(on);
        toast(on ? '90s CRT MODE: ON — erneut Konami zum Beenden' : '90s CRT MODE: OFF');
      }
    };
    document.addEventListener('keydown', onKey, { passive: true });

    function toggle90s(state) {
      if (state) {
        document.documentElement.setAttribute('data-retro90s', 'true');
        ensureOverlays();
      } else {
        document.documentElement.removeAttribute('data-retro90s');
        removeById('crt-scan'); removeById('crt-vignette'); removeById('crt-flicker');
      }
    }

    function ensureOverlays() {
      if (!document.getElementById('crt-scan')) {
        const s = document.createElement('div'); s.id = 'crt-scan'; document.body.appendChild(s);
      }
      if (!document.getElementById('crt-vignette')) {
        const v = document.createElement('div'); v.id = 'crt-vignette'; document.body.appendChild(v);
      }
      if (!document.getElementById('crt-flicker')) {
        const f = document.createElement('div'); f.id = 'crt-flicker'; document.body.appendChild(f);
      }
    }

    function toast(msg) {
      const n = document.createElement('div');
      n.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:18px;z-index:10001;background:#0c1410;color:#d9ffe6;border:1px solid #1e3b2b;border-radius:999px;padding:8px 12px;font-size:12px;box-shadow:0 8px 30px rgba(0,0,0,.35)';
      n.textContent = msg;
      document.body.appendChild(n);
      setTimeout(() => n.remove(), 2600);
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
    try { konami90sEgg(); } catch(e) { /* noop */ }
  });
})();
