import { AppError } from '../middlewares/errors.js';

export const ZONA_HORARIA_ARGENTINA = 'America/Argentina/Buenos_Aires';
const TIPOS_CONSULTA_VALIDOS = new Set(['general', 'cotizacion', 'asesoria']);
const PARAMETROS_PERMITIDOS = new Set(['desde', 'hasta', 'tipo']);
const FECHA_ISO_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

export function obtenerFechaHoyArgentina(ahora = new Date()) {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONA_HORARIA_ARGENTINA,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(ahora);

    const y = partes.find((p) => p.type === 'year').value;
    const m = partes.find((p) => p.type === 'month').value;
    const d = partes.find((p) => p.type === 'day').value;
    return `${y}-${m}-${d}`;
}

export function esFechaCalendarioReal(fechaStr) {
    if (typeof fechaStr !== 'string') return false;
    const match = FECHA_ISO_REGEX.exec(fechaStr);
    if (!match) return false;

    const anio = Number(match[1]);
    const mes = Number(match[2]);
    const dia = Number(match[3]);

    const dt = new Date(Date.UTC(anio, mes - 1, dia));
    return (
        dt.getUTCFullYear() === anio &&
        dt.getUTCMonth() === mes - 1 &&
        dt.getUTCDate() === dia
    );
}

export function sumarDiasCalendario(fechaStr, dias) {
    const [anio, mes, dia] = fechaStr.split('-').map(Number);
    const dt = new Date(Date.UTC(anio, mes - 1, dia + dias));
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function diferenciaDiasInclusiva(desdeStr, hastaStr) {
    const [y1, m1, d1] = desdeStr.split('-').map(Number);
    const [y2, m2, d2] = hastaStr.split('-').map(Number);
    const ms1 = Date.UTC(y1, m1 - 1, d1);
    const ms2 = Date.UTC(y2, m2 - 1, d2);
    return Math.round((ms2 - ms1) / (24 * 60 * 60 * 1000)) + 1;
}

export function generarListaFechasRango(desdeStr, hastaStr) {
    const totalDias = diferenciaDiasInclusiva(desdeStr, hastaStr);
    const fechas = [];
    for (let i = 0; i < totalDias; i += 1) {
        fechas.push(sumarDiasCalendario(desdeStr, i));
    }
    return fechas;
}

export function convertirRangoArgentinaAInstantesUtc(desdeStr, hastaStr) {
    const hastaDiaSiguiente = sumarDiasCalendario(hastaStr, 1);
  // America/Argentina/Buenos_Aires es UTC-3 fijo (-03:00)
    const inicioUtc = new Date(`${desdeStr}T00:00:00.000-03:00`).toISOString();
    const finExclusivoUtc = new Date(
        `${hastaDiaSiguiente}T00:00:00.000-03:00`
    ).toISOString();

    return { inicioUtc, finExclusivoUtc };
}

export function validarQueryMetricas(query = {}, ahora = new Date()) {
    if (!query || typeof query !== 'object') {
        throw new AppError(400, 'PARAMETRO_INVALIDO', 'Parámetros de consulta inválidos.');
    }

    for (const key of Object.keys(query)) {
        if (!PARAMETROS_PERMITIDOS.has(key)) {
            throw new AppError(
                400,
                'PARAMETRO_INVALIDO',
                `El parámetro "${key}" no está permitido.`
            );
        }
        if (Array.isArray(query[key])) {
            throw new AppError(
                400,
                'PARAMETRO_INVALIDO',
                `El parámetro "${key}" no puede repetirse.`
            );
        }
    }

    const hoyArg = obtenerFechaHoyArgentina(ahora);
    const fechaMinimaPermitida = sumarDiasCalendario(hoyArg, -89);

    const tieneDesde = query.desde !== undefined && query.desde !== '';
    const tieneHasta = query.hasta !== undefined && query.hasta !== '';

    if (tieneDesde !== tieneHasta) {
        throw new AppError(
            400,
            'PARAMETRO_INVALIDO',
            'Debés indicar tanto "desde" como "hasta", o ninguno de los dos.'
        );
    }

    let desde = tieneDesde ? String(query.desde).trim() : sumarDiasCalendario(hoyArg, -6);
    let hasta = tieneHasta ? String(query.hasta).trim() : hoyArg;

    if (!esFechaCalendarioReal(desde) || !esFechaCalendarioReal(hasta)) {
        throw new AppError(
            400,
            'PARAMETRO_INVALIDO',
            'Las fechas "desde" y "hasta" deben tener formato YYYY-MM-DD válido.'
        );
    }

    if (hasta < desde) {
        throw new AppError(
            400,
            'PARAMETRO_INVALIDO',
            'La fecha "hasta" debe ser mayor o igual a "desde".'
        );
    }

    if (hasta > hoyArg || desde > hoyArg) {
        throw new AppError(
            400,
            'PARAMETRO_INVALIDO',
            'No se aceptan fechas futuras.'
        );
    }

    if (desde < fechaMinimaPermitida) {
        throw new AppError(
            400,
            'PARAMETRO_INVALIDO',
            'No se aceptan fechas anteriores a la ventana de conservación (90 días).'
        );
    }

    const diasRango = diferenciaDiasInclusiva(desde, hasta);
    if (diasRango > 90) {
        throw new AppError(
            400,
            'PARAMETRO_INVALIDO',
            'El rango inclusivo máximo permitido es de 90 días.'
        );
    }

    let tipo = null;
    if (query.tipo !== undefined && String(query.tipo).trim() !== '') {
        const tipoLimpio = String(query.tipo).trim();
        if (!TIPOS_CONSULTA_VALIDOS.has(tipoLimpio)) {
            throw new AppError(
                400,
                'PARAMETRO_INVALIDO',
                'El parámetro "tipo" debe ser general, cotizacion o asesoria.'
            );
        }
        tipo = tipoLimpio;
    }

    const { inicioUtc, finExclusivoUtc } = convertirRangoArgentinaAInstantesUtc(
        desde,
        hasta
    );

    return {
        desde,
        hasta,
        tipo,
        zonaHoraria: ZONA_HORARIA_ARGENTINA,
        inicioUtc,
        finExclusivoUtc,
        fechasRango: generarListaFechasRango(desde, hasta),
    };
}