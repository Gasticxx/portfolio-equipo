# Guía de Publicación, Continuidad, Respaldo y Operación — Equipo Seis (I2 08 e I2 09)

Este documento define el procedimiento oficial de publicación en Render, conexión con Supabase PostgreSQL y Storage, correo transaccional con Brevo, política de conservación y recuperación ante desastres según el Apartado 21 de la especificación.

## 1. Configuración del Web Service en Render (Plan Gratuito)

- **Repositorio conectado:** `portfolio-equipo` (rama estable `main`).
- **Runtime:** `Node` (toma Node `24.22.2` desde `.nvmrc` y `engines.node` en `package.json`).
- **Build Command:** `npm ci && npm run assets`
- **Start Command:** `npm start`
- **Health Check Path:** `/health` (no requiere sesión ni suma visitas; ejecuta `SELECT 1` contra PostgreSQL y devuelve `200 {"ok":true}` o `503 {"ok":false}`).
- **Red y Proxy:** El servidor escucha en `0.0.0.0` y el `PORT` inyectado por Render. Con `NODE_ENV=production`, `src/app.js` activa `trust proxy = 1` y cabeceras HSTS.

## 2. Variables de entorno en Producción (Render)

En el panel de Render (`Environment`) se cargan únicamente las variables de ejecución. **Prohibido** incluir `MIGRATION_DATABASE_URL` o `TEST_DATABASE_URL` en Render:

| Variable                    | Configuración en Render (Producción)                                                                                                          | Responsable del dato |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- | :------------------- |
| `NODE_ENV`                  | `production`                                                                                                                                  | I2                   |
| `APP_ORIGIN`                | URL HTTPS exacta asignada por Render (ej. `https://portfolio-equipo.onrender.com`), sin barra final                                           | I2                   |
| `DATABASE_URL`              | Cadena del **Session Pooler** de Supabase (puerto `5432`, compatible con IPv4) usando el rol de aplicación `portfolio_app` (sin permisos DDL) | I5 + I2              |
| `DB_SSL`                    | `true` (verifica certificado con `rejectUnauthorized: true`)                                                                                  | I2                   |
| `DB_CA_CERT_BASE64`         | Certificado raíz de Supabase en Base64 si la cadena lo requiere (o vacío si ya es confiable)                                                  | I5 + I2              |
| `SESSION_SECRET`            | Secreto aleatorio exclusivo de producción (64 hex generado con `node:crypto`)                                                                 | I2                   |
| `VISIT_SECRET`              | Segundo secreto aleatorio exclusivo de producción, distinto de `SESSION_SECRET`                                                               | I2                   |
| `SUPABASE_URL`              | URL HTTPS del proyecto Supabase (`https://<id>.supabase.co`)                                                                                  | I5                   |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave privada `service_role` de Supabase (exclusiva del backend)                                                                              | I5                   |
| `SUPABASE_STORAGE_BUCKET`   | `portfolio-media` (bucket privado para portadas WebP)                                                                                         | I5                   |
| `BREVO_API_KEY`             | Clave privada de API v3 de Brevo (`https://api.brevo.com/v3/smtp/email`)                                                                      | I6                   |
| `MAIL_FROM_EMAIL`           | Remitente verificado en el panel de Brevo                                                                                                     | I6                   |
| `MAIL_FROM_NAME`            | `Equipo Seis`                                                                                                                                 | I6                   |
| `CONTACT_TO_EMAIL`          | Casilla real de recepción de notificaciones del equipo                                                                                        | I6                   |

## 3. Secuencia de Despliegue y Migraciones (Sin Shell remota)

1. En Render Free no se ejecutan migraciones ni seeds automáticos al iniciar el contenedor.
2. Antes de desplegar un cambio de esquema, **I5** genera un respaldo (`pg_dump`) y ejecuta desde su PC local apuntando a `MIGRATION_DATABASE_URL`:
   - `npm run db:migrate`
   - `npm run db:seed` (solo carga datos iniciales faltantes sin pisar ediciones humanas).
3. **I4** da de alta las cuentas iniciales (`administrador`, `operador` y `registrado`) mediante `npm run cuenta:crear` ingresando las contraseñas por terminal sin eco.

## 4. Condiciones y Límites de los Planes Gratuitos

- **Render Web Service Free:** Puede entrar en reposo tras 15 minutos sin tráfico y demorar en el primer acceso; el disco local es efímero (por eso sesiones van a `app.sesiones` en PostgreSQL y portadas al bucket `portfolio-media` en Supabase Storage). No se utiliza el PostgreSQL gratuito de Render (caduca a los 30 días).
- **Supabase Free:** Incluye 500 MB de base de datos PostgreSQL y 1 GB en Storage. Puede pausarse tras 7 días de inactividad y no incluye backups automáticos.
- **Brevo Free:** Permite hasta 300 correos diarios por API HTTPS (no se usa SMTP bloqueado en Render Free). El equipo limita sus pruebas a un máximo de 20 envíos diarios.

## 5. Respaldo (`pg_dump`), Restauración (`portfolio_restore_test`) y Reversión (I2 09)

1. **Generación de backup (I5 al cierre de cada sprint y antes de migrar):**
   `pg_dump --schema=app --no-owner --no-privileges --file=backup_app_YYYYMMDD.sql "<MIGRATION_DATABASE_URL>"`
   _(Los archivos `.webp` del bucket `portfolio-media` se respaldan por separado, ya que `pg_dump` guarda solo los metadatos de `app.archivos`)._
2. **Prueba de restauración no destructiva (Caso A38):**
   Nunca se prueba una restauración sobre la base de entrega. Se crea una base local `portfolio_restore_test` y se ejecuta:
   `psql -d portfolio_restore_test -f backup_app_YYYYMMDD.sql`
3. **Reversión de código en Git:**
   Si un commit en `main` introduce una regresión, **I2** identifica el último commit o tag estable en GitHub Actions y aplica `git revert <sha>` mediante Pull Request. **Importante:** revertir código JS no deshace una migración SQL ni restaura filas borradas; si hubo impacto en datos, se coordina con **I5** la restauración desde el último backup verificado.

## 6. Respuesta ante Incidentes (Apartado 21.1)

| Problema observado              | Diagnóstico inicial                                           | Responsable y acción                                                                                    |
| :------------------------------ | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------ |
| El sitio tarda al primer acceso | Servicio Render Free dormido tras 15 min inactivo             | I2 abre el sitio 10 minutos antes del turno de exposición y verifica `GET /health` -> `200 {"ok":true}` |
| `/health` devuelve `503`        | Proyecto Supabase pausado, certificado TLS o `DATABASE_URL`   | I2 e I5 verifican estado activo en Supabase y variables en Render sin imprimir secretos                 |
| Login no conserva sesión        | Cookie `secure`, `trust proxy`, `app.sesiones` o `APP_ORIGIN` | I4 e I2 verifican HTTPS, `trust proxy = 1` y que `APP_ORIGIN` no tenga barra final                      |
| Portada ausente (`404` / `502`) | Objeto ausente en bucket `portfolio-media` o clave Storage    | I5 comprueba `app.archivos` y permisos del bucket privado                                               |
| Consulta guardada sin email     | Estado `error` o `desconocido` en `app.envios_email`          | I6 revisa remitente y cuota en Brevo; ejecuta reintento consciente desde `/operador/consultas/:id`      |
