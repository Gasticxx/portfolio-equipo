import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import ejs from 'ejs';
import path from 'node:path';
import { crearPreview } from '../../scripts/preview-i3.js';
import { integrantes } from '../../src/ui-i3/equipo.js';
const app=crearPreview();
const rutas=['/i3','/i3/equipo','/i3/equipo/I1','/i3/equipo/I2','/i3/equipo/I3','/i3/equipo/I4','/i3/equipo/I5','/i3/equipo/I6','/i3/servicios','/i3/proyectos','/i3/detalle','/i3/contacto','/i3/login','/i3/registro','/i3/componentes','/i3/panel','/i3/muestras/tablero','/i3/muestras/algoritmos'];
test('todos los recorridos renderizan y sus enlaces locales resuelven',async()=>{
  const enlaces=new Set();
  for(const ruta of rutas){
    const respuesta=await request(app).get(ruta).expect(200);
    assert.match(respuesta.text,/<html lang="es">/);
    assert.match(respuesta.text,/id="contenido"/);
    assert.match(respuesta.headers['content-security-policy'],/script-src 'self'/);
    assert.doesNotMatch(respuesta.text,/<script(?![^>]*\bsrc=)[^>]*>/);
    for(const match of respuesta.text.matchAll(/(?:href|src)="(\/[^"#]*)"/g))enlaces.add(match[1]);
  }
  // Las fotos remotas se verifican aparte; la suite no requiere credenciales de producción.
  for(const ruta of enlaces)if(!ruta.startsWith('/media/integrantes/'))await request(app).get(ruta).expect(200);
});
test('seis fichas muestran los nombres reales y conservan el respaldo de foto',async()=>{
  const {text}=await request(app).get('/i3/equipo').expect(200);
  assert.equal((text.match(/Espacio para tu foto/g)||[]).length,6);
  assert.equal(integrantes.length,6);
  for(const integrante of integrantes) {
    assert.ok(integrante.nombre.trim(), `Falta el nombre de ${integrante.codigo}`);
    assert.doesNotMatch(integrante.nombre, /^Integrante \d+$/, `Se perdieron los datos reales de ${integrante.codigo}`);
    assert.ok(integrante.tecnologias.length > 0, `Faltan las tecnologías de ${integrante.codigo}`);
    assert.equal(integrante.foto, `/media/integrantes/${integrante.codigo.toLowerCase()}.webp`);
    assert.ok(text.includes(ejs.escapeXML(integrante.nombre)), `No se muestra ${integrante.codigo}`);
  }
});

test('perfil integra presentación, formación, tecnologías y enlaces de la ficha',async()=>{
  const {text}=await request(app).get('/i3/equipo/I3').expect(200);
  const integrante=integrantes.find(i=>i.codigo==='I3');
  for(const valor of [integrante.presentacion, integrante.formacion, integrante.tecnologias.join(' · ')]) {
    assert.ok(valor.trim(), 'La ficha debe contener presentación, formación y tecnologías');
    assert.ok(text.includes(ejs.escapeXML(valor)));
  }
  for(const enlace of integrante.enlaces)assert.ok(text.includes(ejs.escapeXML(enlace.url)));
  assert.doesNotMatch(text,/href="null"/);
});
test('perfiles desconocidos y recursos privados no se exponen',async()=>{
  for(const ruta of ['/i3/equipo/I7','/demos/1','/demos/1/recurso.js','/ui-i3/equipo.js','/.env','/app.js'])await request(app).get(ruta).expect(404);
});
test('contenido de perfil se escapa en EJS',async()=>{
  const html=await ejs.renderFile(path.resolve('src/views/partials/i3/perfil.ejs'),{integrante:{codigo:'I3',nombre:'<script>alert(1)</script>',foto:'',especialidad:'Diseño',presentacion:'<b>texto</b>'}});
  assert.doesNotMatch(html,/<script>/);assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;b&gt;/);
});
test('navegación muestra acciones por rol sin sustituir autorización',async()=>{
  for(const rol of [null,'registrado','operador','administrador']){
    const html=await ejs.renderFile(path.resolve('src/views/partials/i3/cabecera.ejs'),{titulo:'Prueba',rutaActual:'/i3',usuarioActual:rol?{rol}:null});
    assert.equal(html.includes('>Registrarse</a>'),rol===null);
    assert.equal(html.includes('>Mi cuenta</a>'),rol!==null);
    assert.equal(html.includes('>Consultas</a>'),['operador','administrador'].includes(rol));
    assert.equal(html.includes('>Administración</a>'),rol==='administrador');
  }
});
