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

demosRouter.get('/proyectos/:slug', autorizar, async (req, res, next) => {
  const { rows } = await pool.query(
    'SELECT id, titulo, descripcion FROM app.proyectos WHERE slug = $1 AND publicado = true',
    [req.params.slug],
  );
  const proyecto = rows[0];
  if (!proyecto) return next();
  const resultado = await pool.query(
    "SELECT id, titulo, descripcion FROM app.demos WHERE proyecto_id = $1 AND publicada = true AND tipo = 'algoritmos' ORDER BY orden, id",
    [proyecto.id],
  );
  res.render('proyectos/detalle', { titulo: proyecto.titulo, rutaActual: '/proyectos', proyecto, demos: resultado.rows });
});

async function cargarDemo(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) return next('route');
  const { rows } = await pool.query(
    `SELECT d.id, d.titulo, d.descripcion, p.slug AS proyecto_slug
     FROM app.demos d JOIN app.proyectos p ON p.id = d.proyecto_id
     WHERE d.id = $1 AND d.publicada = true AND p.publicado = true AND d.tipo = 'algoritmos'`,
    [req.params.id],
  );
  if (!rows[0]) return next('route');
  res.locals.demo = rows[0];
  return next();
}

demosRouter.get('/demos/:id', autorizar, cargarDemo, (req, res) => {
  res.render('i3/demo', {
    titulo: res.locals.demo.titulo, vista: 'algoritmos', rutaActual: '/proyectos',
    recursoJs: `/demos/${res.locals.demo.id}/recurso.js`,
    regresoProyecto: `/proyectos/${res.locals.demo.proyecto_slug}`,
  });
});

demosRouter.get('/demos/:id/recurso.js', autorizar, cargarDemo, async (_req, res) => {
  const [motor, interfaz] = await Promise.all([
    readFile(new URL('../ui-i3/demos/algoritmos-motor.js', import.meta.url), 'utf8'),
    readFile(new URL('../ui-i3/demos/algoritmos.js', import.meta.url), 'utf8'),
  ]);
  res.type('application/javascript').send(`${motor}\nwindow.algoritmosAdapter = { generar: generarPasos };\n${interfaz}`);
});

demosRouter.use((err, _req, _res, next) => {
  if (!esErrorDeBaseInaccesible(err)) return next(err);
  const error = new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio no está disponible temporalmente.');
  error.retryAfter = 30;
  return next(error);
});
