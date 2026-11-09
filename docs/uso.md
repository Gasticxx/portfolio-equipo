# Manual de Uso — Portfolio Equipo Seis

Este documento describe los recorridos funcionales de la aplicación según los cuatro niveles de acceso definidos en la especificación (`visitante`, `registrado`, `operador` y `administrador`).

---

## 1. Recorrido como Visitante (Sin sesión iniciada)

1. **Inicio (`/`):** Presenta la propuesta colectiva de **Equipo Seis**, las tarjetas resumidas de los seis integrantes, tres servicios destacados y accesos directos al catálogo de proyectos y al formulario de contacto.
2. **Equipo (`/equipo` y `/equipo/:slug`):**
   - En `/equipo` se visualizan las seis tarjetas con especialidad y stack tecnológico.
   - Al ingresar a `/equipo/:slug`, se consulta la formación académica, enlaces profesionales y los **aportes en estado comprobado** correspondientes a proyectos publicados.
3. **Servicios (`/servicios`):** Lista los servicios activos ordenados por prioridad. El botón **Solicitar cotización** redirige automáticamente a `/contacto?tipo=cotizacion&servicioId=<id>` precargando la selección.
4. **Proyectos (`/proyectos`):** Muestra el resumen de los proyectos publicados e informa que para acceder al detalle técnico y a las demos interactivas es obligatorio iniciar sesión.
5. **Contacto (`/contacto`):** Permite enviar consultas (`general`, `cotizacion` o `asesoria`) validando consentimiento explícito y evitando envíos duplicados mediante clave de idempotencia.
6. **Registro e Ingreso (`/registro` y `/login`):** Permite crear una cuenta con rol `registrado` (contraseña de 12 a 128 caracteres) e iniciar sesión.

---

## 2. Recorrido como Usuario Registrado (`rol = registrado`)

Además de las vistas públicas, el usuario autenticado accede a:

1. **Detalle de Proyectos (`/proyectos/:slug`):** Visualiza la descripción completa, tecnologías, participantes, detalle de aportes individuales, enlace a repositorio y acceso a las demos publicadas.
2. **Demos Interactivas (`/demos/:id`):**
   - **Tablero personal de tareas (`tipo = tablero`):** Permite crear hasta 50 tareas propias, cambiar su estado (`pendiente`, `progreso`, `completada`) y eliminarlas. Los datos están aislados por cuenta de usuario.
   - **Visualizador de algoritmos (`tipo = algoritmos`):** Permite ejecutar paso a paso o con velocidad configurable (200, 500 o 1000 ms) **Búsqueda lineal** y **Ordenamiento burbuja** sobre listas de 1 a 20 enteros entre `-99` y `99`.
3. **Mi Cuenta (`/mi-cuenta`):** Muestra nombre, email y rol en modo lectura, permite cambiar la contraseña actual (invalidando sesiones previas) y cerrar sesión.

---

## 3. Recorrido como Operador (`rol = operador`)

Incluye los permisos de usuario registrado y suma la gestión de contacto:

1. **Bandeja de Consultas (`/operador/consultas`):** Permite buscar y filtrar consultas por texto (`q`), tipo (`general`, `cotizacion`, `asesoria`), estado de gestión (`nueva`, `en_proceso`, `respondida`, `cerrada`) y estado de notificación por correo.
2. **Detalle y Respuesta (`/operador/consultas/:id`):**
   - Al abrir una consulta en gestión, el operador puede pasar su estado a `en_proceso`.
   - Permite redactar y enviar respuestas por correo electrónico a través de Brevo HTTPS al email registrado en la consulta.
   - Si el envío es aceptado por el proveedor, la consulta pasa a `respondida`.
   - Permite reintentar envíos en estado `error` o `pendiente` (máximo 3 intentos) o gestionar envíos en estado `desconocido` con confirmación explícita.

---

## 4. Recorrido como Administrador (`rol = administrador`)

Incluye todas las funciones anteriores y habilita las capacidades de promoción en `/admin`:

1. **Gestión de Proyectos (`/admin/proyectos`) y Demos (`/admin/demos`):** CRUD completo de proyectos (incluyendo portada WebP en Supabase Storage, tecnologías y aportes de cada miembro) y de fichas de demos.
2. **Gestión de Servicios (`/admin/servicios`):** CRUD completo de servicios ofertados (`nombre`, `categoria`, `descripcion`, `orden` y estado `activo`). Al eliminar un servicio, las consultas históricas conservan el nombre en `servicio_nombre_snapshot`.
3. **Gestión de Usuarios (`/admin/usuarios`):** Búsqueda de cuentas con rol `registrado` y habilitación/deshabilitación inmediata (`activo = true/false`), revocando sesiones activas al bloquear.
4. **Panel de Métricas (`/admin/metricas`):** Visualización de contadores y tres gráficos interactivos (tráfico diario de visitas vs. accesos autenticados, registros diarios y distribución de consultas por tipo) filtrables por rango de fechas (`desde`, `hasta`) y tipo de consulta.