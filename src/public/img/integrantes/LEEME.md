# Fotos de integrantes

Las fotos visibles en la web se guardan en el bucket privado `portfolio-media` de Supabase Storage, bajo `integrantes/i1.webp`, etc.
El servidor las sirve por `/media/integrantes/i1.webp` sin entregar la clave privada al navegador.

Para subir o reemplazar una foto (con las variables de Supabase configuradas en `.env`):

    node --env-file=.env scripts/subir-fotos.js I1 ruta/a/la/foto.png

Después, habilitá el código del integrante en el campo `foto` de `src/ui-i3/equipo.js`.
El script convierte el archivo a WebP y limita su resolución. Esta carpeta contiene originales de revisión; la página ya no los usa directamente.
No subas `.env` a GitHub. En Render configurá las mismas variables de Storage en Environment.
