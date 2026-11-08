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

## DEC-00N: Migración 002 y convención de nombres de índices

- **Fecha:** 2026-11-07
- **Responsable:** I5 (Datos y proyectos)
- **Consumidores afectados:** I2 (visitas, accesos, límites y migrate.js), I4 (sesiones)
- **Motivo:** `001_base.sql` ya está integrada y no se edita. Las tablas `app.sesiones`, `app.visitas`, `app.accesos` y `app.limites` (apartados 10.3 y 10.5) se agregan en `002_sesiones_visitas_limites.sql`. La migración de contenido (miembros, proyectos, aportes, demos) pasa a numerarse `003`. `migrate.js` ordena por nombre, por lo que no requiere cambios.
- **Nombres de índices:** las tablas nuevas usan el estilo `idx_<tabla>_<campo>` documentado por I2 en `docs/api.md`. Los índices de `app.usuarios` conservan su nombre (`usuarios_email_lower_uk`, `usuarios_created_at_idx`) porque ya están integrados.
- **Verificación:** migración aplicada en `portfolio_dev` y `portfolio_test` (PostgreSQL 17.11) y probada con transacciones de prueba (sesión válida y nula, UPSERT de límites, contador en cero y acceso repetido).