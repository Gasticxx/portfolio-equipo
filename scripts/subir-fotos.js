import sharp from 'sharp';
import { configurarStorage } from '../src/services/fotos-storage.js';

// Uso: node --env-file=.env scripts/subir-fotos.js I1 ruta/foto.png
const [codigo, archivo] = process.argv.slice(2);
if (!/^I[1-6]$/.test(codigo || '') || !archivo) {
  console.error('Uso: node --env-file=.env scripts/subir-fotos.js I1 ruta/foto.png');
  process.exitCode = 1;
} else {
  try {
    const { base, headers } = configurarStorage();
    const imagen = await sharp(archivo).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    const respuesta = await fetch(`${base}/${codigo.toLowerCase()}.webp`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
      body: imagen, signal: AbortSignal.timeout(30000),
    });
    if (!respuesta.ok) throw new Error(`Storage respondió HTTP ${respuesta.status}. Revisá la clave y el bucket privado portfolio-media.`);
    console.log(`Foto de ${codigo} subida a Supabase Storage.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
