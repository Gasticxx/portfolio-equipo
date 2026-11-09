// Fondo exclusivo de I3. Una superficie acotada, sin texturas ni dependencias.
(() => {
  const pagina = document.querySelector('.interfaz-i3');
  const ambiente = pagina?.querySelector('.ambiente');
  if (!ambiente) return;
  const lienzo = document.createElement('canvas');
  lienzo.className = 'i3-fluido';
  lienzo.setAttribute('aria-hidden', 'true');
  const gl = lienzo.getContext('webgl', {
    alpha:false, antialias:false, depth:false, stencil:false,
    preserveDrawingBuffer:false, powerPreference:'low-power'
  });
  // Sin WebGL, los gradientes CSS mantienen la paleta y la legibilidad.
  if (!gl) return;
  ambiente.prepend(lienzo);

  const vertex = 'attribute vec2 a_pos;void main(){gl_Position=vec4(a_pos,0.,1.);}';
  const fragment = `
    precision mediump float;
    uniform vec2 u_size;
    uniform vec2 u_mouse;
    uniform vec2 u_impulso;
    uniform float u_t;
    uniform float u_dark;
    void main(){
      vec2 uv=gl_FragCoord.xy/u_size;
      float aspect=u_size.x/u_size.y;
      vec2 p=(uv-.5)*vec2(aspect,1.);
      vec2 delta=(uv-u_mouse)*vec2(aspect,1.);
      float zona=exp(-dot(delta,delta)*5.);
      // Deformación local y arrastre: modifica las vetas, no la posición del contenido.
      p+=u_impulso*zona*.48;
      p+=vec2(sin(delta.y*9.-u_t),cos(delta.x*8.+u_t))*.025*zona;
      float t=u_t*.16;
      vec2 q=p*2.4;
      q+=.55*vec2(sin(q.y*1.8+t),cos(q.x*1.4-t*.7));
      q+=.28*vec2(sin(q.y*3.1-t*.6),sin(q.x*2.7+t*.5));
      float campo=q.x*.8+q.y*.45+.7*sin(q.x+q.y-t);
      float banda=.5+.5*sin(campo*6.+t);
      float borde=pow(.5+.5*sin(campo*6.+t+.7),12.);
      float veta=pow(.5+.5*sin(campo*12.+t*2.),18.);
      vec3 azul=mix(vec3(.64,.76,.96),vec3(.075,.12,.30),u_dark);
      vec3 violeta=mix(vec3(.83,.78,.95),vec3(.29,.18,.49),u_dark);
      vec3 celeste=mix(vec3(.69,.89,.94),vec3(.14,.43,.55),u_dark);
      vec3 color=mix(azul,violeta,smoothstep(.1,.9,banda));
      color=mix(color,celeste,(.5+.5*sin(q.y*1.6-q.x+t))*.48);
      color=mix(color,mix(vec3(.98,.99,1.),vec3(.48,.60,.88),u_dark),borde*.52);
      color+=veta*mix(.035,.055,u_dark);
      // El centro permanece tranquilo para leer las superficies de vidrio.
      float centro=exp(-dot(p,p)*1.5);
      color=mix(color,mix(vec3(.93,.95,.99),vec3(.075,.10,.18),u_dark),centro*.24);
      gl_FragColor=vec4(color,1.);
    }
  `;
  let programa, buffer, uniformes;
  function preparar() {
    const shaders = [];
    for (const [tipo, fuente] of [[gl.VERTEX_SHADER,vertex],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader = gl.createShader(tipo);
      gl.shaderSource(shader,fuente);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        shaders.forEach(s => gl.deleteShader(s));
        return false;
      }
      shaders.push(shader);
    }
    programa = gl.createProgram();
    shaders.forEach(s => gl.attachShader(programa,s));
    gl.linkProgram(programa);
    shaders.forEach(s => gl.deleteShader(s));
    if (!gl.getProgramParameter(programa,gl.LINK_STATUS)) {
      gl.deleteProgram(programa);
      return false;
    }
    gl.useProgram(programa);
    buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    const posicion = gl.getAttribLocation(programa,'a_pos');
    gl.enableVertexAttribArray(posicion);
    gl.vertexAttribPointer(posicion,2,gl.FLOAT,false,0,0);
    uniformes = Object.fromEntries(['size','mouse','impulso','t','dark'].map(nombre => [nombre,gl.getUniformLocation(programa,`u_${nombre}`)]));
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    return true;
  }
  if (!preparar()) { lienzo.remove(); return; }
  ambiente.classList.add('fluido-listo');
  const reducir = matchMedia('(prefers-reduced-motion: reduce)');
  const preciso = matchMedia('(hover: hover) and (pointer: fine)');
  // Resolución acotada; el movimiento sigue los cuadros del navegador.
  let limite = preciso.matches ? 960 : 640;
  let ancho = innerWidth, alto = innerHeight;
  let frame = 0, anterior = null, fase = 0, dibujados = 0, lentos = 0;
  let perdido = false, suspendido = false, foco = document.hasFocus();
  let mouseX = .5, mouseY = .5, destinoX = .5, destinoY = .5;
  let impulsoX = 0, impulsoY = 0;
  const activo = () => !reducir.matches && !document.hidden && foco && !suspendido && !perdido && !pagina.classList.contains('movimiento-pausado');
  function ajustar() {
    ancho = Math.max(1,innerWidth); alto = Math.max(1,innerHeight);
    const escala = Math.min(1,limite/Math.max(ancho,alto));
    const w = Math.max(1,Math.round(ancho*escala));
    const h = Math.max(1,Math.round(alto*escala));
    if (lienzo.width !== w || lienzo.height !== h) {
      lienzo.width = w; lienzo.height = h;
    }
    gl.viewport(0,0,w,h);
  }
  function pintar() {
    if (perdido) return;
    gl.uniform2f(uniformes.size,lienzo.width,lienzo.height);
    gl.uniform2f(uniformes.mouse,mouseX,mouseY);
    gl.uniform2f(uniformes.impulso,impulsoX,impulsoY);
    gl.uniform1f(uniformes.t,fase);
    gl.uniform1f(uniformes.dark,pagina.classList.contains('tema-oscuro') ? 1 : 0);
    gl.drawArrays(gl.TRIANGLES,0,3);
  }
  function animar(ahora) {
    frame = 0;
    if (!activo()) return;
    const dt = anterior === null ? 1/60 : Math.min(Math.max((ahora-anterior)/1000,.001),.05);
    if (anterior !== null && ahora-anterior > 26) lentos++;
    anterior = ahora;
    fase += dt;
    // El evento solo entrega posición. La velocidad se deriva de la misma
    // trayectoria suavizada que se dibuja, independiente de los Hz del mouse.
    const previoX = mouseX, previoY = mouseY;
    const suavidad = 1-Math.exp(-dt*10);
    mouseX += (destinoX-mouseX)*suavidad;
    mouseY += (destinoY-mouseY)*suavidad;
    // Límite continuo: evita el cambio brusco al alcanzar una velocidad máxima.
    const arrastreX = .45*Math.tanh((mouseX-previoX)/(dt*.9));
    const arrastreY = .45*Math.tanh((mouseY-previoY)/(dt*.9));
    const respuesta = 1-Math.exp(-dt*8);
    impulsoX += (arrastreX-impulsoX)*respuesta;
    impulsoY += (arrastreY-impulsoY)*respuesta;
    pintar();
    if (++dibujados === 90) {
      if (lentos > 20 && limite > 480) { limite = Math.max(480,limite*.75); ajustar(); }
      dibujados = lentos = 0;
    }
    frame = requestAnimationFrame(animar);
  }
  function sincronizar() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; anterior = null;
    impulsoX = impulsoY = 0;
    destinoX = mouseX; destinoY = mouseY;
    pintar();
    if (activo()) frame = requestAnimationFrame(animar);
  }
  window.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !preciso.matches || !activo()) return;
    const x = event.clientX/ancho, y = 1-event.clientY/alto;
    destinoX = Math.max(0,Math.min(1,x)); destinoY = Math.max(0,Math.min(1,y));
  }, {passive:true});
  window.addEventListener('resize', () => { ajustar(); if (!activo()) pintar(); }, {passive:true});
  pagina.addEventListener('i3:tema', () => { pintar(); });
  pagina.addEventListener('i3:movimiento', sincronizar);
  reducir.addEventListener('change', sincronizar);
  document.addEventListener('visibilitychange', sincronizar);
  window.addEventListener('blur', () => { foco = false; sincronizar(); });
  window.addEventListener('focus', () => { foco = true; sincronizar(); });
  window.addEventListener('pagehide', () => { suspendido = true; sincronizar(); });
  window.addEventListener('pageshow', () => { suspendido = false; foco = document.hasFocus(); sincronizar(); });
  lienzo.addEventListener('webglcontextlost', event => {
    event.preventDefault(); perdido = true;
    ambiente.classList.remove('fluido-listo'); sincronizar();
  });
  lienzo.addEventListener('webglcontextrestored', () => {
    perdido = !preparar();
    if (!perdido) { ambiente.classList.add('fluido-listo'); ajustar(); sincronizar(); }
  });
  ajustar(); sincronizar();
})();
