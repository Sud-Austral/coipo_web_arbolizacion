import { construirMapaCod } from './dominio.js'

/* BASE_URL termina en barra ('/coipo_web_arbolizacion/') y las rutas de
   `derivados` vienen sin barra inicial ('fotos/…'), así que concatenan
   directo. Escribir `${BASE}/fotos/…` generaría '//fotos/…', que en
   GitHub Pages resuelve a otro host. Esta es la única concatenación. */
const BASE = import.meta.env.BASE_URL

/* El repo despliega solo el AVIF; los WebP de respaldo están en .gitignore,
   así que en producción no existen y un navegador sin AVIF cae a la lámina
   SVG. Apuntando VITE_FOTOS_BASE a un CDN que sí los sirva, el respaldo
   vuelve a funcionar sin tocar ningún componente. */
const BASE_WEBP = import.meta.env.VITE_FOTOS_BASE || BASE

const traer = async (nombre) => {
  const r = await fetch(BASE + 'datos/' + nombre)
  if (!r.ok) throw new Error(`No se pudo cargar ${nombre} (HTTP ${r.status})`)
  return r.json()
}

/* fotos.json se indexa por nombre científico literal, que es la llave de
   unión con especies.json. Nunca por `fotos[].id`: 53 de 90 discrepan
   entre los dos archivos y el fallo es silencioso (muestra otra foto). */
function construirFototeca(bruto) {
  const out = {}
  for (const [especie, fotos] of Object.entries(bruto)) {
    const lista = fotos.map((f) => {
      // Cada tamaño trae sus dos formatos. El AVIF pesa un tercio menos con
      // la misma calidad medida; el WebP queda de respaldo para navegadores
      // que no lo leen (Safari <16.4, Edge <121).
      const par = (clave) => ({
        avif: f.avif ? BASE + f.avif[clave] : null,
        webp: BASE_WEBP + f.derivados[clave],
      })
      return {
        archivo: f.archivo,
        tipo: f.tipo || '',
        hero: !!f.es_principal,
        mini: par('miniatura'),
        ficha: par('ficha'),
        completa: par('completa'),
      }
    })
    // La principal primero y las clasificadas antes que las sueltas. El sort
    // de JS es estable, así que dentro de cada grupo se conserva el `orden`
    // del manifiesto. Con 6 fotos el resultado es el del sitio original.
    lista.sort((a, b) => b.hero - a.hero || (b.tipo ? 1 : 0) - (a.tipo ? 1 : 0))
    out[especie] = lista
  }
  return out
}

export const datosPromesa = (async () => {
  const [especies, facetas, meta, fotos] = await Promise.all([
    traer('especies.json'),
    traer('facetas.json'),
    traer('meta.json'),
    traer('fotos.json'),
  ])
  return {
    especies,
    facetas,
    meta,
    regiones: meta.regiones,
    fototeca: construirFototeca(fotos),
    mapaCod: construirMapaCod(especies),
  }
})()
