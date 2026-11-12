import { Router } from 'express';
import { serviciosController } from '../controllers/servicios.controller.js';
import { requerirRolView, requerirRolApi } from '../middlewares/auth.js';
import { verificarCsrf } from '../middlewares/csrf.js';

export const serviciosRouter = Router();

// Vista y API públicas (Apartado 7 y 11.1)
serviciosRouter.get('/servicios', serviciosController.vistaServicios);
serviciosRouter.get('/api/servicios', serviciosController.apiListarPublicos);

// Vista administrativa protegida por rol administrador (Apartado 7 y 9)
serviciosRouter.get('/admin/servicios', requerirRolView, serviciosController.vistaAdminServicios);

// API administrativa CRUD protegida por rol administrador y CSRF en escrituras (Apartado 13)
serviciosRouter.get('/api/admin/servicios', requerirRolApi, serviciosController.apiListarAdmin);
serviciosRouter.get('/api/admin/servicios/:id', requerirRolApi, serviciosController.apiObtenerPorId);
serviciosRouter.post('/api/admin/servicios', requerirRolApi, verificarCsrf, serviciosController.apiCrear);
serviciosRouter.put('/api/admin/servicios/:id', requerirRolApi, verificarCsrf, serviciosController.apiActualizar);
serviciosRouter.delete('/api/admin/servicios/:id', requerirRolApi, verificarCsrf, serviciosController.apiEliminar);