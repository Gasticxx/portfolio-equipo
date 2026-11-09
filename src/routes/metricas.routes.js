import { Router } from 'express';
import { CONSTANTS } from '../config/constants.js';
import { getMetricasAdmin } from '../controllers/metricas.controller.js';

export const metricasRouter = Router();

export function exigirAdministradorApi(req, res, next) {
    res.setHeader('Cache-Control', 'no-store');
    const usuario = req.user || req.usuario || res.locals?.usuarioActual || null;

    if (!usuario || !usuario.id) {
        return res.status(401).json({
            ok: false,
            error: {
                code: 'NO_AUTENTICADO',
                message: 'Debés iniciar sesión para acceder a este recurso.',
                requestId: req.requestId,
            },
        });
    }

    if (usuario.rol !== CONSTANTS.ROLES.ADMINISTRADOR) {
        return res.status(403).json({
            ok: false,
            error: {
                code: 'SIN_PERMISO',
                message: 'No tenés permisos de administrador para consultar métricas.',
                requestId: req.requestId,
            },
        });
    }

    if (usuario.rol !== CONSTANTS.ROLES.ADMINISTRADOR) {
        return res.status(403).json({
            ok: false,
            error: {
                code: 'SIN_PERMISO',
                message: 'No tenés permisos de administrador para consultar métricas.',
                requestId: req.requestId,
            },
        });
    }

    return next();
}

metricasRouter.get('/api/admin/metricas', exigirAdministradorApi, getMetricasAdmin);