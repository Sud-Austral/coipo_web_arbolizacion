# Catálogo de Especies para Arbolado Urbano — código fuente

CONAF · agosto 2026

Todo lo necesario para regenerar los datos, procesar la fototeca y reconstruir
el sitio.

**Las fotografías no van en este zip, ni las originales ni los derivados.** Las
originales son 1,65 GB y ya viven en `Fotografías Especies (RyC AU)`, junto a
esta carpeta; `build_fotos.py` las lee de ahí y nunca las modifica. Los
derivados web ya están generados en `dist/fotos/` — **1.047 archivos, 138 MB, un
8,2 % del peso original** — con su manifiesto en `dist/fotos.json`. No hace falta
reprocesarlos.

---

## Estructura

```
build_data.py               Excel  →  JSON del catálogo
build_fotos.py              fototeca  →  derivados WebP + manifiesto EXIF
fotos_clasificacion.json    tipo de toma por archivo (porte, hoja, flor…)
schema.sql                  esquema PostgreSQL equivalente
load_pg.py                  carga en PostgreSQL y verifica el contrato

sitio/
  plantilla.html            estructura y hoja de estilos
  app.js                    filtros, mapa, ficha, buscador, enrutado
  armar.py                  ensambla todo en un único fichas.html

dist/
  especies.json             catálogo normalizado (1.016 fichas)
  facetas.json              valores por campo con recuentos, para los filtros
  meta.json                 totales, cobertura y tabla de regiones
  fotos.json                manifiesto de las 349 fotografías con su EXIF
```

Y ya en tu carpeta, fuera del zip por peso:

```
dist/fotos/<especie>/<archivo>-{400,1000,1800}.webp      1.047 archivos, 138 MB
```

Tres tamaños por fotografía: 400 px para la grilla de tarjetas, 1000 px para el
retrato y la galería de la ficha, 1800 px para la lupa.

## Reconstruir todo

```bash
pip install pandas openpyxl pillow

# 1 · datos
python build_data.py "RyC Especies (21.08.2026).xlsx" \
       -f "Fotografías Especies (RyC AU)" -o dist/

# 2 · imágenes — ya están generadas; --continuar rehace solo lo que falte
python build_fotos.py "Fotografías Especies (RyC AU)" -o dist/fotos \
       --inline --continuar

# 3 · prototipo de un solo archivo
python sitio/armar.py            # → sitio/fichas.html
```

El paso 2 completo tarda del orden de quince minutos —son 349 fotos de hasta 20
megapíxeles por tres tamaños—; con `--continuar` las siguientes ejecuciones son
casi instantáneas porque solo rehace lo que cambió.

El paso 3 existe solo para el prototipo, que embebe datos e imágenes en un HTML
autocontenido porque tiene que funcionar sin servidor. **En el sitio definitivo
ese paso desaparece**: `especies.json` se sirve como archivo y las imágenes desde
`dist/fotos/`. `plantilla.html` y `app.js` pasan tal cual.

---

## La idea de fondo

El sitio no lee el Excel ni la base de datos. Lee un **contrato**: la forma de
`especies.json`. Hoy ese contrato lo produce `build_data.py`; mañana lo producirá
PostgreSQL a través de la vista `v_especie_json`. Mientras la forma se respete,
migrar no toca el frontend.

Está verificado, no supuesto: se cargaron las 1.016 especies en un PostgreSQL 16
real y se comparó ficha por ficha contra el JSON. **Cero diferencias en los 17
campos de las 1.016 fichas.** `load_pg.py` es esa comprobación, y conviene
volver a correrla después de cualquier cambio de esquema.

## Cómo se mantiene mientras no exista la base

Editas el Excel como siempre y corres `build_data.py`. El Excel sigue siendo la
fuente de verdad. Nada más.

---

## Decisiones que trae la normalización

Todas salen del análisis documentado en `contexto.md`.

**Las 17 columnas de región se convierten en una lista.** Una celda con el código
significa presencia; vacía, ausencia. En PostgreSQL es `especie_region`, que
además separa distribución natural de uso urbano acreditado — distinción que hoy
no existe y que el cruce con el GPS de las fotografías mostró que hace falta.

**Altura, longevidad y dureza quedan nulas en los 603 arbustos.** En el Excel
traen un valor constante por construcción, no una evaluación. Dejarlas vacías
evita que la interfaz simule información que nadie midió; la ficha de un arbusto
muestra una sola línea de porte, explicada.

**Los 191 nombres comunes con la fórmula «\<Género\> común» se descartan.** No
son nombres vernáculos sino marcadores de relleno. La ficha dice «sin nombre
común registrado», que es cierto y sirve como lista de trabajo.

**Cada valor categórico viaja como `{codigo, valor, corta}`.** El `codigo` es la
llave estable por la que filtra el sitio y que almacena PostgreSQL; `valor` es la
definición completa del Excel; `corta` es el texto de interfaz, porque
«Eficiencia Hídrica Muy Alta (Xerófita o Riego Mínimo)» es una buena definición y
un pésimo rótulo de botón.

**La notación de híbridos se unifica** en el signo `×`, que el Excel mezcla con
la letra `x` en 6 registros.

## Campos declarados y todavía vacíos

El esquema ya reserva lo que vas a querer completar, para que llenarlo sea un
`UPDATE` y no una migración: descripción, floración (meses y color),
fructificación, tolerancias a helada, viento, salinidad, contaminación y poda,
ancho mínimo de vereda, distancia de plantación, alergenicidad, toxicidad,
disponibilidad en vivero y fuentes bibliográficas.

El indicador de completitud de cada ficha se calcula sobre ese total, así que
funciona como lista de trabajo desde ahora: **la media hoy es 55 %**.

## Clasificación de la fototeca

`fotos_clasificacion.json` dice qué muestra cada fotografía. Hoy cubre **90 de
las 349** —las que usa el prototipo: 24 de hoja, 18 de flor, 17 de porte, 15 de
fruto, 10 de corteza y 6 de contexto—. Las otras 259 están pendientes, y es el
trabajo de mayor impacto visual que queda: es lo que permite que cada ficha elija
bien su retrato y ordene su galería, en vez de mostrar las imágenes en el orden
arbitrario del nombre de archivo.

```json
{
  "Quillaja saponaria": {
    "DSC_5281.JPG": { "tipo": "porte", "hero": true },
    "123.jpg":      { "tipo": "flor" }
  }
}
```

Tipos válidos: `porte`, `contexto`, `hoja`, `flor`, `fruto`, `corteza`,
`plantula`, `otro`. Un solo `hero` por especie; si falta, se usa la primera.

## Lo que salió del EXIF

`dist/fotos.json` guarda fecha, cámara y coordenadas de cada toma. De las 349
fotografías, **139 tienen coordenadas utilizables**: Los Ríos 52, Atacama 30,
Los Lagos 23, La Araucanía 18, Metropolitana 15 y Aysén 1.

Ese dato ya sirvió para algo concreto: cruzar la región de captura contra la
matriz regional del Excel detectó **dos presencias faltantes** — *Geoffroea
decorticans* y *Liquidambar styraciflua* tienen fotografías tomadas en Santiago
pero la columna `RMS` vacía. El método funciona como control de calidad y se
puede repetir cada vez que se agreguen fotos georreferenciadas.

## Notas de despliegue

El sitio es estático: no necesita servidor de aplicaciones. Las tipografías
(Newsreader, Archivo, IBM Plex Mono) vienen de Google Fonts; si el despliegue
tiene que ser autónomo, hay que descargarlas y servirlas junto al sitio.

Las fotografías son de autoría propia. Al publicarlas conviene declarar autor y
licencia de forma explícita en el pie del sitio.

---

*Verificado contra `RyC Especies (21.08.2026).xlsx` en su versión del 24-08-2026
— 1.016 especies, 5.452 presencias regionales, 98 protegidas, 349 fotografías en
15 especies, 1,65 GB reducidos a 138 MB.*
