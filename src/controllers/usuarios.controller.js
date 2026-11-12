import { z } from "zod";
import { AppError } from "../middlewares/errors.js";
import {
  listarUsuarios,
  obtenerUsuario,
  actualizarEstadoUsuario,
} from "../services/usuarios.service.js";

const idSchema = z.string().regex(/^[1-9]\d*$/).transform(Number)
  .pipe(z.number().int().max(2_147_483_647));
const estadoSchema = z.object({ activo: z.boolean() }).strict();

function enteroDecimal(maximo) {
  return z
    .string()
    .regex(/^[0-9]+$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximo));
}

export async function getUsuarioAdmin(req, res, next) {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) return next(new AppError(400, "PARAMETRO_INVALIDO", "El identificador es inválido."));
  try {
    const data = await obtenerUsuario(id.data);
    if (!data) return next(new AppError(404, "NO_ENCONTRADO", "El usuario solicitado no existe."));
    return res.status(200).json({ ok: true, data });
  } catch (error) { return next(error); }
}

export function mostrarUsuariosAdmin(_req, res) {
  return res.render("admin/usuarios", { titulo: "Usuarios", rutaActual: "/admin/usuarios" });
}

export function mostrarPanelAdmin(_req, res) {
  return res.render("admin/index", { titulo: "Administración", rutaActual: "/admin" });
}

export async function patchUsuarioAdmin(req, res, next) {
  const id = idSchema.safeParse(req.params.id);
  const body = estadoSchema.safeParse(req.body);
  if (!id.success || !body.success) return next(new AppError(422, "VALIDACION", "Enviá un identificador y un estado activo válidos."));
  try {
    const data = await actualizarEstadoUsuario(id.data, body.data.activo);
    if (!data) return next(new AppError(404, "NO_ENCONTRADO", "El usuario solicitado no existe."));
    return res.status(200).json({ ok: true, data });
  } catch (error) { return next(error); }
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
