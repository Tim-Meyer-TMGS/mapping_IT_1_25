/* TMGS Easter Eggs: Dog(Wandern) + Konami(90s Web Look)
   Usage: <script src="easteregg-two-eggs.js" defer></script>
   Disable: ?noegg=1 or <html data-disable-easteregg>
*/
(() => {
  const DISABLED = new URLSearchParams(location.search).has('noegg') ||
                   document.documentElement.hasAttribute('data-disable-easteregg');
  if (DISABLED) return;

  const KEYWORD = 'wandern'; // exact keyword trigger (case-insensitive)
  const onReady = (fn) => (document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn)
    : fn());

  // ========== Egg #A: Wandern-Hund (delegated listeners) ==========
  function wandernDogEgg() {
    const COOLDOWN_MS = 8000;
    const SPEED_MS = 4200;
    let lastRun = 0;

    injectStyle(`
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
    `, 'egg-dog-style');

    // Robust label check: innerText, aria-label, title (word-boundary around 'wandern')
    const hasWandernLabel = (el) => {
      if (!el) return false;
      const texts = [
        (el.getAttribute && el.getAttribute('aria-label')) || '',
        (el.getAttribute && el.getAttribute('title')) || '',
        (el.innerText || el.textContent || '')
      ].join(' ').toLowerCase();
      // word boundary around the keyword (avoid matching "wandernd", "Wanderroute" if undesired)
      return new RegExp(`\\b${KEYWORD}\\b`, 'i').test(texts);
    };

    const runDog = () => {
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

    // Event delegation to catch late-rendered navs/menus
    const maybeTrigger = (target) => {
      let el = target;
      let hops = 0;
      while (el && el !== document.body && hops < 6) {
        if (hasWandernLabel(el)) { runDog(); return; }
        el = el.parentElement;
        hops++;
      }
    };

    document.addEventListener('pointerover', (e) => maybeTrigger(e.target), { passive: true });
    document.addEventListener('focusin', (e) => maybeTrigger(e.target));
    document.addEventListener('touchstart', (e) => maybeTrigger(e.target), { passive: true });

    // Helper: find a hero/large image to run across
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

  // ========== Egg #B: Konami → 90s Web Look (toggle) ==========
  function konami90sEgg() {
    const SEQ = [38,38,40,40,37,39,37,39,66,65]; // ↑↑↓↓←→←→BA
    let buf = [];
    let on = false;

    injectStyle(`
      /* 90s web palette + link colors + beveled UI */
      html[data-retro90s] body {
        background:
          repeating-linear-gradient(45deg, #101c2b 0, #101c2b 12px, #0d1723 12px, #0d1723 24px),
          radial-gradient(1200px 600px at 10% -10%, rgba(0,255,195,.08), transparent 60%),
          radial-gradient(1200px 600px at 90% 110%, rgba(255,0,180,.08), transparent 60%);
        background-attachment: fixed, fixed, fixed;
      }
      html[data-retro90s] * {
        text-shadow: 0 0 1px rgba(0,255,180,.45);
      }
      html[data-retro90s] a { color: #00ffff !important; text-decoration: underline !important; cursor: crosshair; }
      html[data-retro90s] a:visited { color: #ff66ff !important; }
      html[data-retro90s] button, html[data-retro90s] .btn, html[data-retro90s] input[type="button"], html[data-retro90s] input[type="submit"] {
        border: 2px solid #d9e0ff; border-top-color:#fff; border-left-color:#fff;
        background: linear-gradient(#2b3f6b, #1a2542); color: #eaffff;
        box-shadow: inset 0 0 0 1px #0a1330, 0 2px 0 0 #000;
      }
      html[data-retro90s] img, html[data-retro90s] canvas, html[data-retro90s] video {
        image-rendering: pixelated;
      }
      /* marquee bar */
      #retro90s-marquee {
        position: fixed; top: 0; left: 0; right: 0; z-index: 10000; pointer-events: none;
        height: 34px; background: linear-gradient(90deg, #0f2244, #08305a);
        border-bottom: 2px solid #59ffc9;
        box-shadow: 0 4px 18px rgba(0,0,0,.4);
        display: flex; align-items: center; overflow: hidden;
        font-family: "Comic Sans MS", "Comic Sans", "Trebuchet MS", system-ui, sans-serif;
        color: #d4fff2; letter-spacing: .3px;
      }
      #retro90s-marquee b { color: #59ffc9; }
      #retro90s-marquee .line {
        white-space: nowrap; will-change: transform;
        animation: marquee-slide 14s linear infinite;
      }
      @keyframes marquee-slide {
        from { transform: translateX(100%); }
        to   { transform: translateX(-100%); }
      }
      @media (prefers-reduced-motion: reduce) {
        #retro90s-marquee .line { animation: none; position: absolute; left: 12px; }
      }
      /* sparkle cursor on body (subtle) */
      html[data-retro90s] body { cursor: default; }
    `, 'egg-retro90s-style');

    const onKey = (e) => {
      buf.push(e.keyCode);
      if (buf.length > SEQ.length) buf.shift();
      if (SEQ.every((c, i) => buf[i] === c)) {
        buf = [];
        on = !on;
        toggle90s(on);
        toast(on ? '90s MODE: ON — erneut Konami zum Beenden' : '90s MODE: OFF');
      }
    };
    document.addEventListener('keydown', onKey, { passive: true });

    function toggle90s(state) {
      if (state) {
        document.documentElement.setAttribute('data-retro90s', 'true');
        ensureMarquee();
      } else {
        document.documentElement.removeAttribute('data-retro90s');
        removeById('retro90s-marquee');
      }
    }

    function ensureMarquee() {
      if (document.getElementById('retro90s-marquee')) return;
      const bar = document.createElement('div');
      bar.id = 'retro90s-marquee';
      const line = document.createElement('div');
      line.className = 'line';
      line.innerHTML = `&nbsp;★ Willkommen im <b>90s-Mode</b>! &nbsp;|&nbsp; Viel Spaß beim Entdecken — drücke Konami nochmals zum Ausschalten. &nbsp;|&nbsp; <b>Under Construction</b> 😉 ★&nbsp;`;
      bar.appendChild(line);
      document.body.appendChild(bar);
      // add top padding to avoid overlap (non-invasive: only visual if page has fixed header)
      if (!document.documentElement.style.getPropertyValue('--egg-top-pad')) {
        const pad = '34px';
        document.documentElement.style.setProperty('--egg-top-pad', pad);
        // try not to shift layout: apply transform to main wrapper if fixed header exists; otherwise ignore
        const fixedHeader = document.querySelector('header') && getComputedStyle(document.querySelector('header')).position === 'fixed';
        if (!fixedHeader) document.body.style.scrollMarginTop = pad;
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
