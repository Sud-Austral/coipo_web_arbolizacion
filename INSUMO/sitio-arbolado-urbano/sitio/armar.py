#!/usr/bin/env python3
"""
Arma el prototipo en un solo archivo HTML autocontenido.

Inyecta el catálogo, las facetas y las fotografías (como data: URI) en la
plantilla. En el sitio real estas tres piezas se sirven como archivos aparte
—`especies.json`, `facetas.json` y las imágenes desde almacenamiento— pero un
Artifact no puede pedir recursos externos, así que aquí van embebidos.
"""

import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).parent
DIST = BASE.parent / "dist"

especies = json.loads((DIST / "especies.json").read_text(encoding="utf-8"))
facetas  = json.loads((DIST / "facetas.json").read_text(encoding="utf-8"))
meta     = json.loads((DIST / "meta.json").read_text(encoding="utf-8"))

# Campos que el prototipo no usa: fuera del payload para no cargar el archivo.
PODAR = ["n", "descripcion", "floracion", "fructificacion", "tolerancias",
         "ancho_minimo_vereda_m", "distancia_plantacion_m", "alergenicidad",
         "toxicidad", "disponibilidad_vivero", "fuentes"]
for e in especies:
    for campo in PODAR:
        e.pop(campo, None)
    # `fotos` se resuelve por nombre científico contra FOTOTECA; en el payload
    # basta con saber cuántas hay.
    e["fotos"] = [{"tipo": f.get("tipo")} for f in e["fotos"]]

ruta_fototeca = DIST / "fototeca.js"
if not ruta_fototeca.exists():
    sys.exit("Falta dist/fototeca.js — genéralo con:\n"
             '  python build_fotos.py "Fotografías Especies (RyC AU)" '
             "-o dist/fotos --inline")
fototeca_js = ruta_fototeca.read_text(encoding="utf-8")

compacto = lambda x: json.dumps(x, ensure_ascii=False, separators=(",", ":"))
datos_js = (f"window.DATOS={compacto(especies)};"
            f"window.FACETAS={compacto(facetas)};"
            f"window.META={compacto(meta)};")

html = (BASE / "plantilla.html").read_text(encoding="utf-8")
app  = (BASE / "app.js").read_text(encoding="utf-8")

html = html.replace("/*__DATOS__*/", datos_js)
html = html.replace("/*__FOTOS__*/", fototeca_js)
html = html.replace("/*__APP__*/", app)

salida = BASE / "fichas.html"
salida.write_text(html, encoding="utf-8")

mb = salida.stat().st_size / 1048576
print(f"  datos     {len(datos_js)/1024:8.0f} KB   ({len(especies)} especies)")
print(f"  fototeca  {len(fototeca_js)/1024:8.0f} KB")
print(f"  app+css   {(len(app) + len(html) - len(datos_js) - len(fototeca_js))/1024:8.0f} KB")
print(f"  → {salida.name}  {mb:.2f} MB" + ("   ⚠ SOBRE EL LÍMITE DE 16 MB" if mb > 16 else ""))

if "/*__" in html:
    sys.exit("ERROR: quedaron marcadores sin reemplazar en la plantilla")
