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
