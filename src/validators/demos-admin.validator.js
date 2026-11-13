import { z } from 'zod';
import { AppError } from '../middlewares/errors.js';

export const tiposDemo = ['tablero', 'algoritmos', 'calendario', 'ondas'];
const id = z.number().int().positive().max(2147483647);
const texto = (min, max) => z.string().transform(s => s.normalize('NFC').replace(/\r\n?/g, '\n').trim())
  .refine(s => !s.includes('\0') && Array.from(s).length >= min && Array.from(s).length <= max, `Ingresá entre ${min} y ${max} caracteres.`);
// Compatibilidad de entrada con el panel anterior; las respuestas usan camelCase.
export const demoSchema = z.preprocess(value => {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'proyecto_id' in value && !('proyectoId' in value)) {
    const { proyecto_id, ...rest } = value;
    return { ...rest, proyectoId: proyecto_id };
  }
  return value;
}, z.object({ proyectoId: id, titulo: texto(3, 100), descripcion: texto(20, 1000), tipo: z.enum(tiposDemo), publicada: z.boolean(), orden: z.number().int().min(1).max(100) }).strict());
const numeroQuery = (max, defecto) => z.preprocess(v => v ?? String(defecto), z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(max)));
export const demoQuerySchema = z.object({
  page: numeroQuery(100000, 1), pageSize: numeroQuery(50, 10),
  q: texto(0, 80).refine(s => !s.length || Array.from(s).length >= 2, 'Ingresá al menos dos caracteres.').optional(),
  proyectoId: z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(id).optional(),
  tipo: z.enum(tiposDemo).optional(), publicada: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
}).strict();
export function validarDemo(schema, value, status = 422) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  throw new AppError(status, status === 400 ? 'PARAMETRO_INVALIDO' : 'VALIDACION', 'Revisá los campos indicados.',
    Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join('.') || 'general', issue.message])));
}
export function validarDemoId(value) {
  if (!/^[1-9]\d*$/.test(value) || !id.safeParse(Number(value)).success) throw new AppError(400, 'PARAMETRO_INVALIDO', 'Identificador de demo inválido.');
  return Number(value);
}
