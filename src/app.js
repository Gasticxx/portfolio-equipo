import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { CONSTANTS } from "./config/constants.js";
import { checkDbHealth } from "./config/db.js";
import { sessionMiddleware } from "./config/session.js";
import {
  requestIdMiddleware,
  safeRequestLogger,
  notFoundHandler,
  errorHandler,
} from "./middlewares/errors.js";
import { cargarUsuarioActual } from "./middlewares/auth.js";
import { analyticsMiddleware } from "./middlewares/analytics.js";
import { obtenerCsrf } from "./controllers/auth.controller.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

// 1. Configuración de proxy y deshabilitar x-powered-by (Apartado 17)
app.disable("x-powered-by");
app.set("trust proxy", env.IS_PROD ? 1 : false);

// Configuración de vistas EJS
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// 2. Orden obligatorio del Apartado 17:
// Paso 1: requestId y log seguro
app.use(requestIdMiddleware);
app.use(safeRequestLogger);

// Paso 2: Cabeceras de seguridad (helmet con CSP estricta y HSTS solo en producción)
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

// Paso 3: Archivos estáticos públicos (antes de sesión para no renovarla con assets)
app.use(express.static(path.join(__dirname, "public")));

// Paso 4: Parsers limitados a 32 KiB
app.use(express.json({ limit: CONSTANTS.JSON_BODY_LIMIT }));
app.use(
  express.urlencoded({ extended: false, limit: CONSTANTS.JSON_BODY_LIMIT }),
);

// Paso 5: Cookie-parser firmado con VISIT_SECRET.
app.use(cookieParser(env.VISIT_SECRET));

// Paso 6: Recuperamos la sesión desde PostgreSQL.
app.use(sessionMiddleware);

// Paso 7: Comprobamos la sesión y cargamos el usuario vigente.
app.use(cargarUsuarioActual);

// Paso 8: Límites y timeout de petición entrante (30s) + Analítica de visitas (I2 04)
app.use((req, res, next) => {
  req.setTimeout(CONSTANTS.REQUEST_TIMEOUT_MS);
  res.setTimeout(CONSTANTS.REQUEST_TIMEOUT_MS);
  next();
});
app.use(analyticsMiddleware);

// Paso 9: Rutas base (Inicio y /health del Apartado 21)
// Entregamos el token también a visitantes que todavía no iniciaron sesión.
app.get("/api/csrf", obtenerCsrf);
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

app.get("/", (_req, res) => {
  res.render("pages/inicio", {
    titulo: "Inicio",
  });
});

// Paso 10: Recurso inexistente (404)
app.use(notFoundHandler);

// Paso 11: Manejador final de errores
app.use(errorHandler);