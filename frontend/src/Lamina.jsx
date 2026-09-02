import { memo } from 'react'
import { ESTRATOS, estratoDe } from './dominio.js'

/* Sin fotografía, la lámina no queda vacía: la silueta del estrato a escala,
   con regla en metros y una figura de 1,70 m de referencia, distingue
   arbusto de árbol mediano y de gran porte de un vistazo.
   Se dibuja hasta 48 veces por tanda (1.001 de 1.016 especies no tienen
   foto), así que va memoizada. */

const Silueta = ({ estrato }) =>
  estrato === 'bajo' ? (
    <>
      <path d="M50 100V80" />
      <path d="M50 80c0-3-6-5-10-8M50 80c0-3 6-5 10-8M50 80v-8" />
      <path d="M12 66C12 38 29 16 50 16s38 22 38 50c0 5-17 8-38 8s-38-3-38-8Z" />
      <path d="M25 40c5-7 12-12 19-13M64 28c7 3 12 8 15 15" />
    </>
  ) : estrato === 'medio' ? (
    <>
      <path d="M50 100V58" />
      <path d="M50 68l-13-11M50 74l13-11" />
      <ellipse cx="50" cy="31" rx="33" ry="27" />
      <path d="M23 43c7-8 16-13 27-13s20 5 27 13" />
    </>
  ) : (
    <>
      <path d="M50 100V46" />
      <path d="M50 60l-14-12M50 68l14-12" />
      <path d="M50 2c16 0 28 11 28 24S66 46 50 46 22 39 22 26 34 2 50 2Z" />
      <path d="M26 32c7-8 15-12 24-12s17 4 24 12" />
    </>
  )

/** Figura humana de 1,70 m dibujada con altura `h` px sobre la línea de suelo. */
const Persona = ({ x, suelo, h }) => (
  <g strokeWidth="1.3" opacity=".8">
    <circle cx={x} cy={suelo - h * 0.89} r={h * 0.105} />
    <path d={`M${x} ${suelo - h * 0.775}v${h * 0.36}`} />
    <path d={`M${x - h * 0.17} ${suelo - h * 0.63}h${h * 0.34}`} />
    <path
      d={`M${x} ${suelo - h * 0.415}l${-h * 0.14} ${h * 0.415}M${x} ${suelo - h * 0.415}l${h * 0.14} ${h * 0.415}`}
    />
  </g>
)

const MONO = 'IBM Plex Mono, monospace'

function LaminaBase({ especie, ancho = 300, alto = 210, compacta = false }) {
  const clave = estratoDe(especie)
  const { techo, paso } = ESTRATOS[clave]
  const suelo = alto - (compacta ? 16 : 30)
  const cima = compacta ? 12 : 22
  const util = suelo - cima
  const aM = (m) => suelo - (m / techo) * util
  const regla = compacta ? 10 : 44

  const cx = regla + (ancho - regla - 12) / 2
  const escala = util / 100
  const hp = (1.7 / techo) * util

  const marcas = []
  if (!compacta) {
    for (let m = 0; m <= techo; m += paso) marcas.push(m)
  }

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMax meet"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={`Porte: ${ESTRATOS[clave].texto}`}
    >
      {!compacta && (
        <g opacity=".55">
          <line x1={regla} y1={cima} x2={regla} y2={suelo} strokeWidth="1" />
          {marcas.map((m) => (
            <g key={m}>
              <line
                x1={regla - 5}
                y1={aM(m).toFixed(1)}
                x2={regla}
                y2={aM(m).toFixed(1)}
                strokeWidth="1"
              />
              <text
                x={regla - 9}
                y={(aM(m) + 3.2).toFixed(1)}
                textAnchor="end"
                fontSize="8.5"
                fontFamily={MONO}
                fill="currentColor"
                stroke="none"
              >
                {m}
              </text>
            </g>
          ))}
          <text
            x={regla - 9}
            y={cima - 7}
            textAnchor="end"
            fontSize="8"
            fontFamily={MONO}
            fill="currentColor"
            stroke="none"
          >
            m
          </text>
        </g>
      )}

      <line x1={regla} y1={suelo} x2={ancho - 12} y2={suelo} strokeWidth="1.4" />

      <g
        transform={`translate(${(cx - 50 * escala).toFixed(1)} ${(suelo - 100 * escala).toFixed(1)}) scale(${escala.toFixed(3)})`}
      >
        <Silueta estrato={clave} />
      </g>

      {!compacta && (
        <>
          <Persona x={ancho - 32} suelo={suelo} h={hp} />
          <text
            x={ancho - 32}
            y={(suelo - hp - 6).toFixed(1)}
            textAnchor="middle"
            fontSize="7.5"
            fontFamily={MONO}
            fill="currentColor"
            stroke="none"
            opacity=".75"
          >
            1,70 m
          </text>
        </>
      )}
    </svg>
  )
}

export const Lamina = memo(LaminaBase)
