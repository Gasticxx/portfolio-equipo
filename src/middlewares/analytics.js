import { env } from '../config/env.js';
import { CONSTANTS } from '../config/constants.js';
import {
    esRutaContableDeVisita,
    esUuidVisitaValido,
    registrarActividadVisita,
} from '../services/metricas.service.js';

export function crearAnalyticsMiddleware(servicioRegistrar = registrarActividadVisita) {
    return async function analyticsMiddleware(req, res, next) {
        const cookieActual = req.signedCookies?.[CONSTANTS.VISITS.COOKIE_NAME];
        if (esUuidVisitaValido(cookieActual)) {
            req.visitaId = cookieActual;
            res.locals.visitaId = cookieActual;
        }

        if (!esRutaContableDeVisita(req.method, req.path)) {
            return next();
        }

        try {
            const { visitaId } = await servicioRegistrar(cookieActual);
            req.visitaId = visitaId;
            res.locals.visitaId = visitaId;

            res.cookie(CONSTANTS.VISITS.COOKIE_NAME, visitaId, {
                signed: true,
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: env.IS_PROD,
                maxAge: CONSTANTS.VISITS.WINDOW_MS,
            });
        } catch {
      // Si la tabla app.visitas aún no fue migrada en desarrollo local,
      // no se interrumpe la navegación pública (degradación controlada).
    }

        return next();
    };
}

export const analyticsMiddleware = crearAnalyticsMiddleware();