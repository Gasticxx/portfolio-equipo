# Contratos de Integración y Puntos de Enganche — Equipo Seis (I2 03)

Este documento fija los contratos de integración entre el servidor base (I2) y los módulos de I1, I3, I4, I5 e I6 según la especificación oficial.

## 1. Formato común de respuestas API (Apartado 11)

- **Éxito (200 / 201):**
  `{ "ok": true, "data": {} }`

- **Éxito paginado (200):**
  `{ "ok": true, "data": [], "meta": { "page": 1, "pageSize": 10, "total": 0, "totalPages": 0 } }`

- **Eliminación (204):**
  Sin cuerpo.

- **Error (4xx / 5xx):**
  `{ "ok": false, "error": { "code": "CODIGO_ESTABLE", "message": "Mensaje claro para el usuario.", "requestId": "uuid-v4" } }`

## 2. Puntos de enganche en src/app.js

1. **Con I3 (Vistas y Parciales EJS):**
   - Ubicación de parciales comunes: `src/views/partials/` (`header.ejs`, `nav.ejs`, `footer.ejs`, `alerts.ejs`).
   - Variables disponibles en `res.locals` en todas las vistas: `requestId`, `usuarioActual` y `visitaId`.

2. **Con I4 (Sesión, Usuario vigente y Permisos):**
   - `src/config/session.js`: usa el `pool` compartido de `src/config/db.js`, cookie `equipo.sid` y tabla `app.sesiones`.
   - Al hacer login (`POST /api/auth/login`), I4 regenera `equipo.sid` pero conserva `req.signedCookies['equipo.visita']` (y `res.locals.visitaId`) para que I2 registre el acceso en `app.accesos` sin duplicar la visita general.

3. **Con I5 (Esquema SQL requerido por I2 en db/migrations/001_base.sql):**
   - Tablas del Apartado 10.5 que I5 incluye en la migración inicial:
     - `app.visitas (id UUID PRIMARY KEY, iniciada_at TIMESTAMPTZ NOT NULL DEFAULT now(), ultima_actividad_at TIMESTAMPTZ NOT NULL DEFAULT now(), es_prueba BOOLEAN NOT NULL DEFAULT false)` con índice `idx_visitas_iniciada_at (iniciada_at)`.
     - `app.accesos (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, visita_id UUID NOT NULL REFERENCES app.visitas(id) ON DELETE CASCADE, usuario_id INTEGER NOT NULL REFERENCES app.usuarios(id) ON DELETE RESTRICT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (visita_id, usuario_id))` con índice `idx_accesos_created_at (created_at)`.
     - `app.limites (clave CHAR(64) NOT NULL, ventana_inicio TIMESTAMPTZ NOT NULL, contador INTEGER NOT NULL CHECK (contador >= 1), expira_at TIMESTAMPTZ NOT NULL, PRIMARY KEY (clave, ventana_inicio))` con índice `idx_limites_expira_at (expira_at)`.

---

## 3. Contrato de la API de Métricas (I2 07 -> I6 08 — Apartado 15 y 20.2)

### Endpoint y Autorización

- **Ruta:** `GET /api/admin/metricas`
- **Acceso:** Exclusivo rol `administrador` (Sesión activa en `equipo.sid`).
- **Cabeceras de respuesta:** `Content-Type: application/json; charset=utf-8` y `Cache-Control: no-store`.
- **Petición desde el navegador (I6):** Usar `fetch` con `credentials: 'same-origin'`, `Accept: 'application/json'` y `AbortController` para cancelar la petición anterior si el usuario cambia rápido los filtros.

### Parámetros de consulta (Query Params)

Solo se admiten los parámetros `desde`, `hasta` y `tipo`. Cualquier parámetro desconocido o repetido responde `400 PARAMETRO_INVALIDO`.

| Parámetro | Tipo / Formato                                     | Regla de validación                                                                                                                                                                                          |
| :-------- | :------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `desde`   | `YYYY-MM-DD` (opcional)                            | Fecha calendario real. Si se omiten `desde` y `hasta`, se usan los últimos 7 días de calendario en Argentina (`hoy - 6 días` a `hoy`). Indicar solo una de las dos fechas devuelve `400 PARAMETRO_INVALIDO`. |
| `hasta`   | `YYYY-MM-DD` (opcional)                            | Fecha calendario real. Debe cumplir `hasta >= desde`, no ser futura (`hasta <= hoy` en Argentina), rango inclusivo máximo de 90 días y `desde >= hoy - 89 días`.                                             |
| `tipo`    | `general` \| `cotizacion` \| `asesoria` (opcional) | Si se omite o envía vacío, equivale a `null` (todas las categorías). Filtra únicamente `totales.consultas` y `consultasPorTipo`; no altera `visitas`, `accesosAutenticados` ni `cuentasCreadas`.             |

### Interpretación horaria en el Backend

- Se utiliza la zona `America/Argentina/Buenos_Aires` (UTC-3) para convertir `desde` al inicio del día (`00:00:00.000-03:00`) y `hasta` al inicio del día siguiente (`(hasta + 1 día)T00:00:00.000-03:00`).
- Todas las consultas filtran con límite superior exclusivo (`fecha >= inicio AND fecha < finExclusivo`), incluyendo completo el día final hasta las `23:59:59.999`.

### Estructura exacta de respuesta exitosa (`200 OK`)

- `ok`: `true`
- `data.filtros`: `{ "desde": "2026-11-01", "hasta": "2026-11-03", "tipo": null, "zonaHoraria": "America/Argentina/Buenos_Aires" }`
- `data.totales`: `{ "visitas": 4, "accesosAutenticados": 3, "cuentasCreadas": 2, "consultas": 4 }`
- `data.traficoDiario`: Array con un punto por cada fecha `YYYY-MM-DD` del rango (días sin datos en `0`):
  `[ { "fecha": "2026-11-01", "visitas": 2, "accesos": 1 }, { "fecha": "2026-11-02", "visitas": 1, "accesos": 2 }, { "fecha": "2026-11-03", "visitas": 1, "accesos": 0 } ]`
- `data.registrosDiarios`: Array con un punto por cada fecha `YYYY-MM-DD` del rango (días sin datos en `0`):
  `[ { "fecha": "2026-11-01", "cuentas": 1 }, { "fecha": "2026-11-02", "cuentas": 1 }, { "fecha": "2026-11-03", "cuentas": 0 } ]`
- `data.consultasPorTipo`: Array fijo con las 3 categorías en orden (`0` en las que no coinciden con el filtro `tipo`):
  `[ { "tipo": "general", "cantidad": 2 }, { "tipo": "cotizacion", "cantidad": 1 }, { "tipo": "asesoria", "cantidad": 1 } ]`
- `data.incluyeDatosDePrueba`: `boolean` (`true` si alguna visita en el rango tiene `es_prueba = true`).

### Errores controlados del endpoint

- `400 PARAMETRO_INVALIDO`: Fecha inexistente (ej. `2026-02-30`), solo una fecha enviada, `hasta < desde`, fecha futura, rango mayor a 90 días, `tipo` inválido o parámetro desconocido/repetido.
- `401 NO_AUTENTICADO`: Sin sesión activa.
- `403 SIN_PERMISO`: Sesión activa con rol `registrado` u `operador` (Caso A14).
