"""Homepage (v4 approved layout): wide hero banner with global editorial copy, vehicles,
Brandstore block, Spanish news and contact."""
from src.components import MEDIA, contact_cta
from src.icons import ARROW, PREV, NEXT, PAUSE, PLAY
from . import vehicles, store, news

SLIDES = [
    dict(img="h-ltx-duo.jpg", pos="center 60%", posm="74% 60%", ai=True, model="LTX",
         kicker=("TYN-e España", "Eléctrico · Eficiente · Preparado para el futuro"), claim=True,
         title="ePOWER YOUR BUSINESS!", text="Vehículos comerciales compactos y 100&nbsp;% eléctricos: herramientas fiables para el trabajo diario en la ciudad.",
         cta=("Ver vehículos", "/vehiculos/")),
    dict(img="n-tx1-skyline.jpg", pos="center 62%", posm="82% 70%", ai=True, model="TX1",
         kicker=("TX1", "Reparto · Última milla"),
         title="El todoterreno de la última milla.", text="El modelo más compacto de la familia TYN-e: ágil, eficiente y fiable para el reparto y los servicios en la ciudad.",
         cta=("Descubrir el TX1", "/vehiculos/tx1/")),
    dict(img="r-tx7-autumn.jpg", pos="center 72%", posm="64% 70%", ai=True, model="TX7",
         kicker=("TX7", "Construcción · Industria · Servicios"),
         title="Robusto para el trabajo profesional.", text="Gran capacidad de carga y carrocerías flexibles: la base robusta para el trabajo exigente de cada día.",
         cta=("Descubrir el TX7", "/vehiculos/tx7/")),
    dict(img="store-van.jpg", pos="center 55%", posm="42% 50%", ai=False, model="Brandstore",
         kicker=("Brandstore Barcelona", "Port Marina · Premià de Mar"),
         title="Visítanos en Port Marina.", text="TYN-e Brandstore Barcelona es nuestro distribuidor oficial en España. Nuestro equipo te ayuda a elegir el vehículo adecuado.",
         cta=("Contactar con Barcelona", "/contacto/")),
]


def hero():
    slides = []
    for i, s in enumerate(SLIDES):
        on = i == 0
        tag = 'h1 id="homepage-title" class="x-claim"' if s.get("claim") else "h2"
        end = "h1" if s.get("claim") else "h2"
        slides.append(
            f'<figure class="x-slide{" is-on" if on else ""}" data-model="{s["model"]}" style="--pos:{s["pos"]};--pos-m:{s["posm"]}"'
            f'{"" if on else " aria-hidden=\"true\""}>'
            f'<img src="{MEDIA}{s["img"]}" alt="{s["title"]}" draggable="false"{" fetchpriority=\"high\"" if on else " loading=\"lazy\""}>'
            f'<span class="x-shade"></span>{"<span class=\"x-ai\">Imagen IA</span>" if s["ai"] else ""}'
            f'<figcaption class="x-copy"><div><small>{s["kicker"][0]}</small><b>{s["kicker"][1]}</b></div>'
            f'<{tag}>{s["title"]}</{end}><p>{s["text"]}</p>'
            f'<a href="{s["cta"][1]}"{"" if on else " tabindex=\"-1\""}>{s["cta"][0]}<b>{ARROW}</b></a></figcaption>'
            f'<span class="x-num">0{i + 1}</span></figure>')
    dots = "".join(f'<button type="button" data-dot="{i}" aria-label="Mostrar {s["model"]}"{" aria-current=\"true\"" if i == 0 else ""}></button>' for i, s in enumerate(SLIDES))
    return f'''<section class="x-hero" aria-labelledby="homepage-title">
  <div class="x-intro"><span>TYN-e España</span><small data-now-count>Destacados · 01 / 04</small></div>
  <div class="x-banner" data-banner>
    <div class="x-media" role="region" aria-roledescription="carrusel" aria-label="TYN-e España destacados" tabindex="0" data-carousel>
      <div class="x-slides">{"".join(slides)}</div>
    </div>
    <div class="x-ctrl" aria-label="Controles del carrusel">
      <button type="button" data-prev aria-label="Anterior">{PREV}</button>
      <div class="x-dots">{dots}</div>
      <button type="button" data-pause aria-label="Pausar carrusel"><i class="i-pause">{PAUSE}</i><i class="i-play">{PLAY}</i></button>
      <button type="button" data-next aria-label="Siguiente">{NEXT}</button>
    </div>
  </div>
</section>
'''


def pages():
    main = hero() + vehicles.card_grid() + store.store_block() + news.home_section() + contact_cta()
    return [("/", "TYN-e España · ePOWER YOUR BUSINESS", "TYN-e España: LTX, TX1 y TX7, vehículos comerciales compactos y 100 % eléctricos. Contacta con TYN-e Brandstore Barcelona en Port Marina.", main, None)]
