-- Habilita la demo sin alterar proyectos, tareas ni experiencias existentes.
ALTER TABLE app.demos DROP CONSTRAINT demos_tipo_ck;
ALTER TABLE app.demos ADD CONSTRAINT demos_tipo_ck
  CHECK (tipo IN ('tablero', 'algoritmos', 'calendario', 'ondas'));

-- La experiencia queda vinculada al portfolio original, si ya está publicado.
INSERT INTO app.demos(proyecto_id,titulo,descripcion,tipo,publicada,orden)
SELECT id, 'Laboratorio de ondas',
  'Creá y mové emisores, ajustá frecuencia, amplitud y propagación y descubrí cómo las ondas se refuerzan o se cancelan en tiempo real.',
  'ondas', true, 4
FROM app.proyectos WHERE slug='portfolio-equipo' AND publicado=true
ON CONFLICT (proyecto_id,tipo) DO NOTHING;
