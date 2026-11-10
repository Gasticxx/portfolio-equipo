# Estado de integración de I3

## Aplicación principal

| Elemento | Ruta | Estado |
| --- | --- | --- |
| Inicio, navegación, temas y animaciones | `/` y cabecera compartida | Integrados; enlaces adaptados a las rutas principales |
| Equipo y perfiles | `/equipo`, `/equipo/I1` a `/equipo/I6` | Diseño integrado, contenido de muestra de `src/ui-i3/equipo.js` |
| Servicios y tarjetas de proyectos | `/servicios`, `/proyectos` | Diseño integrado; falta reemplazar el contenido de muestra por los módulos de datos |
| Contacto | `/contacto` | Formulario real de I6; si no conecta la base, abre con aviso y no permite enviar |
| Registro, ingreso y cuenta | `/registro`, `/login`, `/mi-cuenta` | Vistas reales de I4; requieren base operativa para autenticar y guardar |
| Presentación del portfolio | `/detalle` | Presentación pública con acceso al detalle protegido |
| Detalle de proyecto y visualizador | `/proyectos/:slug`, `/demos/:id` | Integrados; requieren sesión, proyecto publicado y demo publicada |
| Recurso del visualizador | `/demos/:id/recurso.js` | Motor e interfaz privados, protegidos por los mismos permisos que la vista |
| Tablero de tareas | Solo en el preview | Pendiente: API, persistencia y aislamiento por usuario. La muestra en memoria no se publica como demo final |
| Biblioteca de componentes | Solo en el preview | Referencia de diseño, no una sección pública del portfolio |
| Panel de referencia | Solo en el preview | Boceto de I3. Las métricas reales pertenecen a `/admin/metricas` y están protegidas |

## Visualizador

El acceso desde las tarjetas de proyectos lleva a `/proyectos/portfolio-equipo`.
Si falta sesión, se redirige al ingreso conservando el destino. El detalle lista
únicamente demos de algoritmos publicadas del proyecto publicado. La vista y su
script comprueban los mismos permisos; una demo inexistente o sin publicar devuelve
404. El tablero aún no tiene una implementación final.

El motor `src/ui-i3/demos/algoritmos-motor.js` genera pasos reales de búsqueda lineal
y burbuja para listas de 1 a 20 enteros entre -99 y 99. Admite negativos, duplicados,
un solo valor y búsquedas sin coincidencia, sin modificar la entrada. La interfaz
conserva iniciar, pausa, paso manual, reinicio y velocidad configurable.

El preview conserva sus dos secuencias fijas para revisión independiente. No se
monta `/i3/muestras` en la aplicación principal.

## Límites de la verificación local

La conexión local a PostgreSQL está caída. Las pruebas de las nuevas rutas usan
respuestas controladas para sesión, proyecto y demo. No se verificó un ingreso real
ni se publicó ninguna demo en la base. Los seeds crean ambas demos sin publicar;
el visualizador solo aparecerá cuando la base esté operativa y su registro esté
publicado. No se cambian los seeds ni se publica automáticamente el tablero.

La herramienta de navegador no está disponible en esta sesión: la verificación
actual cubre HTTP, renderizado, permisos y algoritmos; queda pendiente la revisión
visual y de interacción en navegador.
