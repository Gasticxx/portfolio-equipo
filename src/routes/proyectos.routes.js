import { Router } from 'express';
import { pool } from '../config/db.js';
import { requerirRol } from '../middlewares/auth.js';
import { verificarCsrf } from '../middlewares/csrf.js';
import { AppError } from '../middlewares/errors.js';
import { proyectosRepository as proyectos } from '../repositories/proyectos.repository.js';
import { proyectoPostSchema, proyectoPutSchema, proyectoQuerySchema, validar } from '../validators/proyectos.validator.js';
import { esErrorDeBaseInaccesible } from '../services/consultas.errores.js';
import { equipoController } from '../controllers/equipo.controller.js';

export const proyectosRouter = Router();
export function idProyecto(value) {
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 2147483647) throw new AppError(400, 'PARAMETRO_INVALIDO', 'Identificador inválido.');
  return Number(value);
}
function parse(schema, value, status) {
  const result = validar(schema, value, status);
  if (result.error) throw new AppError(result.error.status, result.error.status === 400 ? 'PARAMETRO_INVALIDO' : 'VALIDACION', 'Revisá los campos indicados.', result.error.fields);
  return result;
}
proyectosRouter.use(['/admin/proyectos', '/api/admin/proyectos', '/api/admin/tecnologias'], (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, requerirRol('administrador'));
proyectosRouter.get('/admin/proyectos', (_req, res) => res.render('admin/proyectos', { titulo: 'Gestión de proyectos', rutaActual: '/admin/proyectos' }));
proyectosRouter.get('/api/admin/tecnologias', async (_req, res) => res.json({ ok: true, data: (await pool.query('SELECT id,nombre FROM app.tecnologias ORDER BY nombre,id')).rows }));
proyectosRouter.get('/api/equipo', equipoController.apiListarEquipo);
proyectosRouter.get('/api/admin/proyectos/catalogos', async (_req, res) => {
  const [tecnologias, miembros, archivos] = await Promise.all([
    pool.query('SELECT id,nombre FROM app.tecnologias ORDER BY nombre,id'),
    pool.query('SELECT id,nombre,slug FROM app.miembros ORDER BY orden,id'),
    pool.query('SELECT id,ancho,alto,bytes FROM app.archivos ORDER BY created_at DESC,id DESC'),
  ]);
  res.json({ ok: true, data: { tecnologias: tecnologias.rows, miembros: miembros.rows, archivos: archivos.rows } });
});
proyectosRouter.get('/api/admin/proyectos', async (req, res) => res.json({ ok: true, ...await proyectos.listar(parse(proyectoQuerySchema, req.query, 400)) }));
proyectosRouter.get('/api/admin/proyectos/:id', async (req, res) => {
  const data = await proyectos.obtener(idProyecto(req.params.id));
  if (!data) throw new AppError(404, 'NO_ENCONTRADO', 'El proyecto no existe.');
  res.json({ ok: true, data });
});
proyectosRouter.post('/api/admin/proyectos', verificarCsrf, async (req, res) => res.status(201).json({ ok: true, data: await proyectos.guardar(null, parse(proyectoPostSchema, req.body)) }));
proyectosRouter.put('/api/admin/proyectos/:id', verificarCsrf, async (req, res) => res.json({ ok: true, data: await proyectos.guardar(idProyecto(req.params.id), parse(proyectoPutSchema, req.body)) }));
proyectosRouter.delete('/api/admin/proyectos/:id', verificarCsrf, async (req, res) => { await proyectos.eliminar(idProyecto(req.params.id)); res.status(204).end(); });

proyectosRouter.get('/proyectos', async (_req, res) => {
  const proyectosPublicados = await proyectos.listarPublicos();
  res.render('proyectos/index', { titulo: 'Proyectos', rutaActual: '/proyectos', proyectos: proyectosPublicados, disponible: true });
});
// La dirección anterior conserva una vista pública breve del portfolio original.
// El detalle completo sigue protegido en /proyectos/:slug.
proyectosRouter.get('/detalle', async (_req, res) => {
  const original = (await proyectos.listarPublicos()).find(p => p.slug === 'portfolio-equipo');
  if (!original) throw new AppError(404, 'NO_ENCONTRADO', 'El proyecto del equipo no está publicado.');
  res.render('proyectos/resumen', { titulo: original.titulo, rutaActual: '/proyectos', proyectos: [original], disponible: true });
});
proyectosRouter.get('/proyectos/:slug', async (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  if (!req.user) return res.redirect(`/login?next=${encodeURIComponent(req.originalUrl)}`);
  return requerirRol('registrado', 'operador', 'administrador')(req, res, next);
}, async (req, res) => {
  const { rows } = await pool.query('SELECT id FROM app.proyectos WHERE slug=$1 AND publicado=true', [req.params.slug]);
  if (!rows[0]) throw new AppError(404, 'NO_ENCONTRADO', 'El proyecto no existe o no está publicado.');
  const proyecto = await proyectos.obtener(rows[0].id);
  const [tecnologias, miembros, demos] = await Promise.all([
    pool.query('SELECT id,nombre FROM app.tecnologias ORDER BY nombre'),
    pool.query('SELECT id,nombre,slug,orden FROM app.miembros ORDER BY orden'),
    pool.query('SELECT id,titulo,descripcion,tipo FROM app.demos WHERE proyecto_id=$1 AND publicada = true ORDER BY orden,id', [proyecto.id]),
  ]);
  res.render('proyectos/detalle', { titulo: proyecto.titulo, rutaActual: '/proyectos', proyecto, tecnologias: tecnologias.rows, miembros: miembros.rows, demos: demos.rows });
});
proyectosRouter.use((error, req, res, next) => {
  if (!esErrorDeBaseInaccesible(error)) return next(error);
  if (req.path === '/proyectos') return res.render('proyectos/index', { titulo: 'Proyectos', rutaActual: '/proyectos', proyectos: [], disponible: false });
  if (req.path === '/detalle') return res.render('proyectos/resumen', { titulo: 'Proyecto del equipo', rutaActual: '/proyectos', proyectos: [], disponible: false });
  return next(new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio no está disponible temporalmente.'));
});
