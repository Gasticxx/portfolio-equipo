import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const runtime='C:/Users/Vivobook Slim/.cache/codex-runtimes/codex-primary-runtime/dependencies';
process.env.RUNTIME_NODE_MODULES=runtime+'/node/node_modules';
const {Presentation,PresentationFile}=await import(pathToFileURL(runtime+'/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs').href);
const root=process.cwd(), build=path.join(root,'tmp/presentacion-reflection',`build-${Date.now()}`);
const skill='C:/Users/Vivobook Slim/.codex/plugins/cache/openai-primary-runtime/presentations/26.1110.11613/skills/presentations';
await fs.mkdir(build,{recursive:true}); await fs.mkdir('output/presentacion',{recursive:true});
const p=Presentation.create({slideSize:{width:1280,height:720}});
const blue='#1D4ED8',ink='#0F172A',muted='#475569',purple='#6374C5';
const asset=path.join(root,'docs/anteproyecto/reflection-assets');
async function img(s,file,x,y,w,h,fit='contain'){
 const b=await fs.readFile(path.join(asset,file));
 return s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/png',alt:file.replace('.png',''),fit,position:{left:x,top:y,width:w,height:h}});
}
function txt(s,t,x,y,w,h,size=24,color=ink,bold=false){
 const a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 a.text=t;a.text.style={fontSize:size,typeface:'Segoe UI',color,bold,verticalAlignment:'top',insets:0};return a;
}
function glass(s,x,y,w,h,fill='#FFFFFF/70',rotation=0){return s.shapes.add({geometry:'roundRect',position:{left:x,top:y,width:w,height:h,rotation},fill,line:{fill:'#FFFFFF/95',width:1},borderRadius:24,shadow:'0px 14px 32px #253D76/10'});}
async function slide(title,section){
 const s=p.slides.add();await img(s,'fondo.png',0,0,1280,720,'cover');
 txt(s,'Reflection Tech',54,28,330,38,24,ink,true);
 txt(s,section,830,34,395,26,15,muted);
 if(title)txt(s,title,54,98,1170,76,46,ink,true);
 txt(s,String(p.slides.items.length).padStart(2,'0'),1185,674,40,22,15,muted);
 s.speakerNotes.text='Anteproyecto de Lenguajes 4. Fuentes: docs/manual-diseno.md, src/public/css/app.css y prototipo local I3. Capturas reales del sitio con la marca Reflection Tech. Las pantallas contienen datos de muestra y no certifican integración con backend.';
 return s;
}
let s=await slide('', 'LENGUAJES 4  /  ANTEPROYECTO');
glass(s,54,164,1172,450,'#FFFFFF/64');
txt(s,'Manual de Diseño\ny Estilo',92,218,670,170,66,ink,true);
txt(s,'Reflection Tech',94,408,630,65,48,blue,true);
txt(s,'Portfolio colectivo del equipo\nPropuesta visual y prototipo responsive',96,510,600,76,25,muted);
await img(s,'portada-vidrio.png',772,205,420,365);
txt(s,'Noviembre 2026',54,671,400,25,16,muted);

s=await slide('Identidad del proyecto','01  /  CONCEPTO');
txt(s,'Un portfolio para\nconocer al equipo',58,216,550,128,46,blue,true);
txt(s,'Presentamos nuestras especialidades,\nservicios y proyectos en un espacio común.',61,374,565,94,28,ink);
txt(s,'Dirigido a docentes, compañeros y personas\ninteresadas en nuestros trabajos.',61,505,540,96,24,muted);
await img(s,'hero-arte.png',672,206,554,395);

s=await slide('Lenguaje visual','02  /  ESTILO');
glass(s,54,204,1172,412);
txt(s,'Vidrio translúcido',90,246,600,70,48,blue,true);
txt(s,'Superficies claras sobre fondos celestes y lavanda.\nBordes suaves y sombras discretas separan los planos.',93,342,1030,90,29,ink);
txt(s,'El azul concentra las acciones principales.\nLos textos oscuros sostienen la lectura.',93,486,1030,87,28,muted);

s=await slide('Paleta de colores','03  /  IDENTIDAD VISUAL');
const colors=[['Primario','#1D4ED8','Acciones y enlaces'],['Lavanda','#6374C5','Acento decorativo'],['Fondo','#F8FAFC','Base de las páginas'],['Superficie','#FFFFFF','Tarjetas y campos'],['Texto','#0F172A','Títulos y cuerpo'],['Secundario','#475569','Ayudas y descripciones']];
for(let i=0;i<colors.length;i++){
 const x=54+(i%3)*398,y=204+Math.floor(i/3)*212;
 glass(s,x,y,374,185,'#FFFFFF/78');
 s.shapes.add({geometry:'roundRect',position:{left:x+22,top:y+23,width:65,height:65},fill:colors[i][1],line:{fill:'#CBD5E1',width:1},borderRadius:14});
 txt(s,colors[i][0],x+107,y+23,245,35,25,ink,true);txt(s,colors[i][1],x+107,y+60,245,34,23,muted);
 txt(s,colors[i][2],x+23,y+124,335,36,23,muted);
}
s.speakerNotes.text+=' Tokens auxiliares: borde #CBD5E1, hover #1E40AF, éxito #166534, error #B91C1C, advertencia #92400E. El vidrio utiliza blanco al 72 %.';

s=await slide('Tipografía y jerarquía','04  /  SISTEMA TIPOGRÁFICO');
glass(s,54,200,1172,433);
txt(s,'Segoe UI',87,226,610,91,70,blue,true);
txt(s,'Fuente local del sistema',734,259,450,45,25,muted);
txt(s,'Títulos principales',91,352,560,58,40,ink,true);txt(s,'40 / 32 px     Peso 700',754,365,430,40,24,muted);
txt(s,'Títulos de sección',91,432,560,48,31,ink,true);txt(s,'28 / 24 px     Peso 700',754,442,430,40,24,muted);
txt(s,'Texto de lectura y descripciones',91,510,640,42,26,ink);txt(s,'16 px     Peso 400',754,513,430,40,24,muted);
txt(s,'Ayudas y mensajes de campo',91,575,640,32,23,muted);txt(s,'14 px     Peso 400',754,575,430,40,24,muted);
s.speakerNotes.text+=' Los tamaños son especificaciones del sitio, no de las diapositivas. Alternativas CSS: system-ui, -apple-system, Segoe UI, sans-serif. Cuerpo con interlineado 1,5. Tarjetas: h3 22/20 px, peso 600.';

s=await slide('Inicio en escritorio','05  /  PREVIEW PC');
await img(s,'inicio-pc.png',54,196,796,496);
glass(s,885,217,341,386);
txt(s,'La primera impresión',911,251,286,86,32,blue,true);
txt(s,'Presentación del equipo.\n\nAcceso a proyectos.\n\nNavegación visible.\n\nPlanos translúcidos.',911,349,282,229,24,ink);

s=await slide('Experiencia en celular','06  /  PREVIEW MÓVIL');
await img(s,'inicio-movil.png',79,197,213,461);
await img(s,'contacto-movil.png',349,197,195,461);
glass(s,615,214,611,409);
txt(s,'Una columna, el mismo estilo',651,252,530,92,36,blue,true);
txt(s,'Menú plegable y acciones amplias.\n\nContenido apilado con lectura vertical.\n\nFormularios adaptados al ancho disponible.\n\nMárgenes laterales de 16 px.',651,365,525,215,25,ink);

s=await slide('Proyectos y recorridos','07  /  NAVEGACIÓN');
await img(s,'proyectos-pc.png',54,203,720,460);
glass(s,808,215,418,413);
txt(s,'Explorar y consultar',839,253,352,71,32,blue,true);
txt(s,'Inicio / Equipo / Perfil\nConocer especialidades.\n\nProyectos / Detalle / Demo\nExplorar trabajos disponibles.\n\nServicios / Contacto\nIniciar una consulta.',839,347,351,256,24,ink);

s=await slide('Adaptación y accesibilidad','08  /  EXPERIENCIA DE USO');
glass(s,54,209,566,399);glass(s,660,209,566,399);
txt(s,'Diseño responsive',87,250,500,60,36,blue,true);
txt(s,'PC desde 992 px\nComposición amplia y navegación visible.\n\nTablet de 768 a 991 px\nMenú plegable y columnas flexibles.\n\nCelular hasta 767 px\nFormularios y contenido apilados.',87,334,495,242,24,ink);
txt(s,'Navegación accesible',694,250,500,60,36,blue,true);
txt(s,'Foco visible y uso con teclado.\n\nErrores explicados junto al campo.\n\nEnlace para saltar al contenido.\n\nMovimiento reducido y pausa de efectos.',694,334,490,242,25,ink);

s=await slide('Prototipo del anteproyecto','09  /  CIERRE');
glass(s,54,207,1172,402);
txt(s,'Reflection Tech',91,244,1055,87,64,blue,true);
txt(s,'Una guía visual para integrar las pantallas del portfolio.',95,356,1046,60,31,ink);
txt(s,'El prototipo reúne Inicio, Equipo, Servicios, Proyectos y Contacto.\nLas capturas muestran vistas de revisión con contenido de muestra.',95,458,1030,96,26,muted);
txt(s,'Referencia visual: LUMIX REALTY en Behance',56,655,1080,36,19,muted);
s.speakerNotes.text+=' Referencia de presentación aportada por el usuario: https://www.behance.net/gallery/251694753/LUMIX-REALTY-Premium-Property-Landing-Page . La estética del deck sigue la página local del portfolio. Para abrir el prototipo: node scripts/preview-i3.js y http://127.0.0.1:3033/i3.';

const candidatePath=path.join(build,'candidate.pptx');
await (await PresentationFile.exportPptx(p)).save(candidatePath);
console.log('Draft exported');
for(let i=0;i<p.slides.items.length;i++){
 const blob=await p.export({slide:p.slides.items[i],format:'png',scale:1});
 await fs.writeFile(path.join(build,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await blob.arrayBuffer()));
 console.log('Rendered',i+1);
}
const {finalizePresentation}=await import(pathToFileURL(skill+'/container_tools/artifact_tool_utils.mjs').href);
const validatedPath=path.join(root,'output/presentacion',`validated-${Date.now()}.pptx`);
await finalizePresentation({workspaceDir:root,candidatePath,finalPath:validatedPath,pythonExecutable:runtime+'/python/python.exe',integrityValidatorPath:skill+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:skill+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Segoe UI']},verifyArtifactToolImport:true,receiptPath:path.join(build,'validation.json')});
await fs.copyFile(validatedPath,path.join(root,'output/presentacion/Anteproyecto_Reflection_Tech.pptx'));
await fs.unlink(validatedPath);
const pdfResult=spawnSync(runtime+'/python/python.exe',['-c',
 "from pathlib import Path; import sys; from reportlab.pdfgen import canvas; c=canvas.Canvas(sys.argv[2],pagesize=(960,540)); c.setTitle('Reflection Tech - Anteproyecto - Manual de Diseño y Estilo'); [(c.drawImage(str(p),0,0,width=960,height=540),c.showPage()) for p in sorted(Path(sys.argv[1]).glob('slide-*.png'))]; c.save()",
 build,path.join(root,'output/presentacion/Anteproyecto_Reflection_Tech.pdf')],{encoding:'utf8'});
if(pdfResult.status!==0)throw new Error(pdfResult.stderr);
await fs.writeFile(path.join(root,'tmp/presentacion-reflection/latest-build.txt'),build);
console.log('Final presentation ready');
