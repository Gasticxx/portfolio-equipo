# Base de datos local (PostgreSQL 17)

Guía para que cada integrante prepare en su PC las bases `portfolio_dev` y `portfolio_test` con las tablas y los datos iniciales del portfolio. Está escrita para Windows y a partir del procedimiento seguido por I5 con PostgreSQL 17.11. Responsable: I5 (Datos y proyectos).

Tiempo estimado: 20 a 30 minutos la primera vez.

## Qué vas a tener al terminar

- PostgreSQL 17 instalado en tu PC.
- Dos bases vacías que se completan con comandos del proyecto:
  - `portfolio_dev`: la que usa la aplicación cuando la ejecutás con `npm run dev`.
  - `portfolio_test`: la que usan las pruebas automáticas. Pueden crear y borrar datos.
- El esquema `app` con todas sus tablas y los datos iniciales cargados.

La base de tu PC es solo tuya: podés borrarla y recrearla sin avisar a nadie. La base remota de Supabase es compartida y nunca se reinicia para probar un cambio individual.

## 1. Instalar PostgreSQL 17

1. Descargá el instalador de **PostgreSQL 17** para Windows desde la página oficial de PostgreSQL. Elegí la versión mayor **17**, la misma que usan el CI y los demás integrantes. No instales la 18 ni otra.
2. Durante la instalación:
   - Dejá el puerto **5432**.
   - Elegí una contraseña para el usuario `postgres` y guardala en un lugar privado.
   - Dejá marcados **PostgreSQL Server** y **Command Line Tools** (traen `psql`). Stack Builder no hace falta.
3. Si ya tenías otra versión instalada, desinstalala antes: dos versiones a la vez se disputan el puerto 5432.

Comprobá la instalación abriendo una terminal y ejecutando:

```
psql --version
```

Tiene que responder `psql (PostgreSQL) 17.x`.

Si Windows dice que `psql` no se reconoce como comando, agregá esta carpeta al `Path` del sistema y abrí una terminal nueva:

```
C:\Program Files\PostgreSQL\17\bin
```

## 2. Crear las dos bases

```
psql -U postgres -c "CREATE DATABASE portfolio_dev;"
psql -U postgres -c "CREATE DATABASE portfolio_test;"
```

Cada comando pide la contraseña del paso anterior y responde `CREATE DATABASE`. Verificá con:

```
psql -U postgres -c "\l"
```

Tienen que figurar `portfolio_dev` y `portfolio_test`.

## 3. Configurar `.env` y `.env.test`

Estos archivos son privados: están en `.gitignore` y **nunca se suben a GitHub**.

1. Si todavía no lo hiciste, copiá la plantilla:

```powershell
Copy-Item .env.example .env
Copy-Item .env.example .env.test
```

2. En `.env`, reemplazá la contraseña de ejemplo (`postgres`) por la tuya en estas tres líneas. Cada una termina con el nombre de su base:

```dotenv
DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/portfolio_dev
MIGRATION_DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/portfolio_dev
TEST_DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/portfolio_test
```

3. En `.env.test`, apuntá **las tres** a `portfolio_test`, para que ninguna prueba toque tus datos de desarrollo:

```dotenv
DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/portfolio_test
MIGRATION_DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/portfolio_test
TEST_DATABASE_URL=postgresql://postgres:TU_CLAVE@localhost:5432/portfolio_test
```

4. Dejá `DB_SSL=false`: es lo correcto para una base local.

Si tu contraseña tiene caracteres especiales (`@ : / # ? %` o espacios), hay que codificarlos dentro de la URL: por ejemplo, `@` se escribe `%40`. Lo más simple es elegir una contraseña de solo letras y números.

Los secretos `SESSION_SECRET` y `VISIT_SECRET` no hacen falta para preparar la base; se completan cuando ejecutes la aplicación.

## 4. Crear las tablas y cargar los datos iniciales

Con la terminal parada en la carpeta del proyecto:

```
npm ci
npm run db:migrate
npm run db:seed
```

- `npm ci` instala las dependencias (solo hace falta la primera vez o cuando cambia `package-lock.json`).
- `npm run db:migrate` ejecuta, en orden, las migraciones de `db/migrations` que todavía no se aplicaron.
- `npm run db:seed` carga los datos iniciales: tecnologías, seis miembros, el proyecto `portfolio-equipo`, dos demos sin publicar, tres servicios y un aporte asignado por integrante.

Qué tenés que ver:

```
Destino: local: localhost:5432/portfolio_dev
Aplicada: 001_base.sql
Aplicada: 002_sesiones_visitas_limites.sql
Aplicada: 003_contenido.sql
Listo: 3 migración(es) aplicada(s).
```

y después de `npm run db:seed`:

```
Destino: local: localhost:5432/portfolio_dev
  tecnologías: 13 nuevo(s)
  miembros: 6 nuevo(s)
  ...
Listo: 39 registro(s) nuevo(s).
```

La primera línea de cada comando indica a qué base se conecta. Si dice `REMOTO`, frená: estás apuntando a una base que no es la de tu PC.

Los dos comandos se pueden repetir sin riesgo: `db:migrate` solo aplica lo pendiente y `db:seed` solo carga lo que falta.

## 5. Comprobar que quedó bien

```
npm run db:migrate -- --listar
```

Muestra cada migración como `aplicada` o `PENDIENTE` sin ejecutar nada. Los dos guiones (`--`) son necesarios para que npm le pase la opción al script.

En `psql`:

```
psql -U postgres -d portfolio_dev
```
```sql
\dt app.*
SELECT nombre FROM app.miembros ORDER BY orden;
```

Con las migraciones actuales tienen que figurar las tablas del esquema `app` y seis miembros. Para salir, escribí `\q`.

## 6. Preparar la base de pruebas

```
node --env-file=.env.test scripts/migrate.js
node --env-file=.env.test scripts/seed.js
```

Tiene que decir `Destino: local: localhost:5432/portfolio_test`. Las pruebas automáticas (`npm test`) usan `.env.test`.

## 7. Empezar de cero

Si tu base quedó en mal estado o querés repetir el procedimiento, **solo en tu PC**:

```
psql -U postgres -d portfolio_dev -c "DROP SCHEMA IF EXISTS app CASCADE;"
npm run db:migrate
npm run db:seed
```

`DROP SCHEMA` borra todas las tablas y datos del esquema `app`. **Nunca lo ejecutes contra Supabase.**

## Si algo falla

| Mensaje | Qué pasó y qué hacer |
|---|---|
| `psql` no se reconoce como comando | Falta agregar la carpeta `bin` de PostgreSQL 17 al `Path` (ver paso 1) |
| `password authentication failed` | La contraseña no coincide con la que elegiste al instalar. Revisala en el `.env` |
| `database "portfolio_dev" does not exist` | No se creó la base. Repetí el paso 2 |
| `connection refused` o `ECONNREFUSED` | El servicio de PostgreSQL no está corriendo. Abrí Servicios de Windows e iniciá el servicio `postgresql-x64-17` |
| `node: .env: not found` | Falta crear el archivo `.env`. Ver paso 3 |
| `Falta MIGRATION_DATABASE_URL` | La variable no está en el `.env`. Revisá el paso 3 |
| `relation ... already exists` | Aplicaste las tablas a mano con `psql -f` y `schema_migrations` quedó sin registro. Recreá la base (paso 7) |
| `Las tablas todavía no existen` | Ejecutaste `db:seed` antes que `db:migrate`. Ejecutá primero `npm run db:migrate` |
| `Otra persona o proceso está migrando...` | Hay otra ejecución en curso sobre la misma base. Esperá y reintentá |
| Tildes o `ñ` con caracteres raros en la consola | Es solo cómo la consola de Windows muestra los acentos; no afecta lo que se guarda |

## Reglas para no romper nada

- Una migración que ya se integró en `main` **no se edita**: si el esquema tiene que cambiar, se agrega una migración nueva con el número siguiente.
- Un cambio de esquema que solo existe en tu base local no cuenta: tiene que estar en una migración.
- `.env` y `.env.test` nunca se suben a Git ni se pegan en chats o capturas.
- No uses `DROP SCHEMA` en ninguna base que no sea la de tu PC.