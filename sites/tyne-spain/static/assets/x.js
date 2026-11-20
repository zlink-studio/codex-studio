/* TYN-e España · site behaviour (homepage hero + all pages).
   Lightweight on purpose: one banner with cross-fading slides (no blurred aura, no
   stacked sticky cards), the light-curtain opening, word-rise headings, photo wipes and
   one parallax photo. Nav, reveal and the news slider stay with the global site.js. */
(() => {
  const root = document.querySelector('.x-page');
  const html = document.documentElement;
  const q = new URLSearchParams(location.search);
  const board = q.get('board');                 // desktop | mobile (review canvas)
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches || q.has('rm');
  const still = q.has('still');

  /* ---------- review / board mode ---------- */
  if (board || q.has('review')) root.classList.add('x-review');
  if (board) {
    root.classList.add('x-board');
    root.style.setProperty('--vh', board === 'mobile' ? '844px' : '900px');
    const report = () => parent.postMessage({ type: 'tyne-h', board, h: Math.ceil(root.getBoundingClientRect().height) }, '*');
    new ResizeObserver(report).observe(root);
    addEventListener('load', report);
  }

  /* header height → hero offset */
  const header = document.querySelector('.t-header');
  const setHdr = () => { if (header) root.style.setProperty('--hdr', Math.round(header.getBoundingClientRect().bottom) + 'px'); };
  setHdr(); addEventListener('resize', setHdr);

  const banner = root.querySelector('[data-banner]');
  let setPaused = () => {}, show = () => {}, endOpening = () => {}, playOpening = () => {}, anims = [];
  if (banner) {
  /* ---------- hero carousel (global rhythm: 7.2 s, cross-fade) ---------- */
  const DUR = 7200;
  const media = banner.querySelector('[data-carousel]');
  const slides = [...media.querySelectorAll('.x-slide')];
  const dots = [...banner.querySelectorAll('[data-dot]')];
  const ctrl = banner.querySelector('.x-ctrl');
  const pauseBtn = ctrl.querySelector('[data-pause]');
  const count = root.querySelector('[data-now-count]');
  let idx = 0, timer = null, paused = reduced || still;
  ctrl.style.setProperty('--dur', DUR + 'ms');

  show = function (n) {
    idx = (n + slides.length) % slides.length;
    slides.forEach((s, i) => {
      const on = i === idx;
      s.classList.toggle('is-on', on);
      if (on) s.removeAttribute('aria-hidden'); else s.setAttribute('aria-hidden', 'true');
      const a = s.querySelector('.x-copy a'); if (a) a.tabIndex = on ? 0 : -1;
    });
    dots.forEach((d, i) => { d.removeAttribute('aria-current'); if (i === idx) { void d.offsetWidth; d.setAttribute('aria-current', 'true'); } });
    count.textContent = `Destacados · 0${idx + 1} / 0${slides.length}`;
    schedule();
  }
  function schedule() { clearTimeout(timer); if (!paused) timer = setTimeout(() => show(idx + 1), DUR); }
  setPaused = function (p) {
    paused = p; ctrl.classList.toggle('paused', p);
    pauseBtn.setAttribute('aria-label', p ? 'Reanudar carrusel' : 'Pausar carrusel');
    if (p) clearTimeout(timer); else show(idx);
  }
  ctrl.querySelector('[data-prev]').addEventListener('click', () => show(idx - 1));
  ctrl.querySelector('[data-next]').addEventListener('click', () => show(idx + 1));
  dots.forEach(d => d.addEventListener('click', () => show(+d.dataset.dot)));
  pauseBtn.addEventListener('click', () => setPaused(!paused));
  media.addEventListener('keydown', e => { if (e.key === 'ArrowLeft') show(idx - 1); if (e.key === 'ArrowRight') show(idx + 1); });
  let sx = null;
  media.addEventListener('pointerdown', e => { if (!e.target.closest('a')) sx = e.clientX; });
  media.addEventListener('pointerup', e => { if (sx != null && Math.abs(e.clientX - sx) > 40) show(idx + (e.clientX < sx ? 1 : -1)); sx = null; });
  ctrl.classList.toggle('paused', paused);
  if (paused) pauseBtn.setAttribute('aria-label', 'Reanudar carrusel');
  show(0);

  /* ---------- opening: light curtain + logo landing on the nav logo, ~1 s ----------
     Switched on before first paint by the inline head script (class x-will-open). */
  const open = document.querySelector('.x-open');
  const logo = document.querySelector('.x-open-logo');
  endOpening = function () { anims.forEach(a => a.cancel()); anims = []; html.classList.remove('x-will-open'); }
  playOpening = function () {
    anims.forEach(a => a.cancel()); anims = [];
    html.classList.add('x-will-open');
    const L = logo.getBoundingClientRect();
    const nav = document.querySelector('.t-logo img').getBoundingClientRect();
    const dx = nav.left + nav.width / 2 - (L.left + L.width / 2);
    const dy = nav.top + nav.height / 2 - (L.top + L.height / 2);
    const k = nav.width / L.width;
    const T = 1000, ease = 'cubic-bezier(.7,0,.2,1)', base = 'translate(-50%,-50%)';
    const [l, r] = open.querySelectorAll('i'), seam = open.querySelector('b');
    const land = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${k})`;
    anims.push(logo.animate([
      { opacity: 0, transform: base + ' scale(.94)' },
      { opacity: 1, transform: base + ' scale(1)', offset: .25 },
      { opacity: 1, transform: base + ' scale(1)', offset: .4, easing: ease },
      { opacity: 1, transform: land, offset: .92 }, { opacity: 1, transform: land }
    ], { duration: T, fill: 'forwards' }));
    anims.push(seam.animate([
      { transform: 'scaleY(0)', opacity: 1 }, { transform: 'scaleY(1)', opacity: 1, offset: .3 },
      { transform: 'scaleY(1)', opacity: 1, offset: .42 }, { transform: 'scaleY(1)', opacity: 0, offset: .55 }, { opacity: 0 }
    ], { duration: T, easing: 'ease-out', fill: 'forwards' }));
    [[l, -1], [r, 1]].forEach(([el, s]) => anims.push(el.animate([
      { transform: 'translateX(0)' }, { transform: 'translateX(0)', offset: .4, easing: ease }, { transform: `translateX(${s * 101}%)` }
    ], { duration: T, fill: 'forwards' })));
    const copy = slides[idx].querySelector('.x-copy');
    anims.push(copy.animate([
      { opacity: 0, transform: 'translateY(18px)' }, { opacity: 0, transform: 'translateY(18px)', offset: .55 }, { opacity: 1, transform: 'none' }
    ], { duration: T, easing: 'cubic-bezier(.22,1,.36,1)' }));
    anims[0].onfinish = () => { html.classList.remove('x-will-open'); };
  }
  if (html.classList.contains('x-will-open')) playOpening();
  addEventListener('message', ev => {
    if (ev.data && ev.data.type === 'tyne-replay') { scrollTo(0, 0); show(0); if (!reduced) requestAnimationFrame(playOpening); }
  });

  }

  /* ---------- scroll motion: word rise (keeps <em>/<br>), photo wipe, parallax ---------- */
  if (!reduced) root.classList.add('x-motion');
  let wi = 0;
  function wrapWords(node) {
    [...node.childNodes].forEach(n => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach(part => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
          const w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
          const s = document.createElement('span'); s.style.setProperty('--wi', wi++); s.textContent = part;
          w.appendChild(s); frag.appendChild(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR') wrapWords(n);
    });
  }
  root.querySelectorAll('[data-words]').forEach(h => { h.setAttribute('aria-label', h.textContent.replace(/\s+/g, ' ').trim()); wi = 0; wrapWords(h); });
  const inTargets = root.querySelectorAll('[data-wipe],[data-words]');
  if (reduced || !('IntersectionObserver' in window)) inTargets.forEach(el => el.classList.add('is-in'));
  else {
    // a fully clipped element never "intersects", so watch its unclipped parent instead
    const owner = new Map();
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      (owner.get(e.target) || []).forEach(el => el.classList.add('is-in')); io.unobserve(e.target);
    }), { rootMargin: '0px 0px -10% 0px', threshold: .1 });
    inTargets.forEach(el => { const p = el.hasAttribute('data-wipe') ? el.parentElement : el; owner.set(p, [...(owner.get(p) || []), el]); io.observe(p); });
  }
  const px = [...root.querySelectorAll('[data-parallax]')];
  let ticking = false;
  function onScroll() {
    ticking = false;
    const vh = innerHeight;
    px.forEach(img => {
      const r = img.parentElement.getBoundingClientRect();
      if (r.bottom < -100 || r.top > vh + 100) return;
      img.style.setProperty('--py', (-((r.top + r.height / 2 - vh / 2) / vh) * r.height * .07).toFixed(1) + 'px');
    });
  }
  if (!reduced && !board && px.length) {
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();
  }

  /* ---------- anchors & nav buttons ---------- */
  function go(id) {
    const el = document.getElementById(id); if (!el) return;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', '#' + id);
  }
  document.addEventListener('click', ev => {
    const btn = ev.target.closest('[data-scroll-target]');
    if (btn) { ev.preventDefault(); go(btn.dataset.scrollTarget); return; }
    const a = ev.target.closest('a[href^="#"]');
    if (a && a.getAttribute('href').length > 1) { ev.preventDefault(); go(a.getAttribute('href').slice(1)); }
  });

  /* ---------- review helper for screenshots ---------- */
  window.TyneReview = {
    settle() {
      root.querySelectorAll('[data-reveal]').forEach(el => el.classList.add('t-revealed'));
      root.querySelectorAll('[data-wipe],[data-words]').forEach(el => el.classList.add('is-in'));
      setPaused(true); show(0); endOpening();
    },
    show, setPaused, playOpening, endOpening,
    openingAt(ms) { playOpening(); anims.forEach(a => { a.pause(); a.currentTime = ms; }); }
  };
})();
