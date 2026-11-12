# Reflection Tech — Portfolio Fullstack

Aplicación web fullstack del **Reflection Tech**, desarrollada con Node.js 24 LTS, Express 5, EJS 3, PostgreSQL 17 y Bootstrap 5.

## Requisitos de entorno

- **Node.js:** `24.22.2` (definido en `.nvmrc`)
- **PostgreSQL:** `17`
- **Cliente Git:** Git + GitHub Desktop

Verificá tus herramientas antes de empezar ejecutando en la terminal:

- `git --version`
- `node --version`
- `npm --version`

## Integrantes y Roles

| Código | Rol Scrum / Especialidad             | Responsabilidad principal                                                            | Revisor principal  |
| :----- | :----------------------------------- | :----------------------------------------------------------------------------------- | :----------------- |
| **I1** | Product Owner / Producto y servicios | Inicio, seis perfiles, aportes, servicios y matriz de requisitos                     | I3 (UI) / I5 (SQL) |
| **I2** | Scrum Master / Backend e integración | Repositorio, servidor Express/EJS, configuración, CI, visitas, métricas y despliegue | I5                 |
| **I3** | Diseño e interfaces                  | Manual visual, layout, componentes EJS, adaptación móvil y animaciones               | I1                 |
| **I4** | Autenticación y usuarios             | Registro, sesión, permisos, CSRF y gestión de usuarios                               | I2                 |
| **I5** | Datos y proyectos                    | Modelo SQL, migraciones, seeds, proyectos, demos e imágenes en Storage               | I4                 |
| **I6** | Contacto y métricas visuales         | Consultas, panel de operador, envíos por Brevo, filtros y gráficos Chart.js          | I4 / I1 (gráficos) |

## Flujo de trabajo con Git (Acuerdo de equipo)

1. **Rama estable:** `main`. Nadie hace push directo a `main` una vez configurado el entorno base.
2. **Ramas de trabajo:** Una rama corta por tarjeta desde `main` actualizado (ejemplo: `feature/I2-02-base-express`, `fix/I6-07-reintento` o `docs/perfil-I1`).
3. **Pull Requests:** Todo cambio se sube mediante Pull Request enlazando la tarjeta correspondiente, explicando cómo se comprobó y asignando al revisor principal distinto del autor.
4. **Integración:** Una vez aprobado y con los checks en verde, se integra mediante **Squash and merge** y se borra la rama.

## Primera práctica de Git (Jornada 0)

Cada integrante debe:

1. Clonar este repositorio con GitHub Desktop.
2. Crear una rama llamada `docs/perfil-Ix` (reemplazando `Ix` por su código: `I1`, `I2`, `I3`, `I4`, `I5` o `I6`).
3. Copiar la plantilla `docs/integrantes/PLANTILLA.md` a `docs/integrantes/Ix.md` y completar sus datos reales.
4. Abrir un Pull Request hacia `main` y asignar a su revisor inicial:
   - I1 revisa a I3
   - I3 revisa a I1
   - I2 revisa a I4
   - I4 revisa a I5 e I6
   - I5 revisa a I2

## Instalación y puesta en marcha local (Para los 5 integrantes)

Una vez clonado el repositorio con GitHub Desktop, abrí la carpeta en Visual Studio Code y ejecutá estos pasos en la terminal (`Ctrl + Ñ`):

### 1. Crear tus archivos de variables de entorno locales

En PowerShell (Windows):

    Copy-Item .env.example .env
    Copy-Item .env.example .env.test

### 2. Generar tus dos secretos locales distintos (`SESSION_SECRET` y `VISIT_SECRET`)

Ejecutá dos veces este comando en la terminal:

    node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"

Pegá el primer código en `SESSION_SECRET=` y el segundo en `VISIT_SECRET=` dentro de tu archivo `.env` (y repetilo en `.env.test` cambiando `NODE_ENV=test`). Guardá ambos archivos (`Ctrl + S`).

### 3. Instalar dependencias congeladas y preparar librerías visuales

**Importante:** No ejecutar `npm install` ni `npm update`. Usar exclusivamente:

    npm ci
    npm run assets

### 4. Ejecutar migraciones, datos iniciales, pruebas y levantar el servidor

    npm run db:migrate
    npm run db:seed
    npm run test:unit
    npm test
    npm run dev

Abrí en el navegador `http://localhost:3000`.

---

## Despliegue en Producción y Límites de Planes Gratuitos (I2 08)

La versión publicada se ejecuta en un **Web Service Free de Render** conectado a la rama `main`, utilizando **Supabase** (PostgreSQL 17 vía Session Pooler IPv4 en puerto 5432 y bucket privado `portfolio-media`) y **Brevo API HTTPS**:

- **Build Command:** `npm ci && npm run assets`
- **Start Command:** `npm start`
- **Health Check:** `GET /health` (`200 {"ok":true}`)
- **Condiciones operativas del plan gratuito:**
  - **Render Free:** Se suspende tras 15 minutos sin actividad (el primer acceso puede demorar en despertar) y su disco local es efímero; por ello las sesiones persisten en PostgreSQL (`app.sesiones`), los límites en `app.limites` y las imágenes en Supabase Storage.
  - **Supabase Free:** 500 MB de base de datos y 1 GB de Storage; se pausa tras 7 días de inactividad (verificar actividad antes de cada demostración).
  - **Brevo Free:** Hasta 300 correos diarios mediante API HTTPS (`POST [https://api.brevo.com/v3/smtp/email](https://api.brevo.com/v3/smtp/email)`); las pruebas del equipo se acotan a un máximo de 20 envíos por día.
  - **Conservación de datos (`npm run db:limpiar`):** Sesiones según expiración, límites 24 h después de vencer su ventana, visitas y accesos 90 días, y consultas/respuestas/envíos 180 días. Ver detalle completo en `docs/despliegue.md`.

---

## Arquitectura del Sistema y Módulos por Integrante (I2 10 — Requisito R11)

La aplicación **Reflection Tech** sigue una arquitectura en capas sobre **Node.js 24.22.2 (ESM)**, **Express 5**, **EJS 3** y **PostgreSQL 17** (esquema `app`), separando estrictamente rutas (`src/routes`), controladores HTTP (`src/controllers`), validadores Zod (`src/validators`), lógica de negocio y transacciones (`src/services`) y consultas SQL parametrizadas (`src/repositories`):

1. **Orden del Pipeline HTTP (`src/app.js`):**
   `requestId` y log estructurado -> `helmet` (CSP estricta sin scripts inline) -> archivos estáticos (`src/public`) -> parsers JSON/URL-encoded limitados a 32 KiB -> `cookie-parser` firmado (`VISIT_SECRET`) -> sesión en PostgreSQL (`app.sesiones`, `equipo.sid`) -> verificación de usuario vigente (`activo` y `version_sesion`) -> límites de abuso en PostgreSQL (`app.limites`) y analítica de visitas (`analytics.js`) -> rutas de pantallas y API (`/api/*`) -> manejadores 404 y de errores sin filtración de SQL ni stack traces.

2. **Responsabilidades y Módulos por Integrante:**
   - **I1 (Producto, Equipo y Servicios):** Inicio, seis perfiles públicos, catálogo y CRUD administrativo de servicios (`equipo.*`, `servicios.*`), matriz de requisitos (`docs/requisitos.md`) y manual de uso (`docs/uso.md`).
   - **I2 (Servidor, Integración, Métricas y Despliegue):** Base Express/EJS (`src/app.js`, `src/server.js`, `src/config/*`), seguridad común y rate limiting (`errors.js`, `limits.js`), captura de visitas y accesos (`analytics.js`, `metricas.*`), API `GET /api/admin/metricas`, script `scripts/limpiar.js`, CI (`.github/workflows/ci.yml`) y despliegue (`docs/despliegue.md`, `docs/api.md`).
   - **I3 (Diseño, Componentes y UI de Demos):** Sistema de tokens CSS, manual visual (`docs/manual-diseno.md`), parciales EJS (`src/views/partials`), accesibilidad, animaciones y vistas interactivas del tablero de tareas y visualizador de algoritmos.
   - **I4 (Identidad, Sesiones, Permisos y Usuarios):** Registro, login/logout con `node:crypto.scrypt`, sesiones en PostgreSQL (`session.js`), protección CSRF (`csrf.js`), autorización por rol y revocación inmediata (`auth.js`, `usuarios.*`, `docs/permisos.md`) y scripts `crear-cuenta.js` / `recuperar-cuenta.js`.
   - **I5 (Datos, Proyectos, Demos e Imágenes):** Esquema SQL, migraciones con bloqueo asesor (`scripts/migrate.js`) y seeds (`scripts/seed.js`), CRUD de proyectos y demos (`proyectos.*`, `demos.*`), lógica de demos, procesado de imágenes WebP con `sharp` y Supabase Storage (`archivos.*`), respaldos `pg_dump` y restauración.
   - **I6 (Contacto, Operador, Correo y Gráficos):** Circuito de consultas con idempotencia (`consultas.*`), integración con Brevo API HTTPS (`email.service.js`), panel de operador con respuestas y reintentos, gráficos interactivos con Chart.js (`js/metricas.js`) y plan de pruebas (`docs/pruebas.md`).
