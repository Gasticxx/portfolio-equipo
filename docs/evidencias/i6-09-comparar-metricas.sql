-- I6 09: cifras de control para comparar con GET /api/admin/metricas.
-- Agrupa por fecha de Argentina con un método distinto al del repositorio de I2
-- (convierte cada fila a fecha local en lugar de calcular límites UTC del rango).
-- Uso: psql -U postgres -d portfolio_dev -f docs/evidencias/i6-09-comparar-metricas.sql

\echo '1) Eventos por día (fecha de Argentina)'
SELECT fecha,
       SUM(v) AS visitas,
       SUM(a) AS accesos,
       SUM(c) AS cuentas,
       SUM(g) AS general,
       SUM(k) AS cotizacion,
       SUM(s) AS asesoria
FROM (
  SELECT (iniciada_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS fecha, 1 AS v, 0 AS a, 0 AS c, 0 AS g, 0 AS k, 0 AS s FROM app.visitas
  UNION ALL
  SELECT (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 0, 1, 0, 0, 0, 0 FROM app.accesos
  UNION ALL
  SELECT (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 0, 0, 1, 0, 0, 0 FROM app.usuarios
  UNION ALL
  SELECT (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 0, 0, 0,
         (tipo = 'general')::int, (tipo = 'cotizacion')::int, (tipo = 'asesoria')::int
  FROM app.consultas
) t
GROUP BY fecha
ORDER BY fecha;

\echo '2) Eventos cuya fecha UTC difiere de la de Argentina (después de las 21:00)'
SELECT 'visitas' AS tabla, COUNT(*) AS cantidad FROM app.visitas
 WHERE (iniciada_at AT TIME ZONE 'UTC')::date <> (iniciada_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
UNION ALL
SELECT 'accesos', COUNT(*) FROM app.accesos
 WHERE (created_at AT TIME ZONE 'UTC')::date <> (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
UNION ALL
SELECT 'cuentas', COUNT(*) FROM app.usuarios
 WHERE (created_at AT TIME ZONE 'UTC')::date <> (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date
UNION ALL
SELECT 'consultas', COUNT(*) FROM app.consultas
 WHERE (created_at AT TIME ZONE 'UTC')::date <> (created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::date;

\echo '3) Visitas marcadas como prueba y cuentas por rol'
SELECT 'visitas es_prueba' AS dato, COUNT(*)::text AS valor FROM app.visitas WHERE es_prueba
UNION ALL
SELECT 'cuentas ' || rol, COUNT(*)::text FROM app.usuarios GROUP BY rol;
