/* Iconos de trazo fino sobre viewBox de 16 o 20, sin relleno, currentColor.
   Portados literales de plantilla.html y app.js. Cualquier icono nuevo
   debe seguir esa convención. */

const T = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round' }

/* Los 12 de ICO: 17×17 sobre viewBox 0 0 20 20, trazo 1.6 */
const Ico = ({ children }) => (
  <svg width="17" height="17" viewBox="0 0 20 20" strokeWidth="1.6" {...T}>
    {children}
  </svg>
)

export const ICO = {
  emplazamiento: (
    <Ico>
      <path d="M3 17h14M6 17V8l4-3 4 3v9" />
      <path d="M9 17v-3.5h2V17" />
    </Ico>
  ),
  altura: (
    <Ico>
      <path d="M10 17V6" />
      <path d="M6.5 9.5L10 6l3.5 3.5" />
      <path d="M4 17h12" />
    </Ico>
  ),
  agua: (
    <Ico>
      <path d="M10 3.5s4.6 4.9 4.6 8a4.6 4.6 0 1 1-9.2 0c0-3.1 4.6-8 4.6-8Z" />
    </Ico>
  ),
  raiz: (
    <Ico>
      <path d="M10 3v7" />
      <path d="M10 10c0 3-3 3.6-3.8 6.2M10 10c0 3 3 3.6 3.8 6.2M10 10v6.5" />
    </Ico>
  ),
  suelo: (
    <Ico>
      <path d="M3 8.5h14M3 12h14M3 15.5h14" />
      <path d="M7 5v2M13 4v3" />
    </Ico>
  ),
  longevidad: (
    <Ico>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 5.5V10l3 2" />
    </Ico>
  ),
  follaje: (
    <Ico>
      <path d="M16 4c0 7-4 10-8.5 10C6 14 4.5 13 4.5 13S6 5.5 16 4Z" />
      <path d="M4 16.5c2-3 4.5-5 8-6.5" />
    </Ico>
  ),
  dureza: (
    <Ico>
      <path d="M10 3l5.5 3v5.5c0 3-2.4 4.7-5.5 5.5-3.1-.8-5.5-2.5-5.5-5.5V6L10 3Z" />
    </Ico>
  ),
  escudo: (
    <Ico>
      <path d="M10 3l5.5 2.4v5c0 3.4-2.3 6-5.5 7.1-3.2-1.1-5.5-3.7-5.5-7.1v-5L10 3Z" />
      <path d="M7.6 10.2l1.7 1.7 3.3-3.4" />
    </Ico>
  ),
  camara: (
    <Ico>
      <path d="M3.5 6.5h3l1.2-2h4.6l1.2 2h3v9h-13v-9Z" />
      <circle cx="10" cy="10.8" r="2.6" />
    </Ico>
  ),
  mapa: (
    <Ico>
      <path d="M10 17s5.5-5 5.5-9.2A5.5 5.5 0 0 0 4.5 7.8C4.5 12 10 17 10 17Z" />
      <circle cx="10" cy="7.8" r="2" />
    </Ico>
  ),
  hoja: (
    <Ico>
      <path d="M4.5 15.5C4.5 9 9 4.5 15.5 4.5c0 6.5-4.5 11-11 11Z" />
      <path d="M15.5 4.5L8 12" />
    </Ico>
  ),
}

/* ── Los 8 de la plantilla ───────────────────────────────────────────── */

export const IconoFiltros = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" strokeWidth="1.6" {...T}>
    <path d="M2 4h12M4.5 8h7M6.5 12h3" />
  </svg>
)

export const IconoBuscar = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" strokeWidth="1.7" {...T}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
)

export const IconoAspaChica = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" strokeWidth="1.8" {...T}>
    <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
  </svg>
)

export const IconoAspaPildora = () => (
  <svg width="10" height="10" viewBox="0 0 12 12" strokeWidth="1.8" {...T}>
    <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
  </svg>
)

export const IconoSol = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" strokeWidth="1.6" {...T}>
    <circle cx="10" cy="10" r="3.6" />
    <path d="M10 2v1.8M10 16.2V18M18 10h-1.8M3.8 10H2M15.7 4.3l-1.3 1.3M5.6 14.4l-1.3 1.3M15.7 15.7l-1.3-1.3M5.6 5.6L4.3 4.3" />
  </svg>
)

export const IconoChevronIzq = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" strokeWidth="1.7" {...T}>
    <path d="M9.5 3.5L5 8l4.5 4.5" />
  </svg>
)

export const IconoChevronDer = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" strokeWidth="1.7" {...T}>
    <path d="M6.5 3.5L11 8l-4.5 4.5" />
  </svg>
)

export const IconoAspaGrande = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" strokeWidth="1.8" {...T}>
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
  </svg>
)

export const IconoFlechaFaceta = () => (
  <svg className="flecha" width="12" height="12" viewBox="0 0 12 12" strokeWidth="1.6" {...T}>
    <path d="M4.5 2.5L8 6l-3.5 3.5" />
  </svg>
)

export const IconoCheck = () => (
  <svg width="9" height="9" viewBox="0 0 10 10" strokeWidth="2" {...T}>
    <path d="M1.5 5.2l2.4 2.4L8.5 3" />
  </svg>
)

/* El original fabrica este agrandando la lupa con un .replace() sobre la
   cadena del icono. Aquí es simplemente otro componente. */
export const IconoVacio = () => (
  <svg width="34" height="34" viewBox="0 0 16 16" strokeWidth="1.6" {...T}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" />
  </svg>
)
