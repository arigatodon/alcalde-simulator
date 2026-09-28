// ============================================================
//  CONTENIDO DEL JUEGO
//
//  Efectos (fx):  a = aprobación, s = seguridad, b = bienestar, e = empleo
//                 c = concejo (lealtad de todos los concejales)
//                 p = tu partido (si eres independiente, cuenta como concejo)
//                 $ = plata, en "meses de caja libre" de la comuna
//                     (así un evento cuesta proporcional en cada comuna)
//
//  Campos opcionales de un evento:
//    meses: [0..11] sólo en esos meses (0 = enero) · via · partido · comuna
//    flag · desde (mes mínimo) · repite (meses para volver a salir)
//    tag: 'fuego' (bomberos equipados reducen el daño)
//  Campos opcionales de una opción:
//    r: { p, fx, t } riesgo 🎲 · sched: { id, en } consecuencia ⏳
//    flag · ingreso · efecto · ok
// ============================================================

const PARTIDOS = [
  { id: 'orden', n: 'Alianza del Orden', e: '🔵', color: '#2563eb', pide: 'Mano dura y favores a empresarios' },
  { id: 'social', n: 'Frente Social', e: '🔴', color: '#dc2626', pide: 'Pegas para sus militantes' },
  { id: 'verde', n: 'Movimiento Verde', e: '🟢', color: '#16a34a', pide: 'Frenar inmobiliarias a toda costa' },
];
const IND = { id: 'ind', n: 'Independiente', e: '🟣', color: '#9333ea' };
const partidoDe = id => PARTIDOS.find(p => p.id === id) || IND;

const NOMBRES = ['Marta', 'Juan', 'Rosa', 'Pedro', 'Carmen', 'Luis', 'Fernanda', 'Cristián', 'Javiera', 'Héctor', 'Paz', 'Víctor', 'Ignacia', 'Raúl', 'Beatriz', 'Felipe', 'Alejandra', 'Mauricio', 'Constanza', 'Sergio'];
const APELLIDOS = ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda', 'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres', 'Araya', 'Flores', 'Espinoza', 'Valenzuela'];

const PROMESAS = [
  { id: 'seguridad', e: '🛡️', n: 'Más seguridad', obras: ['luces', 'camaras', 'patrullaje'] },
  { id: 'salud', e: '🏥', n: 'Mejor salud', obras: ['cesfam', 'cecosf'], flag: 'farmacia' },
  { id: 'barrios', e: '🛣️', n: 'Barrios dignos', obras: ['calles', 'plaza', 'deporte', 'skate'] },
  { id: 'ambiente', e: '♻️', n: 'Comuna limpia', obras: ['reciclaje', 'agua'] },
  { id: 'turismo', e: '🌊', n: 'Turismo y empleo', obras: ['cultura', 'mercado'], flag: 'costanera_ok' },
  { id: 'vivienda', e: '🏘️', n: 'Vivienda digna', obras: ['vivienda'] },
];

// costo y mant(ención mensual) en meses de caja libre
// lugar: 'sector' = se hace en todo un sector · 'chico' | 'mediano' | 'grande' = necesita un terreno de ese tamaño
// usa: tipos de equipamiento existente donde también se puede hacer (más barato, usa lo que ya tiene el municipio)
const OBRAS = [
  { id: 'luces', n: 'Luminarias LED', e: '💡', costo: 4, meses: 2, fx: { s: 6, a: 3 }, mensual: { s: 0.3 }, lugar: 'sector' },
  { id: 'camaras', n: 'Cámaras y pórticos lectores', e: '📹', costo: 7, meses: 3, fx: { s: 10, a: 3 }, mensual: { s: 0.4 }, mant: 0.2, lugar: 'sector' },
  { id: 'patrullaje', n: 'Camionetas de patrullaje', e: '🚓', costo: 5, meses: 1, fx: { s: 8, a: 2, e: 1 }, mensual: { s: 0.4 }, mant: 0.3, lugar: 'sector' },
  { id: 'calles', n: 'Pavimentar calles', e: '🛣️', costo: 9, meses: 4, fx: { b: 6, a: 7, e: 2 }, lugar: 'sector' },
  { id: 'agua', n: 'Agua potable rural (APR)', e: '🚰', costo: 6, meses: 3, fx: { b: 8, a: 3 }, lugar: 'sector' },
  { id: 'cesfam', n: 'Ampliar CESFAM', e: '🏥', costo: 12, meses: 5, fx: { b: 12, a: 6, e: 2 }, mensual: { b: 0.3 }, mant: 0.3, lugar: 'mediano', usa: ['cesfam', 'hospital'] },
  { id: 'cecosf', n: 'Nuevo consultorio (CECOSF)', e: '⚕️', costo: 8, meses: 4, fx: { b: 8, a: 4, e: 1 }, mensual: { b: 0.2 }, mant: 0.25, lugar: 'mediano', usa: ['posta'] },
  { id: 'plaza', n: 'Plaza con juegos', e: '🛝', costo: 3, meses: 2, fx: { b: 5, a: 4 }, lugar: 'chico', usa: ['plaza'] },
  { id: 'deporte', n: 'Multicancha', e: '⚽', costo: 3, meses: 2, fx: { b: 4, a: 3, s: 2 }, lugar: 'chico' },
  { id: 'skate', n: 'Skatepark', e: '🛹', costo: 3, meses: 2, fx: { b: 3, a: 3, s: 1 }, lugar: 'chico' },
  { id: 'estadio', n: 'Recuperar estadio y gimnasio', e: '🏟️', costo: 5, meses: 3, fx: { b: 4, a: 4 }, lugar: 'grande', usa: ['estadio', 'gimnasio'] },
  { id: 'jardin', n: 'Sala cuna y jardín infantil', e: '🧸', costo: 5, meses: 3, fx: { b: 5, e: 3, a: 2 }, lugar: 'chico', usa: ['jardin'] },
  { id: 'biblioteca', n: 'Biblioteca y centro digital', e: '📚', costo: 4, meses: 3, fx: { b: 4, a: 2, e: 1 }, lugar: 'chico', usa: ['biblioteca'] },
  { id: 'reciclaje', n: 'Punto limpio', e: '♻️', costo: 3, meses: 2, fx: { b: 4, a: 2, e: 1 }, lugar: 'chico' },
  { id: 'cultura', n: 'Centro cultural', e: '🎭', costo: 7, meses: 4, fx: { b: 5, a: 3, e: 2 }, ingreso: 0.1, lugar: 'mediano', usa: ['cultura', 'museo'] },
  { id: 'vivienda', n: 'Oficina de Vivienda', e: '🏘️', costo: 4, meses: 2, fx: { b: 5, a: 3 }, lugar: 'chico', usa: ['municipio'] },
  { id: 'bomberos', n: 'Equipar Bomberos', e: '🚒', costo: 4, meses: 1, fx: { s: 4, b: 2 }, lugar: 'chico', usa: ['bomberos'] },
  { id: 'mercado', n: 'Mercado municipal', e: '🏬', costo: 8, meses: 4, fx: { e: 7, a: 3 }, ingreso: 0.15, lugar: 'grande', usa: ['mercado'] },
];
// Obras de este costo o más necesitan aprobación del concejo
const OBRA_GRANDE = 7;
const TAMANOS = ['chico', 'mediano', 'grande'];
const PRECIO_TERRENO = { chico: 1.5, mediano: 3, grande: 5.5 }; // en meses de caja libre
const ICONO_EQUIP = {
  municipio: '🏛️', hospital: '🏥', cesfam: '🏥', posta: '⚕️', escuela: '🏫', jardin: '🧸', biblioteca: '📚',
  bomberos: '🚒', carabineros: '🚓', mercado: '🧺', sede: '🏠', cultura: '🎭', estadio: '🏟️', gimnasio: '🏀',
  plaza: '🌳', museo: '🖼️', atractivo: '📍', super: '🛒', mall: '🏬', tienda: '🛍️',
};

// Niveles de cada tramo de costanera
const NIVELES_COSTANERA = [
  { n: 'Deteriorada' },
  { n: 'Veredas y luminarias', e: '💡', costo: 3, meses: 2, fx: { a: 2, b: 2, s: 1 } },
  { n: 'Paseo con ciclovía y miradores', e: '🚲', costo: 6, meses: 3, fx: { a: 3, b: 3, e: 2 }, ingreso: 0.05 },
  { n: 'Costanera turística: locales, anfiteatro y juegos', e: '🎡', costo: 10, meses: 5, fx: { a: 5, b: 2, e: 4 }, ingreso: 0.12 },
];

// Grandes marcas. Atractivo comercial = población + turismo + costanera + empleo + seguridad + otras marcas
// Marcas mencionadas sólo como referencia del juego; no hay relación con ellas.
const MARCAS = [
  { id: 'copec', n: 'Copec', e: '⛽', rubro: 'Bencinera', tam: 'mediano', umbral: 10, patente: 0.12, fx: { e: 2 } },
  { id: 'cruzverde', n: 'Cruz Verde', e: '💊', rubro: 'Farmacia', tam: 'chico', umbral: 12, patente: 0.1, fx: { e: 1, b: 1 } },
  { id: 'dunkin', n: "Dunkin'", e: '🍩', rubro: 'Cafetería', tam: 'chico', umbral: 15, seg: 45, patente: 0.1, fx: { e: 2, a: 2 } },
  { id: 'lider', n: 'Líder Express', e: '🛒', rubro: 'Supermercado', tam: 'mediano', umbral: 17, patente: 0.25, fx: { e: 4, a: 1 }, almaceneros: true },
  { id: 'mcdonalds', n: "McDonald's", e: '🍔', rubro: 'Comida rápida', tam: 'mediano', umbral: 19, seg: 45, patente: 0.18, fx: { e: 4, a: 2, b: -1 } },
  { id: 'starbucks', n: 'Starbucks', e: '☕', rubro: 'Cafetería', tam: 'chico', umbral: 24, seg: 55, costanera: 2, patente: 0.15, fx: { e: 2, a: 3 } },
  { id: 'sodimac', n: 'Sodimac', e: '🔨', rubro: 'Mejoramiento del hogar', tam: 'grande', umbral: 30, patente: 0.35, fx: { e: 6, a: 2 }, almaceneros: true },
  { id: 'cinemark', n: 'Cinemark', e: '🎬', rubro: 'Cine', tam: 'grande', umbral: 36, seg: 50, patente: 0.3, fx: { e: 3, a: 4, b: 2 } },
  { id: 'falabella', n: 'Falabella', e: '🛍️', rubro: 'Tienda por departamento', tam: 'grande', umbral: 42, seg: 55, patente: 0.5, fx: { e: 8, a: 5 }, almaceneros: true },
  { id: 'mallplaza', n: 'Mall Plaza', e: '🏬', rubro: 'Centro comercial', tam: 'grande', umbral: 55, seg: 55, patente: 0.9, fx: { e: 12, a: 4, b: -2 }, almaceneros: true },
];

const NOMBRES_TERRENO = {
  municipal: ['Terreno municipal', 'Sitio municipal eriazo', 'Ex bodega municipal', 'Paño municipal'],
  privado: ['Sitio eriazo particular', 'Galpón abandonado', 'Casona en venta', 'Ex fundo loteado', 'Terreno particular'],
};

// patente = ingreso mensual (en meses de caja libre)
const NEGOCIOS = [
  { id: 'minimarket', n: 'Minimarket', e: '🏪', patente: 0.04, fx: { e: 0.5 } },
  { id: 'restaurante', n: 'Restaurante', e: '🍽️', patente: 0.06, fx: { e: 1 } },
  { id: 'cafe', n: 'Cafetería', e: '☕', patente: 0.03, fx: { e: 0.5, b: 0.5 } },
  { id: 'botilleria', n: 'Botillería', e: '🍺', patente: 0.07, fx: { e: 0.5, s: -2 }, animo: -4 },
  { id: 'hostal', n: 'Hostal', e: '🏨', patente: 0.07, fx: { e: 1 }, turismo: true },
  { id: 'taller', n: 'Taller mecánico', e: '🔧', patente: 0.05, fx: { e: 1, b: -0.5 } },
  { id: 'pyme', n: 'Fábrica pyme', e: '🏭', patente: 0.12, fx: { e: 3, b: -1 }, grande: true },
  { id: 'super', n: 'Supermercado', e: '🛒', patente: 0.2, fx: { e: 4, a: -1 }, grande: true, animo: -2 },
];

// Capacitaciones (OMIL / SENCE)
const CURSOS = [
  { id: 'gastronomia', n: 'Gastronomía y turismo', e: '👩‍🍳', costo: 1, meses: 2, fx: { e: 3, b: 1 } },
  { id: 'oficios', n: 'Oficios: gasfitería y electricidad', e: '🔧', costo: 1.2, meses: 2, fx: { e: 4 } },
  { id: 'digital', n: 'Computación para adultos mayores', e: '💻', costo: 0.6, meses: 1, fx: { b: 3, a: 2 } },
  { id: 'mujeres', n: 'Emprendimiento para jefas de hogar', e: '🧵', costo: 0.8, meses: 2, fx: { e: 3, b: 2 } },
  { id: 'licencia', n: 'Licencia de conducir profesional', e: '🚛', costo: 1, meses: 2, fx: { e: 4 } },
  { id: 'guias', n: 'Guías turísticos y salvavidas', e: '🏄', costo: 0.8, meses: 1, fx: { e: 2, s: 1 } },
];

// Lo que TÚ puedes proponer al concejo. postura: cómo lo ve cada partido (-1 en contra, +1 a favor)
const PROPUESTAS = [
  { id: 'ambulantes', e: '📜', n: 'Ordenanza de comercio ambulante', fx: { s: 3, e: -1, a: 1 }, postura: { orden: 1, social: -1 } },
  { id: 'participativo', e: '🗳️', n: 'Presupuesto participativo', fx: { b: 3, a: 4, $: -1, c: -2 }, postura: { social: 1, verde: 1, orden: -1 } },
  { id: 'alcohol', e: '🍺', n: 'Restringir horario de alcohol', fx: { s: 4, e: -2, $: -0.3 }, postura: { orden: 1, verde: 1 } },
  { id: 'verde', e: '🌳', n: 'Ordenanza medioambiental', fx: { b: 4, e: -1 }, postura: { verde: 1, orden: -1 } },
  { id: 'aseo', e: '👵', n: 'Rebajar derechos de aseo a adultos mayores', fx: { a: 4, b: 2, $: -1.5 }, postura: { social: 1, ind: 1 } },
  { id: 'regulador', e: '🏢', n: 'Cambiar plan regulador: más edificios', fx: { e: 5, $: 2, b: -3 }, postura: { orden: 1, verde: -1, social: -1 } },
  { id: 'inspectores', e: '👮', n: 'Contratar inspectores municipales', fx: { s: 4, e: 1, $: -1.5 }, postura: { orden: 1, ind: 1 } },
  { id: 'patentes', e: '💼', n: 'Rebaja de patentes a emprendedores', fx: { e: 3, $: -1 }, postura: { orden: 1, social: 1 }, flag: 'rebaja_patentes' },
  { id: 'becas', e: '🎓', n: 'Becas municipales de educación', fx: { b: 3, a: 3, $: -1.2 }, postura: { social: 1, verde: 1 } },
  { id: 'playas', e: '🏖️', n: 'Ordenanza de playas y ruidos', fx: { b: 2, s: 2, e: -1 }, postura: { verde: 1, orden: 1 }, costa: true },
];

// Lo que proponen los concejales. contra: lo propone alguien de la oposición para complicarte
const PROPUESTAS_CONCEJAL = [
  { id: 'dieta', t: 'Subir la dieta (sueldo) de los concejales', fx: { a: -5, $: -0.5, c: 6 }, postura: { orden: 1, social: 1, verde: 1, ind: 1 } },
  { id: 'calle', t: 'Ponerle el nombre de su abuelo a una calle', fx: { a: -1 }, postura: {} },
  { id: 'juventud', t: 'Crear la Oficina de la Juventud', fx: { b: 2, a: 2, $: -0.8 }, postura: { social: 1, verde: 1 } },
  { id: 'fuegos', t: 'Prohibir fuegos artificiales en Año Nuevo', fx: { s: 2, a: -1, b: 1 }, postura: { verde: 1 } },
  { id: 'murales', t: 'Pintar murales en {sector}', fx: { b: 2, $: -0.4 }, postura: { social: 1, verde: 1 } },
  { id: 'mascotas', t: 'Ordenanza de tenencia responsable de mascotas', fx: { b: 2 }, postura: { verde: 1 } },
  { id: 'camaras_c', t: 'Más cámaras de televigilancia en {sector}', fx: { s: 3, $: -0.8 }, postura: { orden: 1 } },
  { id: 'feria_nav', t: 'Feria navideña de emprendedores en la plaza', fx: { e: 2, a: 2, s: -1 }, postura: { social: 1, orden: 1 } },
  { id: 'comision', t: 'Crear una comisión investigadora de tus contratos', fx: { a: -3 }, postura: {}, contra: true },
  { id: 'sueldo', t: 'Rebajar a la mitad el sueldo del alcalde', fx: { a: 3 }, postura: { ind: 1 }, contra: true },
  { id: 'director', t: 'Exigir la renuncia de tu director de obras', fx: { a: -1, c: 2 }, postura: {}, contra: true },
];

const RECLAMOS = [
  'La plaza no tiene luz y da miedo pasar de noche.',
  'El paradero no tiene techo. Nos mojamos esperando la micro.',
  'La vereda está rota. Mi mamá se cayó la semana pasada.',
  'El camión de la basura no pasa hace dos semanas.',
  'Los autos pasan volando frente al colegio.',
  'Necesitamos una sede para la junta de vecinos.',
  'En el consultorio no dan horas. Hay que ir a las 5 AM.',
  'Hay un sitio eriazo lleno de basura y ratones.',
  'Los perros callejeros atacan a los niños.',
  'Se corta el agua todos los fines de semana.',
  'Mi hijo terminó el liceo y no encuentra pega.',
  'Cerraron el almacén de la esquina. Ahora hay que caminar 20 cuadras.',
];

const EVENTOS = [
  // ---------- Generales ----------
  { id: 'hoyo', q: '👵', quien: 'Junta de Vecinos {sector}', t: 'Hay un hoyo enorme en la calle. Ya van dos autos con la rueda rota.',
    o: [{ t: 'Taparlo ya', fx: { $: -0.5, a: 3, b: 2 } }, { t: 'Cuando haya plata', fx: { a: -4 } }] },
  { id: 'perros', q: '🐕', quien: 'Agrupación animalista', t: 'Hay jaurías en la plaza. Piden un operativo de esterilización.',
    o: [{ t: 'Financiarlo', fx: { $: -0.6, b: 3, a: 2 } }, { t: 'No es prioridad', fx: { a: -3, b: -1 } }] },
  { id: 'accidente', q: '🚑', quien: 'SAMU', t: 'Accidente grave en una esquina sin semáforo en {sector}.', repite: 14,
    o: [{ t: 'Instalar semáforo', fx: { $: -1, s: 3, a: 3 } }, { t: 'Poner lomo de toro', fx: { $: -0.2, s: 1, a: -1 } }] },
  { id: 'robo_escuela', q: '🧑‍🏫', quien: 'Directora de escuela', t: 'Se robaron todos los computadores del colegio.',
    o: [{ t: 'Reponer + alarma', fx: { $: -1, b: 2, s: 2, a: 2 } }, { t: 'Que pague el seguro', fx: { a: -2, b: -2 } }] },
  { id: 'periodista', q: '📰', quien: 'Radio local', t: 'Quieren entrevistarte en vivo sobre la delincuencia.', repite: 12,
    o: [{ t: 'Dar la cara', fx: { a: 4 }, r: { p: 0.35, fx: { a: -9 }, t: 'Te pillaron sin datos. Quedaste mal.' } }, { t: 'No ir', fx: { a: -3 } }] },
  { id: 'viaje', q: '🏛️', quien: 'Concejales', t: 'Proponen un "viaje de capacitación" a Europa para el concejo.',
    o: [{ t: 'Aprobar', fx: { $: -1.2, c: 10, a: -7 } }, { t: 'Rechazar', fx: { c: -8, a: 4 } }] },
  { id: 'inmobiliaria', q: '🏗️', quien: 'Inmobiliaria', t: 'Quieren construir edificios junto al humedal. Pagarían buenas patentes.',
    o: [{ t: 'Aprobar', fx: { $: 2.5, b: -5, a: -3, e: 3 } }, { t: 'Proteger humedal', fx: { b: 3, a: 3 } }] },
  { id: 'balacera', q: '👮', quien: 'Carabineros', t: 'Hubo una balacera en {sector}. La gente tiene miedo.', repite: 10,
    o: [{ t: 'Mesa de seguridad', fx: { $: -0.3, s: 4, a: 2 } }, { t: 'Es tema de Carabineros', fx: { s: -4, a: -5 } }] },
  { id: 'microbasural', q: '🗑️', quien: 'Vecinos de {sector}', t: 'Se formó un microbasural gigante al lado de las casas.', repite: 12,
    o: [{ t: 'Limpiar y cercar', fx: { $: -0.5, b: 4, a: 1 } }, { t: 'Multar a quien bote', fx: { b: 1, a: -1 } }] },
  { id: 'bus_am', q: '👴', quien: 'Club de Adulto Mayor', t: 'Piden un bus municipal para paseos y trámites.',
    o: [{ t: 'Comprar bus', fx: { $: -1.5, b: 4, a: 5 } }, { t: 'Un paseo al año', fx: { $: -0.2, a: 1 } }] },
  { id: 'paro_salud', q: '🩺', quien: 'Funcionarios del CESFAM', t: 'Paro: faltan médicos y remedios.', repite: 16,
    o: [{ t: 'Contratar más', fx: { $: -1.5, b: 5, a: 2, e: 1 } }, { t: 'No hay plata', fx: { b: -5, a: -4 } }] },
  { id: 'farmacia', q: '💊', quien: 'Concejala', t: 'Propone abrir una Farmacia Popular municipal.',
    o: [{ t: 'Abrirla', fx: { $: -1, b: 5, a: 5 }, flag: 'farmacia' }, { t: 'No', fx: { a: -2, c: -2 } }] },
  { id: 'contraloria', q: '🧑‍⚖️', quien: 'Contraloría', t: 'Encontraron boletas sin respaldo en la Dirección de Tránsito.',
    o: [{ t: 'Sumario y transparencia', fx: { a: 2, c: -3 } }, { t: 'Minimizarlo', fx: { a: -1 }, r: { p: 0.45, fx: { a: -9 }, t: 'La prensa lo publicó. ¡Escándalo!' } }] },
  { id: 'reten', q: '👮', quien: 'Carabineros', t: 'Piden un terreno municipal para un nuevo retén.',
    o: [{ t: 'Ceder terreno', fx: { $: -0.5, s: 6, a: 2 } }, { t: 'No hay terreno', fx: { s: -2 } }] },
  { id: 'ciclovia', q: '🚴', quien: 'Jóvenes ciclistas', t: 'Piden una ciclovía en la avenida principal.',
    o: [{ t: 'Hacerla', fx: { $: -1.5, b: 4, a: 2 } }, { t: 'Quita estacionamientos', fx: { a: -1 } }] },
  { id: 'sismo', q: '🌎', quien: 'Oficina de Emergencia', t: 'Sismo fuerte. Hay daños en viviendas antiguas.', desde: 6,
    o: [{ t: 'Catastro y ayuda', fx: { $: -1.5, b: 2, a: 5 } }, { t: 'Esperar al Estado', fx: { b: -5, a: -5 } }] },
  { id: 'becas', q: '🧒', quien: 'Estudiantes', t: 'Piden becas de transporte para ir a estudiar a la universidad.',
    o: [{ t: 'Dar becas', fx: { $: -0.8, b: 3, a: 4 } }, { t: 'No alcanza', fx: { a: -3 } }] },
  { id: 'toma', q: '🏚️', quien: 'Dirección de Obras', t: 'Nueva toma de terrenos en {sector}: 200 familias.', repite: 18,
    o: [{ t: 'Dialogar y catastrar', fx: { $: -0.5, b: 2, a: 2 } }, { t: 'Pedir desalojo', fx: { s: 2, a: -5, b: -4 } }] },
  { id: 'viral', q: '📱', quien: 'Redes sociales', t: 'Un video tuyo bailando en la feria se volvió viral.',
    o: [{ t: 'Subir otro', fx: { a: 4 }, r: { p: 0.3, fx: { a: -6 }, t: 'Ahora te dicen "la autoridad TikTok".' } }, { t: 'Ignorarlo', fx: {} }] },
  { id: 'deuda', q: '📄', quien: 'Dirección de Finanzas', t: 'Hay facturas impagas de la administración anterior.',
    o: [{ t: 'Pagar todo', fx: { $: -2, c: 2 } }, { t: 'En cuotas', fx: { $: -0.5, c: -2, a: -1 } }] },
  { id: 'oscuro', q: '🔦', quien: 'Vecinos de {sector}', t: 'Las calles están oscuras. Nadie quiere salir de noche.', repite: 12,
    o: [{ t: 'Poner focos', fx: { $: -0.7, s: 4, a: 2 } }, { t: 'Más adelante', fx: { s: -2, a: -2 } }] },
  { id: 'feria', q: '🥕', quien: 'Feriantes', t: 'Quieren trasladar la feria libre a la calle principal.',
    o: [{ t: 'Aceptar', fx: { b: 2, a: 2, s: -1, e: 1 } }, { t: 'Que se quede donde está', fx: { a: -1 } }] },
  { id: 'drogas', q: '🚨', quien: 'Apoderados', t: 'Hay venta de drogas en la plaza frente a la escuela.', repite: 14,
    o: [{ t: 'Recuperar la plaza', fx: { $: -0.6, s: 5, a: 2 } }, { t: 'Evitar el tema', fx: { s: -5, a: -3 } }] },
  { id: 'sueldos', q: '👷', quien: 'Funcionarios municipales', t: 'Piden reajuste de sueldo o se van a paro.', repite: 12,
    o: [{ t: 'Reajustar', fx: { $: -2, a: 1 } }, { t: 'Ofrecer menos', fx: { $: -0.8 }, r: { p: 0.4, fx: { b: -4, a: -4 }, t: 'Paro de 5 días: nadie recogió la basura.' } }] },
  { id: 'gore', q: '🗺️', quien: 'Gobernador Regional', t: 'Visita la comuna. ¿Qué le pides?', repite: 12,
    o: [{ t: 'Plata para obras', fx: { $: 1.5, p: 1 } }, { t: 'Apoyo en seguridad', fx: { s: 4, p: 1 } }] },
  { id: 'colegio', q: '🏫', quien: 'Apoderados', t: 'El techo del gimnasio del liceo se llueve entero.',
    o: [{ t: 'Repararlo', fx: { $: -1, b: 3, a: 2 } }, { t: 'Ya lo verá el SLEP', fx: { a: -2, b: -1 } }] },

  // ---------- Economía y empleo ----------
  { id: 'cierre', q: '🏭', quien: 'Sindicato', t: 'La principal empresa de la comuna anuncia 150 despidos.', repite: 18,
    o: [{ t: 'Mesa de trabajo + OMIL', fx: { $: -0.6, e: -2, a: 3 } }, { t: 'Es un tema privado', fx: { e: -6, a: -4 } }] },
  { id: 'omil', q: '📋', quien: 'Oficina de Empleo (OMIL)', t: 'La OMIL está colapsada. Hay filas de cesantes todos los días.', repite: 14,
    o: [{ t: 'Reforzar la OMIL', fx: { $: -0.8, e: 4, a: 2 } }, { t: 'Que esperen', fx: { e: -2, a: -3 } }] },
  { id: 'almaceneros', q: '🏪', quien: 'Almaceneros', t: 'Los almacenes de barrio dicen que los ambulantes les quitan clientes.', repite: 14,
    o: [{ t: 'Fiscalizar ambulantes', fx: { e: 2, s: 1, a: -2 } }, { t: 'Crear una feria para todos', fx: { $: -0.5, e: 2, a: 2 } }] },
  { id: 'clandestino', q: '🚫', quien: 'Inspección municipal', t: 'Descubren 10 locales funcionando sin patente en {sector}.', repite: 12,
    o: [{ t: 'Clausurar', fx: { $: 0.5, e: -2, s: 2 } }, { t: 'Ayudarlos a regularizarse', fx: { $: 0.3, e: 2, a: 2 } }] },
  { id: 'feria_emp', q: '🎪', quien: 'Emprendedores locales', t: 'Piden un espacio fijo para vender sus productos.',
    o: [{ t: 'Darles un galpón', fx: { $: -0.8, e: 3, a: 2 }, flag: 'emprendedores' }, { t: 'No hay espacio', fx: { a: -2 } }] },

  // ---------- Por temporada ----------
  { id: 'basura_verano', q: '🗑️', quien: 'Departamento de Aseo', t: 'Con los turistas, la basura se acumula en las calles.', meses: [0, 1], repite: 10,
    o: [{ t: 'Turnos extra', fx: { $: -0.8, b: 4, a: 3, e: 1 } }, { t: 'Aguantar', fx: { b: -5, a: -4 } }] },
  { id: 'ambulantes', q: '🛍️', quien: 'Comerciantes ambulantes', t: 'Piden permiso para vender en la costanera este verano.', meses: [0, 1, 11], repite: 10, costa: true,
    o: [{ t: 'Dar permisos', fx: { $: 0.3, a: 2, s: -2, e: 2 } }, { t: 'Fiscalizar', fx: { s: 2, a: -3 } }] },
  { id: 'incendio', q: '🔥', quien: 'Bomberos', t: '¡Incendio forestal cerca de {sector}! Hay casas en riesgo.', meses: [0, 1, 2, 11], repite: 10, tag: 'fuego',
    o: [{ t: 'Evacuar y apoyar', fx: { $: -1.5, b: -2, a: 4 } }, { t: 'Esperar a CONAF', fx: { b: -8, a: -8 } }] },
  { id: 'festival', q: '🎸', quien: 'Productora', t: '¿Hacemos un festival de verano gratis?', meses: [0, 1], repite: 10,
    o: [{ t: '¡Festival!', fx: { $: -1.5, a: 7, s: -2, e: 1 }, r: { p: 0.25, fx: { s: -5, a: -6 }, t: 'Hubo peleas y heridos en el festival.' } }, { t: 'Muy caro', fx: { a: -1 } }] },
  { id: 'robos_auto', q: '🚗', quien: 'Veraneantes', t: 'Aumentan los robos de autos de turistas.', meses: [0, 1], repite: 10, costa: true,
    o: [{ t: 'Más patrullaje', fx: { $: -0.6, s: 4 } }, { t: 'Campaña preventiva', fx: { $: -0.1, s: 1 } }] },
  { id: 'sequia', q: '🚰', quien: 'Vecinos de {sector}', t: 'Hace una semana que no llega agua a los cerros.', meses: [0, 1, 2, 10, 11], repite: 10,
    o: [{ t: 'Camiones aljibe', fx: { $: -0.8, b: 4, a: 3 } }, { t: 'Reclamar a la sanitaria', fx: { a: 1, b: -3 } }] },
  { id: 'fin_temporada', q: '🏖️', quien: 'Trabajadores de temporada', t: 'Terminó el verano y cientos quedan sin trabajo.', meses: [2, 3], repite: 10, costa: true,
    o: [{ t: 'Programa de empleo invierno', fx: { $: -1, e: 4, a: 3 } }, { t: 'Así es cada año', fx: { e: -3, a: -2 } }] },
  { id: 'marejada', q: '🌊', quien: 'Capitanía de Puerto', t: 'Marejadas anormales destrozaron parte de la costanera.', meses: [5, 6, 7], repite: 10, costa: true,
    o: [{ t: 'Reparar ya', fx: { $: -2, b: 2, a: 3 } }, { t: 'Pedir ayuda al Gobierno', fx: { a: -2, b: -3 }, sched: { id: 'ayuda', en: 2 }, efecto: 'danio_costanera' }] },
  { id: 'temporal', q: '🌧️', quien: 'Oficina de Emergencia', t: 'Temporal: casas inundadas en {sector}.', meses: [5, 6, 7], repite: 10,
    o: [{ t: 'Albergue y ayuda', fx: { $: -1, b: 2, a: 5 } }, { t: 'Sólo entregar kits', fx: { $: -0.3, a: -2, b: -2 } }] },
  { id: 'fondas', q: '🇨🇱', quien: 'Comité de fondas', t: '¡Fiestas Patrias! ¿Hacemos fonda municipal?', meses: [8], repite: 10,
    o: [{ t: '¡Fonda grande!', fx: { $: -1, a: 6, s: -2, e: 1 } }, { t: 'Algo sencillo', fx: { $: -0.2, a: 1 } }] },
  { id: 'navidad', q: '🎄', quien: 'Departamento Social', t: 'Navidad: ¿regalos para los niños de la comuna?', meses: [11], repite: 10,
    o: [{ t: '¡Sí, para todos!', fx: { $: -0.8, a: 5 } }, { t: 'Este año no', fx: { a: -4 } }] },

  // ---------- Partido político ----------
  { id: 'p_acto', q: '🎗️', quien: 'Tu partido', t: 'Quieren que vayas al acto de su candidato a diputado.', via: 'partido', repite: 12,
    o: [{ t: 'Ir al acto', fx: { p: 8, a: -3 } }, { t: 'Soy de todos los vecinos', fx: { p: -8, a: 3 } }] },
  { id: 'p_voto', q: '🎗️', quien: 'Tu partido', t: 'Te ordenan que tus concejales voten contra un proyecto de la oposición, aunque sea bueno.', via: 'partido', repite: 12,
    o: [{ t: 'Obedecer', fx: { p: 6, b: -2, c: -3 } }, { t: 'Votar a favor', fx: { p: -8, b: 3, c: 4 } }] },
  { id: 'p_foto', q: '🎗️', quien: 'Tu partido', t: 'El Gobierno Regional ofrece fondos... si sale el partido en la foto.', via: 'partido', repite: 12,
    o: [{ t: 'Aceptar', fx: { $: 2, p: 4, a: -1 } }, { t: 'Sin foto', fx: { $: 1, p: -4 } }] },
  { id: 'p_campana', q: '🎗️', quien: 'Tu partido', t: 'Piden funcionarios municipales para hacer campaña en horario laboral.', via: 'partido', repite: 12,
    o: [{ t: 'Mandarlos', fx: { p: 8, a: -2 }, r: { p: 0.35, fx: { a: -7 }, t: 'Contraloría los pilló. Sumario.' } }, { t: 'Eso es ilegal', fx: { p: -8, a: 2 } }] },
  { id: 'p_militantes', q: '🔴', quien: 'Frente Social', t: 'Necesitamos que contrates a 5 compañeros en el municipio.', partido: 'social', repite: 10,
    o: [{ t: 'Contratarlos', fx: { $: -1, p: 10, a: -4 } }, { t: 'No', fx: { p: -10 } }] },
  { id: 'p_desalojo', q: '🔵', quien: 'Alianza del Orden', t: 'Exigen desalojar a los ambulantes con fuerza. Ya.', partido: 'orden', repite: 10,
    o: [{ t: 'Obedecer', fx: { p: 9, s: 2, a: -4, e: -2 } }, { t: 'Negarse', fx: { p: -10, a: 2 } }] },
  { id: 'p_empresa', q: '🔵', quien: 'Alianza del Orden', t: 'Un empresario amigo del partido quiere la concesión de la basura.', partido: 'orden', repite: 14,
    o: [{ t: 'Dársela', fx: { p: 9, $: -0.5, b: -2 } }, { t: 'Licitación abierta', fx: { p: -8, a: 2 } }] },
  { id: 'p_bolsas', q: '🟢', quien: 'Movimiento Verde', t: 'Exigen prohibir el plástico en todo el comercio, desde mañana.', partido: 'verde', repite: 12,
    o: [{ t: 'Prohibirlo', fx: { p: 9, b: 3, a: -3, e: -1 } }, { t: 'Paso a paso', fx: { p: -9, a: 1 } }] },
  { id: 'p_proyecto', q: '🟢', quien: 'Movimiento Verde', t: 'Quieren que frenes todas las construcciones nuevas de la comuna.', partido: 'verde', repite: 14,
    o: [{ t: 'Frenarlas', fx: { p: 9, e: -3, b: 2, a: -2 } }, { t: 'No puedo', fx: { p: -9 } }] },

  // ---------- Independiente ----------
  { id: 'i_bloqueo', q: '🏛️', quien: 'Concejo Municipal', t: 'Sin partido que te respalde, el concejo te pone trabas en todo.', via: 'independiente', repite: 10,
    o: [{ t: 'Negociar', fx: { $: -0.8, c: 10 } }, { t: 'Ir a la prensa', fx: { a: 3, c: -8 } }] },
  { id: 'i_cabildo', q: '🙋', quien: 'Vecinos organizados', t: 'Quieren armar cabildos barriales contigo cada mes.', via: 'independiente',
    o: [{ t: '¡Sí!', fx: { a: 4, b: 2, c: -2 } }, { t: 'Más adelante', fx: {} }] },
  { id: 'i_oferta', q: '🤝', quien: 'Un partido grande', t: 'Te ofrecen unirte. Tendrías apoyo... y obligaciones.', via: 'independiente', desde: 10,
    o: [{ t: 'Me uno', fx: { a: -4 }, efecto: 'unirse' }, { t: 'Sigo independiente', fx: { a: 3 } }] },

  // ---------- Deuda de campaña ----------
  { id: 'empresario', q: '💼', quien: 'Empresario que te financió', t: 'Te ayudé en la campaña... Ahora quiero la concesión de estacionamientos.', flag: 'donacion', desde: 3,
    o: [{ t: 'Dársela', fx: { $: 1, c: 2, a: -6 } }, { t: 'No le debo nada', fx: { c: -3, a: 1 }, r: { p: 0.4, fx: { a: -5 }, t: 'Filtró a la prensa que te financió. Polémica.' } }] },

  // ---------- Cartagena ----------
  { id: 'huidobro', q: '📚', quien: 'Fundación Vicente Huidobro', t: 'La casa y tumba del poeta necesitan restauración urgente.', comuna: 'cartagena',
    o: [{ t: 'Restaurar', fx: { $: -1.5, b: 2, a: 3, e: 1 }, ingreso: 0.05, ok: 'Más turistas visitan a Huidobro.' }, { t: 'Otra vez será', fx: { a: -1 } }] },
  { id: 'tren', q: '🚂', quien: 'Agrupación ferroviaria', t: 'Proponen revivir el tren turístico Santiago–Cartagena.', comuna: 'cartagena',
    o: [{ t: 'Apoyar el estudio', fx: { $: -0.5, a: 5, c: 2 } }, { t: 'Es un sueño', fx: { a: -2 } }] },
  { id: 'playa_grande', q: '🏊', quien: 'Playa Grande', t: 'La playa está repleta. Faltan baños y salvavidas.', comuna: 'cartagena', meses: [0, 1], repite: 10,
    o: [{ t: 'Contratar salvavidas', fx: { $: -0.8, s: 3, b: 3, a: 3, e: 1 } }, { t: 'Que se arreglen', fx: { a: -2 }, r: { p: 0.35, fx: { a: -8, s: -3 }, t: 'Un bañista se ahogó. Tragedia en la playa.' } }] },
  { id: 'laguna', q: '🦆', quien: 'Vecinos de la laguna', t: 'La laguna de Cartagena está contaminada y huele mal.', comuna: 'cartagena',
    o: [{ t: 'Plan de limpieza', fx: { $: -1, b: 4, a: 2 } }, { t: 'Después del verano', fx: { b: -3 } }] },
  { id: 'terrazas', q: '🏛️', quien: 'Patrimonio', t: 'Las antiguas terrazas y escaleras del borde costero se derrumban.', comuna: 'cartagena',
    o: [{ t: 'Recuperarlas', fx: { $: -2, a: 5, b: 2, e: 1 }, ingreso: 0.1 }, { t: 'Cinta de peligro', fx: { a: -2 } }] },
  { id: 'campamento', q: '🏚️', quien: 'Comité de vivienda', t: 'El campamento de {sector} pide luz y agua mientras esperan casas.', comuna: 'cartagena',
    o: [{ t: 'Conectarlos', fx: { $: -1, b: 5, a: 3 } }, { t: 'Es terreno ilegal', fx: { b: -3, a: -3 } }] },

  { id: 'agua_rural', q: '🚰', quien: 'Cooperativa de agua de Los Árates', t: 'Otra vez sin agua en Los Árates y Quillaicillo. Los camiones aljibe no dan abasto.', comuna: 'cartagena', repite: 12,
    o: [{ t: 'Comodato de terreno para pozos', fx: { $: -0.5, b: 5, a: 3 } }, { t: 'Más camiones aljibe', fx: { $: -1, b: 2, a: 1 } }] },
  { id: 'medicos', q: '🩺', quien: 'Dirección de Salud', t: 'Se nos van los médicos del CESFAM a otras comunas. Piden un bono mensual.', comuna: 'cartagena',
    o: [{ t: 'Aprobar el bono', fx: { $: -1.2, b: 5, a: 2 } }, { t: 'No hay presupuesto', fx: { b: -6, a: -3 } }] },
  { id: 'drones', q: '🎆', quien: 'Departamento de Eventos', t: 'Proponen gastar en un show de drones para el verano. Varios concejales dicen que hay necesidades más urgentes.', comuna: 'cartagena', meses: [10, 11, 0],
    o: [{ t: 'Show de drones', fx: { $: -1.5, a: 4, e: 1, c: -3 } }, { t: 'Usar la plata en lo social', fx: { b: 3, a: 1, c: 3 } }] },
  { id: 'camiones_tls', q: '🚛', quien: 'Vecinos de Av. Cartagena', t: 'Otro choque de camiones que van al terminal. Piden sacarlos de la avenida.', comuna: 'cartagena', repite: 14,
    o: [{ t: 'Restringir horario de camiones', fx: { s: 3, a: 3, e: -2 } }, { t: 'El puerto necesita la ruta', fx: { s: -2, a: -3, e: 1 } }] },
  { id: 'quebradas', q: '🏚️', quien: 'Vecinos de las quebradas', t: 'Casas sin alcantarillado, ratones y riesgo de derrumbe en las quebradas.', comuna: 'cartagena',
    o: [{ t: 'Postular a Quiero Mi Barrio', fx: { $: -0.5, b: 4, a: 3 }, sched: { id: 'quieromibarrio', en: 6 } }, { t: 'Operativo de desratización', fx: { $: -0.2, b: 1 } }] },
  { id: 'patentes_ss', q: '🏪', quien: 'Comerciantes de San Sebastián', t: 'Piden patentes a mitad de precio para reactivar el comercio del sector.', comuna: 'cartagena',
    o: [{ t: 'Aprobar rebaja', fx: { $: -0.4, e: 3, a: 2 }, flag: 'rebaja_patentes' }, { t: 'No', fx: { a: -1 } }] },
  { id: 'juegos_pc', q: '🎠', quien: 'Concesionarios de Playa Chica', t: 'Quieren instalar juegos mecánicos en Playa Chica todo el verano.', comuna: 'cartagena', meses: [10, 11],
    o: [{ t: 'Dar concesión', fx: { $: 0.6, a: 2, e: 2, s: -1 } }, { t: 'Afean la Zona Típica', fx: { b: 1, a: -1 } }] },
  { id: 'red_rural', q: '🌾', quien: 'Red Cartagena Rural', t: 'Kumentún, Cervecería 1 Minuto, Utopía y otros emprendimientos piden señalética y una ruta turística rural.', comuna: 'cartagena',
    o: [{ t: 'Crear la ruta rural', fx: { $: -0.6, e: 3, a: 2 }, ingreso: 0.04, flag: 'emprendedores' }, { t: 'Más adelante', fx: { a: -1 } }] },
  { id: 'lo_abarca_liceo', q: '🎒', quien: 'Apoderados de Lo Abarca', t: 'Los jóvenes tienen que viajar para la enseñanza media. Piden abrirla en la escuela de Lo Abarca.', comuna: 'cartagena',
    o: [{ t: 'Gestionar con el SLEP', fx: { $: -0.5, b: 4, a: 3 } }, { t: 'Bus gratis al liceo', fx: { $: -0.4, b: 2, a: 2 } }] },
  { id: 'suspiros', q: '🪜', quien: 'Patrimonio', t: 'La Escalera Los Suspiros está cerrada por peligro de derrumbe.', comuna: 'cartagena',
    o: [{ t: 'Restaurarla', fx: { $: -1, a: 3, b: 2 }, ingreso: 0.03 }, { t: 'Mantenerla cerrada', fx: { a: -2 } }] },
  { id: 'basura_trato', q: '🗑️', quien: 'Contraloría', t: 'Cuestionan el contrato de basura por trato directo. Piden licitar.', comuna: 'cartagena',
    o: [{ t: 'Licitar el servicio', fx: { $: -0.5, a: 2, c: -2 } }, { t: 'Renovar trato directo', fx: { a: -2 }, r: { p: 0.35, fx: { a: -6 }, t: 'La prensa habla de "contrato a dedo".' } }] },

  // ---------- Otras comunas ----------
  { id: 'camiones', q: '🚛', quien: 'Vecinos de Barrancas', t: 'Los camiones del puerto destruyen las calles y no dejan dormir.', comuna: 'sanantonio',
    o: [{ t: 'Exigir aporte al puerto', fx: { $: 2, c: -2, b: 2 } }, { t: 'El puerto da empleo', fx: { a: -3, e: 1 } }] },
  { id: 'megatoma', q: '🏚️', quien: 'Serviu', t: 'Proponen urbanizar parte de la megatoma en vez de desalojar.', comuna: 'sanantonio',
    o: [{ t: 'Apoyar', fx: { $: -1, b: 6, a: 3 } }, { t: 'Desalojo', fx: { s: 2, b: -6, a: -5 } }] },
  { id: 'neruda', q: '✒️', quien: 'Fundación Neruda', t: 'Proponen un festival de poesía en Isla Negra.', comuna: 'elquisco',
    o: [{ t: '¡Hagámoslo!', fx: { $: -1, a: 4, e: 1 }, ingreso: 0.05 }, { t: 'No', fx: { a: -1 } }] },
  { id: 'pinguinos', q: '🐧', quien: 'Biólogos marinos', t: 'Los turistas en kayak molestan a los pingüinos del islote.', comuna: 'algarrobo',
    o: [{ t: 'Regular los paseos', fx: { b: 3, e: -1, a: 1 } }, { t: 'El turismo manda', fx: { e: 2, b: -3 } }] },
  { id: 'ascensor', q: '🚡', quien: 'Vecinos del cerro', t: 'Otro ascensor histórico dejó de funcionar.', comuna: 'valparaiso',
    o: [{ t: 'Repararlo', fx: { $: -2, b: 3, a: 4 } }, { t: 'No hay presupuesto', fx: { a: -4, b: -2 } }] },
  { id: 'festival_vina', q: '🎤', quien: 'Canal de TV', t: 'Negociación del Festival de Viña: piden más aporte municipal.', comuna: 'vina', meses: [9, 10, 11], repite: 10,
    o: [{ t: 'Pagar más', fx: { $: -2, a: 4, e: 3 } }, { t: 'Negociar fuerte', fx: { a: -1 }, r: { p: 0.3, fx: { a: -6, e: -3 }, t: 'El canal amenaza con llevarse el festival.' } }] },
  { id: 'meiggs', q: '🛍️', quien: 'Comerciantes de Meiggs', t: 'El comercio ambulante copó las calles de Meiggs.', comuna: 'santiago', repite: 12,
    o: [{ t: 'Operativo con Carabineros', fx: { s: 4, e: -2, a: 1 } }, { t: 'Ordenar con permisos', fx: { $: 0.5, e: 2, s: -1 } }] },
  { id: 'marcha', q: '📣', quien: 'Comerciantes del centro', t: 'Otra marcha terminó con locales saqueados en la Alameda.', comuna: 'santiago', repite: 12,
    o: [{ t: 'Fondo de ayuda', fx: { $: -1, e: 2, a: 2 } }, { t: 'Culpar al Gobierno', fx: { a: -1, e: -2 } }] },
  { id: 'bajos_mena', q: '🏢', quien: 'Vecinos de Bajos de Mena', t: 'Los blocks tienen filtraciones y plagas. Piden demolición y nuevas casas.', comuna: 'puentealto',
    o: [{ t: 'Gestionar con el Minvu', fx: { $: -0.5, b: 4, a: 4, c: 2 } }, { t: 'No es municipal', fx: { a: -5, b: -2 } }] },
];

// Eventos que aparecen cuando algo está muy mal
const CRISIS = [
  { id: 'c_seg', q: '📢', quien: 'Marcha ciudadana', t: '"¡Queremos seguridad!" Cientos de vecinos protestan afuera del municipio.', cond: S => S.m.s < 25,
    o: [{ t: 'Recibirlos', fx: { a: 3, s: 2 } }, { t: 'No bajar', fx: { a: -6 } }] },
  { id: 'c_bien', q: '📉', quien: 'Estudio nacional', t: '{comuna} aparece entre las peores comunas para vivir.', cond: S => S.m.b < 25,
    o: [{ t: 'Plan social urgente', fx: { $: -2, b: 7, a: 2 } }, { t: 'El estudio está malo', fx: { a: -4 } }] },
  { id: 'c_emp', q: '📉', quien: 'INE', t: '{comuna} tiene una de las tasas de cesantía más altas de la región.', cond: S => S.m.e < 25,
    o: [{ t: 'Plan de empleo de emergencia', fx: { $: -2, e: 7, a: 2 } }, { t: 'Es culpa del país', fx: { a: -4 } }] },
  { id: 'c_caja', q: '💸', quien: 'Dirección de Finanzas', t: '¡Estamos en rojo! No alcanza para pagar a los proveedores.', cond: S => S.caja < 0,
    o: [{ t: 'Recortar programas', fx: { $: 2, b: -4, a: -3 } }, { t: 'Pedir adelanto del FCM', fx: { $: 2.5, c: -2 }, sched: { id: 'devolver', en: 6 } }] },
];

// Eventos que se programan desde otras decisiones
const ESPECIALES = {
  ayuda: { q: '🗺️', quien: 'Gobierno Regional', t: 'Llegó la ayuda por las marejadas.',
    o: [{ t: '¡Por fin!', fx: { $: 1.5, b: 2 } }] },
  promesa: { q: '👵', quien: 'Vecinos de {sector}', t: 'Nos prometiste arreglar el problema del barrio. ¿Y?',
    o: [{ t: 'Cumplir ahora', fx: { $: -0.8, a: 4, b: 2 } }, { t: 'Pedir paciencia', fx: { a: -7 } }] },
  devolver: { q: '📄', quien: 'SUBDERE', t: 'Se descuenta el adelanto del Fondo Común Municipal.',
    o: [{ t: 'Ni modo', fx: { $: -3 } }] },
  expulsion: { q: '🎗️', quien: 'Tu partido', t: 'El partido te quita su apoyo. Desde hoy eres independiente.',
    o: [{ t: 'Me las arreglo', fx: {}, efecto: 'expulsar' }] },
  quieromibarrio: { q: '🏘️', quien: 'Minvu', t: '¡Quiero Mi Barrio aprobado! Llegan fondos para las quebradas.',
    o: [{ t: '¡A trabajar!', fx: { $: 3, b: 5, a: 4 } }] },
  almaceneros_marca: { q: '🏪', quien: 'Almaceneros de {sector}', t: 'Desde que llegó la gran tienda, los almacenes de barrio venden la mitad.',
    o: [{ t: 'Fondo de apoyo al comercio local', fx: { $: -0.6, e: 1, a: 2 } }, { t: 'Es la libre competencia', fx: { a: -3, e: -1 } }] },
  rechazo: { q: '🏛️', quien: 'Concejo Municipal', t: 'El concejo rechazó tu modificación presupuestaria. Tienes que recortar.',
    o: [{ t: 'Ni modo', fx: { $: -2 }, efecto: 'reset_c' }] },
};
