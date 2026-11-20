#!/usr/bin/env python3
"""Build the TYN-e España site into dist/ (one folder per page, clean URLs).

    python3 build.py            # build
    python3 -m http.server -d dist 8812   # preview locally
"""
import html
import shutil
from datetime import date
from pathlib import Path

from src.layout import page, BASE_URL
from content import home, vehicles, store, news, contact, legal

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
VERSION = date.today().strftime("%Y%m%d")


def write(path, doc):
    out = DIST / path.strip("/") / "index.html" if path != "/" else DIST / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc)


def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    shutil.copytree(ROOT / "static", DIST)

    pages = []
    for mod in (home, vehicles, store, news, contact, legal):
        pages += mod.pages()
    for path, title, desc, body, active in pages:
        is_home = path == "/"
        write(path, page(path, title, html.escape(desc, quote=True), body, active=active, home=is_home,
                         preload="/assets/media/g/h-ltx-duo.jpg" if is_home else None, version=VERSION))

    # 404
    from src.components import page_intro, MEDIA, explore
    nf = page_intro(MEDIA + "g-showroom-wide.jpg", "Página<br><em>no encontrada.</em>", "La página que buscas no existe o se ha movido.", trail=[("404", None)], cls="t-textIntro")
    nf += explore("TYN-e España", "Sigue por aquí.", "Estas páginas pueden ayudarte.",
                  [("01", "Inicio", "TYN-e España", "/"), ("02", "Vehículos", "LTX · TX1 · TX7", "/vehiculos/"),
                   ("03", "Brandstore Barcelona", "Port Marina · Premià de Mar", "/brandstore-barcelona/"), ("04", "Contacto", "barcelona@tyn-e.com", "/contacto/")])
    (DIST / "404.html").write_text(page("/404.html", "Página no encontrada", "Página no encontrada.", nf, version=VERSION))

    urls = "".join(f"<url><loc>{BASE_URL}{p[0]}</loc></url>" for p in pages)
    (DIST / "sitemap.xml").write_text(f'<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n')
    (DIST / "robots.txt").write_text("User-agent: *\nDisallow: /\n")   # review build: keep out of search engines
    print(f"built {len(pages) + 1} pages into {DIST}")


if __name__ == "__main__":
    main()
