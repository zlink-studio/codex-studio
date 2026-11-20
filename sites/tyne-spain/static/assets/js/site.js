/*
 * TYN-e Global — interactions (vanilla JS port of the approved React version).
 * Header (hide on scroll, dropdowns, country selector, mobile menu), theme toggle,
 * hero carousel, film zoom, stacking vehicle cards, reveal-on-scroll, production index,
 * market map and news slider.
 */
(function () {
  'use strict';

  var root = document.querySelector('.t-site');
  if (!root) return;
  var I18N = (window.TYNE && window.TYNE.i18n) || {};
  function t(key, fallback) { return I18N[key] || fallback; }
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = function () { return window.matchMedia('(hover: hover)').matches; };
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };
  var clamp = function (v) { return Math.max(0, Math.min(1, v)); };
  var cfg = window.TYNE || {};

  /* ---------- Theme (light default, stored per device) ---------- */
  var themeBtn = $('[data-theme-toggle]');
  function currentTheme() { return root.classList.contains('t-darkTheme') ? 'dark' : 'light'; }
  function applyTheme(theme) {
    root.classList.toggle('t-darkTheme', theme === 'dark');
    root.classList.toggle('t-lightTheme', theme !== 'dark');
    root.setAttribute('data-theme', theme);
    if (themeBtn) {
      themeBtn.setAttribute('aria-label', theme === 'dark' ? t('toLight', 'Switch to light theme') : t('toDark', 'Switch to dark theme'));
      themeBtn.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
      themeBtn.setAttribute('title', theme === 'dark' ? t('lightTheme', 'Light theme') : t('darkTheme', 'Dark theme'));
    }
    var mapBase = $('[data-map-base]');
    if (mapBase && cfg.mapLight) mapBase.src = theme === 'light' ? cfg.mapLight : cfg.mapDark;
  }
  applyTheme(currentTheme());
  if (themeBtn) themeBtn.addEventListener('click', function () {
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('tyne-theme-v3', next); } catch (e) { /* optional */ }
    applyTheme(next);
  });

  /* ---------- Header & panels ---------- */
  var header = $('[data-header]');
  var megaPanels = $$('[data-mega-panel]');
  var marketPanel = $('[data-market-panel]');
  var menuPanel = $('[data-menu-panel]');
  var marketToggle = $('[data-market-toggle]');
  var langPanel = $('[data-lang-panel]');
  var langToggle = $('[data-lang-toggle]');
  var vehiclesToggle = $('[data-vehicles-toggle]');
  var menuToggle = $('[data-menu-toggle]');
  var state = { mega: null, market: false, menu: false, lang: false };

  function render() {
    megaPanels.forEach(function (panel) { panel.hidden = panel.getAttribute('data-mega-panel') !== state.mega; });
    $$('[data-mega-toggle]').forEach(function (btn) { btn.setAttribute('aria-expanded', btn.getAttribute('data-mega-toggle') === state.mega ? 'true' : 'false'); });
    if (marketPanel) marketPanel.hidden = !state.market;
    if (langPanel) langPanel.hidden = !state.lang;
    if (langToggle) langToggle.setAttribute('aria-expanded', state.lang ? 'true' : 'false');
    if (menuPanel) menuPanel.hidden = !state.menu;
    if (marketToggle) marketToggle.setAttribute('aria-expanded', state.market ? 'true' : 'false');
    if (vehiclesToggle) vehiclesToggle.setAttribute('aria-expanded', state.market ? 'true' : 'false');
    if (menuToggle) menuToggle.setAttribute('aria-expanded', state.menu ? 'true' : 'false');
    if (state.mega || state.market || state.menu || state.lang) showHeader(true);
  }
  function showHeader(visible) { if (header) header.classList.toggle('t-headerHidden', !visible); }
  function closePanels() { state.mega = null; state.market = false; state.menu = false; state.lang = false; showHeader(true); render(); }
  function openCountries() { state.mega = null; state.menu = false; state.lang = false; state.market = true; showHeader(true); render(); }
  function openLanguages() { state.mega = null; state.menu = false; state.market = false; state.lang = true; showHeader(true); render(); }

  $$('[data-href]').forEach(function (btn) { btn.addEventListener('click', function () { window.location.href = btn.getAttribute('data-href'); }); });
  $$('[data-mega-item]').forEach(function (item) {
    item.addEventListener('mouseenter', function () {
      if (!canHover()) return;
      state.market = false; state.lang = false; state.mega = item.getAttribute('data-mega-item'); render();
    });
  });
  $$('[data-mega-none]').forEach(function (item) { item.addEventListener('mouseenter', function () { if (state.mega) { state.mega = null; render(); } }); });
  $$('[data-mega-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var key = btn.getAttribute('data-mega-toggle');
      state.mega = state.mega === key ? null : key; state.market = false; state.lang = false; render();
    });
  });
  if (header) header.addEventListener('mouseleave', function () { if (canHover() && state.mega) { state.mega = null; render(); } });
  if (marketToggle) marketToggle.addEventListener('click', function () { state.market = !state.market; state.mega = null; state.lang = false; render(); });
  if (langToggle) langToggle.addEventListener('click', function () { var open = !state.lang; closePanels(); state.lang = open; render(); });
  if (vehiclesToggle) vehiclesToggle.addEventListener('click', function () { if (state.market) closePanels(); else openCountries(); });
  if (menuToggle) menuToggle.addEventListener('click', function () { state.menu = !state.menu; render(); });
  document.addEventListener('click', function (event) {
    var opener = event.target.closest('[data-open-countries]');
    if (opener) { event.preventDefault(); openCountries(); return; }
    if (event.target.closest('[data-open-languages]')) { event.preventDefault(); openLanguages(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    if (event.target.closest('[data-close-panels]')) closePanels();
  });
  window.addEventListener('keydown', function (event) { if (event.key === 'Escape') closePanels(); });

  /* ---------- Scroll-driven effects ---------- */
  var nav = { lastY: window.scrollY };
  var companies = $$('[data-company-story]');
  var stack = $('[data-stack]');
  var ticking = false;
  function update() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;
    if (header) header.classList.toggle('t-headerScrolled', y > 40);
    if (y < 56) { showHeader(true); nav.lastY = y; }
    else {
      var delta = y - nav.lastY;
      if (delta > 2) {
        showHeader(false);
        if (state.mega || state.market || state.menu || state.lang) { state.mega = null; state.market = false; state.menu = false; state.lang = false; render(); showHeader(false); }
        var focused = document.activeElement;
        if (focused && header && header.contains(focused)) focused.blur();
      } else if (delta < -2) showHeader(true);
      nav.lastY = y;
    }
    companies.forEach(function (company) {
      var rect = company.getBoundingClientRect();
      company.style.setProperty('--company-progress', String(clamp(-rect.top / Math.max(1, rect.height - vh))));
    });
    // Vehicle cards keep scrolling upward and stack on top of each other (LTX → TX1 → TX7).
    if (stack && !reduced) {
      var cards = $$('[data-stack-card]', stack);
      cards.forEach(function (card, index) {
        var next = cards[index + 1];
        if (!next) { card.style.setProperty('--cover', '0'); return; }
        var nextTop = next.getBoundingClientRect().top;
        var cardTop = card.getBoundingClientRect().top;
        card.style.setProperty('--cover', clamp((vh - nextTop) / Math.max(1, vh - cardTop)).toFixed(3));
      });
    }
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  if (reduced) $$('video', root).forEach(function (v) { v.pause(); });

  /* Reveal on scroll */
  var reveals = $$('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) reveals.forEach(function (el) { el.classList.add('t-revealed'); });
  else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) { entry.target.classList.add('t-revealed'); revealObserver.unobserve(entry.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { revealObserver.observe(el); });
  }

  /* Production steps: the sticky index follows the step in the middle of the viewport. */
  var stepItems = $$('[data-step-index]');
  if (stepItems.length && 'IntersectionObserver' in window) {
    var stepObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var active = entry.target.getAttribute('data-step');
        stepItems.forEach(function (li) { li.classList.toggle('t-flowIndexActive', li.getAttribute('data-step-index') === active); });
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    $$('[data-step]').forEach(function (step) { stepObserver.observe(step); });
  }

  /* ---------- Hero carousel ---------- */
  var hero = $('[data-hero]');
  if (hero) {
    var cards = $$('[data-hero-card]', hero);
    var dots = $$('[data-hero-dot]', hero);
    var aura = $('[data-hero-aura]', hero);
    var count = $('[data-hero-count]', hero);
    var pauseBtn = $('[data-hero-pause]', hero);
    var total = cards.length;
    var index = 0;
    var paused = false;
    var timer = null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var posClasses = ['t-editorialCardActive', 't-editorialCardNext', 't-editorialCardPrevious', 't-editorialCardHidden'];
    function show(next) {
      index = (next + total) % total;
      cards.forEach(function (card, i) {
        var diff = (i - index + total) % total;
        var cls = diff === 0 ? posClasses[0] : diff === 1 ? posClasses[1] : diff === total - 1 ? posClasses[2] : posClasses[3];
        posClasses.forEach(function (c) { card.classList.remove(c); });
        card.classList.add(cls);
        card.setAttribute('aria-hidden', i === index ? 'false' : 'true');
        var img = card.querySelector('img');
        if (img) img.alt = i === index ? card.getAttribute('data-title') : '';
        var link = card.querySelector('.t-editorialCopy a');
        if (link) link.tabIndex = i === index ? 0 : -1;
      });
      dots.forEach(function (dot, i) {
        dot.classList.toggle('t-editorialDotActive', i === index);
        if (i === index) dot.setAttribute('aria-current', 'true'); else dot.removeAttribute('aria-current');
      });
      if (aura) aura.style.backgroundImage = 'url(' + cards[index].getAttribute('data-image') + ')';
      if (count) count.textContent = t('featured', 'Featured stories · %s').replace('%s', pad(index + 1) + ' / ' + pad(total));
    }
    function restart() {
      if (timer) window.clearInterval(timer);
      timer = null;
      if (!paused && !reduced) timer = window.setInterval(function () { show(index + 1); }, 7200);
    }
    restart();
    $('[data-hero-prev]', hero).addEventListener('click', function () { show(index - 1); restart(); });
    $('[data-hero-next]', hero).addEventListener('click', function () { show(index + 1); restart(); });
    dots.forEach(function (dot) { dot.addEventListener('click', function () { show(Number(dot.getAttribute('data-hero-dot'))); restart(); }); });
    cards.forEach(function (card, i) { card.addEventListener('click', function () { if (i !== index) { show(i); restart(); } }); });
    pauseBtn.addEventListener('click', function () {
      paused = !paused;
      pauseBtn.setAttribute('aria-label', paused ? t('play', 'Play highlights') : t('pause', 'Pause highlights'));
      pauseBtn.innerHTML = pauseBtn.getAttribute(paused ? 'data-icon-play' : 'data-icon-pause');
      restart();
    });
    hero.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') { show(index - 1); restart(); }
      if (event.key === 'ArrowRight') { show(index + 1); restart(); }
    });
    var dragStart = null;
    hero.addEventListener('pointerdown', function (event) {
      if (event.target.closest('button, a')) return;
      dragStart = event.clientX;
      try { hero.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    });
    hero.addEventListener('pointerup', function (event) {
      if (dragStart === null) return;
      var distance = event.clientX - dragStart;
      if (Math.abs(distance) > 42) { show(index + (distance < 0 ? 1 : -1)); restart(); }
      dragStart = null;
    });
  }

  /* ---------- Market map ---------- */
  var mapRoot = $('[data-map-root]');
  if (mapRoot) {
    var markets = JSON.parse(($('[data-map-data]', mapRoot) || { textContent: '[]' }).textContent);
    var active = 0;
    var arrowUpRight = (document.querySelector('.lucide-arrow-up-right') || { outerHTML: '' }).outerHTML;
    var arrowRight = (document.querySelector('.lucide-arrow-right') || { outerHTML: '' }).outerHTML;
    var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
    var mapRoutes = null;
    /* Pins sit on their real location on the map image (fractions of the image), at every screen width. */
    var MAP_GEO = { DE: [0.4980, 0.3601], NL: [0.4939, 0.3313], ES: [0.4788, 0.4064] };
    function layoutMap() {
      var plotEl = $('[data-map-plot]', mapRoot);
      var base = $('[data-map-base]', mapRoot);
      var orbit = $('.t-mapOrbit', mapRoot);
      if (!plotEl || !base || !orbit) return;
      var pw = plotEl.clientWidth, ph = plotEl.clientHeight;
      var W = base.offsetWidth, H = W * 972 / 1980;
      if (!pw || !W) return;
      var mobile = window.matchMedia('(max-width: 767px)').matches;
      var Z = mobile ? 3.4 : 2.1;
      // Orbit centre (its CSS top/left are percentages of the plot).
      var os = getComputedStyle(orbit);
      var ox = parseFloat(os.left) || pw * 0.55, oy = parseFloat(os.top) || ph * 0.38;
      var focus = MAP_GEO.DE;
      // Keep the southernmost pin (Spain) above the photo card that covers the lower left of the map.
      var card = $('.t-marketImageStage', mapRoot);
      if (card && !mobile) {
        var cardTop = card.getBoundingClientRect().top - plotEl.getBoundingClientRect().top;
        var esDrop = Z * (MAP_GEO.ES[1] - focus[1]) * H;
        var cardLeftEdge = card.getBoundingClientRect().right - plotEl.getBoundingClientRect().left;
        var esX = ox + Z * (MAP_GEO.ES[0] - focus[0]) * W;
        if (esX < cardLeftEdge) oy = Math.min(oy, cardTop - 26 - esDrop);
      }
      orbit.style.left = ox.toFixed(1) + 'px';
      orbit.style.top = oy.toFixed(1) + 'px';
      // The image box starts at (pw/2, ph/2); transform origin is its centre.
      var cx = pw / 2 + W / 2, cy = ph / 2 + H / 2;
      var tx = ox - cx - Z * (focus[0] - 0.5) * W;
      var ty = oy - cy - Z * (focus[1] - 0.5) * H;
      base.style.height = H + 'px';
      base.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + Z + ')';
      var pos = {};
      Object.keys(MAP_GEO).forEach(function (code) {
        var g = MAP_GEO[code];
        pos[code] = [cx + tx + Z * (g[0] - 0.5) * W, cy + ty + Z * (g[1] - 0.5) * H];
        var pin = $('.t-pin' + code, mapRoot);
        if (pin) { pin.style.left = (pos[code][0] - 7).toFixed(1) + 'px'; pin.style.top = (pos[code][1] - 7).toFixed(1) + 'px'; }
      });
      // Route lines from the headquarters to the other markets (SVG viewBox 1000 × 520, stretched over the layer).
      var layer = $('.t-routeLayer', mapRoot);
      if (!layer) return;
      var lw = layer.clientWidth || pw, lh = layer.clientHeight || ph;
      var vb = function (p) { return [(p[0] / lw * 1000).toFixed(1), (p[1] / lh * 520).toFixed(1)]; };
      var curve = function (a, b) {
        var A = vb(a), B = vb(b), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
        var c = vb([mx - dy / len * len * 0.18, my + dx / len * len * 0.18]);
        return 'M' + A[0] + ' ' + A[1] + ' Q' + c[0] + ' ' + c[1] + ' ' + B[0] + ' ' + B[1];
      };
      mapRoutes = { NL: curve(pos.DE, pos.NL), ES: curve(pos.DE, pos.ES) };
      var all = $$('.t-routeLayer > path', mapRoot);
      if (all[0]) all[0].setAttribute('d', mapRoutes.NL);
      if (all[1]) all[1].setAttribute('d', mapRoutes.ES);
      var activePaths = $$('[data-map-routes] path', mapRoot);
      activePaths.forEach(function (p) { p.setAttribute('d', p.getAttribute('data-to') === 'ES' ? mapRoutes.ES : mapRoutes.NL); });
    }
    function selectMarket(i) {
      active = i;
      var m = markets[i];
      $$('[data-map-progress]', mapRoot).forEach(function (el, k) { el.classList.toggle('t-mapProgressActive', k <= i); });
      var countEl = $('[data-map-count]', mapRoot);
      if (countEl) countEl.textContent = t('selectMarket', 'Select a market · %s').replace('%s', '0' + (i + 1) + ' / 0' + markets.length);
      var shortEl = $('[data-map-count-short]', mapRoot);
      if (shortEl) shortEl.textContent = '0' + (i + 1) + ' / 0' + markets.length;
      var base = $('[data-map-base]', mapRoot);
      if (base) {
        markets.forEach(function (mk) { base.classList.remove('t-mapImage' + mk.code); });
        base.classList.add('t-mapImage' + m.code);
      }
      // Re-create the active route group so the line animation restarts (like the React key).
      var routes = $('[data-map-routes]', mapRoot);
      if (routes) {
        var fresh = routes.cloneNode(false);
        var html = '';
        var dNL = mapRoutes ? mapRoutes.NL : 'M550 198 C545 188 540 181 535 177';
        var dES = mapRoutes ? mapRoutes.ES : 'M550 198 C540 210 530 223 520 234';
        if (i === 0 || i === 2) html += '<path pathLength="1" data-to="NL" d="' + dNL + '"></path>';
        if (i === 0 || i === 1) html += '<path pathLength="1" data-to="ES" d="' + dES + '"></path>';
        fresh.innerHTML = html;
        routes.parentNode.replaceChild(fresh, routes);
      }
      $$('.t-countryPin', mapRoot).forEach(function (pin, k) {
        pin.classList.toggle('t-countryPinActive', k === i);
        pin.setAttribute('aria-pressed', k === i ? 'true' : 'false');
      });
      $$('[data-map-image]', mapRoot).forEach(function (img, k) {
        img.classList.toggle('t-marketImageActive', k === i);
        img.alt = k === i ? img.getAttribute('data-alt') : '';
        img.setAttribute('aria-hidden', k === i ? 'false' : 'true');
      });
      var caption = $('[data-map-caption]', mapRoot);
      if (caption) {
        var fig = caption.cloneNode(false);
        fig.innerHTML = '<small>' + esc(m.code + ' · ' + m.role) + '</small><strong>' + esc(m.name) + '<br>' + esc(m.place) + '</strong><p>' + esc(m.detail) + '</p><a href="' + esc(m.href) + '" target="_blank" rel="noreferrer">' + esc(t('openCountry', 'Open country website')) + ' <b>' + arrowUpRight + '</b></a>';
        caption.parentNode.replaceChild(fig, caption);
      }
      $$('[data-map-dir]', mapRoot).forEach(function (btn, k) {
        btn.classList.toggle('t-marketActive', k === i);
        btn.setAttribute('aria-pressed', k === i ? 'true' : 'false');
        var label = $('[data-map-dir-label]', btn);
        if (label) label.innerHTML = esc(k === i ? t('viewing', 'VIEWING') : t('view', 'VIEW')) + ' ' + arrowRight;
      });
    }
    $$('[data-map-select]', mapRoot).forEach(function (btn) {
      btn.addEventListener('click', function () { selectMarket(Number(btn.getAttribute('data-map-select'))); });
    });
    layoutMap();
    var mapBaseImg = $('[data-map-base]', mapRoot);
    if (mapBaseImg) mapBaseImg.addEventListener('load', layoutMap);
    var mapResizeTimer;
    window.addEventListener('resize', function () { clearTimeout(mapResizeTimer); mapResizeTimer = setTimeout(layoutMap, 120); });
    var plot = $('[data-map-plot]', mapRoot);
    if (plot) {
      plot.addEventListener('pointermove', function (event) {
        if (reduced) return;
        var rect = plot.getBoundingClientRect();
        plot.style.setProperty('--map-x', ((event.clientX - rect.left) / rect.width) * 100 + '%');
        plot.style.setProperty('--map-y', ((event.clientY - rect.top) / rect.height) * 100 + '%');
      });
      plot.addEventListener('pointerleave', function () { plot.style.removeProperty('--map-x'); plot.style.removeProperty('--map-y'); });
    }
  }

  /* ---------- News slider ---------- */
  $$('[data-news-grid]').forEach(function (grid) {
    var section = grid.closest('section');
    var prev = $('[data-news-prev]', section);
    var next = $('[data-news-next]', section);
    if (prev) prev.addEventListener('click', function () { grid.scrollBy({ left: -grid.clientWidth * 0.72, behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { grid.scrollBy({ left: grid.clientWidth * 0.72, behavior: 'smooth' }); });
  });

  /* ---------- Cookie consent: GA4 loads only after "Accept" ---------- */
  var consentBox = $('[data-consent]');
  var consentCfgEl = document.getElementById('tyne-consent-config');
  if (consentBox && consentCfgEl) {
    var consentCfg = {};
    try { consentCfg = JSON.parse(consentCfgEl.textContent) || {}; } catch (e) { consentCfg = {}; }
    var CONSENT_KEY = 'tyne-consent-v1';
    var readConsent = function () { try { return JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); } catch (e) { return null; } };
    var writeConsent = function (analytics) { try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ analytics: analytics, at: new Date().toISOString() })); } catch (e) {} };
    var gaLoaded = false;
    var loadGA = function () {
      if (gaLoaded || !consentCfg.ga || consentCfg.preview) return;
      gaLoaded = true;
      window['ga-disable-' + consentCfg.ga] = false;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('consent', 'default', { ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: 'granted' });
      window.gtag('js', new Date());
      window.gtag('config', consentCfg.ga);
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(consentCfg.ga);
      document.head.appendChild(s);
    };
    var clearGACookies = function () {
      document.cookie.split(';').forEach(function (c) {
        var name = c.split('=')[0].trim();
        if (/^_ga/.test(name)) {
          var host = location.hostname.split('.');
          for (var k = 0; k < host.length - 1; k++) {
            document.cookie = name + '=; Max-Age=0; path=/; domain=.' + host.slice(k).join('.');
          }
          document.cookie = name + '=; Max-Age=0; path=/';
        }
      });
    };
    var showConsent = function () {
      consentBox.hidden = false;
      requestAnimationFrame(function () { consentBox.classList.add('t-consentOpen'); });
    };
    var hideConsent = function () {
      consentBox.classList.remove('t-consentOpen');
      setTimeout(function () { consentBox.hidden = true; }, reduced ? 0 : 320);
    };
    $$('[data-consent-choice]', consentBox).forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ok = btn.getAttribute('data-consent-choice') === 'accept';
        var before = readConsent();
        writeConsent(ok);
        hideConsent();
        if (ok) loadGA();
        else {
          window['ga-disable-' + consentCfg.ga] = true;
          if (gaLoaded) window.gtag('consent', 'update', { analytics_storage: 'denied' });
          clearGACookies();
          if (gaLoaded) location.reload();
        }
      });
    });
    $$('[data-open-consent]').forEach(function (btn) { btn.addEventListener('click', showConsent); });
    var stored = readConsent();
    if (consentCfg.preview || !stored) showConsent();
    else if (stored.analytics) loadGA();
    else clearGACookies();
  }

  render();
})();
