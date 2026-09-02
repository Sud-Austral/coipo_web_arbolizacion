import { useEffect, useRef, useState } from 'react'
import { ESCALA, ESTRATOS, GRAVEDAD, NOMBRE_CAMPO, detalle, estratoDe } from './dominio.js'
import { ICO, IconoAspaGrande, IconoChevronDer, IconoChevronIzq } from './iconos.jsx'
import { Lamina } from './Lamina.jsx'

/* ── Filas de criterios ──────────────────────────────────────────────── */

const Fila = ({ icono, etiqueta, valor, det, medidor }) => (
  <div className="espec">
    <span className="ico">{icono}</span>
    <span className="txt">
      <span className="et">{etiqueta}</span>
      {det ? <span className="det">{det}</span> : null}
    </span>
    <span className="val">
      {medidor}
      {valor}
    </span>
  </div>
)

/* 4 pasos, el activo relleno. La posición es el dato, no el color — cada
   paso lleva además su etiqueta. */
const Medidor = ({ n, total }) => (
  <span className="medidor" role="img" aria-label={`${n} de ${total}`}>
    {Array.from({ length: total }, (_, i) => (
      <i key={i} className={i < n ? 'on' : ''} />
    ))}
  </span>
)

function Espec({ icono, etiqueta, campo, pasos }) {
  if (!campo) return null
  return (
    <Fila
      icono={icono}
      etiqueta={etiqueta}
      valor={campo.corta}
      det={detalle(campo.valor, campo.corta)}
      medidor={pasos ? <Medidor n={pasos.n} total={pasos.total} /> : null}
    />
  )
}

/* ── Galería ─────────────────────────────────────────────────────────── */

function Galeria({ especie: e, fotos, onAmpliar }) {
  const [activa, setActiva] = useState(0)
  const [roto, setRoto] = useState(false)

  if (!fotos.length || roto) {
    return (
      <div className="retrato sin-foto">
        <div className="lamina-grande">
          <Lamina especie={e} ancho={340} alto={240} />
        </div>
        <div className="aviso-foto">
          {ICO.camara}
          <span>
            <strong>Sin fotografía.</strong> Lámina de porte a escala —{' '}
            {ESTRATOS[estratoDe(e)].texto.toLowerCase()}.
          </span>
        </div>
      </div>
    )
  }

  const foto = fotos[activa]
  return (
    <>
      <div className="retrato">
        <img
          src={foto.ficha}
          alt={e.cientifico}
          onError={() => setRoto(true)}
          onClick={() => onAmpliar(foto.completa)}
        />
        <span className="tipo-toma">{foto.tipo}</span>
      </div>
      <div className="tiras">
        {fotos.map((f, i) => (
          <button
            key={f.archivo}
            className="tira"
            aria-pressed={String(i === activa)}
            aria-label={`Ver ${f.tipo || 'imagen'}`}
            onClick={() => setActiva(i)}
          >
            <img src={f.mini} alt="" loading="lazy" />
            <span className="et">{f.tipo}</span>
          </button>
        ))}
      </div>
    </>
  )
}

/* ── Cuerpo de la ficha ──────────────────────────────────────────────── */

function Cuerpo({ especie: e, fotos, regiones, onAmpliar }) {
  const c = e.conservacion
  const nivel = c.mma ? GRAVEDAD[c.mma] : 'neutro'
  const presentes = new Set(e.regiones)

  return (
    <div className="ficha-cuerpo">
      <header className="encabezado-ficha">
        <div className="rotulo familia">
          {e.taxonomia.familia} · {e.taxonomia.orden}
        </div>
        <h2 id="ficha-nombre">{e.cientifico}</h2>
        {e.comunes.length ? (
          <div className="comunes">{e.comunes.join(' · ')}</div>
        ) : (
          <div className="comunes pendiente">Sin nombre común registrado — dato pendiente</div>
        )}
        <div className="marcas">
          <span className={'chip ' + (e.origen === 'Nativa' ? 'nativa' : 'introducida')}>
            {e.origen}
          </span>
          <span className="chip">{e.habito}</span>
          <span className="chip">
            {ICO.follaje}
            {e.follaje}
          </span>
          <span className="chip">
            {ICO.mapa}
            {e.regiones.length} {e.regiones.length === 1 ? 'región' : 'regiones'}
          </span>
          {fotos.length ? (
            <span className="chip">
              {ICO.camara}
              {fotos.length} fotografías
            </span>
          ) : null}
        </div>
      </header>

      {c.protegida && (
        <div className={`aviso-conserv ${nivel}`}>
          <span className="ico">{ICO.escudo}</span>
          <div>
            <strong>{c.mma || c.cites || 'Especie protegida'}</strong>
            <p>
              {[c.cites, c.otras].filter(Boolean).join(' · ') ||
                'Clasificada por el Ministerio del Medio Ambiente.'}
              {e.emplazamiento.codigo === 'corredores'
                ? ' El catálogo la deriva a corredores biológicos y conservación urbana, no a arbolado viario.'
                : ''}
            </p>
          </div>
        </div>
      )}

      <div className="ficha-red">
        <div>
          <Galeria especie={e} fotos={fotos} onAmpliar={onAmpliar} />

          <div className="panel" style={{ marginTop: 14 }}>
            <span className="rotulo">Distribución · norte a sur</span>
            <div className="mapa-ficha">
              {regiones.map((r) => (
                <div
                  key={r.codigo}
                  className={'mapa-fila' + (presentes.has(r.codigo) ? ' presente' : '')}
                >
                  <span className="cod mono">{r.codigo}</span>
                  <span className="banda">{r.nombre}</span>
                </div>
              ))}
            </div>
            <p className="nota-mapa">
              Presente en {e.regiones.length} de 17 unidades territoriales
              {presentes.has('IPA') ? ', incluida Rapa Nui' : ''}.
            </p>
          </div>
        </div>

        <div>
          <div className="panel">
            <span className="rotulo">Criterios de selección urbana</span>
            <div className="especs">
              <Espec icono={ICO.emplazamiento} etiqueta="Emplazamiento" campo={e.emplazamiento} />
              {e.altura ? (
                <>
                  <Espec icono={ICO.altura} etiqueta="Altura" campo={e.altura} />
                  <Espec icono={ICO.longevidad} etiqueta="Longevidad" campo={e.longevidad} />
                </>
              ) : (
                <Fila
                  icono={ICO.altura}
                  etiqueta="Porte"
                  valor="Arbusto · < 4 m"
                  det="Altura, longevidad y dureza no se evalúan por separado en arbustos"
                />
              )}
              <Espec
                icono={ICO.agua}
                etiqueta="Eficiencia hídrica"
                campo={e.agua}
                pasos={{ n: ESCALA.agua[e.agua.codigo], total: 4 }}
              />
              <Espec
                icono={ICO.raiz}
                etiqueta="Raíz en pavimento"
                campo={e.raiz_urbana}
                pasos={{ n: ESCALA.raiz_urbana[e.raiz_urbana.codigo], total: 3 }}
              />
              <Espec icono={ICO.suelo} etiqueta="Suelo" campo={e.suelo} />
              <Espec
                icono={ICO.hoja}
                etiqueta="Sanidad"
                campo={e.plagas}
                pasos={{ n: ESCALA.plagas[e.plagas.codigo], total: 3 }}
              />
              <Espec icono={ICO.dureza} etiqueta="Dureza de la madera" campo={e.dureza} />
            </div>
          </div>

          <div className="panel">
            <span className="rotulo">Taxonomía</span>
            <dl className="taxo">
              <dt>División</dt>
              <dd>{e.taxonomia.division}</dd>
              <dt>Clase</dt>
              <dd>{e.taxonomia.clase}</dd>
              <dt>Orden</dt>
              <dd>{e.taxonomia.orden}</dd>
              <dt>Familia</dt>
              <dd>{e.taxonomia.familia}</dd>
              <dt>Género</dt>
              <dd className="sci">{e.taxonomia.genero}</dd>
              <dt>Raíz</dt>
              <dd>{e.raiz_botanica.valor}</dd>
            </dl>
          </div>

          <div className="panel">
            <span className="rotulo">Completitud de la ficha</span>
            <div className="completitud-caja">
              <div
                style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
              >
                <span style={{ fontSize: 24, fontFamily: 'Newsreader, Georgia, serif' }}>
                  {e.completitud.pct}%
                </span>
                <span className="mono" style={{ fontSize: 12, color: 'var(--tinta-3)' }}>
                  {e.completitud.llenos}/{e.completitud.total} campos
                </span>
              </div>
              <div className="medida">
                <span style={{ width: `${e.completitud.pct}%` }} />
              </div>
              {e.completitud.faltan.length ? (
                <div>
                  <div className="rotulo" style={{ marginBottom: 6 }}>
                    Pendiente
                  </div>
                  <div className="faltantes">
                    {e.completitud.faltan.map((f) => (
                      <span className="faltante" key={f}>
                        {NOMBRE_CAMPO[f] || f}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Contenedor ──────────────────────────────────────────────────────── */

export function Ficha({ especie, fotos, regiones, indice, resultado, onIrA, onCerrar, onAmpliar }) {
  const ref = useRef(null)
  const abierta = !!especie

  useEffect(() => {
    if (abierta && ref.current) ref.current.scrollTop = 0
  }, [abierta, especie?.id])

  useEffect(() => {
    if (!abierta) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [abierta])

  const sinAnterior = indice <= 0
  const sinSiguiente = indice < 0 || indice >= resultado.length - 1

  return (
    <article
      className={'ficha' + (abierta ? ' abierta' : '')}
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ficha-nombre"
    >
      <div className="ficha-tope">
        <button className="volver" onClick={onCerrar}>
          <IconoChevronIzq />
          Volver al catálogo
        </button>
        <div className="nav">
          <button
            className="nav-b"
            aria-label="Especie anterior"
            disabled={sinAnterior}
            onClick={() => onIrA(resultado[indice - 1]?.id)}
          >
            <IconoChevronIzq size={14} />
          </button>
          <button
            className="nav-b"
            aria-label="Especie siguiente"
            disabled={sinSiguiente}
            onClick={() => onIrA(resultado[indice + 1]?.id)}
          >
            <IconoChevronDer />
          </button>
        </div>
      </div>

      {especie && (
        <Cuerpo
          key={especie.id}
          especie={especie}
          fotos={fotos}
          regiones={regiones}
          onAmpliar={onAmpliar}
        />
      )}
    </article>
  )
}

export function Lupa({ lupa, onCerrar }) {
  return (
    <div
      className={'lupa' + (lupa ? ' abierta' : '')}
      onClick={(ev) => {
        if (ev.target === ev.currentTarget) onCerrar()
      }}
    >
      <button className="cerrar" aria-label="Cerrar imagen" onClick={onCerrar}>
        <IconoAspaGrande />
      </button>
      {lupa && <img src={lupa.src} alt="" />}
      <div className="pie">{lupa?.pie}</div>
    </div>
  )
}
