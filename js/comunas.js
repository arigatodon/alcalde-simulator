// ============================================================
//  DATOS DE LAS COMUNAS
//  Población: Censo 2017. Presupuestos y porcentajes: APROXIMADOS
//  a partir de información pública (SINIM). Reemplázalos con tus datos.
//  Nombres de alcaldes y partidos: FICTICIOS.
//
//  presupuesto:  presupuesto municipal anual (millones de pesos, MM$)
//  ingresos:     % fcm = Fondo Común Municipal
//                  propios = permisos de circulación, patentes, contribuciones
//                  transferencias = Gobierno Regional, SUBDERE, ministerios
//  delincuencia: cuánto baja la seguridad cada mes si no haces nada
//  turismo:      ingreso extra en verano (en "meses de caja libre")
//  inicial:      seguridad, bienestar y empleo al empezar (0-100)
//  costa:        true = comuna costera (el mapa dibuja el mar)
//  sectores:     nombres reales de OpenStreetMap; su ubicación está en js/mapas.js
//                (se genera con: python3 herramientas/mapas.py)
//  politica.votos:      fuerza histórica de cada partido (%)
//  politica.incumbente: alcalde actual; con 3 periodos ya no puede repostular
// ============================================================
const COMUNAS = [
  {
    id: 'cartagena', nombre: 'Cartagena', region: 'Valparaíso', emoji: '🏖️',
    lema: 'Balneario popular del litoral central',
    lat: -33.553, lon: -71.606, costa: true,
    // Censo 2024 · ingresos municipales 2024 (SINIM): $26.754 MM, FCM $15.158 MM (57%)
    poblacion: 24599, presupuesto: 26754,
    ingresos: { fcm: 57, propios: 22, transferencias: 21 },
    pobreza: 28.4, delincuencia: 0.6, turismo: 0.7,
    inicial: { s: 40, b: 42, e: 36 },
    problemas: ['seguridad', 'vivienda', 'turismo'],
    sectores: [
      'Costa Azul', 'El Turco', 'Lo Abarca',
      'Centro', 'Playa Grande', 'Lo Zárate',
      'San Sebastián',
    ],
    historia: 'A comienzos del siglo XX el tren traía a miles de santiaguinos a sus playas y se volvió "la playa del pueblo". Aquí vivió y está enterrado el poeta Vicente Huidobro. Su borde costero es Zona Típica. Hoy vive del turismo de verano, tiene un mundo rural en Lo Abarca, Lo Zárate y El Turco, y depende mucho del Fondo Común Municipal.',
    datos: [
      '24.599 habitantes (Censo 2024); 20,6% tiene 65 años o más',
      'Pobreza multidimensional 28,4% (2022)',
      '1.579 empresas, 1.064 de ellas micro (2023)',
      'Borde costero declarado Zona Típica',
      'Agua escasa en sectores rurales como Los Árates y Quillaicillo',
      '87% de participación en las municipales 2024',
    ],
    politica: {
      votos: { social: 36, orden: 26, verde: 8, ind: 30 },
      incumbente: { nombre: 'Rodrigo Fuentes', partido: 'social', periodos: 2 },
      historial: [
        { anio: 2012, nombre: 'Hernán Ibarra', partido: 'orden' }, { anio: 2016, nombre: 'Hernán Ibarra', partido: 'orden' },
        { anio: 2021, nombre: 'Rodrigo Fuentes', partido: 'social' }, { anio: 2024, nombre: 'Rodrigo Fuentes', partido: 'social' },
      ],
    },
  },
  {
    id: 'sanantonio', nombre: 'San Antonio', region: 'Valparaíso', emoji: '⚓',
    lema: 'El puerto más grande de Chile',
    lat: -33.593, lon: -71.612, costa: true,
    poblacion: 91350, presupuesto: 60000,
    ingresos: { fcm: 40, propios: 40, transferencias: 20 },
    pobreza: 22, delincuencia: 0.7, turismo: 0.2,
    inicial: { s: 38, b: 45, e: 45 },
    problemas: ['vivienda', 'seguridad', 'barrios'],
    sectores: [
      'Barrancas', 'Centro', 'Cerro Alegre',
      'Llolleo', 'Tejas Verdes', 'Placilla',
    ],
    historia: 'Creció al ritmo del puerto, hoy el de mayor movimiento de carga del país. Miles de camiones cruzan la ciudad cada día. En sus cerros se levantó uno de los campamentos más grandes de Chile.',
    datos: ['Puerto con enorme flujo de camiones', 'Uno de los campamentos más grandes del país', 'Humedales de Llolleo'],
    politica: {
      votos: { orden: 34, social: 30, verde: 6, ind: 30 },
      incumbente: { nombre: 'Omar Vidal', partido: 'orden', periodos: 3 },
      historial: [
        { anio: 2012, nombre: 'Patricia Leiva', partido: 'orden' }, { anio: 2016, nombre: 'Omar Vidal', partido: 'orden' },
        { anio: 2021, nombre: 'Omar Vidal', partido: 'orden' }, { anio: 2024, nombre: 'Omar Vidal', partido: 'orden' },
      ],
    },
  },
  {
    id: 'elquisco', nombre: 'El Quisco', region: 'Valparaíso', emoji: '🌲',
    lema: 'Pinos, playas y segunda vivienda',
    lat: -33.397, lon: -71.694, costa: true,
    poblacion: 15955, presupuesto: 17000,
    ingresos: { fcm: 30, propios: 55, transferencias: 15 },
    pobreza: 15, delincuencia: 0.4, turismo: 0.9,
    inicial: { s: 55, b: 55, e: 44 },
    problemas: ['ambiente', 'turismo', 'salud'],
    sectores: [
      'Centro', 'Punta de Tralca',
      'Isla Negra', 'El Totoral',
    ],
    historia: 'Balneario de pinos y casas de veraneo. En Isla Negra está la casa museo de Pablo Neruda. Las contribuciones de las segundas viviendas son una parte importante de sus ingresos.',
    datos: ['Casa museo de Pablo Neruda en Isla Negra', 'Muchas casas de veraneo pagan contribuciones', 'Riesgo de incendios forestales'],
    politica: {
      votos: { orden: 40, social: 22, verde: 14, ind: 24 },
      incumbente: { nombre: 'Natalia Cortés', partido: 'orden', periodos: 1 },
      historial: [
        { anio: 2012, nombre: 'Julio Araya', partido: 'orden' }, { anio: 2016, nombre: 'Julio Araya', partido: 'orden' },
        { anio: 2021, nombre: 'Julio Araya', partido: 'orden' }, { anio: 2024, nombre: 'Natalia Cortés', partido: 'orden' },
      ],
    },
  },
  {
    id: 'algarrobo', nombre: 'Algarrobo', region: 'Valparaíso', emoji: '🐧',
    lema: 'Balneario de pingüinos y veleros',
    lat: -33.366, lon: -71.672, costa: true,
    poblacion: 13817, presupuesto: 15000,
    ingresos: { fcm: 32, propios: 53, transferencias: 15 },
    pobreza: 14, delincuencia: 0.4, turismo: 1.0,
    inicial: { s: 55, b: 52, e: 42 },
    problemas: ['ambiente', 'turismo', 'barrios'],
    sectores: [
      'Tunquén', 'Centro', 'San Alfonso del Mar',
      'Mirasol', 'El Yeco',
    ],
    historia: 'Tradicional balneario con club de yates y el islote Pájaro Niño, hogar de pingüinos de Humboldt. Los edificios de veraneo crecieron rápido y chocan con la protección de humedales.',
    datos: ['Islote Pájaro Niño con pingüinos de Humboldt', 'Presión inmobiliaria sobre humedales', 'Población flotante en verano'],
    politica: {
      votos: { orden: 42, social: 20, verde: 12, ind: 26 },
      incumbente: { nombre: 'Luis Carrasco', partido: 'orden', periodos: 3 },
      historial: [
        { anio: 2012, nombre: 'Sergio Carrasco', partido: 'orden' }, { anio: 2016, nombre: 'Luis Carrasco', partido: 'orden' },
        { anio: 2021, nombre: 'Luis Carrasco', partido: 'orden' }, { anio: 2024, nombre: 'Luis Carrasco', partido: 'orden' },
      ],
    },
  },
  {
    id: 'valparaiso', nombre: 'Valparaíso', region: 'Valparaíso', emoji: '🚡',
    lema: 'Cerros, ascensores y patrimonio',
    lat: -33.046, lon: -71.620, costa: true,
    poblacion: 296655, presupuesto: 170000,
    ingresos: { fcm: 35, propios: 45, transferencias: 20 },
    pobreza: 20, delincuencia: 0.8, turismo: 0.3,
    inicial: { s: 35, b: 45, e: 42 },
    problemas: ['seguridad', 'ambiente', 'barrios'],
    sectores: [
      'Playa Ancha', 'Plan', 'Cerro Alegre',
      'Cerro Barón', 'Rodelillo', 'Placilla',
    ],
    historia: 'Puerto histórico y Patrimonio de la Humanidad desde 2003. Sus cerros y ascensores son únicos, pero ha sufrido grandes incendios y arrastra problemas de basura y deuda municipal.',
    datos: ['Patrimonio de la Humanidad (UNESCO)', 'Grandes incendios en los cerros', 'Problemas de basura y deuda municipal'],
    politica: {
      votos: { verde: 32, social: 28, orden: 24, ind: 16 },
      incumbente: { nombre: 'Camila Reyes', partido: 'verde', periodos: 1 },
      historial: [
        { anio: 2012, nombre: 'Ignacio Bravo', partido: 'orden' }, { anio: 2016, nombre: 'Tomás Guerra', partido: 'verde' },
        { anio: 2021, nombre: 'Tomás Guerra', partido: 'verde' }, { anio: 2024, nombre: 'Camila Reyes', partido: 'verde' },
      ],
    },
  },
  {
    id: 'vina', nombre: 'Viña del Mar', region: 'Valparaíso', emoji: '🌸',
    lema: 'La Ciudad Jardín y su Festival',
    lat: -33.024, lon: -71.552, costa: true,
    poblacion: 334248, presupuesto: 200000,
    ingresos: { fcm: 20, propios: 62, transferencias: 18 },
    pobreza: 15, delincuencia: 0.7, turismo: 0.5,
    inicial: { s: 42, b: 52, e: 50 },
    problemas: ['seguridad', 'turismo', 'barrios'],
    sectores: [
      'Reñaca', 'Centro', 'Recreo',
      'Miraflores', 'Achupallas', 'Forestal',
    ],
    historia: 'Conocida como la Ciudad Jardín. Desde 1960 organiza el Festival Internacional de la Canción. Mezcla barrios de lujo frente al mar con grandes campamentos en los cerros.',
    datos: ['Festival de Viña desde 1960', 'Casino y turismo', 'Campamentos en los cerros'],
    politica: {
      votos: { orden: 36, social: 30, verde: 12, ind: 22 },
      incumbente: { nombre: 'Andrés Lagos', partido: 'social', periodos: 1 },
      historial: [
        { anio: 2012, nombre: 'Gloria Vergara', partido: 'orden' }, { anio: 2016, nombre: 'Gloria Vergara', partido: 'orden' },
        { anio: 2021, nombre: 'Gloria Vergara', partido: 'orden' }, { anio: 2024, nombre: 'Andrés Lagos', partido: 'social' },
      ],
    },
  },
  {
    id: 'santiago', nombre: 'Santiago', region: 'Metropolitana', emoji: '🏙️',
    lema: 'El centro histórico del país',
    lat: -33.444, lon: -70.651, costa: false,
    poblacion: 404495, presupuesto: 280000,
    ingresos: { fcm: 10, propios: 75, transferencias: 15 },
    pobreza: 12, delincuencia: 0.9, turismo: 0.2,
    inicial: { s: 30, b: 50, e: 60 },
    problemas: ['seguridad', 'barrios', 'ambiente'],
    sectores: [
      'Barrio Yungay', 'Barrio Brasil', 'Centro Histórico',
      'Lastarria', 'Meiggs', 'Parque O\'Higgins',
      'Barrio Franklin',
    ],
    historia: 'Fundada en 1541 por Pedro de Valdivia. Concentra oficinas, comercio y patrimonio. El comercio ambulante en Meiggs y las marchas en la Alameda son parte del día a día.',
    datos: ['Fundada en 1541', 'Gran población flotante de día', 'Comercio ambulante en Meiggs'],
    politica: {
      votos: { social: 34, orden: 32, verde: 16, ind: 18 },
      incumbente: { nombre: 'Paula Ossandón', partido: 'orden', periodos: 1 },
      historial: [
        { anio: 2012, nombre: 'Mario Figueroa', partido: 'social' }, { anio: 2016, nombre: 'Esteban Aguirre', partido: 'orden' },
        { anio: 2021, nombre: 'Valentina Pinto', partido: 'verde' }, { anio: 2024, nombre: 'Paula Ossandón', partido: 'orden' },
      ],
    },
  },
  {
    id: 'puentealto', nombre: 'Puente Alto', region: 'Metropolitana', emoji: '🏔️',
    lema: 'La comuna más poblada de Chile',
    lat: -33.611, lon: -70.575, costa: false,
    poblacion: 568106, presupuesto: 250000,
    ingresos: { fcm: 45, propios: 35, transferencias: 20 },
    pobreza: 18, delincuencia: 0.8, turismo: 0,
    inicial: { s: 35, b: 42, e: 48 },
    problemas: ['seguridad', 'barrios', 'salud'],
    sectores: [
      'El Peñón', 'Casas Viejas', 'Centro',
      'Bajos de Mena', 'Las Vizcachas',
    ],
    historia: 'Según el Censo 2017 es la comuna más poblada de Chile. Bajos de Mena es uno de los mayores conjuntos de vivienda social del país. Aquí un mismo sector político gobierna hace muchos años.',
    datos: ['Más de medio millón de habitantes', 'Bajos de Mena: gran conjunto de vivienda social', 'Puerta de entrada al Cajón del Maipo'],
    politica: {
      votos: { orden: 44, social: 26, verde: 6, ind: 24 },
      incumbente: { nombre: 'Germán Salas', partido: 'orden', periodos: 3 },
      historial: [
        { anio: 2012, nombre: 'Manuel Salas', partido: 'orden' }, { anio: 2016, nombre: 'Germán Salas', partido: 'orden' },
        { anio: 2021, nombre: 'Germán Salas', partido: 'orden' }, { anio: 2024, nombre: 'Germán Salas', partido: 'orden' },
      ],
    },
  },
];
