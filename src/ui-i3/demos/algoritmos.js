// I3 reproduce pasos. I5 inyecta window.algoritmosAdapter.generar({algoritmo,datos,objetivo}).
// Los fixtures siguientes solo existen en la muestra local, no implementan algoritmos.
(() => {
  const raiz=document.querySelector('[data-visualizador]');if(!raiz)return;
  const $=selector=>raiz.querySelector(selector);
  const algoritmo=$('#algoritmo'),datos=$('#datos'),objetivo=$('#objetivo'),velocidad=$('#velocidad');
  const reducir=matchMedia('(prefers-reduced-motion: reduce)');
  let estado='listo',timer=null,pasos=null,indice=0,inicial=[4,2,4];
  const fixtures={
    generar({algoritmo,datos,objetivo}){
      if(algoritmo==='lineal'&&datos.join(',')==='4,2,4'&&objetivo===4)return [{valores:[4,2,4],activos:[0],comparacion:'Índice 1: 4 = 4.',resultado:'Encontrado en posición 1.',encontrado:0}];
      if(algoritmo==='burbuja'&&datos.join(',')==='3,1,2')return [
        {valores:[1,3,2],activos:[0,1],comparacion:'3 > 1: intercambio.'},
        {valores:[1,2,3],activos:[1,2],comparacion:'3 > 2: intercambio.'},
        {valores:[1,2,3],activos:[0,1],comparacion:'1 ≤ 2: sin intercambio.',resultado:'Orden ascendente: 1, 2, 3.'},
      ];
      throw new Error('La muestra incluye búsqueda [4,2,4] de 4 y burbuja [3,1,2]. Para otros datos conectá el motor de I5.');
    },
  };
  const adapter=window.algoritmosAdapter || fixtures;
  function pintar(valores,activos=[],encontrado){
    const maximo=Math.max(1,...valores.map(Math.abs));
    $('[data-barras]').replaceChildren(...valores.map((valor,i)=>{const barra=document.createElement('div');barra.className=`barra-valor nivel-${Math.max(1,Math.ceil(Math.abs(valor)/maximo*10))}`;barra.classList.toggle('actual',activos.includes(i));barra.classList.toggle('encontrado',encontrado===i);barra.textContent=valor;barra.setAttribute('aria-label',`Posición ${i+1}: ${valor}${activos.includes(i)?', comparación actual':''}`);return barra;}));
  }
  function actualizar(){
    $('[data-algoritmo-estado]').textContent=`${{listo:'Listo',ejecutando:'Ejecutando',pausado:'Pausado',finalizado:'Finalizado'}[estado]} · ${indice} pasos${reducir.matches?' · Movimiento reducido: usá Paso.':''}`;
    $('[data-iniciar]').disabled=estado==='ejecutando'||estado==='finalizado'||reducir.matches;
    $('[data-pausar]').disabled=estado!=='ejecutando';
    $('[data-paso]').disabled=estado==='ejecutando'||estado==='finalizado';
    [algoritmo,datos,objetivo].forEach(el=>el.disabled=pasos!==null);
  }
  function preparar(){
    if(pasos)return true;
    const texto=datos.value.trim();const partes=texto.split(',').map(v=>v.trim());
    const validos=texto&&partes.length<=20&&partes.every(v=>/^-?\d+$/.test(v)&&Number(v)>=-99&&Number(v)<=99);
    const errorDatos=validos?'':'Ingresá de 1 a 20 enteros entre -99 y 99.';
    const objetivoValido=/^-?\d+$/.test(objetivo.value)&&Number(objetivo.value)>=-99&&Number(objetivo.value)<=99;
    const errorObjetivo=algoritmo.value==='lineal'&&!objetivoValido?'Ingresá un objetivo entero entre -99 y 99.':'';
    $('#datos-error').textContent=errorDatos;$('#objetivo-error').textContent=errorObjetivo;
    datos.setAttribute('aria-invalid',String(Boolean(errorDatos)));objetivo.setAttribute('aria-invalid',String(Boolean(errorObjetivo)));
    if(errorDatos||errorObjetivo){(errorDatos?datos:objetivo).focus();return false;}
    try{inicial=partes.map(Number);const secuencia=adapter.generar({algoritmo:algoritmo.value,datos:[...inicial],objetivo:Number(objetivo.value)});if(!Array.isArray(secuencia)||!secuencia.length)throw new Error('El motor no devolvió pasos.');pasos=secuencia;pintar(inicial);return true;}
    catch(error){$('[data-resultado]').textContent=error.message;return false;}
  }
  function detener(){clearTimeout(timer);timer=null;}
  function avanzar(){
    if(!preparar())return false;
    const paso=pasos[indice++];pintar(paso.valores,paso.activos,paso.encontrado);
    $('[data-comparacion]').textContent=paso.comparacion||'';
    if(indice===pasos.length){estado='finalizado';detener();$('[data-resultado]').textContent=paso.resultado||'Secuencia finalizada.';}
    else if(estado!=='ejecutando')estado='pausado';
    actualizar();return true;
  }
  function programar(){timer=setTimeout(()=>{if(estado!=='ejecutando')return;if(avanzar()&&estado==='ejecutando')programar();},Number(velocidad.value));}
  $('[data-iniciar]').addEventListener('click',()=>{if(estado==='ejecutando'||estado==='finalizado'||!preparar())return;estado='ejecutando';actualizar();programar();});
  $('[data-pausar]').addEventListener('click',()=>{detener();estado='pausado';actualizar();});
  $('[data-paso]').addEventListener('click',()=>{if(['listo','pausado'].includes(estado))avanzar();});
  $('[data-reiniciar]').addEventListener('click',()=>{detener();datos.value=inicial.join(',');pasos=null;indice=0;estado='listo';$('[data-resultado]').textContent='';$('[data-comparacion]').textContent='';pintar(inicial);actualizar();});
  algoritmo.addEventListener('change',()=>{inicial=algoritmo.value==='lineal'?[4,2,4]:[3,1,2];datos.value=inicial.join(',');$('[data-objetivo-campo]').hidden=algoritmo.value!=='lineal';pintar(inicial);$('[data-resultado]').textContent='';});
  reducir.addEventListener('change',()=>{if(reducir.matches&&estado==='ejecutando'){detener();estado='pausado';}actualizar();});
  window.addEventListener('pagehide',()=>{detener();if(estado==='ejecutando'){estado='pausado';actualizar();}});document.addEventListener('visibilitychange',()=>{if(document.hidden&&estado==='ejecutando'){detener();estado='pausado';actualizar();}});
  pintar(inicial);actualizar();
})();
