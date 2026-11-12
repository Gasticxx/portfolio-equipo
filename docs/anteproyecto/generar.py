"""Genera el anteproyecto a partir del sistema visual y sus capturas locales."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white
from reportlab.lib.utils import ImageReader
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/pdf/Anteproyecto_Reflection_Tech.pdf'
OUT.parent.mkdir(parents=True, exist_ok=True)
for name, file in [('Regular','segoeui.ttf'),('Bold','segoeuib.ttf')]:
    pdfmetrics.registerFont(TTFont(name, 'C:/Windows/Fonts/'+file))
W,H=595.28,841.89
c=canvas.Canvas(str(OUT),pagesize=(W,H))
c.setTitle('Anteproyecto del portfolio Reflection Tech - Manual de Diseño y Estilo')
c.setAuthor('Reflection Tech')
INK='#0F172A'; BLUE='#1D4ED8'; MUTED='#475569'
style=ParagraphStyle('body',fontName='Regular',fontSize=10.5,leading=16,textColor=HexColor(MUTED))
def text(s,x,y,size=11,color=INK,font='Regular'):
    c.setFillColor(HexColor(color));c.setFont(font,size);c.drawString(x,y,s)
def para(s,y,x=44,w=507,size=10.5):
    st=ParagraphStyle('p',parent=style,fontSize=size,leading=size*1.5)
    p=Paragraph(s,st);_,h=p.wrap(w,H);p.drawOn(c,x,y-h);return y-h-14
def page(n,title,subtitle):
    c.setFillColor(HexColor('#F8FAFC'));c.rect(0,0,W,H,fill=1,stroke=0)
    text('REFLECTION TECH',44,802,10,BLUE,'Bold');text('LENGUAJES 4  /  ANTEPROYECTO',295,802,9,MUTED)
    text(title,44,750,25,INK,'Bold');para(subtitle,729)
    text('Manual de Diseño y Estilo  •  Noviembre 2026',44,27,8,MUTED)
    text(f'{n:02d} / 08',508,27,8,MUTED)
def heading(s,y):text(s,44,y,14,INK,'Bold');return y-17
def image(name,x,y,w,maxh=None):
    im=ImageReader(str(ROOT/'docs/anteproyecto/assets'/name));iw,ih=im.getSize();h=w*ih/iw
    if maxh and h>maxh:w=w*maxh/h;h=maxh
    c.drawImage(im,x,y-h,width=w,height=h);return y-h
def end():c.showPage()

page(1,'Anteproyecto del portfolio','Manual de Diseño y Estilo del Reflection Tech')
text('Diseño, código y equipo',44,660,29,BLUE,'Bold')
para('Propuesta visual para presentar a seis estudiantes, sus especialidades, servicios y proyectos en un portfolio colectivo. La interfaz busca facilitar el descubrimiento del equipo y el contacto con potenciales interesados.',629)
image('inicio-pc.png',44,535,507)
para('<b>Asignatura:</b> Lenguajes 4<br/><b>Proyecto:</b> Portfolio web fullstack del Reflection Tech<br/><b>Entrega:</b> Anteproyecto presentado como guía de estilo',151)
end()

page(2,'01  Concepto e identidad','Una identidad compartida para mostrar personas, capacidades y proyectos.')
y=heading('Propósito y público',658)
y=para('El sitio permite conocer al equipo, explorar sus trabajos y consultar por servicios. Está dirigido a docentes, compañeros y personas interesadas en sus capacidades de desarrollo. La presentación debe explicar qué hace el grupo y cómo iniciar una consulta.',y)
y=heading('Dirección visual',y-10)
y=para('Se propone una estética de vidrio translúcido sobre fondos azules y lavanda. Los planos superpuestos de la portada representan distintas perspectivas que se reúnen en un mismo equipo. El azul identifica acciones; el texto oscuro sostiene la lectura.',y)
y=heading('Marca y tono',y-10)
y=para('La marca utiliza el nombre «Reflection Tech» y el monograma RT. Debe permanecer legible en la cabecera y funcionar como enlace a Inicio. El tono de los textos es cercano, directo y colaborativo: «Conocer al equipo», «Explorar proyectos» y «Contactar al equipo».',y)
y=heading('Contenido y alcance',y-10)
y=para('El anteproyecto comprende Inicio, Equipo, perfil individual, Servicios, Proyectos, detalle y Contacto. Contempla acceso, registro y vistas de panel según el rol. Las capturas corresponden al entorno de revisión I3: muestran la propuesta visual y pueden contener textos y datos de muestra.',y)
y=heading('Criterios de consistencia',y-10)
para('Mantener la misma cabecera, espaciados y estilo de botones en todas las vistas. Priorizar una acción principal por sección. Reservar los colores de estado para mensajes y conservar etiquetas visibles en formularios. Los nombres, retratos y aportes se completan con información verificada por el equipo.',y)
end()

page(3,'02  Paleta de colores','Colores del sistema existente y función de cada uno dentro de la interfaz.')
colors=[('Primario','#1D4ED8','Botones principales, enlaces y foco.'),('Primario al interactuar','#1E40AF','Respuesta visual al pasar sobre una acción.'),('Fondo','#F8FAFC','Base de las páginas.'),('Superficie','#FFFFFF','Tarjetas, campos y paneles.'),('Texto principal','#0F172A','Títulos, navegación y contenido principal.'),('Texto secundario','#475569','Descripciones, ayudas y contenido auxiliar.'),('Borde','#CBD5E1','Límites de campos y superficies.'),('Éxito','#166534','Confirmaciones con texto e icono.'),('Error','#B91C1C','Errores y acciones destructivas.'),('Advertencia','#92400E','Avisos y situaciones que requieren atención.')]
y=663
for name,hx,desc in colors:
    c.setFillColor(HexColor(hx));c.roundRect(44,y-36,45,36,6,fill=1,stroke=0)
    text(name,102,y-9,10.5,INK,'Bold');text(hx,405,y-9,10,MUTED)
    text(desc,102,y-27,9,MUTED);y-=49
para('<b>Acentos decorativos:</b> lavanda #6374C5 en el degradado de títulos y celeste #BBCFFA en el ambiente. Vidrio blanco al 72 % de opacidad. Evitar textos extensos sobre fondos complejos; comprobar contraste al cambiar transparencias.',154)
end()

page(4,'03  Tipografía y componentes','Una familia local, una jerarquía clara y controles reconocibles.')
y=para('<b>Familia:</b> system-ui, -apple-system, Segoe UI, sans-serif. En Windows se utiliza Segoe UI; el sistema elige su fuente equivalente en otros dispositivos. No requiere descarga externa.',663)
for label,spec,sample,size in [('Título principal','40 px PC / 32 px móvil · 700','Ideas que conectan.',26),('Título de sección','28 px PC / 24 px móvil · 700','El equipo detrás de las ideas.',19),('Título de tarjeta','22 px PC / 20 px móvil · 600','Proyectos con propósito',15),('Cuerpo de texto','16 px · 400 · interlineado 1,5','Seis perspectivas que construyen una experiencia común.',11),('Ayuda y texto auxiliar','14 px · 400','Los campos con * son obligatorios.',10)]:
    text(label,44,y-8,10,BLUE,'Bold');text(spec,229,y-8,9,MUTED)
    text(sample,44,y-40,size,INK,'Bold' if size>11 else 'Regular');y-=78
y=heading('Botones y superficies',y-4)
y=para('Acción principal: fondo azul y texto blanco. Acción secundaria: superficie clara con borde. Altura mínima de botones de 44 px. Radio base de tarjetas de 12 px y controles de 8 px; las composiciones de portada usan curvas mayores para reforzar el efecto de vidrio.',y)
para('<b>Espaciado:</b> escala de 4, 8, 12, 16, 24, 32, 48 y 64 px. Contenedor máximo de 1200 px, con márgenes laterales de 24 px en PC y 16 px en móvil. No usar solo color para distinguir estados.',y)
end()

page(5,'04  Preview de escritorio','Inicio y catálogo de proyectos en el prototipo local, a 1440 px de ancho.')
image('inicio-pc.png',44,671,440,maxh=306)
para('<b>Inicio.</b> Cabecera con navegación, presentación principal, dos llamadas a la acción y composición gráfica del equipo. El resto de las secciones continúa al desplazar la página.',350)
image('proyectos-pc.png',44,286,300,maxh=209)
para('<b>Proyectos</b><br/>Tarjetas con información y acceso al detalle. La imagen muestra el contenido de revisión; los proyectos definitivos se incorporarán desde el módulo correspondiente.',278,x=363,w=188,size=10)
end()

page(6,'05  Preview de celular','Inicio y Contacto en una ventana de 390 px. Las imágenes muestran la primera pantalla.')
image('inicio-movil.png',57,669,214,maxh=463)
image('contacto-movil.png',327,669,181,maxh=463)
para('<b>Inicio</b><br/>El menú se pliega y las acciones se distribuyen en el ancho disponible. La composición gráfica continúa debajo del texto.',180,x=44,w=232,size=10)
para('<b>Contacto</b><br/>Presentación y formulario en una columna. Etiquetas persistentes y campos amplios; los campos restantes se alcanzan con desplazamiento vertical.',180,x=315,w=236,size=10)
end()

page(7,'06  Navegación y adaptación','Recorridos previstos y reglas para conservar la claridad en cualquier pantalla.')
y=heading('Mapa de navegación',661)
for s in ['Inicio → Equipo → Perfil del integrante','Inicio → Servicios → Contacto para consulta o cotización','Inicio → Proyectos → Detalle → Demo disponible','Ingresar / Registrarse → Mi cuenta → Opciones según el rol']:
    y=para(s,y)
y=heading('Comportamiento por tamaño',y-8)
y=para('<b>PC desde 992 px:</b> distribución amplia, portada en dos áreas y navegación según el espacio disponible. Entre 992 y 1199 px, la navegación puede ocupar una segunda fila.<br/><b>Tablet de 768 a 991 px:</b> menú plegable, tarjetas con ajuste de columnas y controles con espacio suficiente.<br/><b>Celular hasta 767 px:</b> contenido y formularios en una columna; portada apilada y márgenes reducidos. El carrusel del equipo mantiene botones anterior y siguiente.',y)
y=heading('Interacción y accesibilidad',y-8)
y=para('El menú móvil debe abrir y cerrar con botón, informar su estado y permitir Escape. Todos los enlaces y controles deben ser utilizables con teclado y mostrar foco visible. El enlace «Saltar al contenido» evita recorrer toda la cabecera. Los errores se explican con texto junto al campo y los mensajes de resultado se anuncian a tecnologías de asistencia.',y)
y=heading('Movimiento y estados',y-8)
para('Los efectos de fondo, tarjetas y botones acompañan la navegación. Deben respetar la preferencia de movimiento reducido y permitir pausar efectos. Cada vista debe prever carga, vacío, error y éxito. Un envío solo se confirma cuando el servidor informa el resultado; las pantallas de muestra no prueban esa integración.',y)
end()

page(8,'07  Prototipo y entrega','Pantallas de referencia, criterios de revisión y fuentes del anteproyecto.')
image('componentes-pc.png',44,669,295,maxh=226)
para('<b>Biblioteca visual</b><br/>Vista de componentes para revisar tarjetas, mensajes, campos y estados con el mismo lenguaje gráfico.',658,x=362,w=189,size=10)
y=heading('Revisión antes de la integración',412)
y=para('Verificar las vistas a 390, 768, 1024 y 1440 px; comprobar que ningún contenido produzca desplazamiento horizontal. Recorrer navegación y formularios con teclado, revisar menú móvil y contrastes, probar textos largos y confirmar la legibilidad con movimiento reducido. Reemplazar los datos de muestra y validar las acciones al conectar cada módulo.',y)
y=heading('Cómo consultar el prototipo',y-5)
y=para('Con las dependencias instaladas, ejecutar <b>node scripts/preview-i3.js</b> desde la carpeta del proyecto y abrir <b>http://127.0.0.1:3033/i3</b>. El servidor de revisión no requiere base de datos. Permite recorrer Inicio, Equipo, Servicios, Proyectos, Contacto y las muestras de componentes.',y)
y=heading('Referencias',y-5)
y=para('Consigna de Lenguajes 4: Anteproyecto como Manual de Marca / Guía de Estilo, aportada en la imagen del trabajo práctico. Base visual y técnica: docs/manual-diseno.md, src/public/css/app.css y vistas del prototipo I3 del repositorio del Reflection Tech.',y,size=9)
para('Referencia de presentación aportada: <a href="https://www.behance.net/gallery/251694753/LUMIX-REALTY-Premium-Property-Landing-Page" color="#1D4ED8">LUMIX REALTY · Premium Property Landing Page · Behance</a>. Se conserva como enlace de consulta para el manual.',y,size=9)
end()
c.save()
print(OUT)
