import crypto from 'node:crypto';
import * as metricasRepo from '../repositories/metricas.repository.js';

const UUID_CANONICO_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const PATRONES_RUTAS_CONTABLES = [
    /^\/$/,
    /^\/equipo$/,
    /^\/equipo\/[a-z0-9-]+$/,
    /^\/servicios$/,
    /^\/proyectos$/,
    /^\/proyectos\/[a-z0-9-]+$/,
    /^\/demos\/[1-9][0-9]*$/,
    /^\/contacto$/,
];

export function esUuidVisitaValido(valor) {
    return typeof valor === 'string' && UUID_CANONICO_REGEX.test(valor);
}

export function esRutaContableDeVisita(method, rawPath) {
    if (method !== 'GET') {
        return false;
    }
    const cleanPath = (rawPath || '/').split('?')[0];
    const normalizada =
    cleanPath.length > 1 ? cleanPath.replace(/\/+$/, '') : cleanPath;

    return PATRONES_RUTAS_CONTABLES.some((regex) => regex.test(normalizada));
}

export async function registrarActividadVisita(
    cookieVisitaId,
    deps = metricasRepo
) {
    if (esUuidVisitaValido(cookieVisitaId)) {
        const vigente = await deps.touchVisitaVigente(cookieVisitaId);
        if (vigente) {
            return { visitaId: vigente.id, esNueva: false };
        }
    }

    const nuevoId = crypto.randomUUID();
    await deps.insertNuevaVisita(nuevoId, false);
    return { visitaId: nuevoId, esNueva: true };
}