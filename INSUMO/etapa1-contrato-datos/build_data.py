#!/usr/bin/env python3
"""
Contrato de datos — Catálogo RyC de Especies para Arbolado Urbano (CONAF)
=========================================================================
Convierte `RyC Especies (AA.MM.AAAA).xlsx` en el JSON que consume el sitio.

Este script es la ÚNICA fuente de la estructura de datos del sitio. Cuando la
base migre a PostgreSQL, la API debe devolver exactamente esta misma forma:
el frontend no cambia. Ver `schema.sql` para el DDL equivalente.

Uso:
    python build_data.py "RyC Especies (21.08.2026).xlsx" -o dist/

Salidas:
    especies.json   catálogo completo normalizado
    facetas.json    valores únicos por campo filtrable (para construir la UI)
    meta.json       conteos, cobertura y fecha de generación
"""

import argparse
import json
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# --------------------------------------------------------------------------
# Códigos regionales. El orden es geográfico norte → sur y ES significativo:
# el sitio lo usa para dibujar el mapa y para el gradiente latitudinal.
# --------------------------------------------------------------------------
REGIONES = [
    ("AYR", "Arica y Parinacota", "XV"),
    ("TAR", "Tarapacá", "I"),
    ("ANT", "Antofagasta", "II"),
    ("ATA", "Atacama", "III"),
    ("COQ", "Coquimbo", "IV"),
    ("VAL", "Valparaíso", "V"),
    ("RMS", "Metropolitana de Santiago", "RM"),
    ("OHI", "Libertador General Bernardo O'Higgins", "VI"),
    ("MAU", "Maule", "VII"),
    ("ÑUB", "Ñuble", "XVI"),
    ("BIO", "Biobío", "VIII"),
    ("ARA", "La Araucanía", "IX"),
    ("LRI", "Los Ríos", "XIV"),
    ("LLA", "Los Lagos", "X"),
    ("AYS", "Aysén del General Carlos Ibáñez del Campo", "XI"),
    ("MAG", "Magallanes y de la Antártica Chilena", "XII"),
    ("IPA", "Rapa Nui", "IPA"),
]
COD_REGIONES = [c for c, _, _ in REGIONES]

COLS = {
    "n": "N",
    "reino": "Reino",
    "division": "Filo/División",
    "clase": "Clase",
    "orden": "Orden",
    "familia": "Familia",
    "genero": "Género",
    "cientifico": "Nombre Científico",
    "comun": "Nombre Común",
    "habito": "Hábito de Crecimiento",
    "origen": "Origen",
    "follaje": "Tipo de Follaje",
    "raiz_botanica": "Tipo de Raíz Botánica",
    "raiz_urbana": "Tipo de Raíz Urbana",
    "mma": "Estado de Conservación MMA",
    "cites": "Estado de Conservación CITES",
    "otras": "Estado de Conservación OTRAS",
    "emplazamiento": "Recomendación de Aptitud y Emplazamiento Urbano",
    "altura": "Clasificación de Altura",
    "longevidad": "Longevidad Estimada",
    "agua": "Eficiencia Hídrica",
    "plagas": "Susceptibilidad a Plagas y Enfermedades",
    "suelo": "Clasificación Edafológica",
    "dureza": "Clasificación de Dureza de la Madera para Arbolado Urbano (Escala Monnin N)",
}

# --------------------------------------------------------------------------
# Etiquetas cortas. El Excel guarda la etiqueta larga y explicativa, que es
# correcta como definición pero inservible como texto de interfaz. Aquí se
# separan: `codigo` para filtrar, `corta` para mostrar, `larga` para el tooltip.
# --------------------------------------------------------------------------
CORTAS = {
    # Emplazamiento
    "Aceras Estrechas y Platabandas Confinadas": "Aceras estrechas",
    "Ejes Viales Mayores y Parques de Mediano Tamaño": "Ejes viales y parques",
    "Corredores Biológicos y Conservación Urbana": "Corredores biológicos",
    "Zonas Verdes Abiertas y Parques Urbanos (Raíz Agresiva)": "Zonas verdes abiertas",
    # Altura
    "Estrato Bajo (Arbustos: < 4 metros)": "Bajo · <4 m",
    "Estrato Medio (Mediano Porte: 4 a 15 metros)": "Medio · 4–15 m",
    "Estrato Alto (Gran Porte: > 15 metros)": "Alto · >15 m",
    # Longevidad
    "Corta (Arbustos: < 25 años)": "Corta · <25 años",
    "Corta (Árboles de ciclo corto: < 30 años)": "Corta · <30 años",
    "Media (Ciclo urbano estándar: 30 a 80 años)": "Media · 30–80 años",
    "Larga (Árboles longevos: > 80 años)": "Larga · >80 años",
    # Agua
    "Eficiencia Hídrica Muy Alta (Xerófita o Riego Mínimo)": "Muy alta",
    "Eficiencia Hídrica Alta (Bajo Consumo o Mediterránea-Esclerófila)": "Alta",
    "Eficiencia Hídrica Media (Consumo Moderado o Riego Regular)": "Media",
    "Eficiencia Hídrica Baja (Alto Consumo o Hidrófila)": "Baja",
    # Plagas
    "Baja Susceptibilidad / Resiliente": "Resiliente",
    "Susceptibilidad Moderada": "Moderada",
    "Alta Susceptibilidad": "Alta",
    # Suelo
    "Suelos Urbanos Antropogénicos / Compactados y Secos": "Urbano compactado",
    "Suelos Profundos y Fértiles (Requieren Humedad Retenida / Francos)": "Profundo fértil",
    "Suelos Profundos, Arenosos o Pedregosos (Drenaje Rápido / Secos)": "Arenoso o pedregoso",
    "Suelos Francos Estándar / Parques y Áreas Verdes Abiertas": "Franco estándar",
    "Suelos Húmedos / Vegas, Humedales o Zonas de Inundación Temporal": "Húmedo",
    # Raíz urbana
    "No Agresiva / Confinable": "No agresiva",
    "Moderadamente Agresiva / Profunda": "Moderada",
    "Agresiva / Superficial": "Agresiva",
    # Raíz botánica
    "Oblicua (Extendida)": "Oblicua",
    "Pivotante (Axonomorfa)": "Pivotante",
    "Mixta (Dimorfa)": "Mixta",
    "Fasciculada (Fibrosa)": "Fasciculada",
    # Dureza
    "No Aplica (Arbusto)": "No aplica",
    "C1: Muy Blanda (N < 1,5)": "C1 · muy blanda",
    "C2: Blanda (1,5 <= N < 3,0)": "C2 · blanda",
    "C3: Semidura (3,0 <= N < 6,0)": "C3 · semidura",
    "C3: Semidura (Estimada)": "C3 · semidura (est.)",
    "C4: Dura a Extra Dura (N >= 6,0)": "C4 · dura",
}

# Códigos cortos y estables. Son exactamente los valores de los ENUM de
# `schema.sql`: el JSON de hoy y la base de mañana hablan el mismo idioma.
CODIGOS = {
    "habito": {"Arbórea": "arborea", "Arbustiva": "arbustiva"},
    "origen": {"Nativa": "nativa", "Introducida": "introducida"},
    "follaje": {"Perenne": "perenne", "Caduco": "caduco"},
    "raiz_botanica": {"Fasciculada (Fibrosa)": "fasciculada", "Oblicua (Extendida)": "oblicua",
                      "Mixta (Dimorfa)": "mixta", "Pivotante (Axonomorfa)": "pivotante"},
    "raiz_urbana": {"No Agresiva / Confinable": "no_agresiva",
                    "Moderadamente Agresiva / Profunda": "moderada",
                    "Agresiva / Superficial": "agresiva"},
    "emplazamiento": {"Aceras Estrechas y Platabandas Confinadas": "aceras_estrechas",
                      "Ejes Viales Mayores y Parques de Mediano Tamaño": "ejes_viales",
                      "Zonas Verdes Abiertas y Parques Urbanos (Raíz Agresiva)": "zonas_verdes",
                      "Corredores Biológicos y Conservación Urbana": "corredores"},
    "altura": {"Estrato Bajo (Arbustos: < 4 metros)": "bajo",
               "Estrato Medio (Mediano Porte: 4 a 15 metros)": "medio",
               "Estrato Alto (Gran Porte: > 15 metros)": "alto"},
    "longevidad": {"Corta (Arbustos: < 25 años)": "corta_arbusto",
                   "Corta (Árboles de ciclo corto: < 30 años)": "corta_arbol",
                   "Media (Ciclo urbano estándar: 30 a 80 años)": "media",
                   "Larga (Árboles longevos: > 80 años)": "larga"},
    "agua": {"Eficiencia Hídrica Muy Alta (Xerófita o Riego Mínimo)": "muy_alta",
             "Eficiencia Hídrica Alta (Bajo Consumo o Mediterránea-Esclerófila)": "alta",
             "Eficiencia Hídrica Media (Consumo Moderado o Riego Regular)": "media",
             "Eficiencia Hídrica Baja (Alto Consumo o Hidrófila)": "baja"},
    "plagas": {"Baja Susceptibilidad / Resiliente": "baja",
               "Susceptibilidad Moderada": "moderada", "Alta Susceptibilidad": "alta"},
    "suelo": {"Suelos Urbanos Antropogénicos / Compactados y Secos": "urbano_compactado",
              "Suelos Francos Estándar / Parques y Áreas Verdes Abiertas": "franco_estandar",
              "Suelos Profundos y Fértiles (Requieren Humedad Retenida / Francos)": "profundo_fertil",
              "Suelos Profundos, Arenosos o Pedregosos (Drenaje Rápido / Secos)": "arenoso_pedregoso",
              "Suelos Húmedos / Vegas, Humedales o Zonas de Inundación Temporal": "humedo"},
    "dureza": {"C1: Muy Blanda (N < 1,5)": "c1", "C2: Blanda (1,5 <= N < 3,0)": "c2",
               "C3: Semidura (3,0 <= N < 6,0)": "c3", "C3: Semidura (Estimada)": "c3_estimada",
               "C4: Dura a Extra Dura (N >= 6,0)": "c4", "No Aplica (Arbusto)": "no_aplica"},
    "mma": {"Extinta (EX)": "ex", "Extinta en la naturaleza (EW)": "ew",
            "En peligro crítico (CR)": "cr", "En Peligro (EN)": "en", "Vulnerable (VU)": "vu",
            "Rara": "rara", "Casi amenazada (NT)": "nt", "Preocupación menor (LC)": "lc"},
    "cites": {"Apéndice I CITES": "i", "Apéndice II CITES": "ii", "Apéndice III CITES": "iii"},
}

# Orden natural de las escalas ordinales, para que la UI no las ordene alfabéticamente
ORDEN = {
    "altura": ["Estrato Bajo (Arbustos: < 4 metros)",
               "Estrato Medio (Mediano Porte: 4 a 15 metros)",
               "Estrato Alto (Gran Porte: > 15 metros)"],
    "longevidad": ["Corta (Arbustos: < 25 años)",
                   "Corta (Árboles de ciclo corto: < 30 años)",
                   "Media (Ciclo urbano estándar: 30 a 80 años)",
                   "Larga (Árboles longevos: > 80 años)"],
    "agua": ["Eficiencia Hídrica Muy Alta (Xerófita o Riego Mínimo)",
             "Eficiencia Hídrica Alta (Bajo Consumo o Mediterránea-Esclerófila)",
             "Eficiencia Hídrica Media (Consumo Moderado o Riego Regular)",
             "Eficiencia Hídrica Baja (Alto Consumo o Hidrófila)"],
    "plagas": ["Baja Susceptibilidad / Resiliente", "Susceptibilidad Moderada",
               "Alta Susceptibilidad"],
    "raiz_urbana": ["No Agresiva / Confinable", "Moderadamente Agresiva / Profunda",
                    "Agresiva / Superficial"],
}

# Categorías MMA, de mayor a menor amenaza
ORDEN_MMA = ["Extinta (EX)", "Extinta en la naturaleza (EW)", "En peligro crítico (CR)",
             "En Peligro (EN)", "Vulnerable (VU)", "Rara", "Casi amenazada (NT)",
             "Preocupación menor (LC)"]
AMENAZADAS = {"Extinta (EX)", "Extinta en la naturaleza (EW)", "En peligro crítico (CR)",
              "En Peligro (EN)", "Vulnerable (VU)"}

# --------------------------------------------------------------------------
# Campos que definen una ficha completa. Los del segundo grupo aún no existen
# en el Excel: se declaran aquí para que el indicador de completitud funcione
# como lista de trabajo y para que el esquema no cambie al empezar a llenarlos.
# --------------------------------------------------------------------------
CAMPOS_ACTUALES = ["cientifico", "comunes", "familia", "habito", "origen", "follaje",
                   "raiz_botanica", "raiz_urbana", "regiones", "emplazamiento",
                   "altura", "longevidad", "agua", "plagas", "suelo", "dureza"]
CAMPOS_PENDIENTES = ["descripcion", "floracion", "fructificacion", "tolerancias",
                     "ancho_minimo_vereda_m", "distancia_plantacion_m", "alergenicidad",
                     "toxicidad", "disponibilidad_vivero", "fuentes", "fotos"]


def slug(texto: str) -> str:
    """Identificador estable y seguro para URL. Es la llave del sitio y de la fototeca."""
    base = unicodedata.normalize("NFKD", str(texto)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")


def limpio(valor):
    """Devuelve None para vacíos: en este catálogo la celda vacía significa ausencia."""
    if valor is None or (isinstance(valor, float) and pd.isna(valor)):
        return None
    texto = str(valor).strip()
    return texto or None


def etiqueta(campo, valor):
    """
    Empaqueta un valor categórico en la forma {codigo, valor, corta}:
    `codigo` es la llave estable (la misma que guarda PostgreSQL y por la que
    filtra el sitio), `valor` la definición completa y `corta` el texto de UI.
    """
    if valor is None:
        return None
    return {"codigo": CODIGOS.get(campo, {}).get(valor, slug(valor)),
            "valor": valor,
            "corta": CORTAS.get(valor, valor)}


def nombres_comunes(celda, genero) -> tuple:
    """
    «Palqui. Parqui. Hediondilla.» → ['Palqui', 'Parqui', 'Hediondilla']

    Descarta los 191 nombres de relleno con la fórmula «<Género> común», que
    no son nombres vernáculos sino marcadores. Devuelve además la marca de
    provisionalidad para que la ficha diga «sin nombre común registrado» en
    vez de inventar uno, y para que el vacío quede en la lista de trabajo.
    """
    if not celda:
        return [], True
    partes = [p.strip(" .") for p in re.split(r"\.\s*", str(celda)) if p.strip(" .")]
    reales, vistos = [], set()
    for p in partes:
        if p.lower() == f"{genero} común".lower() or p.lower() in vistos:
            continue           # el Excel repite algún nombre («Mira. Mira.»)
        vistos.add(p.lower())
        reales.append(p)
    return reales, not reales


def normaliza_hibrido(nombre: str) -> str:
    """El Excel mezcla «×» (U+00D7) y la letra «x». Se unifica al signo correcto."""
    return re.sub(r"(?<= )[xX](?= )", "×", nombre)


def construir(df: pd.DataFrame, fotos: dict) -> list:
    registros = []
    for _, fila in df.iterrows():
        arbustiva = fila[COLS["habito"]] == "Arbustiva"
        cientifico = normaliza_hibrido(str(fila[COLS["cientifico"]]).strip())
        ident = slug(cientifico)
        comunes, provisional = nombres_comunes(limpio(fila[COLS["comun"]]),
                                               limpio(fila[COLS["genero"]]))

        mma = limpio(fila[COLS["mma"]])
        cites = limpio(fila[COLS["cites"]])
        otras = limpio(fila[COLS["otras"]])

        presentes = [c for c in COD_REGIONES if limpio(fila[c])]
        galeria = fotos.get(cientifico, [])

        registro = {
            "id": ident,
            "n": int(fila[COLS["n"]]),
            "cientifico": cientifico,
            "comunes": comunes,
            "nombre_provisional": provisional,

            "taxonomia": {
                "reino": limpio(fila[COLS["reino"]]),
                "division": limpio(fila[COLS["division"]]),
                "clase": limpio(fila[COLS["clase"]]),
                "orden": limpio(fila[COLS["orden"]]),
                "familia": limpio(fila[COLS["familia"]]),
                "genero": limpio(fila[COLS["genero"]]),
            },

            "habito": limpio(fila[COLS["habito"]]),
            "origen": limpio(fila[COLS["origen"]]),
            "follaje": limpio(fila[COLS["follaje"]]),
            "raiz_botanica": etiqueta("raiz_botanica", limpio(fila[COLS["raiz_botanica"]])),
            "raiz_urbana": etiqueta("raiz_urbana", limpio(fila[COLS["raiz_urbana"]])),

            "conservacion": {
                "mma": mma,
                "cites": cites,
                "otras": otras,
                "amenazada": mma in AMENAZADAS,
                "protegida": bool(mma or cites or otras),
            },

            "regiones": presentes,

            "emplazamiento": etiqueta("emplazamiento", limpio(fila[COLS["emplazamiento"]])),
            # Para arbustos estos tres campos son constantes por construcción del
            # Excel, no evaluaciones reales. Se anulan para no simular información.
            "altura": None if arbustiva else etiqueta("altura", limpio(fila[COLS["altura"]])),
            "longevidad": None if arbustiva else etiqueta("longevidad", limpio(fila[COLS["longevidad"]])),
            "dureza": None if arbustiva else etiqueta("dureza", limpio(fila[COLS["dureza"]])),
            "agua": etiqueta("agua", limpio(fila[COLS["agua"]])),
            "plagas": etiqueta("plagas", limpio(fila[COLS["plagas"]])),
            "suelo": etiqueta("suelo", limpio(fila[COLS["suelo"]])),

            "fotos": galeria,

            # Campos declarados y aún vacíos. Existen desde ahora para que
            # llenarlos no requiera migrar el esquema.
            **{campo: None for campo in CAMPOS_PENDIENTES if campo != "fotos"},
        }

        registro["completitud"] = completitud(registro, arbustiva)
        # Texto plano para el buscador: evita normalizar acentos en cada tecla.
        registro["busqueda"] = slug(" ".join(
            [cientifico, *registro["comunes"], registro["taxonomia"]["familia"] or "",
             registro["taxonomia"]["genero"] or ""]))
        registros.append(registro)
    return registros


def completitud(registro: dict, arbustiva: bool) -> dict:
    """
    Proporción de campos poblados sobre el total de la ficha objetivo.
    Los tres campos que no aplican a arbustos se excluyen del denominador
    para no penalizar a un arbusto por no tener dureza de madera.
    """
    actuales = [c for c in CAMPOS_ACTUALES
                if not (arbustiva and c in ("altura", "longevidad", "dureza"))]
    total = len(actuales) + len(CAMPOS_PENDIENTES)

    llenos = 0
    for campo in actuales:
        valor = registro.get(campo) or registro["taxonomia"].get(campo)
        if valor:
            llenos += 1
    for campo in CAMPOS_PENDIENTES:
        if registro.get(campo):
            llenos += 1

    faltantes = [c for c in CAMPOS_PENDIENTES if not registro.get(c)]
    return {"pct": round(100 * llenos / total), "llenos": llenos, "total": total,
            "faltan": faltantes}


def leer_fototeca(raiz: Path) -> dict:
    """
    Mapea nombre científico → lista de fotografías.
    La carpeta se llama exactamente como el nombre científico: ese es hoy el
    único vínculo entre la fototeca y el catálogo.
    """
    if not raiz or not raiz.is_dir():
        return {}
    fototeca = {}
    for carpeta in sorted(p for p in raiz.iterdir() if p.is_dir()):
        archivos = sorted(p.name for p in carpeta.iterdir()
                          if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
        if archivos:
            fototeca[carpeta.name] = [
                {"archivo": a, "id": f"{slug(carpeta.name)}-{i:03d}", "tipo": None,
                 "credito": None}
                for i, a in enumerate(archivos, 1)
            ]
    return fototeca


def facetas(registros: list) -> dict:
    """Valores únicos por campo filtrable, en orden significativo (no alfabético)."""
    def valores(clave):
        vistos = {}
        for r in registros:
            campo = r.get(clave)
            if campo:
                vistos[campo["valor"]] = campo["corta"]
        orden = ORDEN.get(clave)
        items = list(vistos.items())
        if orden:
            items.sort(key=lambda kv: orden.index(kv[0]) if kv[0] in orden else 99)
        else:
            items.sort(key=lambda kv: kv[1])
        return [{"valor": v, "corta": c,
                 "n": sum(1 for r in registros if (r.get(clave) or {}).get("valor") == v)}
                for v, c in items]

    def simples(clave):
        vistos = sorted({r[clave] for r in registros if r.get(clave)})
        return [{"valor": v, "corta": v,
                 "n": sum(1 for r in registros if r.get(clave) == v)} for v in vistos]

    return {
        "habito": simples("habito"),
        "origen": simples("origen"),
        "follaje": simples("follaje"),
        "emplazamiento": valores("emplazamiento"),
        "altura": valores("altura"),
        "longevidad": valores("longevidad"),
        "agua": valores("agua"),
        "plagas": valores("plagas"),
        "suelo": valores("suelo"),
        "raiz_urbana": valores("raiz_urbana"),
        "raiz_botanica": valores("raiz_botanica"),
        "conservacion": [
            {"valor": m, "corta": m,
             "n": sum(1 for r in registros if r["conservacion"]["mma"] == m)}
            for m in ORDEN_MMA
            if any(r["conservacion"]["mma"] == m for r in registros)
        ],
        "familia": [{"valor": f, "corta": f, "n": n} for f, n in sorted(
            pd.Series([r["taxonomia"]["familia"] for r in registros]).value_counts().items(),
            key=lambda kv: (-kv[1], kv[0]))],
        "regiones": [
            {"valor": cod, "corta": nombre, "romano": romano,
             "n": sum(1 for r in registros if cod in r["regiones"])}
            for cod, nombre, romano in REGIONES
        ],
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("excel", help="ruta al archivo RyC Especies (*.xlsx)")
    ap.add_argument("-f", "--fotos", help="carpeta 'Fotografías Especies (RyC AU)'")
    ap.add_argument("-o", "--salida", default="dist", help="carpeta de salida")
    args = ap.parse_args()

    destino = Path(args.salida)
    destino.mkdir(parents=True, exist_ok=True)

    df = pd.read_excel(args.excel, sheet_name="Especies")
    faltan = [c for c in COLS.values() if c not in df.columns]
    if faltan:
        raise SystemExit(f"El Excel no tiene estas columnas esperadas: {faltan}")

    fototeca = leer_fototeca(Path(args.fotos)) if args.fotos else {}
    huerfanas = sorted(set(fototeca) - set(df[COLS["cientifico"]].map(normaliza_hibrido)))

    registros = construir(df, fototeca)
    caras = facetas(registros)

    meta = {
        "generado": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "fuente": Path(args.excel).name,
        "total": len(registros),
        "con_foto": sum(1 for r in registros if r["fotos"]),
        "fotos_totales": sum(len(r["fotos"]) for r in registros),
        "protegidas": sum(1 for r in registros if r["conservacion"]["protegida"]),
        "amenazadas": sum(1 for r in registros if r["conservacion"]["amenazada"]),
        "nativas": sum(1 for r in registros if r["origen"] == "Nativa"),
        "arboreas": sum(1 for r in registros if r["habito"] == "Arbórea"),
        "completitud_media": round(
            sum(r["completitud"]["pct"] for r in registros) / len(registros), 1),
        "regiones": [{"codigo": c, "nombre": n, "romano": ro} for c, n, ro in REGIONES],
        "carpetas_sin_especie": huerfanas,
    }

    for nombre, datos in (("especies.json", registros), ("facetas.json", caras),
                          ("meta.json", meta)):
        ruta = destino / nombre
        ruta.write_text(json.dumps(datos, ensure_ascii=False, separators=(",", ":")),
                        encoding="utf-8")
        print(f"  {nombre:16s} {ruta.stat().st_size / 1024:7.0f} KB")

    print(f"\n{meta['total']} especies · {meta['con_foto']} con fotografía "
          f"({meta['fotos_totales']} imágenes) · completitud media {meta['completitud_media']} %")
    if huerfanas:
        print(f"AVISO — carpetas de fotos sin especie en el Excel: {huerfanas}")


if __name__ == "__main__":
    main()
