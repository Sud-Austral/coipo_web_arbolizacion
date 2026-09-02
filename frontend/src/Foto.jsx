/* Una fotografía servida en dos formatos.
 *
 * El AVIF va primero porque, medido sobre este mismo material, pesa un tercio
 * menos que el WebP con PSNR igual o mejor (35.23 vs 35.15 dB a 1000 px). El
 * WebP queda como respaldo para los navegadores que no leen AVIF.
 *
 * `picture { display: contents }` en el CSS mantiene el <img> como hijo
 * directo de la grilla de `.lamina` / `.retrato`, así que los estilos del
 * original siguen aplicando sin tocarlos. */
export function Foto({ fuente, srcSet, sizes, alt, loading, onError, onClick }) {
  return (
    <picture>
      {fuente.avif && (
        <source type="image/avif" srcSet={srcSet ? srcSet.avif : fuente.avif} sizes={sizes} />
      )}
      <img
        src={fuente.webp}
        srcSet={srcSet ? srcSet.webp : undefined}
        sizes={sizes}
        alt={alt}
        loading={loading}
        onError={onError}
        onClick={onClick}
      />
    </picture>
  )
}

/** srcset de los tres tamaños, para que el navegador elija según viewport. */
export const juego = (f) => ({
  avif: `${f.mini.avif} 400w, ${f.ficha.avif} 1000w, ${f.completa.avif} 1800w`,
  webp: `${f.mini.webp} 400w, ${f.ficha.webp} 1000w, ${f.completa.webp} 1800w`,
})

/* Ancho real del retrato: la columna izquierda de `.ficha-red` es 1.55fr de
   un contenedor de 1180 px con 26 px de hueco (~674 px). Bajo 1000 px la
   rejilla colapsa a una columna. */
export const ANCHO_RETRATO = '(max-width: 1000px) 92vw, 674px'
