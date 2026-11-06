// UI de I3. Puede montarse detrás de la autorización de I4.
// Inyectar window.tableroAdapter = {listar, crear, cambiar, eliminar} antes de cargar.
(() => {
  const raiz=document.querySelector('[data-tablero]'); if(!raiz) return;
  const form=raiz.querySelector('form'); const campo=form.elements.titulo;
  const estado=raiz.querySelector('[data-tablero-estado]'); const dialogo=raiz.querySelector('dialog');
  let tareas=[]; let ocupado=false; let siguienteId=1;
  const muestra={
    async listar(){return tareas;},
    async crear(titulo){return {id:siguienteId++,titulo,estado:'pendiente'};},
    async cambiar(id,nuevoEstado){return {...tareas.find(t=>t.id===id),estado:nuevoEstado};},
    async eliminar(){},
  };
  const api=window.tableroAdapter || (raiz.dataset.modo==='muestra' ? muestra : null);
  const etiquetas={pendiente:'Pendiente',progreso:'En progreso',completada:'Completada'};
  function dibujar(){
    for(const columna of raiz.querySelectorAll('[data-columna]')){
      columna.replaceChildren();
      const propias=tareas.filter(t=>t.estado===columna.dataset.columna);
      if(!propias.length){const p=document.createElement('p');p.className='lista-vacia';p.textContent='Sin tareas en este estado.';columna.append(p);}
      propias.forEach(t=>{
        const card=document.createElement('article');card.className='tarea glass';
        const titulo=document.createElement('h3');titulo.textContent=t.titulo;
        const label=document.createElement('label');label.htmlFor=`estado-${t.id}`;label.textContent='Estado de la tarea';
        const select=document.createElement('select');select.className='form-select';select.id=label.htmlFor;
        Object.entries(etiquetas).forEach(([valor,texto])=>{const option=document.createElement('option');option.value=valor;option.textContent=texto;option.selected=valor===t.estado;select.append(option);});
        select.addEventListener('change',()=>operar(async()=>{const actual=await api.cambiar(t.id,select.value);tareas=tareas.map(item=>item.id===t.id?actual:item);},'Estado actualizado.'));
        const eliminar=document.createElement('button');eliminar.className='btn btn-outline-danger';eliminar.textContent='Eliminar';eliminar.type='button';
        eliminar.addEventListener('click',()=>{
          raiz.querySelector('[data-eliminar-nombre]').textContent=t.titulo;
          dialogo.returnValue='';dialogo.showModal();
          dialogo.addEventListener('close',async()=>{if(dialogo.returnValue==='eliminar'){await operar(async()=>{await api.eliminar(t.id);tareas=tareas.filter(item=>item.id!==t.id);},'Tarea eliminada.');campo.focus();}else eliminar.focus();},{once:true});
        });
        card.append(titulo,label,select,eliminar);columna.append(card);
      });
    }
  }
  async function operar(accion,mensaje){
    if(ocupado)return;ocupado=true;estado.textContent='Procesando…';
    const foco=document.activeElement?.id;
    raiz.querySelectorAll('button,select').forEach(el=>el.disabled=true);
    try{await accion();estado.textContent=mensaje+(raiz.dataset.modo==='muestra'?' Solo en esta muestra; se pierde al recargar.':'');}
    catch(error){estado.textContent=error.message || 'No se pudo completar la operación. Volvé a intentar.';}
    finally{ocupado=false;dibujar();raiz.querySelectorAll('button,select').forEach(el=>el.disabled=false);if(foco)document.getElementById(foco)?.focus();}
  }
  form.addEventListener('submit',event=>{
    event.preventDefault();const titulo=campo.value.trim();
    const error=titulo.length<3||titulo.length>80?'Ingresá un título de 3 a 80 caracteres.':tareas.length>=50?'Alcanzaste 50 tareas. Eliminá alguna para continuar.':'';
    raiz.querySelector('#titulo-tarea-error').textContent=error;campo.setAttribute('aria-invalid',String(Boolean(error)));
    if(error){campo.focus();return;}
    operar(async()=>{const tarea=await api.crear(titulo);tareas.push(tarea);campo.value='';},'Tarea agregada.');
  });
  if(!api){estado.textContent='Falta conectar el adaptador de tareas de I5.';form.querySelector('button').disabled=true;return;}
  operar(async()=>{tareas=await api.listar();},'Tablero listo.');
})();
