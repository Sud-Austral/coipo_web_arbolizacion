/* Genera un AVIF por cada derivado WebP y anota las rutas en el manifiesto.
 *
 * AVIF q50 mide igual o mejor que el WebP actual (PSNR 35.23 vs 35.15 dB a
 * 1000 px) pesando un tercio menos. Se conserva el WebP como respaldo para
 * los navegadores que no leen AVIF (Safari <16.4, Edge <121), servidos con
 * <picture>: el moderno baja el AVIF, el viejo el WebP.
 *
 * Necesita sharp, que NO es dependencia del proyecto: solo hace falta para
 * regenerar las fotos, no para construir el sitio, y son ~10 MB de binarios
 * nativos que CI no tiene por qué descargar en cada despliegue.
 *
 *   npm i --no-save sharp
 *   node scripts/generar-avif.mjs [--rehacer]
 */
let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('Falta sharp. Instálalo sin tocar package.json:')
  console.error('')
  console.error('  npm i --no-save sharp')
  console.error('')
  process.exit(1)
}
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import os from 'os'
import path from 'path'

const RAIZ = path.resolve(import.meta.dirname, '..')
const ORIGINALES = path.join(RAIZ, '..', 'INSUMO_FOTO')
const MANIFIESTO = path.join(RAIZ, 'public/datos/fotos.json')
const PUBLICO = path.join(RAIZ, 'public')

const CALIDAD = 50
const ESFUERZO = 4
const ANCHOS = { miniatura: 400, ficha: 1000, completa: 1800 }
const REHACER = process.argv.includes('--rehacer')

const manifiesto = JSON.parse(readFileSync(MANIFIESTO, 'utf8'))

// Una tarea por derivado a producir.
const tareas = []
for (const [especie, fotos] of Object.entries(manifiesto)) {
  for (const foto of fotos) {
    const origen = path.join(ORIGINALES, especie, foto.archivo)
    foto.avif = {}
    for (const [clave, ancho] of Object.entries(ANCHOS)) {
      const rel = foto.derivados[clave].replace(/\.webp$/, '.avif')
      foto.avif[clave] = rel
      tareas.push({ origen, destino: path.join(PUBLICO, rel), ancho })
    }
  }
}

const alDia = (destino, origen) =>
  !REHACER && existsSync(destino) && statSync(destino).mtimeMs >= statSync(origen).mtimeMs

let hechas = 0
let saltadas = 0
let bytes = 0

async function procesar({ origen, destino, ancho }) {
  if (alDia(destino, origen)) {
    saltadas++
    bytes += statSync(destino).size
    return
  }
  mkdirSync(path.dirname(destino), { recursive: true })
  const info = await sharp(origen)
    .rotate() // aplica la orientación EXIF, igual que build_fotos.py
    .resize({ width: ancho, withoutEnlargement: true })
    .avif({ quality: CALIDAD, effort: ESFUERZO })
    .toFile(destino)
  hechas++
  bytes += info.size
  if ((hechas + saltadas) % 100 === 0)
    console.log(`  ${hechas + saltadas}/${tareas.length}…`)
}

// libvips ya usa varios hilos por imagen; un puñado de tareas en vuelo basta
// para saturar los núcleos sin dispararse en memoria con los 1800 px.
const EN_VUELO = Math.max(2, Math.min(6, os.cpus().length >> 1))
console.log(`${tareas.length} derivados AVIF · calidad ${CALIDAD} · ${EN_VUELO} en paralelo`)

const cola = tareas[Symbol.iterator]()
await Promise.all(
  Array.from({ length: EN_VUELO }, async () => {
    for (const t of cola) await procesar(t)
  }),
)

writeFileSync(MANIFIESTO, JSON.stringify(manifiesto), 'utf8')
console.log(
  `\nlistos ${hechas} · reutilizados ${saltadas} · total ${(bytes / 1048576).toFixed(1)} MB`,
)
console.log('manifiesto actualizado con las rutas .avif')
