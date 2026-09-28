'use strict';

// ============================================================
//  ECONOMÍA LOCAL: patentes, capacitaciones e inversión
// ============================================================

const negocio = id => NEGOCIOS.find(n => n.id === id);
const patentesMes = () => S.negocios.reduce((s, n) => s + negocio(n.t).patente, 0) * U();

function tipoNegocioAzar(grande = false) {
  const pool = NEGOCIOS.filter(n => !!n.grande === grande && (!n.turismo || S.comuna.turismo >= 0.3));
  return pick(pool).id;
}

// Cada mes llegan solicitudes de patente. Más empleo y capacitaciones = más emprendedores
function generarSolicitudes() {
  S.solicitudes = S.solicitudes.filter(sol => {
    if (S.mes - sol.mes < 4) return true;
    toast(`${negocio(sol.t).e} El ${negocio(sol.t).n.toLowerCase()} se instaló en otra comuna`, 'mal');
    return false;
  });
  const prob = 0.15 + S.emprendedores * 0.05 + (S.flags.rebaja_patentes ? 0.15 : 0) +
    (S.flags.emprendedores ? 0.08 : 0) + S.m.e / 800 + ([11, 0, 1].includes(S.mes % 12) ? S.comuna.turismo * 0.1 : 0);
  let n = (Math.random() < prob ? 1 : 0) + (Math.random() < prob * 0.25 ? 1 : 0) + S.bonoSolicitudes;
  S.bonoSolicitudes = 0;
  while (n-- > 0 && S.solicitudes.length < 4) {
    S.solicitudes.push({ t: tipoNegocioAzar(), sector: pick(S.sectores).n, mes: S.mes });
  }
}

function modalEconomia() {
  const puede = S.fase === 'accion';
  const u = U();
  modal(`
    <h2>💼 Economía local</h2>
    <div class="eco-kpis">
      <div><b>${Math.round(S.m.e)}</b><small>empleo</small></div>
      <div><b>${S.negocios.length}</b><small>negocios nuevos</small></div>
      <div><b>${fmt$((patentesMes() + balanceTerritorio()) * 12)}</b><small>patentes y arriendos / año</small></div>
    </div>

    <h3>📄 Solicitudes de patente <small>(gratis)</small></h3>
    ${S.solicitudes.length ? S.solicitudes.map((sol, i) => {
      const n = negocio(sol.t);
      return `
      <div class="solicitud">
        <span class="obra-e">${n.e}</span>
        <span class="obra-info"><b>${n.n}</b><small>en ${sol.sector} · +${fmt$(n.patente * u * 12)}/año · vence en ${4 - (S.mes - sol.mes)}m</small><span class="chips">${chips(n.fx)}</span></span>
        <span class="sol-btns">
          <button class="btn-chico si" onclick="aprobarPatente(${i})">✅</button>
          <button class="btn-chico no" onclick="rechazarPatente(${i})">❌</button>
        </span>
      </div>`;
    }).join('') : '<p class="sub">No hay solicitudes. Capacita vecinos o haz una feria para atraer emprendedores.</p>'}

    <h3>🛠️ Fomento productivo <small>(usa tu acción del mes)</small></h3>
    <div class="lista-obras">
      <button class="obra" ${puede ? '' : 'disabled'} onclick="modalCursos()">
        <span class="obra-e">🎓</span>
        <span class="obra-info"><b>Capacitaciones OMIL / SENCE</b><small>Cursos para vecinos: más empleo y emprendedores</small></span>
      </button>
      <button class="obra" ${puede && S.caja >= 0.5 * u ? '' : 'disabled'} onclick="feriaEmprendedores()">
        <span class="obra-e">🎪</span>
        <span class="obra-info"><b>Feria de emprendedores</b><small>${fmt$(0.5 * u)} · llegan nuevas solicitudes</small><span class="chips">${chips({ e: 2, a: 2 })}</span></span>
      </button>
      <button class="obra" ${puede && S.caja >= 1 * u ? '' : 'disabled'} onclick="atraerInversion()">
        <span class="obra-e">🤝</span>
        <span class="obra-info"><b>Atraer una gran empresa</b><small>${fmt$(1 * u)} · puede llegar una fábrica o supermercado</small><span class="chips"><span class="chip riesgo">🎲</span></span></span>
      </button>
    </div>
    ${htmlMarcas()}
    ${puede ? '' : '<p class="sub centro">Primero responde la decisión del mes.</p>'}`);
}

function aprobarPatente(i) {
  const sol = S.solicitudes.splice(i, 1)[0];
  if (!sol) return;
  const n = negocio(sol.t);
  const sec = S.sectores.find(s => s.n === sol.sector);
  ultimoCambio = {};
  S.negocios.push({ t: sol.t, sector: sol.sector });
  aplicar(n.fx);
  if (sec) sec.animo = clamp(sec.animo + (n.animo || 3));
  Sonido.moneda();
  toast(`${n.e} ¡Abrió un ${n.n.toLowerCase()} en ${sol.sector}!`);
  renderJuego();
  modalEconomia();
}

function rechazarPatente(i) {
  const sol = S.solicitudes.splice(i, 1)[0];
  if (!sol) return;
  Sonido.click();
  renderJuego();
  modalEconomia();
}

function modalCursos() {
  const u = U();
  const lista = CURSOS.filter(c => !S.cursosHechos.includes(c.id) && !S.cursos.some(x => x.id === c.id));
  modal(`
    <h2>🎓 Capacitaciones</h2>
    <p class="sub">La OMIL organiza cursos con SENCE. Los egresados consiguen trabajo o abren su negocio.</p>
    <div class="lista-obras">
      ${lista.map(c => `
        <button class="obra" ${S.caja >= c.costo * u ? '' : 'disabled'} onclick="iniciarCurso('${c.id}')">
          <span class="obra-e">${c.e}</span>
          <span class="obra-info"><b>${c.n}</b><small>${fmt$(c.costo * u)} · ${c.meses} ${c.meses === 1 ? 'mes' : 'meses'}</small><span class="chips">${chips(c.fx)}</span></span>
        </button>`).join('') || '<p>¡Ya hiciste todos los cursos!</p>'}
    </div>
    <button class="btn sec" onclick="modalEconomia()">← Volver</button>`);
}

function iniciarCurso(id) {
  const c = CURSOS.find(x => x.id === id);
  if (S.caja < c.costo * U()) return;
  S.caja -= c.costo * U();
  S.cursos.push({ id, fin: S.mes + c.meses });
  cerrarModal();
  toast(`${c.e} Comenzó el curso: ${c.n}`, 'bien');
  finMes();
}

function feriaEmprendedores() {
  if (S.caja < 0.5 * U()) return;
  S.caja -= 0.5 * U();
  ultimoCambio = {};
  aplicar({ e: 2, a: 2 });
  S.bonoSolicitudes += 2;
  cerrarModal();
  toast('🎪 ¡La feria se llenó! Llegarán nuevas solicitudes de patente', 'bien');
  finMes();
}

function atraerInversion() {
  if (S.caja < U()) return;
  S.caja -= U();
  cerrarModal();
  if (Math.random() < 0.4 + S.m.e / 300 + S.emprendedores * 0.03) {
    const t = tipoNegocioAzar(true);
    S.solicitudes.push({ t, sector: pick(S.sectores).n, mes: S.mes + 1 });
    toast(`🤝 ¡${negocio(t).n} quiere instalarse! Revisa las solicitudes`, 'bien');
  } else {
    toast('🤝 La empresa eligió otra comuna', 'mal');
  }
  finMes();
}
