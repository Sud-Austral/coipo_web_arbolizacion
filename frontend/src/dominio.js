/* Lógica de dominio del catálogo. JS puro: sin React y sin DOM.
   Portado de INSUMO/sitio-arbolado-urbano/sitio/app.js — los nombres y los
   valores se mantienen literales porque son llaves de datos, no etiquetas. */

export const PASO = 48 // tarjetas por tanda de scroll infinito

export const CAMPOS = [
  { clave: 'emplazamiento', titulo: 'Emplazamiento urbano', abierto: true },
  { clave: 'habito', titulo: 'Hábito' },
  { clave: 'origen', titulo: 'Origen' },
  { clave: 'altura', titulo: 'Altura' },
  { clave: 'agua', titulo: 'Eficiencia hídrica' },
  { clave: 'raiz_urbana', titulo: 'Agresividad de raíz' },
  { clave: 'suelo', titulo: 'Suelo' },
  { clave: 'follaje', titulo: 'Follaje' },
  { clave: 'longevidad', titulo: 'Longevidad' },
  { clave: 'plagas', titulo: 'Susceptibilidad sanitaria' },
  { clave: 'conservacion', titulo: 'Estado de conservación' },
  { clave: 'familia', titulo: 'Familia botánica', desborde: true },
]

/* Orden de gravedad. Es también el criterio del ordenamiento «amenaza».
   Las mayúsculas son las del dato: «En Peligro (EN)» con P mayúscula y
   «En peligro crítico (CR)» con minúscula. Normalizarlas rompe el filtro. */
export const RANGO = [
  'Extinta (EX)',
  'Extinta en la naturaleza (EW)',
  'En peligro crítico (CR)',
  'En Peligro (EN)',
  'Vulnerable (VU)',
  'Rara',
  'Casi amenazada (NT)',
  'Preocupación menor (LC)',
]

export const GRAVEDAD = {
  'Extinta (EX)': 'critico',
  'Extinta en la naturaleza (EW)': 'critico',
  'En peligro crítico (CR)': 'critico',
  'En Peligro (EN)': 'serio',
  'Vulnerable (VU)': 'aviso',
  Rara: 'aviso',
  'Casi amenazada (NT)': 'neutro',
  'Preocupación menor (LC)': 'neutro',
}

export const SIGLA = {
  'Extinta (EX)': 'EX',
  'Extinta en la naturaleza (EW)': 'EW',
  'En peligro crítico (CR)': 'CR',
  'En Peligro (EN)': 'EN',
  'Vulnerable (VU)': 'VU',
  Rara: 'Rara',
  'Casi amenazada (NT)': 'NT',
  'Preocupación menor (LC)': 'LC',
}

/* Medidores ordinales: la posición es el dato. Más lleno = mejor. */
export const ESCALA = {
  agua: { muy_alta: 4, alta: 3, media: 2, baja: 1 },
  plagas: { baja: 3, moderada: 2, alta: 1 },
  raiz_urbana: { no_agresiva: 3, moderada: 2, agresiva: 1 },
}

export const ESTRATOS = {
  bajo: { techo: 4, paso: 1, texto: 'Arbusto · bajo 4 m' },
  medio: { techo: 15, paso: 5, texto: 'Árbol mediano · 4 a 15 m' },
  alto: { techo: 30, paso: 10, texto: 'Gran porte · sobre 15 m' },
}

export const NOMBRE_CAMPO = {
  descripcion: 'Descripción',
  floracion: 'Floración',
  fructificacion: 'Fructificación',
  tolerancias: 'Tolerancias',
  ancho_minimo_vereda_m: 'Ancho mínimo de vereda',
  distancia_plantacion_m: 'Distancia de plantación',
  alergenicidad: 'Alergenicidad',
  toxicidad: 'Toxicidad',
  disponibilidad_vivero: 'Disponibilidad en vivero',
  fuentes: 'Fuentes',
  fotos: 'Fotografías',
}

export const estratoDe = (e) =>
  e.habito === 'Arbustiva'
    ? 'bajo'
    : e.altura && e.altura.codigo === 'alto'
      ? 'alto'
      : 'medio'

/* ── Texto ───────────────────────────────────────────────────────────── */

const FORMATO_MILES = new Intl.NumberFormat('es-CL')
export const miles = (n) => FORMATO_MILES.format(n)

/* Mismo slug que build_data.py. El campo `busqueda` de cada especie es un
   slug con guiones, así que la consulta tiene que pasar por aquí también:
   el original solo quitaba acentos y por eso «quillaja saponaria» con
   espacio no encontraba nada. */
export const slug = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/* La definición útil del Excel vive en el paréntesis final; el resto repite
   el nombre del campo. «Eficiencia Hídrica Muy Alta (Xerófita o Riego
   Mínimo)» → «Xerófita o Riego Mínimo». */
export function detalle(valor, corta) {
  const m = valor.match(/\(([^()]+)\)\s*$/)
  const d = m ? m[1] : valor
  return d.toLowerCase() === corta.toLowerCase() ? '' : d
}

/* ── Códigos ─────────────────────────────────────────────────────────── */

/* Devuelve el código filtrable de un campo, sea objeto {codigo,…} o texto
   plano. Los códigos sintéticos (arborea, nativa, perenne…) no existen en
   ningún JSON: nacen aquí, igual que en el original. */
export function cod(e, clave) {
  if (clave === 'habito') return e.habito === 'Arbórea' ? 'arborea' : 'arbustiva'
  if (clave === 'origen') return e.origen === 'Nativa' ? 'nativa' : 'introducida'
  if (clave === 'follaje') return e.follaje === 'Perenne' ? 'perenne' : 'caduco'
  if (clave === 'familia') return e.taxonomia.familia
  if (clave === 'conservacion') return e.conservacion.mma
  const c = e[clave]
  return c ? c.codigo : null
}

/* facetas.json trae {valor, corta, n} pero no `codigo`, así que el mapa
   valor→codigo se reconstruye recorriendo los datos una sola vez. */
export function construirMapaCod(especies) {
  const mapa = {}
  for (const { clave } of CAMPOS) {
    if (clave === 'familia' || clave === 'conservacion') continue
    const m = {}
    for (const e of especies) {
      if (clave === 'habito') m[e.habito] = cod(e, 'habito')
      else if (clave === 'origen') m[e.origen] = cod(e, 'origen')
      else if (clave === 'follaje') m[e.follaje] = cod(e, 'follaje')
      else if (e[clave]) m[e[clave].valor] = e[clave].codigo
    }
    mapa[clave] = m
  }
  return mapa
}

/* Para familia y conservación el «código» es el valor largo tal cual. */
export const codigoDeOpcion = (mapa, campo, valor) =>
  campo === 'familia' || campo === 'conservacion' ? valor : (mapa[campo]?.[valor] ?? valor)

/* ── Filtrado ────────────────────────────────────────────────────────── */

/* OR dentro de cada faceta, AND entre facetas, OR entre regiones, AND con
   la búsqueda. `omitir` sirve para los conteos disyuntivos: una faceta con
   selección se cuenta ignorándose a sí misma, para que sus otras opciones
   no aparezcan todas en cero. Las regiones nunca se omiten. */
export function coincide(e, q, regiones, filtros, omitir) {
  if (q && !e.busqueda.includes(q)) return false
  if (regiones.size && !e.regiones.some((x) => regiones.has(x))) return false
  for (const clave in filtros) {
    if (clave === omitir) continue
    const sel = filtros[clave]
    if (!sel.size) continue
    if (!sel.has(cod(e, clave))) return false
  }
  return true
}

export const filtrar = (especies, q, regiones, filtros, omitir) =>
  especies.filter((e) => coincide(e, q, regiones, filtros, omitir))

/* ── Ordenamiento ────────────────────────────────────────────────────── */

/* Un solo colador para todo: `a.localeCompare(b, 'es')` construye uno nuevo
   en cada comparación, y son ~10.000 por reordenamiento. */
const COLADOR = new Intl.Collator('es')
const alfa = (a, b) => COLADOR.compare(a.cientifico, b.cientifico)
const rango = (x) => (x.conservacion.mma ? RANGO.indexOf(x.conservacion.mma) : 99)

export const ORDENES = {
  foto: (a, b) => b.fotos.length - a.fotos.length || alfa(a, b),
  alfa,
  regiones: (a, b) => b.regiones.length - a.regiones.length || alfa(a, b),
  completitud: (a, b) => b.completitud.pct - a.completitud.pct || alfa(a, b),
  amenaza: (a, b) => rango(a) - rango(b) || alfa(a, b),
}

export const OPCIONES_ORDEN = [
  ['foto', 'Destacadas'],
  ['alfa', 'Alfabético'],
  ['regiones', 'Amplitud regional'],
  ['completitud', 'Ficha más completa'],
  ['amenaza', 'Grado de amenaza'],
]
