# Gestión de proyectos

Rama de entrega: `feature/I4-proyectos-glass-interactivo`, creada el 13/11/2026
desde `45ce514`, con la edición de demos y la gestión completa de proyectos.
Se recuperó la implementación anterior del stash `b7cd26e`, que se conserva
como respaldo, y se mantuvo el editor actual de demos al integrar las rutas.

La pantalla de proyectos tiene una ilustración propia: una carpeta de cristal
con un avance animado entre Idea, Construcción y Entrega, y conexiones con
Equipo, Tecnologías y Aportes. Usa SVG y CSS locales y no depende de los estilos
ni de la animación del panel de demos. Se muestra también en móvil. Las tarjetas
tienen portada, estados y entrada/hover. El editor
incluye vista previa en vivo de título, resumen, slug, portada, tecnologías,
estado y participantes; navegación por secciones, contadores de texto e indicador
de cambios sin guardar. La previsualización no escribe en la base: se aplica
al pulsar Guardar proyecto. Reutiliza los tokens, temas y efectos del sitio;
respeta el control de movimiento y la preferencia de movimiento reducido.
La pausa y la salida de la página suspenden las animaciones; al volver o
reanudar continúan sin reiniciar las entradas de los paneles.
Los aportes se eligen desde una lista compacta y se edita uno a la vez; todos
permanecen en el formulario y se guardan juntos. Los nombres, títulos y estados
de la lista reflejan la edición. Un campo inválido abre el aporte correspondiente
antes de mostrar la validación, aunque estuviera oculto.
El editor mantiene los campos completos y el guardado transaccional en PostgreSQL.
La eliminación explícita de demos se integró en el panel nuevo para poder
retirarlas antes de eliminar un proyecto, con confirmación de pérdida de tareas.

Regresión de esta integración: **159 pruebas aprobadas, 0 fallidas, 0 omitidas y
0 TODO**. Se repitió el recorrido de navegador con creación, edición, recarga,
cancelación y confirmación de borrado, y se revisaron ambos temas y móvil.

Referencias: especificación, apartados 10.1,
10.2, 11, 13 y 13.1; aceptación A15, A16 y A18. La ampliación fue solicitada
por I4; coordinar revisión de proyectos y Storage con I5, interfaz con I3 e
integración con I2 antes de incorporar a `main`.

## Uso del panel

1. Iniciar sesión con una cuenta administradora y abrir Administración → Proyectos.
2. Crear un proyecto o buscar uno por título y publicación. El listado pagina
   con 10, 25 o 50 resultados.
3. Completar título, slug, resumen, descripción, estado, publicación y repositorio
   HTTPS opcional. El slug define el enlace: cambiarlo cambia la URL del detalle.
4. Seleccionar de 1 a 15 tecnologías del catálogo existente.
5. Agregar entre 1 y 30 aportes. Cada uno identifica al integrante, título,
   descripción, estado, evidencia y entre 1 y 10 tecnologías. Los aportes
   comprobados requieren evidencia HTTPS. Para terminar un proyecto, todos sus
   aportes deben estar comprobados. Seleccionar otro aporte en la lista conserva
   lo escrito en los demás. Agregar abre el nuevo editor y quitar selecciona el
   siguiente disponible. La lista tiene desplazamiento propio para mantener
   compacto el formulario.
6. Elegir una portada guardada, subir una nueva o dejar la ficha sin portada.
   Subir guarda el archivo; Guardar proyecto aplica su referencia. Quitar de
   la ficha no elimina el archivo del almacenamiento.
7. Al editar, confirmar el reemplazo de tecnologías y aportes. Se guardan juntos
   dentro de una transacción. Cancelar conserva el formulario y no escribe.
8. Verificar la ficha en Proyectos. Los borradores no aparecen en el catálogo.
   Los aportes comprobados de proyectos publicados aparecen en el perfil del
   integrante; el detalle completo requiere una sesión.
9. Para borrar, confirmar el nombre y las consecuencias. Si tiene demos,
   primero deben eliminarse desde Administración → Demos, donde otra
   confirmación informa que se eliminan también sus tareas. Despublicar es la
   alternativa para ocultar contenido y conservar sus datos.

Inicio, el catálogo y el resumen público `/detalle` leen PostgreSQL. El proyecto
original `portfolio-equipo` tiene prioridad como destacado mientras esté
publicado; los proyectos nuevos no lo reemplazan en Inicio. Se conserva la
tarjeta visual original del sitio, con su contenido y portada de la base.
El detalle completo sigue protegido en `/proyectos/:slug`. Si se despublica el
portfolio, se oculta; si no hay proyectos publicados, se muestra el estado vacío
en lugar de una ficha estática. No se recrean datos ni se ejecutan seeds al abrir
una página.

La interfaz reutiliza cabecera, pie, fondo, tarjetas glass, formularios, botones
y tokens de color del sitio. Incluye tema claro/oscuro, disposición móvil,
etiquetas de campos, mensajes accesibles y confirmaciones mediante `dialog`.
La ficha conserva los valores al fallar una validación o una escritura.

## Contrato de la API

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/admin/proyectos?page=1&pageSize=10&q=portfolio&publicado=true` | `data` con campos simples y `meta` de paginación |
| GET | `/api/admin/proyectos/:id` | Todos los campos editables, `id`, `createdAt`, `updatedAt` y demos asociadas |
| POST | `/api/admin/proyectos` | 201 con el proyecto creado |
| PUT | `/api/admin/proyectos/:id` | 200; reemplazo completo de campos y relaciones |
| DELETE | `/api/admin/proyectos/:id` | 204; 409 si tiene demos |
| GET | `/api/admin/proyectos/catalogos` | Integrantes, tecnologías y archivos disponibles para el editor |
| GET | `/api/admin/tecnologias` | Catálogo de tecnologías, ordenado por nombre |
| GET | `/api/equipo` | API pública del módulo de equipo existente |
| POST | `/api/admin/archivos` | Multipart con un único archivo `imagen`; 201 con `id`, URL propia, dimensiones y bytes |
| DELETE | `/api/admin/archivos/:id` | 204; 409 si está referenciado por un proyecto |
| GET | `/media/:id` | WebP de proyecto publicado o vista previa de administrador |
| DELETE | `/api/admin/demos/:id` | 204; eliminación explícita de demo y tareas asociadas |

Las rutas administrativas exigen rol administrador. Las escrituras exigen
`X-CSRF-Token` y el origen permitido. Anónimo recibe 401 y otros roles 403.
Los JSON usan el formato común y los errores incluyen `requestId` y, cuando
corresponde, `fields`. PUT exige todos los campos; se usa `null` para limpiar
portada, repositorio o evidencia opcional. Los cuerpos JSON mantienen el límite
común de 32 KiB: si se supera, reducir el texto enviado antes de reintentar.

Campos de proyecto: `titulo` (3–100), `slug` (3–80, minúsculas/números/guiones),
`resumen` (20–250), `descripcion` (50–5000), `estado`, `publicado`, `portadaId`,
`repositorioUrl`, `tecnologiaIds` y `aportes`. Cada aporte lleva `miembroId`,
`titulo` (3–100), `descripcion` (20–1000), `estado`, `evidenciaUrl` y
`tecnologiaIds`. No se crean ni editan tecnologías libremente desde este panel.

Las relaciones se comprueban contra PostgreSQL. No se repiten tecnologías ni
aportes con el mismo título para el mismo integrante. Un slug repetido devuelve
409 `SLUG_DUPLICADO`. El bloqueo de fila serializa el reemplazo de relaciones
con otra edición o eliminación del mismo proyecto. El borrado de un proyecto
elimina sus asociaciones y aportes, conservando integrantes, tecnologías y
archivo de portada. La FK y la transacción impiden borrados parciales con demos.

## Portadas y configuración

Se usan `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y
`SUPABASE_STORAGE_BUCKET` del backend. Se admite la clave nueva `sb_secret_`
mediante `apikey`, reutilizando la configuración de Storage existente. Los
objetos se guardan en `portadas/<uuid>.webp`, dentro del bucket privado.

Solo JPEG, PNG o WebP estáticos; máximo 5 MiB de entrada y salida, dimensiones
de entrada entre 64 y 4096 por lado y hasta 16 millones de píxeles. sharp
comprueba el contenido y genera WebP calidad 80, sin metadatos y con máximo
2400 por lado, sin agrandar. Storage tiene un timeout de 15 segundos. No se
confía en el nombre ni en el MIME declarado. No se usan archivos locales para
persistencia ni se exponen claves o URLs privadas del proveedor al cliente.

Si Storage acepta una subida y falla la inserción en PostgreSQL, se compensa
borrando el objeto. Si falla también esa compensación, se registra
`PORTADA_HUERFANA` con su ruta para limpieza manual. Al borrar un archivo libre,
se elimina primero el objeto y luego la fila; un objeto ya ausente se considera
borrado. Un fallo posterior de PostgreSQL puede requerir revisión manual de la
fila: Storage y PostgreSQL no comparten una transacción distribuida.

## Verificación

Se ejecutaron las pruebas de integración con PostgreSQL `portfolio_test` local,
sesiones firmadas y fixtures exclusivos que se eliminan al terminar. No se
modificaron `.env`, `.env.test`, migraciones ni datos de Supabase.

```powershell
node --env-file=.env.test --test --test-concurrency=1 tests/integration/proyectos.api.test.js tests/unit/proyectos-archivos.test.js
npm test
```

Casos cubiertos: permisos de lectura/escritura, CSRF/origen, alta y edición de
todos los campos, relaciones persistidas, reemplazo, rollback a mitad del
guardado, slug repetido, parámetros de paginación/filtros, referencias inexistentes,
estado terminado y evidencia, borrado con demos sin cambios parciales y
eliminación explícita de demo con sus tareas. También validación real de imagen,
redimensión, límite de tamaño, multipart y compensación de Storage mediante doble.
Los cambios de publicación se comprueban en catálogo, detalle y perfil.
Resultado de `npm test`: **159 pruebas aprobadas, 0 fallidas, 0 omitidas
y 0 TODO**. `git diff --check` también pasó.

Los casos de sincronización comprueban que Inicio, catálogo y resumen reflejan el mismo título,
resumen y publicación, que el portfolio original queda destacado y que no se
inventa una ficha cuando la base está vacía.

Se comprobó además la conexión real configurada en `.env`: Supabase responde,
el proyecto original `portfolio-equipo` existe, conserva su portada y sus demos,
y `portfolio_app` tiene permisos de lectura/escritura y uso de secuencias para
la gestión. La portada original se descargó desde el bucket privado con éxito.
Estas comprobaciones remotas fueron de lectura; las escrituras y limpiezas de
prueba se realizaron exclusivamente en `portfolio_test` local.

Se comprobó además con Chrome headless, sobre una instancia temporal conectada
a `portfolio_test`: creación desde el formulario, edición con confirmación,
recuperación después de recargar, cancelación de borrado y eliminación confirmada.
Se verificaron la vista previa en vivo, los contadores y el indicador de cambios
pendientes, y que escribir en la previsualización no modifica PostgreSQL antes
de guardar. Tras recargar se recuperan los datos guardados y el indicador queda
sin cambios pendientes.
La revisión posterior verificó movimiento real de la ilustración entre cuadros,
pausa/reanudación desde el control del sitio, salida/regreso a la página y
movimiento reducido. Se crearon seis aportes de distintos integrantes desde
la interfaz: un único editor visible, misma altura que con un solo aporte,
conservación al cambiar de selección y seis registros recuperados después de
guardar y recargar. Un título inválido en un aporte oculto lo abrió y recibió
el foco para corregirlo.
Se inspeccionaron capturas de los temas claro y oscuro, en escritorio (1440 ×
1100), y una vista móvil (390 × 844), sin desbordes horizontales ni excepciones
JavaScript. La cuenta y el proyecto visuales
se eliminaron al terminar.

Pendiente para la entrega integrada: comprobar subida y borrado con el bucket
real de Supabase, validar la vista con I3 en ambos temas y repetir el
recorrido en la URL final con I2. Las llamadas a Storage en pruebas automáticas
usan un doble; la descarga real de la portada original se verificó aparte.
