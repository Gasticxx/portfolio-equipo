import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { convertirPortada, crearArchivosService } from '../../src/services/archivos.service.js';
import { proyectoQuerySchema } from '../../src/validators/proyectos.validator.js';

test('Proyectos: paginación por defecto produce números y rechaza arrays', () => {
  assert.deepEqual(proyectoQuerySchema.parse({}), { page: 1, pageSize: 10 });
  assert.equal(proyectoQuerySchema.safeParse({ page: ['1', '2'] }).success, false);
});
test('Portadas: valida contenido real, dimensiones y reencode a WebP', async () => {
  const png = await sharp({ create: { width: 3000, height: 100, channels: 3, background: '#5544cc' } }).png().toBuffer();
  const result = await convertirPortada(png);
  assert.equal(result.info.format, 'webp'); assert.equal(result.info.width, 2400); assert.equal(result.info.height, 80);
  for (const buffer of [Buffer.from('<svg></svg>'), Buffer.from('falso.png'), Buffer.alloc(0)]) await assert.rejects(convertirPortada(buffer), error => error.status === 422);
  const chica = await sharp({ create: { width: 40, height: 100, channels: 3, background: '#000' } }).png().toBuffer();
  await assert.rejects(convertirPortada(chica), error => error.status === 422);
  await assert.rejects(convertirPortada(Buffer.alloc(6 * 1024 * 1024)), error => error.status === 413);
});
test('Portadas: Storage usa la clave secreta por apikey y compensa si falla la inserción', async t => {
  const old = { SUPABASE_URL: process.env.SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY };
  process.env.SUPABASE_URL = 'https://storage.example.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_fixture';
  t.after(() => { for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const llamadas = [];
  const http = async (url, options) => { llamadas.push({ url, ...options }); return new Response('{}', { status: 200 }); };
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#000' } }).png().toBuffer();
  const service = crearArchivosService({ query: async () => { throw new Error('Fallo de prueba'); } }, http);
  await assert.rejects(service.crear(png, 1), error => error.status === 503);
  assert.deepEqual(llamadas.map(c => c.method), ['POST', 'DELETE']);
  assert.equal(llamadas[0].headers.apikey, 'sb_secret_fixture'); assert.equal(llamadas[0].headers.Authorization, undefined);
  assert.match(llamadas[0].url, /\/portadas\/[a-f0-9-]+\.webp$/);
  assert.equal(JSON.parse(llamadas[1].body).prefixes[0], llamadas[0].url.split('/portfolio-media/')[1]);
});
