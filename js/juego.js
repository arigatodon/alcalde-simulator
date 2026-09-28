'use strict';

// ============================================================
//  ALCALDE SIMULATOR — núcleo: utilidades, candidatura y elecciones
// ============================================================

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ANIO0 = 2029;   // el mandato empieza tras las municipales de octubre 2028
const DURACION = 46;  // enero 2029 → octubre 2032 (elecciones)
const ICON = { a: '😊', s: '🛡️', b: '❤️', e: '💼', c: '🏛️', p: '🎗️', $: '💰' };
const NOMBRE_IND = { a: 'Aprobación', s: 'Seguridad', b: 'Bienestar', e: 'Empleo', c: 'Concejo', p: 'Partido' };
const GUARDADO = 'alcalde_simulator_v3';

let S = null;       // estado de la partida
let camp = null;    // estado temporal de la campaña

const app = () => document.getElementById('app');
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const U = () => (S.comuna.presupuesto * 0.08) / 12; // caja libre mensual (MM$)
const fmt$ = mm => (mm < 0 ? '-' : '') + '$' + Math.round(Math.abs(mm)).toLocaleString('es-CL') + ' MM';
const fmtN = n => Math.round(n).toLocaleString('es-CL');
const fecha = mes => `${MESES[mes % 12]} ${ANIO0 + Math.floor(mes / 12)}`;
const nombreAzar = () => `${pick(NOMBRES)} ${pick(APELLIDOS)}`;
const construida = id => S.construidas.some(c => c.id === id);
const obra = id => OBRAS.find(o => o.id === id);
const cumplida = p => p.obras.some(construida) || (p.flag && S.flags[p.flag]);
const promesasCumplidas = () => S.promesas.map(id => PROMESAS.find(p => p.id === id)).filter(cumplida).length;
const lealtadMedia = () => (S.concejo.length ? S.concejo.reduce((s, c) => s + c.lealtad, 0) / S.concejo.length : 50);
const miPartidoId = () => (S.via === 'partido' ? S.partido.id : 'ind');
const nConcejales = c => { const el = c.poblacion * 0.8; return el <= 70000 ? 6 : el <= 150000 ? 8 : 10; };
const cara = v => (v >= 65 ? '😄' : v >= 45 ? '🙂' : v >= 30 ? '😐' : '😠');
const nivel = (v, [a, b, c]) => (v >= 0.75 ? a : v >= 0.5 ? b : c);

// ------------------------------------------------------------
//  Utilidades de interfaz
// ------------------------------------------------------------
function toast(txt, tipo = '') {
  const cont = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = 'toast ' + tipo;
  el.textContent = txt;
  cont.appendChild(el);
  if (tipo === 'bien') Sonido.bien();
  if (tipo === 'mal') Sonido.mal();
  setTimeout(() => el.classList.add('fuera'), 3400);
  setTimeout(() => el.remove(), 3900);
}

function modal(html, cerrable = true) {
  cerrarModal();
  const m = document.createElement('div');
  m.className = 'modal-fondo';
  m.id = 'modal';
  m.innerHTML = `<div class="modal">${cerrable ? '<button class="modal-x" onclick="cerrarModal()">✕</button>' : ''}${html}</div>`;
  if (cerrable) m.addEventListener('click', e => { if (e.target === m) cerrarModal(); });
  document.body.appendChild(m);
}
function cerrarModal() {
  const m = document.getElementById('modal');
  if (m) m.remove();
}

function flecha(v) {
  if (v >= 5) return '▲▲';
  if (v > 0) return '▲';
  if (v <= -5) return '▼▼';
  return '▼';
}

// Chips de efectos: muestran qué sube y qué baja
function chips(fx, extra = {}) {
  let h = '';
  for (const k of ['$', 'a', 's', 'b', 'e', 'c', 'p']) {
    const v = fx[k];
    if (!v) continue;
    const cls = v > 0 ? 'up' : 'down';
    const kk = k === 'p' && S && S.via !== 'partido' ? 'c' : k;
    if (k === '$') h += `<span class="chip ${cls}">💰 ${v > 0 ? '+' : ''}${fmt$(v * U())}</span>`;
    else h += `<span class="chip ${cls}" title="${NOMBRE_IND[kk]}">${ICON[kk]} ${flecha(v)}</span>`;
  }
  if (extra.r) h += '<span class="chip riesgo" title="Puede salir mal">🎲</span>';
  if (extra.sched) h += '<span class="chip riesgo" title="Tendrá consecuencias">⏳</span>';
  if (extra.voto) h += '<span class="chip riesgo" title="Lo vota el concejo">🗳️</span>';
  return h;
}

// ------------------------------------------------------------
//  Guardado
// ------------------------------------------------------------
function guardar() {
  try { localStorage.setItem(GUARDADO, JSON.stringify(S)); } catch (e) { /* sin almacenamiento */ }
}
function cargarGuardado() {
  try { const t = localStorage.getItem(GUARDADO); return t ? JSON.parse(t) : null; } catch (e) { return null; }
}
function borrarGuardado() {
  try { localStorage.removeItem(GUARDADO); } catch (e) { /* nada */ }
}

// ------------------------------------------------------------
//  PANTALLA: Inicio
// ------------------------------------------------------------
let nombreJugador = '';
function inicio() {
  cerrarModal();
  const g = cargarGuardado();
  app().innerHTML = `
  <div class="pantalla inicio">
    <div class="logo">🏛️</div>
    <h1>Alcalde<span>Simulator</span></h1>
    <p class="sub">Elige tu comuna. Gana la elección.<br>Sobrevive 4 años gobernando.</p>
    <input class="input-nombre" id="nombre" maxlength="22" placeholder="Tu nombre (opcional)" value="${nombreJugador}">
    <button class="btn grande" onclick="nuevaPartida()">▶ Nueva partida</button>
    ${g && g.fase !== 'fin' ? `<button class="btn sec" onclick="continuar()">Continuar en ${g.comuna.nombre} · ${fecha(g.mes)}</button>` : ''}
    <button class="btn-mini" onclick="Sonido.alternar();inicio()">${Sonido.on ? '🔊 Sonido activado' : '🔇 Sonido apagado'}</button>
    <div class="inicio-deco">🏖️ 🗳️ 🏛️ 🏗️ 💼 🗺️</div>
  </div>`;
}

function nuevaPartida() {
  const el = document.getElementById('nombre');
  nombreJugador = el ? el.value.trim().replace(/[<>&"'`]/g, '') : '';
  elegirComuna();
}

function continuar() {
  S = cargarGuardado();
  if (!S) return inicio();
  if (!S.terrenos) iniciarTerritorio();
  renderJuego();
}

// ------------------------------------------------------------
//  PANTALLA: Elegir comuna
// ------------------------------------------------------------
function elegirComuna() {
  app().innerHTML = `
  <div class="pantalla">
    <h2>¿Dónde quieres gobernar?</h2>
    <div class="grid-cartas">
      ${COMUNAS.map(c => {
        const inc = c.politica.incumbente;
        return `
        <button class="carta-sel" onclick="seleccionarComuna('${c.id}')">
          <div class="cs-emoji">${c.emoji}</div>
          <div class="cs-nombre">${c.nombre}</div>
          <div class="cs-lema">${c.lema}</div>
          <div class="cs-datos">
            <span>👥 ${fmtN(c.poblacion)}</span>
            <span>💰 $${fmtN(c.presupuesto)} MM/año</span>
            <span>${partidoDe(inc.partido).e} ${inc.periodos} ${inc.periodos === 1 ? 'periodo' : 'periodos'} en el poder</span>
          </div>
          <div class="cs-probs">${c.problemas.map(p => PROMESAS.find(x => x.id === p).e).join(' ')}</div>
        </button>`;
      }).join('')}
    </div>
    <p class="nota">Población: Censo 2017. Presupuestos: aproximados. Alcaldes y partidos: ficticios. Todo se edita en <code>js/comunas.js</code>.</p>
    <button class="btn sec" onclick="inicio()">← Volver</button>
  </div>`;
}

function seleccionarComuna(id) {
  const c = COMUNAS.find(x => x.id === id);
  S = {
    nombre: nombreJugador || 'Tú',
    comuna: JSON.parse(JSON.stringify(c)),
    via: null, partido: null, relPartido: 0, heredero: false,
    promesas: [],
    mes: 0,
    caja: 0,
    m: { a: 50, s: c.inicial.s, b: c.inicial.b, e: c.inicial.e },
    sectores: c.sectores.map(n => ({ n, animo: Math.round(rnd(38, 58)) })),
    concejo: [],
    obras: [],        // en construcción: {id, fin, sector}
    construidas: [],  // {id, sector}
    negocios: [],     // {t, sector}
    solicitudes: [],  // {t, sector, mes}
    cursos: [],       // en curso: {id, fin}
    cursosHechos: [],
    emprendedores: 0,
    bonoSolicitudes: 0,
    propUsadas: {},
    fondo: null,
    cola: [],
    usados: {},
    flags: {},
    ingresoBonus: 0,
    fase: 'evento',
    evento: null,
    terreno: null,
    candidatos: [],
    historia: [],
  };
  S.caja = 3 * U();
  iniciarTerritorio();
  modalDatosComuna(true);
}

// Ficha con datos públicos e historia de la comuna
function modalDatosComuna(alElegir = false) {
  const c = S.comuna;
  const ing = c.ingresos;
  const pol = c.politica;
  const barra = (lbl, pct, cls) => `
    <div class="ing-fila"><span>${lbl}</span><div class="ing-barra"><div class="${cls}" style="width:${pct}%"></div></div><b>${pct}%</b></div>`;
  const patentesAnio = S.negocios.reduce((s, n) => s + NEGOCIOS.find(x => x.id === n.t).patente, 0) * U() * 12;
  const histor = [...pol.historial, ...S.historia];
  modal(`
    <div class="ficha">
      <div class="ficha-emoji">${c.emoji}</div>
      <h2>${c.nombre}</h2>
      <div class="ficha-reg">Región ${c.region === 'Metropolitana' ? 'Metropolitana' : 'de ' + c.region} · <a href="https://www.openstreetmap.org/#map=13/${c.lat}/${c.lon}" target="_blank" rel="noopener">🌍 ver mapa real</a></div>
      <p class="ficha-hist">${c.historia}</p>
      <div class="ficha-kpis">
        <div><b>${fmtN(c.poblacion)}</b><small>habitantes</small></div>
        <div><b>$${fmtN(c.presupuesto)} MM</b><small>presupuesto anual</small></div>
        <div><b>${c.pobreza}%</b><small>pobreza (aprox.)</small></div>
      </div>
      <div class="ficha-kpis">
        <div><b>${nivel(c.delincuencia, ['Alta', 'Media', 'Baja'])}</b><small>delincuencia</small></div>
        <div><b>${c.turismo >= 0.7 ? 'Alto' : c.turismo >= 0.3 ? 'Medio' : 'Bajo'}</b><small>turismo</small></div>
        <div><b>${nConcejales(c)}</b><small>concejales</small></div>
      </div>
      <h3>¿De dónde viene la plata?</h3>
      ${barra('Fondo Común', ing.fcm, 'c1')}
      ${barra('Ingresos propios', ing.propios, 'c2')}
      ${barra('Gobierno Regional y otros', ing.transferencias, 'c3')}
      ${patentesAnio ? `<p class="ficha-libre">🏪 Tus nuevas patentes suman <b>+${fmt$(patentesAnio)}</b> al año a los ingresos propios.</p>` : ''}
      <p class="ficha-libre">Sólo ~8% del presupuesto es <b>libre</b> para obras y programas: <b>${fmt$(c.presupuesto * 0.08)}</b> al año. El resto se va en sueldos, salud, educación y servicios.</p>
      <h3>Historia electoral</h3>
      <div class="historial">${histor.map(h => `<div><span>${h.anio}</span>${partidoDe(h.partido).e} ${h.nombre}</div>`).join('')}</div>
      <h3>Lo que más preocupa</h3>
      <div class="ficha-probs">${c.problemas.map(p => { const x = PROMESAS.find(y => y.id === p); return `<span class="chip">${x.e} ${x.n}</span>`; }).join('')}</div>
      ${alElegir ? '<button class="btn grande" onclick="cerrarModal();elegirVia()">¡Quiero gobernar aquí!</button><button class="btn sec" onclick="cerrarModal()">Ver otra</button>' : ''}
    </div>`);
}

// ------------------------------------------------------------
//  PANTALLA: Independiente o partido
// ------------------------------------------------------------
function elegirVia() {
  const inc = S.comuna.politica.incumbente;
  app().innerHTML = `
  <div class="pantalla">
    <div class="paso">Paso 1 de 3 · Candidatura</div>
    <h2>¿Cómo vas a postular?</h2>
    <div class="aviso-inc">${partidoDe(inc.partido).e} <b>${inc.nombre}</b> gobierna hace ${inc.periodos} ${inc.periodos === 1 ? 'periodo' : 'periodos'}.
      ${inc.periodos >= 3 ? 'Ya no puede repostular (máximo 3), pero su partido llevará a su "delfín".' : 'Va por la reelección. Ganarle no será fácil.'}</div>
    <div class="grid-2">
      <button class="carta-sel via" onclick="viaIndependiente()">
        <div class="cs-emoji">🧍</div>
        <div class="cs-nombre">Independiente</div>
        <div class="pros">✅ Libertad total</div>
        <div class="contras">❌ Menos votos y plata<br>❌ Juntar firmas<br>❌ Pocos concejales tuyos</div>
      </button>
      <button class="carta-sel via" onclick="viaPartido()">
        <div class="cs-emoji">🎗️</div>
        <div class="cs-nombre">Con partido</div>
        <div class="pros">✅ Votos y plata<br>✅ Concejales aliados<br>✅ Más fondos regionales</div>
        <div class="contras">❌ Te pedirán favores</div>
      </button>
    </div>
    <button class="btn sec" onclick="elegirComuna()">← Otra comuna</button>
  </div>`;
}

function viaPartido() {
  const pol = S.comuna.politica;
  const inc = pol.incumbente;
  app().innerHTML = `
  <div class="pantalla">
    <div class="paso">Paso 1 de 3 · Candidatura</div>
    <h2>Elige tu partido</h2>
    <div class="lista">
      ${PARTIDOS.map(p => {
        const ocupado = p.id === inc.partido && inc.periodos < 3;
        const herencia = p.id === inc.partido && inc.periodos >= 3;
        return `
        <button class="fila-sel" style="--c:${p.color}" ${ocupado ? 'disabled' : ''} onclick="elegirPartido('${p.id}')">
          <span class="fs-emoji">${p.e}</span>
          <span class="fs-txt"><b>${p.n}</b>
            <small>${ocupado ? `Ya tiene candidato: ${inc.nombre}` : herencia ? `🔥 Heredas la maquinaria de ${inc.nombre}` : `Te pedirá: ${p.pide}`}</small>
          </span>
          <span class="fs-extra">${pol.votos[p.id]}%<small>fuerza local</small></span>
        </button>`;
      }).join('')}
    </div>
    <button class="btn sec" onclick="elegirVia()">← Volver</button>
  </div>`;
}

function elegirPartido(id) {
  const inc = S.comuna.politica.incumbente;
  S.via = 'partido';
  S.partido = PARTIDOS.find(p => p.id === id);
  S.relPartido = 60;
  S.heredero = id === inc.partido && inc.periodos >= 3;
  elegirPromesas();
}

// Minijuego: juntar firmas
let firmas = null;
function viaIndependiente() {
  const necesarias = Math.max(100, Math.round(S.comuna.poblacion * 0.6 * 0.005));
  firmas = { n: 0, meta: necesarias, t0: 0, fin: false, timer: null };
  app().innerHTML = `
  <div class="pantalla centro">
    <div class="paso">Paso 1 de 3 · Candidatura</div>
    <h2>¡Junta ${fmtN(necesarias)} firmas!</h2>
    <p class="sub">Toca el botón lo más rápido que puedas.<br>Tienes <b>10 segundos</b>.</p>
    <div class="firmas-tiempo" id="f-tiempo">10.0</div>
    <div class="barra-grande"><div id="f-barra"></div></div>
    <div class="firmas-n" id="f-n">0 / ${fmtN(necesarias)}</div>
    <button class="btn-firma" id="btn-firma">✍️</button>
    <button class="btn sec" onclick="elegirVia()">← Volver</button>
  </div>`;
  document.getElementById('btn-firma').addEventListener('pointerdown', e => { e.preventDefault(); tocarFirma(); });
}

function tocarFirma() {
  if (!firmas || firmas.fin) return;
  if (!firmas.t0) {
    firmas.t0 = Date.now();
    firmas.timer = setInterval(tickFirmas, 100);
  }
  firmas.n = Math.min(firmas.meta, firmas.n + firmas.meta / 28);
  Sonido.tono(400 + (firmas.n / firmas.meta) * 500, 0.04, 'triangle', 0.04);
  document.getElementById('f-barra').style.width = (firmas.n / firmas.meta) * 100 + '%';
  document.getElementById('f-n').textContent = `${fmtN(firmas.n)} / ${fmtN(firmas.meta)}`;
  const b = document.getElementById('btn-firma');
  b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
  if (firmas.n >= firmas.meta) terminarFirmas(true);
}

function tickFirmas() {
  const restante = Math.max(0, 10 - (Date.now() - firmas.t0) / 1000);
  const el = document.getElementById('f-tiempo');
  if (el) el.textContent = restante.toFixed(1);
  if (restante <= 0) terminarFirmas(false);
}

function terminarFirmas(ok) {
  firmas.fin = true;
  clearInterval(firmas.timer);
  if (ok) {
    S.via = 'independiente';
    S.partido = null;
    Sonido.bien();
    modal(`<div class="centro"><div class="big-emoji">📋</div><h2>¡Lo lograste!</h2><p>El Servel aceptó tu candidatura independiente.</p>
      <button class="btn grande" onclick="cerrarModal();elegirPromesas()">Seguir</button></div>`, false);
  } else {
    Sonido.mal();
    modal(`<div class="centro"><div class="big-emoji">😓</div><h2>Faltaron firmas</h2><p>Llegaste a ${fmtN(firmas.n)}. ¡Otra vuelta por la feria!</p>
      <button class="btn grande" onclick="cerrarModal();viaIndependiente()">Reintentar</button>
      <button class="btn sec" onclick="cerrarModal();viaPartido()">Mejor ir con partido</button></div>`, false);
  }
}

// ------------------------------------------------------------
//  PANTALLA: Promesas de campaña
// ------------------------------------------------------------
let elegidas = [];
function elegirPromesas() {
  elegidas = [];
  renderPromesas();
}
function renderPromesas() {
  const probs = S.comuna.problemas;
  app().innerHTML = `
  <div class="pantalla">
    <div class="paso">Paso 2 de 3 · Programa</div>
    <h2>Elige 2 promesas</h2>
    <p class="sub">Tendrás que cumplirlas. ⭐ = lo que más preocupa en ${S.comuna.nombre}.</p>
    <div class="grid-3">
      ${PROMESAS.map(p => `
        <button class="promesa ${elegidas.includes(p.id) ? 'sel' : ''}" onclick="togglePromesa('${p.id}')">
          ${probs.includes(p.id) ? '<span class="estrella">⭐</span>' : ''}
          <div class="pr-e">${p.e}</div><div class="pr-n">${p.n}</div>
        </button>`).join('')}
    </div>
    <button class="btn grande" ${elegidas.length === 2 ? '' : 'disabled'} onclick="confirmarPromesas()">Confirmar</button>
  </div>`;
}
function togglePromesa(id) {
  if (elegidas.includes(id)) elegidas = elegidas.filter(x => x !== id);
  else if (elegidas.length < 2) elegidas.push(id);
  Sonido.click();
  renderPromesas();
}
function confirmarPromesas() {
  S.promesas = elegidas.slice();
  const aciertos = S.promesas.filter(p => S.comuna.problemas.includes(p)).length;
  armarCandidatos();
  camp = {
    semana: 1,
    pts: S.miBase + aciertos * 3,
    fondos: S.via === 'partido' ? (S.heredero ? 4 : 3) : 1,
  };
  renderCampana();
}

// Rivales según la historia de la comuna: el alcalde actual tiene ventaja
function armarCandidatos() {
  const pol = S.comuna.politica;
  const v = pol.votos;
  const inc = pol.incumbente;
  const mio = miPartidoId();
  const cands = [];
  S.miBase = S.via === 'partido' ? v[mio] * 0.8 + 8 + (S.heredero ? 4 : 0) : v.ind * 0.8 + 8;
  if (inc.periodos < 3) {
    cands.push({ n: inc.nombre, rol: 'alcalde actual', partido: inc.partido, pts: v[inc.partido] + 6 + inc.periodos * 2 });
  } else if (mio !== inc.partido) {
    cands.push({ n: nombreAzar(), rol: `delfín de ${inc.nombre}`, partido: inc.partido, pts: v[inc.partido] + 5 });
  }
  const usados = new Set([mio, ...cands.map(c => c.partido)]);
  const otros = PARTIDOS.map(p => p.id).filter(k => !usados.has(k)).sort((a, b) => v[b] - v[a]);
  for (const k of otros) {
    if (cands.length >= 2) break;
    cands.push({ n: nombreAzar(), rol: 'candidato/a', partido: k, pts: v[k] * 0.8 + 6 });
  }
  S.candidatos = cands;
}

function encuesta(misPts) {
  const lista = [{ n: S.nombre, partido: miPartidoId(), pts: misPts, yo: true }, ...S.candidatos];
  const total = lista.reduce((s, c) => s + Math.max(1, c.pts), 0);
  return lista.map(c => ({ ...c, pct: (Math.max(1, c.pts) / total) * 100 }));
}

// ------------------------------------------------------------
//  PANTALLA: Campaña (3 semanas)
// ------------------------------------------------------------
const ACTIVIDADES = [
  { id: 'puerta', e: '🚪', n: 'Puerta a puerta', d: 'Seguro, pero lento', costo: 0 },
  { id: 'redes', e: '📱', n: 'Redes sociales', d: 'Puede explotar... o no', costo: 0 },
  { id: 'masivo', e: '🎉', n: 'Evento masivo', d: 'Muchos votos', costo: 2 },
  { id: 'donacion', e: '💼', n: 'Aceptar donación', d: '+💵 2, pero quedas debiendo', costo: 0 },
];

function renderCampana() {
  const enc = encuesta(camp.pts);
  app().innerHTML = `
  <div class="pantalla">
    <div class="paso">Paso 3 de 3 · Campaña</div>
    <h2>Semana ${camp.semana} de 3</h2>
    <div class="encuesta-box">
      <div class="enc-tit">📊 Encuesta</div>
      ${enc.map(c => `
        <div class="enc-fila ${c.yo ? 'yo' : ''}">
          <span>${partidoDe(c.partido).e} ${c.n}${c.rol ? ` <small>(${c.rol})</small>` : ''}</span>
          <div class="res-barra"><div style="width:${Math.min(100, c.pct * 1.4)}%"></div></div>
          <b>${c.pct.toFixed(0)}%</b>
        </div>`).join('')}
    </div>
    <div class="fondos-camp">Fondos de campaña: ${'💵'.repeat(camp.fondos) || '—'}</div>
    <div class="grid-2">
      ${ACTIVIDADES.map(a => `
        <button class="carta-sel act" ${a.costo > camp.fondos ? 'disabled' : ''} onclick="actividad('${a.id}')">
          <div class="cs-emoji">${a.e}</div>
          <div class="cs-nombre">${a.n}</div>
          <div class="cs-lema">${a.d}</div>
          ${a.costo ? `<div class="costo">Cuesta ${'💵'.repeat(a.costo)}</div>` : ''}
        </button>`).join('')}
    </div>
  </div>`;
}

function actividad(id) {
  let d = 0, msg = '';
  if (id === 'puerta') { d = rnd(2.5, 4); msg = 'Conversaste con cientos de vecinos.'; }
  if (id === 'redes') { d = rnd(-2, 7); msg = d > 4 ? '¡Tu video se hizo viral!' : d < 0 ? 'Te funaron en redes.' : 'Algunos likes, nada más.'; }
  if (id === 'masivo') { camp.fondos -= 2; d = rnd(5, 7); msg = '¡Llenaste la plaza!'; }
  if (id === 'donacion') { camp.fondos += 2; S.flags.donacion = true; d = 0; msg = 'Un empresario te pasó plata. Algún día la cobrará.'; }
  camp.pts += d;
  toast(`${msg} ${d ? (d > 0 ? '+' : '') + d.toFixed(1) + ' pts' : ''}`, d < 0 ? 'mal' : 'bien');
  camp.semana++;
  if (camp.semana > 3) nocheElectoral(encuesta(camp.pts), false);
  else renderCampana();
}

// ------------------------------------------------------------
//  PANTALLA: Noche electoral (inicio y reelección)
// ------------------------------------------------------------
function nocheElectoral(lista, reeleccion) {
  const conRuido = lista.map(c => ({ ...c, pts: Math.max(1, c.pct + rnd(-5, 5)) }));
  const total = conRuido.reduce((s, c) => s + c.pts, 0);
  const cand = conRuido.map(c => ({ ...c, v: (c.pts / total) * 100 })).sort((a, b) => b.v - a.v);
  const gana = !!cand[0].yo;
  const yo = cand.find(c => c.yo);

  app().innerHTML = `
  <div class="pantalla centro noche">
    <div class="big-emoji">🗳️</div>
    <h2>${reeleccion ? `Elecciones ${ANIO0 + 3}: ¿te reeligen?` : `Elecciones municipales ${ANIO0 - 1}`}</h2>
    <p class="sub" id="conteo">Contando votos...</p>
    <div class="resultados">
      ${cand.map((c, i) => `
        <div class="res-fila ${c.yo ? 'yo' : ''}">
          <span class="res-n">${partidoDe(c.partido).e} ${c.n}${c.rol ? `<small>${c.rol}</small>` : ''}</span>
          <div class="res-barra"><div id="rb${i}" style="width:0%"></div></div>
          <span class="res-v" id="rv${i}">0%</span>
        </div>`).join('')}
    </div>
    <div id="res-final"></div>
  </div>`;

  let t = 0;
  const pasos = 30;
  const intv = setInterval(() => {
    t++;
    const f = t / pasos;
    cand.forEach((c, i) => {
      const v = c.v * f * (0.9 + 0.1 * Math.sin(t + i));
      document.getElementById('rb' + i).style.width = Math.min(100, v * 1.4) + '%';
      document.getElementById('rv' + i).textContent = v.toFixed(1) + '%';
    });
    if (t % 3 === 0) Sonido.tono(300 + t * 12, 0.04, 'triangle', 0.03);
    document.getElementById('conteo').textContent = `Mesas escrutadas: ${Math.round(f * 100)}%`;
    if (t < pasos) return;
    clearInterval(intv);
    cand.forEach((c, i) => {
      document.getElementById('rb' + i).style.width = Math.min(100, c.v * 1.4) + '%';
      document.getElementById('rv' + i).textContent = c.v.toFixed(1) + '%';
    });
    if (gana) Sonido.fanfarria(); else Sonido.mal();
    const fin = document.getElementById('res-final');
    if (reeleccion) {
      S.historia.push({ anio: ANIO0 + 3, nombre: cand[0].n, partido: cand[0].partido });
      fin.innerHTML = `<h2 class="${gana ? 'verde' : 'rojo'}">${gana ? '🎉 ¡Te reeligieron!' : `😞 Ganó ${cand[0].n}`}</h2>
        <button class="btn grande" onclick="pantallaFinal(${gana})">Ver tu legado</button>`;
    } else if (gana) {
      S.historia.push({ anio: ANIO0 - 1, nombre: S.nombre, partido: miPartidoId() });
      const venciste = cand.find(c => c.rol === 'alcalde actual');
      const inc = S.comuna.politica.incumbente;
      fin.innerHTML = `<h2 class="verde">🎉 ¡Ganaste la alcaldía de ${S.comuna.nombre}!</h2>
        ${venciste ? `<p>Derrotaste a ${venciste.n} después de ${inc.periodos} ${inc.periodos === 1 ? 'periodo' : 'periodos'}.</p>` : ''}
        <button class="btn grande" onclick="armarConcejo()">Ver el nuevo concejo</button>`;
    } else {
      fin.innerHTML = `<h2 class="rojo">😞 Perdiste por ${(cand[0].v - yo.v).toFixed(1)} puntos</h2>
        <p>${cand[0].rol === 'alcalde actual' ? 'Ganaron los mismos de siempre.' : `Ganó ${cand[0].n}.`}</p>
        <button class="btn grande" onclick="seleccionarComuna('${S.comuna.id}')">Intentar otra vez</button>
        <button class="btn sec" onclick="inicio()">Menú</button>`;
    }
  }, 90);
}

// ------------------------------------------------------------
//  Concejo municipal: se reparte con D'Hondt según la fuerza de cada partido
// ------------------------------------------------------------
function armarConcejo() {
  const v = { ...S.comuna.politica.votos };
  const mio = miPartidoId();
  const inc = S.comuna.politica.incumbente.partido;
  v[mio] = (v[mio] || 0) + 10; // arrastre de tu candidatura
  const n = nConcejales(S.comuna);
  const escanos = {};
  Object.keys(v).forEach(k => { escanos[k] = 0; });
  for (let i = 0; i < n; i++) {
    const k = Object.keys(v).sort((a, b) => v[b] / (escanos[b] + 1) - v[a] / (escanos[a] + 1))[0];
    escanos[k]++;
  }
  S.concejo = [];
  let id = 0;
  for (const k of Object.keys(escanos)) {
    for (let j = 0; j < escanos[k]; j++) {
      const base = k === mio ? 70 : k === inc && inc !== mio ? 25 : k === 'ind' ? 45 : 38;
      S.concejo.push({ id: 'c' + id++, nombre: nombreAzar(), partido: k, lealtad: Math.round(base + rnd(-8, 8)) });
    }
  }
  const aliados = S.concejo.filter(c => c.lealtad >= 55).length;
  app().innerHTML = `
  <div class="pantalla centro">
    <div class="big-emoji">🏛️</div>
    <h2>Tu Concejo Municipal</h2>
    <p class="sub">${n} concejales + tú. Las ordenanzas y las obras grandes necesitan mayoría.</p>
    <div class="concejo-grid">
      ${S.concejo.map(c => `
        <div class="concejal" style="--c:${partidoDe(c.partido).color}">
          <div class="cj-av">${partidoDe(c.partido).e}</div>
          <div class="cj-n">${c.nombre}</div>
          <div class="cj-l">${cara(c.lealtad)} ${c.lealtad >= 55 ? 'Aliado' : c.lealtad >= 35 ? 'Neutral' : 'Opositor'}</div>
        </div>`).join('')}
    </div>
    <p>${aliados + 1 > (n + 1) / 2 ? '✅ Tienes mayoría. ¡Aprovéchala!' : '⚠️ No tienes mayoría. Tendrás que negociar.'}</p>
    <button class="btn grande" onclick="asumir()">Asumir el cargo</button>
  </div>`;
}

// ------------------------------------------------------------
//  Finales
// ------------------------------------------------------------
function finPartida(motivo) {
  S.fase = 'fin';
  borrarGuardado();
  Sonido.mal();
  const txt = {
    remocion: { e: '📢', t: 'Te sacaron del cargo', d: 'Tu aprobación llegó a cero. El concejo pidió tu remoción al Tribunal Electoral Regional.' },
    quiebra: { e: '💸', t: 'Quebraste el municipio', d: 'La deuda es impagable. Contraloría intervino y tuviste que renunciar.' },
  }[motivo];
  app().innerHTML = `
  <div class="pantalla centro">
    <div class="big-emoji">${txt.e}</div>
    <h2 class="rojo">${txt.t}</h2>
    <p class="sub">${txt.d}</p>
    <p>Duraste <b>${S.mes}</b> meses en ${S.comuna.nombre}.</p>
    <button class="btn grande" onclick="elegirComuna()">Jugar otra vez</button>
    <button class="btn sec" onclick="inicio()">Menú</button>
  </div>`;
}

function pantallaFinal(reelecto) {
  borrarGuardado();
  const cumpl = promesasCumplidas();
  const puntaje = (S.m.a + S.m.s + S.m.b + S.m.e) / 4 + S.construidas.length * 2 + S.negocios.length * 0.5 + cumpl * 5 + (reelecto ? 10 : 0);
  const estrellas = puntaje > 85 ? 5 : puntaje > 70 ? 4 : puntaje > 55 ? 3 : puntaje > 40 ? 2 : 1;
  const titulo = ['Para el olvido', 'Gestión regular', 'Buena gestión', 'Gran gestión', `Leyenda de ${S.comuna.nombre}`][estrellas - 1];
  const histor = [...S.comuna.politica.historial, ...S.historia];
  app().innerHTML = `
  <div class="pantalla centro">
    <div class="big-emoji">${reelecto ? '🏆' : '📜'}</div>
    <h2>${titulo}</h2>
    <div class="estrellas">${'⭐'.repeat(estrellas)}${'☆'.repeat(5 - estrellas)}</div>
    <div class="cp-grid">
      <div>${ICON.a}<b>${Math.round(S.m.a)}</b><small>Aprobación</small></div>
      <div>${ICON.s}<b>${Math.round(S.m.s)}</b><small>Seguridad</small></div>
      <div>${ICON.b}<b>${Math.round(S.m.b)}</b><small>Bienestar</small></div>
      <div>${ICON.e}<b>${Math.round(S.m.e)}</b><small>Empleo</small></div>
    </div>
    <h3>Tu legado</h3>
    <div class="cp-obras">${S.construidas.length ? S.construidas.map(c => `<span title="${obra(c.id).n}">${obra(c.id).e}</span>`).join(' ') : 'Ninguna obra 😬'}</div>
    <p>🏪 ${S.negocios.length} negocios nuevos · 🎓 ${S.cursosHechos.length} capacitaciones · 💰 caja final ${fmt$(S.caja)}</p>
    <div class="cp-promesas">${S.promesas.map(id => { const p = PROMESAS.find(x => x.id === id); return `<div>${cumplida(p) ? '✅' : '❌'} ${p.e} ${p.n}</div>`; }).join('')}</div>
    <h3>Historia electoral de ${S.comuna.nombre}</h3>
    <div class="historial claro">${histor.map(h => `<div class="${h.nombre === S.nombre ? 'yo' : ''}"><span>${h.anio}</span>${partidoDe(h.partido).e} ${h.nombre}</div>`).join('')}</div>
    <button class="btn grande" onclick="elegirComuna()">Jugar otra vez</button>
  </div>`;
}
