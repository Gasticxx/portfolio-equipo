-- 003_contenido.sql
-- Modelo de datos cerrado, apartados 10.1, 10.2, 10.3 (tareas_demo) y 10.4 de la especificación.
-- Requiere 001_base.sql (app.usuarios). No depende de 002.
-- Convenciones: unicidad "<tabla>_<campos>_uk", CHECK "<tabla>_<campo>_ck",
-- índices comunes "idx_<tabla>_<campos>" (mismo estilo que 002).

-- ---------------------------------------------------------------------------
-- 10.1 Miembros, tecnologías y contribuciones
-- ---------------------------------------------------------------------------

CREATE TABLE app.tecnologias (
  id     INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  nombre VARCHAR(40) NOT NULL,
  CONSTRAINT tecnologias_nombre_uk UNIQUE (nombre)
);
-- Los duplicados se comparan sin distinguir mayúsculas.
CREATE UNIQUE INDEX tecnologias_nombre_lower_uk ON app.tecnologias (lower(nombre));

CREATE TABLE app.miembros (
  id           INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  slug         VARCHAR(40)   NOT NULL,
  nombre       VARCHAR(80)   NOT NULL,
  especialidad VARCHAR(80)   NOT NULL,
  presentacion VARCHAR(600)  NOT NULL,
  formacion    VARCHAR(1000) NOT NULL,
  github_url   VARCHAR(200),
  linkedin_url VARCHAR(200),
  orden        SMALLINT      NOT NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT miembros_slug_uk  UNIQUE (slug),
  CONSTRAINT miembros_orden_uk UNIQUE (orden),
  CONSTRAINT miembros_orden_ck CHECK (orden BETWEEN 1 AND 6)
);

CREATE TABLE app.miembro_tecnologia (
  miembro_id    INTEGER NOT NULL REFERENCES app.miembros(id)    ON DELETE RESTRICT,
  tecnologia_id INTEGER NOT NULL REFERENCES app.tecnologias(id) ON DELETE RESTRICT,
  PRIMARY KEY (miembro_id, tecnologia_id)
);

-- ---------------------------------------------------------------------------
-- 10.2 Archivos, proyectos, demos y servicios
-- (archivos va antes que proyectos: proyectos.portada_id apunta a archivos)
-- ---------------------------------------------------------------------------

CREATE TABLE app.archivos (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  object_path VARCHAR(200) NOT NULL,
  mime        VARCHAR(30)  NOT NULL,
  bytes       INTEGER      NOT NULL,
  ancho       INTEGER      NOT NULL,
  alto        INTEGER      NOT NULL,
  creado_por  INTEGER      NOT NULL REFERENCES app.usuarios(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT archivos_object_path_uk UNIQUE (object_path),
  CONSTRAINT archivos_mime_ck  CHECK (mime = 'image/webp'),
  CONSTRAINT archivos_bytes_ck CHECK (bytes BETWEEN 1 AND 5242880),
  CONSTRAINT archivos_ancho_ck CHECK (ancho BETWEEN 1 AND 2400),
  CONSTRAINT archivos_alto_ck  CHECK (alto BETWEEN 1 AND 2400)
);

CREATE TABLE app.proyectos (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  slug            VARCHAR(80)  NOT NULL,
  titulo          VARCHAR(100) NOT NULL,
  resumen         VARCHAR(250) NOT NULL,
  descripcion     TEXT         NOT NULL,
  estado          VARCHAR(15)  NOT NULL,
  publicado       BOOLEAN      NOT NULL DEFAULT false,
  portada_id      INTEGER      REFERENCES app.archivos(id) ON DELETE RESTRICT,
  repositorio_url VARCHAR(300),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT proyectos_slug_uk        UNIQUE (slug),
  CONSTRAINT proyectos_descripcion_ck CHECK (char_length(descripcion) <= 5000),
  CONSTRAINT proyectos_estado_ck      CHECK (estado IN ('desarrollo', 'terminado'))
);
CREATE INDEX idx_proyectos_publicado_created_at ON app.proyectos (publicado, created_at);

CREATE TABLE app.proyecto_tecnologia (
  proyecto_id   INTEGER NOT NULL REFERENCES app.proyectos(id)   ON DELETE CASCADE,
  tecnologia_id INTEGER NOT NULL REFERENCES app.tecnologias(id) ON DELETE RESTRICT,
  PRIMARY KEY (proyecto_id, tecnologia_id)
);

-- La participación de un miembro en un proyecto se obtiene de sus aportes distintos.
CREATE TABLE app.aportes (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  proyecto_id   INTEGER       NOT NULL REFERENCES app.proyectos(id) ON DELETE CASCADE,
  miembro_id    INTEGER       NOT NULL REFERENCES app.miembros(id)  ON DELETE RESTRICT,
  titulo        VARCHAR(100)  NOT NULL,
  descripcion   VARCHAR(1000) NOT NULL,
  estado        VARCHAR(15)   NOT NULL,
  evidencia_url VARCHAR(300),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT aportes_proyecto_miembro_titulo_uk UNIQUE (proyecto_id, miembro_id, titulo),
  CONSTRAINT aportes_estado_ck CHECK (estado IN ('asignado', 'desarrollo', 'comprobado'))
);
CREATE INDEX idx_aportes_miembro_proyecto ON app.aportes (miembro_id, proyecto_id);

CREATE TABLE app.aporte_tecnologia (
  aporte_id     INTEGER NOT NULL REFERENCES app.aportes(id)     ON DELETE CASCADE,
  tecnologia_id INTEGER NOT NULL REFERENCES app.tecnologias(id) ON DELETE RESTRICT,
  PRIMARY KEY (aporte_id, tecnologia_id)
);

CREATE TABLE app.demos (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  proyecto_id INTEGER       NOT NULL REFERENCES app.proyectos(id) ON DELETE RESTRICT,
  titulo      VARCHAR(100)  NOT NULL,
  descripcion VARCHAR(1000) NOT NULL,
  tipo        VARCHAR(20)   NOT NULL,
  publicada   BOOLEAN       NOT NULL DEFAULT false,
  orden       SMALLINT      NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT demos_proyecto_tipo_uk UNIQUE (proyecto_id, tipo),
  CONSTRAINT demos_tipo_ck  CHECK (tipo IN ('tablero', 'algoritmos')),
  CONSTRAINT demos_orden_ck CHECK (orden BETWEEN 1 AND 100)
);
CREATE INDEX idx_demos_proyecto_publicada ON app.demos (proyecto_id, publicada);

CREATE TABLE app.servicios (
  id          INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  nombre      VARCHAR(80)   NOT NULL,
  descripcion VARCHAR(1000) NOT NULL,
  categoria   VARCHAR(30)   NOT NULL,
  activo      BOOLEAN       NOT NULL DEFAULT true,
  orden       SMALLINT      NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  CONSTRAINT servicios_categoria_ck CHECK (categoria IN ('web', 'mantenimiento', 'asesoria')),
  CONSTRAINT servicios_orden_ck     CHECK (orden BETWEEN 1 AND 100)
);

-- ---------------------------------------------------------------------------
-- 10.3 Tareas de la demo "tablero"
-- ---------------------------------------------------------------------------

CREATE TABLE app.tareas_demo (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  demo_id    INTEGER      NOT NULL REFERENCES app.demos(id)    ON DELETE CASCADE,
  usuario_id INTEGER      NOT NULL REFERENCES app.usuarios(id) ON DELETE RESTRICT,
  titulo     VARCHAR(80)  NOT NULL,
  estado     VARCHAR(15)  NOT NULL DEFAULT 'pendiente',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT tareas_demo_estado_ck CHECK (estado IN ('pendiente', 'progreso', 'completada'))
);
CREATE INDEX idx_tareas_demo_demo_usuario_id ON app.tareas_demo (demo_id, usuario_id, id);

-- ---------------------------------------------------------------------------
-- 10.4 Consultas, respuestas y envíos de correo
-- ---------------------------------------------------------------------------

CREATE TABLE app.consultas (
  id                       INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  nombre                   VARCHAR(80)  NOT NULL,
  email                    VARCHAR(254) NOT NULL,
  tipo                     VARCHAR(15)  NOT NULL,
  asunto                   VARCHAR(120) NOT NULL,
  mensaje                  TEXT         NOT NULL,
  consentimiento_at        TIMESTAMPTZ  NOT NULL,
  estado                   VARCHAR(15)  NOT NULL DEFAULT 'nueva',
  servicio_id              INTEGER      REFERENCES app.servicios(id) ON DELETE SET NULL,
  servicio_nombre_snapshot VARCHAR(80),
  idempotencia_id          UUID         NOT NULL,
  idempotencia_actor       CHAR(64)     NOT NULL,
  payload_sha256           CHAR(64)     NOT NULL,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT consultas_idempotencia_uk UNIQUE (idempotencia_id),
  CONSTRAINT consultas_tipo_ck    CHECK (tipo IN ('general', 'cotizacion', 'asesoria')),
  CONSTRAINT consultas_estado_ck  CHECK (estado IN ('nueva', 'en_proceso', 'respondida', 'cerrada')),
  CONSTRAINT consultas_mensaje_ck CHECK (char_length(mensaje) <= 3000)
);
CREATE INDEX idx_consultas_created_at        ON app.consultas (created_at);
CREATE INDEX idx_consultas_tipo_created_at   ON app.consultas (tipo, created_at);
CREATE INDEX idx_consultas_estado_created_at ON app.consultas (estado, created_at);

-- Una respuesta enviada no se edita ni se borra: por eso no tiene updated_at.
CREATE TABLE app.respuestas (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  consulta_id     INTEGER     NOT NULL REFERENCES app.consultas(id) ON DELETE RESTRICT,
  autor_id        INTEGER     NOT NULL REFERENCES app.usuarios(id)  ON DELETE RESTRICT,
  mensaje         TEXT        NOT NULL,
  idempotencia_id UUID        NOT NULL,
  payload_sha256  CHAR(64)    NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT respuestas_idempotencia_uk UNIQUE (idempotencia_id),
  CONSTRAINT respuestas_mensaje_ck CHECK (char_length(mensaje) <= 3000)
);
CREATE INDEX idx_respuestas_consulta_created_at ON app.respuestas (consulta_id, created_at);

CREATE TABLE app.envios_email (
  id            INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  consulta_id   INTEGER      NOT NULL REFERENCES app.consultas(id)  ON DELETE RESTRICT,
  respuesta_id  INTEGER      REFERENCES app.respuestas(id) ON DELETE RESTRICT,
  clase         VARCHAR(15)  NOT NULL,
  destinatario  VARCHAR(254) NOT NULL,
  asunto        VARCHAR(160) NOT NULL,
  cuerpo        TEXT         NOT NULL,
  estado        VARCHAR(15)  NOT NULL DEFAULT 'pendiente',
  intentos      SMALLINT     NOT NULL DEFAULT 0,
  proveedor_id  VARCHAR(300),
  error_codigo  VARCHAR(60),
  bloqueo_hasta TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT envios_email_clase_ck    CHECK (clase IN ('notificacion', 'respuesta')),
  CONSTRAINT envios_email_estado_ck   CHECK (estado IN ('pendiente', 'enviando', 'aceptado', 'error', 'desconocido')),
  CONSTRAINT envios_email_intentos_ck CHECK (intentos BETWEEN 0 AND 3),
  CONSTRAINT envios_email_cuerpo_ck   CHECK (char_length(cuerpo) <= 6000)
);
-- Cada consulta crea una única notificación; cada respuesta, un único envío.
CREATE UNIQUE INDEX envios_email_notificacion_uk ON app.envios_email (consulta_id) WHERE clase = 'notificacion';
CREATE UNIQUE INDEX envios_email_respuesta_uk    ON app.envios_email (respuesta_id) WHERE respuesta_id IS NOT NULL;
CREATE INDEX idx_envios_email_estado_created_at  ON app.envios_email (estado, created_at);