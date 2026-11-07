// Contenido de muestra para revisar componentes. I1 integra las fichas reales.
export const integrantes = [
  ['I1', 'Producto y servicios'], ['I2', 'Backend e integración'],
  ['I3', 'Diseño e interfaces'], ['I4', 'Autenticación y usuarios'],
  ['I5', 'Datos y proyectos'], ['I6', 'Contacto y métricas visuales'],
].map(([codigo, especialidad]) => ({
  codigo, nombre: `Integrante ${codigo.slice(1)}`, especialidad,
  foto: '', // Ejemplo: /img/integrantes/i3.webp. Dejar vacío conserva el avatar.
  presentacion: `Mi responsabilidad en este proyecto es ${especialidad.toLowerCase()}.`,
  formacion: 'Formación académica en curso.', tecnologias: [], enlaces: [],
}));
