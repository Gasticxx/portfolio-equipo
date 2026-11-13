import { Router } from 'express';
import { obtenerFotoStorage } from '../services/fotos-storage.js';

export const fotosRouter = Router();
// Lista cerrada: no permite leer otros objetos del bucket privado.
fotosRouter.get('/media/integrantes/:archivo', async (req, res) => {
  if (!/^i[1-6]\.webp$/.test(req.params.archivo)) return res.sendStatus(404);
  try {
    const respuesta = await obtenerFotoStorage(req.params.archivo.slice(0, 2));
    if (!respuesta.ok) return res.sendStatus(respuesta.status === 404 ? 404 : 502);
    const contenido = Buffer.from(await respuesta.arrayBuffer());
    res.set('Cache-Control', 'public, max-age=300').type('image/webp').send(contenido);
  } catch { res.sendStatus(503); }
});
