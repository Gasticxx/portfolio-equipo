# Validación I4 del tablero personal

Fecha: 12/11/2026 (Argentina). Responsable de la comprobación: I4.
Versión base: `d0f2db3`, con el tablero de I5 integrado en la copia local de `main`.
Rama de evidencia: `test/I4-validacion-tablero`.
Tarjetas relacionadas: I5-05, revisión de I4-04, I4-07, I4-08 e I4-09.

## Entorno y reproducción

Se usaron la aplicación Express real, Supertest y PostgreSQL local `portfolio_test`,
con `.env.test`. La prueba comprueba el destino antes de crear fixtures y rechaza
una base remota. No utiliza `.env` ni la base compartida de Supabase.

```powershell
node --env-file=.env.test --test --test-concurrency=1 tests/integration/tablero.api.test.js
npm test
```

La suite crea cuentas y sesiones exclusivas de prueba; elimina sus tareas,
sesiones, accesos y cuentas al terminar. Conserva la demo existente con ID 1
porque la API actual fija ese identificador. Los casos de publicación cambian
temporalmente los indicadores locales y los restauran en `finally`. Si falta
la demo 1, prepara una demo y un proyecto temporales y los elimina al terminar.
No ejecutar simultáneamente contra una instancia manual que use `portfolio_test`.

Las sesiones se preparan en PostgreSQL y se firman con la configuración de prueba.
Esto verifica la autorización de las peticiones; no constituye una prueba manual
del formulario de login ni del navegador.

## Resultados

| Caso | Resultado obtenido | Estado |
| --- | --- | --- |
| GET, POST, PATCH y DELETE sin sesión | 401 | OK |
| Crear, volver a consultar desde otra sesión del titular, cambiar estado y eliminar | 201 / 200; datos comprobados por SQL | OK |
| Intentar asignar usuario o demo desde el cuerpo del POST | Se usan usuario de sesión y demo fija 1 | OK para usuario; ID fijo pendiente de I5 |
| Otra cuenta solicita tareas del titular mediante query o modifica/elimina su ID | No aparece en listado; PATCH y DELETE 404; datos originales conservados | OK |
| Administrador intenta modificar tarea ajena | 404; no obtiene privilegios sobre tareas personales | OK |
| Registrado, operador y administrador crean tareas propias | 201; listado y eliminación 200 | OK |
| POST, PATCH y DELETE sin CSRF o con origen ajeno | 403; sin cambios en datos | OK |
| Títulos, estados e identificadores inválidos | 400 | OK |
| Dos POST concurrentes partiendo de 49 tareas | Una alta 201 y un rechazo 409 `LIMITE_TAREAS`; total SQL 50 | OK |
| Logout y siguiente petición protegida | 401 | OK |
| Bloquear mediante API administrativa, consultar y rehabilitar | Sesión anterior recibe 401; nueva sesión del titular recibe 200 | OK |
| Sesión vencida por antigüedad absoluta o inactividad | 401 | OK |

Resultado específico: **12 casos, 9 aprobados y 3 TODO con defectos reproducidos**.
Regresión completa: **126 pruebas, 123 aprobadas, 3 TODO, 0 omitidas**.
El runner no cuenta los TODO como fallos y termina con código 0, pero sus
aserciones sí se ejecutan y actualmente fallan: no son criterios aprobados.

## Defectos de integración abiertos

| ID | Reproducción y resultado actual | Resultado requerido | Responsable |
| --- | --- | --- | --- |
| D-I4-TAB-01 | Con sesión válida y demo 1 sin publicar, GET `/tablero` y GET `/api/tablero/tareas` devuelven 200 | Comprobar publicación de demo y proyecto en página y todas las operaciones de la API; 404 cuando no estén disponibles | I5; revisión de permisos I4 |
| D-I4-TAB-02 | Sin sesión, GET `/js/tablero.js` y GET `/js/tablero.adapter.js` devuelven 200; la vista integrada carga esos archivos | Servir los recursos de la demo integrada mediante ruta protegida, como `/demos/:id/recurso.js`; revisar con I3 la separación del prototipo público | I5 con I3; revisión I4 |
| D-I4-TAB-03 | Con demo 1 y proyecto publicados, el catálogo no enlaza el tablero; GET `/demos/1` y `/demos/1/recurso.js` devuelven 404 | Catálogo, proyecto, página y recurso deben admitir demos de tipo tablero, resolver su ID real y conservar permisos | I5; integración I2 |

El router usa `DEMO_ID = 1`, y las consultas de `demos.routes.js` solo admiten
`tipo = 'algoritmos'`. No debe asumirse que el tablero tendrá ID 1 en todas las
bases. Coordinar con I5 el contrato de identificación de demo antes de cerrar.

Los defectos tienen casos ejecutables marcados `todo` en
`tests/integration/tablero.api.test.js`. Al corregirlos, retirar esa marca y
adaptar el fixture al contrato definitivo de demo. Los cambios de esta rama son
pruebas y documentación de revisión de I4; los arreglos funcionales se asignan
a sus responsables.

## Pendientes de cierre

- Revisión de los tres defectos con I5/I3/I2 y repetición contra la corrección integrada.
- Recorrido visual por I3/I4: crear tarea, cambiar estado, recargar y eliminar;
  repetir con dos cuentas en navegadores separados. La persistencia por API ya
  está comprobada; el navegador no se ejecutó en esta revisión.
- Comprobar el acceso directo al proyecto, ambas demos y sus recursos protegidos
  sobre datos publicados reales, incluidos los rechazos después de bloquear una cuenta.
- Repetir los recorridos de identidad en el despliegue final con I2.
- Completar enlaces a tarjeta/PR y registrar la revisión humana recibida.

## Mensaje preparado para I5

Revisé tu tablero en la versión integrada `d0f2db3`. Pasan CRUD persistido,
aislamiento entre usuarios (también frente a administrador), CSRF, revocación
y el límite de 50 con altas concurrentes. Encontré tres pendientes: `/tablero`
y su API siguen disponibles con la demo sin publicar; los scripts integrados
se sirven sin sesión desde `/js`; y el tablero no aparece en `/demos` ni abre
por `/demos/1` aunque esté publicado. Además, la API fija `DEMO_ID=1`.
Dejé casos reproducibles y resultados en `docs/i4-validacion-tablero.md` y
`tests/integration/tablero.api.test.js`. Coordinemos las correcciones para cerrar
la revisión de permisos de I4.
