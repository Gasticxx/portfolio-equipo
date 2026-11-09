// Rutas del módulo de consultas, correo y gráficos (I6).
//
// Se monta en src/app.js después de sesión, usuario vigente y analítica, y antes
// del 404. Recibe por parámetro las piezas de I2 e I4 para no duplicarlas:
//   pool (config/db.js), env (config/env.js), requerirRol (middlewares/auth.js),
//   verificarCsrf (middlewares/csrf.js), limiteContactoIp y limiteOperadorUsuario
//   (middlewares/limits.js). Ver docs/consultas.md → "Integración".
import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { crearEmailService } from '../services/email.service.js';
import { crearConsultasService } from '../services/consultas.service.js';
import { crearConsultasController } from '../controllers/consultas.controller.js';
import { ErrorApi, esErrorDeBaseInaccesible } from '../services/consultas.errores.js';

const ROLES_OPERADOR = ['operador', 'administrador']; // CONSTANTS.ROLES de I2

const sinCache = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

/** Las escrituras de este módulo aceptan solo JSON (apartado 11). */
const exigirJson = (req, res, next) => {
  if (!req.is('application/json')) {
    return next(new ErrorApi(415, 'TIPO_NO_ADMITIDO', 'El cuerpo debe enviarse como application/json.'));
  }
  next();
};

const requestIdDe = (req, res) => req.requestId ?? req.id ?? res.locals?.requestId ?? randomUUID();

/**
 * Manejador de errores del módulo. Responde solo los errores propios de I6
 * (ErrorApi, que puede llevar Retry-After) y la base inaccesible (503 del
 * apartado 17). Todo lo demás (AppError de I4, JSON mal formado, 413) sigue al
 * errorHandler común de I2 para mantener un único formato.
 */
export function manejadorErroresApi(logger = console) {
  return (err, req, res, next) => {
    const requestId = requestIdDe(req, res);
    let status;
    let error;

    if (err instanceof ErrorApi) {
      status = err.status;
      error = { code: err.code, message: err.message };
      if (err.fields && Object.keys(err.fields).length) error.fields = err.fields;
      if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
    } else if (esErrorDeBaseInaccesible(err)) {
      status = 503;
      error = {
        code: 'SERVICIO_NO_DISPONIBLE',
        message: 'El servicio no está disponible. No se confirmó ningún guardado; intentá de nuevo en unos minutos.'
      };
      logger.error?.(`[consultas] ${requestId} ${req.method} ${req.baseUrl}${req.path} → 503 base inaccesible (${err?.code ?? err?.name})`);
    } else {
      return next(err);
    }

    if (res.headersSent) return next(err);
    res.status(status).json({ ok: false, error: { ...error, requestId } });
  };
}

/** Versión para páginas HTML: sin sesión redirige a /login?next=<ruta local>. */
function crearAuthPagina(authApi, usuarioDe) {
  return (...roles) => {
    const comprobarRol = authApi(...roles);
    return (req, res, next) => {
      if (!usuarioDe(req)) {
        const destino = req.originalUrl.length <= 200 ? req.originalUrl : req.path;
        return res.redirect(`/login?next=${encodeURIComponent(destino)}`);
      }
      return comprobarRol(req, res, next);
    };
  };
}

/**
 * @param {object} deps
 * @param {import('pg').Pool} deps.pool  Pool único de src/config/db.js
 * @param {object} deps.env  Objeto de src/config/env.js
 * @param {{api:(...roles:string[])=>Function, pagina?:(...roles:string[])=>Function}} deps.auth
 *        api: requerirRol de I4. pagina: opcional; por defecto redirige a /login si no hay sesión.
 * @param {Function} deps.csrf  verificarCsrf de I4
 * @param {{contacto?:Function, operador?:Function}} [deps.limites]  Middlewares de I2
 * @param {(req)=>object|null} [deps.usuarioDe]  Por defecto req.user (cargarUsuarioActual de I4)
 * @param {object} [deps.emailService]  Para pruebas: servicio de correo con un doble de Brevo
 * @param {typeof fetch} [deps.fetch]
 * @param {object} [deps.logger]
 */
export function crearModuloConsultas(deps) {
  const { pool, env, auth, csrf, logger = console } = deps;
  if (!pool) throw new Error('crearModuloConsultas: falta pool.');
  if (typeof auth?.api !== 'function') throw new Error('crearModuloConsultas: falta auth.api (requerirRol de I4).');
  if (typeof csrf !== 'function') throw new Error('crearModuloConsultas: falta el middleware CSRF.');
  const usuarioDe = deps.usuarioDe ?? ((req) => req.user ?? req.usuario ?? null);
  const authPagina = typeof auth.pagina === 'function' ? auth.pagina : crearAuthPagina(auth.api, usuarioDe);

  const pasar = (req, res, next) => next();
  const limites = { contacto: deps.limites?.contacto, operador: deps.limites?.operador };
  for (const [nombre, mw] of Object.entries(limites)) {
    if (typeof mw !== 'function') {
      logger.warn?.(`[consultas] Sin límite "${nombre}" configurado: se omite el rate limit de esa operación.`);
      limites[nombre] = pasar;
    }
  }

  const emailService = deps.emailService ?? crearEmailService({ pool, env, fetch: deps.fetch, logger });
  const servicio = crearConsultasService({
    pool,
    emailService,
    secretoActor: env.SESSION_SECRET,
    contactoDestino: env.CONTACT_TO_EMAIL,
    appOrigin: env.APP_ORIGIN
  });
  const c = crearConsultasController({ servicio, usuarioDe });

  const operadorApi = auth.api(...ROLES_OPERADOR);
  const operadorPagina = authPagina(...ROLES_OPERADOR);

  // ------------------------------------------------------------------ API
  const api = Router();
  api.post('/consultas', limites.contacto, csrf, exigirJson, c.crearConsulta);

  api.use('/operador', sinCache);
  api.get('/operador/consultas', operadorApi, c.listar);
  api.get('/operador/consultas/:id', operadorApi, c.detalle);
  api.patch('/operador/consultas/:id', operadorApi, csrf, exigirJson, c.cambiarEstado);
  api.post('/operador/consultas/:id/respuestas', operadorApi, limites.operador, csrf, exigirJson, c.responder);
  api.post('/operador/envios/:id/reintentar', operadorApi, limites.operador, csrf, exigirJson, c.reintentar);

  api.use(['/consultas', '/operador'], manejadorErroresApi(logger));

  // -------------------------------------------------------------- Páginas
  const paginas = Router();
  paginas.get('/contacto', c.paginaContacto);
  paginas.get('/operador/consultas', operadorPagina, c.paginaListado);
  paginas.get('/operador/consultas/:id', operadorPagina, c.paginaDetalle);
  paginas.get('/admin/metricas', authPagina('administrador'), c.paginaMetricas);

  return { api, paginas, servicio, emailService };
}
