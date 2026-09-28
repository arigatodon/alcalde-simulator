'use strict';

// ============================================================
//  CONCEJO MUNICIPAL: votaciones, propuestas y negociación
// ============================================================

function cambiarLealtad(v, filtro = () => true) {
  S.concejo.filter(filtro).forEach(c => { c.lealtad = clamp(c.lealtad + v); });
}

function estadoConcejal(c) {
  return c.lealtad >= 55 ? 'Aliado' : c.lealtad >= 35 ? 'Neutral' : 'Opositor';
}

// Probabilidad de que un concejal vote a favor
function probSi(c, cfg) {
  if (c.id === cfg.autor) return 1;
  const lean = (cfg.postura || {})[c.partido] || 0;
  const leal = (c.lealtad - 50) / 50;
  let p = 0.5 + lean * 0.25 + leal * 0.3 * (cfg.votoAlcalde ? 1 : -1);
  if (cfg.contra) p += c.lealtad < 40 ? 0.2 : -0.1;
  if (cfg.autorPartido && c.partido === cfg.autorPartido) p += 0.15;
  return clamp(p, 0.05, 0.95);
}

// Votos esperados a favor (para mostrar antes de proponer)
function apoyoEstimado(cfg) {
  return S.concejo.filter(c => probSi(c, cfg) >= 0.5).length + (cfg.votoAlcalde ? 1 : 0);
}

let _trasVoto = null;
// Sesión del concejo con animación de votos. cb(aprobado)
function votacion(cfg, cb) {
  const votos = S.concejo.map(c => Math.random() < probSi(c, cfg));
  const si = votos.filter(Boolean).length + (cfg.votoAlcalde ? 1 : 0);
  const total = S.concejo.length + 1;
  const aprobado = si > total / 2;
  _trasVoto = () => { cerrarModal(); cb(aprobado); };

  modal(`
    <div class="centro">
      <div class="paso-dark">🏛️ Sesión del Concejo</div>
      <h2 class="voto-tit">${cfg.titulo}</h2>
      <div class="votos">
        <div class="voto alcalde"><div class="v-av">🏅</div><div class="v-n">${S.nombre}</div><div class="v-r">${cfg.votoAlcalde ? '✅' : '❌'}</div></div>
        ${S.concejo.map((c, i) => `
          <div class="voto" style="--c:${partidoDe(c.partido).color}">
            <div class="v-av">${partidoDe(c.partido).e}</div>
            <div class="v-n">${c.nombre.split(' ')[0]}</div>
            <div class="v-r" id="vr${i}">❔</div>
          </div>`).join('')}
      </div>
      <div id="voto-res" class="voto-res"></div>
      <button class="btn grande" id="voto-btn" disabled onclick="_trasVoto()">Continuar</button>
    </div>`, false);

  votos.forEach((v, i) => {
    setTimeout(() => {
      const el = document.getElementById('vr' + i);
      if (!el) return;
      el.textContent = v ? '✅' : '❌';
      el.parentElement.classList.add(v ? 'si' : 'no');
      Sonido.voto(v);
    }, 350 + i * 320);
  });
  setTimeout(() => {
    const r = document.getElementById('voto-res');
    if (!r) return;
    r.innerHTML = `<b class="${aprobado ? 'verde' : 'rojo'}">${aprobado ? '✅ APROBADO' : '❌ RECHAZADO'}</b> · ${si} a favor, ${total - si} en contra`;
    if (aprobado) Sonido.bien(); else Sonido.mal();
    document.getElementById('voto-btn').disabled = false;
  }, 450 + votos.length * 320);
}

// ------------------------------------------------------------
//  Panel del concejo
// ------------------------------------------------------------
function modalConcejo() {
  const puede = S.fase === 'accion';
  const costo = 0.5 * U();
  const mayoria = S.concejo.filter(c => c.lealtad >= 55).length + 1 > (S.concejo.length + 1) / 2;
  modal(`
    <h2>🏛️ Concejo Municipal</h2>
    <p class="sub">${S.concejo.length} concejales + tú. ${mayoria ? '✅ Tienes mayoría' : '⚠️ Sin mayoría'} · Lealtad media ${Math.round(lealtadMedia())}</p>
    <div class="lista-concejo">
      ${S.concejo.map(c => `
        <div class="fila-concejal" style="--c:${partidoDe(c.partido).color}">
          <span class="fc-av">${partidoDe(c.partido).e}</span>
          <span class="fc-info">
            <b>${c.nombre}</b>
            <small>${partidoDe(c.partido).n} · ${cara(c.lealtad)} ${estadoConcejal(c)}</small>
            <div class="barra"><div style="width:${c.lealtad}%;background:${colorAnimo(c.lealtad)}"></div></div>
          </span>
          <button class="btn-chico" ${puede && S.caja >= costo ? '' : 'disabled'} onclick="negociar('${c.id}')">🤝 Negociar<small>${fmt$(costo)}</small></button>
        </div>`).join('')}
    </div>
    <button class="btn grande" ${puede ? '' : 'disabled'} onclick="modalPropuestas()">📜 Proponer una ordenanza</button>
    ${puede ? '' : '<p class="sub centro">Primero responde la decisión del mes.</p>'}
    <p class="nota-dark">Negociar = comprometer una obra en su sector. Proponer usa tu acción del mes.</p>`);
}

function negociar(id) {
  const c = S.concejo.find(x => x.id === id);
  const costo = 0.5 * U();
  if (!c || S.caja < costo || S.fase !== 'accion') return;
  S.caja -= costo;
  c.lealtad = clamp(c.lealtad + 15);
  cerrarModal();
  toast(`🤝 ${c.nombre} ahora te apoya más (${estadoConcejal(c)})`, 'bien');
  finMes();
}

const propuestasDisponibles = () => PROPUESTAS.filter(p => (!p.costa || S.comuna.costa) &&
  (S.propUsadas[p.id] === undefined || S.mes - S.propUsadas[p.id] >= 12));

function modalPropuestas() {
  const total = S.concejo.length + 1;
  const lista = propuestasDisponibles();
  modal(`
    <h2>📜 Proponer al concejo</h2>
    <p class="sub">Necesitas ${Math.floor(total / 2) + 1} de ${total} votos. El apoyo estimado depende de los partidos y la lealtad.</p>
    <div class="lista-obras">
      ${lista.map(p => {
        const est = apoyoEstimado({ postura: p.postura, votoAlcalde: true, autor: 'alcalde' });
        const ok = est > total / 2;
        return `
        <button class="obra" onclick="proponer('${p.id}')">
          <span class="obra-e">${p.e}</span>
          <span class="obra-info"><b>${p.n}</b><span class="chips">${chips(p.fx)}</span></span>
          <span class="obra-estado ${ok ? 'verde' : 'rojo'}">🗳️ ${est}/${total}</span>
        </button>`;
      }).join('') || '<p>Ya propusiste todo este año.</p>'}
    </div>
    <button class="btn sec" onclick="modalConcejo()">← Volver</button>`);
}

function proponer(id) {
  const p = PROPUESTAS.find(x => x.id === id);
  S.propUsadas[id] = S.mes;
  votacion({ titulo: `${p.e} ${p.n}`, postura: p.postura, autor: 'alcalde', votoAlcalde: true }, ok => {
    ultimoCambio = {};
    if (ok) {
      aplicar(p.fx);
      if (p.flag) S.flags[p.flag] = true;
      toast(`📜 Se aprobó: ${p.n}`, 'bien');
    } else {
      aplicar({ a: -1 });
      toast('El concejo rechazó tu propuesta', 'mal');
    }
    finMes();
  });
}

// ------------------------------------------------------------
//  Propuestas de los concejales (aparecen como decisión del mes)
// ------------------------------------------------------------
function propuestaConcejal() {
  if (!S.concejo.length) return null;
  const pool = PROPUESTAS_CONCEJAL.filter(p => S.usados['cp_' + p.id] === undefined || S.mes - S.usados['cp_' + p.id] >= 14);
  if (!pool.length) return null;
  const prop = pick(pool);
  const autor = prop.contra ? [...S.concejo].sort((a, b) => a.lealtad - b.lealtad)[0] : pick(S.concejo);
  S.usados['cp_' + prop.id] = S.mes;
  const sector = pick(S.sectores).n;
  const pa = partidoDe(autor.partido);
  return {
    id: prop.id, tipo: 'cprop', autor: autor.id, q: pa.e, sector,
    quien: `Concejal ${autor.nombre} · ${pa.n}`,
    t: `Propone: ${prop.t.replace('{sector}', sector)}.`,
    o: [{ t: 'Votar a favor', fx: prop.fx, voto: true }, { t: 'Votar en contra', fx: {}, voto: true }],
  };
}

function resolverPropuestaConcejal(ev, i) {
  const prop = PROPUESTAS_CONCEJAL.find(p => p.id === ev.id);
  const autor = S.concejo.find(c => c.id === ev.autor);
  const apoyo = i === 0;
  if (autor) autor.lealtad = clamp(autor.lealtad + (apoyo ? 10 : -10));
  S.fase = 'votando';
  votacion({
    titulo: ev.t.replace('Propone: ', ''), postura: prop.postura, autor: ev.autor, votoAlcalde: apoyo,
    contra: prop.contra, autorPartido: autor && autor.partido,
  }, ok => {
    ultimoCambio = {};
    if (ok) {
      aplicar(prop.fx, null, ev.sector);
      toast(apoyo ? '📜 Se aprobó con tu apoyo' : '📜 Se aprobó aunque votaste en contra', apoyo ? 'bien' : 'mal');
    } else {
      toast(apoyo ? 'Se rechazó aunque la apoyaste' : '📜 Rechazada, como querías', apoyo ? 'mal' : 'bien');
    }
    S.fase = 'accion';
    if (chequearDerrota()) return;
    renderJuego();
  });
}
