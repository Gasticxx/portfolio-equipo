// Carga los datos iniciales del portfolio (apartado 20 de la especificación).
//
// Uso:
//   npm run db:seed                                   (lee .env)
//   node --env-file=.env.test scripts/seed.js         (carga portfolio_test)
//
// Reglas:
//   - Se puede ejecutar todas las veces que haga falta: solo carga lo que falta y
//     NO restablece textos, publicaciones ni estados que el equipo ya cambió.
//   - Todo se carga en UNA transacción: si algo falla, no queda nada a medias.
//   - Los IDs se obtienen por slug o nombre; nunca se supone que empiezan en 1.
//   - No crea cuentas ni contraseñas (eso lo hace npm run cuenta:crear).
//   - Requiere que las migraciones ya estén aplicadas (npm run db:migrate).

import pg from 'pg';
import {
  APORTES,
  DEMOS,
  MIEMBROS,
  PROYECTO,
  SERVICIOS,
  TECNOLOGIAS,
} from '../db/seeds/contenido.js';

const { Client } = pg;

// El mismo número que usa migrate.js: seed y migraciones no corren a la vez.
const CLAVE_BLOQUEO = 540_170_001;

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

// Cada paso devuelve cuántas filas nuevas cargó.
async function cargarTecnologias(client) {
  let nuevas = 0;
  for (const nombre of TECNOLOGIAS) {
    // Los duplicados se comparan sin distinguir mayúsculas (índice sobre lower(nombre)).
    const r = await client.query(
      'INSERT INTO app.tecnologias (nombre) VALUES ($1) ON CONFLICT ((lower(nombre))) DO NOTHING',
      [nombre],
    );
    nuevas += r.rowCount;
  }
  return nuevas;
}

async function cargarMiembros(client) {
  let nuevos = 0;
  for (const m of MIEMBROS) {
    const r = await client.query(
      `INSERT INTO app.miembros
         (slug, nombre, especialidad, presentacion, formacion, github_url, linkedin_url, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (slug) DO NOTHING`,
      [m.slug, m.nombre, m.especialidad, m.presentacion, m.formacion, m.githubUrl, m.linkedinUrl, m.orden],
    );
    nuevos += r.rowCount;
  }
  return nuevos;
}

async function cargarProyecto(client) {
  const r = await client.query(
    `INSERT INTO app.proyectos (slug, titulo, resumen, descripcion, estado, publicado)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (slug) DO NOTHING`,
    [PROYECTO.slug, PROYECTO.titulo, PROYECTO.resumen, PROYECTO.descripcion, PROYECTO.estado, PROYECTO.publicado],
  );

  // Las tecnologías se vinculan solo cuando el proyecto se crea ahora:
  // si ya existía, el equipo pudo cambiarlas y no se restablecen.
  let tecnologias = 0;
  if (r.rowCount === 1) {
    const t = await client.query(
      `INSERT INTO app.proyecto_tecnologia (proyecto_id, tecnologia_id)
       SELECT p.id, t.id
       FROM app.proyectos p
       JOIN app.tecnologias t ON lower(t.nombre) = ANY($2::text[])
       WHERE p.slug = $1
       ON CONFLICT DO NOTHING`,
      [PROYECTO.slug, PROYECTO.tecnologias.map((n) => n.toLowerCase())],
    );
    tecnologias = t.rowCount;
  }
  return { proyecto: r.rowCount, tecnologias };
}

async function cargarDemos(client) {
  let nuevas = 0;
  for (const d of DEMOS) {
    // Nacen sin publicar (publicada = false).
    const r = await client.query(
      `INSERT INTO app.demos (proyecto_id, titulo, descripcion, tipo, publicada, orden)
       SELECT p.id, $2, $3, $4, false, $5 FROM app.proyectos p WHERE p.slug = $1
       ON CONFLICT (proyecto_id, tipo) DO NOTHING`,
      [PROYECTO.slug, d.titulo, d.descripcion, d.tipo, d.orden],
    );
    nuevas += r.rowCount;
  }
  return nuevas;
}

async function cargarServicios(client) {
  // La tabla no tiene una clave natural única, así que se cargan los tres servicios
  // solo si todavía no hay ninguno. Así no reaparece un servicio que el equipo
  // renombró o eliminó desde su administración.
  const { rows } = await client.query('SELECT count(*)::int AS total FROM app.servicios');
  if (rows[0].total > 0) return 0;

  for (const s of SERVICIOS) {
    await client.query(
      `INSERT INTO app.servicios (nombre, descripcion, categoria, activo, orden)
       VALUES ($1, $2, $3, true, $4)`,
      [s.nombre, s.descripcion, s.categoria, s.orden],
    );
  }
  return SERVICIOS.length;
}

async function cargarAportes(client) {
  let nuevos = 0;
  for (const a of APORTES) {
    // Solo si ese integrante todavía no tiene ningún aporte en el proyecto:
    // así no se vuelve a crear uno cuyo título el equipo ya editó.
    const r = await client.query(
      `INSERT INTO app.aportes (proyecto_id, miembro_id, titulo, descripcion, estado)
       SELECT p.id, m.id, $3, $4, 'asignado'
       FROM app.proyectos p, app.miembros m
       WHERE p.slug = $1 AND m.slug = $2
         AND NOT EXISTS (
           SELECT 1 FROM app.aportes x WHERE x.proyecto_id = p.id AND x.miembro_id = m.id
         )`,
      [PROYECTO.slug, a.miembro, a.titulo, a.descripcion],
    );
    nuevos += r.rowCount;
  }
  return nuevos;
}

async function main() {
  const { url, ssl, destino } = leerConfiguracion();
  console.log(`Destino: ${destino}`);

  const client = new Client({
    connectionString: url,
    ssl,
    connectionTimeoutMillis: 10_000,
    application_name: 'portfolio-seed',
  });
  await client.connect();

  let bloqueado = false;
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [CLAVE_BLOQUEO]);
    if (!rows[0].ok) {
      throw new Error(
        'Otra persona o proceso está migrando o cargando datos ahora mismo. Esperá y reintentá.',
      );
    }
    bloqueado = true;

    const { rows: existe } = await client.query("SELECT to_regclass('app.miembros') AS tabla");
    if (!existe[0].tabla) {
      throw new Error('Las tablas todavía no existen. Ejecutá primero: npm run db:migrate');
    }

    await client.query('BEGIN');
    let resumen;
    try {
      const tecnologias = await cargarTecnologias(client);
      const miembros = await cargarMiembros(client);
      const { proyecto, tecnologias: vinculos } = await cargarProyecto(client);
      const demos = await cargarDemos(client);
      const servicios = await cargarServicios(client);
      const aportes = await cargarAportes(client);
      await client.query('COMMIT');
      resumen = { tecnologias, miembros, proyecto, vinculos, demos, servicios, aportes };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      const detalle = error.detail ? ` Detalle: ${error.detail}` : '';
      throw new Error(`La carga falló y se deshizo por completo. ${error.message}.${detalle}`, {
        cause: error,
      });
    }

    const filas = [
      ['tecnologías', resumen.tecnologias],
      ['miembros', resumen.miembros],
      ['proyecto', resumen.proyecto],
      ['tecnologías del proyecto', resumen.vinculos],
      ['demos', resumen.demos],
      ['servicios', resumen.servicios],
      ['aportes', resumen.aportes],
    ];
    const total = filas.reduce((suma, [, n]) => suma + n, 0);
    for (const [nombre, n] of filas) console.log(`  ${nombre}: ${n} nuevo(s)`);
    console.log(
      total === 0
        ? 'No había nada que cargar: los datos iniciales ya estaban completos.'
        : `Listo: ${total} registro(s) nuevo(s).`,
    );
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