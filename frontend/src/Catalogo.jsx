import { memo, useEffect, useRef, useState } from 'react'
import {
  CAMPOS,
  ESTRATOS,
  GRAVEDAD,
  OPCIONES_ORDEN,
  PASO,
  SIGLA,
  codigoDeOpcion,
  estratoDe,
  miles,
} from './dominio.js'
import { ICO, IconoAspaChica, IconoAspaPildora, IconoBuscar, IconoCheck, IconoFiltros, IconoFlechaFaceta, IconoSol, IconoVacio } from './iconos.jsx'
import { Lamina } from './Lamina.jsx'

/* ── Cabecera ────────────────────────────────────────────────────────── */

export function Masthead({ texto, onTexto, nActivos, onAbrirFiltros, railAbierto, total, onTema, refBuscador }) {
  return (
    <header className="masthead">
      <div className="marca">
        <span className="titulo">Arbolado Urbano</span>
        <span className="sub">Catálogo de especies · CONAF</span>
      </div>

      <button
        className="abre-filtros"
        id="abre-filtros"
        aria-expanded={railAbierto}
        onClick={onAbrirFiltros}
      >
        <IconoFiltros />
        <span className="texto">Filtros</span>
        <span className="cuenta" hidden={!nActivos}>
          {nActivos}
        </span>
      </button>

      <div className={'buscador' + (texto ? ' lleno' : '')}>
        <IconoBuscar />
        <input
          type="search"
          id="q"
          ref={refBuscador}
          value={texto}
          onChange={(ev) => onTexto(ev.target.value)}
          placeholder="Buscar especie, nombre común o familia…"
          autoComplete="off"
          spellCheck="false"
          aria-label="Buscar especies"
        />
        <button
          className="limpiar"
          aria-label="Limpiar búsqueda"
          onClick={() => {
            onTexto('')
            refBuscador.current?.focus()
          }}
        >
          <IconoAspaChica />
        </button>
      </div>

      <div className="contador-tope">
        <span className="cifra">
          <b>{total === null ? '—' : miles(total)}</b> especies
        </span>
        <button className="tema" aria-label="Cambiar entre tema claro y oscuro" onClick={onTema}>
          <IconoSol />
        </button>
      </div>
    </header>
  )
}

/* ── Perfil latitudinal ──────────────────────────────────────────────── */

const BotonRegion = memo(function BotonRegion({ region, n, t, tope, activa, onToggle }) {
  return (
    <button
      className={'region' + (n ? '' : ' vacia')}
      aria-pressed={String(activa)}
      title={`${region.nombre} — ${n} de ${t} especies`}
      onClick={() => onToggle(region.codigo)}
    >
      <span className="cod mono">{region.codigo}</span>
      <span className={'canal' + (region.codigo === 'IPA' ? ' insular' : '')}>
        <span className="relleno" style={{ width: `${((t / tope) * 100).toFixed(1)}%` }} />
        <span className="relleno viva" style={{ width: `${((n / tope) * 100).toFixed(1)}%` }} />
      </span>
      <span className="n mono">{miles(n)}</span>
    </button>
  )
})

export function PerfilRegiones({ regiones, conteo, total, tope, seleccion, onToggle, onLimpiar }) {
  return (
    <section className={'perfil' + (seleccion.size ? ' activo' : '')}>
      <div className="perfil-tope">
        <span className="rotulo">Región · norte a sur</span>
        <button className="limpiar-reg" onClick={onLimpiar}>
          Quitar
        </button>
      </div>
      <div>
        {regiones.map((r) => (
          <BotonRegion
            key={r.codigo}
            region={r}
            n={conteo[r.codigo] || 0}
            t={total[r.codigo] || 0}
            tope={tope}
            activa={seleccion.has(r.codigo)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </section>
  )
}

/* ── Facetas ─────────────────────────────────────────────────────────── */

const Opcion = memo(function Opcion({ campo, codigo, corta, valor, n, activo, onToggle }) {
  return (
    <button
      className={'opcion' + (!activo && n === 0 ? ' nula' : '')}
      aria-pressed={String(activo)}
      title={valor}
      onClick={() => onToggle(campo, codigo)}
    >
      <span className="caja">
        <IconoCheck />
      </span>
      <span>{corta}</span>
      <span className="n mono">{miles(n)}</span>
    </button>
  )
})

function Faceta({ campo, opciones, mapaCod, seleccion, cuentas, onToggle }) {
  return (
    <details className={'faceta' + (seleccion.size ? ' tiene-activo' : '')} open={campo.abierto}>
      <summary>
        <span className="rotulo">
          {campo.titulo}
          <span className="marca-activa" />
        </span>
        <IconoFlechaFaceta />
      </summary>
      <div className={'opciones' + (campo.desborde ? ' desborde' : '')}>
        {opciones.map((o) => {
          const codigo = codigoDeOpcion(mapaCod, campo.clave, o.valor)
          return (
            <Opcion
              key={o.valor}
              campo={campo.clave}
              codigo={codigo}
              corta={o.corta}
              valor={o.valor}
              n={cuentas[codigo] || 0}
              activo={seleccion.has(codigo)}
              onToggle={onToggle}
            />
          )
        })}
      </div>
    </details>
  )
}

export function Rail({ railAbierto, facetas, mapaCod, filtros, conteosFacetas, onToggleOpcion, perfil }) {
  return (
    <aside className={'rail' + (railAbierto ? ' abierto' : '')}>
      {perfil}
      <div>
        {CAMPOS.map((c) =>
          facetas[c.clave]?.length ? (
            <Faceta
              key={c.clave}
              campo={c}
              opciones={facetas[c.clave]}
              mapaCod={mapaCod}
              seleccion={filtros[c.clave]}
              cuentas={conteosFacetas[c.clave] || {}}
              onToggle={onToggleOpcion}
            />
          ) : null,
        )}
      </div>
    </aside>
  )
}

/* ── Barra de resultados ─────────────────────────────────────────────── */

export function BarraResultados({ n, totalCatalogo, pildoras, onQuitar, orden, onOrden }) {
  return (
    <div className="barra-res">
      <span className="resumen">
        {n === null ? (
          '—'
        ) : n === totalCatalogo ? (
          <>
            <b>{miles(n)}</b> especies en el catálogo
          </>
        ) : (
          <>
            <b>{miles(n)}</b> de {miles(totalCatalogo)} {n === 1 ? 'especie' : 'especies'}
          </>
        )}
      </span>

      <div className="fichas-activas">
        {pildoras.map((p) => (
          <span className="pildora-filtro" key={p.tipo + '|' + p.valor}>
            {p.texto}
            <button aria-label={`Quitar filtro ${p.texto}`} onClick={() => onQuitar(p)}>
              <IconoAspaPildora />
            </button>
          </span>
        ))}
      </div>

      <div className="orden">
        <label className="rotulo" htmlFor="orden">
          Orden
        </label>
        <select id="orden" value={orden} onChange={(ev) => onOrden(ev.target.value)}>
          {OPCIONES_ORDEN.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

/* ── Tarjeta ─────────────────────────────────────────────────────────── */

export const Huella = memo(function Huella({ regiones, presentes }) {
  return (
    <span className="huella" aria-hidden="true">
      {regiones.map((r) => (
        <i
          key={r.codigo}
          className={
            (presentes.has(r.codigo) ? 'viva' : '') + (r.codigo === 'IPA' ? ' insular' : '')
          }
        />
      ))}
    </span>
  )
})

export function Insignia({ conservacion: c }) {
  if (!c.mma && !c.cites && !c.otras) return null
  const nivel = c.mma ? GRAVEDAD[c.mma] : 'neutro'
  const texto = c.mma ? SIGLA[c.mma] : c.cites ? 'CITES' : 'M. Natural'
  return (
    <span className={`insignia ${nivel}`} title={c.mma || c.cites || c.otras}>
      <span className="punto" />
      {texto}
    </span>
  )
}

const Tarjeta = memo(function Tarjeta({ especie: e, hero, regiones, onAbrir }) {
  // El original no tiene fallback: una imagen rota se ve rota. Aquí sí, para
  // que el sitio se despliegue antes de que los derivados existan.
  const [roto, setRoto] = useState(false)
  const conFoto = hero && !roto
  const presentes = new Set(e.regiones)

  return (
    <button className="tarjeta" onClick={() => onAbrir(e.id)}>
      {conFoto ? (
        <div className="lamina">
          <img src={hero.mini} alt={e.cientifico} loading="lazy" onError={() => setRoto(true)} />
        </div>
      ) : (
        <div className="lamina sin-foto">
          <Lamina especie={e} ancho={220} alto={165} compacta />
          <span className="marca-pendiente">{ESTRATOS[estratoDe(e)].texto}</span>
        </div>
      )}

      <Insignia conservacion={e.conservacion} />

      <div className="cuerpo">
        <div>
          <div className="nombre-sci">{e.cientifico}</div>
          {e.comunes.length ? (
            <div className="nombre-com">{e.comunes.slice(0, 3).join(' · ')}</div>
          ) : (
            <div className="nombre-com pendiente">Sin nombre común registrado</div>
          )}
        </div>

        <div className="atributos">
          <span className={'chip ' + (e.origen === 'Nativa' ? 'nativa' : 'introducida')}>
            {e.origen}
          </span>
          <span className="chip">{e.emplazamiento.corta}</span>
          <span className="chip">
            {ICO.agua}
            {e.agua.corta}
          </span>
        </div>

        <div className="pie-tarjeta" title="Presencia regional de norte a sur">
          <span className="brujula mono">N</span>
          <Huella regiones={regiones} presentes={presentes} />
          <span className="brujula mono">S</span>
          <span className="completo mono">{e.regiones.length}</span>
        </div>
      </div>
    </button>
  )
})

/* ── Grilla con scroll infinito ──────────────────────────────────────── */

export function Grilla({ resultado, fototeca, regiones, onAbrir, onLimpiarTodo }) {
  const [visibles, setVisibles] = useState(PASO)
  const [previo, setPrevio] = useState(resultado)
  const refCentinela = useRef(null)

  // Ajuste en fase de render: con un useEffect habría un commit intermedio
  // pintando las tarjetas nuevas junto a las viejas, un parpadeo visible.
  if (previo !== resultado) {
    setPrevio(resultado)
    setVisibles(PASO)
  }

  const total = resultado.length

  // Un observer nuevo por tanda: no hay closure obsoleto que sincronizar, y
  // un observer recién creado siempre emite su estado inicial, así que la
  // cadena se auto-alimenta hasta llenar la pantalla.
  useEffect(() => {
    const el = refCentinela.current
    if (!el || visibles >= total) return
    const io = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) setVisibles((v) => Math.min(v + PASO, total))
      },
      { rootMargin: '700px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visibles, total])

  if (!total) {
    return (
      <>
        <div className="grilla">
          <div className="vacio" style={{ gridColumn: '1/-1' }}>
            <IconoVacio />
            <h3>Sin coincidencias</h3>
            <p>Ninguna especie del catálogo cumple todos los criterios a la vez.</p>
            <button className="boton suave" onClick={onLimpiarTodo}>
              Quitar todos los filtros
            </button>
          </div>
        </div>
        <div ref={refCentinela} style={{ height: 1 }} />
      </>
    )
  }

  return (
    <>
      <div className="grilla">
        {resultado.slice(0, visibles).map((e) => (
          <Tarjeta
            key={e.id}
            especie={e}
            hero={fototeca[e.cientifico]?.[0]}
            regiones={regiones}
            onAbrir={onAbrir}
          />
        ))}
      </div>
      <div ref={refCentinela} style={{ height: 1 }} />
    </>
  )
}
