// Capacidad compartida por la generación y la verificación de hashes.
export const MAX_CALCULOS_SIMULTANEOS = 2;
export const MAX_CALCULOS_EN_ESPERA = 8;

// Tiempo que indicará el servidor cuando la cola esté llena.
export const REINTENTO_HASH_SEGUNDOS = 2;
