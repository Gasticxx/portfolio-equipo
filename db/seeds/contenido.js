// Datos iniciales del portfolio (apartado 20 de la especificación).
// Este archivo solo contiene datos: la lógica de carga está en scripts/seed.js.
// No incluye contraseñas, claves ni cuentas: las cuentas se crean con npm run cuenta:crear.

export const TECNOLOGIAS = [
  'HTML',
  'CSS',
  'JavaScript',
  'Bootstrap',
  'EJS',
  'Node.js',
  'Express',
  'PostgreSQL',
  'Chart.js',
  'Git',
  'GitHub',
  'Supabase Storage',
  'Brevo',
];

const PRESENTACION = (especialidad) =>
  `Mi responsabilidad en este proyecto es ${especialidad}. ` +
  'En esta ficha se registran las tecnologías que utilizo y los aportes que se comprueban durante el desarrollo.';

// Los nombres de I1, I2 e I4 salen de sus fichas en docs/integrantes.
// Los de I3, I5 e I6 son provisionales hasta que cada autor publique su ficha:
// se corrigen con una migración nueva (UPDATE), no editando este archivo después de integrado.
const FILAS_MIEMBROS = [
  [1, 'Ignacio Ucciardello', 'Producto y servicios'],
  [2, 'Gaston Exequiel Lopez Iñigo', 'Backend e integración'],
  [3, 'Integrante 3', 'Diseño e interfaces'],
  [4, 'Facundo Casal', 'Autenticación y usuarios'],
  [5, 'Mateo Mendoza', 'Datos y proyectos'],
  [6, 'Integrante 6', 'Contacto y métricas visuales'],
];

export const MIEMBROS = FILAS_MIEMBROS.map(([orden, nombre, especialidad]) => ({
  slug: `integrante-${orden}`,
  nombre,
  especialidad,
  presentacion: PRESENTACION(especialidad),
  formacion: 'Formación académica en curso.',
  githubUrl: null,
  linkedinUrl: null,
  orden,
}));

export const PROYECTO = {
  slug: 'portfolio-equipo',
  titulo: 'Portfolio de Reflection Tech',
  resumen:
    'Portfolio colectivo con seis perfiles, proyectos protegidos, demos interactivas y gestión de consultas, usuarios y métricas.',
  descripcion:
    'Este proyecto reúne la presentación del equipo y el desarrollo de una aplicación fullstack con Express, EJS y PostgreSQL. ' +
    'Su alcance incluye identidad, administración de contenido, contacto por correo y análisis de visitas. ' +
    'Se encuentra en desarrollo y cada contribución identifica a su responsable y su estado real.',
  estado: 'desarrollo',
  publicado: true,
  tecnologias: ['HTML', 'CSS', 'JavaScript', 'Bootstrap', 'EJS', 'Node.js', 'Express', 'PostgreSQL'],
};

// Ambas demos nacen sin publicar: se publican al pasar sus pruebas.
export const DEMOS = [
  {
    tipo: 'tablero',
    titulo: 'Tablero personal de tareas',
    descripcion:
      'Demo interactiva para crear tareas propias, cambiar su estado y eliminarlas. Cada cuenta ve solo sus tareas.',
    orden: 1,
  },
  {
    tipo: 'algoritmos',
    titulo: 'Visualizador de búsqueda y ordenamiento',
    descripcion:
      'Demo que muestra paso a paso la búsqueda lineal y el ordenamiento burbuja sobre listas de enteros.',
    orden: 2,
  },
];

export const SERVICIOS = [
  {
    nombre: 'Desarrollo de sitios web',
    categoria: 'web',
    orden: 1,
    descripcion:
      'Construcción de sitios adaptables con presentación institucional, formularios y gestión de contenido.',
  },
  {
    nombre: 'Mantenimiento de aplicaciones',
    categoria: 'mantenimiento',
    orden: 2,
    descripcion:
      'Revisión y mejora de interfaces, corrección de errores y actualización de funciones de aplicaciones.',
  },
  {
    nombre: 'Asesoría técnica',
    categoria: 'asesoria',
    orden: 3,
    descripcion: 'Orientación sobre estructura, tecnologías y alcance de un proyecto de software.',
  },
];

// Un aporte inicial por integrante, siempre en estado "asignado".
// Los textos son provisionales: cada autor los ajusta al avanzar y agrega su evidencia.
export const APORTES = [
  {
    miembro: 'integrante-1',
    titulo: 'Módulo de Equipo y Servicios',
    descripcion:
      'Vistas públicas de inicio, equipo y perfiles individuales, y administración de servicios.',
  },
  {
    miembro: 'integrante-2',
    titulo: 'Backend, métricas y despliegue',
    descripcion:
      'Aplicación base, seguridad compartida, registro de visitas, métricas y publicación en Render.',
  },
  {
    miembro: 'integrante-3',
    titulo: 'Identidad visual e interfaces',
    descripcion: 'Diseño de la interfaz, componentes compartidos y presentación de las demos.',
  },
  {
    miembro: 'integrante-4',
    titulo: 'Autenticación y usuarios',
    descripcion: 'Registro, ingreso, sesiones, roles y protección de rutas.',
  },
  {
    miembro: 'integrante-5',
    titulo: 'Modelo de datos, proyectos e imágenes',
    descripcion:
      'Migraciones y datos iniciales, administración de proyectos y demos, y almacenamiento de imágenes.',
  },
  {
    miembro: 'integrante-6',
    titulo: 'Contacto y métricas visuales',
    descripcion: 'Formulario de contacto, envío de correos, respuestas y gráficos de visitas.',
  },
];