"""Contacto: global contact page structure (intro, contact block, location, prose, related pages)."""
from src.components import MEDIA, MAIL, PHONE, PHONE_HREF, ADDRESS_HTML, MAP_URL, page_intro, explore, prose, mailto


def contact_page():
    main = page_intro(MEDIA + "store-interior.jpg", "Hablemos de<br><em>tu negocio.</em>",
                      "Vehículos, precios, visitas y eventos: te atiende el equipo de TYN-e Brandstore Barcelona.",
                      trail=[("Contacto", None)], pos="center 50%")
    main += explore("Contacto", "Habla con TYN-e España.",
                    f"TYN-e Brandstore Barcelona<br>{ADDRESS_HTML}<br><a href=\"{PHONE_HREF}\">{PHONE}</a> · Lun–Vie 09:00–18:00",
                    [("01", "Solicitar información", "La gama TYN-e y el Brandstore", mailto("Solicitud de información")),
                     ("02", "Consultar LTX", "Furgoneta urbana", mailto("Consulta LTX")),
                     ("03", "Consultar TX1", "El todoterreno · última milla", mailto("Consulta TX1")),
                     ("04", "Consultar TX7", "Carga pesada", mailto("Consulta TX7")),
                     ("05", "Llamar al Brandstore", PHONE, PHONE_HREF),
                     ("06", "Cómo llegar", "Camí Ral s/n · Port Marina", MAP_URL)],
                    label="Opciones de contacto", cls="", sid="contact")
    main += f'''<section class="t-vision t-hq t-tone-corporate" id="visitanos">
	<div class="t-visionGrid">
		<div class="t-visionStatement" data-reveal>
			<p>Distribuidor oficial en España</p>
			<h2>Port Marina.<br><em>Premià de Mar.</em></h2>
			<div class="t-visionYear" aria-hidden="true"><strong>ES</strong><small>Brandstore</small></div>
		</div>
		<div class="t-visionText">
			<article data-reveal><small>Qué hacemos aquí</small><h3>Ventas, asesoramiento y eventos en España.</h3><p>Información de vehículos, precios, disponibilidad y visitas para clientes en España.</p></article>
			<article data-reveal><small>Visítanos</small><h3>TYN-e Brandstore Barcelona</h3><p>{ADDRESS_HTML}<br>Lunes a viernes, 09:00–18:00<br><a href="{PHONE_HREF}">{PHONE}</a> · <a href="mailto:{MAIL}">{MAIL}</a></p></article>
		</div>
	</div>
</section>
'''
    main += prose('<h2 class="wp-block-heading">Vehículos, precios y distribuidores</h2>'
                  '<p class="wp-block-paragraph">Información de vehículos, precios, pruebas, servicio y distribución en España: todas las consultas las gestiona TYN-e Brandstore Barcelona, nuestro distribuidor oficial. '
                  f'Escríbenos a <a href="mailto:{MAIL}">{MAIL}</a> y te responderemos lo antes posible.</p>'
                  '<p class="wp-block-paragraph">Para asuntos corporativos, prensa o empleo, visita el <a href="https://tyn-e.com/company/contact/" target="_blank" rel="noopener">sitio global de TYN-e</a>.</p>')
    main += explore("España", "Más de TYN-e España.", "Sigue descubriendo.",
                    [("01", "Vehículos", "LTX · TX1 · TX7", "/vehiculos/"),
                     ("02", "Brandstore Barcelona", "Nuestro distribuidor en Port Marina", "/brandstore-barcelona/"),
                     ("03", "Noticias", "Eventos y actividades en España", "/noticias/")])
    return main


def pages():
    return [("/contacto/", "Contacto", "Contacta con TYN-e España: TYN-e Brandstore Barcelona, Port Marina, Premià de Mar. barcelona@tyn-e.com.", contact_page(), "/contacto/")]
