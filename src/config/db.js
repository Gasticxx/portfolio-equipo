import pg from 'pg';
import { env } from './env.js';
import { CONSTANTS } from './constants.js';

const { Pool } = pg;

function buildSslConfig() {
    if (!env.DB_SSL) {
        return false;
    }
    const sslConfig = { rejectUnauthorized: true };
    if (env.DB_CA_CERT_BASE64) {
        sslConfig.ca = Buffer.from(env.DB_CA_CERT_BASE64, 'base64').toString('utf8');
    }
    return sslConfig;
}

export const pool = new Pool({
    connectionString: env.IS_TEST && env.TEST_DATABASE_URL ? env.TEST_DATABASE_URL : env.DATABASE_URL,
    ssl: buildSslConfig(),
    max: CONSTANTS.DB.MAX_POOL,
    idleTimeoutMillis: CONSTANTS.DB.IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: CONSTANTS.DB.CONNECTION_TIMEOUT_MS,
    statement_timeout: CONSTANTS.DB.STATEMENT_TIMEOUT_MS,
    lock_timeout: CONSTANTS.DB.LOCK_TIMEOUT_MS,
});

export async function checkDbHealth() {
    const result = await pool.query('SELECT 1 AS ok');
    return result.rows[0]?.ok === 1;
}