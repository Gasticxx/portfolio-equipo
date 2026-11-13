# Laboratorio de ondas

Demo `ondas`, integrada en `/demos/:id` y en el editor de Administración → Demos.
El recurso `/demos/:id/recurso.js` combina el motor y la interfaz como módulo ES.
Requiere una cuenta registrada, operadora o administradora, demo publicada y
proyecto publicado. Sin sesión, la página redirige al login y el recurso responde
401. Una demo o un proyecto ocultos responden 404 sin entregar el código.

## Uso

- Arranca con dos fuentes en fase. Los escenarios son Interferencia, En oposición,
  Una fuente y Seis fuentes.
- Tocar un espacio libre agrega un emisor, hasta seis. Arrastrar su círculo lo mueve.
  Seleccionar un emisor desde los botones permite moverlo mediante los controles
  horizontal/vertical e invertir su fase 180 grados. El canvas también admite las
  flechas del teclado; Mayús aumenta el desplazamiento.
- Frecuencia: 0,2–3 Hz. Amplitud: 0–100 %. Propagación: 10–70 unidades del modelo/s.
- Pausar/Reanudar conserva el instante. Un paso pausa y avanza 0,2 segundos.
  Reiniciar restaura dos fuentes, parámetros iniciales y tiempo cero.
- La pausa global, movimiento reducido, pestaña oculta, pérdida de foco y salida
  de la página detienen la reproducción. Con movimiento reducido se puede seguir
  explorando mediante los controles y Un paso.
- La ficha administrativa persiste en PostgreSQL. Los ajustes del experimento son
  temporales: se reinician al recargar o salir y no generan escrituras de tareas.

## Modelo y dibujo

Se suman ondas sinusoidales radiales con retardo distancia/velocidad, entrada suave
del frente y atenuación visual por distancia. Se usa un medio uniforme sin rebotes
ni obstáculos; es una representación didáctica, no un simulador físico completo.
La distancia se calcula con la proporción real del escenario, conservando círculos
al cambiar su tamaño. Cian indica amplitud positiva, violeta negativa y oscuro
equilibrio. Las fuentes en oposición cancelan el eje central si son simétricas.

Canvas 2D, sin dependencias nuevas. Un solo requestAnimationFrame; el tiempo usa
el intervalo real entre cuadros, acotado a 50 ms al retomar. El campo se calcula
en un buffer de hasta aproximadamente 22.000 celdas, con distancias cacheadas.
El dibujo visible limita densidad a 1,5 y dimensiones a 1200 × 900 píxeles.
Si se acumulan cuadros costosos, baja la resolución del campo. Los controles
responden incluso con reproducción detenida y no crean bucles adicionales.

## Activación en PostgreSQL

Nueva migración: `db/migrations/005_ondas.sql`. Amplía `demos_tipo_ck` sin borrar
datos y agrega la experiencia al proyecto `portfolio-equipo` si está publicado.
No duplica una demo del mismo tipo que ya exista en ese proyecto. Las migraciones
anteriores no se modifican. El seed también incluye la nueva ficha, en borrador
para instalaciones nuevas, siguiendo las convenciones del repositorio.

I5 debe aplicar las migraciones pendientes con la conexión propietaria configurada
en MIGRATION_DATABASE_URL; la conexión portfolio_app se usa para la aplicación.

```powershell
npm run db:migrate
```

Después de reiniciar la aplicación, abrir Demos → Laboratorio de ondas. También se
puede crear o editar la ficha desde Administración → Demos, eligiendo el tipo Ondas.
Si el portfolio no existe o no está publicado al migrar, crear la ficha desde ese
editor y publicarla una vez publicado el proyecto. El panel solo habilita tipos
que ya están admitidos por la restricción de la base conectada.

Comprobación de esta entrega: 005 aplicada exclusivamente en portfolio_test local.
La base compartida configurada en .env respondió a una lectura de metadatos:
todavía no admite ondas y portfolio_app no es propietario de app.demos. No se
ejecutaron migraciones ni se escribieron demos en Supabase.

## Verificación

```powershell
npm test
```

Resultado final: **166 pruebas aprobadas, 0 fallidas, 0 omitidas**.

Se cubren el frente causal, superposición, cancelación por fase, amplitud cero,
límites de controles y escenarios independientes. Integración con PostgreSQL:
alta y edición administrativas, catálogos, persistencia, publicación y permisos.

Chrome headless sobre Express y portfolio_test: cambios del campo entre cuadros,
arrastre real con mouse, flechas, controles, escenarios, seis fuentes como máximo,
eliminación, pausa, paso, reinicio, pausa global, salida/regreso y movimiento
reducido. Un único RAF pendiente como máximo, sin cuadros pendientes en pausa.
Se revisaron ambos temas y anchos 1440, 768, 390 y 320, sin desbordes ni errores JS.
La medición de una ejecución local registró aproximadamente 2,5 ms por cuadro de
la demo; no garantiza ese tiempo en otros equipos ni incluye el fondo global.
El proyecto, demo, cuenta y sesión visuales temporales se eliminaron al terminar.

Pendiente: I5 aplica la migración en la base compartida y se repite el recorrido
en la URL final con la versión integrada.
