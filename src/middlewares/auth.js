import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import { CONSTANTS } from "../config/constants.js";
import { buscarUsuarioParaSesion } from "../repositories/auth.repository.js";
import { AppError } from "./errors.js";

// Descarta la sesión anterior y prepara una sesión anónima nueva.
async function descartarSesion(req, res) {
  // Convertimos el callback de regenerate en una promesa para poder esperarlo.
  await new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  // Pedimos al navegador que elimine la cookie de la sesión anterior.
  res.clearCookie(CONSTANTS.SESSION.COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.IS_PROD,
    path: "/",
  });
}

// Carga el usuario vigente antes de ejecutar las rutas de la aplicación.
export async function cargarUsuarioActual(req, res, next) {
  // Cada petición comienza sin un usuario autenticado.
  req.user = null;
  res.locals.usuarioActual = null;

  const { usuarioId, versionSesion, autenticadoEn } = req.session;

  // Las sesiones anónimas pueden continuar hacia las rutas públicas.
  if (usuarioId === undefined) {
    return next();
  }

  // autenticadoEn se guardará como milisegundos mediante Date.now() al hacer login.
  const antiguedad = Date.now() - autenticadoEn;
  const datosValidos =
    Number.isInteger(usuarioId) &&
    usuarioId > 0 &&
    usuarioId <= 2_147_483_647 &&
    Number.isInteger(versionSesion) &&
    versionSesion >= 1 &&
    Number.isSafeInteger(autenticadoEn) &&
    autenticadoEn > 0 &&
    antiguedad >= 0 &&
    antiguedad < CONSTANTS.SESSION.ABSOLUTE_MAX_MS;

  // Invalidamos también sesiones con datos incompletos o mal formados.
  if (!datosValidos) {
    await descartarSesion(req, res);
    return next();
  }

  // Consultamos el estado y el rol actuales en PostgreSQL.
  const usuario = await buscarUsuarioParaSesion(pool, usuarioId);

  // El bloqueo, la eliminación o un cambio de versión invalidan esta sesión.
  if (!usuario || !usuario.activo || usuario.version_sesion !== versionSesion) {
    await descartarSesion(req, res);
    return next();
  }

  // Publicamos únicamente los datos necesarios para rutas y vistas.
  req.user = {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
  };
  res.locals.usuarioActual = req.user;

  return next();
}

// Exige un usuario autenticado para acceder a una ruta de la API.
export function requerirAutenticacion(req, res, next) {
  if (!req.user) {
    return next(
      new AppError(401, "NO_AUTENTICADO", "Iniciá sesión para continuar."),
    );
  }

  return next();
}

// Prepara un middleware que permite únicamente los roles indicados.
export function requerirRol(...rolesPermitidos) {
  return function comprobarRol(req, res, next) {
    // Una petición anónima recibe el mismo error de autenticación.
    if (!req.user) {
      return requerirAutenticacion(req, res, next);
    }

    // El rol proviene del usuario que consultamos en PostgreSQL.
    if (!rolesPermitidos.includes(req.user.rol)) {
      return next(
        new AppError(403, "SIN_PERMISO", "No tenés permiso para esta acción."),
      );
    }

    return next();
  };
}
