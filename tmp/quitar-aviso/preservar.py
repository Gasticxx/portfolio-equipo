from pathlib import Path
from zipfile import ZipFile
from pypdf import PdfReader, PdfWriter
base=Path('tmp/quitar-aviso')
old=base.joinpath('contacto-original.png').read_bytes()
new=Path('docs/anteproyecto/reflection-assets/contacto-movil.png').read_bytes()
with ZipFile(base/'original.pptx') as src, ZipFile(base/'candidate.pptx','w') as dst:
    matches=[i.filename for i in src.infolist() if i.filename.startswith('ppt/media/') and src.read(i)==old]
    assert len(matches)==1, matches
    for i in src.infolist(): dst.writestr(i, new if i.filename==matches[0] else src.read(i))
with ZipFile(base/'original.pptx') as a, ZipFile(base/'candidate.pptx') as b:
    changed=[n for n in a.namelist() if a.read(n)!=b.read(n)]
    assert changed==matches
    print('PowerPoint: único cambio',changed)
original=PdfReader(base/'original.pdf')
updated=PdfReader('output/presentacion/Anteproyecto_Reflection_Tech.pdf')
assert len(original.pages)==len(updated.pages)==10
w=PdfWriter()
for i,page in enumerate(original.pages): w.add_page(updated.pages[i] if i==6 else page)
if original.metadata: w.add_metadata(dict(original.metadata))
w.write(base/'final.pdf')
print('PDF: solo reemplazada la página 7')
