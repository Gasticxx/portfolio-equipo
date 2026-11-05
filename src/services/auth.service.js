import { registroSchema } from "../validators/auth.validator.js";
import { crearUsuarioRegistrado } from "../repositories/auth.repository.js";
import { generarHash } from "./contrasenas.service.js";

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
