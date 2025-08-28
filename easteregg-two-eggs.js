/* TMGS Easter Eggs: Only #Dog(Wandern) + #Konami(Retro)
   Usage: <script src="easteregg-two-eggs.js" defer></script>
   Disable: add ?noegg=1 to URL or <html data-disable-easteregg>
   Scope: Non-intrusive; no edits to existing markup.
*/
(() => {
  const DISABLED = new URLSearchParams(location.search).has('noegg') ||
                   document.documentElement.hasAttribute('data-disable-easteregg');
  if (DISABLED) return;

  const onReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn)
    : fn());

  // ---------- Egg #A: Wandern-Hund (runs across the screen on hover/focus of "Wandern") ----------
  function wandernDogEgg() {
    const COOLDOWN_MS = 8000;   // prevent spam
    const SPEED_MS = 4200;      // run duration
    let lastRun = 0;

    // Styles
    const css = `
      .egg-dog {
        position: fixed; z-index: 9999; left: -14vw;
        font-size: clamp(24px, 4vw, 48px); line-height: 1;
        pointer-events: none; user-select: none; white-space: nowrap;
        filter: drop-shadow(0 6px 14px rgba(0,0,0,.35));
        animation: egg-dog-run var(--dog-speed, 4.2s) linear forwards;
      }
      .egg-dog .trail { opacity:.9; margin-left:.1em }
      @keyframes egg-dog-run {
        from { transform: translateX(-12vw); }
        to   { transform: translateX(112vw); }
      }
      @media (prefers-reduced-motion: reduce) {
        .egg-dog { animation: egg-dog-fade var(--dog-speed, 3s) ease-in-out forwards; left: 50%; transform: translateX(-50%); }
        @keyframes egg-dog-fade {
          0%{ opacity:0 } 10%{ opacity:1 } 90%{ opacity:1 } 100%{ opacity:0 }
        }
      }
    `;
    injectStyle(css, 'egg-dog-style');

    // Find elements that contain the keyword "Wandern" (case-insensitive)
    const candidates = Array.from(document.querySelectorAll('a, button, [role="link"], [data-nav], nav a, h1, h2, h3, .menu a, .nav a, .tabs a, .chip, .tag'))
      .filter(el => /(^|\s)wandern(\s|$)/i.test((el.textContent || '').trim()) || /wandern/i.test((el.getAttribute('aria-label')||'')));

    if (candidates.length === 0) return;

    const trigger = () => {
      const now = Date.now();
      if (now - lastRun < COOLDOWN_MS) return;
      lastRun = now;

      const hero = pickHero();
      const y = hero ? (hero.getBoundingClientRect().top + Math.min(hero.clientHeight*0.3, 240)) + window.scrollY
                     : window.scrollY + innerHeight * 0.7;

      const dog = document.createElement('div');
      dog.className = 'egg-dog';
      dog.style.setProperty('--dog-speed', `${SPEED_MS}ms`);
      dog.style.top = `${Math.max(16, Math.min(y, window.scrollY + innerHeight - 64))}px`;
      dog.innerHTML = `<span class="dog" aria-hidden="true">🐕‍🦺</span><span class="trail" aria-hidden="true">💨</span><span class="sr-only" style="position:absolute;left:-9999px">Hund läuft durchs Bild</span>`;
      document.body.appendChild(dog);
      setTimeout(() => dog.remove(), SPEED_MS + 300);
    };

    for (const el of candidates) {
      el.addEventListener('mouseenter', trigger);
      el.addEventListener('focusin', trigger);
      el.addEventListener('touchstart', trigger, { passive: true });
    }

    function pickHero() {
      const sels = [
        'header .hero, .hero, .stage, .banner, .lead, .cover',
        'main img[alt*="Wander" i], .gallery img, figure img',
        'header img, .teaser img'
      ];
      for (const sel of sels) {
        const els = Array.from(document.querySelectorAll(sel)).filter(inView);
        if (els.length) return els[0];
      }
      const imgs = Array.from(document.images).filter(inView).sort((a,b)=> (b.clientWidth*b.clientHeight)-(a.clientWidth*a.clientHeight));
      return imgs[0] || null;
    }
    function inView(node) {
      const r = node.getBoundingClientRect();
      return r.width*r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    }
  }

  // ---------- Egg #B: Konami → Retro Look (CRT/Pixel vibe) ----------
  function konamiRetroEgg() {
    const SEQ = [38,38,40,40,37,39,37,39,66,65]; // ↑↑↓↓←→←→BA
    let buf = [];
    let retroOn = false;

    // Inject base styles once
    injectStyle(`
      /* Retro palette + monospace + scanlines */
      html[data-retro] {
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      }
      html[data-retro] body {
        filter: contrast(1.2) saturate(0.9) sepia(0.25) hue-rotate(70deg) brightness(0.95);
      }
      html[data-retro] * {
        text-shadow: 0 0 1px rgba(90,255,150,.55);
      }
      #crt-overlay {
        position: fixed; inset: 0; pointer-events: none; z-index: 9998;
        background:
          radial-gradient(ellipse at center, rgba(0,0,0,.15) 0%, rgba(0,0,0,.35) 70%, rgba(0,0,0,.55) 100%);
        mix-blend-mode: multiply;
      }
      #crt-scan {
        position: fixed; inset: 0; pointer-events: none; z-index: 9999;
        background: repeating-linear-gradient(
          to bottom,
          rgba(255,255,255,.03) 0px,
          rgba(255,255,255,.03) 1px,
          rgba(0,0,0,0) 3px,
          rgba(0,0,0,0) 4px
        );
        animation: scan-move 6s linear infinite;
      }
      @keyframes scan-move {
        0% { opacity:.2; }
        50% { opacity:.35; }
        100% { opacity:.2; }
      }
      @media (prefers-reduced-motion: reduce) {
        #crt-scan { animation: none; opacity:.25; }
      }
      .retro-toast {
        position: fixed; left: 50%; transform: translateX(-50%);
        bottom: 18px; z-index: 10000;
        background: #0c1410; color: #d9ffe6; border: 1px solid #1e3b2b;
        border-radius: 999px; padding: 8px 12px; font-size: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,.35);
      }
    `, 'egg-retro-style');

    const onKey = (e) => {
      buf.push(e.keyCode);
      if (buf.length > SEQ.length) buf.shift();
      if (SEQ.every((c, i) => buf[i] === c)) {
        buf = [];
        retroOn = !retroOn;
        toggleRetro(retroOn);
        toast(retroOn ? 'RETRO MODE: ON (Konami erneut zum Ausschalten)' : 'RETRO MODE: OFF');
      }
    };
    document.addEventListener('keydown', onKey, { passive: true });

    function toggleRetro(on) {
      if (on) {
        document.documentElement.setAttribute('data-retro', 'true');
        ensureOverlay();
      } else {
        document.documentElement.removeAttribute('data-retro');
        removeById('crt-overlay'); removeById('crt-scan');
      }
    }
    function ensureOverlay() {
      if (!document.getElementById('crt-overlay')) {
        const o = document.createElement('div'); o.id = 'crt-overlay'; document.body.appendChild(o);
      }
      if (!document.getElementById('crt-scan')) {
        const s = document.createElement('div'); s.id = 'crt-scan'; document.body.appendChild(s);
      }
    }
    function toast(msg) {
      const n = document.createElement('div');
      n.className = 'retro-toast'; n.textContent = msg;
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
    try { wandernDogEgg(); } catch {}
    try { konamiRetroEgg(); } catch {}
  });
})();