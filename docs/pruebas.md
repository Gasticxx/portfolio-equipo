# Registro de pruebas — módulo de I6 (contacto, operador, correo y métricas)

Este archivo registra las pruebas que ejecutó **I6**: las de su módulo y las que hizo sobre módulos ajenos (métricas de I2, demos de I3 e I5).
Por acuerdo del equipo, **cada integrante registra las pruebas de su módulo en su ficha (`docs/integrantes/Ix.md`), en sus pruebas automáticas (`tests/`) y en la descripción de sus PR**. Los casos de la guía (T01–T20) y de la especificación (A01–A38) que no involucran a I6 no se repiten acá.

Un defecto encontrado en un módulo ajeno se describe acá y vuelve a su autor. Un caso se marca **OK** solo con evidencia repetible (comando, captura o enlace a PR).

## Cómo registrar un resultado

| Columna | Qué escribir |
|---|---|
| Caso | ID de la guía (T01–T20) o de la especificación (A01–A38) |
| Versión | Commit corto de `main` o rama probada (`git rev-parse --short HEAD`) |
| Rol | Visitante, registrado, operador o administrador |
| Pasos | Lo mínimo para repetirlo sin explicación oral |
| Esperado | Copiado del contrato |
| Obtenido | Lo que pasó realmente, con estado HTTP si aplica |
| Evidencia | Nombre del test automático, captura en `docs/evidencias/` o enlace |
| Responsable | Autor que ejecuta / revisor |

Estados: **OK**, **FALLA** (con tarjeta de defecto), **PENDIENTE**, **BLOQUEADO** (con motivo).

### Comandos

```bash
node --env-file=.env.test scripts/migrate.js   # migra portfolio_test (una vez por migración nueva)
npm test                                       # unitarias + integración (.env.test)
npm run test:unit                              # solo unitarias, sin base
```

> **Propuesta para I2 (CI):** el workflow no ejecuta migraciones, por lo que las pruebas que usan la base se omiten en GitHub Actions. Agregar antes de `npm test`, después de crear `.env.test`:
> `- name: Migrar base de prueba` / `run: node --env-file=.env.test scripts/migrate.js`

---

## 1. Casos de la guía general en los que interviene I6

| Caso | Acción | Esperado | Responsable / revisor | Rol | Estado | Evidencia |
|---|---|---|---|---|---|---|
| T06 | Enviar consulta válida y con campos inválidos | Persistencia y correo; 422 con campos | **I6** / I4 | Visitante | OK (automático y recepción real, §4) | `A20/T06` en `consultas.api.test.js`; validadores en `consultas.validator.test.js` |
| T07 | Simular fallo del servicio de correo | Consulta conservada y estado real visible | **I6** / I4 | Visitante + operador | OK (automático) | `A24/T07` (error, red, timeout) |
| T08 | Abrir panel y endpoints con rol registrado | Rechazo de consultas y administración | **I6** + I4 / I2 | Registrado | OK (consultas) · admin PENDIENTE I4 | `A27/T08` |
| T09 | Responder una consulta como operador | Email recibido e historial registrado | **I6** / I1 | Operador | OK (automático y recepción real, §4) | `A25/T09` |
| T13 | Generar visitas y accesos y aplicar filtros | Contadores y gráficos consistentes | I2 + **I6** / I1 | Administrador | OK con API real (2026-11-09, `main` 8ef87f3): filtros de rango y tipo, tabla = gráfico, consultas = panel del operador | Recorrido I6 08 (§6) · revisión de I1 PENDIENTE |
| T20 | Filtrar un rango con eventos en sus límites | Coherente con Argentina; día final completo | I2 + **I6** / I1 | Administrador | OK: dataset 20.2 en prueba automática de I2 (`obtenerMetricasPanel`, 4/3/2/4) · comparación con SQL directa sobre datos propios: OK (§8) | ver §3 |

## 2. Casos de la especificación en los que interviene I6

| Caso | Acción | Resultado obligatorio | Responsable / revisor | Estado | Evidencia |
|---|---|---|---|---|---|
| A10 | Escribir sin CSRF o desde otro origen | 403 sin cambios | I4 / I2 · **I6 en sus rutas** | Parte de I6: OK, todas las escrituras del módulo responden 403 sin CSRF. El caso general es de I4 | `Idempotency-Key ausente…; sin CSRF es 403` |
| **A20** | Enviar cada tipo y consentimiento falso | Tres altas; rechazo del falso | **I6** / I4 | OK (automático) | `A20/T06…` |
| **A21** | Repetir consulta con misma clave y payload | Una consulta y una notificación; 200 | **I6** / I4 | OK (automático) | `A21…`, `carrera de altas…` |
| **A22** | Reutilizar clave con otro mensaje | 409 sin alta ni envío | **I6** / I4 | OK (automático) | `A22…` |
| **A23** | Base cae antes del commit de contacto | 503 sin confirmación | **I6** / I4 | OK (automático, pool caído simulado, y manual con PostgreSQL detenido, 2026-11-10) | `A23…` · §9 |
| **A24** | Brevo falla o agota timeout tras el commit | Consulta conservada; error/desconocido visible | **I6** / I4 | OK (automático) | `A24/T07…` |
| **A25** | Operador responde y se comprueba la casilla | Historial persistido; recepción revisada | **I6** / I1 | OK (automático y recepción real, §4) | `A25/T09…` |
| **A26** | Dos reintentos simultáneos o cuarto intento | Una llamada por envío; 409 | **I6** / I4 | OK (automático) | `A26: …` (dos tests) |
| **A27** | Ver contacto como visitante o registrado | 403 sin listado ni historial | **I6** / I4 | OK (automático) | `A27/T08…` |
| **A30** | Fechas límite y tipo de consulta | Día final incluido; tipo solo cambia consultas | I2 + **I6** / I1 | OK con API real: tipo=asesoria cambia solo Consultas (2→1) y la dona | §6 |
| **A31** | Rango vacío o inválido | Ceros y estado vacío; 400 en inválidos | I2 + **I6** / I1 | OK con API real: 01–05/10 en ceros con “Sin datos” y sin dona; rango invertido, futuro, tipo inexistente y una sola fecha → 400 | §6 |
| A32 | Tareas: crear, cambiar, ajena | Persistencia propia; 404 ajena | I5 / I4 · **I6 ejecuta** | BLOQUEADO (2026-11-09, `main` 858d4e4): `demos.routes.js` solo sirve demos `algoritmos` y no existe la API de `app.tareas_demo`. Depende de I5 | §7 |
| A34 | Búsqueda y burbuja con duplicados | Resultados correctos; errores claros | I5 / I3 · **I6 prueba errores** | OK (2026-11-09, `main` 858d4e4): 9 casos de resultado y 11 de error · confirmación de I5 PENDIENTE | §7 |
| A35 | Pausar, avanzar y reiniciar visualizador | Sin timers superpuestos | I3 / I5 · **I6 prueba reinicio** | OK (2026-11-09, `main` 858d4e4) con un defecto menor para I3 (D-I6-05-1) | §7 |

## 3. Dataset de métricas (apartado 20.2)

Cargado en `portfolio_test` y comparado contra la interfaz de `/admin/metricas`. Primera ejecución con el **stub de la API** del entorno de I6; repetir con la API real de I2.

| Filtro | Esperado | Obtenido (stub) | Estado |
|---|---|---|---|
| desde=2026-11-01, hasta=2026-11-03 | visitas 4, accesos 3, cuentas 2, consultas 4; general 2, cotización 1, asesoría 1 | 4 / 3 / 2 / 4; 2 / 1 / 1 | OK |
| … y tipo=cotizacion | 4 / 3 / 2 / 1; general 0, asesoría 0 | 4 / 3 / 2 / 1; 0 / 1 / 0 | OK |
| Consulta del 3 a las 23:59:59.999 | Incluida (día final completo) | Incluida | OK |
| Consulta del 4 a las 00:00 | Excluida | Excluida | OK |
| 2026-10-10 a 2026-10-12 | Ceros y “Sin datos para este rango”; dona sin porciones | Igual; tabla con ceros | OK |
| Hasta anterior a desde | Error en el campo, sin petición | “Hasta debe ser igual o posterior a Desde” | OK |
| Desde anterior a hoy − 89 días | Error en el campo | “La fecha mínima es …” | OK |

## 4. Comprobaciones manuales de correo real (I6)

Límite de pruebas: **20 envíos por día** (el plan gratuito de Brevo permite más; el equipo se limita a 20).

| Fecha | Versión | Prueba | Remitente | Casilla | Resultado de Brevo | ¿Llegó? ¿Spam? | Estado |
|---|---|---|---|---|---|---|---|
| 2026-11-09 | feature/I6-04-07-consultas-correo (luego #21) | Envío real inicial desde el servidor (I6-02) | Remitente verificado de I6 (Gmail, single sender) | Casilla de prueba de I6 (Gmail) | Consulta #1: el servidor se reinició (`node --watch`, al restaurar un stash) con el envío en curso; quedó `enviando` sin resultado y pasó a `desconocido`. Los registros de Brevo confirmaron que no salió (se reintentó después, ver fila de reintento). Consulta #2: aceptado | Llegó a Recibidos, no a spam. Brevo reescribió el remitente a un dominio propio (firmado por `*.brevosend.com`, enviado por `*.sender-sib.com`) porque gmail.com no se puede autenticar | OK |
| 2026-11-09 | feature/I6-04-07-consultas-correo (luego #21) | Notificación de consulta (T06/R02) | ídem | ídem | Aceptado; la consulta quedó registrada en ambos intentos | Recibidos | OK |
| 2026-11-09 | `main` 8ef87f3 | Respuesta del operador (T09/A25), consulta #3 | ídem | Email de la consulta | Aceptado (clase `respuesta`) | Llegó a Recibidos. La consulta pasó a `respondida` con autor tomado de la sesión. Luego se cerró: el formulario desaparece y `POST …/respuestas` devuelve 409 `CONSULTA_CERRADA`; solo se ofrece reabrir (`en_proceso`) | OK |
| 2026-11-09 | `main` 8ef87f3 | Reintento manual de un envío `desconocido` (consulta #1) | ídem | Casilla de prueba de I6 (Gmail) | Reintento con la casilla de confirmación de riesgo marcada: aceptado, `intentos` = 2 | Llegó a Recibidos, una sola vez | OK |

## 5. Historial de ejecución automática del módulo I6

| Fecha | Versión | Comando | Resultado |
|---|---|---|---|
| 2026-11-08 | entrega inicial I6 | `node --test --test-concurrency=1 "tests/**/*.test.js"` (PostgreSQL 16 local, Brevo con doble) | 38 de 38 OK, tres ejecuciones seguidas |
| 2026-11-08 | integración en `main` (b8665d2 + I6) | `npm test` con migraciones 001–003 aplicadas | 70 de 70 OK (24 del equipo + 46 de I6) |
| 2026-11-08 | integración en `main` (b8665d2 + I6) | `npm test` con base sin migrar (como el CI actual) | 48 de 48 OK; las dos suites de I6 con base se omiten con motivo |
| 2026-11-09 | `main` ff114bd (con #20 métricas de I2 y #25 sesiones de I4) | `npm test` en Windows, PostgreSQL 17, migraciones 001–003 | 75 de 75 OK, ninguna omitida |
| 2026-11-09 | `main` 8ef87f3 (con #29 login de I4 y #32 de Lucas) | `npm test` en Windows, PostgreSQL 17, migraciones 001–003 | 100 de 100 OK, ninguna omitida |

## 6. Recorrido de gráficos con la API real (I6 08)

Fecha: 2026-11-09 · Versión: `main` 8ef87f3 · Rol: administrador (cuenta local promovida por SQL) · Base: `portfolio_dev` · Navegador de escritorio y vista móvil de 375 px.

| # | Acción | Esperado | Obtenido | Estado |
|---|---|---|---|---|
| a | Abrir `/admin/metricas` | Últimos 7 días de Argentina con cifras del servidor | 03/11–09/11: visitas 4, accesos 1, cuentas 1, consultas 2 | OK |
| b | Tipo = Asesoría | Cambia solo Consultas y la dona | Consultas 2 → 1; visitas, accesos y cuentas sin cambios; dona Asesoría 100 % | OK |
| c | Personalizado 01/10–05/10 | Ceros, “Sin datos para este rango”, sin porción inventada | 0/0/0/0, aviso visible, dona oculta, tabla con 5 días en 0 | OK |
| d | Hasta anterior a Desde | Error en el campo, sin petición | Mensaje en “Hasta”, `aria-invalid` y foco; no se envió petición | OK |
| d' | API con rango invertido, fecha futura, tipo inexistente o una sola fecha | 400 | 400 `PARAMETRO_INVALIDO` en los cuatro casos | OK |
| e | Tabla vs. gráfico | Mismos valores por día | Coinciden en los 7 días (tráfico y cuentas); dona = tabla por tipo | OK |
| f | Abrir con filtros en la URL | Controles restaurados | Rango, fechas y tipo cargados desde la URL | OK |
| g | Consultas vs. otra fuente | Misma cantidad | Panel del operador: 2 consultas (1 general, 1 asesoría) | OK |
| h | Vista móvil (375 px) | Sin desbordes; gráficos apilados | Sin desplazamiento horizontal | OK |
| i | Tema oscuro de I3 | Ejes, leyenda y series legibles | **Defecto encontrado**: ejes y leyenda en tono oscuro sobre fondo oscuro. Corregido en `correccion/I6-08-graficos-tema-oscuro`: colores leídos de `<body>`, paleta oscura validada (#5B8DEF, #DB7036, #1AA996; contraste ≥ 3:1) y repintado con el evento `i3:tema` | OK tras corrección |

La comparación contra SQL directa está en §8. Queda pendiente revisar la lectura de las cifras con I1 e I3.

## 7. Recorrido de demos (I6 05)

Fecha: 2026-11-09 · Versión: `main` 858d4e4 · Rol: administrador · Demo: «Visualizador de búsqueda y ordenamiento» (`/demos/2`).

Preparación: el seed crea las demos sin publicar y todavía no hay administración de demos. Para probar se publicó solo en la base local:
`UPDATE app.demos SET publicada = true WHERE tipo = 'algoritmos';`. Antes de eso, `/demos` mostró correctamente el estado vacío.

### A34: resultados con duplicados

| Algoritmo | Datos | Objetivo | Obtenido | Estado |
|---|---|---|---|---|
| Lineal | 4,2,4 | 4 | Encontrado en posición 1 (primera aparición), 1 paso | OK |
| Lineal | 5,3,5,3 | 3 | Encontrado en posición 2, 2 pasos | OK |
| Lineal | -99,0,99,-99 | -99 | Encontrado en posición 1 (límites del rango) | OK |
| Lineal | 1,2,3 | 9 | «El valor 9 no se encuentra en la lista», 3 pasos | OK |
| Burbuja | 3,1,3,2,1 | — | 1, 1, 2, 3, 3 en 10 pasos | OK |
| Burbuja | 1,1,2 | — | Sin intercambios; corta tras la primera pasada (2 pasos) | OK |
| Burbuja | 5,5,5 | — | Sin intercambios (2 pasos) | OK |
| Burbuja | 7 | — | «La lista ya está ordenada» (1 paso) | OK |
| Burbuja | 20 valores con repetidos, -99 y 99 | — | Orden ascendente correcto en 169 pasos | OK |

### A34: errores (parte de I6)

Todos se rechazan antes de generar pasos: el estado queda «Listo · 0 pasos», el campo se marca con `aria-invalid="true"` y recibe el foco.

| Entrada | Mensaje | Estado |
|---|---|---|
| Datos vacíos, `1,a,3`, `1.5,2`, `1,100`, 21 valores, `1,2,` | «Ingresá de 1 a 20 enteros entre -99 y 99.» | OK |
| Objetivo vacío, `150` o `1.5` | «Ingresá un objetivo entero entre -99 y 99.» | OK |
| Datos `x` y objetivo `999` a la vez | Ambos mensajes; foco en Datos | OK |
| ` 3 , 1 , 2 ` (con espacios) | Se acepta y se ordena | OK |

### A35: pausa, paso y reinicio (intervalo de 200 ms)

| Prueba | Obtenido | Estado |
|---|---|---|
| Tres clics seguidos en Iniciar | 5 pasos en 1050 ms (con timers duplicados serían 10); Iniciar se deshabilita y los campos se bloquean | OK |
| Pausar | Sigue en 5 pasos después de 700 ms; quedan habilitados Iniciar y Paso | OK |
| Paso en pausa | Avanza exactamente uno (6) y sigue en pausa | OK |
| Iniciar de nuevo | Continúa desde el paso 6 | OK |
| Reiniciar durante la ejecución | «Listo · 0 pasos» al instante y sigue así 800 ms después (sin timer huérfano); vuelven los datos ingresados, sin barras marcadas y campos habilitados | OK |
| Reiniciar al finalizar | Limpia el resultado y habilita Iniciar, Paso y los campos | OK |
| Cambiar el intervalo durante la ejecución | El selector no se bloquea; el nuevo intervalo se aplica desde el paso siguiente, sin duplicar timers | OK |
| Reiniciar después de un error de validación | Restaura los últimos datos válidos, pero el mensaje de error y `aria-invalid="true"` siguen visibles | **D-I6-05-1** |

**D-I6-05-1 (menor, para I3, `src/ui-i3/demos/algoritmos.js`).** Pasos: escribir `1,a`, pulsar Paso y luego Reiniciar. El campo vuelve a un valor válido, pero sigue mostrando el error. Corrección sugerida: en el manejador de Reiniciar, vaciar `#datos-error` y `#objetivo-error` y poner `aria-invalid="false"` en ambos campos.

Observación de texto, para I3: el estado dice «1 pasos»; podría usar el singular.

No probado aquí: pausa automática al ocultar la pestaña y movimiento reducido (corresponden a A37, revisión de I3).

## 8. Comparación de cifras con SQL directa (I6 09)

Fecha: 2026-11-09, 23:20 (hora de Argentina; en UTC ya era 10/11) · Versión: `main` 858d4e4 · Rol: administrador · Base: `portfolio_dev`.

Control: `docs/evidencias/i6-09-comparar-metricas.sql`. Agrupa cada fila por su fecha de Argentina (`AT TIME ZONE … ::date`), un método distinto al del repositorio de I2, que calcula los límites UTC del rango. Entre la consulta y la API no se navegó por páginas que cuenten visitas.

| Dato (SQL) | Valor |
|---|---|
| 2026-11-09 | 6 visitas, 3 accesos, 1 cuenta, consultas 1 general, 1 cotización y 1 asesoría |
| Otros días | Sin eventos |
| Eventos de esa noche que en UTC ya son 10/11 | 4 visitas, 3 accesos, 1 cuenta, 1 consulta |
| Visitas `es_prueba` | 0 |
| Cuentas por rol | 1 administrador |

| Petición a `GET /api/admin/metricas` | Obtenido | Comparación |
|---|---|---|
| Sin filtros | Rango 03/11–09/11 (7 días); 6 / 3 / 1 / 3 | Igual a SQL. El «hoy» del servidor es 09/11 aunque en UTC sea 10/11 |
| 11/10 a 09/11 (30 días) | 30 días; 6 / 3 / 1 / 3 | Igual |
| Solo 09/11 | 6 / 3 / 1 / 3. Incluye los eventos posteriores a las 21:00 | Igual: el día argentino termina a medianoche local |
| Solo 08/11 | Todo en 0 | Igual: los eventos de la noche del 09 no se corren de día |
| 09/11 con tipo cotización | Consultas 1 (0/1/0); visitas, accesos y cuentas sin cambio | Igual |
| Solo 10/11 | 400 `PARAMETRO_INVALIDO` (fecha futura en Argentina) | Correcto |
| 01/08 a 09/11 (más de 90 días) | 400 `PARAMETRO_INVALIDO` | Correcto |
| Tarjetas y tabla de `/admin/metricas` | 6 / 3 / 1 / 3; dona 33 % por tipo | Igual a la API |

Resultado: **OK**. Las cifras de visitas, accesos, cuentas y consultas coinciden con la base, también en el límite de medianoche entre Argentina y UTC.

Observaciones:
- Solo había datos de un día. La agregación de varios días está cubierta por la prueba automática de I2 con el dataset de §3 (T20).
- «Cuentas creadas» cuenta todos los roles, incluida la cuenta de administrador creada por script. Si el contrato pide solo cuentas `registrado`, lo decide I1 y lo ajusta I2.

## 9. A23 manual: base detenida al enviar una consulta

Fecha: 2026-11-10, 00:05 · Versión: `main` 858d4e4 · Rol: visitante · Base: `portfolio_dev` (PostgreSQL 17 local).

| Paso | Obtenido | Estado |
|---|---|---|
| Antes de detener la base | 3 consultas y 4 envíos en `app.consultas` y `app.envios_email` | — |
| Formulario de `/contacto` completo (tipo general, consentimiento marcado) y `Stop-Service postgresql-x64-17` | Servicio en `Stopped`; `/health` responde 503 | — |
| Enviar la consulta | `POST /api/consultas` → **503** `SERVICIO_NO_DISPONIBLE`, `Retry-After: 30`, en 12 ms. La página muestra «El servicio no está disponible y no se guardó nada. Intentá de nuevo en unos minutos.», sin confirmación. El formulario conserva lo escrito y el botón queda habilitado | OK |
| `Start-Service` y contar de nuevo | Siguen 3 consultas y 4 envíos: no se guardó nada | OK |
| Correo | No llegó ninguna notificación a la casilla de prueba: no se llamó a Brevo | OK |
| Recuperación | Sin reiniciar Node, `/health` vuelve a 200 y `/contacto` carga normalmente | OK |

Resultado: **OK**. Con esto, los cinco casos de R02 (A20–A24) están en OK.

Observación para I2: con la base caída, `/health` responde 503 con la página HTML de error y no con `{"ok":false}`, como dice `docs/despliegue.md`. La causa es que la ruta está después de `sessionMiddleware` en `src/app.js`, y la sesión falla primero al no poder leer `app.sesiones`. El estado 503 es correcto para el chequeo de Render. Montar `/health` antes de la sesión devolvería el JSON documentado y evitaría leer la sesión en cada chequeo.
