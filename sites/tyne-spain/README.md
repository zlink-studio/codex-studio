# TYN-e España — country website

Spanish country site for TYN-e, built as a static site that reuses the global
[tyn-e.com](https://tyn-e.com/) design system (markup, CSS, fonts, icons) with Spanish,
Spain-specific content. Client rules (TYN-e Europe): stay very close to the global brand site;
same vehicle models; TYN-e Brandstore Barcelona is the only dealer; all sales enquiries go to
`barcelona@tyn-e.com`; country-specific news; no company / mission / TYN-e Future sections.

- Review build: https://tyne-spain-site.vercel.app (noindex)
- Homepage design review canvas (frozen v4): https://tyne-spain-review.vercel.app

## Pages

| Path | Content | Global reference |
|---|---|---|
| `/` | Hero carousel, vehicles, Brandstore, news, contact | homepage |
| `/vehiculos/` | Vehicle family overview | fleet section |
| `/vehiculos/ltx/` · `/tx1/` · `/tx7/` | Model pages | `/vehicles/ltx/` etc. |
| `/brandstore-barcelona/` | The Spanish dealer: location, hours, photos, events | contact / HQ layout |
| `/noticias/` + 7 articles | Spanish Brandstore news (from tyn-e.com/es/blog) | newsroom / article |
| `/contacto/` | Contact options and location | `/company/contact/` |
| `/aviso-legal/` · `/privacidad/` · `/cookies/` | Legal pages (Spanish translation, pending client review) | legal pages |

## Build

Python 3.9+ only, no dependencies:

```bash
python3 build.py                      # writes dist/
python3 -m http.server -d dist 8812   # preview at http://localhost:8812
```

Vercel builds the same way (`vercel.json`: `python3 build.py`, output `dist/`).

## Structure

```
build.py            entry point: renders every page into dist/<path>/index.html, sitemap, robots, 404
src/layout.py       <head>, global header (nav) and footer, page shell
src/components.py   global components: page intro, contact/explore list, prose, news grid, contact block
src/icons.py        Lucide icons as used on tyn-e.com
src/_header.html    global header markup (Spanish)   src/_footer.html  global footer markup
content/*.py        one module per section: home, vehicles, store, news (+ news_data), contact, legal
static/assets/      css/js/fonts from the global theme, x.css / x.js (local layer), media/
tools/qa_site.js    whole-site QA (status, JS errors, overflow, broken links, screenshots)
```

Edit content in `content/*.py`, run `python3 build.py`.

## Design and performance rules

- Use global classes and values; local styles live in `static/assets/x.css`.
- No large blur filters, no stacked sticky cards (they made v3 stutter). Animations are opacity/transform only.
- `prefers-reduced-motion`: no opening animation, no autoplay, no wipes or parallax.
- Vehicle images marked "Imagen IA" are AI-generated images from the global site.

## QA

```bash
cd tools && npm install
CHROME=/path/to/chrome node qa_site.js http://localhost:8812 ../qa-out
```

## Open items (client)

Store phone (+49 mobile), hours (office/coworking), visit & test-drive process, news selection,
Spanish legal texts (hosting/analytics sections describe the global site), final domain and hosting.
