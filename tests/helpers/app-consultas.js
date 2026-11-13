// App mínima para probar el módulo de I6 con supertest sobre portfolio_test.
// Sustituye con dobles controlados lo que no es de I6: permisos y CSRF (I4) y
// Brevo (proveedor externo). La base es real: TEST_DATABASE_URL, migrada por I5.
import express from 'express';
import session from 'express-session';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { crearModuloConsultas } from '../../src/routes/consultas.routes.js';
import { crearEmailService } from '../../src/services/email.service.js';

export const ENV_PRUEBA = {
  BREVO_API_KEY: 'xkeysib-prueba',
  MAIL_FROM_EMAIL: 'equipo@equipo.test',
  MAIL_FROM_NAME: 'Reflection Tech',
  CONTACT_TO_EMAIL: 'casilla@equipo.test',
  SESSION_SECRET: 'secreto-de-prueba-para-hmac',
  APP_ORIGIN: 'http://localhost:3000'
};

export const nuevaClave = () => randomUUID();

/** Doble de Brevo: registra llamadas y responde según `modo`. */
export function crearBrevoFalso() {
  const doble = {
    modo: 'ok',
    llamadas: [],
    demoraMs: 0,
    async fetch(url, init) {
      doble.llamadas.push({ url, headers: init.headers, body: JSON.parse(init.body) });
      if (doble.demoraMs) await new Promise((r) => setTimeout(r, doble.demoraMs));
      const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
      switch (doble.modo) {
        case 'ok':
          return json(201, { messageId: `<${randomUUID()}@smtp-relay.mailin.fr>` });
        case 'error':
          return json(400, { code: 'invalid_parameter', message: 'sender not valid' });
        case 'red':
          throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNRESET' } });
        default:
          return new Promise((_, no) => {
            const vivo = setTimeout(() => {}, 5000);
            init.signal.addEventListener('abort', () => {
              clearTimeout(vivo);
              no(init.signal.reason);
            });
          });
      }
    }
  };
  return doble;
}

export function crearPool() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) return null;
  return new pg.Pool({ connectionString: url, max: 5 });
}

/**
 * @param {object} o
 * @param {import('pg').Pool|object} o.pool
 * @param {ReturnType<typeof crearBrevoFalso>} o.brevo
 * @param {number} [o.timeoutMs]  Timeout de Brevo (corto para probar "desconocido")
 */
export function crearApp({ pool, brevo, timeoutMs = 10000 }) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use(session({ secret: 'prueba', resave: false, saveUninitialized: true }));

  // Doble de I4: el usuario llega por cabecera de prueba y se relee de la base.
  app.use(async (req, res, next) => {
    const id = Number(req.get('x-prueba-usuario'));
    req.usuario = null;
    if (id) {
      const { rows } = await pool.query('SELECT id, nombre, rol FROM app.usuarios WHERE id = $1 AND activo', [id]);
      req.usuario = rows[0] ?? null;
    }
    next();
  });
  const err = (res, status, code) => res.status(status).json({ ok: false, error: { code, message: code, requestId: 'x' } });
  const auth = {
    api: (...roles) => (req, res, next) =>
      !req.usuario ? err(res, 401, 'NO_AUTENTICADO') : roles.includes(req.usuario.rol) ? next() : err(res, 403, 'SIN_PERMISO'),
    pagina: (...roles) => (req, res, next) => (req.usuario && roles.includes(req.usuario.rol) ? next() : res.status(403).end())
  };
  const csrf = (req, res, next) => (req.get('x-csrf-token') === 'ok' ? next() : err(res, 403, 'CSRF_INVALIDO'));
  const logger = { info() {}, warn() {}, error() {} };

  const emailService = crearEmailService({ pool, env: ENV_PRUEBA, fetch: brevo.fetch, logger, timeoutMs });
  const modulo = crearModuloConsultas({ pool, env: ENV_PRUEBA, auth, csrf, emailService, logger });
  app.use('/api', modulo.api);
  return app;
}

// ------------------------------------------------------------ Datos base
export async function prepararBase(pool) {
  await pool.query('TRUNCATE app.envios_email, app.respuestas, app.consultas RESTART IDENTITY CASCADE');
  const usuarios = {};
  for (const [rol, email] of [
    ['operador', 'i6-operador@prueba.test'],
    ['administrador', 'i6-admin@prueba.test'],
    ['registrado', 'i6-registrado@prueba.test'],
    ['operador', 'i6-operador2@prueba.test']
  ]) {
    const { rows } = await pool.query(
      `INSERT INTO app.usuarios (nombre, email, password_hash, rol)
       VALUES ($1, $2, 'scrypt$prueba', $3)
       ON CONFLICT (lower(email)) DO UPDATE SET rol = EXCLUDED.rol, activo = true
       RETURNING id`,
      [`Prueba ${rol}`, email, rol]
    );
    usuarios[email.split('@')[0].replace('i6-', '')] = rows[0].id;
  }
  const servicios = {};
  for (const [clave, nombre, activo] of [['activo', 'Servicio de prueba I6', true], ['inactivo', 'Servicio inactivo I6', false]]) {
    const existente = await pool.query('SELECT id FROM app.servicios WHERE nombre = $1', [nombre]);
    const id =
      existente.rows[0]?.id ??
      (await pool.query(
        `INSERT INTO app.servicios (nombre, descripcion, categoria, activo, orden)
         VALUES ($1, 'Servicio creado por las pruebas de I6.', 'web', $2, 99) RETURNING id`,
        [nombre, activo]
      )).rows[0].id;
    await pool.query('UPDATE app.servicios SET activo = $2 WHERE id = $1', [id, activo]);
    servicios[clave] = id;
  }
  return { usuarios, servicios };
}
