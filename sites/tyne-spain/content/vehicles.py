"""Vehicles: overview page and one page per model.

Structure and copy follow the global model pages (tyn-e.com/vehicles/ltx|tx1|tx7), translated to
Spanish. The global "discover in your country" step points to Brandstore Barcelona instead.
"""
from src.components import MEDIA, page_intro, explore, contact_cta, mailto
from src.icons import ARROW, UP_RIGHT

MODELS = {
    "ltx": dict(
        name="LTX", use="Furgoneta urbana", tone="mint", order=1,
        intro_img="p-ltx-night.jpg", intro_pos="center 62%", intro_lead="Compacto en acción. La solución inteligente para la última milla.",
        head=("Solución inteligente", "para la última milla."),
        head_text="El chasis LTX es el transportador ligero y compacto de la gama TYN-e y la base ideal para carrocerías a medida. Con su eficiente propulsión eléctrica y su alta carga útil, ofrece la máxima flexibilidad para una gran variedad de aplicaciones: perfecto para oficios, servicios municipales y carrocerías especiales.",
        card_img="v-ltx-2026-scene.jpg", card_pos="center 85%", grid_pos="52% 72%",
        card_text="Pensado para calles estrechas y centros urbanos. Gran maniobrabilidad y una base flexible para carrocerías a medida: chasis, plataforma o caja.",
        ideal=["Servicios municipales", "Jardinería", "Mantenimiento de instalaciones", "Oficios y servicios"],
        bodies=["Chasis", "Plataforma", "Caja"],
        highlights=[
            ("ai-ltx-agility.jpg", "Maniobrabilidad", "Hecho para calles estrechas.", "Ideal para callejuelas y centros urbanos: el LTX convence por su máxima maniobrabilidad, la elección adecuada para tareas variadas en entornos municipales y comerciales."),
            ("h-ltx-duo.jpg", "Carrocerías", "Una base, muchas carrocerías.", "El LTX es la base ideal para carrocerías a medida: disponible como chasis, plataforma o caja."),
            ("p-ltx-side.jpg", "Propulsión eléctrica", "Eficiente y flexible.", "Una propulsión eléctrica eficiente y una alta carga útil ofrecen la máxima flexibilidad para una gran variedad de aplicaciones."),
        ],
        lineup_img="c-ltx-2026.webp", explore_sub="Transporte urbano compacto"),
    "tx1": dict(
        name="TX1", use="El todoterreno", tone="blue", order=2,
        intro_img="n-tx1-skyline.jpg", intro_pos="center 62%", intro_lead="El todoterreno urbano. Una flexibilidad que convence. Cada día.",
        head=("Una flexibilidad que convence.", "Cada día."),
        head_text="El TX1 es el modelo más compacto de la familia TYN-e y destaca allí donde la maniobrabilidad y las dimensiones reducidas son decisivas. Se mueve sin esfuerzo en espacios estrechos y es ideal para quienes recorren muchos trayectos cortos cada día.",
        card_img="v-tx1-street.jpg", card_pos="center 58%", grid_pos="57% 62%",
        card_text="El miembro más compacto de la familia TYN-e. Versátil, eficiente y fiable: hecho para el transporte, el reparto y los servicios de última milla.",
        ideal=["Logística de última milla", "Reparto y mensajería", "Flotas comerciales", "Oficios y servicios"],
        bodies=None,
        highlights=[
            ("v-tx1-city.jpg", "Compacto", "El TYN-e más compacto.", "Allí donde importan la maniobrabilidad y las dimensiones reducidas, el TX1 se mueve sin esfuerzo en espacios estrechos."),
            ("p-tx1-parcel.jpg", "Última milla", "Hecho para muchos trayectos cortos.", "Ideal para quienes recorren muchas distancias cortas cada día: transporte, entregas y servicios en la última milla."),
            ("p-tx1-forklift.jpg", "Uso diario", "Versátil, eficiente y fiable.", "El TX1 está hecho para el uso diario en la ciudad y en la empresa."),
        ],
        lineup_img="c-tx1.webp", explore_sub="Versatilidad eléctrica para cada día"),
    "tx7": dict(
        name="TX7", use="Carga pesada", tone="purple", order=3,
        intro_img="p-tx7-site.jpg", intro_pos="center 58%", intro_lead="Más espacio para grandes tareas. La base robusta para carrocerías a medida.",
        head=("La base robusta", "para carrocerías a medida."),
        head_text="El chasis TX7 es la base versátil para carrocerías a medida. Con alta carga útil, propulsión eléctrica eficiente y una construcción robusta, ofrece la máxima flexibilidad para una gran variedad de aplicaciones: perfecto para oficios, servicios municipales y soluciones especiales para cada sector.",
        card_img="r-tx7-autumn.jpg", card_pos="center 76%", grid_pos="72% 70%",
        card_text="Su gran capacidad de carga y sus carrocerías flexibles hacen del TX7 la base robusta para el trabajo exigente: en servicios municipales, en obra y en el día a día de la empresa.",
        ideal=["Construcción", "Industria y tráfico interno", "Mantenimiento de instalaciones", "Oficios y empresas"],
        bodies=["Chasis", "Plataforma", "Caja"],
        highlights=[
            ("p-tx7-site.jpg", "Carga útil", "Más espacio para grandes tareas.", "La alta carga útil y las carrocerías flexibles hacen del TX7 la solución ideal para el trabajo exigente."),
            ("p-tx7-city.jpg", "Carrocerías", "Una base robusta para cada carrocería.", "Disponible como chasis, plataforma o caja: la base versátil para carrocerías a medida y soluciones especiales para cada sector."),
            ("p-tx7-green.jpg", "Trabajo diario", "Hecho para aplicaciones exigentes.", "En servicios municipales, en el almacén o en el día a día de la empresa: el TX7 ofrece la base adecuada."),
        ],
        lineup_img="c-tx7.webp", explore_sub="Hecho para aplicaciones exigentes"),
}
ORDER = ["ltx", "tx1", "tx7"]


def card_grid(head=True):
    """The homepage / overview card grid (v4 layout, global card internals)."""
    cards = []
    for i, slug in enumerate(ORDER):
        m = MODELS[slug]
        cards.append(f'''    <article class="x-card t-tone_{m["tone"]}" id="vehicle-{slug}" data-reveal style="--i:{i}">
      <a class="x-card-photo" data-wipe href="/vehiculos/{slug}/" tabindex="-1" aria-hidden="true"><img src="{MEDIA}{m["card_img"]}" alt="" loading="lazy" style="object-position:{m["grid_pos"]}"><span class="x-ai">Imagen IA</span></a>
      <div class="x-card-body">
        <div class="t-stackMeta"><small>0{i + 1} / 03</small><span>{m["use"]}</span></div>
        <img class="t-modelMark" src="{MEDIA}model-{slug}-black.png" alt="{m["name"]}">
        <p>{m["card_text"]}</p>
        <div class="t-idealFor"><small>Ideal para</small><ul>{"".join(f"<li>{x}</li>" for x in m["ideal"])}</ul></div>
        <div class="t-stackActions">
          <a href="/vehiculos/{slug}/">Descubrir el {m["name"]} <b>{ARROW}</b></a>
          <a class="x-consult" href="{mailto("Consulta " + m["name"])}" data-consult="{m["name"]}">Consultar {m["name"]} <b>{UP_RIGHT}</b></a>
        </div>
      </div>
    </article>''')
    head_html = '''  <header class="x-head">
    <div><p class="x-eyebrow" data-reveal>La familia TYN-e</p><h2 id="range-title" data-words>Un vehículo.<br><em>Muchas posibilidades.</em></h2></div>
    <span data-reveal style="--i:2">Tres plataformas eléctricas compactas para logística, municipios, oficios e industria: flexibles y hechas para el trabajo diario.</span>
  </header>
''' if head else ""
    return f'''<section class="x-range" id="vehiculos" aria-labelledby="range-title">
{head_html}  <div class="x-cards">
{chr(10).join(cards)}
  </div>
</section>
'''


def lineup(current=None):
    """Global t-lineup, with the 'choose your country' row turned into consult links for Spain."""
    cars = "".join(
        f'<a href="/vehiculos/{s}/" class="t-lineupCar{" t-lineupCurrent" if s == current else ""}" aria-label="TYN-e {MODELS[s]["name"]} {MODELS[s]["use"]}">'
        f'<img src="{MEDIA}{MODELS[s]["lineup_img"]}" alt="" loading="lazy"><span><img src="{MEDIA}model-{s}-white.png" alt="{MODELS[s]["name"]}"><small>{MODELS[s]["use"]}</small></span></a>'
        for s in ORDER)
    consult = "".join(f'<a href="{mailto("Consulta " + MODELS[s]["name"])}"><small>{MODELS[s]["name"]}</small>Consultar<b>{UP_RIGHT}</b></a>' for s in ORDER)
    return f'''<section class="t-fleet t-modelFamily" id="family">
	<div class="t-lineup" id="our-vehicles">
	<div class="t-lineupHead" data-reveal><p>Nuestros vehículos</p><h2>Toda la gama TYN-e<br><em>en España.</em></h2><span>Precios, disponibilidad y configuraciones para España: te informa TYN-e Brandstore Barcelona, nuestro distribuidor oficial.</span></div>
	<div class="t-lineupStage" data-reveal>{cars}<i class="t-lineupFloor" aria-hidden="true"></i></div>
	<nav class="t-lineupCountries" aria-label="Consultas en Barcelona" data-reveal><span>Consulta en Barcelona</span>{consult}</nav>
	</div>
</section>
'''


def model_page(slug):
    m = MODELS[slug]
    n = m["name"]
    bodies = (f'<div class="t-idealFor"><small>Carrocerías</small><ul>{"".join(f"<li>{b}</li>" for b in m["bodies"])}</ul></div>' if m["bodies"] else "")
    hl = "".join(
        f'<article data-reveal><figure><img data-ai-image src="{MEDIA}{img}" alt="TYN-e {n}: {h3}" loading="lazy"><span class="t-aiLabel">Imagen IA</span><span>0{i + 1}</span></figure>'
        f'<small>0{i + 1} · {n}</small><h3>{h3}</h3><strong>{strong}</strong><p>{p}</p></article>'
        for i, (img, h3, strong, p) in enumerate(m["highlights"]))
    others = [s for s in ORDER if s != slug]
    main = page_intro(MEDIA + m["intro_img"], f'<img src="{MEDIA}model-{slug}-white.png" alt="TYN-e {n}"><em>{m["use"]}</em>', m["intro_lead"],
                      trail=[("Vehículos", "/vehiculos/"), (n, None)], cls="t-pageIntroModel", pos=m["intro_pos"], ai=True)
    main += f'''<section class="t-fleet t-modelOverview" id="overview">
	<div class="t-fleetHead" data-reveal><div><p>TYN-e {n} · {m["use"]}</p><h2>{m["head"][0]}<br><em>{m["head"][1]}</em></h2></div><span>{m["head_text"]}</span></div>
	<article class="t-stackCard t-modelCard t-tone_{m["tone"]}" data-reveal>
		<div class="t-stackInner">
			<img data-ai-image class="t-stackImage" src="{MEDIA}{m["card_img"]}" alt="TYN-e {n} en el trabajo" style="object-position:{m["card_pos"]}"><span class="t-aiLabel">Imagen IA</span>
			<span class="t-stackShade"></span>
			<div class="t-stackPanel">
				<div class="t-stackMeta"><small>TYN-e</small><span>{m["use"]}</span></div>
				<img class="t-modelMark" src="{MEDIA}model-{slug}-black.png" alt="{n}">
				<p>{m["card_text"]}</p>
				<div class="t-idealFor"><small>Ideal para</small><ul>{"".join(f"<li>{x}</li>" for x in m["ideal"])}</ul></div>
				{bodies}<a class="x-panelCta" href="{mailto("Consulta " + n)}" data-consult="{n}">Consultar el {n} en Barcelona <b>{UP_RIGHT}</b></a>
			</div>
		</div>
	</article>
</section>
<section class="t-responsibility" id="highlights"><div class="t-responsibilityHead" data-reveal><div><p>Lo más destacado</p><h2>Por qué el {n}:</h2></div><span>{m["card_text"]}</span></div><div class="t-commitmentGrid">{hl}</div></section>
'''
    main += lineup(current=slug)
    main += explore("Vehículos", "Explora nuestros vehículos.", "Sigue descubriendo la gama TYN-e en España.",
                    [(f"0{MODELS[s]['order']}", f"{MODELS[s]['name']} · {MODELS[s]['use']}", MODELS[s]["explore_sub"], f"/vehiculos/{s}/") for s in others]
                    + [("04", "Brandstore Barcelona", "Ven a conocer la gama en Port Marina", "/brandstore-barcelona/")])
    return main


def overview_page():
    main = page_intro(MEDIA + "h-ltx-duo.jpg", "La familia<br><em>TYN-e.</em>",
                      "Tres vehículos comerciales compactos y 100&nbsp;% eléctricos para el trabajo diario en la ciudad.",
                      trail=[("Vehículos", None)], pos="center 60%", ai=True)
    main += card_grid(head=True)
    main += lineup()
    main += contact_cta()
    return main


def pages():
    out = [("/vehiculos/", "Vehículos", "LTX, TX1 y TX7: vehículos comerciales compactos y 100 % eléctricos. Consulta con TYN-e Brandstore Barcelona.", overview_page(), "/vehiculos/")]
    for slug in ORDER:
        m = MODELS[slug]
        out.append((f"/vehiculos/{slug}/", f"TYN-e {m['name']} · {m['use']}", f"TYN-e {m['name']} – {m['intro_lead']}", model_page(slug), "/vehiculos/"))
    return out
