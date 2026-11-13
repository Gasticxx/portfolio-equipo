import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db.js';
import { requerirRol } from '../middlewares/auth.js';
import { verificarCsrf } from '../middlewares/csrf.js';
import { AppError } from '../middlewares/errors.js';

const id = z.number().int().positive().max(2147483647);
export const demoSchema = z.object({
  proyecto_id: id,
  titulo: z.string().trim().min(3).max(100),
  descripcion: z.string().trim().min(3).max(1000),
  tipo: z.enum(['algoritmos', 'tablero', 'calendario']),
  publicada: z.boolean(),
  orden: z.number().int().min(1).max(100),
}).strict();

export function crearDemosAdminRouter(db = pool) {
  const router = Router();
  const admin = requerirRol('administrador');
  router.get('/admin/demos', admin, (_req, res) => res.render('admin/demos', { titulo: 'Demos', rutaActual: '/admin/demos' }));
  router.use('/api/admin/demos', admin, (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get('/api/admin/demos', async (_req, res) => {
    const [demos, proyectos] = await Promise.all([
      db.query('SELECT d.*, p.titulo AS proyecto_titulo, p.publicado AS proyecto_publicado FROM app.demos d JOIN app.proyectos p ON p.id=d.proyecto_id ORDER BY d.proyecto_id,d.orden,d.id'),
      db.query('SELECT id,titulo,publicado FROM app.proyectos ORDER BY titulo'),
    ]);
    res.json({ ok: true, data: { demos: demos.rows, proyectos: proyectos.rows } });
  });
  router.use('/api/admin/demos', verificarCsrf);
  const guardar = editar => async (req, res, next) => {
    const parsed = demoSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(422, 'VALIDACION', 'Revisá los campos: título, descripción, proyecto, tipo y orden.');
    const demoId = editar ? Number(req.params.id) : null;
    if (editar && (!/^[1-9]\d*$/.test(req.params.id) || !id.safeParse(demoId).success)) throw new AppError(400, 'PARAMETRO_INVALIDO', 'Identificador inválido.');
    const d = parsed.data;
    try {
      const valores = [d.proyecto_id, d.titulo, d.descripcion, d.tipo, d.publicada, d.orden];
      // Proyecto y tipo quedan fijos al editar para preservar las tareas del tablero.
      const resultado = editar
        ? await db.query('UPDATE app.demos SET titulo=$2,descripcion=$3,publicada=$5,orden=$6,updated_at=now() WHERE id=$7 AND proyecto_id=$1 AND tipo=$4 RETURNING id', [...valores, demoId])
        : await db.query('INSERT INTO app.demos(proyecto_id,titulo,descripcion,tipo,publicada,orden) VALUES($1,$2,$3,$4,$5,$6) RETURNING id', valores);
      if (!resultado.rows.length) throw new AppError(409, 'CONFLICTO', 'La demo cambió o ya no existe. Recargá el listado.');
      res.status(editar ? 200 : 201).json({ ok: true, data: resultado.rows[0] });
    } catch (error) {
      if (error.code === '23505') return next(new AppError(409, 'DEMO_DUPLICADA', 'Ya existe una demo de ese tipo en el proyecto. Editá la existente.'));
      if (error.code === '23503') return next(new AppError(422, 'PROYECTO_INVALIDO', 'Seleccioná un proyecto existente.'));
      if (error.code === '23514' && d.tipo === 'calendario') return next(new AppError(503, 'MIGRACION_PENDIENTE', 'Falta aplicar la migración 004_calendario.sql en la base de datos. Pedile al responsable de datos que la ejecute.'));
      next(error);
    }
  };
  router.post('/api/admin/demos', guardar(false));
  router.put('/api/admin/demos/:id', guardar(true));
  // Se retira despublicando: no se eliminan tareas guardadas de los usuarios.
  return router;
}

export const demosAdminRouter = crearDemosAdminRouter();
