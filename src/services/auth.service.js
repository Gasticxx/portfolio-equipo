import { registroSchema, loginSchema } from "../validators/auth.validator.js";
import {
  crearUsuarioRegistrado,
  buscarUsuarioPorEmail,
} from "../repositories/auth.repository.js";
import {
  generarHash,
  verificarContrasena,
  HASH_FICTICIO,
} from "./contrasenas.service.js";
import { AppError } from "../middlewares/errors.js";
import {
  limpiarFallosLoginEmail,
  registrarFalloLoginEmail,
} from "../middlewares/limits.js";

export async function registrarUsuario(pool, datosRegistro) {
  // Validamos la entrada antes de calcular el hash.
  // Zod también comprueba que la confirmación coincida.
  const { nombre, email, password } = registroSchema.parse(datosRegistro);

  // Usamos la contraseña validada para generar el valor que guardará la base.
  const passwordHash = await generarHash(password);

  // El repositorio fija el rol registrado y devuelve los datos públicos de la cuenta.
  return crearUsuarioRegistrado(pool, {
    nombre,
    email,
    passwordHash,
  });
}

// Comprueba las credenciales y devuelve los datos necesarios para crear la sesión.
export async function autenticarUsuario(pool, datosLogin) {
  // Reutilizamos la normalización del email y las reglas de contraseña.
  const { email, password } = loginSchema.parse(datosLogin);

  const usuario = await buscarUsuarioPorEmail(pool, email);

  // También hacemos una verificación cuando el email no corresponde a una cuenta.
  const hashEsperado = usuario?.password_hash ?? HASH_FICTICIO;
  const passwordCorrecta = await verificarContrasena(password, hashEsperado);

  // Los tres casos comparten el mismo resultado de credenciales rechazadas.
  // Contamos igual los tres casos: cuenta inexistente, inactiva o contraseña incorrecta.
  if (!usuario || !usuario.activo || !passwordCorrecta) {
    const fallo = await registrarFalloLoginEmail(email, pool);

    if (fallo.excedido) {
      const error = new AppError(
        429,
        "LIMITE_EXCEDIDO",
        "Superaste el límite de intentos permitidos. Esperá antes de volver a intentar.",
      );

      // El controlador usa este valor para enviar la cabecera Retry-After.
      error.retryAfter = fallo.retryAfterSegundos;
      throw error;
    }

    // El controlador sigue devolviendo el 401 de credenciales inválidas.
    return null;
  }

  // Las credenciales válidas reinician el contador del email.
  await limpiarFallosLoginEmail(email, pool);

  // versionSesion es un dato interno que el controlador guardará en la sesión.
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    versionSesion: usuario.version_sesion,
  };
}
