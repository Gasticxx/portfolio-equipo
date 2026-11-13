# Contacto, correo, operador y métricas (módulo de I6)

Este documento describe el circuito completo de una consulta, cómo operar el panel, qué hacer cuando un email no llega y cómo leer los gráficos. También fija el **contrato de integración** con los módulos de I2, I4 e I5.

## 1. Archivos del módulo

| Archivo | Qué hace |
|---|---|
| `src/routes/consultas.routes.js` | Crea los routers (`api` y `paginas`) y el manejador de errores JSON del módulo |
| `src/controllers/consultas.controller.js` | Convierte HTTP en entradas validadas; renderiza las vistas |
| `src/services/consultas.service.js` | Reglas: idempotencia, transacciones, estados, respuestas |
| `src/services/email.service.js` | Brevo por HTTPS con `fetch`, estados de envío y reintentos |
| `src/services/transaccion.js` | `BEGIN/COMMIT/ROLLBACK` con un mismo client y `release` en `finally` |
| `src/services/consultas.errores.js` | `ErrorApi` y detección de base inaccesible (503) |
| `src/repositories/consultas.repository.js` | Único lugar con SQL del módulo (revisión de I5) |
| `src/validators/consultas.validator.js` | Esquemas Zod 4 |
| `src/config/consultas.constants.js` | Límites, estados, transiciones y textos visibles |
| `src/views/consultas/*.ejs`, `src/views/admin/metricas.ejs` | Vistas de contacto, operador y métricas |
| `src/public/js/contacto.js`, `operador.js`, `metricas.js`, `consultas-http.js` | JavaScript de cliente (módulos ES, sin scripts inline) |
| `src/public/css/consultas.css` | Estilos mínimos sobre los tokens de I3 |
| `src/app.js` (bloque marcado “Módulo I6”) | Monta el módulo con las piezas de I2 e I4 |
| `tests/unit/consultas.validator.test.js`, `tests/unit/email.service.test.js` | Unitarias sin base ni red |
| `tests/integration/consultas.api.test.js` | Módulo completo contra `portfolio_test`, Brevo con doble |
| `tests/integration/consultas.rutas.test.js` | Módulo montado en la app real: sesión, `requerirRol`, `verificarCsrf`, vistas de I3 |
| `tests/helpers/app-consultas.js` | App mínima y doble de Brevo para las pruebas |

## 2. Integración con el resto del equipo

### Montaje en `src/app.js` (archivo de I2)

```js
const consultas = crearModuloConsultas({
  pool,                                   // src/config/db.js (I2)
  env,                                    // src/config/env.js (I2)
  auth: { api: requerirRol },             // src/middlewares/auth.js (I4)
  csrf: verificarCsrf,                    // src/middlewares/csrf.js (I4)
  limites: { contacto: limiteContactoIp, operador: limiteOperadorUsuario }, // src/middlewares/limits.js (I2)
});
app.use("/api", consultas.api);
app.use(consultas.paginas);
```

Va después de `cargarUsuarioActual` y `analyticsMiddleware`, y antes de `notFoundHandler`, como fija el orden del apartado 17.

| Pieza | Cómo la usa I6 | Dueño |
|---|---|---|
| `requerirRol(...roles)` | API: 401/403 JSON. Páginas: el módulo envuelve el mismo middleware y, sin sesión, redirige a `/login?next=<ruta>` | I4 |
| `req.user` | Usuario vigente (`id`, `nombre`, `rol`) cargado por `cargarUsuarioActual`; es el autor de las respuestas | I4 |
| `verificarCsrf` | Todas las escrituras (`X-CSRF-Token` + `Origin`) | I4 |
| `GET /api/csrf` | El navegador pide el token antes de enviar | I4 |
| `limiteContactoIp` / `limiteOperadorUsuario` | 5 por 15 min por IP / 20 por hora por operador, en `app.limites` | I2 |
| `errorHandler` | Formatea todos los errores salvo los propios de I6 (`ErrorApi`, con `Retry-After`) y la base caída (503) | I2 |
| `partials/i3/cabecera.ejs` y `pie.ejs` | Las cuatro vistas los incluyen; reciben `titulo` y `rutaActual` | I3 |
| Componentes de I3 | `encabezado-pagina`, `glass`, `formulario`, `campo`, `alerta`, `estado-vista`, `tabla-i3` | I3 |
| `/vendor/chart.umd.js` | Copiado por `npm run assets` | I2 |
| Migración `003_contenido.sql` | Tablas `app.consultas`, `app.respuestas`, `app.envios_email` | I5 |
| `GET /api/admin/metricas` | La vista de métricas la consume. Publicada por I2 y probada con datos reales en I6 08 (`docs/pruebas.md` §6). Si falla, la página muestra “No se pudieron cargar las métricas” | I2 |

### Variables de entorno

`BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `CONTACT_TO_EMAIL` (ya están en `.env.example` y `env.js` las exige en producción). En desarrollo pueden quedar vacías: el servidor arranca, avisa en el log y cada envío queda en `error` con el código `CONFIGURACION_FALTANTE`, sin perder la consulta. `SESSION_SECRET` se usa además como clave del HMAC del actor de idempotencia.

### Pruebas

```bash
node --env-file=.env.test scripts/migrate.js   # una vez: migra portfolio_test
npm test                                       # todas las pruebas del repo
```

Si la base de prueba no está migrada, las pruebas de I6 que la necesitan se **omiten** con el motivo y el resto sigue. El workflow de CI hoy no migra la base, así que allí se omiten: ver la propuesta para I2 en `docs/pruebas.md`.

## 3. Recorrido de una consulta

1. El visitante abre `/contacto` (o `/contacto?tipo=cotizacion&servicioId=<id>` desde un servicio). La página solo preselecciona un servicio **activo** y solo para cotización.
2. El navegador pide `/api/csrf`, valida los campos con las mismas reglas que el servidor y genera una `Idempotency-Key` (UUID).
3. `POST /api/consultas`: Zod valida; el servidor calcula `idempotencia_actor` (HMAC del id de sesión) y `payload_sha256` (JSON con claves ordenadas).
4. En **una transacción** se insertan la consulta y su envío `notificacion` en estado `pendiente`. Si la base falla aquí: **503**, nada guardado, no se llama a Brevo.
5. Después del commit, el envío se **reclama** (`pendiente → enviando`, `intentos + 1`, bloqueo de 30 s) y se llama a Brevo **sin transacción abierta**.
6. Resultado: `aceptado` (+ `proveedor_id`), `error` (rechazo 4xx/5xx o red que nunca conectó) o `desconocido` (timeout de 10 s o desconexión: el mensaje pudo haber salido).
7. Respuesta **201** `{ id, estado, notificacionEstado }`. La interfaz muestra *Consulta registrada; notificación aceptada por el proveedor* o *Consulta registrada; el aviso por email quedó pendiente de revisión*.

**Repetición por error de red:** el formulario conserva la misma clave mientras no se edite un campo. Misma clave + misma sesión + mismos datos → **200** con la misma consulta y sin otro email. Otra sesión u otros datos → **409 IDEMPOTENCIA_CONFLICTO**.

## 4. Uso del panel del operador

Acceso: operador o administrador. Visitante y registrado reciben 401/403 sin datos.

- **`/operador/consultas`**: búsqueda por nombre, email o asunto (2 a 80 caracteres) y filtros de tipo, estado y notificación. Más recientes primero; 10 por página.
- **`/operador/consultas/:id`**: datos completos, servicio guardado al momento de la consulta (se conserva aunque el servicio se borre), historial de respuestas y tabla de envíos. Abrirla **no** cambia el estado.

### Estados de la consulta

| Desde | Acción | Hacia |
|---|---|---|
| nueva | Marcar en proceso | en_proceso |
| nueva / en_proceso | Brevo acepta una respuesta (automático) | respondida |
| respondida | Marcar en proceso | en_proceso |
| respondida | Cerrar consulta | cerrada |
| cerrada | Reabrir | en_proceso |

No existe “marcar respondida” a mano. Con la consulta cerrada no se puede responder: primero se reabre. Un envío fallido no cambia el estado.

### Responder

El mensaje (10 a 3000 caracteres, texto plano) va al **email guardado en la consulta**; el navegador no puede elegir destinatario. El autor sale de la sesión. Asunto: `[Reflection Tech] Respuesta a consulta #<id>`, con `replyTo` del equipo. Una respuesta enviada no se edita: una corrección es otra respuesta.

### Reintentar un envío

| Estado del envío | ¿Se puede reintentar? |
|---|---|
| aceptado | Nunca (409 ENVIO_ACEPTADO) |
| enviando (bloqueo vigente) | No (409 ENVIO_EN_CURSO) |
| pendiente / error | Sí, si pasaron **60 s** desde el inicio del intento anterior |
| desconocido | Sí, revisando antes el panel de Brevo y marcando la confirmación de riesgo |
| 3 intentos hechos | No (409 INTENTOS_AGOTADOS): corregir la configuración y registrar el incidente |

## 5. Si un email no llega

1. **¿La consulta existe?** Si aparece en `/operador/consultas`, se registró. Si el visitante vio un error 503 o de conexión y no aparece, no se registró.
2. **Mirá el estado del envío** en el detalle:
   - `aceptado`: Brevo lo admitió. Revisá spam y el log del panel de Brevo (Transactional → Logs) con el **ID proveedor**.
   - `error` con `HTTP_401_*`: clave API inválida. `HTTP_400_*`: remitente no verificado o datos inválidos. `RED_ENOTFOUND` / `RED_ECONNREFUSED`: el servidor no llegó a Brevo.
   - `desconocido` con `TIMEOUT` o `RED_*`: pudo haberse enviado. Buscalo en el log de Brevo **antes** de reintentar.
   - `pendiente`: el proceso se cortó antes de intentar; se puede reintentar.
3. Revisá variables (`BREVO_API_KEY`, `MAIL_FROM_EMAIL` verificado en Brevo, `CONTACT_TO_EMAIL`) y la cuota diaria.
4. Reintentá desde el panel. El historial de intentos queda en la tabla.

Los logs del módulo registran envío, estado y código resumido; nunca la clave, el cuerpo ni la respuesta completa del proveedor.

## 6. Métricas y gráficos (`/admin/metricas`)

Solo administrador. La interfaz consume `GET /api/admin/metricas` de I2; no tiene cifras escritas en el código.

- **Rango**: Últimos 7 días (sin fechas: el servidor usa los 7 días de Argentina hasta hoy), Últimos 30 días o Personalizado (máximo 90 días, sin fechas futuras ni anteriores a hoy − 89).
- **Tipo de consulta**: filtra **solo** consultas. Visitas, accesos y cuentas conservan su cifra.
- **Tarjetas**: visitas, accesos autenticados, cuentas creadas y consultas.
- **Gráficos** (Chart.js 4 local): línea de visitas y accesos por día; barras de cuentas por día; dona de consultas por tipo. Cada uno tiene su tabla para leer los valores sin depender del color.
- Al aplicar filtros se cancela la petición anterior (`AbortController`) y se actualizan las mismas instancias de Chart.js; nunca se superponen gráficos.
- Sin datos: ceros, tablas en cero y **“Sin datos para este rango”**. La dona se oculta en lugar de inventar una porción.
- Si el rango incluye visitas marcadas como prueba, aparece un aviso.
- Colores por entidad (validados para daltonismo y contraste): visitas y General `#1D4ED8`, accesos y Cotización `#C2410C`, cuentas y Asesoría `#0D9488`. La línea de accesos además es punteada y con otro marcador.

## 7. Errores que devuelve el módulo

Formato: `{"ok":false,"error":{"code","message","fields?","requestId"}}`.

| HTTP | code | Cuándo |
|---|---|---|
| 400 | PARAMETRO_INVALIDO | ID, query o `Idempotency-Key` inválidos |
| 401 / 403 | NO_AUTENTICADO / SIN_PERMISO / CSRF_INVALIDO | Middlewares de I4 |
| 404 | NO_ENCONTRADO | Consulta o envío inexistente |
| 409 | IDEMPOTENCIA_CONFLICTO | Clave reutilizada con otros datos, sesión o autor |
| 409 | ESTADO_INCOMPATIBLE / CONSULTA_CERRADA | Transición no permitida o responder una consulta cerrada |
| 409 | ENVIO_ACEPTADO / ENVIO_EN_CURSO / ESPERA_REQUERIDA / CONFIRMACION_REQUERIDA / INTENTOS_AGOTADOS | Reglas de reintento (`ESPERA_REQUERIDA` incluye `Retry-After`) |
| 415 | TIPO_NO_ADMITIDO | Escritura que no es `application/json` |
| 422 | VALIDACION | Campos inválidos, con `fields` |
| 503 | SERVICIO_NO_DISPONIBLE | Base inaccesible: nada se confirmó |
| 500 | ERROR_INTERNO | Inesperado; usar `requestId` para buscar en el log |

## 8. Configuración de Brevo (para I2 y el despliegue)

Esta guía no contiene claves ni direcciones reales. Los valores se cargan solo en `.env` (local, ignorado por Git) y en el panel de Render.

### Pasos en Brevo

1. **Cuenta.** El plan gratuito admite 300 correos por día por API. El equipo se limita a 20 envíos de prueba por día y los registra en `docs/pruebas.md` §4.
2. **Remitente.** En *Senders, domains & dedicated IPs → Senders → Add a sender* se agrega la casilla del equipo y se confirma con el código que llega a esa casilla. Esa dirección es `MAIL_FROM_EMAIL`.
   - Con una casilla gratuita (por ejemplo gmail.com) Brevo no puede autenticar el dominio y reescribe el remitente a uno propio (`*.brevosend.com`). El correo llega igual, pero el destinatario ve que lo envió Brevo. Esto ya se comprobó en I6 02.
   - Para mostrar un remitente propio hace falta un dominio del equipo autenticado en *Domains* (SPF, DKIM y DMARC). No es obligatorio para la entrega.
3. **Clave de API.** En *SMTP & API → API keys* se genera una clave nueva. Si Brevo ofrece permisos por clave, se habilitan solo los de **emails transaccionales**. La clave se ve una sola vez: se copia directo a `BREVO_API_KEY`.
   - Usar una clave para desarrollo y otra para producción, así borrar una no corta la otra.
   - Nunca pegarla en el repositorio, en un chat, en una captura ni en un PR. Si se expone, se **borra en Brevo y se genera otra** (rotación), y se actualiza `.env` o Render. Después hay que reiniciar el servidor, porque la variable se lee al arrancar.
4. **IPs autorizadas.** Si en la seguridad de la cuenta está activo el bloqueo de IPs desconocidas, Brevo rechaza las llamadas de un servidor nuevo y el envío queda en `error` con un código `HTTP_401_*`. Para Render hay dos opciones: autorizar las IPs de salida que Render muestra para el servicio, o desactivar ese bloqueo. Al probar desde una PC o red nueva puede pasar lo mismo.

### Variables en Render

| Variable | Qué va | Cómo comprobarla sin mostrarla |
|---|---|---|
| `BREVO_API_KEY` | Clave de producción del paso 3 | Un envío de prueba queda `aceptado` y no `HTTP_401_*` |
| `MAIL_FROM_EMAIL` | Remitente verificado del paso 2 | Figura como verificado en *Senders*; si no, Brevo responde `HTTP_400_*` |
| `MAIL_FROM_NAME` | `Reflection Tech` | Nombre visible en el correo recibido |
| `CONTACT_TO_EMAIL` | Casilla del equipo que recibe las notificaciones | Llega la notificación de la consulta de prueba |

Con `NODE_ENV=production`, `src/config/env.js` exige las cuatro y el servidor no arranca si falta alguna. En desarrollo pueden quedar vacías (ver §2).

### Comprobación después de desplegar

1. Enviar una consulta desde `/contacto` en la URL de Render.
2. En `/operador/consultas/<id>`, el envío `notificacion` debe estar `aceptado` y tener **ID proveedor**.
3. Buscar ese ID en Brevo (*Transactional → Logs*) y revisar Recibidos y spam de `CONTACT_TO_EMAIL`.
4. Responder la consulta desde el panel y comprobar que llega al email de la consulta.
5. Registrar ambas pruebas en `docs/pruebas.md` §4.

Si Brevo agota la cuota del día, el envío queda en `error` y la consulta se conserva. Se reintenta desde el panel al día siguiente (máximo 3 intentos, ver §4).
