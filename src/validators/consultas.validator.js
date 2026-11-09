// Esquemas Zod 4 del módulo de consultas (I6).
// Reglas: apartado 11 (convenciones) y apartado 14 (contacto y operador).
import { z } from 'zod';
import {
  TIPOS_CONSULTA,
  ESTADOS_CONSULTA,
  ESTADOS_ENVIO,
  LIMITES_CONSULTA,
  LIMITES_RESPUESTA,
  PAGINACION,
  ID_MAXIMO
} from '../config/consultas.constants.js';
import { errores } from '../services/consultas.errores.js';

// ---------------------------------------------------------------------------
// Normalización de texto (apartado 11): NFC, saltos a LF, trim, rechazo de NUL
// y longitud medida en caracteres Unicode con Array.from (= char_length de PG).
// ---------------------------------------------------------------------------
export function normalizarTexto(valor) {
  return valor.normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

export function largoUnicode(valor) {
  return Array.from(valor).length;
}

function texto(etiqueta, min, max, { unaLinea = false } = {}) {
  return z
    .string({ error: `Ingresá ${etiqueta}.` })
    .transform(normalizarTexto)
    .refine((v) => !v.includes('\u0000'), { error: 'Contiene caracteres no permitidos.' })
    .refine((v) => !unaLinea || !v.includes('\n'), { error: 'Debe escribirse en una sola línea.' })
    .refine((v) => largoUnicode(v) >= min, { error: `Debe tener al menos ${min} caracteres.`, abort: true })
    .refine((v) => largoUnicode(v) <= max, { error: `Debe tener como máximo ${max} caracteres.` });
}

const emailSchema = z
  .string({ error: 'Ingresá un email válido.' })
  .transform((v) => normalizarTexto(v).toLowerCase())
  .pipe(
    z
      .email({ error: 'Ingresá un email válido.' })
      .max(LIMITES_CONSULTA.email.max, { error: `El email admite hasta ${LIMITES_CONSULTA.email.max} caracteres.` })
  );

const idEntero = z
  .number({ error: 'Debe ser un número entero.' })
  .int({ error: 'Debe ser un número entero.' })
  .positive({ error: 'Debe ser un número positivo.' })
  .max(ID_MAXIMO, { error: 'Número fuera de rango.' });

// ---------------------------------------------------------------------------
// POST /api/consultas
// ---------------------------------------------------------------------------
export const crearConsultaSchema = z
  .strictObject({
    nombre: texto('tu nombre', LIMITES_CONSULTA.nombre.min, LIMITES_CONSULTA.nombre.max, { unaLinea: true }),
    email: emailSchema,
    tipo: z.enum(TIPOS_CONSULTA, { error: 'Elegí general, cotización o asesoría.' }),
    asunto: texto('un asunto', LIMITES_CONSULTA.asunto.min, LIMITES_CONSULTA.asunto.max, { unaLinea: true }),
    mensaje: texto('un mensaje', LIMITES_CONSULTA.mensaje.min, LIMITES_CONSULTA.mensaje.max),
    consentimiento: z.literal(true, { error: 'Necesitamos tu consentimiento para responder la consulta.' }),
    // "entero o null"; se acepta ausente y se normaliza a null para la huella.
    servicioId: idEntero.nullable().optional().transform((v) => v ?? null)
  })
  .superRefine((datos, ctx) => {
    if (datos.servicioId !== null && datos.tipo !== 'cotizacion') {
      ctx.addIssue({
        code: 'custom',
        path: ['servicioId'],
        message: 'Solo se puede elegir un servicio en una cotización.'
      });
    }
  });

// ---------------------------------------------------------------------------
// Operador
// ---------------------------------------------------------------------------
export const respuestaSchema = z.strictObject({
  mensaje: texto('la respuesta', LIMITES_RESPUESTA.mensaje.min, LIMITES_RESPUESTA.mensaje.max)
});

export const cambioEstadoSchema = z.strictObject({
  estado: z.enum(ESTADOS_CONSULTA, { error: 'Estado inválido.' })
});

export const reintentoSchema = z.strictObject({
  confirmarRiesgo: z.boolean({ error: 'confirmarRiesgo debe ser true o false.' }).optional()
});

// Query string: Express 5 entrega strings; un parámetro repetido llega como array
// y falla aquí (→ 400). strictObject rechaza parámetros desconocidos (→ 400).
const enteroQuery = (min, max, etiqueta) =>
  z
    .string({ error: `${etiqueta} inválido.` })
    .regex(/^[1-9]\d{0,9}$/, { error: `${etiqueta} inválido.` })
    .transform(Number)
    .refine((n) => n >= min && n <= max, { error: `${etiqueta} fuera de rango.` });

export const listadoConsultasSchema = z.strictObject({
  page: enteroQuery(1, PAGINACION.pageMax, 'page').optional().default(1),
  pageSize: enteroQuery(1, PAGINACION.pageSizeMax, 'pageSize').optional().default(PAGINACION.pageSizeDefault),
  q: z
    .string({ error: 'q inválido.' })
    .transform(normalizarTexto)
    .refine((v) => v === '' || (largoUnicode(v) >= PAGINACION.qMin && largoUnicode(v) <= PAGINACION.qMax), {
      error: `La búsqueda debe tener entre ${PAGINACION.qMin} y ${PAGINACION.qMax} caracteres.`
    })
    .transform((v) => (v === '' ? undefined : v))
    .optional(),
  tipo: z.enum(TIPOS_CONSULTA, { error: 'tipo inválido.' }).optional(),
  estado: z.enum(ESTADOS_CONSULTA, { error: 'estado inválido.' }).optional(),
  notificacionEstado: z.enum(ESTADOS_ENVIO, { error: 'notificacionEstado inválido.' }).optional()
});

// Query de la página /contacto: valores inválidos se ignoran (no es una API).
export const contactoQuerySchema = z.object({
  tipo: z.enum(TIPOS_CONSULTA).optional().catch(undefined),
  servicioId: z
    .string()
    .regex(/^[1-9]\d{0,9}$/)
    .transform(Number)
    .refine((n) => n <= ID_MAXIMO)
    .optional()
    .catch(undefined)
});

// ---------------------------------------------------------------------------
// Parámetros de ruta y cabeceras
// ---------------------------------------------------------------------------
const UUID_CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function validarIdRuta(valor) {
  if (typeof valor !== 'string' || !/^[1-9]\d{0,9}$/.test(valor)) {
    throw errores.parametro('El identificador no es válido.');
  }
  const id = Number(valor);
  if (id > ID_MAXIMO) throw errores.parametro('El identificador no es válido.');
  return id;
}

export function validarIdempotencyKey(valor) {
  if (typeof valor !== 'string' || !UUID_CANONICO.test(valor)) {
    throw errores.parametro('Falta la cabecera Idempotency-Key o no es un UUID válido.', {
      'Idempotency-Key': 'Debe ser un UUID en minúsculas.'
    });
  }
  return valor;
}

// ---------------------------------------------------------------------------
// Conversión de errores Zod al formato {fields} del contrato
// ---------------------------------------------------------------------------
export function camposDesdeZod(error) {
  const fields = {};
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const clave of issue.keys) fields[clave] ??= 'Campo no admitido.';
      continue;
    }
    const clave = issue.path.length ? String(issue.path[0]) : '_';
    fields[clave] ??= issue.message;
  }
  return fields;
}

/** Valida un cuerpo JSON: 422 VALIDACION con fields si falla. */
export function validarCuerpo(schema, cuerpo) {
  const r = schema.safeParse(cuerpo ?? {});
  if (!r.success) throw errores.validacion(camposDesdeZod(r.error));
  return r.data;
}

/** Valida un query string: 400 PARAMETRO_INVALIDO con fields si falla. */
export function validarQuery(schema, query) {
  const r = schema.safeParse(query ?? {});
  if (!r.success) throw errores.parametro('Revisá los parámetros de búsqueda.', camposDesdeZod(r.error));
  return r.data;
}
