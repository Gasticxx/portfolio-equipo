import { z } from 'zod';

export const idContenido = z.number().int().positive().max(2147483647);
const texto = (min, max) => z.string().transform(s => s.normalize('NFC').replace(/\r\n?/g, '\n').trim())
  .refine(s => !s.includes('\0') && Array.from(s).length >= min && Array.from(s).length <= max, `Ingresá entre ${min} y ${max} caracteres.`);
const ids = max => z.array(idContenido).min(1).max(max).refine(a => new Set(a).size === a.length, 'No repitas tecnologías.');
const https = z.string().trim().max(300).url().refine(value => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'Ingresá una URL HTTPS sin credenciales.').nullable();

const aporte = z.object({
  miembroId: idContenido, titulo: texto(3, 100), descripcion: texto(20, 1000),
  estado: z.enum(['asignado', 'desarrollo', 'comprobado']), evidenciaUrl: https,
  tecnologiaIds: ids(10),
}).strict().superRefine((data, ctx) => {
  if (data.estado === 'comprobado' && !data.evidenciaUrl) ctx.addIssue({ code: 'custom', path: ['evidenciaUrl'], message: 'Un aporte comprobado necesita evidencia HTTPS.' });
});

const campos = {
  titulo: texto(3, 100), slug: z.string().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  resumen: texto(20, 250), descripcion: texto(50, 5000),
  estado: z.enum(['desarrollo', 'terminado']), publicado: z.boolean(),
  portadaId: idContenido.nullable(), repositorioUrl: https,
  tecnologiaIds: ids(15), aportes: z.array(aporte).min(1).max(30),
};
function comprobarConjunto(data, ctx) {
  const claves = data.aportes.map(a => `${a.miembroId}:${a.titulo}`);
  if (new Set(claves).size !== claves.length) ctx.addIssue({ code: 'custom', path: ['aportes'], message: 'Un integrante no puede tener dos aportes con el mismo título.' });
  if (data.estado === 'terminado' && data.aportes.some(a => a.estado !== 'comprobado')) {
    ctx.addIssue({ code: 'custom', path: ['estado'], message: 'Para terminar el proyecto, todos sus aportes deben estar comprobados y tener evidencia.' });
  }
}
export const proyectoPutSchema = z.object(campos).strict().superRefine(comprobarConjunto);
export const proyectoPostSchema = z.object({ ...campos, estado: campos.estado.default('desarrollo'), publicado: campos.publicado.default(false), portadaId: campos.portadaId.default(null), repositorioUrl: campos.repositorioUrl.default(null) }).strict().superRefine(comprobarConjunto);
const enteroQuery = (max, fallback) => z.preprocess(value => value ?? String(fallback), z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(max)));
export const proyectoQuerySchema = z.object({
  page: enteroQuery(100000, 1), pageSize: enteroQuery(50, 10),
  q: texto(0, 80).optional(), publicado: z.enum(['true', 'false']).transform(v => v === 'true').optional(),
}).strict();
export function validar(schema, value, status = 422) {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  const fields = Object.fromEntries(parsed.error.issues.map(issue => [issue.path.join('.') || 'general', issue.message]));
  return { error: { status, fields } };
}
