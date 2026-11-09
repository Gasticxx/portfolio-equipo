import { env } from '../config/env.js';
import { CONSTANTS } from '../config/constants.js';
import {
    esRutaContableDeVisita,
    esUuidVisitaValido,
    registrarActividadVisita,
    registrarAccesoUsuario,
    garantizarVisitaYAccesoEnLogin,
} from '../services/metricas.service.js';

function obtenerUsuarioAutenticadoId(req, res) {
    const candidato =
        req.user?.id ??
        req.usuario?.id ??
        res.locals?.usuarioActual?.id ??
        req.session?.usuarioId ??
        null;
    const id = Number(candidato);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function fijarCookieVisita(res, visitaId) {
    res.cookie(CONSTANTS.VISITS.COOKIE_NAME, visitaId, {
        signed: true,
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: env.IS_PROD,
        maxAge: CONSTANTS.VISITS.WINDOW_MS,
    });
}

export function crearAnalyticsMiddleware(
    deps = {
        servicioVisitas: registrarActividadVisita,
        servicioAccesos: registrarAccesoUsuario,
    }
) {
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
            const { visitaId } = await deps.servicioVisitas(cookieActual);
            req.visitaId = visitaId;
            res.locals.visitaId = visitaId;
            fijarCookieVisita(res, visitaId);

            const usuarioId = obtenerUsuarioAutenticadoId(req, res);
            if (usuarioId) {
                await deps.servicioAccesos(visitaId, usuarioId);
            }
        } catch {
      // Degradación controlada si la base local aún no tiene las tablas migradas
        }

        return next();
    };
}

export async function registrarAccesoTrasLogin(req, res, usuarioId) {
    const cookieActual =
        req.visitaId || req.signedCookies?.[CONSTANTS.VISITS.COOKIE_NAME];
    try {
        const { visitaId } = await garantizarVisitaYAccesoEnLogin(
            cookieActual,
            usuarioId
        );
        req.visitaId = visitaId;
        res.locals.visitaId = visitaId;
        fijarCookieVisita(res, visitaId);
        return visitaId;
    } catch {
        return null;
    }
}

export const analyticsMiddleware = crearAnalyticsMiddleware();