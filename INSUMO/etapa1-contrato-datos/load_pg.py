#!/usr/bin/env python3
"""
Carga `especies.json` en PostgreSQL y comprueba que la vista `v_especie_json`
devuelve exactamente la misma forma que el archivo estático.

Esa comprobación es el punto entero del contrato de datos: si pasa, migrar el
sitio de JSON a base de datos no requiere tocar el frontend.

    python load_pg.py dist/especies.json --dsn "dbname=arbolado"
"""

import argparse
import json

import psycopg


def cargar(cur, especies):
    # Taxones, deduplicados
    taxones = {}
    for e in especies:
        t = e["taxonomia"]
        clave = (t["division"], t["clase"], t["orden"], t["familia"], t["genero"])
        taxones.setdefault(clave, None)
    for clave in taxones:
        cur.execute(
            "INSERT INTO taxon (division, clase, orden, familia, genero)"
            " VALUES (%s,%s,%s,%s,%s) RETURNING id", clave)
        taxones[clave] = cur.fetchone()[0]

    cod = lambda campo: (campo or {}).get("codigo")

    for e in especies:
        t = e["taxonomia"]
        taxon_id = taxones[(t["division"], t["clase"], t["orden"], t["familia"], t["genero"])]
        cur.execute("""
            INSERT INTO especie (slug, nombre_cientifico, taxon_id, habito, origen,
                follaje, raiz_botanica, raiz_urbana, emplazamiento, eficiencia_hidrica,
                susceptibilidad, suelo, estrato, longevidad, dureza)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id
        """, (e["id"], e["cientifico"], taxon_id,
              "arborea" if e["habito"] == "Arbórea" else "arbustiva",
              "nativa" if e["origen"] == "Nativa" else "introducida",
              "perenne" if e["follaje"] == "Perenne" else "caduco",
              cod(e["raiz_botanica"]), cod(e["raiz_urbana"]), cod(e["emplazamiento"]),
              cod(e["agua"]), cod(e["plagas"]), cod(e["suelo"]),
              cod(e["altura"]), cod(e["longevidad"]), cod(e["dureza"])))
        eid = cur.fetchone()[0]

        for orden, nombre in enumerate(e["comunes"], 1):
            cur.execute(
                "INSERT INTO nombre_comun (especie_id, nombre, orden, es_provisional)"
                " VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING",
                (eid, nombre, orden,
                 nombre.lower() == f"{t['genero']} común".lower()))

        for region in e["regiones"]:
            cur.execute("INSERT INTO especie_region (especie_id, region) VALUES (%s,%s)",
                        (eid, region))

        c = e["conservacion"]
        if c["protegida"]:
            cur.execute("""INSERT INTO conservacion
                (especie_id, categoria_mma, cites, monumento_natural)
                VALUES (%s,%s,%s,%s)""",
                (eid, MMA.get(c["mma"]), CITES.get(c["cites"]), c["otras"]))

        for orden, foto in enumerate(e["fotos"], 1):
            cur.execute("""INSERT INTO fotografia
                (especie_id, archivo, ruta_original, tipo, es_principal, orden, autor)
                VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                (eid, foto["archivo"],
                 f"Fotografías Especies (RyC AU)/{e['cientifico']}/{foto['archivo']}",
                 foto.get("tipo"), bool(foto.get("hero")), orden, "Patricio Emanuelli"))


MMA = {"Extinta (EX)": "ex", "Extinta en la naturaleza (EW)": "ew",
       "En peligro crítico (CR)": "cr", "En Peligro (EN)": "en", "Vulnerable (VU)": "vu",
       "Rara": "rara", "Casi amenazada (NT)": "nt", "Preocupación menor (LC)": "lc"}
CITES = {"Apéndice I CITES": "i", "Apéndice II CITES": "ii", "Apéndice III CITES": "iii"}


def comparar(cur, especies):
    """Compara campo a campo el JSON estático con lo que devuelve la vista."""
    cur.execute("SELECT id, ficha FROM v_especie_json")
    desde_bd = {fila[0]: fila[1] for fila in cur.fetchall()}

    revisar = ["cientifico", "comunes", "taxonomia", "habito", "origen", "follaje",
               "raiz_botanica", "raiz_urbana", "emplazamiento", "altura", "longevidad",
               "dureza", "agua", "plagas", "suelo", "regiones", "completitud"]
    fallas = []
    for e in especies:
        bd = desde_bd.get(e["id"])
        if bd is None:
            fallas.append((e["id"], "ausente en la base"))
            continue
        for campo in revisar:
            esperado, obtenido = e.get(campo), bd.get(campo)
            if campo == "completitud":
                esperado, obtenido = esperado["pct"], (obtenido or {}).get("pct")
            if esperado != obtenido:
                fallas.append((e["id"], f"{campo}: json={esperado!r} bd={obtenido!r}"))
        cj, cb = e["conservacion"], bd["conservacion"]
        for k in ("mma", "cites", "otras", "amenazada", "protegida"):
            if (cj.get(k) or None) != (cb.get(k) or None):
                fallas.append((e["id"], f"conservacion.{k}: json={cj.get(k)!r} bd={cb.get(k)!r}"))
    return fallas, len(desde_bd)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("json")
    ap.add_argument("--dsn", default="dbname=arbolado")
    args = ap.parse_args()

    especies = json.load(open(args.json, encoding="utf-8"))
    with psycopg.connect(args.dsn, autocommit=False) as con, con.cursor() as cur:
        cur.execute("SET search_path TO arbolado, public")
        cargar(cur, especies)
        con.commit()

        for consulta, esperado in [
            ("SELECT count(*) FROM especie", 1016),
            ("SELECT count(*) FROM especie WHERE origen='nativa'", 565),
            ("SELECT count(*) FROM especie WHERE habito='arborea'", 413),
            ("SELECT count(*) FROM conservacion", 98),
            ("SELECT count(*) FROM conservacion WHERE categoria_mma <= 'vu'", 78),
            ("SELECT count(*) FROM especie_region", 5452),
            ("SELECT count(*) FROM fotografia", 90),
            ("SELECT count(DISTINCT especie_id) FROM fotografia", 15),
            ("SELECT count(*) FROM nombre_comun", 1208),
            ("SELECT count(*) FROM especie e WHERE NOT EXISTS (SELECT 1 FROM nombre_comun n WHERE n.especie_id=e.id)", 191),
            ("SELECT count(*) FROM especie WHERE estrato IS NULL", 603),
        ]:
            cur.execute(consulta)
            obtenido = cur.fetchone()[0]
            marca = "OK   " if obtenido == esperado else "FALLA"
            print(f"{marca} | {consulta.split('FROM ')[1][:52]:54s} "
                  f"esperado={esperado:5d} obtenido={obtenido:5d}")

        fallas, n = comparar(cur, especies)
        print(f"\nContrato JSON ↔ vista v_especie_json: {n} fichas comparadas, "
              f"{len(fallas)} diferencias")
        for ident, detalle in fallas[:15]:
            print(f"   {ident}: {detalle}")


if __name__ == "__main__":
    main()
