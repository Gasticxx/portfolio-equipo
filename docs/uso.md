# Manual de Uso — Portfolio Reflection Tech

Este documento describe los recorridos funcionales de la aplicación según los cuatro niveles de acceso definidos en la especificación (`visitante`, `registrado`, `operador` y `administrador`).

---

## 1. Recorrido como Visitante (Sin sesión iniciada)

1. **Inicio (`/`):** Presenta la propuesta colectiva de **Reflection Tech**, las tarjetas resumidas de los seis integrantes, tres servicios destacados y accesos directos al catálogo de proyectos y al formulario de contacto.
2. **Equipo (`/equipo` y `/equipo/:slug`):**
   - En `/equipo` se visualizan las seis tarjetas con especialidad y stack tecnológico.
   - Al ingresar a `/equipo/:slug`, se consulta la formación académica, enlaces profesionales y los **aportes en estado comprobado** correspondientes a proyectos publicados.
3. **Servicios (`/servicios`):** Lista los servicios activos ordenados por prioridad. El botón **Solicitar cotización** redirige automáticamente a `/contacto?tipo=cotizacion&servicioId=<id>` precargando la selección.
4. **Proyectos (`/proyectos`):** Muestra el resumen de los proyectos publicados e informa que para acceder al detalle técnico y a las demos interactivas es obligatorio iniciar sesión.
5. **Contacto (`/contacto`):** Formulario con nombre, email, tipo de consulta (`general`, `cotizacion` o `asesoria`), asunto, mensaje (20 a 3000 caracteres) y consentimiento obligatorio.
   - En una cotización se puede elegir un servicio activo; desde **Solicitar cotización** llega preseleccionado.
   - Los errores aparecen junto a cada campo, con el mismo criterio que aplica el servidor.
   - Al enviar, la página confirma que la consulta quedó registrada e indica si el aviso por correo al equipo fue aceptado o quedó pendiente de revisión. Un fallo del correo nunca hace perder la consulta.
   - Pulsar Enviar dos veces o repetir tras un corte de red no crea una consulta duplicada. Límite: 5 envíos cada 15 minutos por conexión.
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

1. **Bandeja de Consultas (`/operador/consultas`):** Busca por nombre, email o asunto y filtra por tipo (`general`, `cotizacion`, `asesoria`), estado de gestión (`nueva`, `en_proceso`, `respondida`, `cerrada`) y estado del aviso por correo. Muestra 10 consultas por página, las más recientes primero.
2. **Detalle (`/operador/consultas/:id`):** Datos de la consulta, servicio elegido (se conserva aunque el servicio se borre después), historial de respuestas y tabla de envíos de correo. Abrir una consulta no cambia su estado.
3. **Estados:**
   - **Marcar en proceso:** desde `nueva` o `respondida`.
   - **Respondida:** es automática cuando Brevo acepta una respuesta; no se marca a mano.
   - **Cerrar consulta:** desde `respondida`. Una consulta cerrada no se puede responder.
   - **Reabrir:** desde `cerrada`, vuelve a `en_proceso`.
4. **Responder:** Mensaje de 10 a 3000 caracteres que se envía por Brevo al email registrado en la consulta; el autor es el operador con la sesión abierta. Una respuesta enviada no se edita: una corrección es otra respuesta.
5. **Reintentar un envío:**
   - `error` o `pendiente`: se puede reintentar 60 segundos después del intento anterior, hasta 3 intentos.
   - `desconocido`: el correo pudo haber salido. Antes de reintentar se revisan los registros de Brevo y se marca la confirmación de riesgo.
   - `aceptado`: nunca se reintenta.
   - Qué hacer si un email no llega: `docs/consultas.md` §5.

---

## 4. Recorrido como Administrador (`rol = administrador`)

Incluye todas las funciones anteriores y habilita las capacidades de promoción en `/admin`:

1. **Gestión de Proyectos (`/admin/proyectos`) y Demos (`/admin/demos`):** CRUD completo de proyectos (incluyendo portada WebP en Supabase Storage, tecnologías y aportes de cada miembro) y de fichas de demos.
2. **Gestión de Servicios (`/admin/servicios`):** CRUD completo de servicios ofertados (`nombre`, `categoria`, `descripcion`, `orden` y estado `activo`). Al eliminar un servicio, las consultas históricas conservan el nombre en `servicio_nombre_snapshot`.
3. **Gestión de Usuarios (`/admin/usuarios`):** Búsqueda de cuentas con rol `registrado` y habilitación/deshabilitación inmediata (`activo = true/false`), revocando sesiones activas al bloquear.
4. **Panel de Métricas (`/admin/metricas`):** Cuatro tarjetas (visitas, accesos autenticados, cuentas creadas y consultas) y tres gráficos, cada uno con una tabla para leer los valores sin depender del color: visitas y accesos por día, cuentas creadas por día y consultas por tipo.
   - **Rango:** últimos 7 días (predeterminado), últimos 30 días o personalizado de hasta 90 días.
   - **Tipo de consulta:** filtra solo las consultas; visitas, accesos y cuentas no cambian.
   - Sin datos en el rango, muestra ceros y el aviso «Sin datos para este rango».
   - Los gráficos se adaptan al tema claro u oscuro de la interfaz.
## Administración de demos

En `/admin/demos`, un administrador puede crear, editar y publicar demos de tipo `tablero` o `algoritmos` vinculadas a proyectos existentes. Ya no es necesario cargar estos datos mediante SQL.

- Se admite una demo por tipo y proyecto, según la restricción de la base.
- La demo y el proyecto deben estar publicados para aparecer en `/demos`.
- El proyecto y el tipo se conservan al editar para proteger las tareas existentes.
- Para retirar una demo, desmarcar «Publicada». No se borran tareas de usuarios.
- No se admite cargar JavaScript arbitrario: se utilizan las dos experiencias implementadas.
- El tablero envía el ID de demo a la API y conserva el aislamiento de tareas por usuario.
- Las escrituras requieren sesión de administrador y token CSRF.

El formulario de Contacto requiere PostgreSQL disponible. Brevo se configura por separado mediante `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME` y `CONTACT_TO_EMAIL`: sin ellas no se envían correos.
