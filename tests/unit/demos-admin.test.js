import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { crearDemosAdminRouter } from '../../src/routes/demos-admin.routes.js';
import { env } from '../../src/config/env.js';

const token = 'a'.repeat(64);
const datos = { proyecto_id: 1, titulo: 'Demo de prueba', descripcion: 'Descripción de prueba', tipo: 'tablero', publicada: false, orden: 1 };
function montar(db) {
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { req.user = req.get('X-Rol') ? { rol: req.get('X-Rol') } : null; req.session = { csrfToken: token }; next(); });
  app.use(crearDemosAdminRouter(db));
  app.use((err, req, res, next) => res.status(err.status || 500).json({ ok: false, error: { code: err.code, message: err.message } }));
  return app;
}
const escribir = (app, metodo, ruta, body = datos) => request(app)[metodo](ruta).set('X-Rol','administrador').set('Origin',env.APP_ORIGIN).set('X-CSRF-Token',token).send(body);

test('demos admin: anónimo y operador no leen ni escriben', async () => {
  let llamadas = 0; const app = montar({ query: async () => { llamadas++; return {rows:[]}; } });
  await request(app).get('/api/admin/demos').expect(401);
  await request(app).get('/admin/demos').set('X-Rol','operador').expect(403);
  await request(app).post('/api/admin/demos').set('X-Rol','registrado').send(datos).expect(403);
  assert.equal(llamadas,0);
});
test('demos admin: CSRF y validación impiden escrituras inválidas', async () => {
  let llamadas = 0; const app = montar({ query: async () => { llamadas++; return {rows:[]}; } });
  await request(app).post('/api/admin/demos').set('X-Rol','administrador').send(datos).expect(403);
  await escribir(app,'post','/api/admin/demos',{...datos,publicada:'true'}).expect(422);
  await escribir(app,'post','/api/admin/demos',{...datos,tipo:'javascript'}).expect(422);
  await escribir(app,'put','/api/admin/demos/1x').expect(400);
  assert.equal(llamadas,0);
});
test('demos admin: listado incluye proyectos y borradores', async () => {
  const app = montar({ query: async sql => ({ rows: sql.includes('d.*') ? [{id:2,publicada:false}] : [{id:1,publicado:true}] }) });
  const r = await request(app).get('/api/admin/demos').set('X-Rol','administrador').expect(200);
  assert.equal(r.body.data.demos[0].publicada,false); assert.equal(r.body.data.proyectos[0].id,1);
});
test('demos admin: crea y edita con parámetros SQL y conserva tipo/proyecto', async () => {
  const llamadas=[]; const app=montar({query:async (sql,args)=>{llamadas.push({sql,args});return {rows:[{id:7}]};}});
  await escribir(app,'post','/api/admin/demos',{...datos,titulo:"Título ' seguro"}).expect(201);
  await escribir(app,'put','/api/admin/demos/7',{...datos,publicada:true}).expect(200);
  assert.equal(llamadas[0].args[1],"Título ' seguro"); assert.ok(!llamadas[0].sql.includes("Título ' seguro"));
  assert.ok(llamadas[1].sql.includes('AND proyecto_id=$1 AND tipo=$4')); assert.equal(llamadas[1].args[4],true);
});
test('demos admin: duplicados y proyecto ausente tienen mensajes útiles', async () => {
  for(const [code,status] of [['23505',409],['23503',422]]) {
    const app=montar({query:async()=>{throw Object.assign(new Error('db'),{code});}});
    await escribir(app,'post','/api/admin/demos').expect(status);
  }
});
import { demosRouter } from '../../src/routes/demos.routes.js';
import { tableroRouter } from '../../src/routes/tablero.routes.js';
import { pool } from '../../src/config/db.js';
import path from 'node:path';

function montarPublico() {
  const app=express(); app.set('views',path.resolve('src/views'));app.set('view engine','ejs');
  app.use((req,res,next)=>{req.user=req.get('X-Rol')?{id:17,rol:req.get('X-Rol')}:null;res.locals.usuarioActual=req.user;res.locals.baseUi='';next();});
  app.use(demosRouter);app.use(tableroRouter);
  app.use((err,req,res,next)=>res.status(err.status||500).json({error:{code:err.code}}));return app;
}
test('tablero canónico: script exige sesión y la página conserva el ID de demo',async t=>{
  const app=montarPublico();
  t.mock.method(pool,'query',async()=>({rows:[{id:9,tipo:'tablero',titulo:'Tablero publicado',proyecto_slug:'ejemplo'}]}));
  await request(app).get('/demos/9/recurso.js').expect(401);
  const r=await request(app).get('/demos/9').set('X-Rol','registrado').expect(200);
  assert.ok(r.text.includes('data-demo-id="9"'));
  await request(app).get('/demos/9/recurso.js').set('X-Rol','registrado').expect(200).expect('Content-Type',/javascript/);
});
test('tablero: demo y usuario se incluyen en la consulta de tareas',async t=>{
  const consultas=[];
  t.mock.method(pool,'query',async(sql,args)=>{consultas.push({sql,args});return {rows:sql.includes('JOIN app.proyectos')?[{id:9}]:[]};});
  const app=montarPublico();await request(app).get('/api/tablero/tareas?demoId=9').set('X-Rol','registrado').expect(200);
  assert.deepEqual(consultas[0].args,[9]);assert.deepEqual(consultas[1].args,[9,17]);
  assert.ok(consultas[0].sql.includes('d.publicada=true AND p.publicado=true'));
});
test('tablero: una demo despublicada no permite acceder a tareas',async t=>{
  t.mock.method(pool,'query',async()=>({rows:[]}));
  await request(montarPublico()).get('/api/tablero/tareas?demoId=9').set('X-Rol','registrado').expect(404);
  await request(montarPublico()).get('/tablero').set('X-Rol','registrado').expect(404);
});
test('panel demos renderiza con contenido escapado y formulario accesible',async()=>{
  const app=express();app.set('views',path.resolve('src/views'));app.set('view engine','ejs');
  app.use((req,res,next)=>{req.user={rol:'administrador'};res.locals.usuarioActual=req.user;res.locals.baseUi='';next();});
  app.use(crearDemosAdminRouter({query:async()=>({rows:[]})}));
  const r=await request(app).get('/admin/demos').expect(200);
  assert.ok(r.text.includes('id="demo-form"'));assert.ok(r.text.includes('role="status"'));assert.ok(r.text.includes('</html>'));
});

test('calendario: aparece en gestión y tiene recurso protegido para cuentas con sesión',async t=>{
  const app=montarPublico();
  t.mock.method(pool,'query',async()=>({rows:[{id:11,tipo:'calendario',titulo:'Calendario interactivo',proyecto_slug:'ejemplo'}]}));
  await request(app).get('/demos/11/recurso.js').expect(401);
  const pagina=await request(app).get('/demos/11').set('X-Rol','registrado').expect(200);
  assert.ok(pagina.text.includes('data-calendario'));
  assert.ok(pagina.text.includes('type="module" src="/demos/11/recurso.js"'));
  const recurso=await request(app).get('/demos/11/recurso.js').set('X-Rol','registrado').expect(200);
  assert.ok(recurso.text.includes('export function calcularMes'));
  const admin=montar({query:async()=>({rows:[{id:11}]})});
  await escribir(admin,'post','/api/admin/demos',{...datos,tipo:'calendario'}).expect(201);
});
