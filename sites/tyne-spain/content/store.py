"""Brandstore Barcelona: shared store block (homepage + store page) and the store page.

Facts from tyn-e.com/es/brandstore-cafe (client to confirm they are current).
"""
from src.components import MEDIA, MAIL, PHONE, PHONE_HREF, ADDRESS_HTML, MAP_URL, page_intro, explore, mailto
from src.icons import ARROW, UP_RIGHT
from . import news

INFO = f'''  <dl class="x-info" data-reveal style="--i:2">
    <div><dt>Dirección</dt><dd>{ADDRESS_HTML}</dd></div>
    <div><dt>Teléfono</dt><dd><a href="{PHONE_HREF}">{PHONE}</a></dd></div>
    <div><dt>Correo</dt><dd><a href="mailto:{MAIL}">{MAIL}</a></dd></div>
    <div><dt>Horario</dt><dd>Lunes a viernes · 09:00–18:00<br>Sábado y domingo · cerrado<small>Oficina / coworking. Puede variar por eventos privados.</small></dd></div>
    <div><dt>Visita y prueba</dt><dd><span class="x-pend">Por confirmar</span></dd></div>
  </dl>
'''


def store_block(eyebrow="Distribuidor oficial en España", title="TYN-e Brandstore<br><em>Barcelona.</em>",
                text="Conoce la gama TYN-e en Port Marina, en Premià de Mar. Nuestro equipo te asesora en español y te ayuda a encontrar el vehículo adecuado para tu negocio.",
                more=True, sid="brandstore"):
    link = (f'<a class="x-btn x-btn-ghost" href="/brandstore-barcelona/">Conocer el Brandstore <b>{ARROW}</b></a>' if more
            else f'<a class="x-btn x-btn-ghost" href="{MAP_URL}" target="_blank" rel="noopener">Cómo llegar <b>{ARROW}</b></a>')
    return f'''<section class="x-store" id="{sid}" aria-labelledby="{sid}-title">
  <header class="x-head">
    <div><p class="x-eyebrow" data-reveal>{eyebrow}</p><h2 id="{sid}-title" data-words>{title}</h2></div>
    <span data-reveal style="--i:2">{text}</span>
  </header>
  <div class="x-store-photo" data-wipe>
    <img src="{MEDIA}store-interior.jpg" alt="Interior del TYN-e Brandstore Barcelona" loading="lazy" width="2000" height="1333" data-parallax>
  </div>
  <div class="x-store-card" data-reveal>
    <p class="x-eyebrow">Port Marina · Premià de Mar</p>
    <h3>Ven a vernos o escríbenos.</h3>
    <p>Todas las consultas comerciales las atiende el equipo de Barcelona.</p>
    <div class="x-store-actions">
      <a class="x-btn x-btn-primary" data-consult="Brandstore Barcelona" href="{mailto("Brandstore Barcelona")}">Escribir a Barcelona <b>{UP_RIGHT}</b></a>
      {link}
    </div>
  </div>
{INFO}</section>
'''


def store_page():
    main = page_intro(MEDIA + "store-van.jpg", "TYN-e Brandstore<br><em>Barcelona.</em>",
                      "Nuestro distribuidor oficial en España, en Port Marina, Premià de Mar.",
                      trail=[("Brandstore Barcelona", None)], pos="center 50%")
    # global HQ block (t-vision t-hq), localised to the Brandstore
    main += f'''<section class="t-vision t-hq t-tone-corporate" id="ubicacion">
	<div class="t-visionGrid">
		<div class="t-visionStatement" data-reveal>
			<p>Distribuidor oficial en España</p>
			<h2>Port Marina.<br><em>Premià de Mar.</em></h2>
			<div class="t-visionYear" aria-hidden="true"><strong>ES</strong><small>Brandstore</small></div>
		</div>
		<div class="t-visionText">
			<article data-reveal><small>Qué hacemos aquí</small><h3>Asesoramiento, venta y eventos.</h3><p>Conoce la gama TYN-e de cerca, recibe asesoramiento personal en español y vive nuestros eventos en Port Marina. Todas las consultas comerciales para España se gestionan desde aquí.</p></article>
			<article data-reveal><small>Visítanos</small><h3>TYN-e Brandstore Barcelona</h3><p>{ADDRESS_HTML}<br>Lunes a viernes, 09:00–18:00<br><a href="{PHONE_HREF}">{PHONE}</a> · <a href="mailto:{MAIL}">{MAIL}</a></p></article>
		</div>
	</div>
</section>
'''
    main += store_block(eyebrow="Visita el Brandstore", title="Un espacio<br><em>para conocer TYN-e.</em>",
                        text="Nuestro Brandstore une la gama TYN-e con un ambiente acogedor junto al mar. Ven a ver los vehículos, habla con el equipo y descubre nuestras actividades.",
                        more=False, sid="visita")
    gallery = "".join(f'<figure data-wipe><img src="{MEDIA}{f}" alt="{a}" loading="lazy"></figure>' for f, a in
                      [("store-van.jpg", "Vehículo TYN-e en el Brandstore"), ("store-table.jpg", "Detalle del Brandstore"), ("../news/reunion-decathlon-brandstore/15062025-_Evento-Decathlon-Imag-07-OK-1024x884.jpg", "Evento en el Brandstore")])
    main += f'''<section class="x-section x-store-gallery" aria-label="Fotos del Brandstore"><div class="x-gallery x-gallery-3">{gallery}</div></section>
'''
    main += news.news_section_for_store()
    main += explore("Contacto", "¿Cómo podemos ayudarte?", "Escríbenos, llámanos o ven a vernos a Port Marina.",
                    [("01", "Escribir a Barcelona", MAIL, mailto("Brandstore Barcelona")),
                     ("02", "Llamar", PHONE, PHONE_HREF),
                     ("03", "Cómo llegar", "Camí Ral s/n · Port Marina · Premià de Mar", MAP_URL),
                     ("04", "Ver los vehículos", "LTX · TX1 · TX7", "/vehiculos/")], sid="ayuda")
    return main


def pages():
    return [("/brandstore-barcelona/", "Brandstore Barcelona", "TYN-e Brandstore Barcelona: distribuidor oficial de TYN-e en España, en Port Marina, Premià de Mar. Dirección, horario y contacto.", store_page(), "/brandstore-barcelona/")]
