'use strict';

// ============================================================
//  GOBIERNO: el ciclo de cada mes
// ============================================================

let ultimoCambio = {};

function asumir() {
  S.m.a = 55;
  S.fase = 'evento';
  S.evento = elegirEvento();
  guardar();
  renderJuego();
  modal(`<div class="centro">
    <div class="big-emoji">🏛️</div>
    <h2>¡Bienvenido/a al municipio!</h2>
    <div class="ayuda-lista">
      <div>😊 <b>Aprobación</b> — si llega a 0, te sacan</div>
      <div>🛡️ <b>Seguridad</b> — baja sola cada mes</div>
      <div>❤️ <b>Bienestar</b> — calidad de vida</div>
      <div>💼 <b>Empleo</b> — negocios, patentes y cursos</div>
      <div>🏛️ <b>Concejo</b> — lealtad de tus concejales</div>
      ${S.via === 'partido' ? '<div>🎗️ <b>Partido</b> — si llega a 0, te echan</div>' : ''}
      <div>🗺️ <b>Mapa</b> — toca un sector para verlo</div>
    </div>
    <p>Cada mes: <b>1 decisión</b> + <b>1 acción</b>.<br>Elecciones en octubre de ${ANIO0 + 3}.</p>
    <button class="btn grande" onclick="cerrarModal()">¡A trabajar!</button>
  </div>`, false);
}

// ------------------------------------------------------------
//  Selección de eventos
// ------------------------------------------------------------
function disponible(e) {
  const mA = S.mes % 12;
  if (e.meses && !e.meses.includes(mA)) return false;
  if (e.via && e.via !== S.via) return false;
  if (e.partido && (!S.partido || S.partido.id !== e.partido || S.via !== 'partido')) return false;
  if (e.comuna && e.comuna !== S.comuna.id) return false;
  if (e.costa && !S.comuna.costa) return false;
  if (e.flag && !S.flags[e.flag]) return false;
  if (e.desde && S.mes < e.desde) return false;
  const usado = S.usados[e.id];
  if (usado !== undefined && (!e.repite || S.mes - usado < e.repite)) return false;
  return true;
}

function peso(e) {
  if (e.comuna) return 3;
  if (e.meses) return 2.5;
  if (e.partido || e.via) return 2;
  return 1;
}

function preparar(base, sector) {
  const sec = sector || pick(S.sectores).n;
  const rep = s => s.replace('{sector}', sec).replace('{comuna}', S.comuna.nombre);
  return { id: base.id, q: base.q, quien: rep(base.quien), t: rep(base.t), tag: base.tag, sector: sec, esp: !!base.esp, crisis: !!base.cond };
}

function elegirEvento() {
  // 1) eventos programados
  const i = S.cola.findIndex(c => c.mes <= S.mes);
  if (i >= 0) {
    const c = S.cola.splice(i, 1)[0];
    return preparar({ ...ESPECIALES[c.id], id: c.id, esp: true }, c.sector);
  }
  // 2) crisis
  const crisis = CRISIS.filter(e => e.cond(S) && (S.usados[e.id] === undefined || S.mes - S.usados[e.id] >= 5));
  if (crisis.length && Math.random() < 0.6) return marcar(pick(crisis));
  // 3) una gran marca quiere llegar
  if (Math.random() < 0.12) {
    const ml = marcaLlama();
    if (ml) return ml;
  }
  // 4) propuesta de un concejal
  if (Math.random() < 0.2) {
    const cp = propuestaConcejal();
    if (cp) return cp;
  }
  // 4) eventos normales, ponderados
  let pool = EVENTOS.filter(disponible);
  if (!pool.length) pool = EVENTOS.filter(e => !e.meses && !e.via && !e.partido && !e.comuna && !e.flag);
  const total = pool.reduce((s, e) => s + peso(e), 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= peso(e);
    if (r <= 0) return marcar(e);
  }
  return marcar(pool[pool.length - 1]);
}

function marcar(e) {
  S.usados[e.id] = S.mes;
  return preparar(e);
}

// Busca la definición original (las funciones no se guardan en localStorage)
function opcionesDe(ev) {
  if (ev.tipo === 'cprop' || ev.tipo === 'marca') return ev.o;
  if (ev.esp) return ESPECIALES[ev.id].o;
  const e = EVENTOS.find(x => x.id === ev.id) || CRISIS.find(x => x.id === ev.id);
  return e ? e.o : [];
}

// ------------------------------------------------------------
//  Aplicar efectos
// ------------------------------------------------------------
function aplicar(fx, tag, sector) {
  let reducido = false;
  for (const k in fx) {
    let v = fx[k];
    if (tag === 'fuego' && v < 0 && construida('bomberos')) { v = v / 2; reducido = true; }
    if (k === '$') S.caja += v * U();
    else if (k === 'c') cambiarLealtad(v);
    else if (k === 'p') {
      if (S.via === 'partido') {
        S.relPartido = clamp(S.relPartido + v);
        cambiarLealtad(v * 0.5, c => c.partido === S.partido.id);
      } else cambiarLealtad(v * 0.6);
    } else if (k in S.m) S.m[k] = clamp(S.m[k] + v);
    const kk = k === 'p' && S.via !== 'partido' ? 'c' : k;
    ultimoCambio[kk] = (ultimoCambio[kk] || 0) + v;
  }
  if (sector && fx.a) {
    const s = S.sectores.find(x => x.n === sector);
    if (s) s.animo = clamp(s.animo + fx.a * 2);
  }
  if (reducido) toast('🚒 Tus bomberos equipados redujeron el daño', 'bien');
}

function elegir(i) {
  ultimoCambio = {};
  Sonido.click();
  if (S.fase === 'evento') {
    const ev = S.evento;
    if (ev.tipo === 'cprop') return resolverPropuestaConcejal(ev, i);
    if (ev.tipo === 'marca') return resolverMarcaLlama(ev, i);
    const op = opcionesDe(ev)[i];
    if (!op) return;
    aplicar(op.fx, ev.tag, ev.sector);
    if (op.flag) S.flags[op.flag] = true;
    if (op.ingreso) S.ingresoBonus += op.ingreso;
    if (op.sched) S.cola.push({ id: op.sched.id, mes: S.mes + op.sched.en, sector: ev.sector });
    if (op.efecto) efectoEspecial(op.efecto);
    if (op.r && Math.random() < op.r.p) {
      aplicar(op.r.fx);
      toast('🎲 ' + op.r.t, 'mal');
    } else if (op.ok) toast('✨ ' + op.ok, 'bien');
    S.fase = 'accion';
    if (chequearDerrota()) return;
    renderJuego();
  } else if (S.fase === 'terreno') {
    const op = OPC_TERRENO[i];
    if (!op) return;
    aplicar(op.fx);
    const s = S.sectores.find(x => x.n === S.terreno.sector);
    if (s) s.animo = clamp(s.animo + op.animo);
    if (op.sched) S.cola.push({ id: op.sched.id, mes: S.mes + op.sched.en, sector: S.terreno.sector });
    toast(op.msg, 'bien');
    S.terreno = null;
    finMes();
  }
}

function efectoEspecial(ef) {
  if (ef === 'expulsar') {
    const ex = S.partido;
    S.via = 'independiente';
    S.partido = null;
    if (ex) cambiarLealtad(-20, c => c.partido === ex.id);
  }
  if (ef === 'unirse') {
    const cuenta = {};
    S.concejo.filter(c => c.partido !== 'ind').forEach(c => { cuenta[c.partido] = (cuenta[c.partido] || 0) + 1; });
    const id = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0] || pick(PARTIDOS).id;
    S.via = 'partido';
    S.partido = PARTIDOS.find(p => p.id === id);
    S.relPartido = 60;
    cambiarLealtad(20, c => c.partido === id);
    toast(`Ahora militas en ${S.partido.e} ${S.partido.n}`);
  }
  if (ef === 'reset_c') S.concejo.forEach(c => { c.lealtad = Math.max(c.lealtad, 30); });
  if (ef === 'danio_costanera') danioCostanera();
}

// ------------------------------------------------------------
//  Acciones del mes
// ------------------------------------------------------------
const OPC_TERRENO = [
  { t: 'Resolverlo ya', fx: { $: -0.4, a: 3, b: 2 }, animo: 12, msg: '👍 Los vecinos quedaron felices' },
  { t: 'Prometerlo', fx: { a: 2 }, animo: 6, sched: { id: 'promesa', en: 5 }, msg: '🤞 Te aplaudieron... no lo olvidarán' },
  { t: 'Sólo escuchar', fx: { a: 1 }, animo: 3, msg: '👂 Agradecieron la visita' },
];

function irTerreno(si) {
  const s = si === undefined ? [...S.sectores].sort((a, b) => a.animo - b.animo)[Math.floor(Math.random() * 2)] : S.sectores[si];
  S.terreno = { sector: s.n, rec: pick(RECLAMOS) };
  S.fase = 'terreno';
  renderJuego();
}

const obrasDisponibles = () => OBRAS.filter(o => !o.costa || S.comuna.costa);
const costoObra = o => o.costo * (lealtadMedia() < 30 ? 1.25 : 1);

function modalObras() {
  const enCurso = S.obras.length;
  const trabas = lealtadMedia() < 30;
  modal(`
    <h2>🏗️ Obras</h2>
    <p class="sub">Caja: <b>${fmt$(S.caja)}</b> · Máximo 2 obras a la vez · 🗳️ = la vota el concejo
      ${trabas ? '<br><span class="rojo">⚠️ El concejo te pone trabas: +25% costo</span>' : ''}</p>
    <div class="lista-obras">
      ${obrasDisponibles().map(o => {
        const hecha = construida(o.id);
        const curso = S.obras.find(x => x.id === o.id);
        const c = costoObra(o) * U();
        const sinLugar = o.lugar !== 'sector' && !lugaresObra(o).length;
        const repetible = o.lugar !== 'sector';
        const puede = (!hecha || repetible) && !curso && enCurso < 2 && S.caja >= c && S.fase === 'accion' && !sinLugar;
        const n = S.construidas.filter(x => x.id === o.id).length;
        const estado = curso ? `🚧 ${curso.fin - S.mes}m` : sinLugar ? 'Sin terreno' : n ? `✅${n > 1 ? '×' + n : ''}` : '';
        return `
        <button class="obra ${hecha && !repetible ? 'hecha' : ''}" ${puede ? '' : 'disabled'} onclick="${o.lugar === 'sector' ? `elegirSectorObra('${o.id}')` : `abrirSelector('obra','${o.id}')`}">
          <span class="obra-e">${o.e}</span>
          <span class="obra-info">
            <b>${o.n}</b>
            <small>${fmt$(c)} · ${o.meses} ${o.meses === 1 ? 'mes' : 'meses'} · ${o.lugar === 'sector' ? 'en un sector' : `terreno ${o.lugar}${o.usa ? ' o edificio existente' : ''}`}${o.mant ? ' · mantención' : ''}${o.ingreso ? ' · 📈' : ''}</small>
            <span class="chips">${chips(o.fx, { voto: o.costo >= OBRA_GRANDE })}</span>
          </span>
          <span class="obra-estado">${estado}</span>
        </button>`;
      }).join('')}
    </div>
    ${htmlCostanera()}
    ${S.fase === 'accion' ? '' : '<p class="sub centro">Primero responde la decisión del mes.</p>'}`);
}

function elegirSectorObra(id) {
  const o = obra(id);
  modal(`
    <h2>${o.e} ¿Dónde construyes ${o.n.toLowerCase()}?</h2>
    <p class="sub">El sector elegido se pondrá contento.</p>
    <div class="lista-sectores">
      ${S.sectores.map((s, i) => `
        <button class="fila-sector" onclick="confirmarObra('${id}', ${i})">
          <span>${cara(s.animo)}</span><b>${s.n}</b><small>ánimo ${Math.round(s.animo)}</small>
        </button>`).join('')}
    </div>
    <button class="btn sec" onclick="modalObras()">← Volver</button>`);
}

function confirmarObra(id, si) {
  const o = obra(id);
  const c = costoObra(o) * U();
  if (o.costo < OBRA_GRANDE) return iniciarObra(id, si);
  votacion({ titulo: `${o.e} ${o.n} (${fmt$(c)})`, postura: {}, autor: 'alcalde', votoAlcalde: true }, ok => {
    if (ok) return iniciarObra(id, si);
    toast('🏛️ El concejo rechazó el contrato de la obra', 'mal');
    finMes();
  });
}

function iniciarObra(id, si) {
  const o = obra(id);
  const c = costoObra(o) * U();
  if (S.caja < c || S.obras.length >= 2) return;
  S.caja -= c;
  S.obras.push({ id, fin: S.mes + o.meses, sector: S.sectores[si].n, lugar: { tipo: 'sector' } });
  cerrarModal();
  toast(`🚧 Comenzó: ${o.n} en ${S.sectores[si].n}`, 'bien');
  finMes();
}

function postularFondos() {
  if (S.fondo) return;
  S.fondo = { mes: S.mes + 3 };
  S.caja -= 0.5 * U();
  ultimoCambio.$ = -0.5;
  toast(`📝 Postulaste al FRIL (formularlo costó ${fmt$(0.5 * U())}). Respuesta en 3 meses.`);
  finMes();
}

// ------------------------------------------------------------
//  Fin de mes
// ------------------------------------------------------------
function finMes() {
  S.mes++;
  const mA = S.mes % 12;
  const u = U();

  // Ingresos, patentes y gastos fijos
  const mant = S.construidas.reduce((s, c) => s + (obra(c.id).mant || 0), 0);
  S.caja += u * (0.5 + S.ingresoBonus) - mant * u + patentesMes() + balanceTerritorio();
  if (mA === 2) {
    S.caja += 1.5 * u;
    toast(`🚗 Permisos de circulación: +${fmt$(1.5 * u)}`);
    Sonido.moneda();
  }
  if ((mA === 0 || mA === 1) && S.comuna.turismo) {
    S.caja += S.comuna.turismo * u * (1 + S.ingresoBonus * 2);
    S.m.e += S.comuna.turismo * 1.5;
    if (mA === 0) toast('🏖️ Temporada de verano: más patentes, turistas y empleo', 'bien');
  }
  if (mA === 2 && S.comuna.turismo >= 0.5) S.m.e -= S.comuna.turismo * 3;

  // Obras terminadas
  S.obras = S.obras.filter(x => {
    if (S.mes < x.fin) return true;
    const o = obra(x.id);
    S.construidas.push({ id: x.id, sector: x.sector, lugar: x.lugar });
    if (x.lugar && x.lugar.tipo === 'equip') S.mejoras[x.lugar.idx] = [...(S.mejoras[x.lugar.idx] || []), x.id];
    aplicar(o.fx);
    if (o.ingreso) S.ingresoBonus += o.ingreso;
    const sec = S.sectores.find(s => s.n === x.sector);
    if (sec) sec.animo = clamp(sec.animo + 15);
    Sonido.fanfarria();
    toast(`✅ ¡Inauguraste ${o.e} ${o.n} en ${x.sector}!`);
    return false;
  });

  // Cursos terminados
  S.cursos = S.cursos.filter(x => {
    if (S.mes < x.fin) return true;
    const c = CURSOS.find(k => k.id === x.id);
    S.cursosHechos.push(x.id);
    S.emprendedores++;
    aplicar(c.fx);
    toast(`🎓 Se titularon 30 vecinos en ${c.n}`, 'bien');
    return false;
  });

  // Fondos regionales
  if (S.fondo && S.mes >= S.fondo.mes) {
    const prob = 0.3 + lealtadMedia() / 300 + (S.via === 'partido' ? 0.08 + S.relPartido / 500 : 0);
    if (Math.random() < prob) {
      const monto = rnd(2.5, 4.5) * u;
      S.caja += monto;
      toast(`🎉 ¡El Gobierno Regional aprobó tu proyecto! +${fmt$(monto)}`, 'bien');
    } else {
      toast('📭 Rechazaron tu postulación a fondos. Inténtalo otra vez.', 'mal');
    }
    S.fondo = null;
  }

  avanzarTerritorio();
  generarSolicitudes();

  // Deriva natural
  S.m.s -= S.comuna.delincuencia * 1.3;
  S.m.b -= 0.9;
  S.m.e -= 0.6;
  for (const c of S.construidas) {
    const men = obra(c.id).mensual || {};
    for (const k in men) S.m[k] += men[k];
  }
  for (const k in S.m) S.m[k] = clamp(S.m[k]);
  S.sectores.forEach(s => { s.animo = clamp(s.animo + (S.m.b - s.animo) * 0.04); });
  const animoMedio = S.sectores.reduce((t, s) => t + s.animo, 0) / S.sectores.length;
  // la aprobación tiende al promedio de seguridad, bienestar y empleo, con desgaste por estar en el poder
  const objetivo = (S.m.s + S.m.b + S.m.e) / 3 + (animoMedio - 50) * 0.2 + promesasCumplidas() * 4 - 4 - S.mes * 0.25;
  S.m.a = clamp(S.m.a + (objetivo - S.m.a) * 0.1);
  S.concejo.forEach(c => { c.lealtad = clamp(c.lealtad + (45 - c.lealtad) * 0.02); });
  if (S.via === 'partido') S.relPartido = clamp(S.relPartido - 0.6);
  if (S.m.e >= 65) S.flags.empleo_ok = true;

  // Crisis política
  if (S.via === 'partido' && S.relPartido <= 0 && !S.cola.some(c => c.id === 'expulsion')) S.cola.unshift({ id: 'expulsion', mes: S.mes });
  if (lealtadMedia() < 15 && !S.cola.some(c => c.id === 'rechazo')) S.cola.unshift({ id: 'rechazo', mes: S.mes });

  if (chequearDerrota()) return;

  if (S.mes >= DURACION) {
    S.fase = 'fin';
    guardar();
    return nocheElectoral(candidatosReeleccion(), true);
  }

  S.fase = 'evento';
  S.evento = elegirEvento();
  guardar();
  renderJuego();

  if (mA === 3 && S.mes >= 12) cuentaPublica();
}

function candidatosReeleccion() {
  const v = S.comuna.politica.votos;
  const mio = miPartidoId();
  const yo = {
    n: S.nombre, partido: mio, yo: true, rol: 'alcalde',
    pts: 2 + S.m.a * 0.55 + promesasCumplidas() * 4 + (S.via === 'partido' ? S.relPartido * 0.05 : 0),
  };
  const rivales = PARTIDOS.map(p => p.id).filter(k => k !== mio).sort((a, b) => v[b] - v[a]).slice(0, 2)
    .map((k, i) => ({ n: nombreAzar(), partido: k, rol: i === 0 ? 'oposición' : 'candidato/a', pts: i === 0 ? v[k] * 0.9 + 10 : v[k] * 0.6 + 4 }));
  const lista = [yo, ...rivales];
  const total = lista.reduce((s, c) => s + c.pts, 0);
  return lista.map(c => ({ ...c, pct: (c.pts / total) * 100 }));
}

function chequearDerrota() {
  if (S.m.a <= 0) { finPartida('remocion'); return true; }
  if (S.caja < -6 * U()) { finPartida('quiebra'); return true; }
  return false;
}

// ------------------------------------------------------------
//  Cuenta Pública (cada abril)
// ------------------------------------------------------------
function cuentaPublica() {
  const anio = ANIO0 + Math.floor(S.mes / 12) - 1;
  const cumpl = promesasCumplidas();
  const bonus = cumpl * 2 - (S.promesas.length - cumpl);
  S.m.a = clamp(S.m.a + bonus);
  modal(`<div class="centro">
    <div class="big-emoji">🎤</div>
    <h2>Cuenta Pública ${anio}</h2>
    <div class="cp-grid">
      <div>${ICON.a}<b>${Math.round(S.m.a)}</b><small>Aprobación</small></div>
      <div>${ICON.s}<b>${Math.round(S.m.s)}</b><small>Seguridad</small></div>
      <div>${ICON.b}<b>${Math.round(S.m.b)}</b><small>Bienestar</small></div>
      <div>${ICON.e}<b>${Math.round(S.m.e)}</b><small>Empleo</small></div>
    </div>
    <p>💰 Caja ${fmt$(S.caja)} · 🏪 ${S.negocios.length} negocios · 🎓 ${S.cursosHechos.length} cursos</p>
    <h3>Obras inauguradas</h3>
    <div class="cp-obras">${S.construidas.length ? S.construidas.map(c => obra(c.id).e).join(' ') : 'Ninguna todavía 😬'}</div>
    <h3>Tus promesas</h3>
    <div class="cp-promesas">${S.promesas.map(id => { const p = PROMESAS.find(x => x.id === id); return `<div>${cumplida(p) ? '✅' : '⏳'} ${p.e} ${p.n}</div>`; }).join('')}</div>
    <p class="${bonus >= 0 ? 'verde' : 'rojo'}">${bonus >= 0 ? 'Los vecinos valoran lo que cumpliste' : 'Te reclaman las promesas pendientes'} (😊 ${bonus >= 0 ? '+' : ''}${bonus})</p>
    <button class="btn grande" onclick="cerrarModal();renderJuego()">Seguir gobernando</button>
  </div>`, false);
}

// ------------------------------------------------------------
//  Render principal
// ------------------------------------------------------------
function medidor(k) {
  const v = k === 'c' ? lealtadMedia() : S.m[k];
  const d = ultimoCambio[k];
  const cls = d > 0 ? 'sube' : d < 0 ? 'baja' : '';
  return `
  <div class="med ${cls}" title="${NOMBRE_IND[k]}">
    <div class="med-top"><span class="med-i">${ICON[k]}</span><b>${Math.round(v)}</b></div>
    <div class="barra"><div class="${v < 25 ? 'bajo' : v > 70 ? 'alto' : ''}" style="width:${v}%"></div></div>
    <div class="med-n">${NOMBRE_IND[k]}</div>
  </div>`;
}

function botonesOpciones(ops) {
  return ops.map((o, i) => `
    <button class="opt" onclick="elegir(${i})">
      <span class="opt-t">${o.t}</span>
      <span class="chips">${chips(o.fx, o)}</span>
    </button>`).join('');
}

function panel() {
  if (S.fase === 'evento' && S.evento) {
    const ev = S.evento;
    return `
    <div class="carta entra ${ev.tipo === 'cprop' ? 'carta-concejo' : ''} ${ev.crisis ? 'carta-crisis' : ''}">
      <div class="carta-cab"><span class="carta-q">${ev.q}</span><span class="carta-quien">${ev.quien}</span></div>
      <div class="carta-t">${ev.t}</div>
      <div class="opciones">${botonesOpciones(opcionesDe(ev))}</div>
    </div>`;
  }
  if (S.fase === 'terreno') {
    return `
    <div class="carta entra">
      <div class="carta-cab"><span class="carta-q">🚶</span><span class="carta-quien">En terreno: ${S.terreno.sector}</span></div>
      <div class="carta-t">“${S.terreno.rec}”</div>
      <div class="opciones">${botonesOpciones(OPC_TERRENO)}</div>
    </div>`;
  }
  const enCurso = [
    ...S.obras.map(x => `${obra(x.id).e} ${x.fin - S.mes}m`),
    ...S.cursos.map(x => `${CURSOS.find(c => c.id === x.id).e} ${x.fin - S.mes}m`),
    ...(S.fondo ? [`📝 ${S.fondo.mes - S.mes}m`] : []),
    ...S.obrasCost.map(x => `🌊 ${x.fin - S.mes}m`),
    ...Object.entries(S.marcas).filter(([, m]) => m.estado === 'construyendo').map(([id, m]) => `${marca(id).e} ${m.fin - S.mes}m`),
  ].join(' · ');
  const sol = S.solicitudes.length;
  return `
  <div class="acciones-wrap entra">
    <div class="acciones-tit">¿Qué haces este mes?</div>
    <div class="acciones">
      <button class="acc" onclick="irTerreno()"><span>🚶</span>Terreno</button>
      <button class="acc" onclick="modalObras()"><span>🏗️</span>Obras</button>
      <button class="acc" onclick="modalEconomia()"><span>💼</span>Economía${sol ? `<i class="badge">${sol}</i>` : ''}</button>
      <button class="acc" onclick="modalConcejo()"><span>🏛️</span>Concejo</button>
      <button class="acc" ${S.fondo ? 'disabled' : ''} onclick="postularFondos()"><span>📝</span>${S.fondo ? 'Fondos ⏳' : 'Fondos GORE'}</button>
      <button class="acc sig" onclick="finMes()"><span>⏭️</span>Siguiente</button>
    </div>
    ${enCurso ? `<div class="en-curso">En curso: ${enCurso}</div>` : ''}
  </div>`;
}

function renderJuego() {
  const c = S.comuna;
  const falta = DURACION - S.mes;
  app().innerHTML = `
  <div class="juego">
    <header class="top">
      <div class="top-izq">
        <div class="top-comuna">${c.emoji} ${c.nombre}
          ${S.via === 'partido' ? `<span class="tag-partido" title="Relación con tu partido">${S.partido.e} ${Math.round(S.relPartido)}</span>` : '<span class="tag-partido" title="Independiente">🧍</span>'}
        </div>
        <div class="top-fecha">${fecha(S.mes)} <span class="restan">· ${falta} ${falta === 1 ? 'mes' : 'meses'} a la elección</span></div>
      </div>
      <div class="top-der">
        <div class="caja ${S.caja < 0 ? 'neg' : ''} ${ultimoCambio.$ > 0 ? 'sube' : ultimoCambio.$ < 0 ? 'baja' : ''}">💰 ${fmt$(S.caja)}</div>
        <button class="icon-btn" title="Datos de la comuna" onclick="modalDatosComuna()">📊</button>
        <button class="icon-btn" title="Menú" onclick="modalMenu()">☰</button>
      </div>
    </header>
    <div class="medidores">${['a', 's', 'b', 'e', 'c'].map(medidor).join('')}</div>
    ${mapaSVG()}
    <div class="panel">${panel()}</div>
  </div>`;
  ultimoCambio = {};
}

function modalMenu() {
  modal(`<div class="centro">
    <h2>Menú</h2>
    <div class="ayuda-lista">
      <div>😊 <b>Aprobación</b> — si llega a 0, te sacan</div>
      <div>🛡️ <b>Seguridad</b> · ❤️ <b>Bienestar</b> · 💼 <b>Empleo</b> — la aprobación los sigue</div>
      <div>🏛️ <b>Concejo</b> — lealtad media. Bajo 30 las obras cuestan más</div>
      ${S.via === 'partido' ? `<div>🎗️ <b>Partido</b> ${Math.round(S.relPartido)} — si llega a 0, te echan</div>` : ''}
      <div>💰 <b>Caja</b> — bajo ${fmt$(-6 * U())} quiebras</div>
      <div>🎲 puede salir mal · ⏳ consecuencias futuras · 🗳️ lo vota el concejo</div>
    </div>
    <h3>Promesas</h3>
    <div class="cp-promesas">${S.promesas.map(id => { const p = PROMESAS.find(x => x.id === id); return `<div>${cumplida(p) ? '✅' : '⏳'} ${p.e} ${p.n} <small>(${p.obras.map(o => obra(o).e).join(' ')})</small></div>`; }).join('')}</div>
    <button class="btn sec" onclick="Sonido.alternar();modalMenu()">${Sonido.on ? '🔊 Sonido activado' : '🔇 Sonido apagado'}</button>
    <button class="btn sec" onclick="guardar();inicio()">Salir al menú (se guarda)</button>
  </div>`);
}

// ------------------------------------------------------------
//  Teclado: 1, 2, 3... eligen opción o acción
// ------------------------------------------------------------
document.addEventListener('keydown', e => {
  if (document.getElementById('modal')) return;
  if (firmas && !firmas.fin && e.code === 'Space' && document.getElementById('btn-firma')) {
    e.preventDefault();
    tocarFirma();
    return;
  }
  const n = parseInt(e.key, 10);
  if (!n) return;
  const btn = document.querySelectorAll('.opt, .acc')[n - 1];
  if (btn && !btn.disabled) btn.click();
});

inicio();
