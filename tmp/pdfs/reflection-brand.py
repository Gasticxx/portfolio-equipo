from pathlib import Path
for p in Path('src').rglob('*'):
    if p.suffix not in ('.ejs','.js'): continue
    s=p.read_text(encoding='utf-8')
    t=s.replace('Equipo Seis','Reflection Tech')
    t=t.replace('equipo<span class="marca-seis">seis</span>', 'Reflection <span class="marca-seis">Tech</span>')
    t=t.replace('equipo<span>seis.</span>', 'Reflection <span>Tech.</span>')
    t=t.replace('class="marca-icono" aria-hidden="true">6</span>', 'class="marca-icono" aria-hidden="true">R</span>')
    t=t.replace('Portfolio del equipo Reflection Tech', 'Portfolio de Reflection Tech')
    if s != t: p.write_text(t,encoding='utf-8')
