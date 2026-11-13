import { Router } from 'express';
import { pool } from '../config/db.js';
import { requerirRol } from '../middlewares/auth.js';
import { verificarCsrf } from '../middlewares/csrf.js';
import { AppError } from '../middlewares/errors.js';
import { esErrorDeBaseInaccesible } from '../services/consultas.errores.js';
import { crearDemosAdminRepository } from '../repositories/demos-admin.repository.js';
import { demoSchema, demoQuerySchema, validarDemo, validarDemoId } from '../validators/demos-admin.validator.js';

export { demoSchema } from '../validators/demos-admin.validator.js';
export function crearDemosAdminRouter(db = pool) {
  const router = Router();
  const repo = crearDemosAdminRepository(db);
  router.use(['/admin/demos', '/api/admin/demos'], (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, requerirRol('administrador'));
  router.get('/admin/demos', (_req, res) => res.render('admin/demos', { titulo: 'Demos interactivas', rutaActual: '/admin/demos' }));
  router.get('/api/admin/demos/catalogos', async (_req, res) => res.json({ ok: true, data: await repo.catalogos() }));
  router.get('/api/admin/demos', async (req, res) => res.json({ ok: true, ...await repo.listar(validarDemo(demoQuerySchema, req.query, 400)) }));
  router.get('/api/admin/demos/:id', async (req, res) => {
    const data = await repo.obtener(validarDemoId(req.params.id));
    if (!data) throw new AppError(404, 'NO_ENCONTRADO', 'La demo no existe.');
    res.json({ ok: true, data });
  });
  router.post('/api/admin/demos', verificarCsrf, async (req, res) => res.status(201).json({ ok: true, data: await repo.guardar(null, validarDemo(demoSchema, req.body)) }));
  router.put('/api/admin/demos/:id', verificarCsrf, async (req, res) => {
    const id = validarDemoId(req.params.id);
    res.json({ ok: true, data: await repo.guardar(id, validarDemo(demoSchema, req.body)) });
  });
  router.delete('/api/admin/demos/:id', verificarCsrf, async (req, res) => {
    const result = await db.query('DELETE FROM app.demos WHERE id=$1 RETURNING id', [validarDemoId(req.params.id)]);
    if (!result.rows.length) throw new AppError(404, 'NO_ENCONTRADO', 'La demo ya no existe.');
    res.status(204).end();
  });
  router.use((error, _req, _res, next) => next(esErrorDeBaseInaccesible(error) ? new AppError(503, 'SERVICIO_NO_DISPONIBLE', 'El servicio no está disponible temporalmente.') : error));
  return router;
}
export const demosAdminRouter = crearDemosAdminRouter();
