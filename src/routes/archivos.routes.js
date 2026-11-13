import { Router } from 'express';
import multer from 'multer';
import { CONSTANTS } from '../config/constants.js';
import { requerirRol } from '../middlewares/auth.js';
import { verificarCsrf } from '../middlewares/csrf.js';
import { limiteSubidaImagenAdmin } from '../middlewares/limits.js';
import { AppError } from '../middlewares/errors.js';
import { subirArchivo, obtenerArchivo, eliminarArchivo } from '../controllers/archivos.controller.js';
import { MAX_IMAGEN_BYTES } from '../services/imagenes.service.js';

export const archivosRouter = Router();
const recibirImagen = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGEN_BYTES, files: 1, fields: 0, parts: 1 },
}).single('imagen');

archivosRouter.use('/api/admin/archivos', (_req, res, next) => {
  res.set('Cache-Control', 'no-store'); next();
}, requerirRol(CONSTANTS.ROLES.ADMINISTRADOR));

archivosRouter.post('/api/admin/archivos', verificarCsrf, limiteSubidaImagenAdmin, (req, res, next) => {
  recibirImagen(req, res, error => {
    if (error) return next(new AppError(
      error.code === 'LIMIT_FILE_SIZE' ? 413 : 422,
      error.code === 'LIMIT_FILE_SIZE' ? 'ARCHIVO_GRANDE' : 'IMAGEN_INVALIDA',
      error.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera los 5 MiB.' : 'Enviá únicamente un archivo en el campo imagen.',
    ));
    next();
  });
}, subirArchivo);
archivosRouter.get('/media/:id', obtenerArchivo);
archivosRouter.delete('/api/admin/archivos/:id', verificarCsrf, eliminarArchivo);
