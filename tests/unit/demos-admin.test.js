import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { crearDemosAdminRouter } from '../../src/routes/demos-admin.routes.js';
import { demoSchema } from '../../src/validators/demos-admin.validator.js';
import { env } from '../../src/config/env.js';
const token='a'.repeat(64);
const datos={proyectoId:1,titulo:'Demo de prueba',descripcion:'Una descripcion completa para probar la demo.',tipo:'tablero',publicada:false,orden:1};
function montar(db){const app=express();app.use(express.json());app.use((req,res,next)=>{req.user=req.get('X-Rol')?{rol:req.get('X-Rol')}:null;req.session={csrfToken:token};next();});app.use(crearDemosAdminRouter(db));app.use((err,req,res,next)=>res.status(err.status||500).json({ok:false,error:{code:err.code,message:err.message}}));return app;}
const escribir=(app,method,ruta,body=datos)=>request(app)[method](ruta).set('X-Rol','administrador').set('Origin',env.APP_ORIGIN).set('X-CSRF-Token',token).send(body);
test('demos admin: roles y CSRF impiden accesos y escrituras invalidas',async()=>{
 let llamadas=0;const app=montar({query:async()=>{llamadas++;return{rows:[]};}});
 await request(app).get('/api/admin/demos').expect(401);
 await request(app).get('/admin/demos').set('X-Rol','operador').expect(403);
 await request(app).post('/api/admin/demos').set('X-Rol','registrado').send(datos).expect(403);
 await request(app).post('/api/admin/demos').set('X-Rol','administrador').send(datos).expect(403);
 await escribir(app,'post','/api/admin/demos',{...datos,publicada:'true'}).expect(422);
 await escribir(app,'put','/api/admin/demos/1x').expect(400);assert.equal(llamadas,0);
});
test('demos admin: listado paginado y parametros SQL',async()=>{
 const consultas=[];const app=montar({query:async(sql,args)=>{consultas.push({sql,args});return{rows:[{total:1,data:[{id:2,publicada:false}]}]};}});
 const r=await request(app).get('/api/admin/demos').set('X-Rol','administrador').expect(200);
 assert.equal(r.body.data[0].publicada,false);assert.deepEqual(r.body.meta,{page:1,pageSize:10,total:1,totalPages:1});assert.deepEqual(consultas[0].args,[10,0]);
});
test('demos admin: cambia todos los campos en transaccion',async()=>{
 const llamadas=[];const client={query:async(sql,args)=>{llamadas.push({sql,args});if(sql.startsWith('SELECT proyecto_id'))return{rows:[{proyecto_id:1,tipo:'tablero',publicada:false}]};if(sql.startsWith('SELECT EXISTS'))return{rows:[{tiene:false}]};if(sql.startsWith('SELECT id,publicado'))return{rows:[{id:2,publicado:true}]};return{rows:[{id:7}]};},release:()=>llamadas.push({sql:'RELEASE'})};
 const app=montar({connect:async()=>client});
 await escribir(app,'post','/api/admin/demos',{...datos,titulo:"Titulo ' seguro"}).expect(201);
 await escribir(app,'put','/api/admin/demos/7',{...datos,proyectoId:2,tipo:'calendario',publicada:true}).expect(200);
 const insert=llamadas.find(c=>c.sql.startsWith('INSERT')),update=llamadas.find(c=>c.sql.startsWith('UPDATE'));
 assert.equal(insert.args[1],"Titulo ' seguro");assert.ok(!insert.sql.includes("Titulo ' seguro"));assert.deepEqual([update.args[0],update.args[3],update.args[4]],[2,'calendario',true]);assert.equal(llamadas.filter(c=>c.sql==='COMMIT').length,2);assert.equal(llamadas.filter(c=>c.sql==='RELEASE').length,2);
});
test('demos admin: normaliza entrada anterior y rechaza campos desconocidos',()=>{
 const {proyectoId,...rest}=datos;assert.equal(demoSchema.parse({...rest,proyecto_id:proyectoId}).proyectoId,1);
 assert.equal(demoSchema.safeParse({...datos,proyecto_id:2}).success,false);
 assert.equal(demoSchema.safeParse({...datos,descripcion:'corta'}).success,false);
});
test('demos admin: restricciones de PostgreSQL se traducen y revierten',async()=>{
 for(const[code,status]of[['23505',409],['23503',422],['23514',422]]){
  const pasos=[];const app=montar({connect:async()=>({query:async sql=>{pasos.push(sql);if(sql.startsWith('SELECT id,publicado'))return{rows:[{id:1,publicado:true}]};if(sql.startsWith('INSERT'))throw Object.assign(new Error('db'),{code});return{rows:[]};},release:()=>pasos.push('RELEASE')})});
  await escribir(app,'post','/api/admin/demos').expect(status);assert.ok(pasos.includes('ROLLBACK'));assert.ok(pasos.includes('RELEASE'));
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
