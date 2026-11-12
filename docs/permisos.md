# Permisos del portfolio

Responsable: integrante 4.
Revisor principal: integrante 2.
Estado: matriz implementada parcialmente; validada localmente el 12/11/2026. Revisar
los permisos de cada módulo contra la versión integrada antes del cierre.

Este documento define quién puede acceder a cada función del
portfolio. Las reglas deben aplicarse tanto a las pantallas
como a las APIs y los recursos privados.

## Autenticación y autorización

La autenticación comprueba qué cuenta inició sesión.

La autorización comprueba si esa cuenta tiene permiso para
acceder al recurso o realizar la operación solicitada.

Una cuenta autenticada no tiene automáticamente permiso
para utilizar todas las funciones.

## Roles y visitante

Los valores admitidos para el campo rol son:

- registrado
- operador
- administrador

Visitante significa que la persona no tiene una sesión
autenticada válida. No se almacena como un rol.

El registro público siempre crea cuentas con rol registrado.

El administrador también puede utilizar las funciones
del operador.

La ficha pública de un integrante y su cuenta de acceso son
conceptos separados. Figurar en el equipo, ser integrante 4
o ser Product Owner no concede permisos administrativos.

## Matriz de permisos

| Acción                                                           | Visitante | Registrado | Operador | Administrador |
| ---------------------------------------------------------------- | --------- | ---------- | -------- | ------------- |
| Ver inicio, equipo, servicios y tarjetas de proyectos publicados | Sí        | Sí         | Sí       | Sí            |
| Enviar una consulta desde Contacto                               | Sí        | Sí         | Sí       | Sí            |
| Ver detalles de proyectos publicados y usar sus demos publicadas | No        | Sí         | Sí       | Sí            |
| Consultar los datos de su propia cuenta                          | No        | Sí         | Sí       | Sí            |
| Cambiar su propia contraseña                                     | No        | Sí         | Sí       | Sí            |
| Listar y responder consultas                                     | No        | No         | Sí       | Sí            |
| Administrar proyectos, demos y servicios                         | No        | No         | No       | Sí            |
| Buscar, consultar, habilitar o deshabilitar cuentas registradas  | No        | No         | No       | Sí            |
| Consultar métricas                                               | No        | No         | No       | Sí            |

La creación o modificación de roles privilegiados se realiza
mediante un script controlado con acceso al entorno del
servidor. No existe un endpoint para elevar roles.

## Navegación visible

| Persona       | Opciones de cuenta                           |
| ------------- | -------------------------------------------- |
| Visitante     | Ingresar y Registrarse                       |
| Registrado    | Mi cuenta y Salir                            |
| Operador      | Mi cuenta, Salir y Consultas                 |
| Administrador | Mi cuenta, Salir, Consultas y Administración |

Los enlaces públicos comunes son Inicio, Equipo, Servicios,
Proyectos y Contacto.

El enlace Administración se muestra únicamente a administradores.
El tablero `/admin` enlaza a Usuarios, Servicios, Métricas y Consultas; informa
que los paneles de Proyectos y Demos todavía no están integrados.

El enlace Consultas se muestra a operadores y administradores.

Mostrar u ocultar enlaces mejora la navegación. El servidor
comprueba igualmente los permisos en cada solicitud protegida.

## Acceso a las pantallas

Las siguientes rutas corresponden a solicitudes GET de páginas HTML.

| Ruta                    | Acceso requerido                                   |
| ----------------------- | -------------------------------------------------- |
| /                       | Público                                            |
| /equipo                 | Público                                            |
| /equipo/:slug           | Público                                            |
| /servicios              | Público                                            |
| /proyectos              | Público; muestra tarjetas de proyectos publicados  |
| /contacto               | Público                                            |
| /registro               | Público                                            |
| /login                  | Público                                            |
| /proyectos/:slug        | Sesión válida y proyecto publicado                 |
| /demos/:id              | Sesión válida, demo publicada y proyecto publicado |
| /mi-cuenta              | Sesión válida                                      |
| /operador/consultas     | Operador o administrador                           |
| /operador/consultas/:id | Operador o administrador                           |
| /admin                  | Administrador                                      |
| /admin/proyectos        | Pendiente de integración I5                        |
| /admin/demos            | Pendiente de integración I5                        |
| /admin/servicios        | Administrador; ruta integrada localmente, revisión I1 pendiente |
| /admin/usuarios         | Administrador                                      |
| /admin/metricas         | Administrador                                      |

Los parámetros :slug e :id representan valores variables.
El servidor valida estos parámetros y comprueba la existencia
del recurso solicitado.

## APIs iniciales de autenticación

| Método | Ruta               | Regla                                                                     |
| ------ | ------------------ | ------------------------------------------------------------------------- |
| GET    | /api/csrf          | Disponible sin autenticación; entrega el token CSRF asociado a la sesión  |
| POST   | /api/auth/registro | Sin autenticación previa; exige CSRF y crea únicamente cuentas registrado |
| POST   | /api/auth/login    | Sin autenticación previa; exige CSRF y comprueba las credenciales         |
| GET    | /api/auth/me       | Sesión autenticada válida; devuelve datos de la propia cuenta             |
| POST   | /api/auth/logout   | Exige CSRF; destruye la sesión del solicitante y elimina su cookie        |

El registro no inicia sesión automáticamente.

El servidor rechaza con 422 un campo rol enviado en el
cuerpo del registro. No permite elegir privilegios desde
el navegador.

Ninguna respuesta devuelve contraseñas ni hashes.

## Lecturas protegidas de proyectos y demos

| Método | Ruta | Regla |
| --- | --- | --- |
| GET | `/proyectos` | Público; muestra tarjetas publicadas |
| GET | `/proyectos/:slug` | Sesión válida y proyecto publicado |
| GET | `/demos` | Sesión válida; muestra demos publicadas |
| GET | `/demos/:id` | Sesión válida, demo publicada y proyecto publicado |
| GET | `/demos/:id/recurso.js` | Sesión válida, demo publicada y proyecto publicado |

Estas páginas y recursos están montados en `src/routes/demos.routes.js`.
No encontré APIs `/api/proyectos/:id` ni `/api/demos/:id` en esta versión.

El listado público de proyectos entrega las tarjetas
permitidas, sin incluir el detalle privado.

Los scripts privados de las demos también requieren
autorización. No deben servirse desde una carpeta estática
pública que permita saltar el control de sesión.

Las operaciones del tablero comprueban el usuario de la
sesión y la demo correspondiente. Conocer el identificador
de una tarea ajena no permite consultarla ni modificarla.

## Reglas de sesión

Las sesiones se guardan en PostgreSQL.

Al iniciar sesión correctamente se regenera la sesión de
autenticación y se renueva el token CSRF.

La visita analítica se conserva mediante el mecanismo
independiente coordinado con I2.

Una sesión pierde validez por:

- 30 minutos de inactividad.
- 8 horas desde la autenticación.
- Cierre de sesión.
- Bloqueo de la cuenta.
- Cambio de contraseña.

En cada solicitud protegida el servidor comprueba:

- Que la sesión sea válida.
- Que la cuenta exista y esté activa.
- El rol vigente de la cuenta en la base de datos.
- La coincidencia de version_sesion.
- Los límites de vencimiento.

El rol enviado por el navegador no determina los permisos.

Al cerrar sesión se destruye la sesión del servidor
y se elimina la cookie correspondiente.

## Protección de escrituras

Las solicitudes de escritura exigen un token CSRF válido
en la cabecera X-CSRF-Token.

El servidor comprueba que Origin coincida con APP_ORIGIN.

Si Origin falta, comprueba el origen exacto de Referer.
Si ambos faltan, rechaza la solicitud.

Un fallo de CSRF devuelve 403 sin realizar la operación.
El navegador no repite automáticamente la escritura.

## Gestión de cuentas

El panel administrativo gestiona exclusivamente cuentas
con rol registrado.

Permite buscar, consultar y cambiar el estado activo.

No permite:

- Eliminar cuentas.
- Modificar emails.
- Cambiar roles.
- Modificar contraseñas desde el panel.
- Administrar cuentas privilegiadas desde ese panel.

El bloqueo incrementa version_sesion e invalida las
sesiones anteriores.

La rehabilitación conserva esa versión. La persona debe
iniciar sesión nuevamente; no recupera sesiones revocadas.

### Administración de cuentas registradas

| Ruta | Método | Permiso | CSRF | Resultado |
| --- | --- | --- | --- | --- |
| `/api/admin/usuarios` | GET | Administrador | No | Listado filtrable y paginado de cuentas `registrado` |
| `/api/admin/usuarios/:id` | GET | Administrador | No | Detalle de cuenta registrada |
| `/api/admin/usuarios/:id` | PATCH | Administrador | Sí | Cambia `{ "activo": boolean }` |
| `/admin/usuarios` | GET | Administrador | No | Panel de búsqueda y cambio de estado |

Las APIs devuelven `401` sin sesión y `403` con rol insuficiente. El listado acepta
`page`, `pageSize`, `q` y `activo`; solo devuelve cuentas `registrado`, sin hashes.
La búsqueda cubre nombre y email.

### Creación y recuperación controladas

`npm run cuenta:crear` solicita nombre, email, rol privilegiado y contraseña por
terminal. La contraseña se oculta durante la entrada y no se imprime ni se guarda
en Git. No existe una API para crear cuentas privilegiadas.

`npm run cuenta:recuperar` solicita email, contraseña temporal y confirmación por
terminal. Actualiza el hash y aumenta `version_sesion` en una transacción. La
contraseña temporal se entrega al titular por un canal privado; el titular debe
cambiarla en Mi cuenta.

El cambio de contraseña en `PATCH /api/auth/password` exige contraseña actual y
CSRF. Tanto el cambio como la recuperación aumentan `version_sesion`.

### Sesiones y expiración

La cookie `equipo.sid` es `HttpOnly`, `SameSite=Lax`, `Path=/` y solo usa `Secure`
en producción. La sesión vence por 30 minutos de inactividad y tiene un máximo
absoluto de 8 horas. Cada petición autenticada vuelve a consultar estado, rol y
`version_sesion` en PostgreSQL. Bloquear, cambiar o recuperar la contraseña
invalida sesiones anteriores. Rehabilitar una cuenta no restaura esas sesiones.

## Respuestas ante accesos rechazados

| Situación                                                     | Respuesta            |
| ------------------------------------------------------------- | -------------------- |
| Página privada sin sesión válida                              | Redirección al login |
| API protegida sin sesión válida                               | 401 en JSON          |
| Cuenta autenticada sin el rol requerido                       | 403                  |
| Recurso inexistente o no publicado para público o registrados | 404                  |
| Tarea perteneciente a otra cuenta                             | 404                  |
| Token CSRF u origen inválido                                  | 403                  |
| Campo rol enviado al registro                                 | 422                  |

Las APIs no redirigen a páginas HTML.

El parámetro next del login solo admite destinos locales
permitidos por la especificación. Después de iniciar sesión,
también se comprueba que el rol pueda acceder al destino.

## Alcance del sprint 1

- Acordar permisos y estructura de usuarios y sesiones.
- Implementar hash y comprobación de contraseñas.
- Implementar registro, login y logout.
- Configurar sesiones, CSRF y límites de intentos.
- Proteger el primer proyecto, su demo y sus recursos privados.
- Preparar cuentas de prueba por rol.
- Probar accesos permitidos y rechazados.
- Documentar los resultados y solicitar revisión a I2.

La gestión de usuarios y el cambio de contraseña se
implementan en el sprint 2.

## Pendientes para cerrar este documento

- Revisión de la matriz con I2.
- Coordinación del esquema con I5.
- Completar las rutas de operaciones de demos y otros módulos.
- Documentar la configuración implementada de cookies y sesiones.
- Revisar con I1 la integración del router de Servicios en esta rama y con I2
  la matriz final de permisos antes de integrar.
- No hay rutas API `/api/proyectos/:id` ni `/api/demos/:id`: esos requests dieron
  `404`. El acceso implementado es por páginas y recursos bajo `/proyectos/:slug`
  y `/demos/:id`.
- Cuando I5 publique la demo, probar proyecto, demo y `recurso.js` con y sin sesión.
- Repetir la evidencia en la versión integrada y registrar el SHA revisado.

### Evidencia local registrada

En `portfolio_test`, el 12/11/2026, `npm test` pasó con 114 pruebas y sin fallos.
Las pruebas de usuarios verifican `401` anónimo, `403` para operador y registrado,
`200` para administrador, filtros/paginación, CSRF, bloqueo, rehabilitación y
revocación de sesiones, login incorrecto y sesión vencida. El cambio de contraseña
se probó contra PostgreSQL. Métricas respondió 401 sin sesión, 403 a operador y
registrado, y 200 a administrador. Los CLI `cuenta:crear` y `cuenta:recuperar` se probaron
con cuentas desechables: se confirmó el rol creado, el hash nuevo y
`version_sesion = 2`; luego se eliminaron las cuentas.
Servicios quedó montado: API pública `200`, API administrativa `401` sin sesión,
`403` para operador/registrado, `200` para administrador; las escrituras rechazan
CSRF ausente. El panel administrativo responde `200` para administrador.

Las pruebas de rutas de proyecto y demo cubren acceso de registrado, operador y
administrador, rechazo de anónimo en páginas, `401` en `recurso.js`, IDs inválidos,
rol no admitido y ocultamiento de demos no publicadas con fixtures propios que se
eliminan al terminar. La demo publicada de I5 aún requiere validación coordinada.
