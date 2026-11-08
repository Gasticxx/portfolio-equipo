import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./db.js";
import { env } from "./env.js";
import { CONSTANTS } from "./constants.js";

// Adaptamos el almacén de PostgreSQL para usarlo con express-session.
const PgSessionStore = connectPgSimple(session);

// Reutilizamos el pool de I2 y la tabla que creará la migración de I5.
const store = new PgSessionStore({
  pool,
  schemaName: "app",
  tableName: "sesiones",
  createTableIfMissing: false,

  // Limpiamos las sesiones vencidas cada 15 minutos.
  pruneSessionInterval: CONSTANTS.SESSION.PRUNE_INTERVAL_SECONDS,
  pruneSessionRandomizedInterval: false,
});

export const sessionMiddleware = session({
  name: CONSTANTS.SESSION.COOKIE_NAME,
  secret: env.SESSION_SECRET,
  store,

  // Guardamos una sesión nueva cuando la aplicación le asigna datos.
  saveUninitialized: false,
  resave: false,

  // Renovamos el plazo de inactividad de la cookie en cada respuesta.
  rolling: true,

  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: env.IS_PROD,
    path: "/",
    maxAge: CONSTANTS.SESSION.INACTIVITY_MS,
  },
});
