# Bocetos y recorridos de I3

La muestra usa `/i3` para conservar el inicio original. Las rutas finales se coordinan con I2. Las pantallas de otros autores son referencias visuales, sin backend propio.

## Estructura de escritorio y móvil

```text
ESCRITORIO (1200 px máximo)
┌ marca ─ Inicio Equipo Servicios Proyectos Contacto ─ acceso ┐
│ título + texto + acciones       composición visual de vidrio│
├ tecnologías ───────────────────────────────────────────────┤
│ sección + enlace                                           │
│ tarjeta 1            tarjeta 2            tarjeta 3          │
│ sección / proyecto              explicación                 │
│ llamada a contacto                                         │
└ marca ─ texto ─ navegación del pie ─────────────────────────┘

MÓVIL (16 px de margen)
┌ marca ───────── Menú ┐
│ navegación expandida│ ← botón con aria-expanded; Escape cierra
│ título              │
│ texto / acciones    │
│ composición visual │
│ tecnologías        │
│ tarjeta 1          │
│ tarjeta 2          │
│ tarjeta 3…         │
│ contacto / pie     │
└────────────────────┘
```

## Pantallas

| Pantalla | Escritorio | Móvil | Retorno |
| --- | --- | --- | --- |
| Inicio | Hero en dos columnas, tarjetas de referencia | Hero apilado, tarjetas en una columna | Marca / navegación |
| Equipo | Seis tarjetas, tres por fila | Una por fila | Inicio / pie |
| Perfil | Tarjeta y detalle en dos columnas | Retrato, presentación, formación, tecnologías y aportes | Equipo / marca |
| Servicios | Tres tarjetas con CTA | Tarjetas apiladas | Inicio / contacto |
| Proyectos | Portada 16:9, estado y stack | Tarjetas a ancho disponible | Inicio |
| Detalle | Descripción, aportes y accesos a demos | Contenido y botones apilados | Proyectos |
| Demo tablero | Formulario y tres columnas | Formulario y columnas verticales | Proyecto |
| Demo algoritmos | Controles en dos columnas, pasos y resultado | Controles apilados, valores con scroll interno si hace falta | Proyecto |
| Contacto | Contexto lateral y formulario | Contexto encima del formulario | Inicio |
| Registro / login | Contexto y formulario | Columna única | Inicio / cuenta después de integrar |
| Paneles | Filtros, indicadores, tabla desplazable y acciones | Filtros apilados y tabla con scroll interno | Cuenta / navegación |

## Roles y coordinación

Visitante ve navegación pública, Ingresar y Registrarse. Registrado ve Mi cuenta y Salir. Operador agrega Consultas; administrador agrega Administración. Los integrantes públicos I1–I6 no son roles de autorización. La muestra se abre siempre como visitante; no simula sesiones ni permite privilegios.

En producción, acceder a detalle/demo sin sesión se resuelve con el middleware y redirección de I4; rol insuficiente tiene 403 y recurso no publicado/inexistente tiene 404. El layout no puede autorizar acceso. Los formularios y permisos definitivos deben validarse con cada autor antes de integrar.

Los bocetos de panel y componentes incluyen carga, vacío, error y éxito. Los gráficos reales de I6 necesitan filtros con etiquetas, leyendas legibles y una tabla con los mismos datos; no usar solo color para distinguir series.
