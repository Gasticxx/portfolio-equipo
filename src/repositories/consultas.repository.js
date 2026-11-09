// Repositorio SQL del módulo de consultas, respuestas y envíos (I6).
// Único lugar con SQL del módulo; revisión de I5.
// Todas las funciones reciben `db`: el pg.Pool o el client de una transacción.
// Todos los valores van como parámetros $n; columnas y órdenes son constantes.

// Un "enviando" con bloqueo vencido se presenta como "desconocido" (apartado 14.1)
// sin modificar la fila en lecturas: el GET no cambia datos.
const ESTADO_EFECTIVO = (alias) =>
  `CASE WHEN ${alias}.estado = 'enviando' AND ${alias}.bloqueo_hasta < now() THEN 'desconocido' ELSE ${alias}.estado END`;

export function patronBusqueda(q) {
  return `%${q.replace(/[\\%_]/g, '\\$&')}%`;
}

// ---------------------------------------------------------------------------
// Servicios (lectura para validar servicioId y poblar el formulario)
// ---------------------------------------------------------------------------
export async function listarServiciosActivos(db) {
  const { rows } = await db.query(
    `SELECT id, nombre FROM app.servicios WHERE activo = true ORDER BY orden ASC, id ASC`
  );
  return rows;
}

/** Debe llamarse dentro de una transacción: bloquea el servicio contra borrado concurrente. */
export async function buscarServicioActivoParaConsulta(db, servicioId) {
  const { rows } = await db.query(
    `SELECT id, nombre FROM app.servicios WHERE id = $1 AND activo = true FOR SHARE`,
    [servicioId]
  );
  return rows[0] ?? null;
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export async function buscarConsultaPorIdempotencia(db, idempotenciaId) {
  const { rows } = await db.query(
    `SELECT c.id, c.estado, c.idempotencia_actor, c.payload_sha256,
            ${ESTADO_EFECTIVO('e')} AS notificacion_estado
       FROM app.consultas c
       LEFT JOIN app.envios_email e ON e.consulta_id = c.id AND e.clase = 'notificacion'
      WHERE c.idempotencia_id = $1`,
    [idempotenciaId]
  );
  return rows[0] ?? null;
}

export async function insertarConsulta(db, d) {
  const { rows } = await db.query(
    `INSERT INTO app.consultas
       (nombre, email, tipo, asunto, mensaje, consentimiento_at, servicio_id,
        servicio_nombre_snapshot, idempotencia_id, idempotencia_actor, payload_sha256)
     VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8, $9, $10)
     RETURNING id, nombre, email, tipo, asunto, mensaje, estado, servicio_id,
               servicio_nombre_snapshot, created_at`,
    [
      d.nombre, d.email, d.tipo, d.asunto, d.mensaje, d.servicioId, d.servicioNombre,
      d.idempotenciaId, d.idempotenciaActor, d.payloadSha256
    ]
  );
  return rows[0];
}

export async function listarConsultas(db, f) {
  const condiciones = [];
  const params = [];
  if (f.q) {
    params.push(patronBusqueda(f.q));
    const n = params.length;
    condiciones.push(
      `(c.nombre ILIKE $${n} ESCAPE '\\' OR c.email ILIKE $${n} ESCAPE '\\' OR c.asunto ILIKE $${n} ESCAPE '\\')`
    );
  }
  if (f.tipo) {
    params.push(f.tipo);
    condiciones.push(`c.tipo = $${params.length}`);
  }
  if (f.estado) {
    params.push(f.estado);
    condiciones.push(`c.estado = $${params.length}`);
  }
  if (f.notificacionEstado) {
    params.push(f.notificacionEstado);
    condiciones.push(`${ESTADO_EFECTIVO('e')} = $${params.length}`);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const from = `FROM app.consultas c
                LEFT JOIN app.envios_email e ON e.consulta_id = c.id AND e.clase = 'notificacion'`;

  const total = await db.query(`SELECT count(*)::int AS total ${from} ${where}`, params);

  const paginados = [...params, f.pageSize, (f.page - 1) * f.pageSize];
  const { rows } = await db.query(
    `SELECT c.id, c.nombre, c.tipo, c.asunto, c.estado, c.created_at,
            ${ESTADO_EFECTIVO('e')} AS notificacion_estado
       ${from} ${where}
      ORDER BY c.created_at DESC, c.id DESC
      LIMIT $${paginados.length - 1} OFFSET $${paginados.length}`,
    paginados
  );
  return { filas: rows, total: total.rows[0].total };
}

export async function obtenerConsulta(db, id) {
  const { rows } = await db.query(
    `SELECT id, nombre, email, tipo, asunto, mensaje, estado, consentimiento_at,
            servicio_id, servicio_nombre_snapshot, created_at, updated_at
       FROM app.consultas WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/** Dentro de transacción: bloquea la consulta para cambios de estado y respuestas. */
export async function obtenerConsultaParaActualizar(db, id) {
  const { rows } = await db.query(
    `SELECT id, nombre, email, asunto, estado FROM app.consultas WHERE id = $1 FOR UPDATE`,
    [id]
  );
  return rows[0] ?? null;
}

export async function actualizarEstadoConsulta(db, id, estado) {
  const { rows } = await db.query(
    `UPDATE app.consultas SET estado = $2, updated_at = now()
      WHERE id = $1
      RETURNING id, estado, updated_at`,
    [id, estado]
  );
  return rows[0];
}

/** nueva o en_proceso → respondida, solo cuando el proveedor aceptó una respuesta. */
export async function marcarRespondidaSiCorresponde(db, consultaId) {
  await db.query(
    `UPDATE app.consultas SET estado = 'respondida', updated_at = now()
      WHERE id = $1 AND estado IN ('nueva', 'en_proceso')`,
    [consultaId]
  );
}

// ---------------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------------
export async function buscarRespuestaPorIdempotencia(db, idempotenciaId) {
  const { rows } = await db.query(
    `SELECT r.id, r.consulta_id, r.autor_id, r.payload_sha256, r.created_at,
            ${ESTADO_EFECTIVO('e')} AS envio_estado
       FROM app.respuestas r
       LEFT JOIN app.envios_email e ON e.respuesta_id = r.id
      WHERE r.idempotencia_id = $1`,
    [idempotenciaId]
  );
  return rows[0] ?? null;
}

export async function insertarRespuesta(db, d) {
  const { rows } = await db.query(
    `INSERT INTO app.respuestas (consulta_id, autor_id, mensaje, idempotencia_id, payload_sha256)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [d.consultaId, d.autorId, d.mensaje, d.idempotenciaId, d.payloadSha256]
  );
  return rows[0];
}

export async function listarRespuestas(db, consultaId) {
  const { rows } = await db.query(
    `SELECT r.id, r.mensaje, r.created_at, r.autor_id, u.nombre AS autor_nombre,
            e.id AS envio_id
       FROM app.respuestas r
       JOIN app.usuarios u ON u.id = r.autor_id
       LEFT JOIN app.envios_email e ON e.respuesta_id = r.id
      WHERE r.consulta_id = $1
      ORDER BY r.created_at ASC, r.id ASC`,
    [consultaId]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// Envíos de email
// ---------------------------------------------------------------------------
export async function insertarEnvio(db, d) {
  const { rows } = await db.query(
    `INSERT INTO app.envios_email (consulta_id, respuesta_id, clase, destinatario, asunto, cuerpo)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, estado`,
    [d.consultaId, d.respuestaId ?? null, d.clase, d.destinatario, d.asunto, d.cuerpo]
  );
  return rows[0];
}

const COLUMNAS_ENVIO = `e.id, e.consulta_id, e.respuesta_id, e.clase, e.destinatario, e.asunto,
       e.estado AS estado_guardado, ${ESTADO_EFECTIVO('e')} AS estado, e.intentos,
       e.proveedor_id, e.error_codigo, e.bloqueo_hasta, e.created_at, e.updated_at,
       now() AS ahora`;

export async function listarEnvios(db, consultaId) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_ENVIO}
       FROM app.envios_email e
      WHERE e.consulta_id = $1
      ORDER BY e.created_at ASC, e.id ASC`,
    [consultaId]
  );
  return rows;
}

export async function obtenerEnvio(db, envioId) {
  const { rows } = await db.query(`SELECT ${COLUMNAS_ENVIO} FROM app.envios_email e WHERE e.id = $1`, [envioId]);
  return rows[0] ?? null;
}

/**
 * Dentro de transacción: bloquea la fila del envío e incluye los datos de la
 * consulta necesarios para armar el mensaje (replyTo de la notificación).
 */
export async function obtenerEnvioParaActualizar(db, envioId) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_ENVIO}, e.cuerpo, c.nombre AS consulta_nombre, c.email AS consulta_email
       FROM app.envios_email e
       JOIN app.consultas c ON c.id = e.consulta_id
      WHERE e.id = $1
      FOR UPDATE OF e`,
    [envioId]
  );
  return rows[0] ?? null;
}

/** "enviando" con bloqueo vencido pasa a "desconocido" antes de permitir otra acción. */
export async function convertirEnviandoVencido(db, envioId) {
  await db.query(
    `UPDATE app.envios_email
        SET estado = 'desconocido', error_codigo = COALESCE(error_codigo, 'BLOQUEO_VENCIDO'), updated_at = now()
      WHERE id = $1 AND estado = 'enviando' AND bloqueo_hasta < now()`,
    [envioId]
  );
}

/** Reclama el envío: pasa a enviando, suma un intento y fija el bloqueo. */
export async function marcarEnviando(db, envioId, bloqueoSegundos) {
  const { rows } = await db.query(
    `UPDATE app.envios_email
        SET estado = 'enviando', intentos = intentos + 1,
            bloqueo_hasta = now() + make_interval(secs => $2), updated_at = now()
      WHERE id = $1
      RETURNING intentos`,
    [envioId, bloqueoSegundos]
  );
  return rows[0];
}

/**
 * Guarda el resultado del proveedor solo si la fila sigue en "enviando".
 * bloqueo_hasta se conserva: marca el inicio del último intento (bloqueo_hasta
 * menos la duración del bloqueo) y solo tiene efecto mientras estado=enviando.
 */
export async function guardarResultadoEnvio(db, envioId, r) {
  const { rows } = await db.query(
    `UPDATE app.envios_email
        SET estado = $2, proveedor_id = $3, error_codigo = $4, updated_at = now()
      WHERE id = $1 AND estado = 'enviando'
      RETURNING id, consulta_id, clase, estado`,
    [envioId, r.estado, r.proveedorId ?? null, r.errorCodigo ?? null]
  );
  return rows[0] ?? null;
}
