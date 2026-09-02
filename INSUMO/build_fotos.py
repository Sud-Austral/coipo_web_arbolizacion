#!/usr/bin/env python3
"""
Pipeline de imágenes — Catálogo RyC de Especies para Arbolado Urbano (CONAF)
============================================================================
Convierte la fototeca original (349 JPG, ~1,7 GB, de 8 a 20 megapíxeles) en
derivados web y en un manifiesto que vincula cada imagen con su especie.

Los originales NO se tocan: se leen y se dejan donde están. Lo que produce
este script es lo único que se despliega.

Tres derivados por fotografía, que es lo que consume el sitio:
    miniatura   400 px   grilla de tarjetas
    ficha      1000 px   retrato principal y galería
    completa   1800 px   lupa

Además extrae el EXIF y lo deja en el manifiesto: fecha, cámara y coordenadas.
Las coordenadas no son un adorno — el cruce de la región de captura contra la
matriz regional del Excel ya detectó dos presencias faltantes (chañar y
liquidámbar fotografiados en Santiago sin tener `RMS` marcada).

Uso:
    python build_fotos.py "Fotografías Especies (RyC AU)" -o dist/fotos
    python build_fotos.py "Fotografías Especies (RyC AU)" -o dist/fotos --inline

Salidas:
    dist/fotos/<especie>/<archivo>-{400,1000,1800}.webp
    dist/fotos.json      manifiesto: especie → fotografías, tipo de toma y EXIF
    dist/fototeca.js     solo con --inline: las imágenes como data: URI,
                         para el prototipo de un archivo
"""

import argparse
import base64
import io
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps

TAMANOS = [("miniatura", 400, 68), ("ficha", 1000, 72), ("completa", 1800, 74)]
EXTENSIONES = {".jpg", ".jpeg", ".png"}

# Límites latitudinales aproximados de las regiones de Chile continental.
# Sirven para situar una fotografía a partir de su GPS; no reemplazan la
# cartografía oficial, solo ubican la toma con precisión suficiente para
# contrastarla con la matriz regional del catálogo.
LIMITES = [
    (-17.5, -19.3, "AYR"), (-19.3, -21.6, "TAR"), (-21.6, -26.0, "ANT"),
    (-26.0, -29.4, "ATA"), (-29.4, -32.3, "COQ"), (-32.3, -33.1, "VAL"),
    (-33.1, -34.3, "RMS"), (-34.3, -35.0, "OHI"), (-35.0, -36.2, "MAU"),
    (-36.2, -37.1, "ÑUB"), (-37.1, -38.4, "BIO"), (-38.4, -39.4, "ARA"),
    (-39.4, -40.6, "LRI"), (-40.6, -44.0, "LLA"), (-44.0, -49.3, "AYS"),
    (-49.3, -56.0, "MAG"),
]

TIPOS = ["porte", "contexto", "hoja", "flor", "fruto", "corteza", "plantula", "otro"]


def slug(texto: str) -> str:
    base = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")


def region_de(lat: float):
    for norte, sur, codigo in LIMITES:
        if sur <= lat <= norte:
            return codigo
    return None


def grados(valor):
    """Convierte el GPS del EXIF (grados, minutos, segundos) a decimal."""
    try:
        return float(valor[0]) + float(valor[1]) / 60 + float(valor[2]) / 3600
    except (TypeError, IndexError, ValueError, ZeroDivisionError):
        return None


def metadatos(imagen) -> dict:
    """
    Fecha, cámara y posición. Devuelve solo lo que realmente está: de las 349
    fotografías, 252 traen bloque GPS pero apenas 139 tienen coordenadas
    completas, así que los campos ausentes se omiten en vez de inventarse.
    """
    datos = {}
    try:
        exif = imagen.getexif()
    except Exception:
        return datos
    if not exif:
        return datos

    marca = str(exif.get(271, "")).strip()
    modelo = str(exif.get(272, "")).strip()
    if marca or modelo:
        datos["camara"] = f"{marca} {modelo}".strip()

    fecha = str(exif.get(306) or "")
    if len(fecha) >= 10 and fecha[:4].isdigit():
        datos["capturada_en"] = fecha[:10].replace(":", "-")

    try:
        gps = exif.get_ifd(0x8825)
    except Exception:
        gps = None
    if gps:
        lat, lon = grados(gps.get(2)), grados(gps.get(4))
        if lat is not None and lon is not None:
            if str(gps.get(1, "N")).upper().startswith("S"):
                lat = -lat
            if str(gps.get(3, "E")).upper().startswith("W"):
                lon = -lon
            datos["latitud"] = round(lat, 6)
            datos["longitud"] = round(lon, 6)
            region = region_de(lat)
            if region:
                datos["region"] = region
            if gps.get(6):
                try:
                    datos["altitud_m"] = round(float(gps[6]))
                except (TypeError, ValueError):
                    pass
    return datos


def derivar(imagen, ancho: int, calidad: int) -> bytes:
    """Reduce al ancho pedido y codifica en WebP. `method=5` equilibra peso y tiempo."""
    copia = ImageOps.exif_transpose(imagen)          # respeta la rotación de la cámara
    w, h = copia.size
    if w > ancho:
        copia = copia.resize((ancho, round(h * ancho / w)), Image.LANCZOS)
    buffer = io.BytesIO()
    copia.convert("RGB").save(buffer, "WEBP", quality=calidad, method=5)
    return buffer.getvalue()


def procesar(origen: Path, destino: Path, clasificacion: dict, inline: bool):
    manifiesto, bundle = {}, {}
    bytes_origen = bytes_salida = 0
    sin_clasificar = 0
    por_tipo = Counter()

    carpetas = sorted(p for p in origen.iterdir() if p.is_dir())
    if not carpetas:
        raise SystemExit(f"No hay subcarpetas de especie en {origen}")

    for carpeta in carpetas:
        especie = carpeta.name                      # el nombre científico exacto
        archivos = sorted(p for p in carpeta.iterdir()
                          if p.suffix.lower() in EXTENSIONES)
        if not archivos:
            continue

        marcado = clasificacion.get(especie, {})
        salida_especie = destino / slug(especie)
        salida_especie.mkdir(parents=True, exist_ok=True)

        fotos, galeria = [], []
        for orden, archivo in enumerate(archivos, 1):
            bytes_origen += archivo.stat().st_size
            with Image.open(archivo) as imagen:
                ancho_px, alto_px = imagen.size
                ficha = {
                    "id": f"{slug(especie)}-{orden:03d}",
                    "archivo": archivo.name,
                    "ruta_original": str(archivo.relative_to(origen.parent)),
                    "orden": orden,
                    "ancho_px": ancho_px,
                    "alto_px": alto_px,
                    "bytes": archivo.stat().st_size,
                    **metadatos(imagen),
                }

                etiqueta = marcado.get(archivo.name, {})
                ficha["tipo"] = etiqueta.get("tipo")
                ficha["es_principal"] = bool(etiqueta.get("hero"))
                if ficha["tipo"]:
                    por_tipo[ficha["tipo"]] += 1
                else:
                    sin_clasificar += 1

                base = slug(archivo.stem)
                ficha["derivados"] = {}
                for nombre, ancho, calidad in TAMANOS:
                    datos = derivar(imagen, ancho, calidad)
                    ruta = salida_especie / f"{base}-{ancho}.webp"
                    ruta.write_bytes(datos)
                    bytes_salida += len(datos)
                    ficha["derivados"][nombre] = str(ruta.relative_to(destino.parent))

                if inline:
                    galeria.append({
                        "archivo": archivo.name,
                        "tipo": ficha["tipo"],
                        "hero": ficha["es_principal"],
                        "src": "data:image/webp;base64," + base64.b64encode(
                            derivar(imagen, 1120 if ficha["es_principal"] else 460,
                                    66 if ficha["es_principal"] else 64)).decode(),
                    })

            fotos.append(ficha)

        # Si nadie marcó la principal, se toma la primera para que la ficha
        # siempre tenga retrato. Queda registrado como pendiente de revisión.
        if fotos and not any(f["es_principal"] for f in fotos):
            fotos[0]["es_principal"] = True
            if inline and galeria:
                galeria[0]["hero"] = True

        manifiesto[especie] = fotos
        if inline:
            bundle[especie] = galeria
        print(f"  {especie:28s} {len(fotos):3d} fotos")

    return manifiesto, bundle, bytes_origen, bytes_salida, sin_clasificar, por_tipo


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("fotos", help="carpeta 'Fotografías Especies (RyC AU)'")
    ap.add_argument("-o", "--salida", default="dist/fotos", help="carpeta de derivados")
    ap.add_argument("-c", "--clasificacion", default="fotos_clasificacion.json",
                    help="tipo de toma por archivo (porte, hoja, flor, fruto…)")
    ap.add_argument("--inline", action="store_true",
                    help="además, generar fototeca.js con las imágenes embebidas")
    args = ap.parse_args()

    origen = Path(args.fotos)
    if not origen.is_dir():
        raise SystemExit(f"No existe la carpeta {origen}")
    destino = Path(args.salida)
    destino.mkdir(parents=True, exist_ok=True)

    ruta_clas = Path(args.clasificacion)
    clasificacion = json.loads(ruta_clas.read_text(encoding="utf-8")) if ruta_clas.exists() else {}
    if not clasificacion:
        print(f"AVISO — sin {ruta_clas}: ninguna fotografía tendrá tipo de toma.\n")

    manifiesto, bundle, entrada, salida, sin_clasificar, por_tipo = procesar(
        origen, destino, clasificacion, args.inline)

    raiz = destino.parent
    (raiz / "fotos.json").write_text(
        json.dumps(manifiesto, ensure_ascii=False, indent=1), encoding="utf-8")
    if args.inline:
        (raiz / "fototeca.js").write_text(
            "window.FOTOTECA=" + json.dumps(bundle, ensure_ascii=False,
                                            separators=(",", ":")) + ";",
            encoding="utf-8")

    total = sum(len(v) for v in manifiesto.values())
    con_gps = sum(1 for v in manifiesto.values() for f in v if "latitud" in f)
    regiones = Counter(f["region"] for v in manifiesto.values()
                       for f in v if f.get("region"))

    print(f"\n{len(manifiesto)} especies · {total} fotografías")
    print(f"originales {entrada / 1073741824:.2f} GB → derivados "
          f"{salida / 1048576:.0f} MB  ({salida / entrada * 100:.1f} %)")
    print(f"georreferenciadas {con_gps} · regiones {dict(regiones.most_common())}")
    print(f"tipo de toma asignado a {total - sin_clasificar} de {total} "
          f"{dict(por_tipo.most_common())}")
    if sin_clasificar:
        print(f"\nPendiente: clasificar {sin_clasificar} fotografías en "
              f"{ruta_clas}. Formato:\n"
              '  {"Quillaja saponaria": {"DSC_0141.JPG": {"tipo": "porte", "hero": true}}}\n'
              f"  tipos válidos: {', '.join(TIPOS)}")


if __name__ == "__main__":
    main()
