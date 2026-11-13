// Servidor aislado de revisión: no modifica ni importa app.js, .env o PostgreSQL.
import express from 'express';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { integrantes } from '../src/ui-i3/equipo.js';
import { fotosRouter } from '../src/routes/fotos.routes.js';

const raiz=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function crearPreview(){
  const app=express();
  app.disable('x-powered-by');
  app.use(helmet({contentSecurityPolicy:{directives:{'upgrade-insecure-requests':null,scriptSrc:["'self'"],styleSrc:["'self'"],imgSrc:["'self'",'data:']}}}));
  app.set('views',path.join(raiz,'src/views'));app.set('view engine','ejs');
  app.use(express.static(path.join(raiz,'src/public')));
  app.use(fotosRouter);
  app.use((_req,res,next)=>{res.locals.usuarioActual=null;res.set('Cache-Control','no-store');next();});
  app.get('/',(_req,res)=>res.redirect('/i3'));
  app.get('/i3',(_req,res)=>res.render('i3/inicio',{titulo:'Inicio',rutaActual:'/i3',integrantes}));
  const paginas={
    equipo:['El equipo','01 / LAS PERSONAS','Seis especialidades, un espacio compartido. Los nombres y fotos se completarán con los datos de cada integrante.'],
    servicios:['Lo que podemos construir','02 / CAPACIDADES','Textos iniciales para revisar el sistema visual de servicios.'],
    proyectos:['Proyectos con propósito','03 / PROYECTOS','Una selección que crecerá con nuestro aprendizaje.'],
    contacto:['Hablemos','04 / CONTACTO','Un espacio para comenzar una conversación.'],
    login:['Ingresar','TU ESPACIO','Interfaz de acceso para integrar con autenticación.'],
    registro:['Crear una cuenta','SUMATE','Interfaz de registro para integrar con autenticación.'],
    detalle:['Portfolio del equipo','PROYECTO / EN DESARROLLO','Presentación de muestra para integrar con el módulo de proyectos.'],
    componentes:['Biblioteca de interfaz','SISTEMA VISUAL / I3','Componentes y estados de referencia para los autores de cada módulo.'],
    panel:['Panel de referencia','PANELES / I3','Boceto de filtros y datos para revisar con I6. No contiene métricas reales.'],
  };
  for(const [vista,[titulo,seccion,descripcion]] of Object.entries(paginas))app.get(`/i3/${vista}`,(req,res)=>res.render('i3/pagina',{vista,titulo,seccion,descripcion,rutaActual:req.path,integrantes}));
  app.get('/i3/equipo/:codigo',(req,res)=>{const integrante=integrantes.find(i=>i.codigo===req.params.codigo);if(!integrante)return res.status(404).send('Perfil no encontrado.');res.render('i3/pagina',{vista:'perfil',titulo:integrante.nombre,seccion:integrante.codigo,descripcion:integrante.especialidad,integrante,integrantes,rutaActual:'/i3/equipo'});});
  for(const [vista,titulo] of [['tablero','Tablero personal de tareas'],['algoritmos','Búsqueda y ordenamiento']]){
    app.get(`/i3/muestras/${vista}`,(_req,res)=>res.render('i3/demo',{vista,titulo,rutaActual:'/i3/proyectos'}));
    // Solo fixtures y UI pública de muestra. La demo real debe servir recursos con autorización.
    app.get(`/i3/muestras/recursos/${vista}.js`,(_req,res)=>res.sendFile(path.join(raiz,'src/ui-i3/demos',`${vista}.js`)));
  }
  app.use((_req,res)=>res.status(404).send('Página de muestra no encontrada. Volvé a /i3.'));
  return app;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const puerto=Number(process.env.I3_PORT||3033);
  crearPreview().listen(puerto,'127.0.0.1',()=>console.log(`Vista de I3: http://127.0.0.1:${puerto}/i3`));
}
