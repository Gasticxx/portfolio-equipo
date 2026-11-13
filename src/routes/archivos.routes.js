import { Router } from 'express';
import multer from 'multer';
import { requerirRol } from '../middlewares/auth.js';
import { verificarCsrf } from '../middlewares/csrf.js';
import { limiteSubidaImagenAdmin } from '../middlewares/limits.js';
import { AppError } from '../middlewares/errors.js';
import { archivosService, MAX_IMAGEN_BYTES } from '../services/archivos.service.js';
import { idProyecto } from './proyectos.routes.js';

export const archivosRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_IMAGEN_BYTES, files: 1, fields: 0, parts: 1 } }).single('imagen');
archivosRouter.use('/api/admin/archivos', requerirRol('administrador'), (_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
archivosRouter.post('/api/admin/archivos', verificarCsrf, limiteSubidaImagenAdmin, (req, res, next) => upload(req, res, error => {
  if (error) return next(new AppError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 422, error.code === 'LIMIT_FILE_SIZE' ? 'ARCHIVO_GRANDE' : 'IMAGEN_INVALIDA', error.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera los 5 MiB.' : 'Enviá únicamente un archivo en el campo imagen.'));
  next();
}), async (req, res) => {
  const data = await archivosService.crear(req.file?.buffer, req.user.id);
  res.status(201).json({ ok: true, data });
});
archivosRouter.delete('/api/admin/archivos/:id', verificarCsrf, async (req, res) => { await archivosService.eliminar(idProyecto(req.params.id)); res.status(204).end(); });
archivosRouter.get('/media/:id', async (req, res) => {
  const data = await archivosService.descargar(idProyecto(req.params.id), req.user?.rol === 'administrador');
  res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }).type('image/webp').send(data);
});
