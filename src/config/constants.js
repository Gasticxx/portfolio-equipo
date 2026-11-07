// Capacidad compartida por la generación y la verificación de hashes.
export const MAX_CALCULOS_SIMULTANEOS = 2;
export const MAX_CALCULOS_EN_ESPERA = 8;

// Tiempo que indicará el servidor cuando la cola esté llena.
export const REINTENTO_HASH_SEGUNDOS = 2;

export const CONSTANTS = Object.freeze({
  JSON_BODY_LIMIT: "32kb",
  REQUEST_TIMEOUT_MS: 30_000,

  DB: Object.freeze({
    MAX_POOL: 5,
    IDLE_TIMEOUT_MS: 30_000,
    CONNECTION_TIMEOUT_MS: 10_000,
    STATEMENT_TIMEOUT_MS: 10_000,
    LOCK_TIMEOUT_MS: 3_000,
  }),

  SESSION: Object.freeze({
    COOKIE_NAME: "equipo.sid",
    INACTIVITY_MS: 30 * 60 * 1000,
    ABSOLUTE_MAX_MS: 8 * 60 * 60 * 1000,
    PRUNE_INTERVAL_SECONDS: 15 * 60,
  }),

  VISITS: Object.freeze({
    COOKIE_NAME: "equipo.visita",
    WINDOW_MS: 30 * 60 * 1000,
  }),

  PAGINATION: Object.freeze({
    DEFAULT_PAGE: 1,
    MAX_PAGE: 100_000,
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 50,
  }),

  ROLES: Object.freeze({
    REGISTRADO: "registrado",
    OPERADOR: "operador",
    ADMINISTRADOR: "administrador",
  }),
});
