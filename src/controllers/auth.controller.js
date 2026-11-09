import { ZodError } from "zod";
import { pool } from "../config/db.js";
import { AppError } from "../middlewares/errors.js";
import {
  registrarUsuario,
  autenticarUsuario,
} from "../services/auth.service.js";
import { obtenerTokenCsrf } from "../middlewares/csrf.js";
import { env } from "../config/env.js";
import { CONSTANTS } from "../config/constants.js";
import { logoutSchema } from "../validators/auth.validator.js";
import { responderLimiteExcedido } from "../middlewares/limits.js";

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
// Verifica las credenciales y crea una sesión autenticada nueva.
export async function iniciarSesion(req, res, next) {
  try {
    const usuario = await autenticarUsuario(pool, req.body);

    if (usuario === null) {
      return next(
        new AppError(
          401,
          "CREDENCIALES_INVALIDAS",
          "Email o contraseña incorrectos, o cuenta no habilitada.",
        ),
      );
    }

    // Preparamos los datos de esta petición para el cambio de sesión.
    req.user = null;
    res.locals.usuarioActual = null;

    // Esperamos a tener un identificador de sesión nuevo.
    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    try {
      // Guardamos los datos que comprobará cargarUsuarioActual.
      req.session.usuarioId = usuario.id;
      req.session.versionSesion = usuario.versionSesion;
      req.session.autenticadoEn = Date.now();

      // La sesión nueva recibe un token CSRF nuevo.
      obtenerTokenCsrf(req.session);

      // Confirmamos el guardado antes de responder que el login fue correcto.
      await new Promise((resolve, reject) => {
        req.session.save((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    } catch (error) {
      // Ante un fallo, descartamos los datos locales para evitar otro guardado al responder.
      req.session = null;
      throw error;
    }

    // Separamos los campos públicos de la versión interna de sesión.
    const { id, nombre, email, rol } = usuario;
    const usuarioPublico = { id, nombre, email, rol };

    req.user = usuarioPublico;
    res.locals.usuarioActual = usuarioPublico;
    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      ok: true,
      data: {
        usuario: usuarioPublico,
        csrfToken: req.session.csrfToken,
      },
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
    // Reutilizamos la misma respuesta que envían los límites por IP.
    if (error.status === 429 && error.code === "LIMITE_EXCEDIDO") {
      return responderLimiteExcedido(req, res, error.retryAfter);
    }
    return next(error);
  }
}

// Destruye la sesión actual y elimina su cookie del navegador.
export async function cerrarSesion(req, res, next) {
  try {
    // El contrato del logout admite únicamente un objeto vacío.
    logoutSchema.parse(req.body);

    // Esperamos la confirmación del almacén antes de responder.
    await new Promise((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    // Esta petición termina sin un usuario autenticado.
    req.user = null;
    res.locals.usuarioActual = null;

    // Usamos las mismas opciones con las que creamos la cookie de sesión.
    res.clearCookie(CONSTANTS.SESSION.COOKIE_NAME, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.IS_PROD,
      path: "/",
    });

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      ok: true,
      data: { cerrada: true },
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

    return next(error);
  }
}

// Renderiza la página pública de registro con los parciales de I3.
export function mostrarRegistro(req, res) {
  res.setHeader("Cache-Control", "no-store");

  return res.render("auth/registro", {
    titulo: "Crear cuenta",
    rutaActual: "/registro",
    usuarioActual: req.user ?? null,
  });
}

// Renderiza el formulario de ingreso con los parciales de I3.
const RUTAS_ADMIN = new Set([
  "/admin",
  "/admin/proyectos",
  "/admin/demos",
  "/admin/servicios",
  "/admin/usuarios",
  "/admin/metricas",
]);

function destinoDespuesDelLogin(destino, rol) {
  const destinoPorDefecto = "/mi-cuenta";

  // next viene de la URL. Solo aceptamos un valor con el formato esperado.
  if (
    typeof destino !== "string" ||
    destino.length > 200 ||
    destino.includes("//") ||
    /[\\\s\x00-\x1f\x7f]/.test(destino)
  ) {
    return destinoPorDefecto;
  }

  // Validamos la ruta por separado para conservar filtros como ?pagina=2.
  const [ruta] = destino.split("?", 1);
  const { ADMINISTRADOR, OPERADOR, REGISTRADO } = CONSTANTS.ROLES;

  if (RUTAS_ADMIN.has(ruta)) {
    return rol === ADMINISTRADOR ? destino : destinoPorDefecto;
  }

  if (/^\/operador\/consultas(?:\/[1-9]\d*)?$/.test(ruta)) {
    return [OPERADOR, ADMINISTRADOR].includes(rol)
      ? destino
      : destinoPorDefecto;
  }

  if (
    /^\/proyectos\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(ruta) ||
    /^\/demos\/[1-9]\d*$/.test(ruta)
  ) {
    return [REGISTRADO, OPERADOR, ADMINISTRADOR].includes(rol)
      ? destino
      : destinoPorDefecto;
  }

  return destinoPorDefecto;
}

export function mostrarLogin(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // Después del login, req.user ya trae el rol comprobado por el servidor.
  if (req.user) {
    return res.redirect(destinoDespuesDelLogin(req.query.next, req.user.rol));
  }

  return res.render("auth/login", {
    titulo: "Ingresar",
    rutaActual: "/login",
    usuarioActual: null,
    registroCompletado: req.query.registro === "ok",
  });
}

export function mostrarMiCuenta(req, res) {
  res.setHeader("Cache-Control", "no-store");

  // cargarUsuarioActual ya comprobó la sesión antes de llegar a esta ruta.
  if (!req.user) {
    return res.redirect("/login");
  }

  return res.render("auth/mi-cuenta", {
    titulo: "Mi cuenta",
    rutaActual: "/mi-cuenta",
    usuarioActual: req.user,
  });
}
