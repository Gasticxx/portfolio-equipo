CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE app.usuarios (
  id             INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY CHECK (id > 0),
  nombre         VARCHAR(80)  NOT NULL,
  email          VARCHAR(254) NOT NULL,
  password_hash  VARCHAR(300) NOT NULL,
  rol            VARCHAR(20)  NOT NULL DEFAULT 'registrado',
  activo         BOOLEAN      NOT NULL DEFAULT true,
  version_sesion INTEGER      NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT usuarios_rol_ck
    CHECK (rol IN ('registrado', 'operador', 'administrador')),
  CONSTRAINT usuarios_version_sesion_ck
    CHECK (version_sesion >= 1)
);

CREATE UNIQUE INDEX usuarios_email_lower_uk ON app.usuarios (lower(email));
CREATE INDEX usuarios_created_at_idx ON app.usuarios (created_at);