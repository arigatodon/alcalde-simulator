# 🏛️ Alcalde Simulator

Juego de simulación municipal: elige una comuna de Chile, gana la elección y gobierna 4 años (2029–2032).

## Cómo jugar
Abre `index.html` en el navegador (no necesita instalar nada).

1. **Comuna** — 8 comunas con población, presupuesto, historia y quién ha gobernado.
2. **Candidatura** — independiente (juntas firmas) o con partido. El alcalde actual tiene ventaja;
   si ya cumplió 3 periodos no puede repostular y su partido lleva a su "delfín".
3. **Promesas y campaña** — encuesta con todos los candidatos y noche electoral.
4. **Concejo** — 6, 8 o 10 concejales según los electores, repartidos con D'Hondt.
5. **Gobierno** — cada mes: 1 decisión + 1 acción:
   🚶 terreno · 🏗️ obras (las grandes las vota el concejo) · 💼 economía (patentes, cursos OMIL/SENCE, ferias, inversión)
   · 🏛️ concejo (proponer ordenanzas, negociar) · 📝 fondos GORE.
   Los concejales también proponen cosas y se vota.

Teclas: `1`–`6` eligen opción · `Espacio` junta firmas.

## Territorio
- **Terrenos**: 🟩 municipales (gratis) y 🟨 particulares (comprar o arrendar). En Cartagena hay sitios reales:
  Casa Azul, Casa de Oficios Galvarino Gallardo, Cine Diana (el dueño es un supuesto del juego), entre otros.
  Los que están en la Zona Típica del borde costero necesitan 2 meses más por el permiso del Consejo de Monumentos.
- **Edificios existentes** (de OpenStreetMap): CESFAM, postas, estadio, biblioteca, centro cultural…
  Se pueden ampliar con un 30% de descuento.
- **Costanera** en 3 tramos (en Cartagena: Costa Azul y San Sebastián, Playa Grande, Playa Chica y Caleta San Pedro),
  cada uno con 3 niveles. Las marejadas pueden dañarla.
- **Grandes marcas** (Copec, Cruz Verde, Dunkin', Líder, McDonald's, Starbucks, Sodimac, Cinemark, Falabella, Mall Plaza):
  llegan según el "atractivo comercial" de la comuna y se instalan en un terreno que tú eliges. Las marcas se nombran
  sólo como referencia del juego.

## Mapas reales
`js/mapas.js` se genera desde OpenStreetMap (límite comunal, costa, ríos, rutas y ubicación de cada sector):

    python3 herramientas/mapas.py            # regenera los mapas (usa herramientas/cache/)
    python3 herramientas/mapas.py --lugares  # lista lugares reales de cada comuna para elegir sectores

El mapa usa una "lupa" en el centro urbano: la dirección de cada sector desde el centro es real y las
distancias largas se comprimen para que quepa la parte rural. Si un sector no se encuentra dentro de la
comuna, el script lo avisa; se corrige con `ALIAS` o `FIJAS` dentro del script.

## Archivos
- `js/comunas.js` — datos de cada comuna (**aproximados**; alcaldes y partidos ficticios). Aquí pones tus datos reales.
- `js/eventos.js` — eventos, obras, negocios, cursos, propuestas y partidos.
- `js/juego.js` candidatura y elecciones · `js/gobierno.js` ciclo mensual · `js/concejo.js` · `js/economia.js` · `js/mapa.js` · `js/sonido.js`.

La plata se mide en "meses de caja libre" (8% del presupuesto anual / 12), así los costos escalan con cada comuna.
