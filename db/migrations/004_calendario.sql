-- Nueva experiencia de calendario; conserva las demos existentes y sus tareas.
ALTER TABLE app.demos DROP CONSTRAINT demos_tipo_ck;
ALTER TABLE app.demos ADD CONSTRAINT demos_tipo_ck
  CHECK (tipo IN ('tablero', 'algoritmos', 'calendario'));

INSERT INTO app.demos(proyecto_id,titulo,descripcion,tipo,publicada,orden)
SELECT id, 'Calendario interactivo',
  'Explorá meses y años y descubrí paso a paso cómo se calcula un calendario y cuándo un año es bisiesto.',
  'calendario', true, 3
FROM app.proyectos WHERE publicado=true ORDER BY id LIMIT 1
ON CONFLICT (proyecto_id,tipo) DO NOTHING;
