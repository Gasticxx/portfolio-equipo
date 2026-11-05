// Funcion que inserta una cuenta en PostgreSQL

export async function crearUsuarioRegistrado(
  pool,
  { nombre, email, passwordHash },
) {
  // El registro público siempre crea cuentas con el rol registrado.
  const consulta = `
    INSERT INTO app.usuarios (nombre, email, password_hash, rol)
    VALUES ($1, $2, $3, 'registrado')
    RETURNING id, nombre, email, rol;
  `;

  // Enviamos los valores por separado para que PostgreSQL los trate como datos.
  const valores = [nombre, email, passwordHash];

  // Esperamos la inserción y obtenemos la cuenta que acaba de crearse.
  const resultado = await pool.query(consulta, valores);

  return resultado.rows[0];
}
