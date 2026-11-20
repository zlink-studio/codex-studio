"""Global tyn-e.com components (same markup and CSS classes), parameterised for Spanish content."""
from urllib.parse import quote
from .icons import ARROW, UP_RIGHT, EXPLORE_ARROW, CARD_ARROW, NEWS_PREV, NEWS_NEXT

MEDIA = "/assets/media/g/"
MAIL = "barcelona@tyn-e.com"
PHONE, PHONE_HREF = "+49 173 2336730", "tel:+491732336730"
ADDRESS_HTML = "Camí Ral s/n · Port Marina<br>08330 Premià de Mar (Barcelona)"
MAP_URL = "https://www.google.com/maps/search/?api=1&query=" + quote("TYN-e Brandstore, Camí Ral, Port Marina, 08330 Premià de Mar")


def mailto(subject):
    return f"mailto:{MAIL}?subject=" + quote(f"TYN-e España | {subject}")


def crumbs(items):
    """items: [(label, href or None)] after the root."""
    parts = ['<a href="/">TYN-e España</a>']
    for label, href in items:
        parts.append(f'<a href="{href}">{label}</a>' if href else f'<span>{label}</span>')
    return '<nav aria-label="Ruta de navegación">' + "<i>/</i>".join(parts) + "</nav>"


def page_intro(img, title_html, lead="", trail=(), cls="", pos="center 55%", ai=False, h1_cls=""):
    ai_label = '<span class="t-aiLabel">Imagen IA</span>' if ai else ""
    h1c = f' class="{h1_cls}"' if h1_cls else ""
    p = f"<p>{lead}</p>" if lead else ""
    return (f'<section class="t-pageIntro {cls}" id="intro">\n\t<img {"data-ai-image " if ai else ""}src="{img}" alt="" style="object-position:{pos}">{ai_label}\n'
            f'\t<span class="t-pageIntroShade"></span>\n\t<div>{crumbs(trail)}<h1{h1c}>{title_html}</h1>{p}</div>\n</section>\n')


def explore(eyebrow, title, text, items, label=None, cls="t-explore", sid="related-pages"):
    """Global t-contact list block. items: [(num, title, sub, href)] — external links open in a new tab."""
    links = []
    for i, (n, t, sub, href) in enumerate(items):
        ext = ' target="_blank" rel="noopener"' if href.startswith("http") else ""
        icon = UP_RIGHT if href.startswith(("mailto:", "http", "tel:")) else EXPLORE_ARROW
        links.append(f'<a href="{href}"{ext} data-reveal><small>{n}</small><strong>{t}</strong><span>{sub}</span><b>{icon}</b></a>')
    return (f'<section class="t-contact {cls}" id="{sid}">\n\t<div data-reveal><p>{eyebrow}</p><h2>{title}</h2><span>{text}</span></div>\n'
            f'\t<nav aria-label="{label or title}">{"".join(links)}</nav>\n</section>\n')


def prose(html_body, eyebrow=None, cls=""):
    eb = f'<p class="t-proseEyebrow">{eyebrow}</p>' if eyebrow else ""
    return f'<section class="t-proseSection {cls}">\n\t<div class="t-prose" data-reveal>\n\t\t{eb}{html_body}\n\t</div>\n</section>\n'


def news_cards(items):
    """items: [(href, img, meta, title)] — global t-newsGrid cards."""
    return "".join(
        f'<a href="{u}" data-reveal><figure><img src="{img}" alt="" loading="lazy"><b aria-hidden="true">{CARD_ARROW}</b></figure>'
        f'<div><small>{meta}</small><h3>{t}</h3></div></a>' for u, img, meta, t in items)


def news_section(eyebrow, title_html, items, more=("Todas las noticias", "/noticias/"), sid="noticias", slider=True):
    controls = (f'<div class="t-newsControls"><button type="button" aria-label="Noticias anteriores" data-news-prev>{NEWS_PREV}</button>'
                f'<div>{"<i></i>" * len(items)}</div><button type="button" aria-label="Más noticias" data-news-next>{NEWS_NEXT}</button></div>') if slider else ""
    more_link = f'<a href="{more[1]}">{more[0]} <b>{ARROW}</b></a>' if more else ""
    grid_cls = "t-newsGrid" + ("" if slider else " x-newsList")
    return (f'<section class="t-news" id="{sid}"><div class="t-sectionHead" data-reveal><div><p>{eyebrow}</p><h2>{title_html}</h2></div>{more_link}</div>'
            f'<div class="{grid_cls}"{" data-news-grid" if slider else ""}>{news_cards(items)}</div>{controls}</section>\n')


def contact_cta(eyebrow="Contacto", title="Hablemos de<br><em>tu negocio.</em>", model=None):
    """The local dark contact block (v4), with optional model-specific first row."""
    rows = [("01", "Información", "Solicitar información", "La gama TYN-e y el Brandstore"),
            ("02", "LTX", "Consultar LTX", "Furgoneta urbana"),
            ("03", "TX1", "Consultar TX1", "El todoterreno · última milla"),
            ("04", "TX7", "Consultar TX7", "Carga pesada")]
    if model:
        rows.sort(key=lambda r: r[1] != model)
        rows = [(f"0{i + 1}",) + r[1:] for i, r in enumerate(rows)]
    html_rows = "".join(
        f'<a data-reveal style="--i:{i}" data-consult="{k}" href="{mailto("Solicitud de información" if k == "Información" else "Consulta " + k)}">'
        f'<small>{n}</small><strong>{t}</strong><span>{d}</span><b aria-hidden="true">{UP_RIGHT}</b></a>'
        for i, (n, k, t, d) in enumerate(rows))
    return f'''<section class="x-contact" id="contacto" aria-labelledby="contact-title">
  <div class="x-contact-inner">
    <div class="x-contact-head">
      <p class="x-eyebrow" data-reveal>{eyebrow}</p>
      <h2 id="contact-title" data-words>{title}</h2>
      <span data-reveal style="--i:2">Todas las consultas comerciales las atiende el equipo de TYN-e Brandstore Barcelona. Elige un tema y se abrirá tu correo con el asunto ya preparado.</span>
      <a class="x-mail" data-reveal style="--i:3" href="mailto:{MAIL}">{MAIL}</a>
    </div>
    <nav class="x-contact-list" aria-label="Opciones de consulta">{html_rows}</nav>
  </div>
</section>
'''
