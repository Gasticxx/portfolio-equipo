# Matriz de Requisitos y Cobertura (Reflection Tech)

| Código | Requisito | Tarjetas Asociadas | Responsable | Revisor | Casos de Aceptación | Estado | Evidencia (PR / Test) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **R01** | Inicio, 6 perfiles, stack, servicios y formación veraz | I1-03, I1-04, I1-05 | I1, I3 | I3, I1 | A02 | Pendiente | - |
| **R02** | Formulario de contacto guardado y notificación por email real | I6-01 a I6-04 | I6 | I4 | A20, A21, A22, A23, A24 | Pendiente | - |
| **R03** | Registro propio, login/logout y sesiones en PostgreSQL | I4-01 a I4-03 | I4 | I2 | A03 a A10 | Pendiente | - |
| **R04** | Detalle de proyectos y ejecución de demos protegidos por sesión | I4-04, I5-03, I5-05 | I4, I5 | I2, I4 | A11, A32, A33, A34, A35 | Pendiente | - |
| **R05** | Panel de operador con listado y filtro de consultas | I6-06 | I6 | I4 | A27 | Pendiente | - |
| **R06** | Respuesta a consultas por email (Brevo), estados e historial | I6-07 | I6 | I4 | A25, A26 | Pendiente | - |
| **R07** | Escalabilidad: 2 APIs (Brevo + Supabase Storage) y 4 animaciones | I3-07, I5-04, I6-02 | I3, I5, I6 | I1, I4 | A18, A19, A25, A37 | Pendiente | - |
| **R08** | Stack Express 5, EJS 3 y persistencia en PostgreSQL 17 | I2-02, I5-01, I5-02 | I2, I5 | I5, I4 | A01, A38 | Pendiente | - |
| **R09** | Diseño UX/UI con Bootstrap 5 y adaptable (móvil/escritorio) | I3-01 a I3-04 | I3 | I1 | A02, A37 | Pendiente | - |
| **R10** | Validación estricta con Zod, archivos WebP y rate-limit | Todos | Todos | Todos | A04, A05, A18, A36 | Pendiente | - |
| **R11** | Documentación: manual de diseño, arquitectura, uso y pruebas | I1-09, I2-10, I3-01, I6-05 | Todos | Todos | A01 | Pendiente | - |
| **P01** | Admin: CRUD completo de Proyectos con aportes y tecnologías | I5-06 | I5 | I4 | A14, A15, A16 | Pendiente | - |
| **P02** | Admin: CRUD completo de Demos vinculadas a proyectos | I5-07 | I5 | I4 | A14, A17 | Pendiente | - |
| **P03** | Admin: CRUD completo de Servicios ofertados | I1-06, I1-07 | I1 | I5, I3 | A14, A17 | Pendiente | - |
| **P04** | Admin: Listado, búsqueda y bloqueo/rehabilitación de usuarios | I4-06, I4-07 | I4 | I2 | A12, A13, A14 | Pendiente | - |
| **P05** | Métricas: Contador de visitas generales (ventana 30 min) | I2-04 | I2 | I5 | A28, A29 | Pendiente | - |
| **P06** | Métricas: Contador de accesos de usuarios autenticados | I2-06 | I2 | I5 | A07, A29 | Pendiente | - |
| **P07** | Métricas: Filtros por fecha/tipo y 3 gráficos interactivos (Chart.js) | I2-07, I6-08, I6-09 | I2, I6 | I1, I5 | A30, A31 | Pendiente | - |