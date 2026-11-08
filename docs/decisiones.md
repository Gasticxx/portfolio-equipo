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

@'

## Actualización de sharp a 0.35.5

- Se actualiza sharp de 0.34.5 a 0.35.5 para corregir las vulnerabilidades informadas por npm audit.
- Se modifican package.json y package-lock.json.
- El cambio afecta al procesamiento de imágenes del módulo de I5.
- Se comprobó npm audit con cero vulnerabilidades informadas.
- Se probaron entradas PNG, JPEG y WebP, convertidas a WebP de 4 por 4 píxeles.
- Queda pendiente revisar el cambio con I5 y comprobar su integración con las cargas de imágenes.

'@ | Add-Content -Path docs/decisiones.md -Encoding UTF8
