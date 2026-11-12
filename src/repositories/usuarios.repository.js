import { pool } from "../config/db.js";

export async function buscarUsuariosRegistrados({
  q,
  activo,
  pageSize,
  offset,
}) {
  // Usamos ! para que %, _ y el propio ! se busquen literalmente.
  const patron = q === undefined ? null : `%${q.replace(/[!%_]/g, "!$&")}%`;

  const { rows } = await pool.query(
    `WITH filtrados AS (
       SELECT id, nombre, email, activo, created_at
       FROM app.usuarios
       WHERE rol = 'registrado'
         AND ($1::boolean IS NULL OR activo = $1)
         AND (
           $2::text IS NULL
           OR nombre ILIKE $2 ESCAPE '!'
           OR email ILIKE $2 ESCAPE '!'
         )
     ), pagina AS (
       SELECT id, nombre, email, activo, created_at
       FROM filtrados
       ORDER BY created_at DESC, id DESC
       LIMIT $3 OFFSET $4
     )
     SELECT p.id, p.nombre, p.email, p.activo,
            p.created_at AS "createdAt", t.total
     FROM (SELECT COUNT(*) AS total FROM filtrados) AS t
     LEFT JOIN pagina AS p ON true
     ORDER BY p.created_at DESC, p.id DESC`,
    [activo ?? null, patron, pageSize, offset],
  );

  // El LEFT JOIN conserva el total incluso si la página pedida está vacía.
  const total = Number(rows[0].total);
  const data =
    rows[0].id === null
      ? []
      : rows.map(({ id, nombre, email, activo, createdAt }) => ({
          id,
          nombre,
          email,
          activo,
          createdAt,
        }));

  return { data, total };
}
