from pathlib import Path
paths=list(Path('src').rglob('*.ejs'))+[Path('README.md'),Path('.env.example'),Path('package.json'),Path('docs/anteproyecto/generar.py')]
for p in paths:
    s=p.read_text(encoding='utf-8')
    t=s.replace('Equipo Seis','Reflection Tech').replace('EQUIPO SEIS','REFLECTION TECH').replace('Equipo_Seis','Reflection_Tech')
    t=t.replace('Somos seis estudiantes construyendo una experiencia digital en común.', 'Somos Reflection Tech, un equipo de estudiantes construyendo una experiencia digital en común.')
    t=t.replace('Seis perspectivas.<br><strong>Un equipo.</strong>', 'Reflection Tech.<br><strong>Un equipo.</strong>')
    t=t.replace('<span class="arte-numero">06</span>', '<span class="arte-numero">RT</span>')
    t=t.replace('<strong>Integrantes.<br>Ideas que se encuentran.</strong>', '<strong>Reflection Tech.<br>Ideas que se encuentran.</strong>')
    t=t.replace('Seis miradas, un equipo', 'Reflection Tech, un equipo')
    t=t.replace('Seis miradas. Un proyecto en común.', 'Reflection Tech. Un proyecto en común.')
    t=t.replace('La marca combina el número 6 con el nombre «equiposeis.».', 'La marca utiliza el nombre «Reflection Tech» y el monograma RT.')
    if t!=s:p.write_text(t,encoding='utf-8')
