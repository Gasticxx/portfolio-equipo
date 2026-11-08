import crypto from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./errors.js";

// Comprueba el formato antes de generar o comparar tokens.
function esTokenCsrfValido(token) {
  return (
    typeof token === "string" &&
    token.length === 64 &&
    /^[0-9a-f]{64}$/.test(token)
  );
}

// Obtiene el token de esta sesión o crea uno cuando falta o es inválido.
export function obtenerTokenCsrf(sesion) {
  if (!esTokenCsrfValido(sesion.csrfToken)) {
    // Cada byte se representa con dos caracteres hexadecimales.
    sesion.csrfToken = crypto.randomBytes(32).toString("hex");
  }

  return sesion.csrfToken;
}

// Comprueba el origen y el token antes de una operación de escritura.
export function verificarCsrf(req, res, next) {
  let origenPeticion = req.get("Origin");

  // Usamos Referer únicamente cuando falta la cabecera Origin.
  if (origenPeticion === undefined) {
    try {
      origenPeticion = new URL(req.get("Referer")).origin;
    } catch {
      // Un Referer ausente o inválido provoca el rechazo de la solicitud.
      origenPeticion = null;
    }
  }

  const tokenEsperado = req.session.csrfToken;
  const tokenRecibido = req.get("X-CSRF-Token");

  // Comparamos los bytes únicamente si ambos tokens tienen el formato correcto.
  const tokenCoincide =
    esTokenCsrfValido(tokenEsperado) &&
    esTokenCsrfValido(tokenRecibido) &&
    crypto.timingSafeEqual(
      Buffer.from(tokenEsperado, "hex"),
      Buffer.from(tokenRecibido, "hex"),
    );

  // Exigimos que el origen y el token sean correctos al mismo tiempo.
  if (origenPeticion !== env.APP_ORIGIN || !tokenCoincide) {
    return next(
      new AppError(
        403,
        "CSRF_INVALIDO",
        "La solicitud no pudo verificarse. Actualizá el formulario e intentá nuevamente.",
      ),
    );
  }

  return next();
}
