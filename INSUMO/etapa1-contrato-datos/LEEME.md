# Etapa 1 — Contrato de datos

Catálogo RyC de Especies para Arbolado Urbano · CONAF · agosto 2026

Esta carpeta contiene la base sobre la que se construye el sitio. La idea de
fondo es una sola: **el sitio no lee el Excel ni la base de datos, lee un
contrato**. Hoy ese contrato lo produce un script desde tu `.xlsx`; mañana lo
producirá PostgreSQL. Mientras la forma se respete, migrar no toca el frontend.

Eso está verificado, no supuesto: se cargaron las 1.016 especies en un
PostgreSQL real y se comparó ficha por ficha contra el JSON. **Cero diferencias.**

---

## Archivos

| Archivo | Qué hace |
|---|---|
| `build_data.py` | Convierte el Excel en los tres JSON que consume el sitio |
| `schema.sql` | Esquema PostgreSQL equivalente, con la vista que reproduce el mismo contrato |
| `load_pg.py` | Carga el JSON en PostgreSQL y verifica que la vista devuelva lo mismo |
| `dist/especies.json` | Catálogo completo normalizado (1.016 fichas) |
| `dist/facetas.json` | Valores únicos por campo, con recuentos — arma los filtros de la interfaz |
| `dist/meta.json` | Totales, cobertura fotográfica y tabla de regiones |

## Uso

```bash
pip install pandas openpyxl

# Regenerar los datos del sitio después de editar el Excel
python build_data.py "RyC Especies (21.08.2026).xlsx" \
       -f "Fotografías Especies (RyC AU)" -o dist/

# Levantar el esquema y comprobar el contrato (opcional, requiere PostgreSQL)
createdb arbolado
psql -d arbolado -f schema.sql
pip install "psycopg[binary]"
python load_pg.py dist/especies.json --dsn "dbname=arbolado"
```

El flujo de trabajo mientras no exista la base: **editas el Excel como siempre,
corres `build_data.py`, el sitio se actualiza.** Nada más.

---

## Decisiones que trae la normalización

Todas salen del análisis del Excel documentado en `contexto.md`.

**Las 17 columnas de región se convierten en una lista.** Una celda con el
código significa presencia; vacía, ausencia. En PostgreSQL es la tabla
`especie_region`, que además separa distribución natural de uso urbano
acreditado — distinción que hoy no existe y que el cruce con el GPS de las
fotografías mostró que hace falta.

**Altura, longevidad y dureza quedan nulas en los 603 arbustos.** En el Excel
traen un valor constante por construcción, no una evaluación. Dejarlos vacíos
evita que la interfaz simule información que nadie midió; la ficha de un
arbusto muestra una sola línea de porte, explicada.

**Los 191 nombres comunes con la fórmula «\<Género\> común» se descartan.** No
son nombres vernáculos sino marcadores de relleno. La ficha dice «sin nombre
común registrado», que es cierto y sirve como lista de trabajo.

**Cada valor categórico viaja como `{codigo, valor, corta}`.** El `codigo` es
la llave estable por la que filtra el sitio y que almacena PostgreSQL; `valor`
es la definición completa del Excel; `corta` es el texto de interfaz, porque
«Eficiencia Hídrica Muy Alta (Xerófita o Riego Mínimo)» es una buena definición
y un pésimo rótulo de botón.

**La notación de híbridos se unifica** en el signo `×`, que el Excel mezcla con
la letra `x` en 6 registros.

## Campos declarados y todavía vacíos

El esquema ya reserva lo que vas a querer completar, para que llenarlo sea un
`UPDATE` y no una migración: descripción, floración (meses y color),
fructificación, tolerancias a helada, viento, salinidad, contaminación y poda,
ancho mínimo de vereda, distancia de plantación, alergenicidad, toxicidad,
disponibilidad en vivero y fuentes bibliográficas.

El indicador de completitud de cada ficha se calcula sobre ese total, así que
funciona desde ahora como lista de trabajo: **la media hoy es 55 %**.

## Trazabilidad

`schema.sql` incluye las tablas `fuente`, `especie_fuente` y
`especie_historial`. Es el vacío más serio del Excel actual: ninguna
clasificación indica de dónde sale, y con 257 durezas de madera estimadas saber
qué está respaldado deja de ser opcional.

---

*Verificado contra `RyC Especies (21.08.2026).xlsx` en su versión del
24-08-2026 — 1.016 especies, 5.452 presencias regionales, 98 protegidas,
90 fotografías en 15 especies.*
