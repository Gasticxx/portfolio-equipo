-- Sesiones (estructura que exige connect-pg-simple)
CREATE TABLE app.sesiones (
  sid    VARCHAR      NOT NULL PRIMARY KEY,
  sess   JSON         NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX idx_sesiones_expire ON app.sesiones (expire);

-- Visitas (navegador, no persona única)
CREATE TABLE app.visitas (
  id                  UUID        PRIMARY KEY,
  iniciada_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_actividad_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  es_prueba           BOOLEAN     NOT NULL DEFAULT false
);
CREATE INDEX idx_visitas_iniciada_at ON app.visitas (iniciada_at);

-- Accesos (login dentro de una visita)
CREATE TABLE app.accesos (
  id         INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  visita_id  UUID        NOT NULL REFERENCES app.visitas(id)  ON DELETE CASCADE,
  usuario_id INTEGER     NOT NULL REFERENCES app.usuarios(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT accesos_visita_usuario_uk UNIQUE (visita_id, usuario_id)
);
CREATE INDEX idx_accesos_created_at ON app.accesos (created_at);

-- Límites de intentos (rate limit)
CREATE TABLE app.limites (
  clave          CHAR(64)    NOT NULL,
  ventana_inicio TIMESTAMPTZ NOT NULL,
  contador       INTEGER     NOT NULL,
  expira_at      TIMESTAMPTZ NOT NULL,
  CONSTRAINT limites_pk PRIMARY KEY (clave, ventana_inicio),
  CONSTRAINT limites_contador_ck CHECK (contador >= 1)
);
CREATE INDEX idx_limites_expira_at ON app.limites (expira_at);