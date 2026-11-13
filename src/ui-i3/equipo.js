import { readFileSync } from 'node:fs';

// Las fichas son la fuente del contenido público, incluidos los nombres completos.
function cargarFicha(codigo) {
  const texto = readFileSync(new URL(`../../docs/integrantes/${codigo}.md`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const campo = etiqueta => texto.match(new RegExp(`^- \\*\\*${etiqueta}:\\*\\*[ \\t]*(.*)$`, 'm'))?.[1].trim() || '';
  const seccion = titulo => {
    const bloques = texto.split(/^## /m).slice(1);
    const bloque = bloques.find(valor => valor.startsWith(titulo));
    return bloque ? bloque.slice(bloque.indexOf('\n') + 1).trim() : '';
  };
  const parrafo = titulo => (campo(titulo) || seccion(titulo)).replace(/\s+/g, ' ').trim();
  const tecnologias = seccion('Tecnologías').split('\n').filter(linea => /^- /.test(linea)).map(linea => linea.slice(2).trim());
  const enlaces = ['GitHub', 'LinkedIn'].flatMap(nombre => {
    const url = campo(`${nombre} URL`) || campo(nombre);
    try {
      const destino = new URL(url);
      return destino.protocol === 'https:' ? [{ nombre, url: destino.href }] : [];
    } catch { return []; }
  });
  return {
    codigo,
    nombre: campo('Nombre completo') || campo('Nombre'),
    especialidad: campo('Especialidad'),
    presentacion: parrafo('Presentación'),
    formacion: parrafo('Formación'),
    tecnologias,
    enlaces,
    foto: `/media/integrantes/${codigo.toLowerCase()}.webp`,
  };
}

export function obtenerIntegrantes() {
  return Array.from({ length: 6 }, (_, indice) => cargarFicha(`I${indice + 1}`));
}
export const integrantes = obtenerIntegrantes();
