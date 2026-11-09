import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const codigo = readFileSync(new URL('../../src/public/js/i3-fondo.js',import.meta.url),'utf8');

// Prueba del ciclo de vida; el renderizado visual requiere un navegador real.
function escenario({webgl=true,reducido=false,compila=true}={}) {
  function nodo() {
    const eventos = new Map(), clases = new Set();
    return {
      className:'', width:300, height:150,
      classList:{add:n=>clases.add(n),remove:n=>clases.delete(n),contains:n=>clases.has(n)},
      setAttribute(){}, prepend(){}, remove(){ this.eliminado=true; },
      addEventListener(nombre,fn){ if (!eventos.has(nombre)) eventos.set(nombre,[]); eventos.get(nombre).push(fn); },
      emitir(nombre,evento={}){ for (const fn of eventos.get(nombre)||[]) fn(evento); }
    };
  }
  const pagina=nodo(), ambiente=nodo(), canvas=nodo(), ventana=nodo(), documento=nodo();
  const reducir=nodo(), preciso=nodo(); reducir.matches=reducido; preciso.matches=true;
  const cuadros=new Map(), valores=new Map();
  let secuencia=0, tiempo=0, dibujos=0;
  const gl={
    VERTEX_SHADER:1,FRAGMENT_SHADER:2,COMPILE_STATUS:3,LINK_STATUS:4,
    ARRAY_BUFFER:5,STATIC_DRAW:6,FLOAT:7,DEPTH_TEST:8,BLEND:9,TRIANGLES:10,
    createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>compila,
    deleteShader(){},createProgram:()=>({}),attachShader(){},linkProgram(){},
    getProgramParameter:()=>true,deleteProgram(){},useProgram(){},createBuffer:()=>({}),
    bindBuffer(){},bufferData(){},getAttribLocation:()=>0,enableVertexAttribArray(){},
    vertexAttribPointer(){},getUniformLocation:(_p,n)=>n,disable(){},viewport(){},
    uniform2f:(n,x,y)=>valores.set(n,[x,y]),uniform1f:(n,v)=>valores.set(n,v),
    drawArrays(){dibujos++;}
  };
  canvas.getContext=()=>webgl?gl:null;
  pagina.querySelector=()=>ambiente;
  documento.querySelector=()=>pagina;
  documento.createElement=()=>canvas;
  documento.hasFocus=()=>true;
  documento.hidden=false;
  ventana.innerWidth=1920; ventana.innerHeight=1080;
  const contexto={
    document:documento,window:ventana,innerWidth:1920,innerHeight:1080,
    matchMedia:q=>q.includes('reduced-motion')?reducir:preciso,
    performance:{now:()=>tiempo},Float32Array,
    requestAnimationFrame:fn=>{const id=++secuencia;cuadros.set(id,fn);return id;},
    cancelAnimationFrame:id=>cuadros.delete(id)
  };
  vm.runInNewContext(codigo,contexto);
  return {
    pagina,ambiente,canvas,ventana,documento,reducir,valores,
    pendientes:()=>cuadros.size,dibujos:()=>dibujos,
    avanzar(ms=40){ tiempo+=ms;const tareas=[...cuadros.values()];cuadros.clear();tareas.forEach(fn=>fn(tiempo)); }
  };
}

test('I3 limita resolución y mantiene un único cuadro pendiente',()=>{
  const e=escenario();
  assert.equal(e.canvas.width,960); assert.equal(e.canvas.height,540);
  for(let i=0;i<100;i++) {
    e.ventana.emitir('pointermove',{pointerType:'mouse',clientX:1200+i,clientY:300});
  }
  assert.equal(e.pendientes(),1);
  e.avanzar();
  assert.equal(e.pendientes(),1);
  assert.equal(e.dibujos(),2);
});

test('I3 pausa el fondo oculto, sin foco y por control del usuario',()=>{
  const e=escenario();
  e.documento.hidden=true;e.documento.emitir('visibilitychange');
  assert.equal(e.pendientes(),0);
  e.documento.hidden=false;e.documento.emitir('visibilitychange');
  assert.equal(e.pendientes(),1);
  e.ventana.emitir('blur');assert.equal(e.pendientes(),0);
  e.ventana.emitir('focus');assert.equal(e.pendientes(),1);
  e.pagina.classList.add('movimiento-pausado');e.pagina.emitir('i3:movimiento');
  assert.equal(e.pendientes(),0);
  e.pagina.classList.remove('movimiento-pausado');e.pagina.emitir('i3:movimiento');
  assert.equal(e.pendientes(),1);
});

test('I3 con movimiento reducido dibuja una imagen estática y permite cambiar tema',()=>{
  const e=escenario({reducido:true});
  assert.equal(e.dibujos(),1);assert.equal(e.pendientes(),0);
  e.pagina.classList.add('tema-oscuro');e.pagina.emitir('i3:tema');
  assert.equal(e.valores.get('u_dark'),1);
  assert.equal(e.dibujos(),2);assert.equal(e.pendientes(),0);
  e.reducir.matches=false;e.reducir.emitir('change');assert.equal(e.pendientes(),1);
});

test('I3 conserva el respaldo sin WebGL o ante un error de compilación',()=>{
  for(const opciones of [{webgl:false},{compila:false}]) {
    const e=escenario(opciones);
    assert.equal(e.ambiente.classList.contains('fluido-listo'),false);
    assert.equal(e.pendientes(),0);
  }
});

test('I3 recupera el fondo tras pérdida de contexto y al volver de otra página',()=>{
  const e=escenario();
  e.canvas.emitir('webglcontextlost',{preventDefault(){}});
  assert.equal(e.pendientes(),0);assert.equal(e.ambiente.classList.contains('fluido-listo'),false);
  e.canvas.emitir('webglcontextrestored');
  assert.equal(e.pendientes(),1);assert.equal(e.ambiente.classList.contains('fluido-listo'),true);
  e.ventana.emitir('pagehide');assert.equal(e.pendientes(),0);
  e.ventana.emitir('pageshow');assert.equal(e.pendientes(),1);
});

test('I3 reduce resolución cuando se repiten cuadros lentos',()=>{
  const e=escenario();
  for(let i=0;i<90;i++) e.avanzar(70);
  assert.equal(e.canvas.width,720);
  assert.equal(e.canvas.height,405);
  assert.equal(e.pendientes(),1);
});

test('I3 transmite posición e impulso al fondo sin crear más bucles',()=>{
  const e=escenario();
  e.ventana.emitir('pointermove',{pointerType:'mouse',clientX:960,clientY:540});
  e.avanzar();
  e.ventana.emitir('pointermove',{pointerType:'mouse',clientX:1500,clientY:200});
  e.avanzar();
  assert.ok(e.valores.get('u_mouse')[0]>.5);
  assert.ok(e.valores.get('u_mouse')[1]>.5);
  assert.ok(e.valores.get('u_impulso')[0]>0);
  assert.ok(e.valores.get('u_impulso')[1]>0);
  assert.equal(e.pendientes(),1);
});

test('I3 produce el mismo arrastre con eventos escasos o agrupados del mouse',()=>{
  const simple=escenario(), agrupado=escenario();
  for(let cuadro=0;cuadro<30;cuadro++) {
    const x=960+cuadro*8;
    simple.ventana.emitir('pointermove',{pointerType:'mouse',clientX:x,clientY:300});
    for(let paso=0;paso<12;paso++) {
      agrupado.ventana.emitir('pointermove',{pointerType:'mouse',clientX:x-11+paso,clientY:300});
    }
    simple.avanzar(16.67); agrupado.avanzar(16.67);
    assert.deepEqual([...simple.valores.get('u_mouse')],[...agrupado.valores.get('u_mouse')]);
    assert.deepEqual([...simple.valores.get('u_impulso')],[...agrupado.valores.get('u_impulso')]);
  }
});

test('I3 dibuja cada cuadro de pantalla sin el salto del límite de 30 fps',()=>{
  const e=escenario();
  for(let i=0;i<60;i++) e.avanzar(16.67);
  assert.equal(e.dibujos(),61);
  assert.equal(e.canvas.width,960);
});

test('I3 deja que el arrastre se apague suavemente sin nuevos eventos',()=>{
  const e=escenario();
  e.ventana.emitir('pointermove',{pointerType:'mouse',clientX:1600,clientY:200});
  for(let i=0;i<30;i++) e.avanzar(16.67);
  const antes=Math.hypot(...e.valores.get('u_impulso'));
  for(let i=0;i<180;i++) e.avanzar(16.67);
  const despues=Math.hypot(...e.valores.get('u_impulso'));
  assert.ok(antes>0);
  assert.ok(despues<.00001);
});
