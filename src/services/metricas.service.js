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

export async function registrarAccesoUsuario(
    visitaId,
    usuarioId,
    deps = metricasRepo
) {
    const idNumerico = Number(usuarioId);
    if (!esUuidVisitaValido(visitaId) || !Number.isInteger(idNumerico) || idNumerico <= 0) {
        return { registrado: false, acceso: null };
    }

    const nuevoAcceso = await deps.insertAccesoAutenticado(visitaId, idNumerico);
    return {
        registrado: Boolean(nuevoAcceso),
        acceso: nuevoAcceso,
    };
}

export async function garantizarVisitaYAccesoEnLogin(
    cookieVisitaId,
    usuarioId,
    deps = metricasRepo
) {
    const { visitaId, esNueva } = await registrarActividadVisita(cookieVisitaId, deps);
    const { registrado, acceso } = await registrarAccesoUsuario(visitaId, usuarioId, deps);
    return { visitaId, esNuevaVisita: esNueva, accesoRegistrado: registrado, acceso };
}

export async function obtenerMetricasPanel(
    filtrosValidados,
    deps = metricasRepo
) {
    const {
        desde,
        hasta,
        tipo,
        zonaHoraria,
        inicioUtc,
        finExclusivoUtc,
        fechasRango,
    } = filtrosValidados;

    const raw = await deps.obtenerAgregacionesMetricas({
        inicioUtc,
        finExclusivoUtc,
        tipo,
    });

    const mapaVisitas = new Map();
    let incluyeDatosDePrueba = false;
    let totalVisitas = 0;

    for (const fila of raw.visitasPorDia) {
        const cant = Number(fila.cantidad) || 0;
        mapaVisitas.set(fila.fecha, cant);
        totalVisitas += cant;
        if (fila.hayPrueba) {
            incluyeDatosDePrueba = true;
        }
    }

    const mapaAccesos = new Map();
    let totalAccesos = 0;
    for (const fila of raw.accesosPorDia) {
        const cant = Number(fila.cantidad) || 0;
        mapaAccesos.set(fila.fecha, cant);
        totalAccesos += cant;
    }

    const mapaRegistros = new Map();
    let totalCuentas = 0;
    for (const fila of raw.registrosPorDia) {
        const cant = Number(fila.cantidad) || 0;
        mapaRegistros.set(fila.fecha, cant);
        totalCuentas += cant;
    }

    const traficoDiario = fechasRango.map((fecha) => ({
        fecha,
        visitas: mapaVisitas.get(fecha) ?? 0,
        accesos: mapaAccesos.get(fecha) ?? 0,
    }));

    const registrosDiarios = fechasRango.map((fecha) => ({
        fecha,
        cuentas: mapaRegistros.get(fecha) ?? 0,
    }));

    const conteoTipos = {
        general: 0,
        cotizacion: 0,
        asesoria: 0,
    };

    for (const fila of raw.consultasPorTipo) {
        if (
            Object.prototype.hasOwnProperty.call(conteoTipos, fila.tipo) &&
            (!tipo || fila.tipo === tipo)
        ) {
            conteoTipos[fila.tipo] = Number(fila.cantidad) || 0;
        }
    }

    const consultasPorTipo = [
        { tipo: 'general', cantidad: conteoTipos.general },
        { tipo: 'cotizacion', cantidad: conteoTipos.cotizacion },
        { tipo: 'asesoria', cantidad: conteoTipos.asesoria },
    ];

    const totalConsultas =
        conteoTipos.general + conteoTipos.cotizacion + conteoTipos.asesoria;

    return {
        filtros: {
            desde,
            hasta,
            tipo,
            zonaHoraria,
        },
        totales: {
            visitas: totalVisitas,
            accesosAutenticados: totalAccesos,
            cuentasCreadas: totalCuentas,
            consultas: totalConsultas,
        },
        traficoDiario,
        registrosDiarios,
        consultasPorTipo,
        incluyeDatosDePrueba,
    };
}