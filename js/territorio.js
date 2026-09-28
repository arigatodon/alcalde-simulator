'use strict';

// ============================================================
//  TERRITORIO: terrenos, equipamiento existente, costanera y grandes marcas
// ============================================================

const mapaDe = () => (typeof MAPAS !== 'undefined' && MAPAS[S.comuna.id]) || null;
const equipos = () => (mapaDe() ? mapaDe().equip || [] : []);
const terreno = id => S.terrenos.find(t => t.id === id);
const marca = id => MARCAS.find(m => m.id === id);
const tamOk = (tam, req) => TAMANOS.indexOf(tam) >= TAMANOS.indexOf(req);
const TAM_TXT = { chico: 'chico', mediano: 'mediano', grande: 'grande' };

function sectorCercano(x, y) {
  let mejor = S.sectores[0].n, d = Infinity;
  S.sectores.forEach((s, i) => {
    const p = posSector(i);
    const dd = Math.hypot(p.x - x, p.y - y);
    if (dd < d) { d = dd; mejor = s.n; }
  });
  return mejor;
}

// Se llama al elegir comuna
function iniciarTerritorio() {
  const m = mapaDe();
  S.terrenos = (m ? m.terrenos : []).map((t, i) => {
    const [x, y, sector, nom, dueno, tam, zt] = t;
    const d = dueno || (Math.random() < 0.35 ? 'municipal' : 'privado');
    const tm = tam || pick(['chico', 'chico', 'mediano', 'mediano', 'grande']);
    return {
      id: 't' + i, x, y, sector, n: nom || pick(NOMBRES_TERRENO[d]), dueno: d, tam: tm, zt: !!zt, fijo: !!nom,
      precio: +(PRECIO_TERRENO[tm] * (/centro/i.test(sector) ? 1.4 : 1) * rnd(0.85, 1.2)).toFixed(2),
      uso: null, arriendo: 0, concesion: 0,
    };
  });
  let mun = S.terrenos.filter(t => t.dueno === 'municipal').length;
  for (const t of S.terrenos) {
    if (mun >= 3) break;
    if (!t.fijo && t.dueno === 'privado') { t.dueno = 'municipal'; t.n = pick(NOMBRES_TERRENO.municipal); mun++; }
  }
  S.costanera = m && m.costanera.length ? m.costanera.map(() => 0) : [];
  S.obrasCost = [];
  S.mejoras = {};
  S.marcas = {};
  const sc = atractivo();
  MARCAS.forEach(b => { if (sc >= b.umbral + 12) S.marcas[b.id] = { estado: 'ya' }; });
  equipos().forEach(q => MARCAS.forEach(b => {
    const clave = b.n.toLowerCase().replace(/[^a-z]/g, '');
    if ((q.n + ' ' + q.marca).toLowerCase().replace(/[^a-z]/g, '').includes(clave)) S.marcas[b.id] = { estado: 'ya' };
  }));
}

// Qué tan atractiva es la comuna para las grandes marcas
function atractivo() {
  const c = S.comuna;
  const nivelCost = S.costanera.reduce((a, b) => a + b, 0);
  const inst = Object.values(S.marcas).filter(m => m.estado === 'instalada' || m.estado === 'ya').length;
  return Math.min(40, c.poblacion / 5000) + c.turismo * 10 + nivelCost * 3 + (S.m.e - 40) * 0.3 + (S.m.s - 40) * 0.3 + inst * 2;
}

// Ingresos y gastos mensuales del territorio (en MM$)
function balanceTerritorio() {
  const u = U();
  let neto = 0;
  S.terrenos.forEach(t => { neto += (t.concesion - t.arriendo) * u; });
  Object.entries(S.marcas).forEach(([id, m]) => { if (m.estado === 'instalada') neto += marca(id).patente * u; });
  return neto;
}

// ------------------------------------------------------------
//  Lugares posibles para una obra o una marca
// ------------------------------------------------------------
function lugaresObra(o) {
  const res = [];
  equipos().forEach((q, idx) => {
    if ((o.usa || []).includes(q.t) && !(S.mejoras[idx] || []).includes(o.id) && !S.obras.some(x => x.lugar && x.lugar.idx === idx && x.id === o.id)) {
      res.push({ tipo: 'equip', idx, x: q.x, y: q.y });
    }
  });
  S.terrenos.forEach(t => { if (!t.uso && tamOk(t.tam, o.lugar)) res.push({ tipo: 'terreno', id: t.id, x: t.x, y: t.y }); });
  return res;
}

function lugaresMarca(b) {
  return S.terrenos.filter(t => !t.uso && tamOk(t.tam, b.tam)).map(t => ({ tipo: 'terreno', id: t.id, x: t.x, y: t.y }));
}

function costoLugar(o, l, modo) {
  let obraC = costoObra(o) * (l.tipo === 'equip' ? 0.7 : 1);
  let compra = 0, arriendo = 0;
  if (l.tipo === 'terreno') {
    const t = terreno(l.id);
    if (t.dueno === 'privado') {
      if (modo === 'arrendar') arriendo = t.precio / 20;
      else compra = t.precio;
    }
  }
  return { obra: obraC, compra, arriendo };
}

function nombreLugar(l) {
  if (l.tipo === 'equip') return equipos()[l.idx].n;
  if (l.tipo === 'terreno') return terreno(l.id).n;
  return S.sectores[l.i].n;
}

// ------------------------------------------------------------
//  Selector de lugar sobre el mapa
// ------------------------------------------------------------
let _picker = null;

function abrirSelector(kind, id) {
  const o = kind === 'obra' ? obra(id) : marca(id);
  const opciones = kind === 'obra' ? lugaresObra(o) : lugaresMarca(o);
  if (!opciones.length) {
    return modal(`<div class="centro"><div class="big-emoji">🔍</div><h2>No hay dónde</h2>
      <p>No queda ningún terreno ${TAM_TXT[o.lugar || o.tam]} libre${o.usa ? ' ni edificio municipal adecuado' : ''}.</p>
      <button class="btn grande" onclick="${kind === 'obra' ? 'modalObras()' : 'modalEconomia()'}">Volver</button></div>`);
  }
  _picker = { kind, id, opciones, sel: 0 };
  renderSelector();
}

function renderSelector() {
  const p = _picker;
  const esObra = p.kind === 'obra';
  const o = esObra ? obra(p.id) : marca(p.id);
  const l = p.opciones[p.sel];
  let detalle = '';
  if (l.tipo === 'equip') {
    const c = costoLugar(o, l);
    detalle = `
      <div class="lugar-info"><b>${ICONO_EQUIP[equipos()[l.idx].t] || '📍'} ${equipos()[l.idx].n}</b>
        <small>Edificio municipal existente · se amplía y mejora (30% más barato)</small></div>
      <button class="btn grande" onclick="confirmarLugar('usar')">Construir aquí · ${fmt$(c.obra * U())}</button>`;
  } else {
    const t = terreno(l.id);
    const zt = t.zt ? '<span class="chip riesgo">🏛️ Zona Típica: +2 meses de permiso CMN</span>' : '';
    const cab = `<div class="lugar-info"><b>${t.dueno === 'municipal' ? '🟩' : '🟨'} ${t.n}</b>
      <small>${t.sector} · terreno ${t.tam} · ${t.dueno === 'municipal' ? 'es del municipio' : `particular · vale ${fmt$(t.precio * U())}`}</small>${zt}</div>`;
    if (esObra) {
      const c1 = costoLugar(o, l, 'comprar');
      const c2 = costoLugar(o, l, 'arrendar');
      detalle = cab + (t.dueno === 'municipal'
        ? `<button class="btn grande" onclick="confirmarLugar('usar')">Construir aquí · ${fmt$(c1.obra * U())}</button>`
        : `<button class="btn grande" onclick="confirmarLugar('comprar')">Comprar y construir · ${fmt$((c1.obra + c1.compra) * U())}</button>
           <button class="btn sec" onclick="confirmarLugar('arrendar')">Arrendar (${fmt$(c2.arriendo * U())}/mes) y construir · ${fmt$(c2.obra * U())}</button>`);
    } else {
      detalle = cab + (t.dueno === 'municipal'
        ? `<button class="btn grande" onclick="confirmarLugar('concesion')">Concesionar a ${o.n} · +${fmt$(t.precio / 15 * U())}/mes</button><p class="nota-dark">La concesión la vota el concejo. Pierdes el terreno para tus obras.</p>`
        : `<button class="btn grande" onclick="confirmarLugar('compra_marca')">${o.n} compra este terreno</button><p class="nota-dark">No te cuesta nada: la empresa se lo compra al dueño.</p>`);
    }
  }
  modal(`
    <h2>${o.e} ¿Dónde ${esObra ? 'construyes' : 'se instala'} ${esObra ? o.n.toLowerCase() : o.n}?</h2>
    <p class="sub">Toca un punto del mapa. 🟩 municipal · 🟨 hay que comprar · 🔵 edificio existente</p>
    <div class="mapa-selector">${mapaSVG({ opciones: p.opciones, sel: p.sel })}</div>
    <div class="lista-lugares">${p.opciones.map((x, i) => `<button class="chip-lugar ${i === p.sel ? 'sel' : ''}" onclick="elegirLugar(${i})">${x.tipo === 'equip' ? '🔵' : terreno(x.id).dueno === 'municipal' ? '🟩' : '🟨'} ${nombreLugar(x)}</button>`).join('')}</div>
    ${detalle}
    <button class="btn sec" onclick="${esObra ? 'modalObras()' : 'modalEconomia()'}">← Volver</button>`);
}

function elegirLugar(i) {
  if (!_picker) return;
  _picker.sel = i;
  Sonido.click();
  renderSelector();
}

function confirmarLugar(modo) {
  const p = _picker;
  if (!p) return;
  const l = p.opciones[p.sel];
  if (p.kind === 'obra') {
    const o = obra(p.id);
    const c = costoLugar(o, l, modo);
    const total = (c.obra + c.compra) * U();
    if (S.caja < total) return toast(`💸 No alcanza: necesitas ${fmt$(total)}`, 'mal');
    const lanzar = () => iniciarObraEn(o.id, l, modo);
    if (o.costo >= OBRA_GRANDE || c.compra >= 4) {
      votacion({ titulo: `${o.e} ${o.n}${c.compra ? ' + compra del terreno' : ''} (${fmt$(total)})`, postura: {}, autor: 'alcalde', votoAlcalde: true }, ok => {
        if (ok) return lanzar();
        toast('🏛️ El concejo rechazó el gasto', 'mal');
        finMes();
      });
    } else lanzar();
  } else {
    const b = marca(p.id);
    const t = terreno(l.id);
    if (modo === 'concesion') {
      votacion({ titulo: `Concesionar "${t.n}" a ${b.n}`, postura: { orden: 1, verde: -1 }, autor: 'alcalde', votoAlcalde: true }, ok => {
        if (ok) instalarMarca(b, t, true);
        else { toast('🏛️ El concejo no aprobó la concesión', 'mal'); renderJuego(); }
      });
    } else instalarMarca(b, t, false);
  }
}

function iniciarObraEn(id, l, modo) {
  const o = obra(id);
  const c = costoLugar(o, l, modo);
  S.caja -= (c.obra + c.compra) * U();
  let sector, meses = o.meses;
  if (l.tipo === 'terreno') {
    const t = terreno(l.id);
    if (modo === 'comprar' && t.dueno === 'privado') { t.dueno = 'municipal'; toast(`🏡 Compraste "${t.n}"`); }
    if (modo === 'arrendar') t.arriendo = c.arriendo;
    t.uso = { tipo: 'obra', id };
    sector = t.sector;
    if (t.zt) meses += 2;
  } else {
    const q = equipos()[l.idx];
    sector = sectorCercano(q.x, q.y);
  }
  S.obras.push({ id, fin: S.mes + meses, sector, lugar: { tipo: l.tipo, id: l.id, idx: l.idx } });
  cerrarModal();
  _picker = null;
  toast(`🚧 Comenzó: ${o.n} en ${nombreLugar(l)}${meses > o.meses ? ' (esperando permiso del CMN)' : ''}`, 'bien');
  finMes();
}

// ------------------------------------------------------------
//  Costanera por tramos
// ------------------------------------------------------------
function htmlCostanera() {
  if (!S.costanera.length) return '';
  const nombres = mapaDe().nombresCostanera;
  const enCurso = S.obrasCost.length > 0;
  return `
    <h3>🌊 Costanera</h3>
    <div class="lista-obras">
      ${S.costanera.map((nv, i) => {
        const sig = NIVELES_COSTANERA[nv + 1];
        const curso = S.obrasCost.find(x => x.tramo === i);
        const c = sig ? sig.costo * U() : 0;
        const puede = sig && !enCurso && S.caja >= c && S.fase === 'accion';
        return `
        <button class="obra" ${puede ? '' : 'disabled'} onclick="iniciarCostanera(${i})">
          <span class="obra-e">${sig ? sig.e : '🎡'}</span>
          <span class="obra-info">
            <b>${nombres[i]}</b>
            <small>Hoy: ${NIVELES_COSTANERA[nv].n}${sig ? ` → ${sig.n} · ${fmt$(c)} · ${sig.meses} meses` : ' · ¡completa!'}</small>
            ${sig ? `<span class="chips">${chips(sig.fx, { voto: nv + 1 === 3 })}</span>` : ''}
          </span>
          <span class="obra-estado">${curso ? `🚧 ${curso.fin - S.mes}m` : '⭐'.repeat(nv)}</span>
        </button>`;
      }).join('')}
    </div>`;
}

function iniciarCostanera(i) {
  const nv = S.costanera[i] + 1;
  const n = NIVELES_COSTANERA[nv];
  if (!n || S.caja < n.costo * U() || S.obrasCost.length) return;
  const zt = S.comuna.id === 'cartagena' && i > 0;
  const lanzar = () => {
    S.caja -= n.costo * U();
    S.obrasCost.push({ tramo: i, nivel: nv, fin: S.mes + n.meses + (zt ? 2 : 0) });
    cerrarModal();
    toast(`🚧 Obras en la costanera: ${mapaDe().nombresCostanera[i]}${zt ? ' (con permiso del Consejo de Monumentos)' : ''}`, 'bien');
    finMes();
  };
  if (nv === 3) {
    votacion({ titulo: `🎡 Costanera turística en ${mapaDe().nombresCostanera[i]} (${fmt$(n.costo * U())})`, postura: { orden: 1, social: 1 }, autor: 'alcalde', votoAlcalde: true }, ok => {
      if (ok) return lanzar();
      toast('🏛️ El concejo rechazó el proyecto de costanera', 'mal');
      finMes();
    });
  } else lanzar();
}

function danioCostanera() {
  const con = S.costanera.map((v, i) => [v, i]).filter(([v]) => v > 0);
  if (!con.length) return;
  const [, i] = pick(con);
  S.costanera[i]--;
  toast(`🌊 La marejada dañó la costanera de ${mapaDe().nombresCostanera[i]}`, 'mal');
}

// ------------------------------------------------------------
//  Grandes marcas
// ------------------------------------------------------------
function requisitosMarca(b) {
  const sc = atractivo();
  const falta = [];
  if (sc < b.umbral) falta.push(`atractivo ${Math.round(sc)}/${b.umbral}`);
  if (b.seg && S.m.s < b.seg) falta.push(`🛡️ seguridad ${b.seg}`);
  if (b.costanera && !S.costanera.some(v => v >= b.costanera)) falta.push(S.costanera.length ? `🌊 costanera nivel ${b.costanera}` : 'costanera (no hay mar)');
  return falta;
}

function htmlMarcas() {
  const puede = S.fase === 'accion';
  const sc = atractivo();
  return `
    <h3>🏬 Grandes marcas</h3>
    <p class="sub">Atractivo comercial de ${S.comuna.nombre}: <b>${Math.round(sc)}</b>. Súbelo con seguridad, empleo, costanera y otras marcas.</p>
    <div class="lista-obras">
      ${MARCAS.map(b => {
        const st = S.marcas[b.id] || {};
        const falta = requisitosMarca(b);
        let estado = '', boton = '';
        if (st.estado === 'ya') estado = '<span class="verde">Ya está en la comuna</span>';
        else if (st.estado === 'instalada') estado = `<span class="verde">✅ Abrió en ${terreno(st.terreno).n}</span>`;
        else if (st.estado === 'construyendo') estado = `🚧 Abre en ${st.fin - S.mes}m`;
        else if (st.estado === 'interesada') boton = `<button class="btn-chico si" onclick="abrirSelector('marca','${b.id}')">📍 Ofrecer local</button>`;
        else {
          const espera = st.estado === 'rechazo' && S.mes - st.mes < 6;
          estado = falta.length ? `<span class="rojo">Falta: ${falta.join(' · ')}</span>` : '<span class="verde">¡Cumples los requisitos!</span>';
          boton = `<button class="btn-chico" ${puede && !espera && S.caja >= 0.3 * U() ? '' : 'disabled'} onclick="invitarMarca('${b.id}')">📞 Invitar<small>${espera ? 'espera' : fmt$(0.3 * U())}</small></button>`;
        }
        return `
        <div class="solicitud">
          <span class="obra-e">${b.e}</span>
          <span class="obra-info"><b>${b.n}</b><small>${b.rubro} · local ${b.tam} · +${fmt$(b.patente * U() * 12)}/año</small><small>${estado}</small></span>
          ${boton}
        </div>`;
      }).join('')}
    </div>`;
}

function invitarMarca(id) {
  const b = marca(id);
  if (S.caja < 0.3 * U() || S.fase !== 'accion') return;
  S.caja -= 0.3 * U();
  cerrarModal();
  const falta = requisitosMarca(b);
  if (!falta.length) {
    S.marcas[id] = { estado: 'interesada' };
    toast(`${b.e} ¡${b.n} acepta! Ofrécele un local desde Economía`, 'bien');
  } else {
    S.marcas[id] = { estado: 'rechazo', mes: S.mes };
    toast(`${b.e} ${b.n}: "Todavía no. Nos falta ${falta[0]}."`, 'mal');
  }
  finMes();
}

function instalarMarca(b, t, concesion) {
  t.uso = { tipo: 'marca', id: b.id };
  if (concesion) t.concesion = t.precio / 15;
  else t.dueno = 'privado';
  S.marcas[b.id] = { estado: 'construyendo', fin: S.mes + 2, terreno: t.id };
  cerrarModal();
  _picker = null;
  toast(`${b.e} ${b.n} empezó a construir en ${t.n}`, 'bien');
  renderJuego();
}

// Revisa cada mes obras de costanera y marcas en construcción
function avanzarTerritorio() {
  S.obrasCost = S.obrasCost.filter(x => {
    if (S.mes < x.fin) return true;
    const n = NIVELES_COSTANERA[x.nivel];
    S.costanera[x.tramo] = x.nivel;
    aplicar(n.fx);
    if (n.ingreso) S.ingresoBonus += n.ingreso;
    if (x.nivel >= 2) S.flags.costanera_ok = true;
    Sonido.fanfarria();
    toast(`🌊 ¡Inauguraste la costanera de ${mapaDe().nombresCostanera[x.tramo]}: ${n.n}!`);
    return false;
  });
  Object.entries(S.marcas).forEach(([id, m]) => {
    if (m.estado !== 'construyendo' || S.mes < m.fin) return;
    const b = marca(id);
    const t = terreno(m.terreno);
    m.estado = 'instalada';
    aplicar(b.fx);
    const sec = S.sectores.find(s => s.n === t.sector);
    if (sec) sec.animo = clamp(sec.animo + 6);
    Sonido.fanfarria();
    toast(`${b.e} ¡Abrió ${b.n} en ${t.sector}! Llegan empleos y patentes`);
    if (b.almaceneros) S.cola.push({ id: 'almaceneros_marca', mes: S.mes + 2, sector: t.sector });
  });
}

// Una marca llama por su cuenta cuando la comuna se vuelve atractiva
function marcaLlama() {
  const cand = MARCAS.filter(b => !S.marcas[b.id] && !requisitosMarca(b).length);
  if (!cand.length) return null;
  const b = cand[0];
  return {
    id: b.id, tipo: 'marca', q: b.e, quien: b.n, sector: S.sectores[0].n,
    t: `Queremos abrir un ${b.rubro.toLowerCase()} en ${S.comuna.nombre}. ¿Nos dan las facilidades?`,
    o: [{ t: '¡Bienvenidos!', fx: { a: 1, e: 1 } }, { t: 'Cuidemos el comercio local', fx: { a: -1 } }],
  };
}

function resolverMarcaLlama(ev, i) {
  const b = marca(ev.id);
  if (i === 0) {
    S.marcas[b.id] = { estado: 'interesada' };
    aplicar({ a: 1, e: 1 });
    toast(`${b.e} Ofrécele un local a ${b.n} desde 💼 Economía`, 'bien');
  } else {
    S.marcas[b.id] = { estado: 'rechazo', mes: S.mes };
    aplicar({ a: -1 });
  }
  S.fase = 'accion';
  renderJuego();
}
