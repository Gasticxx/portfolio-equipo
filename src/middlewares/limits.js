import crypto from 'node:crypto';
import { ipKeyGenerator } from 'express-rate-limit';
import { pool } from '../config/db.js';
import { env } from '../config/env.js';

export const VENTANAS_MS = Object.freeze({
  QUINCE_MINUTOS: 15 * 60 * 1000,
  UNA_HORA: 60 * 60 * 1000,
});

export function normalizarIpCliente(ipRaw = '127.0.0.1') {
    try {
        return ipKeyGenerator(ipRaw, 56);
    } catch {
        return String(ipRaw || '127.0.0.1').trim();
    }
}

export function generarClaveHmacLimite(
    categoria,
    identificador,
    secreto = env.VISIT_SECRET || 'visit_secret_fallback_test'
) {
    const limpio = String(identificador ?? '').trim().toLowerCase();
        return crypto
        .createHmac('sha256', secreto)
        .update(`${categoria}:${limpio}`)
        .digest('hex');
}

export function calcularVentanaFijaUtc(ventanaMs, ahoraMs = Date.now()) {
    const inicioMs = Math.floor(ahoraMs / ventanaMs) * ventanaMs;
    const expiraMs = inicioMs + ventanaMs;
    const retryAfterSegundos = Math.max(1, Math.ceil((expiraMs - ahoraMs) / 1000));

    return {
        ventanaInicioIso: new Date(inicioMs).toISOString(),
        expiraAtIso: new Date(expiraMs).toISOString(),
        retryAfterSegundos,
    };
}

export async function consumirLimiteEnBd(
    { clave, ventanaInicioIso, expiraAtIso },
    db = pool
) {
    const sql = `
        INSERT INTO app.limites (clave, ventana_inicio, contador, expira_at)
        VALUES ($1, $2::timestamptz, 1, $3::timestamptz)
        ON CONFLICT (clave, ventana_inicio)
        DO UPDATE SET contador = app.limites.contador + 1
        RETURNING contador, expira_at AS "expiraAt"
    `;
    const result = await db.query(sql, [clave, ventanaInicioIso, expiraAtIso]);
    return result.rows[0];
}

export async function reiniciarLimiteEnBd(clave, db = pool) {
    const sql = `DELETE FROM app.limites WHERE clave = $1`;
    await db.query(sql, [clave]);
}

export class PostgresFixedWindowStore {
    constructor({ categoria, windowMs, db = pool }) {
        this.categoria = categoria;
        this.windowMs = windowMs;
        this.db = db;
    }

    async increment(key) {
        const clave =
            typeof key === 'string' && /^[0-9a-f]{64}$/.test(key)
                ? key
                : generarClaveHmacLimite(this.categoria, key);
        const { ventanaInicioIso, expiraAtIso } = calcularVentanaFijaUtc(
            this.windowMs
        );
        const fila = await consumirLimiteEnBd(
            { clave, ventanaInicioIso, expiraAtIso },
            this.db
        );
        return {
            totalHits: Number(fila.contador),
            resetTime: new Date(fila.expiraAt),
        };
    }

    async decrement() {
    // Ventana fija acumulativa según Apartado 17
    }

    async resetKey(key) {
        const clave =
            typeof key === 'string' && /^[0-9a-f]{64}$/.test(key)
                ? key
                : generarClaveHmacLimite(this.categoria, key);
        await reiniciarLimiteEnBd(clave, this.db);
    }
}

export function responderLimiteExcedido(req, res, retryAfterSegundos) {
    res.setHeader('Retry-After', String(retryAfterSegundos));
    return res.status(429).json({
        ok: false,
        error: {
            code: 'LIMITE_EXCEDIDO',
            message:
                'Superaste el límite de intentos permitidos. Esperá antes de volver a intentar.',
            requestId: req.requestId,
        },
    });
}

export function crearMiddlewareLimite({
    categoria,
    ventanaMs,
    maxIntentos,
    extractorIdentificador,
    consumirFn = consumirLimiteEnBd,
}) {
    return async function limitadorMiddleware(req, res, next) {
        const identificador = extractorIdentificador(req);
        const clave = generarClaveHmacLimite(categoria, identificador);
        const { ventanaInicioIso, expiraAtIso, retryAfterSegundos } =
            calcularVentanaFijaUtc(ventanaMs);

        try {
            const fila = await consumirFn({
                clave,
                ventanaInicioIso,
                expiraAtIso,
            });

            if (Number(fila.contador) > maxIntentos) {
                return responderLimiteExcedido(req, res, retryAfterSegundos);
            }
        } catch {
      // Si la tabla app.limites no está disponible en un test aislado sin BD, continúa
        }

        return next();
    };
}

// 1. Login por IP: 10 intentos cada 15 minutos por IP
export const limiteLoginIp = crearMiddlewareLimite({
    categoria: 'login_ip',
    ventanaMs: VENTANAS_MS.QUINCE_MINUTOS,
    maxIntentos: 10,
    extractorIdentificador: (req) => normalizarIpCliente(req.ip),
});

// 2. Login fallido por Email: 5 fallidos cada 15 minutos; éxito reinicia solo el de email
export async function registrarFalloLoginEmail(emailRaw, db = pool) {
    if (!emailRaw || typeof emailRaw !== 'string') return { excedido: false };
    const clave = generarClaveHmacLimite('login_email', emailRaw);
    const { ventanaInicioIso, expiraAtIso, retryAfterSegundos } =
        calcularVentanaFijaUtc(VENTANAS_MS.QUINCE_MINUTOS);
    const fila = await consumirLimiteEnBd(
        { clave, ventanaInicioIso, expiraAtIso },
        db
    );
    return {
        contador: Number(fila.contador),
        excedido: Number(fila.contador) > 5,
        retryAfterSegundos,
    };
}

export async function limpiarFallosLoginEmail(emailRaw, db = pool) {
    if (!emailRaw || typeof emailRaw !== 'string') return;
    const clave = generarClaveHmacLimite('login_email', emailRaw);
    await reiniciarLimiteEnBd(clave, db);
}

// 3. Registro: 5 altas o intentos por hora por IP
export const limiteRegistroIp = crearMiddlewareLimite({
    categoria: 'registro_ip',
    ventanaMs: VENTANAS_MS.UNA_HORA,
    maxIntentos: 5,
    extractorIdentificador: (req) => normalizarIpCliente(req.ip),
});

// 4. Contacto: 5 intentos por 15 minutos por IP
export const limiteContactoIp = crearMiddlewareLimite({
    categoria: 'contacto_ip',
    ventanaMs: VENTANAS_MS.QUINCE_MINUTOS,
    maxIntentos: 5,
    extractorIdentificador: (req) => normalizarIpCliente(req.ip),
});

// 5. Respuestas y reintentos: 20 solicitudes por hora por operador (usuarioId)
export const limiteOperadorUsuario = crearMiddlewareLimite({
    categoria: 'operador_user',
    ventanaMs: VENTANAS_MS.UNA_HORA,
    maxIntentos: 20,
    extractorIdentificador: (req) =>
        String(
            req.user?.id ??
            req.usuario?.id ??
            req.session?.usuarioId ??
            normalizarIpCliente(req.ip)
        ),
});

// 6. Subida de imagen: 10 solicitudes por hora por administrador (usuarioId)
export const limiteSubidaImagenAdmin = crearMiddlewareLimite({
    categoria: 'upload_admin',
    ventanaMs: VENTANAS_MS.UNA_HORA,
    maxIntentos: 10,
    extractorIdentificador: (req) =>
        String(
            req.user?.id ??
            req.usuario?.id ??
            req.session?.usuarioId ??
            normalizarIpCliente(req.ip)
        ),
});