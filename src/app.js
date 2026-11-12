import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { CONSTANTS } from "./config/constants.js";
import { checkDbHealth, pool } from "./config/db.js";
import { sessionMiddleware } from "./config/session.js";
import {
  requestIdMiddleware,
  safeRequestLogger,
  notFoundHandler,
  errorHandler,
} from "./middlewares/errors.js";
import { cargarUsuarioActual, requerirRol } from "./middlewares/auth.js";
import { recuperarNavegacionPublica } from "./middlewares/session-recovery.js";
import { verificarCsrf } from "./middlewares/csrf.js";
import {
  limiteContactoIp,
  limiteOperadorUsuario,
} from "./middlewares/limits.js";
import { analyticsMiddleware } from "./middlewares/analytics.js";
import { crearModuloConsultas } from "./routes/consultas.routes.js";
import { metricasRouter } from "./routes/metricas.routes.js";
import { interfazRouter } from "./routes/interfaz.routes.js";
import { demosRouter } from "./routes/demos.routes.js";
import { serviciosRouter } from "./routes/servicios.routes.js";
import authRouter from "./routes/auth.routes.js";
import {
  obtenerCsrf,
  mostrarLogin,
  mostrarRegistro,
  mostrarMiCuenta,
} from "./controllers/auth.controller.js";
import { usuariosRouter } from "./routes/usuarios.routes.js";
import { serviciosRouter } from "./routes/servicios.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
// Los parciales compartidos usan las rutas de la aplicación principal.
app.locals.baseUi = "";

// 1. Configuración de proxy y deshabilitar x-powered-by (Apartado 17)
app.disable("x-powered-by");
app.set("trust proxy", env.IS_PROD ? 1 : false);

// Configuración de vistas EJS
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// 2. Orden obligatorio del Apartado 17
// Paso 1: requestId y log seguro
app.use(requestIdMiddleware);
app.use(safeRequestLogger);

// Paso 2: Cabeceras de seguridad (Helmet con CSP estricta y HSTS solo en producción)
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    strictTransportSecurity: env.IS_PROD
      ? { maxAge: 15552000, includeSubDomains: true }
      : false,
  }),
);

// Paso 3: Archivos estáticos públicos antes de la sesión
app.use(express.static(path.join(__dirname, "public")));

// Paso 4: Parsers limitados a 32 KiB
app.use(express.json({ limit: CONSTANTS.JSON_BODY_LIMIT }));
app.use(
  express.urlencoded({ extended: false, limit: CONSTANTS.JSON_BODY_LIMIT }),
);

// Paso 5: Cookie-parser firmado con VISIT_SECRET
app.use(cookieParser(env.VISIT_SECRET));

// Health check antes de sessionMiddleware y analyticsMiddleware (Apartado 21 y pedido de I6):
// No requiere sesión, no cuenta visitas y responde siempre JSON 200 {"ok":true} o 503 {"ok":false}.
app.get("/health", async (_req, res) => {
  try {
    const dbOk = await checkDbHealth();
    if (!dbOk) {
      return res.status(503).json({ ok: false });
    }
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(503).json({ ok: false });
  }
});

// Paso 6: Recuperamos la sesión desde PostgreSQL.
app.use(sessionMiddleware);

// Paso 7: Comprobamos la sesión y cargamos el usuario vigente.
app.use(cargarUsuarioActual);
app.use(recuperarNavegacionPublica);

// Paso 8: Timeout y analítica de visitas
app.use((req, res, next) => {
  req.setTimeout(CONSTANTS.REQUEST_TIMEOUT_MS);
  res.setTimeout(CONSTANTS.REQUEST_TIMEOUT_MS);
  next();
});
app.use(analyticsMiddleware);

// Paso 9: Rutas de la aplicación
app.get("/api/csrf", obtenerCsrf);
app.get("/registro", mostrarRegistro);
app.get("/login", mostrarLogin);
app.get("/mi-cuenta", mostrarMiCuenta);
app.use("/api/auth", authRouter);

app.use(metricasRouter);
app.use(usuariosRouter);

// El módulo de consultas usa los permisos, CSRF y límites del equipo.
const consultas = crearModuloConsultas({
  pool,
  env,
  auth: { api: requerirRol },
  csrf: verificarCsrf,
  limites: { contacto: limiteContactoIp, operador: limiteOperadorUsuario },
});

app.use("/api", consultas.api);
app.use(consultas.paginas);

// Las rutas de autenticación y consultas se resuelven antes que la interfaz de I3.
app.use(demosRouter);
app.use(serviciosRouter);
app.use(interfazRouter);
// Servicios aporta las APIs y su panel administrativo; I3 conserva la vista pública.
app.use(serviciosRouter);

// Paso 10: Recurso inexistente (404)
app.use(notFoundHandler);

// Paso 11: Manejador final de errores
app.use(errorHandler);
