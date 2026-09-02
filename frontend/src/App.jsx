import { Component, Suspense, use, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { BarraResultados, Grilla, Masthead, PerfilRegiones, Rail } from './Catalogo.jsx'
import { Ficha, Lupa } from './Ficha.jsx'
import { CAMPOS, ORDENES, cod, codigoDeOpcion, filtrar, slug } from './dominio.js'
import { datosPromesa } from './datos.js'

/* ── Estado de filtros ───────────────────────────────────────────────── */

const estadoInicial = {
  q: '',
  regiones: new Set(),
  filtros: Object.fromEntries(CAMPOS.map((c) => [c.clave, new Set()])),
  orden: 'foto',
}

/* Devolver `s` sin tocar cuando la acción no cambia nada es lo que sostiene
   toda la memoización aguas abajo. Y `orden` no clona `filtros`: si lo
   hiciera, cambiar el orden recalcularía los conteos de faceta. */
function reducir(s, a) {
  switch (a.tipo) {
    case 'q':
      return a.q === s.q ? s : { ...s, q: a.q }

    case 'orden':
      return a.orden === s.orden ? s : { ...s, orden: a.orden }

    case 'region': {
      const r = new Set(s.regiones)
      r.has(a.codigo) ? r.delete(a.codigo) : r.add(a.codigo)
      return { ...s, regiones: r }
    }

    case 'limpiarRegiones':
      return s.regiones.size ? { ...s, regiones: new Set() } : s

    case 'opcion': {
      const previo = s.filtros[a.campo]
      const nuevo = new Set(previo)
      nuevo.has(a.codigo) ? nuevo.delete(a.codigo) : nuevo.add(a.codigo)
      return { ...s, filtros: { ...s.filtros, [a.campo]: nuevo } }
    }

    case 'limpiarTodo':
      return { ...estadoInicial, orden: s.orden } // el original tampoco resetea el orden

    default:
      return s
  }
}

/* ── Enrutado por hash ───────────────────────────────────────────────── */

const leerHash = () => {
  const m = location.hash.match(/^#\/(.+)$/)
  return m ? decodeURIComponent(m[1]) : null
}

function useRutaHash() {
  const [id, setId] = useState(leerHash)

  useEffect(() => {
    const alCambiar = () => setId(leerHash())
    window.addEventListener('hashchange', alCambiar)
    window.addEventListener('popstate', alCambiar)
    return () => {
      window.removeEventListener('hashchange', alCambiar)
      window.removeEventListener('popstate', alCambiar)
    }
  }, [])

  const irA = useCallback((nuevo) => {
    if (nuevo) location.hash = '#/' + nuevo
  }, [])

  // history.pushState no dispara hashchange, así que el cierre actualiza el
  // estado a mano. Igual que el original: pushState, no history.back().
  const cerrar = useCallback(() => {
    if (location.hash) history.pushState('', '', location.pathname + location.search)
    setId(null)
  }, [])

  return { id, irA, cerrar }
}

/* ── Tema ────────────────────────────────────────────────────────────── */

/* Tres estados: sin data-theme se sigue la preferencia del sistema. La
   sonda sobre --fondo es la del original y es lo que hace que el primer
   clic invierta lo que el sistema esté mostrando. */
const alternarTema = () => {
  const oscuro = getComputedStyle(document.documentElement)
    .getPropertyValue('--fondo')
    .trim()
    .startsWith('#0e')
  const nuevo = oscuro ? 'light' : 'dark'
  document.documentElement.dataset.theme = nuevo
  try {
    localStorage.setItem('tema', nuevo)
  } catch {
    /* modo privado */
  }
}

/* ── Cáscara ─────────────────────────────────────────────────────────── */

class LimiteError extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="vacio" style={{ paddingTop: 120 }}>
        <h3>No se pudo cargar el catálogo</h3>
        <p>{String(this.state.error.message || this.state.error)}</p>
        <button className="boton" onClick={() => location.reload()}>
          Reintentar
        </button>
      </div>
    )
  }
}

const Cargando = () => (
  <>
    <header className="masthead">
      <div className="marca">
        <span className="titulo">Arbolado Urbano</span>
        <span className="sub">Catálogo de especies · CONAF</span>
      </div>
      <div className="contador-tope">
        <span className="cifra">
          <b>—</b> especies
        </span>
      </div>
    </header>
    <div className="envoltura">
      <aside className="rail" />
      <main className="lienzo">
        <div className="barra-res">
          <span className="resumen">—</span>
        </div>
      </main>
    </div>
  </>
)

/* ── Catálogo ────────────────────────────────────────────────────────── */

function Catalogo() {
  const { especies, facetas, regiones, fototeca, mapaCod } = use(datosPromesa)

  const [est, dispatch] = useReducer(reducir, estadoInicial)
  const [texto, setTexto] = useState('')
  const [railAbierto, setRailAbierto] = useState(false)
  const [lupa, setLupa] = useState(null)
  const refBuscador = useRef(null)
  const ruta = useRutaHash()

  // Debounce de 130 ms, igual que el original. La «×» del buscador aparece
  // sin debounce porque depende de `texto`, no de `est.q`.
  useEffect(() => {
    const t = setTimeout(() => dispatch({ tipo: 'q', q: slug(texto) }), 130)
    return () => clearTimeout(t)
  }, [texto])

  const { q, regiones: regSel, filtros, orden } = est

  // Totales por región: sobre TODO el catálogo, no sobre el resultado.
  const { totalPorRegion, tope } = useMemo(() => {
    const total = {}
    for (const r of regiones) total[r.codigo] = 0
    for (const e of especies) for (const c of e.regiones) total[c]++
    return { totalPorRegion: total, tope: Math.max(...Object.values(total)) }
  }, [especies, regiones])

  // Sin `orden` en las dependencias: cambiar el orden no debe refiltrar.
  const base = useMemo(
    () => filtrar(especies, q, regSel, filtros),
    [especies, q, regSel, filtros],
  )

  // .slice() obligatorio: .sort() muta y corrompería el memo de `base`.
  const resultado = useMemo(() => base.slice().sort(ORDENES[orden]), [base, orden])

  const conteosRegiones = useMemo(() => {
    const c = {}
    for (const r of regiones) c[r.codigo] = 0
    for (const e of base) for (const x of e.regiones) c[x]++
    return c
  }, [base, regiones])

  /* Conteos disyuntivos: una faceta con selección se cuenta ignorándose a
     sí misma, para que sus otras opciones no queden todas en cero. */
  const conteosFacetas = useMemo(() => {
    const out = {}
    for (const { clave } of CAMPOS) {
      const conjunto = filtros[clave].size ? filtrar(especies, q, regSel, filtros, clave) : base
      const cuentas = {}
      for (const e of conjunto) {
        const v = cod(e, clave)
        if (v) cuentas[v] = (cuentas[v] || 0) + 1
      }
      out[clave] = cuentas
    }
    return out
  }, [especies, q, regSel, filtros, base])

  const pildoras = useMemo(() => {
    const p = []
    for (const c of regSel) {
      const r = regiones.find((x) => x.codigo === c)
      p.push({ tipo: 'region', valor: c, texto: r ? r.nombre : c })
    }
    for (const { clave } of CAMPOS) {
      for (const v of filtros[clave]) {
        const o = (facetas[clave] || []).find(
          (x) => codigoDeOpcion(mapaCod, clave, x.valor) === v,
        )
        p.push({ tipo: clave, valor: v, texto: o ? o.corta : v })
      }
    }
    return p
  }, [regSel, filtros, regiones, facetas, mapaCod])

  const especie = ruta.id ? especies.find((e) => e.id === ruta.id) : null
  const indice = especie ? resultado.findIndex((x) => x.id === especie.id) : -1
  const fotos = especie ? fototeca[especie.cientifico] || [] : []

  const abrir = ruta.irA
  const toggleRegion = useCallback((codigo) => dispatch({ tipo: 'region', codigo }), [])
  const toggleOpcion = useCallback(
    (campo, codigo) => dispatch({ tipo: 'opcion', campo, codigo }),
    [],
  )
  const limpiarTodo = useCallback(() => {
    setTexto('')
    dispatch({ tipo: 'limpiarTodo' })
  }, [])

  const quitarPildora = useCallback((p) => {
    if (p.tipo === 'region') dispatch({ tipo: 'region', codigo: p.valor })
    else dispatch({ tipo: 'opcion', campo: p.tipo, codigo: p.valor })
  }, [])

  const ampliar = useCallback(
    (src) => setLupa({ src, pie: `${especie.cientifico} — fotografía de Patricio Emanuelli` }),
    [especie],
  )

  /* Teclado: Escape en cascada lupa → ficha → limpiar búsqueda;
     ←/→ navegan la ficha; «/» enfoca el buscador. */
  useEffect(() => {
    const alTeclear = (ev) => {
      if (ev.key === 'Escape') {
        if (lupa) setLupa(null)
        else if (especie) ruta.cerrar()
        else if (texto) setTexto('')
        return
      }
      if (especie) {
        if (ev.key === 'ArrowLeft' && indice > 0) abrir(resultado[indice - 1].id)
        if (ev.key === 'ArrowRight' && indice >= 0 && indice < resultado.length - 1)
          abrir(resultado[indice + 1].id)
      } else if (ev.key === '/' && document.activeElement !== refBuscador.current) {
        ev.preventDefault()
        refBuscador.current?.focus()
      }
    }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [lupa, especie, texto, indice, resultado, abrir, ruta])

  return (
    <>
      <Masthead
        texto={texto}
        onTexto={setTexto}
        nActivos={pildoras.length}
        railAbierto={railAbierto}
        onAbrirFiltros={() => setRailAbierto((v) => !v)}
        total={resultado.length}
        onTema={alternarTema}
        refBuscador={refBuscador}
      />

      <div
        className={'velo' + (railAbierto ? ' visible' : '')}
        onClick={() => setRailAbierto(false)}
      />

      <div className="envoltura">
        <Rail
          railAbierto={railAbierto}
          facetas={facetas}
          mapaCod={mapaCod}
          filtros={filtros}
          conteosFacetas={conteosFacetas}
          onToggleOpcion={toggleOpcion}
          perfil={
            <PerfilRegiones
              regiones={regiones}
              conteo={conteosRegiones}
              total={totalPorRegion}
              tope={tope}
              seleccion={regSel}
              onToggle={toggleRegion}
              onLimpiar={() => dispatch({ tipo: 'limpiarRegiones' })}
            />
          }
        />

        <main className="lienzo">
          <BarraResultados
            n={resultado.length}
            totalCatalogo={especies.length}
            pildoras={pildoras}
            onQuitar={quitarPildora}
            orden={orden}
            onOrden={(o) => dispatch({ tipo: 'orden', orden: o })}
          />
          <Grilla
            resultado={resultado}
            fototeca={fototeca}
            regiones={regiones}
            onAbrir={abrir}
            onLimpiarTodo={limpiarTodo}
          />
        </main>
      </div>

      <Ficha
        especie={especie}
        fotos={fotos}
        regiones={regiones}
        indice={indice}
        resultado={resultado}
        onIrA={abrir}
        onCerrar={ruta.cerrar}
        onAmpliar={ampliar}
      />

      <Lupa lupa={lupa} onCerrar={() => setLupa(null)} />
    </>
  )
}

export default function App() {
  return (
    <LimiteError>
      <Suspense fallback={<Cargando />}>
        <Catalogo />
      </Suspense>
    </LimiteError>
  )
}
