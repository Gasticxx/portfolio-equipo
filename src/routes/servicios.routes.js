import { Router } from 'express';
import { serviciosController } from '../controllers/servicios.controller.js';
import { requerirRol } from '../middlewares/auth.js';
import { verificarCsrf } from '../middlewares/csrf.js';

export const serviciosRouter = Router();

const soloAdmin = requerirRol('administrador');

// Vista y API públicas (Apartado 7 y 11.1)
serviciosRouter.get('/servicios', serviciosController.vistaServicios);
serviciosRouter.get('/api/servicios', serviciosController.apiListarPublicos);

// Vista administrativa protegida por rol administrador (Apartado 7 y 9)
serviciosRouter.get('/admin/servicios', soloAdmin, serviciosController.vistaAdminServicios);

// API administrativa CRUD protegida por rol administrador y CSRF en escrituras (Apartado 13)
serviciosRouter.get('/api/admin/servicios', soloAdmin, serviciosController.apiListarAdmin);
serviciosRouter.get('/api/admin/servicios/:id', soloAdmin, serviciosController.apiObtenerPorId);
serviciosRouter.post('/api/admin/servicios', soloAdmin, verificarCsrf, serviciosController.apiCrear);
serviciosRouter.put('/api/admin/servicios/:id', soloAdmin, verificarCsrf, serviciosController.apiActualizar);
serviciosRouter.delete('/api/admin/servicios/:id', soloAdmin, verificarCsrf, serviciosController.apiEliminar);