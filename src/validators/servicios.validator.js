import { z } from 'zod';

// Función auxiliar según apartado 11: normaliza NFC, saltos a LF, trim y mide longitud Unicode
function normalizarTexto(valor) {
  if (typeof valor !== 'string') return valor;
  return valor.normalize('NFC').replace(/\r\n?/g, '\n').trim();
}

function longitudUnicode(str) {
  return Array.from(str).length;
}

const textoPlano = (campo, min, max) =>
  z
    .string({
      required_error: `El campo ${campo} es obligatorio.`,
      invalid_type_error: `El campo ${campo} debe ser texto.`
    })
    .transform(normalizarTexto)
    .refine((val) => !val.includes('\0'), {
      message: `El campo ${campo} contiene caracteres inválidos.`
    })
    .refine((val) => longitudUnicode(val) >= min, {
      message: `El campo ${campo} debe tener al menos ${min} caracteres.`
    })
    .refine((val) => longitudUnicode(val) <= max, {
      message: `El campo ${campo} no puede superar los ${max} caracteres.`
    });

// Esquema para POST /api/admin/servicios y PUT /api/admin/servicios/:id (Apartado 13)
export const servicioBodySchema = z
  .object({
    nombre: textoPlano('nombre', 3, 80),
    descripcion: textoPlano('descripcion', 20, 1000),
    categoria: z.enum(['web', 'mantenimiento', 'asesoria'], {
      errorMap: () => ({ message: 'La categoría debe ser web, mantenimiento o asesoria.' })
    }),
    activo: z.boolean({
      invalid_type_error: 'El campo activo debe ser un booleano real.'
    }).default(true),
    orden: z
      .number({
        invalid_type_error: 'El orden debe ser un número entero.'
      })
      .int('El orden debe ser un número entero.')
      .min(1, 'El orden mínimo es 1.')
      .max(100, 'El orden máximo es 100.')
      .default(1)
  })
  .strict(); // Rechaza campos desconocidos según apartado 11

// En PUT todos los campos editables son obligatorios (Apartado 13)
export const servicioPutBodySchema = z
  .object({
    nombre: textoPlano('nombre', 3, 80),
    descripcion: textoPlano('descripcion', 20, 1000),
    categoria: z.enum(['web', 'mantenimiento', 'asesoria'], {
      errorMap: () => ({ message: 'La categoría debe ser web, mantenimiento o asesoria.' })
    }),
    activo: z.boolean({
      required_error: 'El campo activo es obligatorio.',
      invalid_type_error: 'El campo activo debe ser un booleano real.'
    }),
    orden: z
      .number({
        required_error: 'El campo orden es obligatorio.',
        invalid_type_error: 'El orden debe ser un número entero.'
      })
      .int('El orden debe ser un número entero.')
      .min(1, 'El orden mínimo es 1.')
      .max(100, 'El orden máximo es 100.')
  })
  .strict();

// Esquema para query params de GET /api/admin/servicios (Apartado 11 y 13)
export const servicioQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
    q: z
      .string()
      .transform(normalizarTexto)
      .refine((val) => !val.includes('\0'), { message: 'Búsqueda inválida.' })
      .refine((val) => val.length === 0 || (longitudUnicode(val) >= 2 && longitudUnicode(val) <= 80), {
        message: 'La búsqueda q debe tener entre 2 y 80 caracteres.'
      })
      .optional(),
    activo: z
      .enum(['true', 'false'])
      .transform((val) => val === 'true')
      .optional()
  })
  .strict();

// Esquema para validar :id numérico positivo hasta 2147483647 (Apartado 11)
export const idParamSchema = z
  .object({
    id: z
      .string()
      .regex(/^[1-9]\d*$/, 'ID inválido.')
      .transform(Number)
      .refine((n) => n >= 1 && n <= 2147483647, 'ID fuera de rango.')
  })
  .strict();