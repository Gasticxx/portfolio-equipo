import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function generarHash(password) {
  if (typeof password !== "string") {
    throw new TypeError("La contraseña debe ser texto.");
  }

  const caracteres = Array.from(password).length;
  const bytes = Buffer.byteLength(password, "utf8");

  if (caracteres < 12 || caracteres > 128 || bytes > 256) {
    throw new RangeError(
      "La contraseña debe tener entre 12 y 128 caracteres y hasta 256 bytes UTF-8.",
    );
  }

  const salt = randomBytes(16);

  const hash = await scryptAsync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 67108864,
  });

  return `scrypt$32768$8$3$${salt.toString("hex")}$${hash.toString("hex")}`;
}
