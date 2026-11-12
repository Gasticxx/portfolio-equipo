import { z } from "zod";
import { AppError } from "../middlewares/errors.js";
import { listarUsuarios } from "../services/usuarios.service.js";

function enteroDecimal(maximo) {
  return z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximo));
}

const consultaUsuariosSchema = z
  .object({
    page: enteroDecimal(100_000).optional(),
    pageSize: enteroDecimal(50).optional(),
    q: z.string().trim().min(2).max(80).optional(),
    activo: z
      .enum(["true", "false"])
      .transform((valor) => valor === "true")
      .optional(),
  })
  .strict();

export async function getUsuariosAdmin(req, res, next) {
  const consulta = consultaUsuariosSchema.safeParse(req.query);

  if (!consulta.success) {
    return next(
      new AppError(
        400,
        "PARAMETRO_INVALIDO",
        "Revisá los parámetros de búsqueda y paginación.",
      ),
    );
  }

  const { page = 1, pageSize = 10, q, activo } = consulta.data;

  try {
    const resultado = await listarUsuarios({ page, pageSize, q, activo });
    return res.status(200).json({ ok: true, ...resultado });
  } catch (error) {
    return next(error);
  }
}
