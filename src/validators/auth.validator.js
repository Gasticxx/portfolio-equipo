import * as z from "zod";

// Contamos puntos de código para tratar un emoji simple como un carácter.
function contarCaracteres(texto) {
  return Array.from(texto).length;
}

// Normalizamos nombre y email antes de comprobar su longitud.
function normalizarTexto(texto) {
  return texto.normalize("NFC").replace(/\r\n?/g, "\n").trim();
}

const nombreSchema = z
  .string()
  .transform(normalizarTexto)
  .refine((nombre) => !nombre.includes("\0"), {
    error: "El nombre contiene un carácter no admitido.",
  })
  .refine(
    (nombre) => {
      const cantidad = contarCaracteres(nombre);
      return cantidad >= 2 && cantidad <= 80;
    },
    { error: "El nombre debe tener entre 2 y 80 caracteres." },
  );

const emailSchema = z
  .string()
  // Guardamos una forma consistente del email para comparar cuentas.
  .transform((email) => normalizarTexto(email).toLowerCase())
  .refine(
    (email) => {
      const cantidad = contarCaracteres(email);
      return cantidad >= 5 && cantidad <= 254;
    },
    { error: "El email debe tener entre 5 y 254 caracteres." },
  )
  .pipe(z.email({ error: "Ingresá un email válido." }));

// La contraseña conserva sus espacios y caracteres originales.
const passwordSchema = z
  .string()
  .refine((password) => !password.includes("\0"), {
    error: "La contraseña contiene un carácter no admitido.",
  })
  .refine(
    (password) => {
      const cantidad = contarCaracteres(password);
      return cantidad >= 12 && cantidad <= 128;
    },
    { error: "La contraseña debe tener entre 12 y 128 caracteres." },
  )
  .refine((password) => Buffer.byteLength(password, "utf8") <= 256, {
    error: "La contraseña puede ocupar hasta 256 bytes UTF-8.",
  });

// Solo admitimos los cuatro campos del formulario de registro.
export const registroSchema = z
  .strictObject({
    nombre: nombreSchema,
    email: emailSchema,
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((datos) => datos.password === datos.passwordConfirm, {
    // Asociamos el error al campo que la persona debe revisar.
    path: ["passwordConfirm"],
    error: "Las contraseñas deben coincidir.",
  });

// El login recibe únicamente email y contraseña.
export const loginSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});

export const cambioPasswordSchema = z.strictObject({
  passwordActual: passwordSchema,
  password: passwordSchema,
  passwordConfirm: z.string(),
}).refine((datos) => datos.password === datos.passwordConfirm, {
  path: ["passwordConfirm"], error: "Las contraseñas deben coincidir.",
}).refine((datos) => datos.password !== datos.passwordActual, {
  path: ["password"], error: "La contraseña nueva debe ser distinta.",
});

// El logout recibe un objeto vacío y rechaza campos adicionales.
export const logoutSchema = z.strictObject({});
