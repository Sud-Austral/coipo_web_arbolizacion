/* ═══════════════════════════════════════════════════════════════════════
   Fichas · Catálogo RyC de Especies para Arbolado Urbano
   Prototipo navegable. Los datos vienen de `especies.json`, generado por
   `build_data.py` desde el Excel. Cuando exista PostgreSQL, la misma
   estructura llegará por API y este archivo no cambia.
   ═══════════════════════════════════════════════════════════════════════ */

const D  = window.DATOS;      // 1.016 especies
const F  = window.FACETAS;    // valores únicos por campo filtrable
const M  = window.META;       // conteos y regiones
const FT = window.FOTOTECA || {};

const REG = M.regiones;
const $  = s => document.querySelector(s);

/* ── Estado ─────────────────────────────────────────────────────────── */

const estado = {
  q: '',
  regiones: new Set(),
  filtros: {},              // campo → Set de códigos
  orden: 'foto',
  visibles: 0,
};

const CAMPOS = [
  { clave: 'emplazamiento', titulo: 'Emplazamiento urbano', abierto: true },
  { clave: 'habito',        titulo: 'Hábito' },
  { clave: 'origen',        titulo: 'Origen' },
  { clave: 'altura',        titulo: 'Altura' },
  { clave: 'agua',          titulo: 'Eficiencia hídrica' },
  { clave: 'raiz_urbana',   titulo: 'Agresividad de raíz' },
  { clave: 'suelo',         titulo: 'Suelo' },
  { clave: 'follaje',       titulo: 'Follaje' },
  { clave: 'longevidad',    titulo: 'Longevidad' },
  { clave: 'plagas',        titulo: 'Susceptibilidad sanitaria' },
  { clave: 'conservacion',  titulo: 'Estado de conservación' },
  { clave: 'familia',       titulo: 'Familia botánica', desborde: true },
];
CAMPOS.forEach(c => estado.filtros[c.clave] = new Set());

const PASO = 48;             // tarjetas por tanda

/* ── Utilidades ─────────────────────────────────────────────────────── */

const sinAcentos = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/** Devuelve el código de un campo, sea objeto {codigo,…} o texto plano. */
function cod(e, clave) {
  if (clave === 'habito')  return e.habito === 'Arbórea' ? 'arborea' : 'arbustiva';
  if (clave === 'origen')  return e.origen === 'Nativa' ? 'nativa' : 'introducida';
  if (clave === 'follaje') return e.follaje === 'Perenne' ? 'perenne' : 'caduco';
  if (clave === 'familia') return e.taxonomia.familia;
  if (clave === 'conservacion') return e.conservacion.mma;
  const c = e[clave];
  return c ? c.codigo : null;
}

const GRAVEDAD = {
  'Extinta (EX)': 'critico', 'Extinta en la naturaleza (EW)': 'critico',
  'En peligro crítico (CR)': 'critico', 'En Peligro (EN)': 'serio',
  'Vulnerable (VU)': 'aviso', 'Rara': 'aviso',
  'Casi amenazada (NT)': 'neutro', 'Preocupación menor (LC)': 'neutro',
};
const SIGLA = {
  'Extinta (EX)': 'EX', 'Extinta en la naturaleza (EW)': 'EW',
  'En peligro crítico (CR)': 'CR', 'En Peligro (EN)': 'EN',
  'Vulnerable (VU)': 'VU', 'Rara': 'Rara',
  'Casi amenazada (NT)': 'NT', 'Preocupación menor (LC)': 'LC',
};
const RANGO = ['Extinta (EX)', 'Extinta en la naturaleza (EW)', 'En peligro crítico (CR)',
               'En Peligro (EN)', 'Vulnerable (VU)', 'Rara', 'Casi amenazada (NT)',
               'Preocupación menor (LC)'];

const miles = n => n.toLocaleString('es-CL');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── Iconografía ────────────────────────────────────────────────────── */
/* Trazo de 1.6 sobre caja de 20. Un icono por criterio funcional: es lo
   que sostiene la ficha de las 1.001 especies que no tienen fotografía. */

const svg = (d, extra = '') =>
  `<svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor"
        stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}${extra}</svg>`;

const ICO = {
  emplazamiento: svg('<path d="M3 17h14M6 17V8l4-3 4 3v9"/><path d="M9 17v-3.5h2V17"/>'),
  altura:        svg('<path d="M10 17V6"/><path d="M6.5 9.5L10 6l3.5 3.5"/><path d="M4 17h12"/>'),
  agua:          svg('<path d="M10 3.5s4.6 4.9 4.6 8a4.6 4.6 0 1 1-9.2 0c0-3.1 4.6-8 4.6-8Z"/>'),
  raiz:          svg('<path d="M10 3v7"/><path d="M10 10c0 3-3 3.6-3.8 6.2M10 10c0 3 3 3.6 3.8 6.2M10 10v6.5"/>'),
  suelo:         svg('<path d="M3 8.5h14M3 12h14M3 15.5h14"/><path d="M7 5v2M13 4v3"/>'),
  longevidad:    svg('<circle cx="10" cy="10" r="7"/><path d="M10 5.5V10l3 2"/>'),
  follaje:       svg('<path d="M16 4c0 7-4 10-8.5 10C6 14 4.5 13 4.5 13S6 5.5 16 4Z"/><path d="M4 16.5c2-3 4.5-5 8-6.5"/>'),
  dureza:        svg('<path d="M10 3l5.5 3v5.5c0 3-2.4 4.7-5.5 5.5-3.1-.8-5.5-2.5-5.5-5.5V6L10 3Z"/>'),
  escudo:        svg('<path d="M10 3l5.5 2.4v5c0 3.4-2.3 6-5.5 7.1-3.2-1.1-5.5-3.7-5.5-7.1v-5L10 3Z"/><path d="M7.6 10.2l1.7 1.7 3.3-3.4"/>'),
  camara:        svg('<path d="M3.5 6.5h3l1.2-2h4.6l1.2 2h3v9h-13v-9Z"/><circle cx="10" cy="10.8" r="2.6"/>'),
  mapa:          svg('<path d="M10 17s5.5-5 5.5-9.2A5.5 5.5 0 0 0 4.5 7.8C4.5 12 10 17 10 17Z"/><circle cx="10" cy="7.8" r="2"/>'),
  hoja:          svg('<path d="M4.5 15.5C4.5 9 9 4.5 15.5 4.5c0 6.5-4.5 11-11 11Z"/><path d="M15.5 4.5L8 12"/>'),
};

/* ── Lámina de porte ────────────────────────────────────────────────── */
/* Las 1.001 especies sin fotografía necesitan un retrato igual. En lugar de
   una imagen vacía se dibuja la lámina que usaría un catálogo de arbolado:
   la silueta del hábito, una regla en metros y una figura humana de 1,70 m
   como referencia de escala. La regla se ajusta al estrato de la especie,
   así el dibujo siempre llena la lámina y la cifra dice el tamaño real. */

const ESTRATOS = {
  bajo:  { techo: 4,  paso: 1,  texto: 'Arbusto · bajo 4 m' },
  medio: { techo: 15, paso: 5,  texto: 'Árbol mediano · 4 a 15 m' },
  alto:  { techo: 30, paso: 10, texto: 'Gran porte · sobre 15 m' },
};

const estratoDe = e => e.habito === 'Arbustiva' ? 'bajo'
  : (e.altura && e.altura.codigo === 'alto' ? 'alto' : 'medio');

/** Copa y fuste normalizados a una caja de 100×100 con el suelo en y=100.
 *  Las tres formas se diferencian por proporción, no solo por tamaño: el
 *  arbusto es una masa multitallo pegada al suelo; el árbol mediano, una
 *  copa ancha sobre fuste corto; el de gran porte, una copa más alta y
 *  estrecha sobre un fuste largo y limpio, como se ve en un eje vial. */
function formaDe(estrato) {
  if (estrato === 'bajo') return `
    <path d="M50 100V80"/>
    <path d="M50 80c0-3-6-5-10-8M50 80c0-3 6-5 10-8M50 80v-8"/>
    <path d="M12 66C12 38 29 16 50 16s38 22 38 50c0 5-17 8-38 8s-38-3-38-8Z"/>
    <path d="M25 40c5-7 12-12 19-13M64 28c7 3 12 8 15 15"/>`;
  if (estrato === 'medio') return `
    <path d="M50 100V58"/><path d="M50 68l-13-11M50 74l13-11"/>
    <ellipse cx="50" cy="31" rx="33" ry="27"/>
    <path d="M23 43c7-8 16-13 27-13s20 5 27 13"/>`;
  return `
    <path d="M50 100V46"/><path d="M50 60l-14-12M50 68l14-12"/>
    <path d="M50 2c16 0 28 11 28 24S66 46 50 46 22 39 22 26 34 2 50 2Z"/>
    <path d="M26 32c7-8 15-12 24-12s17 4 24 12"/>`;
}

/** Figura humana de 1,70 m dibujada con altura `h` px sobre la línea de suelo. */
const persona = (x, suelo, h) => `
  <g stroke-width="1.3" opacity=".8">
    <circle cx="${x}" cy="${suelo - h * 0.89}" r="${h * 0.105}"/>
    <path d="M${x} ${suelo - h * 0.775}v${h * 0.36}"/>
    <path d="M${x - h * 0.17} ${suelo - h * 0.63}h${h * 0.34}"/>
    <path d="M${x} ${suelo - h * 0.415}l${-h * 0.14} ${h * 0.415}M${x} ${suelo - h * 0.415}l${h * 0.14} ${h * 0.415}"/>
  </g>`;

function lamina(e, { ancho = 300, alto = 210, compacta = false } = {}) {
  const clave = estratoDe(e);
  const { techo, paso } = ESTRATOS[clave];
  const suelo = alto - (compacta ? 16 : 30);
  const cima  = compacta ? 12 : 22;
  const util  = suelo - cima;
  const aM    = m => suelo - (m / techo) * util;
  const regla = compacta ? 10 : 44;

  let ticks = '';
  if (!compacta) {
    for (let m = 0; m <= techo; m += paso) {
      ticks += `<line x1="${regla - 5}" y1="${aM(m).toFixed(1)}" x2="${regla}" y2="${aM(m).toFixed(1)}" stroke-width="1"/>
        <text x="${regla - 9}" y="${(aM(m) + 3.2).toFixed(1)}" text-anchor="end" font-size="8.5"
          font-family="IBM Plex Mono, monospace" fill="currentColor" stroke="none">${m}</text>`;
    }
  }

  const cx = regla + (ancho - regla - 12) / 2;
  const escala = util / 100;
  const hp = (1.7 / techo) * util;

  return `<svg viewBox="0 0 ${ancho} ${alto}" width="100%" height="100%"
      preserveAspectRatio="xMidYMax meet" fill="none" stroke="currentColor"
      stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"
      role="img" aria-label="Porte: ${esc(ESTRATOS[clave].texto)}">
    ${compacta ? '' : `<g opacity=".55"><line x1="${regla}" y1="${cima}" x2="${regla}" y2="${suelo}" stroke-width="1"/>
      ${ticks}<text x="${regla - 9}" y="${cima - 7}" text-anchor="end" font-size="8"
        font-family="IBM Plex Mono, monospace" fill="currentColor" stroke="none">m</text></g>`}
    <line x1="${regla}" y1="${suelo}" x2="${ancho - 12}" y2="${suelo}" stroke-width="1.4"/>
    <g transform="translate(${(cx - 50 * escala).toFixed(1)} ${(suelo - 100 * escala).toFixed(1)}) scale(${escala.toFixed(3)})">
      ${formaDe(clave)}
    </g>
    ${compacta ? '' : persona(ancho - 32, suelo, hp) +
      `<text x="${ancho - 32}" y="${(suelo - hp - 6).toFixed(1)}" text-anchor="middle"
        font-size="7.5" font-family="IBM Plex Mono, monospace" fill="currentColor"
        stroke="none" opacity=".75">1,70 m</text>`}
  </svg>`;
}

/* ── Filtrado ───────────────────────────────────────────────────────── */

function filtrar() {
  const q = sinAcentos(estado.q.trim());
  const regs = estado.regiones;
  const activos = Object.entries(estado.filtros).filter(([, s]) => s.size);

  let r = D.filter(e => {
    if (q && !e.busqueda.includes(q)) return false;
    if (regs.size && !e.regiones.some(x => regs.has(x))) return false;
    for (const [clave, sel] of activos) {
      const v = cod(e, clave);
      if (!sel.has(v)) return false;
    }
    return true;
  });

  const orden = {
    alfa:        (a, b) => a.cientifico.localeCompare(b.cientifico, 'es'),
    regiones:    (a, b) => b.regiones.length - a.regiones.length ||
                           a.cientifico.localeCompare(b.cientifico, 'es'),
    completitud: (a, b) => b.completitud.pct - a.completitud.pct ||
                           a.cientifico.localeCompare(b.cientifico, 'es'),
    foto:        (a, b) => b.fotos.length - a.fotos.length ||
                           a.cientifico.localeCompare(b.cientifico, 'es'),
    amenaza:     (a, b) => {
      const p = x => x.conservacion.mma ? RANGO.indexOf(x.conservacion.mma) : 99;
      return p(a) - p(b) || a.cientifico.localeCompare(b.cientifico, 'es');
    },
  }[estado.orden];

  return r.sort(orden);
}

let RESULTADO = [];

/* ── Perfil latitudinal ─────────────────────────────────────────────── */

function pintaRegiones() {
  const cont = $('#regiones');
  const conteo = {}, total = {};
  REG.forEach(r => { conteo[r.codigo] = 0; total[r.codigo] = 0; });
  D.forEach(e => e.regiones.forEach(c => total[c]++));
  RESULTADO.forEach(e => e.regiones.forEach(c => conteo[c]++));
  const tope = Math.max(...Object.values(total));

  cont.innerHTML = REG.map(r => {
    const n = conteo[r.codigo], t = total[r.codigo];
    const activa = estado.regiones.has(r.codigo);
    return `<button class="region${n ? '' : ' vacia'}" data-region="${r.codigo}"
      aria-pressed="${activa}" title="${esc(r.nombre)} — ${n} de ${t} especies">
      <span class="cod mono">${r.codigo}</span>
      <span class="canal${r.codigo === 'IPA' ? ' insular' : ''}">
        <span class="relleno" style="width:${(t / tope * 100).toFixed(1)}%"></span>
        <span class="relleno viva" style="width:${(n / tope * 100).toFixed(1)}%"></span>
      </span>
      <span class="n mono">${miles(n)}</span>
    </button>`;
  }).join('');

  $('#perfil').classList.toggle('activo', estado.regiones.size > 0);
}

/* ── Facetas ────────────────────────────────────────────────────────── */

function pintaFacetas() {
  const cont = $('#facetas');
  if (!cont.dataset.listo) {
    cont.innerHTML = CAMPOS.map(c => {
      const ops = F[c.clave] || [];
      if (!ops.length) return '';
      return `<details class="faceta" data-campo="${c.clave}"${c.abierto ? ' open' : ''}>
        <summary>
          <span class="rotulo">${esc(c.titulo)}<span class="marca-activa"></span></span>
          <svg class="flecha" width="12" height="12" viewBox="0 0 12 12" fill="none"
               stroke="currentColor" stroke-width="1.6" stroke-linecap="round"
               stroke-linejoin="round"><path d="M4.5 2.5L8 6l-3.5 3.5"/></svg>
        </summary>
        <div class="opciones${c.desborde ? ' desborde' : ''}">
          ${ops.map(o => `<button class="opcion" data-campo="${c.clave}"
              data-valor="${esc(o.valor)}" aria-pressed="false"
              title="${esc(o.valor)}">
              <span class="caja"><svg width="9" height="9" viewBox="0 0 10 10" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round"
                stroke-linejoin="round"><path d="M1.5 5.2l2.4 2.4L8.5 3"/></svg></span>
              <span>${esc(o.corta)}</span>
              <span class="n mono" data-cuenta>${o.n}</span>
            </button>`).join('')}
        </div>
      </details>`;
    }).join('');
    cont.dataset.listo = '1';
  }

  // Recuento en vivo: cuántos resultados quedarían si se añade cada opción.
  CAMPOS.forEach(c => {
    const det = cont.querySelector(`.faceta[data-campo="${c.clave}"]`);
    if (!det) return;
    const sel = estado.filtros[c.clave];
    det.classList.toggle('tiene-activo', sel.size > 0);

    const base = RESULTADO;
    const cuentas = {};
    // Si la faceta ya tiene selección, el recuento se calcula sin ella para
    // que las demás opciones no aparezcan en cero.
    const conjunto = sel.size ? recalcularSin(c.clave) : base;
    conjunto.forEach(e => {
      const v = cod(e, c.clave);
      if (v) cuentas[v] = (cuentas[v] || 0) + 1;
    });

    det.querySelectorAll('.opcion').forEach(b => {
      const codigo = codigoDeOpcion(c.clave, b.dataset.valor);
      const activo = sel.has(codigo);
      const n = cuentas[codigo] || 0;
      b.setAttribute('aria-pressed', activo);
      b.classList.toggle('nula', !activo && n === 0);
      b.querySelector('[data-cuenta]').textContent = miles(n);
    });
  });
}

const MAPA_COD = {};
function codigoDeOpcion(campo, valor) {
  if (campo === 'familia' || campo === 'conservacion') return valor;
  if (!MAPA_COD[campo]) {
    MAPA_COD[campo] = {};
    for (const e of D) {
      const c = e[campo];
      if (campo === 'habito')  MAPA_COD[campo][e.habito]  = cod(e, 'habito');
      else if (campo === 'origen')  MAPA_COD[campo][e.origen]  = cod(e, 'origen');
      else if (campo === 'follaje') MAPA_COD[campo][e.follaje] = cod(e, 'follaje');
      else if (c) MAPA_COD[campo][c.valor] = c.codigo;
    }
  }
  return MAPA_COD[campo][valor] ?? valor;
}

function recalcularSin(omitir) {
  const q = sinAcentos(estado.q.trim());
  const regs = estado.regiones;
  const activos = Object.entries(estado.filtros).filter(([k, s]) => s.size && k !== omitir);
  return D.filter(e => {
    if (q && !e.busqueda.includes(q)) return false;
    if (regs.size && !e.regiones.some(x => regs.has(x))) return false;
    for (const [clave, sel] of activos) if (!sel.has(cod(e, clave))) return false;
    return true;
  });
}

/* ── Píldoras de filtros activos ────────────────────────────────────── */

function pintaPildoras() {
  const p = [];
  estado.regiones.forEach(c => {
    const r = REG.find(x => x.codigo === c);
    p.push({ tipo: 'region', valor: c, texto: r.nombre });
  });
  CAMPOS.forEach(c => estado.filtros[c.clave].forEach(v => {
    const o = (F[c.clave] || []).find(x => codigoDeOpcion(c.clave, x.valor) === v);
    p.push({ tipo: c.clave, valor: v, texto: o ? o.corta : v });
  }));

  $('#pildoras').innerHTML = p.map(x => `<span class="pildora-filtro">${esc(x.texto)}
    <button data-quita-tipo="${x.tipo}" data-quita-valor="${esc(x.valor)}"
      aria-label="Quitar filtro ${esc(x.texto)}">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7"/></svg>
    </button></span>`).join('');

  const n = p.length;
  const c = $('#cuenta-filtros');
  c.hidden = !n; c.textContent = n;
}

/* ── Tarjetas ───────────────────────────────────────────────────────── */

function huella(e) {
  const set = new Set(e.regiones);
  return `<span class="huella" aria-hidden="true">${REG.map(r =>
    `<i class="${set.has(r.codigo) ? 'viva' : ''}${r.codigo === 'IPA' ? ' insular' : ''}"></i>`
  ).join('')}</span>`;
}

function insignia(e) {
  const c = e.conservacion;
  if (!c.mma && !c.cites && !c.otras) return '';
  const nivel = c.mma ? GRAVEDAD[c.mma] : 'neutro';
  const texto = c.mma ? SIGLA[c.mma] : (c.cites ? 'CITES' : 'M. Natural');
  return `<span class="insignia ${nivel}" title="${esc(c.mma || c.cites || c.otras)}">
    <span class="punto"></span>${esc(texto)}</span>`;
}

function tarjeta(e) {
  const hero = (FT[e.cientifico] || []).find(f => f.hero);
  const retrato = hero
    ? `<div class="lamina"><img src="${hero.src}" alt="${esc(e.cientifico)}" loading="lazy"></div>`
    : `<div class="lamina sin-foto">${lamina(e, { ancho: 220, alto: 165, compacta: true })}
         <span class="marca-pendiente">${esc(ESTRATOS[estratoDe(e)].texto)}</span></div>`;

  const comunes = e.comunes.length
    ? `<div class="nombre-com">${esc(e.comunes.slice(0, 3).join(' · '))}</div>`
    : `<div class="nombre-com pendiente">Sin nombre común registrado</div>`;

  return `<button class="tarjeta" data-id="${e.id}">
    ${retrato}${insignia(e)}
    <div class="cuerpo">
      <div>
        <div class="nombre-sci">${esc(e.cientifico)}</div>
        ${comunes}
      </div>
      <div class="atributos">
        <span class="chip ${e.origen === 'Nativa' ? 'nativa' : 'introducida'}">${esc(e.origen)}</span>
        <span class="chip">${esc(e.emplazamiento.corta)}</span>
        <span class="chip">${ICO.agua}${esc(e.agua.corta)}</span>
      </div>
      <div class="pie-tarjeta" title="Presencia regional de norte a sur">
        <span class="brujula mono">N</span>
        ${huella(e)}
        <span class="brujula mono">S</span>
        <span class="completo mono">${e.regiones.length}</span>
      </div>
    </div>
  </button>`;
}

function pintaGrilla(reinicia = true) {
  const g = $('#grilla');
  if (reinicia) { g.innerHTML = ''; estado.visibles = 0; }

  if (!RESULTADO.length) {
    g.innerHTML = `<div class="vacio" style="grid-column:1/-1">
      ${svg('<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>')
        .replace('width="17" height="17" viewBox="0 0 20 20"', 'width="34" height="34" viewBox="0 0 16 16"')}
      <h3>Sin coincidencias</h3>
      <p>Ninguna especie del catálogo cumple todos los criterios a la vez.</p>
      <button class="boton suave" id="reinicia">Quitar todos los filtros</button></div>`;
    $('#reinicia').onclick = limpiarTodo;
    return;
  }

  const hasta = Math.min(estado.visibles + PASO, RESULTADO.length);
  const trozo = RESULTADO.slice(estado.visibles, hasta).map(tarjeta).join('');
  g.insertAdjacentHTML('beforeend', trozo);
  estado.visibles = hasta;
}

/* ── Ficha ──────────────────────────────────────────────────────────── */

/** La definición útil del Excel vive en el paréntesis final; el resto repite
 *  el nombre del campo. «Eficiencia Hídrica Muy Alta (Xerófita o Riego
 *  Mínimo)» → «Xerófita o Riego Mínimo». */
function detalle(valor, corta) {
  const m = valor.match(/\(([^()]+)\)\s*$/);
  const d = m ? m[1] : valor;
  return d.toLowerCase() === corta.toLowerCase() ? '' : d;
}

function fila(icono, etiqueta, valor, det, medidor = '') {
  return `<div class="espec"><span class="ico">${icono}</span>
    <span class="txt"><span class="et">${etiqueta}</span>
      ${det ? `<span class="det">${esc(det)}</span>` : ''}</span>
    <span class="val">${medidor}${esc(valor)}</span></div>`;
}

function espec(icono, etiqueta, campo, pasos) {
  if (!campo) return '';
  const medidor = pasos ? `<span class="medidor" role="img"
    aria-label="${pasos.n} de ${pasos.total}">${
    Array.from({ length: pasos.total }, (_, i) =>
      `<i class="${i < pasos.n ? 'on' : ''}"></i>`).join('')}</span>` : '';
  return fila(icono, etiqueta, campo.corta, detalle(campo.valor, campo.corta), medidor);
}

const ESCALA = {
  agua:        { muy_alta: 4, alta: 3, media: 2, baja: 1 },
  plagas:      { baja: 3, moderada: 2, alta: 1 },
  raiz_urbana: { no_agresiva: 3, moderada: 2, agresiva: 1 },
};

function abreFicha(id) {
  const e = D.find(x => x.id === id);
  if (!e) return;
  const fotos = FT[e.cientifico] || [];
  const hero = fotos.find(f => f.hero) || fotos[0];

  const conserv = e.conservacion;
  const nivel = conserv.mma ? GRAVEDAD[conserv.mma] : 'neutro';

  const retrato = hero
    ? `<div class="retrato">
         <img id="retrato-img" src="${hero.src}" alt="${esc(e.cientifico)}">
         <span class="tipo-toma" id="tipo-toma">${esc(hero.tipo || '')}</span>
       </div>
       <div class="tiras">${fotos.map((f, i) => `<button class="tira" data-i="${i}"
          aria-pressed="${f === hero}" aria-label="Ver ${esc(f.tipo || 'imagen')}">
          <img src="${f.src}" alt=""><span class="et">${esc(f.tipo || '')}</span></button>`).join('')}</div>`
    : `<div class="retrato sin-foto">
         <div class="lamina-grande">${lamina(e, { ancho: 340, alto: 240 })}</div>
         <div class="aviso-foto">${ICO.camara}
           <span><strong>Sin fotografía.</strong> Lámina de porte a escala —
           ${esc(ESTRATOS[estratoDe(e)].texto.toLowerCase())}.</span></div>
       </div>`;

  const cuerpo = `
    <header class="encabezado-ficha">
      <div class="rotulo familia">${esc(e.taxonomia.familia)} · ${esc(e.taxonomia.orden)}</div>
      <h2 id="ficha-nombre">${esc(e.cientifico)}</h2>
      ${e.comunes.length
        ? `<div class="comunes">${esc(e.comunes.join(' · '))}</div>`
        : `<div class="comunes pendiente">Sin nombre común registrado — dato pendiente</div>`}
      <div class="marcas">
        <span class="chip ${e.origen === 'Nativa' ? 'nativa' : 'introducida'}">${esc(e.origen)}</span>
        <span class="chip">${esc(e.habito)}</span>
        <span class="chip">${ICO.follaje}${esc(e.follaje)}</span>
        <span class="chip">${ICO.mapa}${e.regiones.length} ${e.regiones.length === 1 ? 'región' : 'regiones'}</span>
        ${fotos.length ? `<span class="chip">${ICO.camara}${fotos.length} fotografías</span>` : ''}
      </div>
    </header>

    ${conserv.protegida ? `<div class="aviso-conserv ${nivel}">
      <span class="ico">${ICO.escudo}</span>
      <div><strong>${esc(conserv.mma || conserv.cites || 'Especie protegida')}</strong>
        <p>${[conserv.cites, conserv.otras].filter(Boolean).map(esc).join(' · ') ||
             'Clasificada por el Ministerio del Medio Ambiente.'}
        ${e.emplazamiento.codigo === 'corredores'
          ? ' El catálogo la deriva a corredores biológicos y conservación urbana, no a arbolado viario.'
          : ''}</p></div></div>` : ''}

    <div class="ficha-red">
      <div>
        ${retrato}
        <div class="panel" style="margin-top:14px">
          <span class="rotulo">Distribución · norte a sur</span>
          <div class="mapa-ficha">${REG.map(r => {
            const p = e.regiones.includes(r.codigo);
            return `<div class="mapa-fila${p ? ' presente' : ''}">
              <span class="cod mono">${r.codigo}</span>
              <span class="banda">${esc(r.nombre)}</span></div>`;
          }).join('')}</div>
          <p class="nota-mapa">Presente en ${e.regiones.length} de 17 unidades
            territoriales${e.regiones.includes('IPA') ? ', incluida Rapa Nui' : ''}.</p>
        </div>
      </div>

      <div>
        <div class="panel">
          <span class="rotulo">Criterios de selección urbana</span>
          <div class="especs">
            ${espec(ICO.emplazamiento, 'Emplazamiento', e.emplazamiento)}
            ${e.altura
              ? espec(ICO.altura, 'Altura', e.altura) + espec(ICO.longevidad, 'Longevidad', e.longevidad)
              : fila(ICO.altura, 'Porte', 'Arbusto · < 4 m',
                     'Altura, longevidad y dureza no se evalúan por separado en arbustos')}
            ${espec(ICO.agua, 'Eficiencia hídrica', e.agua,
                    { n: ESCALA.agua[e.agua.codigo], total: 4 })}
            ${espec(ICO.raiz, 'Raíz en pavimento', e.raiz_urbana,
                    { n: ESCALA.raiz_urbana[e.raiz_urbana.codigo], total: 3 })}
            ${espec(ICO.suelo, 'Suelo', e.suelo)}
            ${espec(ICO.hoja, 'Sanidad', e.plagas,
                    { n: ESCALA.plagas[e.plagas.codigo], total: 3 })}
            ${espec(ICO.dureza, 'Dureza de la madera', e.dureza)}
          </div>
        </div>

        <div class="panel">
          <span class="rotulo">Taxonomía</span>
          <dl class="taxo">
            <dt>División</dt><dd>${esc(e.taxonomia.division)}</dd>
            <dt>Clase</dt><dd>${esc(e.taxonomia.clase)}</dd>
            <dt>Orden</dt><dd>${esc(e.taxonomia.orden)}</dd>
            <dt>Familia</dt><dd>${esc(e.taxonomia.familia)}</dd>
            <dt>Género</dt><dd class="sci">${esc(e.taxonomia.genero)}</dd>
            <dt>Raíz</dt><dd>${esc(e.raiz_botanica.valor)}</dd>
          </dl>
        </div>

        <div class="panel">
          <span class="rotulo">Completitud de la ficha</span>
          <div class="completitud-caja">
            <div style="display:flex;align-items:baseline;justify-content:space-between">
              <span style="font-size:24px;font-family:Newsreader,Georgia,serif">${e.completitud.pct}%</span>
              <span style="font-size:12px;color:var(--tinta-3)" class="mono">${e.completitud.llenos}/${e.completitud.total} campos</span>
            </div>
            <div class="medida"><span style="width:${e.completitud.pct}%"></span></div>
            ${e.completitud.faltan.length ? `<div>
              <div class="rotulo" style="margin-bottom:6px">Pendiente</div>
              <div class="faltantes">${e.completitud.faltan.map(f =>
                `<span class="faltante">${esc(NOMBRE_CAMPO[f] || f)}</span>`).join('')}</div>
            </div>` : ''}
          </div>
        </div>
      </div>
    </div>`;

  $('#ficha-cuerpo').innerHTML = cuerpo;
  $('#ficha').classList.add('abierta');
  document.body.style.overflow = 'hidden';
  $('#ficha').scrollTop = 0;

  // Galería
  if (fotos.length) {
    const img = $('#retrato-img');
    $('#ficha-cuerpo').querySelectorAll('.tira').forEach(b => {
      b.onclick = () => {
        const f = fotos[+b.dataset.i];
        img.src = f.src;
        $('#tipo-toma').textContent = f.tipo || '';
        $('#ficha-cuerpo').querySelectorAll('.tira')
          .forEach(o => o.setAttribute('aria-pressed', o === b));
      };
    });
    img.onclick = () => {
      $('#lupa-img').src = img.src;
      $('#lupa-pie').textContent = `${e.cientifico} — fotografía de Patricio Emanuelli`;
      $('#lupa').classList.add('abierta');
    };
  }

  const i = RESULTADO.findIndex(x => x.id === id);
  $('#ant').disabled = i <= 0;
  $('#sig').disabled = i < 0 || i >= RESULTADO.length - 1;
  $('#ant').onclick = () => irA(RESULTADO[i - 1]);
  $('#sig').onclick = () => irA(RESULTADO[i + 1]);
}

const NOMBRE_CAMPO = {
  descripcion: 'Descripción', floracion: 'Floración', fructificacion: 'Fructificación',
  tolerancias: 'Tolerancias', ancho_minimo_vereda_m: 'Ancho mínimo de vereda',
  distancia_plantacion_m: 'Distancia de plantación', alergenicidad: 'Alergenicidad',
  toxicidad: 'Toxicidad', disponibilidad_vivero: 'Disponibilidad en vivero',
  fuentes: 'Fuentes', fotos: 'Fotografías',
};

const irA = e => { if (e) location.hash = '#/' + e.id; };

function cierraFicha() {
  $('#ficha').classList.remove('abierta');
  document.body.style.overflow = '';
  if (location.hash) history.pushState('', '', location.pathname + location.search);
}

/* ── Ciclo de render ────────────────────────────────────────────────── */

function actualiza(reiniciaGrilla = true) {
  RESULTADO = filtrar();
  pintaRegiones();
  pintaFacetas();
  pintaPildoras();
  pintaGrilla(reiniciaGrilla);

  const n = RESULTADO.length;
  $('#resumen').innerHTML = n === D.length
    ? `<b>${miles(n)}</b> especies en el catálogo`
    : `<b>${miles(n)}</b> de ${miles(D.length)} ${n === 1 ? 'especie' : 'especies'}`;
  $('#cifra-total').textContent = miles(n);
}

function limpiarTodo() {
  estado.q = ''; $('#q').value = ''; $('#buscador').classList.remove('lleno');
  estado.regiones.clear();
  CAMPOS.forEach(c => estado.filtros[c.clave].clear());
  actualiza();
}

/* ── Eventos ────────────────────────────────────────────────────────── */

let tempo;
$('#q').addEventListener('input', ev => {
  $('#buscador').classList.toggle('lleno', ev.target.value.length > 0);
  clearTimeout(tempo);
  tempo = setTimeout(() => { estado.q = ev.target.value; actualiza(); }, 130);
});
$('#limpiar-q').onclick = () => {
  $('#q').value = ''; estado.q = '';
  $('#buscador').classList.remove('lleno'); actualiza(); $('#q').focus();
};

$('#regiones').addEventListener('click', ev => {
  const b = ev.target.closest('[data-region]');
  if (!b) return;
  const c = b.dataset.region;
  estado.regiones.has(c) ? estado.regiones.delete(c) : estado.regiones.add(c);
  actualiza();
});
$('#limpiar-reg').onclick = () => { estado.regiones.clear(); actualiza(); };

$('#facetas').addEventListener('click', ev => {
  const b = ev.target.closest('.opcion');
  if (!b) return;
  const { campo, valor } = b.dataset;
  const codigo = codigoDeOpcion(campo, valor);
  const s = estado.filtros[campo];
  s.has(codigo) ? s.delete(codigo) : s.add(codigo);
  actualiza();
});

$('#pildoras').addEventListener('click', ev => {
  const b = ev.target.closest('[data-quita-tipo]');
  if (!b) return;
  const { quitaTipo, quitaValor } = b.dataset;
  if (quitaTipo === 'region') estado.regiones.delete(quitaValor);
  else estado.filtros[quitaTipo].delete(quitaValor);
  actualiza();
});

$('#orden').addEventListener('change', ev => { estado.orden = ev.target.value; actualiza(); });

$('#grilla').addEventListener('click', ev => {
  const t = ev.target.closest('.tarjeta');
  if (t) location.hash = '#/' + t.dataset.id;
});

$('#volver').onclick = cierraFicha;
$('#cerrar-lupa').onclick = () => $('#lupa').classList.remove('abierta');
$('#lupa').addEventListener('click', ev => {
  if (ev.target.id === 'lupa') $('#lupa').classList.remove('abierta');
});

document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') {
    if ($('#lupa').classList.contains('abierta')) $('#lupa').classList.remove('abierta');
    else if ($('#ficha').classList.contains('abierta')) cierraFicha();
    else if (estado.q) { $('#q').value = ''; estado.q = ''; actualiza(); }
  }
  if ($('#ficha').classList.contains('abierta')) {
    if (ev.key === 'ArrowLeft'  && !$('#ant').disabled) $('#ant').click();
    if (ev.key === 'ArrowRight' && !$('#sig').disabled) $('#sig').click();
  } else if (ev.key === '/' && document.activeElement !== $('#q')) {
    ev.preventDefault(); $('#q').focus();
  }
});

// Filtros en pantalla angosta
$('#abre-filtros').onclick = () => {
  const abierto = $('#rail').classList.toggle('abierto');
  $('#velo').classList.toggle('visible', abierto);
  $('#abre-filtros').setAttribute('aria-expanded', abierto);
};
$('#velo').onclick = () => {
  $('#rail').classList.remove('abierto');
  $('#velo').classList.remove('visible');
  $('#abre-filtros').setAttribute('aria-expanded', 'false');
};

// Tema
const guardado = (() => { try { return localStorage.getItem('tema'); } catch { return null; } })();
if (guardado) document.documentElement.dataset.theme = guardado;
$('#tema').onclick = () => {
  const oscuro = getComputedStyle(document.documentElement)
    .getPropertyValue('--fondo').trim().startsWith('#0e');
  const nuevo = oscuro ? 'light' : 'dark';
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem('tema', nuevo); } catch {}
};

// Carga incremental
new IntersectionObserver(entradas => {
  if (entradas[0].isIntersecting && estado.visibles < RESULTADO.length) pintaGrilla(false);
}, { rootMargin: '700px' }).observe($('#centinela'));

// Enrutado: cada especie tiene su propia dirección
function ruta() {
  const m = location.hash.match(/^#\/(.+)$/);
  if (m) abreFicha(decodeURIComponent(m[1]));
  else if ($('#ficha').classList.contains('abierta')) {
    $('#ficha').classList.remove('abierta');
    document.body.style.overflow = '';
  }
}
window.addEventListener('hashchange', ruta);

/* ── Arranque ───────────────────────────────────────────────────────── */

actualiza();
ruta();
