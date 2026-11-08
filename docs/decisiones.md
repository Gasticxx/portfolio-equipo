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

## DEC-002: Organización y Ceremonias del Sprint 1 (Tarjeta I2 05)

- **Facilitador (Scrum Master):** I2 (@Gasticxx)
- **Product Owner:** I1
- **Objetivo del Sprint 1 (Apartado 19):** "Un visitante conoce al equipo y una cuenta entra al primer proyecto y demo."

### Ritmo operativo acordado (Apartado 19)
- **Daily Scrum:** 15 minutos diarios por Discord a las 20:00 hs (Argentina). Cada integrante responde: qué integrará a continuación y qué bloqueo requiere apoyo.
- **Ventanas de revisión e integración de Pull Requests:** 13:00 hs y 21:00 hs (Argentina). Máximo 1 tarea en desarrollo y hasta 2 revisiones pendientes por persona.
- **Gestión de bloqueos:** Si un bloqueo supera entre 30 y 60 minutos sin avance, se coloca la etiqueta `Bloqueada` en GitHub Projects indicando causa, persona que apoya y próximo paso.

### Checklist de cierre de la Review del Sprint 1
- [ ] Recorrido público de Inicio y las 6 fichas del equipo (I1 + I3).
- [ ] Registro de cuenta, login y logout con sesión en PostgreSQL (I4).
- [ ] Detalle del primer proyecto protegido y primera demo de tablero funcional (I5 + I3 + I4).
- [ ] Captura de visitas generales sin duplicar en recargas dentro de 30 min (I2 + I5).
- [ ] Avance del formulario de contacto y prueba real de recepción de correo en Brevo (I6).

### Retrospectiva del Sprint 1 (Mejora accionable para el Sprint 2)
- **Lo que funcionó bien:** Entorno base reproducible con `npm ci`, CI automático en GitHub Actions y contratos definidos en `docs/api.md`.
- **Mejora concreta para el Sprint 2:** Integrar ramas más cortas a diario y verificar los esquemas SQL con I5 antes de abrir el Pull Request de cada CRUD.