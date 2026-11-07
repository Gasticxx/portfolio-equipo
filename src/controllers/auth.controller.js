import { ZodError } from "zod";
import { pool } from "../config/db.js";
import { AppError } from "../middlewares/errors.js";
import { registrarUsuario } from "../services/auth.service.js";
import { obtenerTokenCsrf } from "../middlewares/csrf.js";

function obtenerErroresPorCampo(error) {
  // Guardamos un mensaje por campo en un objeto sin claves heredadas.
  const fields = Object.create(null);

  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      // Los campos extra, como rol, vienen en issue.keys.
      for (const campo of issue.keys) {
        fields[campo] = "Este campo no está permitido.";
      }
    } else {
      // Tomamos el primer mensaje asociado a cada campo.
      const campo = issue.path[0] ?? "body";
      fields[campo] ??= issue.message;
    }
  }

  return fields;
}

export async function registrar(req, res, next) {
  try {
    // Pasamos al servicio la conexión compartida y los datos recibidos.
    const usuario = await registrarUsuario(pool, req.body);

    if (usuario === null) {
      return next(
        new AppError(
          409,
          "EMAIL_DUPLICADO",
          "Ya existe una cuenta con ese email.",
        ),
      );
    }

    // El repositorio devuelve id, nombre, email y rol.
    return res.status(201).json({
      ok: true,
      data: usuario,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return next(
        new AppError(
          422,
          "VALIDACION",
          "Revisá los campos indicados.",
          obtenerErroresPorCampo(error),
        ),
      );
    }

    // El middleware común responde a los demás errores.
    return next(error);
  }
}

// Devuelve los datos públicos del usuario autenticado en esta petición.
export function obtenerUsuarioActual(req, res) {
  // El middleware de autenticación garantiza que req.user esté disponible.
  const { id, nombre, email, rol } = req.user;

  // Indicamos que esta respuesta personal no debe almacenarse en caché.
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    ok: true,
    data: { id, nombre, email, rol },
  });
}

// Entrega un token CSRF asociado a la sesión del navegador.
export async function obtenerCsrf(req, res) {
  const csrfToken = obtenerTokenCsrf(req.session);

  // Esperamos a que el almacén confirme que guardó la sesión con su token.
  await new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  // El navegador debe consultar este dato al servidor.
  res.setHeader("Cache-Control", "no-store");

  return res.status(200).json({
    ok: true,
    data: { csrfToken },
  });
}
