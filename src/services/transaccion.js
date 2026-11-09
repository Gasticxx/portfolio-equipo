// Transacción con un mismo client y liberación en finally (apartado 17).
// Si I2 o I5 publican un helper común equivalente, este archivo puede
// reexportarlo sin cambiar los servicios de I6.
export async function conTransaccion(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // La conexión pudo haberse perdido; el error original es el relevante.
    }
    throw err;
  } finally {
    client.release();
  }
}
