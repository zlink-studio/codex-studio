// Whole-site QA for TYN-e España.
// Usage: node tools/qa_site.js http://localhost:8812 [outDir]
// Needs playwright-core and a Chromium (set CHROME=/path/to/chrome).
const { chromium } = require('playwright-core');
const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:8812';
const OUT = process.argv[3] || 'qa-out';
const CHROME = process.env.CHROME || '/home/claudeops/.local/bin/chrome-headless';

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME });
  const sitemap = await (await fetch(BASE + '/sitemap.xml')).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
  const report = [], checked = new Map();
  const status = async u => { if (!checked.has(u)) { try { const r = await fetch(u, { method: 'GET' }); checked.set(u, r.status); } catch { checked.set(u, 'ERR'); } } return checked.get(u); };

  for (const [vp, w, h, mob] of [['d', 1440, 900, false], ['m', 390, 844, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: mob, hasTouch: mob, reducedMotion: 'reduce' });
    for (const path of paths) {
      const p = await ctx.newPage(); const errs = [];
      p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
      const res = await p.goto(BASE + path + '?still', { waitUntil: 'networkidle' });
      const info = await p.evaluate(() => ({
        h1: document.querySelectorAll('h1').length,
        title: document.title,
        scrollW: document.documentElement.scrollWidth, vw: innerWidth,
        links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
        imgs: [...document.images].map(i => i.getAttribute('src')),
      }));
      const bad = [];
      if (vp === 'd') {
        for (const href of new Set([...info.links, ...info.imgs])) {
          if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('http') || href.startsWith('#')) continue;
          const u = new URL(href, BASE + path).href.split('#')[0];
          const s = await status(u); if (s !== 200) bad.push(`${href} → ${s}`);
        }
      }
      const name = (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '_')) + '-' + vp;
      await p.screenshot({ path: `${OUT}/${name}.jpg`, quality: 70 });
      report.push(`${vp} ${path} [${res.status()}] h1=${info.h1} overflow=${info.scrollW > info.vw} errors=${errs.length ? errs.join(' | ') : 0}${bad.length ? ' BROKEN: ' + bad.join(', ') : ''}`);
      await p.close();
    }
    await ctx.close();
  }
  await b.close();
  console.log(report.join('\n'));
  console.log(`checked ${checked.size} unique internal URLs`);
})();
