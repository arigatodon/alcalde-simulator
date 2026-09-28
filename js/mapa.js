'use strict';

// ============================================================
//  MAPA esquemático de la comuna: sectores, obras y negocios
// ============================================================

const colorAnimo = v => (v >= 60 ? '#22c55e' : v >= 40 ? '#facc15' : '#ef4444');

// Posición de un sector: viene de js/mapas.js (OpenStreetMap). Si falta, se reparte en círculo.
function posSector(i) {
  const m = typeof MAPAS !== 'undefined' && MAPAS[S.comuna.id];
  const p = m && m.sectores[S.sectores[i].n];
  if (p) return { x: p[0], y: p[1] };
  const ang = (i / S.sectores.length) * Math.PI * 2;
  return { x: 50 + Math.cos(ang) * 30, y: 34 + Math.sin(ang) * 22 };
}

// Elige dónde poner cada etiqueta (abajo, arriba, derecha, izquierda) para que no se tapen
function ubicarEtiquetas(pos) {
  const R = 3.6, H = 2.8;
  const cajas = pos.map(p => ({ x0: p.x - R, x1: p.x + R, y0: p.y - R, y1: p.y + R }));
  const choque = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return pos.map((p, i) => {
    const w = S.sectores[i].n.length * 1.5;
    const opciones = [
      { dx: 0, dy: 6.9, anchor: 'middle', box: { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y + 4.4, y1: p.y + 4.4 + H } },
      { dx: 0, dy: -4.6, anchor: 'middle', box: { x0: p.x - w / 2, x1: p.x + w / 2, y0: p.y - 4.6 - H + 0.6, y1: p.y - 4.0 } },
      { dx: 4.4, dy: 0.9, anchor: 'start', box: { x0: p.x + 4.2, x1: p.x + 4.2 + w, y0: p.y - H / 2, y1: p.y + H / 2 } },
      { dx: -4.4, dy: 0.9, anchor: 'end', box: { x0: p.x - 4.2 - w, x1: p.x - 4.2, y0: p.y - H / 2, y1: p.y + H / 2 } },
    ];
    let mejor = opciones[0], min = Infinity;
    for (const o of opciones) {
      const fuera = o.box.x0 < 1 || o.box.x1 > 99 ? 20 : 0;
      const c = cajas.reduce((t, b, j) => t + (j === i ? 0 : choque(o.box, b)), 0) + fuera;
      if (c < min - 0.01) { min = c; mejor = o; }
    }
    cajas.push(mejor.box);
    return mejor;
  });
}

const puntosDe = d => (d.match(/-?[\d.]+ -?[\d.]+/g) || []).map(t => t.split(' ').map(Number));

// Capa de territorio: equipamiento existente, costanera, terrenos, obras y marcas
function capaTerritorio(m, sel) {
  const eqs = m.equip || [];
  const enObra = new Set(S.obras.filter(o => o.lugar && o.lugar.tipo === 'equip').map(o => o.lugar.idx));
  const equip = eqs.map((q, i) => {
    const mej = (S.mejoras[i] || []).map(id => obra(id).e).join('');
    return `<g class="m-eq ${sel ? 'tenue' : ''}" transform="translate(${q.x} ${q.y})"><title>${q.n}</title>
      <text class="m-eq-i" y="1">${ICONO_EQUIP[q.t] || '📍'}</text>
      ${mej ? `<text class="m-eq-mej" x="2.2" y="-1.2">${mej}</text>` : ''}${enObra.has(i) ? '<text class="m-eq-mej" x="2.2" y="-1.2">🚧</text>' : ''}</g>`;
  }).join('');

  const nombres = m.nombresCostanera || [];
  const costanera = (m.costanera || []).map((d, i) => {
    const nv = S.costanera[i] || 0;
    const curso = S.obrasCost.some(x => x.tramo === i);
    const pts = puntosDe(d);
    const mid = pts[Math.floor(pts.length / 2)] || [0, 0];
    const ico = curso ? '🚧' : nv > 0 ? NIVELES_COSTANERA[nv].e : '';
    return `<path class="m-cost n${nv} ${curso ? 'curso' : ''}" d="${d}"><title>Costanera ${nombres[i] || ''}: ${NIVELES_COSTANERA[nv].n}</title></path>
      ${ico ? `<text class="m-cost-i" x="${mid[0] - 7}" y="${mid[1] + 1}">${ico}</text>` : ''}`;
  }).join('');

  const terrenos = S.terrenos.map(t => {
    if (t.uso) {
      const esMarca = t.uso.tipo === 'marca';
      const e = esMarca ? marca(t.uso.id).e : obra(t.uso.id).e;
      const listo = esMarca ? S.marcas[t.uso.id].estado === 'instalada'
        : S.construidas.some(c => c.lugar && c.lugar.id === t.id);
      const nombre = esMarca ? marca(t.uso.id).n : obra(t.uso.id).n;
      return `<g class="m-lote-uso ${sel ? 'tenue' : ''}" transform="translate(${t.x} ${t.y})"><title>${nombre} · ${t.n}</title>
        <rect x="-2.3" y="-2.3" width="4.6" height="4.6" rx="1.2" class="${esMarca ? 'm-marca' : 'm-obra'}"/>
        <text class="m-lote-i" y="1.1">${listo ? e : '🚧'}</text>
        ${esMarca && listo ? `<text class="m-marca-n" y="4.6">${nombre}</text>` : ''}</g>`;
    }
    if (sel) return '';
    return `<circle class="m-lote ${t.dueno}" cx="${t.x}" cy="${t.y}" r="0.8"><title>${t.n} (${t.dueno}, ${t.tam})</title></circle>`;
  }).join('');

  let opciones = '';
  if (sel) {
    opciones = sel.opciones.map((l, i) => {
      const act = i === sel.sel;
      if (l.tipo === 'equip') {
        return `<g class="m-opt" onclick="elegirLugar(${i})" transform="translate(${l.x} ${l.y})">
          <circle r="${act ? 3.4 : 2.6}" class="m-opt-eq ${act ? 'act' : ''}"/><text class="m-eq-i" y="1">${ICONO_EQUIP[eqs[l.idx].t] || '📍'}</text></g>`;
      }
      const t = terreno(l.id);
      const r = act ? 3 : 2.2;
      return `<g class="m-opt" onclick="elegirLugar(${i})" transform="translate(${t.x} ${t.y})">
        <rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="0.8" class="m-opt-t ${t.dueno} ${act ? 'act' : ''}"/>
        <text class="m-opt-l" y="0.9">${t.tam[0].toUpperCase()}</text></g>`;
    }).join('');
  }
  return { equip, costanera, terrenos, opciones };
}

function mapaSVG(sel) {
  const c = S.comuna;
  const m = mapaDe() || { alto: 68, tierra: [], mar: [], islas: [], rios: [], rutas: [] };
  const mA = S.mes % 12;
  const verano = [11, 0, 1, 2].includes(mA);
  const invierno = [5, 6, 7].includes(mA);

  const capas = `
    ${m.tierra.map(d => `<path class="m-tierra" d="${d}"/>`).join('')}
    ${m.mar.map(d => `<path class="m-mar" d="${d}"/>`).join('')}
    ${m.islas.map(d => `<path class="m-isla" d="${d}"/>`).join('')}
    ${m.rios.map(d => `<path class="m-rio" d="${d}"/>`).join('')}
    ${m.rutas.map(d => `<path class="m-ruta" d="${d}"/>`).join('')}`;
  const ter = capaTerritorio(m, sel);

  const pos = S.sectores.map((_, i) => posSector(i));
  const etiquetas = ubicarEtiquetas(pos);
  const sectores = S.sectores.map((s, i) => {
    const { x, y } = pos[i];
    const et = etiquetas[i];
    const deSector = o => !o.lugar || o.lugar.tipo === 'sector';
    const obras = S.construidas.filter(o => o.sector === s.n && deSector(o)).map(o => obra(o.id).e);
    const curso = S.obras.filter(o => o.sector === s.n && deSector(o)).length;
    const neg = S.negocios.filter(n => n.sector === s.n).length;
    const iconos = [...obras.slice(0, 3), ...(obras.length > 3 ? ['+'] : []), ...(curso ? ['🚧'] : [])].join('');
    return `
    <g class="m-sec ${sel ? 'tenue' : ''}" ${sel ? '' : `onclick="verSector(${i})"`} transform="translate(${x} ${y})">
      <circle r="3.6" fill="${colorAnimo(s.animo)}" class="m-circ"/>
      <text class="m-cara" y="1.3">${cara(s.animo)}</text>
      ${iconos ? `<text class="m-obras" y="${et.dy < 0 ? 7.2 : -4.8}">${iconos}</text>` : ''}
      ${neg ? `<g transform="translate(3.6 -2.8)"><circle r="2" class="m-neg"/><text class="m-negn" y="0.9">${neg}</text></g>` : ''}
      <text class="m-lbl" x="${et.dx}" y="${et.dy}" text-anchor="${et.anchor}">${s.n}</text>
    </g>`;
  }).join('');

  return `
  <div class="mapa ${verano ? 'verano' : invierno ? 'invierno' : ''}">
    <svg viewBox="0 0 100 ${m.alto}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Mapa de ${c.nombre}">
      <rect class="m-vecino" x="0" y="0" width="100" height="${m.alto}"/>
      ${capas}
      ${ter.costanera}
      ${ter.equip}
      ${ter.terrenos}
      ${sectores}
      ${ter.opciones}
      <text class="m-clima" x="95" y="6">${verano ? '☀️' : invierno ? '🌧️' : '⛅'}</text>
      <text class="m-norte" x="95" y="${m.alto - 6}">N↑</text>
      <text class="m-osm" x="99" y="${m.alto - 1.2}">© OpenStreetMap</text>
    </svg>
  </div>`;
}

function verSector(i) {
  const s = S.sectores[i];
  const obras = S.construidas.filter(o => o.sector === s.n);
  const curso = S.obras.filter(o => o.sector === s.n);
  const neg = S.negocios.filter(n => n.sector === s.n);
  const marcasSec = Object.entries(S.marcas).filter(([, m]) => m.terreno && terreno(m.terreno).sector === s.n);
  const libres = S.terrenos.filter(t => t.sector === s.n && !t.uso);
  const puede = S.fase === 'accion';
  modal(`
    <div class="centro">
      <div class="big-emoji">${cara(s.animo)}</div>
      <h2>${s.n}</h2>
      <div class="barra ancha"><div style="width:${s.animo}%;background:${colorAnimo(s.animo)}"></div></div>
      <p class="sub">Ánimo de los vecinos: <b>${Math.round(s.animo)}</b></p>
      <h3>Obras</h3>
      <div class="cp-obras">${obras.length || curso.length ? [...obras.map(o => obra(o.id).e), ...curso.map(() => '🚧')].join(' ') : '<small>Ninguna todavía</small>'}</div>
      <h3>Negocios</h3>
      <div class="cp-obras">${neg.length ? neg.map(n => NEGOCIOS.find(x => x.id === n.t).e).join(' ') : '<small>Ninguno nuevo</small>'}</div>
      ${marcasSec.length ? `<h3>Grandes marcas</h3><div class="cp-obras">${marcasSec.map(([id]) => marca(id).e).join(' ')}</div>` : ''}
      <h3>Terrenos libres</h3>
      <div class="terrenos-sec">${libres.length ? libres.map(t => `<span class="chip">${t.dueno === 'municipal' ? '🟩' : '🟨'} ${t.n} · ${t.tam}</span>`).join('') : '<small>No quedan</small>'}</div>
      ${puede ? `<button class="btn grande" onclick="cerrarModal();irTerreno(${i})">🚶 Ir a terreno aquí</button>` : '<p class="sub">Primero responde la decisión del mes.</p>'}
    </div>`);
}
