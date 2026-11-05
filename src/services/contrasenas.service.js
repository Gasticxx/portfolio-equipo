import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { buffer } from "node:stream/consumers";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function verificarContrasena(password, hashGuardado) {
  if (typeof password !== "string" || typeof hashGuardado !== "string") {
    return false;
  }

  const caracteres = Array.from(password).length;
  const bytes = Buffer.byteLength(password, "utf-8");

  if (caracteres < 12 || caracteres > 128 || bytes > 256) {
    return false;
  }

  const partes = hashGuardado.split("$");

  if (partes.length !== 6) {
    return false;
  }

  const [algoritmo, n, r, p, saltHex, hashHex] = partes;

  if (algoritmo !== "scrypt" || n !== "32768" || r !== "8" || p !== "3") {
    return false;
  }

  if (saltHex.length !== 32 || hashHex.length !== 128) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const hashEsperado = Buffer.from(hashHex, "hex");

  if (
    salt.length !== 16 ||
    hashEsperado.length !== 64 ||
    salt.toString("hex") !== saltHex ||
    hashEsperado.toString("hex") !== hashHex
  ) {
    return false;
  }

  const hashCalculado = await scryptAsync(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 3,
    maxmem: 67108864,
  });

  return timingSafeEqual(hashCalculado, hashEsperado);
}

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
