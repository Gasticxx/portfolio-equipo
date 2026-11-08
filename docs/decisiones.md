# Registro de Decisiones Técnicas y Acuerdos del Equipo

Este documento registra los acuerdos operativos y las decisiones técnicas del **Equipo Seis**, indicando motivo, consumidores afectados y verificación.

---

## DEC-001: Protección de la rama `main` y flujo obligatorio de Pull Requests

- **Fecha:** 2026-11-05
- **Responsable:** I2 (Scrum Master / Backend e integración)
- **Consumidores afectados:** Todos los integrantes (I1, I2, I3, I4, I5, I6)
- **Motivo:** Garantizar la estabilidad de `main` y cumplir los apartados 1, 5 y 19 de la especificación utilizando únicamente planes gratuitos en un repositorio privado.

### Reglas obligatorias para los 6 integrantes

1. **Prohibido hacer push directo a `main`:** Una vez publicado el entorno base inicial (I2 01 / I2 02), ningún integrante sube commits directamente a `main`.
2. **Rama corta por tarjeta:** Todo trabajo se realiza en una rama creada desde `main` actualizado (`feature/Ix-NN-descripcion`, `fix/Ix-NN-descripcion` o `docs/perfil-Ix`).
3. **Pull Request obligatorio con plantilla:** Al abrir un PR se completa `.github/pull_request_template.md` indicando tarjeta vinculada, cómo se probó y revisor.
4. **Revisión cruzada independiente (mínimo 1 aprobación):** Ningún autor aprueba ni integra su propio PR sin la aprobación explícita de su revisor asignado:
   - I1 revisa a I3 (interfaz) y gráficos de I6.
   - I2 revisa a I4 (identidad y permisos).
   - I3 revisa a I1 (perfiles y servicios UI).
   - I4 revisa a I5 (proyectos, demos, archivos) y a I6 (consultas y correo).
   - I5 revisa a I2 (servidor, configuración, eventos y métricas) y persistencia SQL de todos.
5. **Conversaciones y CI en verde:** Antes de integrar, todos los comentarios de revisión deben estar resueltos y el workflow de GitHub Actions (`CI`) debe estar en estado exitoso (verde).
6. **Integración por Squash:** El repositorio tiene habilitado exclusivamente **Squash and merge** y el borrado automático de la rama tras fusionar.

---

## DEC-002 — Migración 002 y convención de nombres de índices

- **Fecha** 2026-11-07.
- **Responsable** I5, Datos y proyectos.
- **Consumidores afectados** I2 para visitas, accesos, límites y migrate.js. I4 para sesiones.
- **Motivo** Se conserva la migración integrada `001_base.sql` y se agregan las tablas `app.sesiones`, `app.visitas`, `app.accesos` y `app.limites` mediante `002_sesiones_visitas_limites.sql`, según los apartados 10.3 y 10.5.
- **Numeración** La migración de contenido pasa a numerarse `003`. El ejecutor ordena las migraciones por nombre.
- **Nombres de índices** Las tablas nuevas usan el estilo `idx_<tabla>_<campo>` documentado por I2 en `docs/api.md`. Los índices existentes de usuarios conservan los nombres `usuarios_email_lower_uk` y `usuarios_created_at_idx`.
- **Verificación informada por I5** Migración aplicada en `portfolio_dev` y `portfolio_test` con PostgreSQL 17.11. Se probaron sesiones válidas e inválidas, UPSERT de límites, rechazo del contador en cero y rechazo de accesos repetidos.

---

## DEC-003 — Actualización de sharp a 0.35.5

- **Responsable** I4, con revisión de I5 y coordinación con I2.
- **Consumidores afectados** I5 para procesamiento de imágenes e I2 para dependencias compartidas.
- **Motivo** Corregir las vulnerabilidades informadas por npm audit.
- **Decisión** Actualizar sharp de 0.34.5 a 0.35.5, fijando la versión en `package.json` y actualizando `package-lock.json`.
- **Verificación** npm audit informó cero vulnerabilidades. Se probaron entradas PNG, JPEG y WebP convertidas a WebP de 4 por 4 píxeles.
- **Pendiente** Revisar el cambio con I5 y comprobar su integración con las cargas de imágenes.

---

## DEC-004 — Migración 003, datos iniciales y reglas del ejecutor

- **Fecha** 2026-11-08.
- **Responsable** I5, Datos y proyectos.
- **Consumidores afectados** I1 para miembros, tecnologías y servicios. I6 para consultas, respuestas y envíos. I2 para la ejecución de migraciones y datos iniciales.
- **Migración** `003_contenido.sql` agrega las tablas de los apartados 10.1, 10.2, 10.3 (tareas de demo) y 10.4.
- **Ejecutor** `migrate.js` registra como versión el nombre del archivo y no detecta ediciones de migraciones ya integradas, porque `schema_migrations` solo guarda `version` y `applied_at`. Requiere conexión en modo sesión (puerto 5432) por el bloqueo asesor.
- **Datos iniciales** El seed carga solo faltantes y no restablece cambios del equipo. Los servicios se cargan únicamente con la tabla vacía, porque no tienen clave natural única. Los aportes se cargan solo si el integrante no tiene ninguno en el proyecto. No se cargan tecnologías de miembros, porque requieren confirmación personal.
- **Verificación** [completar con lo probado en tu PC].