import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { pool } from '../config/db.js';
import { requerirRol } from '../middlewares/auth.js';
import { AppError } from '../middlewares/errors.js';
import { esErrorDeBaseInaccesible } from '../services/consultas.errores.js';

export const demosRouter = Router();
const comprobarRol = requerirRol('registrado', 'operador', 'administrador');
function autorizar(req, res, next) {
  res.set('Cache-Control', 'no-store');
  if (!req.user) {
    // Los recursos nunca redirigen a un HTML que el navegador interpretaría como JS.
    if (req.path.endsWith('/recurso.js')) return next(new AppError(401, 'NO_AUTENTICADO', 'Iniciá sesión para continuar.'));
    return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  }
  return comprobarRol(req, res, next);
}

// El catálogo no depende de que exista un proyecto con un slug predeterminado.
demosRouter.get('/demos', autorizar, async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT d.id, d.titulo, d.descripcion, d.tipo, p.titulo AS proyecto_titulo
    FROM app.demos d JOIN app.proyectos p ON p.id = d.proyecto_id
    WHERE d.publicada = true AND p.publicado = true
    ORDER BY p.titulo, d.orden, d.id`);
  res.render('demos/index', { titulo: 'Demos interactivas', rutaActual: '/demos', demos: rows, disponible: true });
});

async function cargarDemo(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) return next('route');
  const { rows } = await pool.query(
    `SELECT d.id, d.titulo, d.descripcion, d.tipo, p.slug AS proyecto_slug
     FROM app.demos d JOIN app.proyectos p ON p.id = d.proyecto_id
     WHERE d.id = $1 AND d.publicada = true AND p.publicado = true`,
    [req.params.id],
  );
  if (!rows[0]) return next('route');
  res.locals.demo = rows[0];
  return next();
}

demosRouter.get('/demos/:id', autorizar, cargarDemo, (req, res) => {
  res.render('i3/demo', {
    titulo: res.locals.demo.titulo, descripcionDemo: res.locals.demo.descripcion, vista: res.locals.demo.tipo, demoId: res.locals.demo.id, rutaActual: '/proyectos',
    recursoJs: `/demos/${res.locals.demo.id}/recurso.js`,
    regresoProyecto: `/proyectos/${res.locals.demo.proyecto_slug}`,
  });
});

demosRouter.get('/demos/:id/recurso.js', autorizar, cargarDemo, async (_req, res) => {
  if (res.locals.demo.tipo === 'ondas') {
    const [motor, interfaz] = await Promise.all([
      readFile(new URL('../ui-i3/demos/ondas-motor.js', import.meta.url), 'utf8'),
      readFile(new URL('../ui-i3/demos/ondas.js', import.meta.url), 'utf8'),
    ]);
    return res.type('application/javascript').send(`${motor}\n${interfaz}`);
  }
  if (res.locals.demo.tipo === 'calendario') {
    const [motor, interfaz] = await Promise.all([
      readFile(new URL('../ui-i3/demos/calendario-motor.js', import.meta.url), 'utf8'),
      readFile(new URL('../ui-i3/demos/calendario.js', import.meta.url), 'utf8'),
    ]);
    return res.type('application/javascript').send(`${motor}\n${interfaz}`);
  }
  if (res.locals.demo.tipo === 'tablero') {
    const interfaz = await readFile(new URL('../ui-i3/demos/tablero-integrado.js', import.meta.url), 'utf8');
    return res.type('application/javascript').send(interfaz);
  }
  const [motor, interfaz] = await Promise.all([
    readFile(new URL('../ui-i3/demos/algoritmos-motor.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui-i3/demos/algoritmos.js', import.meta.url), 'utf8'),
  ]);
  res.type('application/javascript').send(`${motor}\nwindow.algoritmosAdapter = { generar: generarPasos };\n${interfaz}`);
});

demosRouter.use((err, req, res, next) => {
  if (!esErrorDeBaseInaccesible(err)) return next(err);
  if (req.method === 'GET' && !req.path.endsWith('/recurso.js')) {
    res.set('Retry-After', '30');
    return res.status(503).render('demos/index', {
      titulo: 'Demos interactivas', rutaActual: '/demos', demos: [], disponible: false,
    });
  }
  const error = new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio no está disponible temporalmente.');
  error.retryAfter = 30;
  return next(error);
});
