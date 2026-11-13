
import { Router } from 'express';
import multer from 'multer';
import { CONSTANTS } from '../config/constants.js';
import { requerirRol } from '../middlewares/auth.js';
import { verificarCsrf } from '../middlewares/csrf.js';
import { AppError } from '../middlewares/errors.js';
import {subirArchivo, obtenerArchivo, eliminarArchivo} from '../controllers/archivos.controller.js';
export const archivosRouter = Router();

 // Configuración para recibir una imagen en memoria.
const recibirImagen = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  }
}).single('imagen');

// Subir una imagen (solo administradores).
archivosRouter.post(
  '/api/admin/archivos',
  requerirRol(CONSTANTS.ROLES.ADMINISTRADOR),
  verificarCsrf,

  // Recibir la imagen utilizando multer.
  (req, res, next) => {
    recibirImagen(req, res, (error) => {
      if (error) {
        return next(
          new AppError(
            422,
            'IMAGEN_INVALIDA',
            'No se pudo recibir la imagen. Comprobá su tamaño y formato.'
          )
        );
      }

      return next();
    });
  },

  // Procesar y guardar la imagen.
  subirArchivo
);

// Recuperar una imagen almacenada.
archivosRouter.get(
  '/media/:id',
  obtenerArchivo
);

// Eliminar una imagen (solo administradores).
archivosRouter.delete(
  '/api/admin/archivos/:id',
  requerirRol(CONSTANTS.ROLES.ADMINISTRADOR),
  verificarCsrf,
  eliminarArchivo
);
