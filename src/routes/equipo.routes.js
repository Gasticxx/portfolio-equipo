import { Router } from 'express';
import { equipoController } from '../controllers/equipo.controller.js';

export const equipoRouter = Router();

// Rutas de vistas HTML públicas (Apartado 7)
equipoRouter.get('/', equipoController.vistaInicio);
equipoRouter.get('/equipo', equipoController.vistaEquipo);
equipoRouter.get('/equipo/:slug', equipoController.vistaPerfil);

// Rutas de API JSON públicas (Apartado 11.1)
equipoRouter.get('/api/equipo', equipoController.apiListarEquipo);
equipoRouter.get('/api/equipo/:slug', equipoController.apiObtenerMiembro);