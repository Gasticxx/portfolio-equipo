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

export const env = validateEnv(process.env);