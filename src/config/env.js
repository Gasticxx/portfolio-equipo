const REQUIRED_BASE_VARS = [
    'NODE_ENV',
    'PORT',
    'APP_ORIGIN',
    'DATABASE_URL',
    'DB_SSL',
    'SESSION_SECRET',
    'VISIT_SECRET',
];

const REQUIRED_PRODUCTION_VARS = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_STORAGE_BUCKET',
    'BREVO_API_KEY',
    'MAIL_FROM_EMAIL',
    'MAIL_FROM_NAME',
    'CONTACT_TO_EMAIL',
];

export function validateEnv(source = process.env) {
    const missing = [];

    for (const key of REQUIRED_BASE_VARS) {
        const val = source[key];
        if (typeof val !== 'string' || val.trim() === '') {
            missing.push(key);
        }
    }

    if (source.NODE_ENV === 'production') {
        for (const key of REQUIRED_PRODUCTION_VARS) {
            const val = source[key];
            if (typeof val !== 'string' || val.trim() === '') {
                missing.push(key);
            }
        }
    }

    if (missing.length > 0) {
        throw new Error(
        `[config] Faltan variables de entorno obligatorias: ${missing.join(', ')}`
        );
    }

    if (source.SESSION_SECRET === source.VISIT_SECRET) {
        throw new Error(
        '[config] VISIT_SECRET debe ser distinto de SESSION_SECRET'
        );
    }

    const port = Number.parseInt(source.PORT, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('[config] La variable PORT debe ser un entero valido');
    }

    return Object.freeze({
        NODE_ENV: source.NODE_ENV.trim(),
        IS_PROD: source.NODE_ENV.trim() === 'production',
        IS_TEST: source.NODE_ENV.trim() === 'test',
        PORT: port,
        APP_ORIGIN: source.APP_ORIGIN.trim().replace(/\/+$/, ''),
        DATABASE_URL: source.DATABASE_URL.trim(),
        DB_SSL: source.DB_SSL.trim().toLowerCase() === 'true',
        DB_CA_CERT_BASE64: (source.DB_CA_CERT_BASE64 || '').trim(),
        MIGRATION_DATABASE_URL: (source.MIGRATION_DATABASE_URL || '').trim(),
        TEST_DATABASE_URL: (source.TEST_DATABASE_URL || '').trim(),
        SESSION_SECRET: source.SESSION_SECRET.trim(),
        VISIT_SECRET: source.VISIT_SECRET.trim(),
        SUPABASE_URL: (source.SUPABASE_URL || '').trim(),
        SUPABASE_SERVICE_ROLE_KEY: (source.SUPABASE_SERVICE_ROLE_KEY || '').trim(),
        SUPABASE_STORAGE_BUCKET: (source.SUPABASE_STORAGE_BUCKET || 'portfolio-media').trim(),
        BREVO_API_KEY: (source.BREVO_API_KEY || '').trim(),
        MAIL_FROM_EMAIL: (source.MAIL_FROM_EMAIL || '').trim(),
        MAIL_FROM_NAME: (source.MAIL_FROM_NAME || 'Equipo Seis').trim(),
        CONTACT_TO_EMAIL: (source.CONTACT_TO_EMAIL || '').trim(),
    });
}
const DEV_SESSION_SECRET = 'dev-session-secret-para-local-123456789';
const DEV_VISIT_SECRET = 'dev-visit-secret-para-local-987654321';
const TEST_SESSION_SECRET = 'test-session-secret-para-integracion-123456789';
const TEST_VISIT_SECRET = 'test-visit-secret-para-integracion-987654321';

function applyLocalDefaults(source = process.env) {
    const normalized = { ...source };
    const nodeEnv = (normalized.NODE_ENV || 'development').trim();

    if (!normalized.NODE_ENV) normalized.NODE_ENV = nodeEnv;
    if (!normalized.PORT) normalized.PORT = '3000';
    if (!normalized.APP_ORIGIN) normalized.APP_ORIGIN = 'http://localhost:3000';
    if (!normalized.DATABASE_URL) {
        normalized.DATABASE_URL =
            nodeEnv === 'test'
                ? 'postgresql://localhost:5432/portfolio_test'
                : 'postgresql://localhost:5432/portfolio_dev';
    }
    if (!normalized.DB_SSL) normalized.DB_SSL = 'false';

    if (nodeEnv !== 'production') {
        if (!normalized.SESSION_SECRET) {
            normalized.SESSION_SECRET =
                nodeEnv === 'test' ? TEST_SESSION_SECRET : DEV_SESSION_SECRET;
        }
        if (!normalized.VISIT_SECRET) {
            normalized.VISIT_SECRET =
                nodeEnv === 'test' ? TEST_VISIT_SECRET : DEV_VISIT_SECRET;
        }
    }

    return normalized;
}

const isUnitTest =
    process.env.npm_lifecycle_event === 'test:unit' ||
    process.execArgv.some((arg) => arg.startsWith('--test'));

const envSource = isUnitTest ? applyLocalDefaults(process.env) : applyLocalDefaults(process.env);

export const env = validateEnv(envSource);