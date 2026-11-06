# Manual visual de I3

## Alcance y ejecución

Se agregan archivos nuevos: los archivos originales y el inicio de I2 permanecen intactos. El servidor de revisión se ejecuta con `node scripts/preview-i3.js`, después de `npm.cmd ci` en Windows (o `npm ci` en otros sistemas). Abrir `http://127.0.0.1:3033/i3`. No necesita `.env` ni base de datos. Se limita a loopback; no es un servidor de producción. Puerto opcional: variable `I3_PORT`.

Se implementa la parte de I3 descrita en los documentos aportados: sistema visual, parciales, prototipos de recorridos, estados, accesibilidad y controles de demos. Los documentos son especificaciones de referencia; no autorizan publicaciones, cambios en módulos ajenos ni envío de comunicaciones. La petición del usuario de conservar el original determina la implementación aislada. La revisión de I1 y la integración con las pantallas reales siguen pendientes.

## Identidad visual

Glassmorphism claro: superficies translúcidas sobre fondos suaves, bordes claros, sombras discretas y desenfoque. El contraste lo aporta texto oscuro sobre superficies claras. Los controles y mensajes conservan fondos legibles. En navegadores sin backdrop-filter se usa superficie blanca. No hay fuentes, fotografías, CDN ni scripts externos.

| Token en `src/public/css/app.css` | HEX | Uso |
| --- | --- | --- |
| `--color-fondo` | #F8FAFC | Fondo |
| `--color-superficie` | #FFFFFF | Superficies |
| `--color-texto` | #0F172A | Títulos y cuerpo |
| `--color-secundario` | #475569 | Texto secundario |
| `--color-primario` | #1D4ED8 | Acción principal, enlaces y foco |
| `--color-primario-hover` | #1E40AF | Hover |
| `--color-borde` | #CBD5E1 | Bordes de controles |
| `--color-exito` | #166534 | Confirmación |
| `--color-error` | #B91C1C | Error y eliminación |
| `--color-aviso` | #92400E | Advertencia |

La paleta conserva los tokens de la especificación; el vidrio se agrega como tratamiento de superficie. Sobre blanco, los contrastes aproximados son: texto principal 17.9:1, secundario 7.6:1 y primario 6.7:1. Las superficies translúcidas requieren revisión en la integración si se cambia su fondo; no colocar fotografías directamente detrás de formularios o párrafos.

Fuente local `system-ui, -apple-system, Segoe UI, sans-serif`. Cuerpo 16 px / 1.5; h1 40/32 px, h2 28/24 px, h3 22/20 px, escritorio/móvil. Texto auxiliar de campos 14 px. Pesos 400, 600 y 700. Escala de espaciado 4, 8, 12, 16, 24, 32, 48 y 64 px. Contenedor máximo 1200 px, márgenes 24 px escritorio y 16 px móvil. Tarjetas 12 px de radio, controles 8 px, área táctil mínima 44 px.

## Responsive y componentes

Breakpoints de referencia Bootstrap: 576, 768, 992, 1200 y 1400 px. Perfiles en una columna antes de 768, dos desde 768 y tres desde 992. El menú se pliega antes de 992 para permitir todas las acciones sin recortes. Formularios y tablero pasan a una columna en móvil. Tablas se desplazan dentro de `.table-responsive` con región etiquetada y foco de teclado. Las filas y nombres largos pueden crecer; no truncar contenido importante.

Los parciales están en `src/views/partials/i3/`:

| Parcial | Datos / contrato |
| --- | --- |
| `cabecera` | `titulo`, `rutaActual`, `usuarioActual` (null o `{rol}`) |
| `pie` | Cierra main/body y agrega región de notificación |
| `perfil` | `integrante`: codigo, nombre, especialidad, foto, presentacion |
| `proyecto` | Ejemplo visual de proyecto para adaptar en I5 |
| `campo` | id único, etiqueta, tipo, limite, ayuda, valor; passwords no se repintan |
| `alerta` | tipo (exito/error/aviso), tituloAlerta, mensaje |
| `estado` | estado, tituloEstado, mensaje |
| `tabla` | tituloTabla, columnas y filas de texto escapado |
| `paginacion` | paginas, pagina, base (ruta local definida por el servidor) |

Ejemplo desde una vista de módulo: `include('../partials/i3/perfil', {integrante})`. EJS escapa el contenido con `<%=`; los únicos `<%-` insertan parciales o atributos constantes. No pasar HTML del usuario. Los autores deben adaptar el prefijo `/i3` a las rutas finales al integrar; es un espacio de revisión independiente, no un reemplazo de las rutas acordadas.

Bootstrap se carga localmente y el CSS compartido después. Las interacciones de menú y diálogo usan JavaScript propio, sin scripts inline ni dependencias de estilos dinámicos de Bootstrap. `ui.js` contiene menú, aparición, fallback de imagen, ejemplo de validación y confirmación. Para producción, los validadores y envíos pertenecen al autor del módulo, con validación adicional en servidor. No usar la validación de muestra como política de autenticación.

## Fotos e información del equipo

Editar `src/ui-i3/equipo.js`: nombre, especialidad, presentacion, formacion, tecnologias y enlaces. Guardar retratos en `src/public/img/integrantes/` y asignar, por ejemplo, `foto: '/img/integrantes/i3.webp'`. Una cadena vacía conserva el avatar I3. Una imagen fallida también muestra el avatar. Usar imágenes cuadradas y `object-fit: cover`. No se inventan nombres, títulos, experiencia ni contribuciones terminadas. I1 integrará las fichas verificadas; I5 conectará Storage si corresponde.

## Las cuatro animaciones

1. Botones: transición de fondo, sombra y desplazamiento sutil de 150 ms.
2. Menú móvil: apertura con opacidad y desplazamiento de 180 ms; Escape cierra y devuelve el foco.
3. Tarjetas: IntersectionObserver, opacidad y translateY de 12 px durante 220 ms. El contenido está visible si JavaScript o IntersectionObserver faltan.
4. Visualizador: pasos a 200, 500 o 1000 ms. Pausa, Paso y Reiniciar; no hay ejecuciones simultáneas y se cancelan temporizadores al salir u ocultar la pestaña.

`prefers-reduced-motion: reduce` elimina efectos decorativos y deja Paso manual en el visualizador. Si la preferencia cambia durante la ejecución, se pausa. Ningún resultado depende solo del color o de una animación.

## Formularios y estados

Etiquetas persistentes, ayuda y error con `aria-describedby`, `aria-invalid` y foco en el primer campo incorrecto. La muestra conserva entradas seguras y limpia contraseñas tras revisar. La integración debe limpiar también contraseñas ante fallos del backend. Mensajes de carga, vacío, error y éxito disponibles en `/i3/componentes`. Un estado correcto solo se muestra después de una respuesta confirmada del adaptador; no confundir error de red con guardado.

Confirmación con dialog nativo: título accesible, Cancelar inicialmente enfocado, Escape y devolución de foco. Regiones `role=status` para resultados; errores importantes con `role=alert`. Navegación semántica, salto a contenido y foco visible. La navegación por rol es presentación: I4 debe autorizar cada ruta en servidor. El botón Salir emite `equipo:salir`; I4 conecta el POST con CSRF. No provoca cierre de sesión por GET.

## Demos y límites de integración

El código de demos está fuera de public, en `src/ui-i3/demos/`. El servidor de revisión expone solamente muestras identificadas, sin datos privados ni algoritmos finales. No trasladar los recursos privados al directorio público.

Tablero: interfaz funcional de alta, estados y eliminación con confirmación. En la muestra vive solo en memoria y se pierde al recargar. I5 inyecta `window.tableroAdapter` con `listar()`, `crear(titulo)`, `cambiar(id,estado)` y `eliminar(id)`, funciones async que rechazan ante error. Retornan objetos `{id,titulo,estado}` (listar retorna un array). Estados: pendiente, progreso, completada. El adaptador real llama los endpoints acordados con CSRF, verifica HTTP antes de confirmar y traduce errores. El servidor debe validar longitud, límite 50, propiedad y persistencia; esta UI no reemplaza esas reglas. Al integrar, retirar `data-modo="muestra"`.

Visualizador: I5 inyecta `window.algoritmosAdapter.generar({algoritmo,datos,objetivo})`, función sincrónica que retorna pasos `{valores:number[], activos:number[], comparacion:string, encontrado?:number, resultado?:string}`. Índices internos desde 0, posiciones visibles desde 1; `resultado` se coloca en el último paso. El motor y sus pruebas pertenecen a I5. El fallback de revisión tiene exclusivamente dos secuencias fijas: búsqueda [4,2,4] de 4, un paso y posición 1; burbuja [3,1,2], resultado [1,2,3]. Otras entradas muestran un aviso de integración; no se presentan como algoritmo implementado. La UI valida 1–20 enteros de -99 a 99, no evalúa código y bloquea entradas hasta Reiniciar.

I4 e I5 deben servir las vistas finales desde `/demos/:id` y los recursos desde `/demos/:id/recurso.js`, con sesión, publicación y autorización comprobadas. El namespace `/i3/muestras` es solo de revisión y no debe montarse en la aplicación productiva.

## Transferencia y cierre

I1 revisa textos, coherencia y recorridos; I2 integra layout/rutas; I4 integra sesión y formularios; I5 adaptadores, imágenes y demos; I6 integra contacto, filtros y gráficos. Los gráficos deben tener tabla o cifras complementarias. `/i3/panel` es un boceto vacío, sin métricas inventadas.

Consultar `docs/i3-recorridos.md` y `docs/i3-verificacion.md`. No se declara el cierre completo de I3 hasta integrar con los módulos reales, revisar cada rol y obtener revisión independiente de I1.
