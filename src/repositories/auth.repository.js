// Funcion que inserta una cuenta en PostgreSQL
export async function crearUsuarioRegistrado(
  pool,
  { nombre, email, passwordHash },
) {
  // El índice único sobre lower(email) decide si el email ya existe.
  const consulta = `
    INSERT INTO app.usuarios (nombre, email, password_hash, rol)
    VALUES ($1, $2, $3, 'registrado')
    ON CONFLICT ((lower(email))) DO NOTHING
    RETURNING id, nombre, email, rol;
  `;

  const valores = [nombre, email, passwordHash];
  const resultado = await pool.query(consulta, valores);

  // Si hubo un conflicto de email, PostgreSQL no devuelve una fila.
  return resultado.rows[0] ?? null;
}

// Busca los datos necesarios para comprobar una sesión autenticada.
export async function buscarUsuarioParaSesion(pool, usuarioId) {
  // Consultamos el estado y el rol actuales del usuario.
  const consulta = `
    SELECT
      id,
      nombre,
      email,
      rol,
      activo,
      version_sesion
    FROM app.usuarios
    WHERE id = $1;
  `;

  // PostgreSQL recibe el identificador separado del texto SQL.
  const resultado = await pool.query(consulta, [usuarioId]);

  // Devolvemos el usuario encontrado o null si ya no existe.
  return resultado.rows[0] ?? null;
}

// Recibe el email ya normalizado por el validador del login.
export async function buscarUsuarioPorEmail(pool, email) {
  const consulta = `
    SELECT
      id,
      nombre,
      email,
      password_hash,
      rol,
      activo,
      version_sesion
    FROM app.usuarios
    WHERE lower(email) = $1;
  `;

  // Usamos la expresión del índice único y un parámetro separado.
  const resultado = await pool.query(consulta, [email]);

  return resultado.rows[0] ?? null;
}

export async function obtenerHashPassword(pool, usuarioId) {
  const { rows } = await pool.query('SELECT password_hash FROM app.usuarios WHERE id = $1 AND activo = true', [usuarioId]);
  return rows[0]?.password_hash ?? null;
}

export async function actualizarPassword(pool, usuarioId, passwordHash) {
  const { rows } = await pool.query(
    `UPDATE app.usuarios SET password_hash = $2, version_sesion = version_sesion + 1, updated_at = now()
     WHERE id = $1 AND activo = true RETURNING id`,
    [usuarioId, passwordHash],
  );
  return rows.length === 1;
}
