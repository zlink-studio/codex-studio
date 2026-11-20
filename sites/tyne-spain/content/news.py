"""Noticias: list page (global events layout) and one article page per post (global article layout)."""
import html
from src.components import page_intro, prose, news_section, explore, contact_cta
from .news_data import POSTS

MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
NEWS_MEDIA = "/assets/media/news/"


def long_date(iso):
    y, m, d = iso.split("-")
    return f"{int(d)} de {MONTHS[int(m) - 1]} de {y}"


def meta(p):
    y, m, _ = p["date"].split("-")
    return f'{p["cat"]} · {m}.{y}'


def cover(p):
    return f'{NEWS_MEDIA}{p["slug"]}/{p["images"][0]}'


def cards(posts):
    return [(f'/noticias/{p["slug"]}/', cover(p), meta(p), p["title"]) for p in posts]


def home_section():
    return news_section("Actualidad en España", "Noticias y eventos<br><em>del Brandstore.</em>", cards(POSTS[:4]), more=("Todas las noticias", "/noticias/"))


def news_section_for_store():
    return news_section("Eventos en el Brandstore", "Lo que pasa<br><em>en Port Marina.</em>", cards(POSTS[:4]), more=("Todas las noticias", "/noticias/"), sid="eventos")


def list_page():
    main = page_intro(f'{NEWS_MEDIA}{POSTS[3]["slug"]}/{POSTS[3]["images"][2]}', "Noticias<br><em>y eventos.</em>",
                      "Actividades, eventos y encuentros de TYN-e Brandstore Barcelona en Port Marina.",
                      trail=[("Noticias", None)], pos="center 45%")
    main += news_section("Actualidad en España", "Todas las noticias<br><em>del Brandstore.</em>", cards(POSTS), more=None, slider=False, sid="todas")
    main += contact_cta(eyebrow="¿Te interesa?", title="Ven a conocernos<br><em>en Port Marina.</em>")
    return main


def article_page(i):
    p = POSTS[i]
    body = "".join(f'<p class="wp-block-paragraph">{html.escape(t)}</p>' for t in p["paras"])
    imgs = p["images"][1:] if len(p["images"]) > 1 else p["images"]
    gallery = "".join(f'<figure><img src="{NEWS_MEDIA}{p["slug"]}/{f}" alt="" loading="lazy"></figure>' for f in imgs)
    body += f'<div class="x-gallery{" x-gallery-one" if len(imgs) == 1 else ""}">{gallery}</div>'
    body += '<p class="x-source">Publicado originalmente en el blog de TYN-e Brandstore Barcelona.</p>'
    main = page_intro(cover(p), html.escape(p["title"]), long_date(p["date"]),
                      trail=[("Noticias", "/noticias/"), (p["cat"], None)], cls="t-articleIntro", pos="center 45%", h1_cls="t-articleTitle")
    main += prose(body, eyebrow=meta(p))
    others = [q for q in POSTS if q is not p][:3]
    main += explore("Noticias", "Más noticias del Brandstore.", "Otras actividades de TYN-e en España.",
                    [(f"0{k + 1}", q["title"], long_date(q["date"]), f'/noticias/{q["slug"]}/') for k, q in enumerate(others)]
                    + [("04", "Todas las noticias", "Eventos y actividades en Port Marina", "/noticias/")])
    return main


def pages():
    out = [("/noticias/", "Noticias", "Noticias y eventos de TYN-e Brandstore Barcelona en Port Marina, Premià de Mar.", list_page(), "/noticias/")]
    for i, p in enumerate(POSTS):
        out.append((f'/noticias/{p["slug"]}/', p["title"], (p["paras"][0][:150] if p["paras"] else p["title"]), article_page(i), "/noticias/"))
    return out
