import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { buffer } from "node:stream/consumers";
import { promisify } from "node:util";
import {
  MAX_CALCULOS_SIMULTANEOS,
  MAX_CALCULOS_EN_ESPERA,
  REINTENTO_HASH_SEGUNDOS,
} from "../config/constants.js";

const scryptAsync = promisify(scrypt);
export const HASH_FICTICIO =
  "scrypt$32768$8$3$5a611f3a0092fd460dbd3a479928c5dd$" +
  "160eb4835f1ad1e6b2727b598f89a7ce5271e743d9cb2eabf8507bc38794e030d34bcd77b48c80a445ad526b53fc86536fa99c46caa849dd1dcc17d55c06ee20";

let calculosActivos = 0;
const colaDeEspera = [];

async function calcularScrypt(password, salt) {
  if (calculosActivos < MAX_CALCULOS_SIMULTANEOS) {
    calculosActivos++;
  } else {
    if (colaDeEspera.length >= MAX_CALCULOS_EN_ESPERA) {
      const error = new Error("Capacidad temporal de hash agotada.");

      error.code = "SERVICIO_NO_DISPONIBLE";
      error.status = 503;
      error.retryAfter = REINTENTO_HASH_SEGUNDOS;

      throw error;
    }

    await new Promise((resolve) => {
      colaDeEspera.push(resolve);
    });
  }

  try {
    return await scryptAsync(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 3,
      maxmem: 67108864,
    });
  } finally {
    const siguiente = colaDeEspera.shift();

    if (siguiente) {
      siguiente();
    } else {
      calculosActivos--;
    }
  }
}

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

  const hashCalculado = await calcularScrypt(password, salt);

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

  const hash = await calcularScrypt(password, salt);

  return `scrypt$32768$8$3$${salt.toString("hex")}$${hash.toString("hex")}`;
}
