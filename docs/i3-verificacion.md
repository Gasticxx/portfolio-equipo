# Verificación de I3

## Pruebas repetibles

Ejecutar `node --test tests/i3/*.test.js`. Estas comprobaciones no necesitan PostgreSQL ni variables privadas. La prueba HTTP renderiza vistas y verifica recursos locales y CSP; no sustituye una inspección visual real.

## Revisión manual antes de integrar

- Abrir `node scripts/preview-i3.js` y visitar `http://127.0.0.1:3033/i3`.
- Revisar anchos 360, 576, 768, 992, 1200 y 1400 px; sin desbordes de página ni acciones inaccesibles. Las tablas y barras pueden tener scroll interno.
- Recorrer con Tab y Shift+Tab: salto al contenido, menú, enlaces, campos y acciones. Foco visible. Escape cierra menú/diálogo y devuelve foco.
- Activar reducir movimiento en el sistema: tarjetas visibles sin desplazamiento; visualizador con Paso manual.
- Completar email inválido o campos vacíos: error junto al campo y foco en el primero. Corregir sin perder texto seguro.
- Dejar fotos vacías y probar una URL inexistente: avatar legible. Completar nombres largos y formación extensa.
- Tablero: alta, estado en ambos sentidos, cancelar/eliminar, título inválido y límite 50. La muestra no persiste. Tras integrar, comprobar recarga, fallos HTTP, aislamiento y CSRF con I4/I5.
- Visualizador: búsqueda de ejemplo en un paso, burbuja de ejemplo ascendente; inicio doble, pausa, paso, reinicio, entrada vacía/no entera/fuera de rango y cambio de pestaña. Conectar pruebas de I5 para otros arrays, duplicados y no encontrado.
- I6: filtros móviles, leyendas y tabla complementaria con cifras reales; fallo de carga conserva filtros y no muestra cero como si fuera una métrica válida.
- Revisar sesión/roles en aplicación integrada y obtener revisión de I1. No marcar tareas de integración como terminadas por haber visto el prototipo.

## Resultado de esta entrega

Se ejecutaron comprobaciones de sintaxis y renderizado HTTP. La herramienta de navegador no pudo abrir la vista porque su host no estaba disponible; no se certifica revisión visual en navegador, responsive real ni interacción con teclado en esta sesión. La lista anterior queda como verificación pendiente junto con la integración de los módulos de otros responsables.
