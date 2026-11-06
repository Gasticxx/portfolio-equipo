import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import ejs from 'ejs';
import path from 'node:path';
import { crearPreview } from '../../scripts/preview-i3.js';
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
  for(const ruta of enlaces)await request(app).get(ruta).expect(200);
});
test('seis fichas tienen espacios para fotos, sin inventar identidad',async()=>{
  const {text}=await request(app).get('/i3/equipo').expect(200);
  assert.equal((text.match(/Espacio para tu foto/g)||[]).length,6);
  for(let i=1;i<=6;i++)assert.match(text,new RegExp(`Integrante ${i}`));
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
