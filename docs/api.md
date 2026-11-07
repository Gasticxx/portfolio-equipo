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