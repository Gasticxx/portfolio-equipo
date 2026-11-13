# Edición de demos y laboratorio visual

Fecha: 13/11/2026. Rama: `feature/I4-edicion-demos`, desde `main` `337d328`.
Referencias: apartados 13 y 13.1 de la especificación, gestión y publicación de demos.

## Recorrido

1. Iniciar sesión como administrador y abrir Administración → Demos (`/admin/demos`).
2. Buscar por título, proyecto, tipo o publicación. El listado pagina de a 10.
   Los contadores muestran el total de la base, las demos visibles y los borradores;
   no son cifras de ejemplo ni cuentan únicamente la página actual.
3. Elegir Editar demo. La ficha se consulta nuevamente al servidor para recuperar
   sus datos actuales, su proyecto y la cantidad de tareas guardadas.
4. Editar título, descripción, proyecto, tipo, orden y publicación. Para crear una
   experiencia usar Nueva demo. El formulario conserva sus valores si el servidor
   rechaza un guardado.
5. Guardar. Cambiar proyecto o tipo pide confirmación. Si hay tareas guardadas,
   esos dos campos quedan protegidos y el servidor también rechaza su modificación
   con `409 DEMO_CON_DATOS`. Se pueden editar todos los demás campos.
6. Abrir la demo publicada: título y descripción corresponden a la base, y el
   recurso protegido carga la implementación del tipo elegido.

No se eliminan tareas al editar. Cancelar descarta el formulario con confirmación
si tiene cambios; no ejecuta un PUT. Despublicar conserva la ficha y las tareas.
Una nueva publicación requiere un proyecto publicado. Si luego se despublica el
proyecto, se ocultan sus demos sin alterar sus indicadores de publicación y se
pueden seguir editando sus metadatos.

## Campos y persistencia

| Campo | Regla |
| --- | --- |
| `titulo` | Texto normalizado, de 3 a 100 caracteres |
| `descripcion` | Texto normalizado, de 20 a 1000 caracteres |
| `proyectoId` | Proyecto existente; solo puede cambiar si no hay tareas |
| `tipo` | Implementación interna `tablero`, `algoritmos` o `calendario`, habilitada en esa base |
| `orden` | Entero de 1 a 100 |
| `publicada` | Booleano real |

El formulario usa Express y PostgreSQL mediante el pool común del repo, no
localStorage. En desarrollo toma `DATABASE_URL` de `.env`; con la configuración
actual se conecta a Supabase. Las operaciones se confirman después de `COMMIT`.

La actualización bloquea la fila de la demo, comprueba tareas y proyecto y guarda
los seis campos en una transacción. Duplicados de tipo dentro del mismo proyecto
devuelven `409 DEMO_DUPLICADA`. Se responden 404 para recursos ausentes y 422 para
campos o referencias inválidos. La creación de tareas vuelve a comprobar tipo y
publicación bajo bloqueo de la demo antes del INSERT: una edición concurrente
no puede trasladarla mientras esa creación conserva el bloqueo.

## API

Todas las rutas administrativas requieren administrador y devuelven
`Cache-Control: no-store`. Anónimo recibe 401 y operador/registrado 403.
POST y PUT reutilizan CSRF y la comprobación de origen del repo.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/admin/demos` | `data: []` y `meta: {page,pageSize,total,totalPages}` |
| GET | `/api/admin/demos/:id` | Ficha completa con campos editables, fechas, proyecto y `tareasGuardadas` |
| GET | `/api/admin/demos/catalogos` | Proyectos disponibles, tipos admitidos por el esquema y resumen agregado |
| POST | `/api/admin/demos` | 201 con ficha creada |
| PUT | `/api/admin/demos/:id` | 200 con ficha guardada; exige los seis campos |

El listado admite `page`, `pageSize` (máximo 50), `q` (vacío o 2–80 caracteres),
`proyectoId`, `tipo` y `publicada=true/false`. Rechaza parámetros desconocidos,
repetidos o inválidos con 400. La búsqueda usa SQL parametrizado y escapa comodines.

Las respuestas usan camelCase (`proyectoId`, `proyectoTitulo`, `proyectoPublicado`,
`createdAt`, `updatedAt`, `tareasGuardadas`). El cuerpo de escritura acepta también
el antiguo `proyecto_id` cuando no se envía `proyectoId`. Enviar ambos se rechaza.
El frontend de esta rama está adaptado al listado paginado; consumidores anteriores
que usaban `data.demos` o `data.proyectos` deben usar `data` y `/catalogos`.

## Estilo y animaciones

Se conservan el layout, el fondo y los controles de tema/movimiento del sitio.
La pantalla agrega una composición de ventanas de cristal, barras animadas,
contadores reales, tarjetas translúcidas y un editor lateral. Los efectos tienen
transiciones de foco/hover y entrada, límites de desborde y una disposición móvil.
Las animaciones decorativas se detienen con el control de movimiento y
`prefers-reduced-motion`. Los controles y mensajes siguen disponibles sin animación.
No se agregan librerías, fuentes externas, imágenes generadas ni scripts en línea.

## Pruebas realizadas

```powershell
node --env-file=.env.test --test --test-concurrency=1 tests/integration/demos.admin.api.test.js tests/unit/demos-admin.test.js tests/integration/tablero.api.test.js
npm test
```

Resultado específico: **28 pruebas aprobadas**. Regresión completa: **147 pruebas
aprobadas, 0 fallidas, 0 omitidas y 0 TODO**. Se aplicó la migración existente
`004_calendario.sql` únicamente en `portfolio_test` local para probar los tres tipos.
Las suites crean cuentas, sesiones, proyectos, demos y tareas temporales propios y
los eliminan al terminar. Ninguna escritura de prueba se ejecuta en Supabase.

Se probaron permisos, CSRF, actualización y lectura de los seis campos, publicación,
referencias, duplicados, validación, filtros/paginación y conservación de tareas.
También el bloqueo frente a la creación concurrente de una tarea, la descripción
pública y el recurso privado correcto de Calendario.

En Chrome headless se cambió una demo de proyecto y tipo, se guardaron título,
descripción, orden y publicación y se comprobó su fila en PostgreSQL. Después de
recargar, el editor recuperó esos valores. El tablero con una tarea mostró sus
campos protegidos. Se abrió el calendario modificado y generó sus días correctamente.
Se inspeccionaron capturas de escritorio (1440 × 1100), móvil (390 × 844) y ambos
temas, sin desbordes horizontales ni excepciones JavaScript. Se comprobó que el
modo de movimiento reducido deja las animaciones desactivadas.

## Estado de Supabase y revisión

La comprobación remota fue de lectura: la conexión responde, el rol de aplicación
tiene UPDATE en `app.demos` y los tipos habilitados son `tablero` y `algoritmos`.
Calendario no está habilitado todavía en esa base; el editor desactiva esa opción
hasta que I5 aplique la migración existente `004_calendario.sql`, según el proceso
del equipo. No se modificaron migraciones, variables privadas ni demos compartidas.

Pendiente: revisión de I5 sobre persistencia, de I3 sobre la interfaz y repetición
del recorrido en la versión integrada con I2. Al integrar la rama de proyectos,
revisar conjuntamente `demos-admin.routes.js` y `demos-admin.js`, que ambas ramas
modifican.
