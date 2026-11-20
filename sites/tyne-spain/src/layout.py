"""Page shell for the TYN-e España site: <head>, global header (navigation) and footer.

The header/footer markup is the global tyn-e.com markup (src/_header.html, src/_footer.html),
localised to Spanish. Here it is turned from one-page anchors into links between pages.
"""
from pathlib import Path

SRC = Path(__file__).parent
SITE_NAME = "TYN-e España"
BASE_URL = "https://tyne-spain-site.vercel.app"   # review host; change when the final domain is known

NAV = {
    "brandstore": "/brandstore-barcelona/",
    "noticias": "/noticias/",
    "contacto": "/contacto/",
}
LINK_MAP = [
    ('href="#vehicle-ltx"', 'href="/vehiculos/ltx/"'),
    ('href="#vehicle-tx1"', 'href="/vehiculos/tx1/"'),
    ('href="#vehicle-tx7"', 'href="/vehiculos/tx7/"'),
    ('href="#vehiculos"', 'href="/vehiculos/"'),
    ('href="#brandstore"', 'href="/brandstore-barcelona/"'),
    ('href="#noticias"', 'href="/noticias/"'),
    ('href="#contacto"', 'href="/contacto/"'),
    ('href="#top" lang="es-ES"', 'href="/" lang="es-ES"'),
    ('class="t-logo" href="#top"', 'class="t-logo" href="/"'),
    ('class="t-langActive" data-close-panels="" href="#top"', 'class="t-langActive" data-close-panels="" href="/"'),
    ('vendor/media/', '/assets/media/'),
]


def _header():
    h = (SRC / "_header.html").read_text()
    for key, url in NAV.items():
        h = h.replace(f'<button class="t-navLabel" data-scroll-target="{key}" type="button">', f'<a class="t-navLabel" href="{url}">')
    h = h.replace('</button></div><div class="t-navItem" data-mega-none=""><a', '</button></div><div class="t-navItem" data-mega-none=""><a')
    # close tags of the three converted nav labels
    for label in ("Brandstore Barcelona", "Noticias", "Contacto"):
        h = h.replace(f'">{label}</button>', f'">{label}</a>')
    h = h.replace('<button aria-label="Solicitar información" class="t-navVehicles" data-reset-consultation="" data-scroll-target="contacto" type="button">',
                  '<a aria-label="Solicitar información" class="t-navVehicles" href="/contacto/">')
    h = h.replace('</em><span>', '</em><span>', 1)
    i = h.find('class="t-navVehicles"'); j = h.find('</button>', i)
    h = h[:j] + '</a>' + h[j + len('</button>'):]
    for a, b in LINK_MAP:
        h = h.replace(a, b)
    # mega menu: global model names
    h = h.replace("<small>Versatilidad urbana</small>", "<small>Furgoneta urbana</small>").replace("<small>Reparto urbano</small>", "<small>El todoterreno</small>").replace("<small>Transporte profesional</small>", "<small>Carga pesada</small>")
    h = h.replace('href="/brandstore-barcelona/">Brandstore Barcelona <b aria-hidden="true">→</b></a><a data-close-panels="" href="/contacto/">Solicitar información',
                  'href="/brandstore-barcelona/">Brandstore Barcelona <b aria-hidden="true">→</b></a><a data-close-panels="" href="/contacto/">Solicitar información')
    return h


def _footer():
    f = (SRC / "_footer.html").read_text()
    for a, b in LINK_MAP:
        f = f.replace(a, b)
    f = f.replace("LTX · Versatilidad urbana", "LTX · Furgoneta urbana").replace("TX1 · El más compacto", "TX1 · El todoterreno").replace("TX7 · Transporte profesional", "TX7 · Carga pesada")
    f = f.replace('<a href="/contacto/">Solicitar información</a>', '<a href="/contacto/">Contacto</a>')
    f = f.replace('<a href="https://tyn-e.com/legal-notice/" rel="noopener" target="_blank">Aviso legal · global ↗</a><a href="https://tyn-e.com/privacy-policy/" rel="noopener" target="_blank">Privacidad · global ↗</a>',
                  '<a href="/aviso-legal/">Aviso legal</a><a href="/privacidad/">Privacidad</a><a href="/cookies/">Cookies</a>')
    return f


HEADER, FOOTER = _header(), _footer()

# Decides before first paint whether the homepage opening plays (homepage only).
OPENING_SCRIPT = """<script>(function(){try{var q=new URLSearchParams(location.search),bd=q.get('board'),k='tyne-es-v2-opening-'+(bd||'home'),h=document.documentElement;var rm=matchMedia('(prefers-reduced-motion: reduce)').matches||q.has('rm');var seen=sessionStorage.getItem(k)==='1';sessionStorage.setItem(k,'1');if(bd){h.classList.add('x-board-open');h.style.setProperty('--ovh',bd==='mobile'?'844px':'900px');}if(!rm&&!q.has('still')&&!location.hash&&(!seen||q.get('replay')==='1'))h.classList.add('x-will-open');}catch(e){}})();</script>"""
OPENING_MARKUP = '<div class="x-open" aria-hidden="true"><i></i><i></i><b></b></div><div class="x-open-logo" aria-hidden="true"><img src="/assets/media/logo-black.svg" alt=""></div>'


def _nobreak_brand(html):
    """Keep "TYN-e" on one line inside headings (browsers break at the hyphen)."""
    import re
    def fix(m):
        return re.sub(r"TYN-e(?![^<]*>)", '<span class="x-nb">TYN-e</span>', m.group(0))
    return re.sub(r"<h[1-3][^>]*>.*?</h[1-3]>", fix, html, flags=re.S)


def page(path, title, description, main, *, active=None, home=False, preload=None, version="1"):
    """Return a complete HTML document for one page."""
    main = _nobreak_brand(main)
    full_title = title if home else f"{title} · {SITE_NAME}"
    header = HEADER
    if active:
        header = header.replace(f'class="t-navLabel" href="{active}"', f'class="t-navLabel" href="{active}" aria-current="page"', 1)
    pre = f'<link rel="preload" as="image" href="{preload}">' if preload else ""
    return f"""<!doctype html>
<html lang="es-ES"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>{full_title}</title>
<meta name="description" content="{description}">
<link rel="canonical" href="{BASE_URL}{path}">
<meta property="og:title" content="{full_title}"><meta property="og:description" content="{description}"><meta property="og:locale" content="es_ES">
<link rel="icon" href="/assets/media/nav-logo-mobile-black.png">
<link rel="stylesheet" href="/assets/css/fonts.css"><link rel="stylesheet" href="/assets/css/base.css"><link rel="stylesheet" href="/assets/css/vars.css"><link rel="stylesheet" href="/assets/css/tyne.css"><link rel="stylesheet" href="/assets/css/pages.css"><link rel="stylesheet" href="/assets/x.css?v={version}">
{pre}
<script>window.TYNE={{i18n:{{featured:'Destacados · %s',play:'Reanudar carrusel',pause:'Pausar carrusel',toLight:'Cambiar a tema claro',toDark:'Cambiar a tema oscuro',lightTheme:'Tema claro',darkTheme:'Tema oscuro'}}}};</script>
{OPENING_SCRIPT if home else ""}
<script defer src="/assets/js/site.js"></script><script defer src="/assets/x.js?v={version}"></script>
</head><body><main class="t-site t-lightTheme tyne-global-page x-page{' x-inner' if not home else ''}" data-theme="light" id="top"><a class="t-skip" href="#content">Ir al contenido</a>{OPENING_MARKUP if home else ""}
{header}
<div id="content">
{main}
</div>
{FOOTER}
</main></body></html>
"""
