"""Legal pages in Spanish, translated from the global pages (tyn-e.com/legal-notice, /privacy-policy,
/cookie-settings). Pending review by TYN-e (see the client checklist): hosting, analytics and
newsletter sections describe the global site and must be adapted to the Spanish site's final setup.
"""
from src.components import MEDIA, page_intro, prose

P = '<p class="wp-block-paragraph">'
H = '<h2 class="wp-block-heading">'

AVISO = f'''{P}<strong>TYN-e Europe GmbH</strong><br>Albrecht-Villinger-Straße 10<br>71332 Waiblingen, Alemania</p>
{P}<a href="mailto:info@tyn-e.com">info@tyn-e.com</a> | <a href="mailto:jobs@tyn-e.com">jobs@tyn-e.com</a> | <a href="mailto:presse@tyn-e.com">presse@tyn-e.com</a><br>Teléfono: <a href="tel:+4971512572841">+49 (0) 7151 257 28 41</a></p>
{P}Distribuidor en España: TYN-e Brandstore Barcelona · Camí Ral s/n, Port Marina, 08330 Premià de Mar (Barcelona) · <a href="mailto:barcelona@tyn-e.com">barcelona@tyn-e.com</a></p>
{H}Representada por</h2>
{P}Director general: Markus B. F. Graf</p>
{H}Inscripción registral</h2>
{P}Inscripción en el registro mercantil<br>Tribunal de registro: Juzgado de Primera Instancia de Stuttgart (Amtsgericht Stuttgart), HRB 792106<br>Número fiscal: 90495/46280<br>NIF-IVA: DE365474011<br>Domicilio social: Waiblingen</p>
{P}La normativa profesional puede consultarse en el sitio web <a href="https://www.gesetze-im-internet.de" target="_blank" rel="noopener">www.gesetze-im-internet.de</a>, gestionado por el Ministerio Federal de Justicia de Alemania y juris GmbH.</p>
{H}Derechos de autor</h2>
{P}Los contenidos y obras creados por los operadores de este sitio están sujetos a la legislación alemana sobre derechos de autor. La reproducción, edición, distribución y cualquier tipo de explotación fuera de los límites de dicha legislación requieren el consentimiento por escrito del autor o creador correspondiente. Las descargas y copias de este sitio solo están permitidas para uso privado y no comercial. En la medida en que los contenidos de este sitio no hayan sido creados por el operador, se respetan los derechos de autor de terceros; en particular, los contenidos de terceros se identifican como tales. Si, no obstante, detecta una infracción de los derechos de autor, le rogamos que nos lo comunique. En cuanto tengamos conocimiento de cualquier infracción, retiraremos dichos contenidos de inmediato.</p>
{H}Programación, diseño e implementación</h2>
{P}ZLink Studio<br>Web: <a href="https://www.gozlink.com" target="_blank" rel="noopener">www.gozlink.com</a></p>
{H}Limitación de responsabilidad</h2>
{P}El contenido de este sitio web se elabora con el mayor cuidado posible. No obstante, el proveedor no asume ninguna responsabilidad por la exactitud, integridad y actualidad de los contenidos ofrecidos. El uso de los contenidos del sitio web se realiza por cuenta y riesgo del usuario. Las contribuciones firmadas reflejan la opinión de su autor y no siempre la del proveedor. El mero uso del sitio web del proveedor no da lugar a ninguna relación contractual entre el usuario y el proveedor.</p>
{H}Enlaces externos</h2>
{P}Este sitio web contiene enlaces a sitios web de terceros («enlaces externos»). Dichos sitios web están sujetos a la responsabilidad de sus respectivos operadores. Al crear los enlaces externos por primera vez, el proveedor comprobó si los contenidos de terceros presentaban posibles infracciones legales; en ese momento no se apreció ninguna. El proveedor no tiene ninguna influencia sobre el diseño y el contenido actuales y futuros de las páginas enlazadas. La inclusión de enlaces externos no significa que el proveedor haga suyos los contenidos que se encuentran tras la referencia o el enlace. No es razonable exigir al proveedor un control permanente de estos enlaces externos sin indicios concretos de infracciones legales. Si se tiene conocimiento de infracciones legales, dichos enlaces externos se eliminarán de inmediato.</p>
{H}Derechos de autor y derechos afines</h2>
{P}Los contenidos publicados en este sitio web están sujetos a la legislación alemana sobre derechos de autor y derechos afines. Cualquier uso no permitido por dicha legislación requiere el consentimiento previo por escrito del proveedor o del titular de los derechos correspondiente. Esto se aplica en particular a la reproducción, edición, traducción, almacenamiento, tratamiento o reproducción de contenidos en bases de datos u otros medios y sistemas electrónicos. Los contenidos y derechos de terceros se identifican como tales. La reproducción o distribución no autorizada de contenidos individuales o de páginas completas no está permitida y es punible. Solo se permite realizar copias y descargas para uso personal, privado y no comercial. La presentación de este sitio web en marcos de terceros solo está permitida con autorización por escrito.</p>
{H}Protección de datos</h2>
{P}Consulte la <a href="/privacidad/">política de privacidad</a>.</p>
{H}Condiciones especiales de uso</h2>
{P}Cuando las condiciones especiales para usos concretos de este sitio web difieran de las disposiciones anteriores, se indicará expresamente en el lugar correspondiente. En ese caso, se aplicarán en cada caso las condiciones especiales de uso.</p>
'''

PRIVACIDAD = f'''{P}Última actualización: noviembre de 2026</p>
{H}1. Responsable del tratamiento</h2>
{P}El responsable del tratamiento de datos en este sitio web, en el sentido del Reglamento General de Protección de Datos (RGPD), es:</p>
{P}TYN-e Europe GmbH<br>Albrecht-Villinger-Straße 10<br>71332 Waiblingen, Alemania<br>Teléfono: +49 7151 257 28 41<br>Correo electrónico: <a href="mailto:info@tyn-e.com">info@tyn-e.com</a><br>Director general: Markus B. F. Graf</p>
{P}No estamos legalmente obligados a designar un delegado de protección de datos. Si tiene preguntas sobre la protección de datos, póngase en contacto con nosotros en la dirección indicada.</p>
{H}2. Resumen</h2>
{P}Este es el sitio web de TYN-e para España. A continuación se describe el tratamiento de datos y los servicios de terceros.</p>
{H}3. Alojamiento y entrega de contenidos</h2>
{P}El sitio web global de TYN-e está alojado por ALL-INKL.COM – Neue Medien Münnich, titular: René Münnich, Hauptstraße 68, 02742 Friedersdorf, Alemania. Los servidores se encuentran en Alemania. El proveedor de alojamiento trata los datos técnicos de acceso descritos en el apartado siguiente para entregar y proteger el sitio web. Encontrará más información en la información de privacidad de ALL-INKL.</p>
{P}La base jurídica es nuestro interés legítimo en una presentación segura, rápida y fiable de nuestro sitio web (art. 6, apdo. 1, letra f del RGPD).</p>
{H}4. Archivos de registro del servidor</h2>
{P}Cuando visita nuestro sitio web, el servidor registra automáticamente la información que transmite su navegador: dirección IP, fecha y hora de la solicitud, página solicitada, sitio web de procedencia, tipo y versión del navegador y sistema operativo. Estos datos son necesarios para entregar el sitio web y garantizar su seguridad (por ejemplo, para detectar ataques). No se combinan con otras fuentes de datos. Los archivos de registro se conservan durante un tiempo limitado y después se eliminan. Base jurídica: art. 6, apdo. 1, letra f del RGPD.</p>
{H}5. Cookies y almacenamiento local</h2>
{P}Su navegador puede guardar en el almacenamiento local su elección de tema claro u oscuro. Si decide cargar contenidos externos, el proveedor correspondiente también puede utilizar tecnologías de almacenamiento; consulte su información de privacidad.</p>
{H}Google Analytics 4</h2>
{P}Con su consentimiento, utilizamos Google Analytics 4, de Google Ireland Limited, Gordon House, Barrow Street, Dublín 4, Irlanda, para entender el uso del sitio web y mejorarlo. Recoge visitas a páginas, interacciones, información del navegador y del dispositivo, ubicación aproximada e identificadores seudónimos de cookies. Analytics solo se carga después de que usted lo acepte; si lo rechaza, permanece desactivado. No otorgamos consentimiento para el almacenamiento ni la personalización publicitaria.</p>
{P}Puede retirar su consentimiento en cualquier momento a través de la <a href="/cookies/">configuración de cookies</a>. Así se detiene la recogida futura de datos analíticos en este navegador y se eliminan sus cookies de GA. Google puede tratar datos fuera de la UE, también en Estados Unidos. Los plazos de conservación configurados son de 2 meses para los datos de eventos y de 14 meses para los datos de usuario; una nueva actividad puede renovar el plazo de conservación de los datos de usuario. Estos límites no se aplican a los informes agregados.</p>
{H}6. Fuentes y vídeos</h2>
{P}Las fuentes, imágenes y vídeos que utiliza el sitio se sirven desde nuestro servidor web.</p>
{H}7. Contacto por correo electrónico o teléfono</h2>
{P}Si se pone en contacto con nosotros por correo electrónico (por ejemplo, a <a href="mailto:barcelona@tyn-e.com">barcelona@tyn-e.com</a>) o por teléfono, tratamos los datos que nos facilite (por ejemplo, nombre, dirección de correo electrónico, número de teléfono y contenido de su mensaje) para responder a su consulta. La base jurídica es el art. 6, apdo. 1, letra b del RGPD si su consulta está relacionada con un contrato o con medidas precontractuales, y en los demás casos nuestro interés legítimo en responder a las consultas (art. 6, apdo. 1, letra f del RGPD). Eliminamos los datos una vez atendida su consulta, salvo que existan obligaciones legales de conservación.</p>
{H}8. Enlaces a otros sitios web y redes sociales</h2>
{P}Este sitio web contiene enlaces simples a otros sitios de TYN-e y a nuestros perfiles en redes sociales (por ejemplo, Instagram, LinkedIn, Facebook). Al visitar nuestro sitio web no se transmite ningún dato a estos proveedores. Solo al hacer clic en un enlace se le redirige al proveedor correspondiente, cuya política de privacidad se aplica a partir de ese momento.</p>
{H}9. Cifrado SSL/TLS</h2>
{P}Por motivos de seguridad, este sitio web utiliza cifrado SSL/TLS. Puede reconocer una conexión cifrada por el «https://» en la barra de direcciones de su navegador.</p>
{H}10. Sus derechos</h2>
{P}Tiene derecho a obtener información sobre los datos personales que tratamos (art. 15 del RGPD), a la rectificación de datos incorrectos (art. 16 del RGPD), a la supresión de sus datos (art. 17 del RGPD), a la limitación del tratamiento (art. 18 del RGPD), a la portabilidad de los datos (art. 20 del RGPD) y a oponerse al tratamiento basado en intereses legítimos (art. 21 del RGPD). Si el tratamiento se basa en su consentimiento, puede retirarlo en cualquier momento con efectos para el futuro (art. 7, apdo. 3 del RGPD). Para ejercer sus derechos, basta con escribirnos a <a href="mailto:info@tyn-e.com">info@tyn-e.com</a>.</p>
{P}También tiene derecho a presentar una reclamación ante una autoridad de control de protección de datos. La autoridad competente para nosotros es el Comisionado Estatal de Protección de Datos y Libertad de Información de Baden-Wurtemberg (Landesbeauftragter für den Datenschutz und die Informationsfreiheit Baden-Württemberg), <a href="https://www.baden-wuerttemberg.datenschutz.de" target="_blank" rel="noopener">www.baden-wuerttemberg.datenschutz.de</a>. En España también puede dirigirse a la Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>).</p>
{H}11. Cambios en esta política de privacidad</h2>
{P}Podemos actualizar esta política de privacidad si cambian el sitio web o los requisitos legales. La versión vigente está siempre disponible en esta página.</p>
'''

COOKIES = f'''{P}Guardamos en su navegador su preferencia de tema y su elección sobre la analítica. Google Analytics 4 solo se carga después de que acepte las cookies analíticas. Si las rechaza, no se carga.</p>
{P}Puede cambiar su elección o retirar su consentimiento en cualquier momento. Las cookies analíticas (_ga y _ga_*) ayudan a medir las visitas y las interacciones. El consentimiento publicitario permanece desactivado. Encontrará más detalles en nuestra <a href="/privacidad/">política de privacidad</a>.</p>
{P}<button type="button" class="x-btn x-btn-primary" data-open-consent>Cambiar la configuración de cookies</button></p>
'''

LEGAL = [
    ("/aviso-legal/", "Aviso legal", AVISO, "Aviso legal de TYN-e España."),
    ("/privacidad/", "Política de privacidad", PRIVACIDAD, "Política de privacidad de TYN-e España."),
    ("/cookies/", "Configuración de cookies", COOKIES, "Configuración de cookies de TYN-e España."),
]


def pages():
    out = []
    for path, title, body, desc in LEGAL:
        main = page_intro(MEDIA + "g-showroom-wide.jpg", title, trail=[(title, None)], cls="t-textIntro", pos="center 55%")
        main += prose(body)
        out.append((path, title, desc, main, None))
    return out
