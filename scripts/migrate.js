// Ejecuta, en orden, las migraciones SQL pendientes de db/migrations.
//
// Uso:
//   npm run db:migrate                                  (lee .env)
//   node --env-file=.env.test scripts/migrate.js        (migra portfolio_test)
//   node --env-file=.env scripts/migrate.js --listar    (solo muestra qué haría)
//
// Reglas (apartado 6 de la especificación):
//   - Usa MIGRATION_DATABASE_URL, la URL de administración.
//   - Toma un bloqueo asesor exclusivo para que dos personas no migren a la vez.
//   - Ordena los archivos por nombre (001_base.sql, 002_..., 003_...).
//   - Cada archivo y su registro en app.schema_migrations van en UNA transacción:
//     si algo falla, no queda nada a medias.
//   - Una migración ya integrada no se edita: se agrega otra.
//   - Este script nunca elimina tablas para empezar de nuevo.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA_MIGRACIONES = path.join(RAIZ, 'db', 'migrations');

// Número cualquiera pero fijo: identifica "las migraciones de este proyecto".
const CLAVE_BLOQUEO = 540_170_001;

// 001_base.sql, 002_sesiones_visitas_limites.sql, ...
const NOMBRE_VALIDO = /^(\d{3,})_[a-z0-9_]+\.sql$/;

// El script ya abre y cierra la transacción: la migración no debe hacerlo.
const CONTROL_TRANSACCION = /^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\b/im;

function leerConfiguracion() {
  const url = (process.env.MIGRATION_DATABASE_URL || '').trim();
  if (!url) {
    throw new Error(
      'Falta MIGRATION_DATABASE_URL. Copiá .env.example a .env y completala ' +
        '(o usá --env-file=.env.test para la base de pruebas).',
    );
  }

  // Se muestra solo servidor y base; la contraseña nunca se imprime.
  let destino;
  try {
    const u = new URL(url);
    const base = decodeURIComponent(u.pathname.replace(/^\//, ''));
    const esLocal = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
    destino = `${esLocal ? 'local' : 'REMOTO'}: ${u.hostname}:${u.port || '5432'}/${base}`;
  } catch {
    throw new Error('MIGRATION_DATABASE_URL no tiene un formato de URL válido.');
  }

  // Mismo criterio que src/config/db.js.
  const usarSsl = (process.env.DB_SSL || '').trim().toLowerCase() === 'true';
  const ca = (process.env.DB_CA_CERT_BASE64 || '').trim();
  let ssl = false;
  if (usarSsl) {
    ssl = { rejectUnauthorized: true };
    if (ca) ssl.ca = Buffer.from(ca, 'base64').toString('utf8');
  }

  return { url, ssl, destino };
}

async function listarMigraciones() {
  let entradas;
  try {
    entradas = await readdir(CARPETA_MIGRACIONES);
  } catch {
    throw new Error(`No se encontró la carpeta ${CARPETA_MIGRACIONES}.`);
  }

  // Los demás archivos (.gitkeep, notas) se ignoran; todo .sql debe tener nombre válido.
  const archivos = entradas.filter((nombre) => nombre.toLowerCase().endsWith('.sql'));
  const invalidos = archivos.filter((nombre) => !NOMBRE_VALIDO.test(nombre));
  if (invalidos.length > 0) {
    throw new Error(
      `Nombre de migración inválido: ${invalidos.join(', ')}. ` +
        'Usá el formato 003_descripcion_en_minusculas.sql.',
    );
  }

  const migraciones = archivos
    .map((nombre) => ({
      nombre,
      numero: Number.parseInt(NOMBRE_VALIDO.exec(nombre)[1], 10),
      ruta: path.join(CARPETA_MIGRACIONES, nombre),
    }))
    .sort((a, b) => a.numero - b.numero);

  // Dos archivos con el mismo número = orden ambiguo (típico de dos ramas en paralelo).
  for (let i = 1; i < migraciones.length; i += 1) {
    if (migraciones[i].numero === migraciones[i - 1].numero) {
      throw new Error(
        `Dos migraciones comparten el número ${migraciones[i].numero}: ` +
          `${migraciones[i - 1].nombre} y ${migraciones[i].nombre}. Renumerá una.`,
      );
    }
  }

  return migraciones;
}

async function leerAplicadas(client) {
  // En una base vacía la tabla todavía no existe: la crea 001_base.sql.
  const { rows: existe } = await client.query(
    "SELECT to_regclass('app.schema_migrations') AS tabla",
  );
  if (!existe[0].tabla) return new Set();

  const { rows } = await client.query('SELECT version FROM app.schema_migrations');
  return new Set(rows.map((fila) => fila.version));
}

async function aplicar(client, migracion) {
  let sql = await readFile(migracion.ruta, 'utf8');
  sql = sql.replace(/^\uFEFF/, ''); // algunos editores de Windows agregan un BOM

  if (sql.trim() === '') {
    throw new Error(`${migracion.nombre} está vacía.`);
  }
  if (CONTROL_TRANSACCION.test(sql)) {
    throw new Error(
      `${migracion.nombre} contiene BEGIN/COMMIT/ROLLBACK. Quitalos: ` +
        'el script ya ejecuta cada archivo dentro de una transacción.',
    );
  }

  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query('INSERT INTO app.schema_migrations (version) VALUES ($1)', [
      migracion.nombre,
    ]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    const detalle = error.detail ? ` Detalle: ${error.detail}` : '';
    throw new Error(
      `${migracion.nombre} falló y se deshizo por completo. ${error.message}.${detalle}`,
      { cause: error },
    );
  }
}

async function main() {
  const soloListar = process.argv.includes('--listar');
  const migraciones = await listarMigraciones();
  const { url, ssl, destino } = leerConfiguracion();

  console.log(`Destino: ${destino}`);

  const client = new Client({
    connectionString: url,
    ssl,
    connectionTimeoutMillis: 10_000,
    application_name: 'portfolio-migrate',
  });
  await client.connect();

  let bloqueado = false;
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [
      CLAVE_BLOQUEO,
    ]);
    if (!rows[0].ok) {
      throw new Error(
        'Otra persona o proceso está migrando esta base ahora mismo. Esperá y reintentá.',
      );
    }
    bloqueado = true;

    const aplicadas = await leerAplicadas(client);
    const conocidas = new Set(migraciones.map((m) => m.nombre));

    const desconocidas = [...aplicadas].filter((v) => !conocidas.has(v));
    if (desconocidas.length > 0) {
      console.warn(
        `Aviso: la base tiene migraciones que tu carpeta no tiene (${desconocidas.join(', ')}). ` +
          'Actualizá tu rama (git pull) antes de seguir.',
      );
    }

    const pendientes = migraciones.filter((m) => !aplicadas.has(m.nombre));

    // Una pendiente con número menor a otra ya aplicada se ejecutaría fuera de orden.
    const mayorAplicado = Math.max(
      0,
      ...migraciones.filter((m) => aplicadas.has(m.nombre)).map((m) => m.numero),
    );
    const fueraDeOrden = pendientes.filter((m) => m.numero < mayorAplicado);
    if (fueraDeOrden.length > 0) {
      throw new Error(
        `Hay migraciones pendientes anteriores a una ya aplicada: ${fueraDeOrden
          .map((m) => m.nombre)
          .join(', ')}. No se ejecutan fuera de orden; renumerala con un número mayor.`,
      );
    }

    if (soloListar) {
      for (const m of migraciones) {
        console.log(`${aplicadas.has(m.nombre) ? 'aplicada ' : 'PENDIENTE'}  ${m.nombre}`);
      }
      return;
    }

    if (pendientes.length === 0) {
      console.log('La base ya está al día. No hay migraciones pendientes.');
      return;
    }

    for (const m of pendientes) {
      await aplicar(client, m);
      console.log(`Aplicada: ${m.nombre}`);
    }
    console.log(`Listo: ${pendientes.length} migración(es) aplicada(s).`);
  } finally {
    if (bloqueado) {
      await client.query('SELECT pg_advisory_unlock($1)', [CLAVE_BLOQUEO]).catch(() => {});
    }
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});