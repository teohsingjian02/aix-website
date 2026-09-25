/* =====================================================================
   AIX — Artificial Intelligence Transformation Centre
   Interactions for the single-page site (no dependencies)
   ===================================================================== */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const pad = n => String(n).padStart(2, '0');

  /* ---------- Smooth scrolling ----------
     Driven by JS (not CSS scroll-behavior) because Chrome/Edge on Windows turn
     native smooth scrolling off when the OS "Animation effects" setting is off. */
  let scrollAnim = 0;
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function smoothScrollTo(y) {
    cancelAnimationFrame(scrollAnim);
    const start = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const dist = Math.max(0, Math.min(max, y)) - start;
    if (Math.abs(dist) < 2) return;
    const duration = Math.min(1300, Math.max(600, Math.abs(dist) * 0.4));
    const t0 = performance.now();
    const step = now => {
      const p = Math.min(1, (now - t0) / duration);
      window.scrollTo({ top: start + dist * easeInOutCubic(p), behavior: 'instant' });
      if (p < 1) scrollAnim = requestAnimationFrame(step);
    };
    scrollAnim = requestAnimationFrame(step);
  }
  // where an element should land: below the fixed header, or centred in the viewport
  function targetY(el, block = 'start') {
    const r = el.getBoundingClientRect();
    if (block === 'center') return window.scrollY + r.top - (window.innerHeight - r.height) / 2;
    return window.scrollY + r.top - (parseFloat(getComputedStyle(el).scrollMarginTop) || 0);
  }

  function initSmoothLinks() {
    // the user taking over (wheel / touch / keys) cancels an animation in progress
    ['wheel', 'touchstart', 'keydown'].forEach(ev => window.addEventListener(ev, () => cancelAnimationFrame(scrollAnim), { passive: true }));
    document.addEventListener('click', e => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      const el = id && document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      smoothScrollTo(id === 'home' ? 0 : targetY(el));
      history.pushState(null, '', '#' + id);
      // move keyboard focus to the section without a second jump
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    });
  }

  /* ---------- Boot screen ---------- */
  function initPreloader() {
    const el = $('.preloader');
    if (!el) return;
    const done = () => el.classList.add('is-done');
    const minTime = new Promise(r => setTimeout(r, 900));
    const loaded = new Promise(r => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
    Promise.race([Promise.all([minTime, loaded]), new Promise(r => setTimeout(r, 2600))]).then(done);
  }

  /* ---------- Navigation: scrolled state, mobile menu, progress, scroll-spy ---------- */
  function initNav() {
    const header = $('.site-header');
    const nav = $('.nav');
    const toggle = $('.nav__toggle');
    const links = $$('.nav__menu a');
    const progress = $('.scroll-progress span');
    const toTop = $('.to-top');

    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 40);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
      toTop.classList.toggle('is-visible', y > window.innerHeight * 0.8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    const setOpen = open => {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.sr-only').textContent = open ? 'Close menu' : 'Open menu';
    };
    toggle.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    links.forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
    document.addEventListener('click', e => { if (!nav.contains(e.target)) setOpen(false); });

    // Scroll-spy: highlight the menu item for the section in view
    const byKey = Object.fromEntries(links.map(a => [a.dataset.nav, a]));
    const sections = $$('[data-spy]');
    const visible = new Map();
    const spy = new IntersectionObserver(entries => {
      entries.forEach(en => visible.set(en.target, en.isIntersecting ? en.intersectionRatio : 0));
      let best = null, bestRatio = 0;
      visible.forEach((ratio, sec) => { if (ratio > bestRatio) { best = sec; bestRatio = ratio; } });
      links.forEach(a => a.classList.remove('is-active'));
      if (best && byKey[best.dataset.spy]) byKey[best.dataset.spy].classList.add('is-active');
    }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.01, 0.5, 1] });
    sections.forEach(s => spy.observe(s));
  }

  /* ---------- Hero: neural-network particle field ---------- */
  function initNetwork() {
    const canvas = $('.hero__network');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const hero = canvas.closest('.hero');
    const COLORS = ['63,224,255', '61,139,255', '255,49,49'];
    let w = 0, h = 0, nodes = [], raf = 0, running = false;
    const mouse = { x: -9999, y: -9999 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(120, Math.max(36, (w * h) / 13000)));
      nodes = Array.from({ length: count }, () => {
        const r = Math.random();
        return {
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
          size: Math.random() * 1.6 + 0.7,
          c: r < 0.1 ? COLORS[2] : r < 0.55 ? COLORS[0] : COLORS[1],
          phase: Math.random() * Math.PI * 2,
        };
      });
    };

    const LINK = 135, MOUSE_LINK = 190;
    const draw = (t = 0) => {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) { const f = 0.6 / Math.max(Math.sqrt(d2), 20); n.x += dx * f; n.y += dy * f; }
      }
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(${a.c},${(1 - d / LINK) * 0.35})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < MOUSE_LINK) {
          ctx.strokeStyle = `rgba(63,224,255,${(1 - md / MOUSE_LINK) * 0.6})`;
          ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke();
        }
      }
      for (const n of nodes) {
        const glow = 0.55 + 0.45 * Math.sin(t / 700 + n.phase);
        ctx.fillStyle = `rgba(${n.c},${0.5 + glow * 0.5})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.size + glow * 0.6, 0, Math.PI * 2); ctx.fill();
      }
    };

    const loop = t => { draw(t); raf = requestAnimationFrame(loop); };
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(loop); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };

    resize();
    draw();
    let resizeTimer;
    window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); draw(); }, 150); });
    hero.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
    hero.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    new IntersectionObserver(([en]) => (en.isIntersecting ? start() : stop())).observe(hero);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  /* ---------- Hero title: decode / scramble effect ---------- */
  function initScramble() {
    const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/#%&*';
    $$('[data-scramble]').forEach((line, li) => {
      // Scramble only text nodes so inner markup (e.g. the gradient "(AIX)") is preserved
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) texts.push({ node: walker.currentNode, final: walker.currentNode.textContent });
      const total = texts.reduce((s, t) => s + t.final.length, 0);
      const duration = 1100, delay = 350 + li * 220;
      let startTime = null;
      const frame = now => {
        if (startTime === null) startTime = now;
        const p = Math.min(1, (now - startTime - delay) / duration);
        if (p < 0) { texts.forEach(t => (t.node.textContent = t.final.replace(/\S/g, ' '))); return requestAnimationFrame(frame); }
        const revealed = Math.floor(p * total);
        let idx = 0;
        texts.forEach(t => {
          t.node.textContent = [...t.final].map(ch => {
            const k = idx++;
            if (ch === ' ' || k < revealed) return ch;
            return k < revealed + 6 ? GLYPHS[(Math.random() * GLYPHS.length) | 0] : ' ';
          }).join('');
        });
        if (p < 1) requestAnimationFrame(frame);
        else texts.forEach(t => (t.node.textContent = t.final));
      };
      requestAnimationFrame(frame);
    });
  }

  /* ---------- Reveal on scroll ---------- */
  function initReveal() {
    const items = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) { items.forEach(i => i.classList.add('is-visible')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach(i => io.observe(i));
  }

  /* ---------- Animated counters ---------- */
  function initCounters() {
    const els = $$('[data-count]');
    const run = el => {
      const target = +el.dataset.count;
      const t0 = performance.now(), dur = 1400;
      const tick = now => {
        const p = Math.min(1, (now - t0) / dur);
        el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      };
      el.textContent = '0';
      requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    els.forEach(el => io.observe(el));
  }

  /* ---------- Laboratories carousel ---------- */
  function initLabSlider() {
    const root = $('[data-slider]');
    if (!root) return;
    const slides = $$('.lab-slide', root);
    const track = $('.lab-track', root);
    const dotsWrap = $('[data-lab-dots]', root);
    const indexWrap = $('[data-lab-index]', root);
    const current = $('[data-lab-current]', root);
    const bar = $('[data-lab-progress]', root);
    const pauseBtn = $('[data-lab-pause]', root);
    const stage = $('.lab-stage', root);
    const DURATION = 7000;
    let i = 0, elapsed = 0, last = 0, userPaused = false, hoverPaused = false, inView = false;

    // Blurred backdrop for wide, composite images so they are shown whole
    slides.filter(s => s.dataset.fit === 'contain').forEach(s => {
      const img = $('.lab-slide__media img', s);
      const blur = img.cloneNode();
      blur.className = 'lab-slide__blur'; blur.alt = ''; blur.setAttribute('aria-hidden', 'true');
      img.before(blur);
    });

    // Build dots + photo-card list from the slide markup
    const PIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
    const dots = [], chips = [];
    slides.forEach((s, n) => {
      const name = $('.lab-slide__name', s).textContent.trim();
      const site = $('.lab-slide__site', s).textContent.trim();
      const dot = document.createElement('button');
      dot.type = 'button'; dot.className = 'lab-dot';
      dot.setAttribute('aria-label', `Show lab ${n + 1}: ${name}`);
      dot.addEventListener('click', () => go(n, true));
      dotsWrap.append(dot); dots.push(dot);

      const li = document.createElement('li');
      const chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'lab-card';
      chip.setAttribute('aria-label', `${name}, ${site}`);
      chip.innerHTML = `<span class="lab-card__img"><img alt="" width="480" height="300" loading="lazy"><span class="lab-card__no">${pad(n + 1)}</span></span>` +
        `<span class="lab-card__text"><span class="lab-card__name"></span><span class="lab-card__site">${PIN}</span></span>`;
      chip.querySelector('img').src = s.dataset.thumb;
      chip.querySelector('.lab-card__name').textContent = name;
      chip.querySelector('.lab-card__site').append(site);
      chip.addEventListener('click', () => { go(n, true); smoothScrollTo(targetY(stage, 'center')); });
      li.append(chip); indexWrap.append(li); chips.push(chip);
    });

    function go(n, fromUser = false) {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => {
        const active = k === i;
        s.classList.toggle('is-active', active);
        s.setAttribute('aria-hidden', String(!active));
        s.inert = !active;
        if (active) $$('img', s).forEach(img => (img.loading = 'eager'));
      });
      dots.forEach((d, k) => d.setAttribute('aria-current', String(k === i)));
      chips.forEach((c, k) => c.setAttribute('aria-current', String(k === i)));
      current.textContent = pad(i + 1);
      // on phones the card list is a horizontal strip: keep the active card in view
      if (indexWrap.scrollWidth > indexWrap.clientWidth + 4) {
        const c = chips[i].parentElement;
        indexWrap.scrollTo({ left: c.offsetLeft - indexWrap.offsetLeft - 16, behavior: 'smooth' });
      }
      elapsed = 0; bar.style.transform = 'scaleX(0)';
      track.setAttribute('aria-live', fromUser ? 'polite' : 'off');
      // warm up the next image
      const next = slides[(i + 1) % slides.length];
      $$('img', next).forEach(img => (img.loading = 'eager'));
    }

    const paused = () => userPaused || hoverPaused || !inView || document.hidden;
    const tick = now => {
      const dt = last ? now - last : 0; last = now;
      if (!paused()) {
        elapsed += dt;
        bar.style.transform = `scaleX(${Math.min(1, elapsed / DURATION)})`;
        if (elapsed >= DURATION) go(i + 1);
      }
      requestAnimationFrame(tick);
    };

    $('[data-lab-prev]', root).addEventListener('click', () => go(i - 1, true));
    $('[data-lab-next]', root).addEventListener('click', () => go(i + 1, true));
    const syncPause = () => {
      pauseBtn.classList.toggle('is-paused', userPaused);
      pauseBtn.setAttribute('aria-label', userPaused ? 'Play automatic slide show' : 'Pause automatic slide show');
    };
    pauseBtn.addEventListener('click', () => { userPaused = !userPaused; syncPause(); });
    stage.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hoverPaused = true; });
    stage.addEventListener('pointerleave', () => { hoverPaused = false; });
    root.addEventListener('focusin', () => { hoverPaused = true; });
    root.addEventListener('focusout', () => { hoverPaused = false; });
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1, true); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1, true); }
    });

    // Swipe
    let sx = null, sy = null;
    stage.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { sx = e.clientX; sy = e.clientY; } });
    stage.addEventListener('pointerup', e => {
      if (sx === null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) go(i + (dx < 0 ? 1 : -1), true);
      sx = sy = null;
    });

    new IntersectionObserver(([en]) => { inView = en.isIntersecting; }, { threshold: 0.35 }).observe(stage);
    syncPause();
    go(0);
    requestAnimationFrame(tick);
  }

  /* ---------- Collaboration ecosystem: animated links from hub to nodes ---------- */
  function initEcosystem() {
    const eco = $('[data-eco]');
    if (!eco) return;
    const svg = $('[data-eco-links]', eco);
    const core = $('[data-eco-core]', eco);
    const nodes = $$('.eco__node', eco);
    const NS = 'http://www.w3.org/2000/svg';

    const draw = () => {
      svg.innerHTML = '';
      if (getComputedStyle(svg).display === 'none') return;
      const box = eco.getBoundingClientRect();
      const c = core.getBoundingClientRect();
      const cx = c.left + c.width / 2 - box.left, cy = c.top + c.height / 2 - box.top;
      svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
      nodes.forEach((node, k) => {
        const r = node.getBoundingClientRect();
        const nx = r.left + r.width / 2 - box.left, ny = r.top + r.height / 2 - box.top;
        // attach to the node edge that faces the hub
        let tx = nx, ty = ny;
        if (Math.abs(nx - cx) > r.width / 2) tx = nx < cx ? r.right - box.left : r.left - box.left;
        else ty = r.top - box.top;
        const mx = (cx + tx) / 2;
        const d = Math.abs(nx - cx) > r.width / 2
          ? `M${cx},${cy} C${mx},${cy} ${mx},${ty} ${tx},${ty}`
          : `M${cx},${cy} L${tx},${ty}`;
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('d', d);
        svg.append(path);
        const dot = document.createElementNS(NS, 'circle');
        dot.setAttribute('r', '3.2');
        const anim = document.createElementNS(NS, 'animateMotion');
        anim.setAttribute('dur', `${2.4 + k * 0.35}s`);
        anim.setAttribute('repeatCount', 'indefinite');
        anim.setAttribute('path', d);
        dot.append(anim); svg.append(dot);
      });
    };
    let t;
    const schedule = () => { clearTimeout(t); t = setTimeout(draw, 120); };
    new ResizeObserver(schedule).observe(eco);
    window.addEventListener('load', draw);
    if (document.fonts) document.fonts.ready.then(draw);
    // nodes animate in (translate) — redraw once they settle
    nodes.forEach(n => n.addEventListener('transitionend', schedule));
  }

  /* ---------- Misc ---------- */
  function initYear() {
    const y = $('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initPreloader();
    initSmoothLinks();
    initNav();
    initNetwork();
    initScramble();
    initReveal();
    initCounters();
    initLabSlider();
    initEcosystem();
    initYear();
  });
})();
