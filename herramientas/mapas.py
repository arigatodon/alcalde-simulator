#!/usr/bin/env python3
"""
Genera js/mapas.js con mapas reales de cada comuna a partir de OpenStreetMap.

  python3 herramientas/mapas.py            # descarga (con caché) y genera
  python3 herramientas/mapas.py --lugares  # lista lugares reales de cada comuna (para elegir sectores)

Para cada comuna descarga:
  - el límite comunal (Nominatim)
  - costa, ríos y rutas principales (Overpass)
  - la ubicación de cada sector de js/comunas.js (Nominatim), verificando que quede dentro de la comuna

Datos © OpenStreetMap contributors (ODbL).
"""
import json, math, os, re, sys, time, urllib.parse, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(RAIZ, 'herramientas', 'cache')
UA = 'AlcaldeSimulator/1.0 (juego educativo)'
ANCHO = 100          # ancho del viewBox
ALTO_MAX = 72        # alto máximo del viewBox
MARGEN = 5
SEP_MIN = 10        # distancia mínima entre sectores en el mapa

# Lupa: exponente para comprimir distancias desde el centro urbano (1 = sin lupa).
# Mantiene la dirección real de cada punto visto desde el centro.
LUPA = {'cartagena': 0.42, 'sanantonio': 0.42, 'algarrobo': 0.55, 'valparaiso': 0.55,
        'elquisco': 0.7, 'vina': 0.7, 'santiago': 1, 'puentealto': 0.8}

# Búsquedas alternativas cuando el nombre del juego no coincide con OSM
ALIAS = {
    ('valparaiso', 'Plan'): 'Almendral, Valparaíso, Chile',
    ('sanantonio', 'Llolleo'): 'Llo Lleo, San Antonio, Chile',
    ('valparaiso', 'Placilla'): 'Placilla de Peñuelas, Valparaíso, Chile',
    ('santiago', 'Lastarria'): 'Barrio Lastarria, Santiago, Chile',
    ('santiago', 'Centro Histórico'): 'Plaza de Armas, Santiago, Chile',
}
# Coordenadas fijas (lon, lat) verificadas a mano en OSM
FIJAS = {
    ('cartagena', 'Playa Grande'): (-71.6034, -33.5385),  # en OSM figura como "Playa Cartagena"
}
# Equipamiento real de OSM → tipo del juego
TIPOS_EQUIP = {
    ('amenity', 'townhall'): 'municipio', ('amenity', 'hospital'): 'hospital', ('amenity', 'clinic'): 'cesfam',
    ('amenity', 'doctors'): 'posta', ('amenity', 'school'): 'escuela', ('amenity', 'kindergarten'): 'jardin',
    ('amenity', 'library'): 'biblioteca', ('amenity', 'fire_station'): 'bomberos', ('amenity', 'police'): 'carabineros',
    ('amenity', 'marketplace'): 'mercado', ('amenity', 'community_centre'): 'sede', ('amenity', 'arts_centre'): 'cultura',
    ('amenity', 'theatre'): 'cultura', ('leisure', 'stadium'): 'estadio', ('leisure', 'sports_centre'): 'gimnasio',
    ('leisure', 'park'): 'plaza', ('tourism', 'museum'): 'museo', ('tourism', 'attraction'): 'atractivo',
    ('shop', 'supermarket'): 'super', ('shop', 'mall'): 'mall', ('shop', 'department_store'): 'tienda',
}
MAX_TIPO = {'escuela': 5, 'plaza': 4, 'posta': 5, 'jardin': 3, 'atractivo': 3, 'super': 4}
MAX_EQUIP = 30
PATRON_COSTANERA = r'costanera|borde costero|avenida del mar|avenida perú|avenida peru|avenida san martín|paseo|playa chica|playa grande'
# Sitios con nombre (lat, lon, dueño, tamaño, zona típica). Fuente: catastro Cartagena Creativa y OSM.
# El dueño del Cine Diana es un supuesto del juego.
SITIOS = {
    'cartagena': [
        ('Casa Azul (Playa Grande)', -33.544798, -71.604919, 'municipal', 'mediano', True),
        ('Casa de Oficios Galvarino Gallardo', -33.55187, -71.60467, 'municipal', 'chico', True),
        ('Cine Diana', -33.55082, -71.60587, 'privado', 'mediano', True),
        ('Paño junto al Estadio', -33.5405, -71.5995, 'municipal', 'grande', False),
        ('Sitio en Av. Cartagena', -33.5560, -71.5960, 'privado', 'grande', False),
    ],
}
NOMBRES_COSTANERA = {'cartagena': ['Costa Azul y San Sebastián', 'Playa Grande', 'Playa Chica y Caleta San Pedro']}
PRIORIDAD = {'place': 0, 'boundary': 1, 'natural': 2, 'leisure': 2, 'tourism': 3, 'railway': 3}

# Cómo buscar cada comuna en Nominatim
BUSQUEDA = {
    'cartagena': 'Cartagena, Provincia de San Antonio, Chile',
    'sanantonio': 'San Antonio, Provincia de San Antonio, Chile',
    'elquisco': 'El Quisco, Provincia de San Antonio, Chile',
    'algarrobo': 'Algarrobo, Provincia de San Antonio, Chile',
    'valparaiso': 'Valparaíso, Provincia de Valparaíso, Chile',
    'vina': 'Viña del Mar, Provincia de Valparaíso, Chile',
    'santiago': 'Santiago, Provincia de Santiago, Región Metropolitana, Chile',
    'puentealto': 'Puente Alto, Provincia Cordillera, Chile',
}


# ------------------------------------------------------------ descarga
def pedir(url, data=None, nombre=None):
    ruta = os.path.join(CACHE, nombre) if nombre else None
    if ruta and os.path.exists(ruta):
        with open(ruta) as f:
            return json.load(f)
    req = urllib.request.Request(url, data=data, headers={'User-Agent': UA})
    for intento in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                txt = r.read().decode()
            break
        except Exception as e:
            print(f'  reintento {intento + 1} ({e})', file=sys.stderr)
            time.sleep(5 * (intento + 1))
    else:
        raise SystemExit(f'No se pudo descargar {url}')
    time.sleep(1.2)  # respetar límites de uso de OSM
    d = json.loads(txt)
    if ruta:
        os.makedirs(CACHE, exist_ok=True)
        with open(ruta, 'w') as f:
            json.dump(d, f)
    return d


def nominatim(q, nombre, **extra):
    params = {'q': q, 'format': 'json', 'limit': 8, **extra}
    return pedir('https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode(params), nombre=nombre)


def overpass(query, nombre):
    data = urllib.parse.urlencode({'data': query}).encode()
    return pedir('https://overpass-api.de/api/interpreter', data=data, nombre=nombre)


# ------------------------------------------------------------ geometría
def anillos(geojson):
    """Anillos exteriores de un Polygon/MultiPolygon como listas de (lon, lat)."""
    if geojson['type'] == 'Polygon':
        return [geojson['coordinates'][0]]
    return [p[0] for p in geojson['coordinates']]


def dentro(pt, anillo):
    x, y = pt
    ok = False
    for i in range(len(anillo)):
        x1, y1 = anillo[i]
        x2, y2 = anillo[i - 1]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            ok = not ok
    return ok


def simplificar(pts, tol):
    """Douglas-Peucker."""
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / n
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        return simplificar(pts[:idx + 1], tol)[:-1] + simplificar(pts[idx:], tol)
    return [a, b]


def simplificar_anillo(pts, tol):
    """Simplifica un polígono cerrado partiéndolo en dos mitades."""
    if len(pts) < 8:
        return pts
    m = len(pts) // 2
    return simplificar(pts[:m + 1], tol)[:-1] + simplificar(pts[m:], tol)


def unir_tramos(tramos):
    """Une tramos de línea (listas de puntos) que comparten extremos."""
    tramos = [list(t) for t in tramos if len(t) > 1]
    cadenas = []
    while tramos:
        c = tramos.pop(0)
        cambio = True
        while cambio:
            cambio = False
            for i, t in enumerate(tramos):
                if t[0] == c[-1]:
                    c += t[1:]
                elif t[-1] == c[0]:
                    c = t[:-1] + c
                elif t[-1] == c[-1]:
                    c += t[::-1][1:]
                elif t[0] == c[0]:
                    c = t[::-1][:-1] + c
                else:
                    continue
                tramos.pop(i)
                cambio = True
                break
        cadenas.append(c)
    return cadenas


class Proyeccion:
    """Equirectangular + lupa radial centrada en el centro urbano, ajustada al viewBox."""
    def __init__(self, borde, centro, p):
        self.c = centro
        self.k = math.cos(math.radians(centro[1]))
        self.p = p
        pl = [self._plano(*q) for q in borde]
        self.D = max(math.hypot(x, y) for x, y in pl) or 1
        pts = [self._lupa(x, y) for x, y in pl]
        x0, x1 = min(q[0] for q in pts), max(q[0] for q in pts)
        y0, y1 = min(q[1] for q in pts), max(q[1] for q in pts)
        w, h = (x1 - x0) or 1e-9, (y1 - y0) or 1e-9
        self.s = min((ANCHO - 2 * MARGEN) / w, (ALTO_MAX - 2 * MARGEN - 4) / h)
        self.alto = round(min(ALTO_MAX, h * self.s + 2 * MARGEN + 4), 1)
        self.dx = (ANCHO - w * self.s) / 2 - x0 * self.s
        self.dy = (self.alto - h * self.s) / 2 - y0 * self.s

    def _plano(self, lon, lat):
        return ((lon - self.c[0]) * self.k, -(lat - self.c[1]))

    def _lupa(self, x, y):
        d = math.hypot(x, y)
        if d == 0:
            return (0.0, 0.0)
        f = self.D * (d / self.D) ** self.p / d
        return (x * f, y * f)

    def xy(self, lon, lat):
        x, y = self._lupa(*self._plano(lon, lat))
        return (x * self.s + self.dx, y * self.s + self.dy)


def dentro_de(pt, polys):
    return any(dentro(pt, a) for a in polys)


def partir_en(pts, n):
    """Parte una polilínea en n tramos de igual largo (interpola los puntos de corte)."""
    if len(pts) < 2:
        return []
    segs = [(a, b, math.hypot(b[0] - a[0], b[1] - a[1])) for a, b in zip(pts, pts[1:])]
    total = sum(d for _, _, d in segs)
    if total < 1:
        return []

    def punto(dist):
        for a, b, d in segs:
            if dist <= d or (a, b, d) == segs[-1]:
                f = min(1, dist / d) if d else 0
                return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
            dist -= d

    tramos = []
    for k in range(n):
        lo, hi = total * k / n, total * (k + 1) / n
        t, acum = [punto(lo)], 0
        for a, b, d in segs:
            if lo < acum + d and acum + d < hi:
                t.append(b)
            acum += d
        t.append(punto(hi))
        tramos.append([(round(x, 1), round(y, 1)) for x, y in t])
    return tramos


def separar(pos):
    """Separa sectores muy juntos para que no se tapen (desplazamientos pequeños)."""
    nombres = list(pos)
    orig = {n: tuple(pos[n]) for n in nombres}
    for _ in range(200):
        movido = False
        for i, a in enumerate(nombres):
            for b in nombres[i + 1:]:
                ax, ay = pos[a]
                bx, by = pos[b]
                d = math.hypot(bx - ax, by - ay) or 0.01
                if d < SEP_MIN:
                    m = (SEP_MIN - d) / 2 / d
                    pos[a] = [ax - (bx - ax) * m, ay - (by - ay) * m]
                    pos[b] = [bx + (bx - ax) * m, by + (by - ay) * m]
                    movido = True
        if not movido:
            break
    return {n: [round(pos[n][0], 1), round(pos[n][1], 1)] for n in nombres}, \
        max(math.hypot(pos[n][0] - orig[n][0], pos[n][1] - orig[n][1]) for n in nombres) if nombres else 0


def path(pts, cerrar=False):
    s = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts)
    return s + (' Z' if cerrar else '')


def recortar(pts, alto, extra=15):
    """Descarta puntos muy fuera del viewBox (las líneas largas se salen del cuadro)."""
    return [p for p in pts if -extra < p[0] < ANCHO + extra and -extra < p[1] < alto + extra]


# ------------------------------------------------------------ comunas.js
def leer_sectores():
    txt = open(os.path.join(RAIZ, 'js', 'comunas.js')).read()
    res = {}
    for bloque in re.split(r"\n  \{\n", txt)[1:]:
        cid = re.search(r"id: '([^']+)'", bloque).group(1)
        m = re.search(r"sectores: \[(.*?)\],\n", bloque, re.S)
        res[cid] = re.findall(r"'((?:[^'\\]|\\.)+)'", m.group(1)) if m else []
        res[cid] = [s.replace("\\'", "'") for s in res[cid]]
    return res


def lugares(cid, rel_id):
    area = 3600000000 + rel_id
    q = f'[out:json][timeout:60];area({area})->.a;node["place"~"suburb|neighbourhood|village|hamlet|town|locality|quarter"](area.a);out;'
    d = overpass(q, f'{cid}_lugares.json')
    return sorted({(e['tags'].get('place'), e['tags'].get('name')) for e in d['elements'] if e['tags'].get('name')})


def main():
    sectores = leer_sectores()
    salida = {}
    problemas = []
    for cid, q in BUSQUEDA.items():
        print(f'== {cid}')
        res = nominatim(q, f'{cid}_limite.json', polygon_geojson=1)
        lim = next(r for r in res if r['class'] == 'boundary' and r['geojson']['type'] in ('Polygon', 'MultiPolygon'))
        if '--lugares' in sys.argv:
            for tipo, nombre in lugares(cid, int(lim['osm_id'])):
                print(f'   {tipo:13} {nombre}')
            continue
        anill = anillos(lim['geojson'])
        # sólo la parte continental (Valparaíso incluye las islas Desventuradas)
        mayor = max(anill, key=len)
        mlon0, mlon1 = min(p[0] for p in mayor) - 0.1, max(p[0] for p in mayor) + 0.1
        mlat0, mlat1 = min(p[1] for p in mayor) - 0.1, max(p[1] for p in mayor) + 0.1
        anill = [a for a in anill if all(mlon0 < p[0] < mlon1 and mlat0 < p[1] < mlat1 for p in a)]
        todos = [p for a in anill for p in a]
        lon0, lon1 = min(p[0] for p in todos), max(p[0] for p in todos)
        lat0, lat1 = min(p[1] for p in todos), max(p[1] for p in todos)
        bbox = (lon0 - 0.02, lat0 - 0.02, lon1 + 0.02, lat1 + 0.02)

        # sectores (primero, para centrar la lupa en el Centro)
        geo = {}
        for nombre in sectores.get(cid, []):
            if (cid, nombre) in FIJAS:
                geo[nombre] = FIJAS[(cid, nombre)]
                continue
            if nombre == 'Centro':
                cand = [{'lon': lim['lon'], 'lat': lim['lat'], 'class': 'place'}]
            else:
                qq = ALIAS.get((cid, nombre), f'{nombre}, {q}')
                cand = nominatim(qq, f'{cid}_{re.sub(r"[^a-z0-9]", "", qq.lower())[:40]}.json')
                cand = sorted(cand, key=lambda r: PRIORIDAD.get(r.get('class'), 5))
            for r in cand:
                pt = (float(r['lon']), float(r['lat']))
                if any(dentro(pt, a) for a in anill):
                    geo[nombre] = pt
                    break
            else:
                problemas.append(f'{cid}: "{nombre}" no se encontró dentro de la comuna')
        centro = geo.get('Centro') or geo.get('Centro Histórico') or (float(lim['lon']), float(lim['lat']))
        pr = Proyeccion(todos, centro, LUPA.get(cid, 0.7))
        tol = 0.25

        tierra = [path(simplificar_anillo([pr.xy(*p) for p in a], tol), True) for a in anill if len(a) > 20]

        # costa → polígono de mar (el mar queda a la derecha de la dirección de la línea en OSM)
        bb = f'{bbox[1] - 0.05},{bbox[0] - 0.08},{bbox[3] + 0.05},{bbox[2] + 0.05}'
        costa = overpass(f'[out:json][timeout:60];way["natural"="coastline"]({bb});out geom;', f'{cid}_costa.json')
        tramos = [[(g['lon'], g['lat']) for g in e['geometry']] for e in costa['elements']]
        mar, islas = [], []
        for cad in unir_tramos(tramos):
            pts = [pr.xy(*p) for p in cad]
            if cad[0] == cad[-1]:
                islas.append(path(simplificar_anillo(pts, tol), True))
                continue
            pts = recortar(pts, pr.alto)
            if len(pts) < 2:
                continue
            pts = simplificar(pts, tol)
            # la costa de OSM avanza con la tierra a la izquierda; en Chile el mar queda al oeste
            ini, fin = pts[0], pts[-1]
            mar.append(path(pts + [(fin[0], pr.alto + 20), (-20, pr.alto + 20), (-20, -20), (ini[0], -20)], True)
                       if ini[1] < fin[1] else
                       path(pts + [(fin[0], -20), (-20, -20), (-20, pr.alto + 20), (ini[0], pr.alto + 20)], True))

        rios_osm = overpass(f'[out:json][timeout:60];way["waterway"="river"]({bb});out geom;', f'{cid}_rios.json')
        rios = [path(simplificar(recortar([pr.xy(g['lon'], g['lat']) for g in e['geometry']], pr.alto), tol))
                for e in rios_osm['elements']]
        rutas_osm = overpass(f'[out:json][timeout:60];way["highway"~"^(motorway|trunk|primary)$"]({bb});out geom;', f'{cid}_rutas.json')
        rutas = []
        for cad in unir_tramos([[(g['lon'], g['lat']) for g in e['geometry']] for e in rutas_osm['elements']]):
            pts = recortar([pr.xy(*p) for p in cad], pr.alto, extra=3)
            if len(pts) > 1:
                rutas.append(path(simplificar(pts, tol)))

        pos = {n: list(pr.xy(*pt)) for n, pt in geo.items()}
        pos, mov = separar(pos)
        for n, pt in geo.items():
            print(f'   {n:22} {pt[1]:.4f}, {pt[0]:.4f}  ->  {pos[n]}')
        if mov > 4:
            print(f'   (aviso: un sector se movió {mov:.1f} unidades para no taparse)')

        # ---- equipamiento existente
        area = 3600000000 + int(lim['osm_id'])
        filtros = ''.join(f'nwr["{k}"="{v}"](area.a);' for k, v in TIPOS_EQUIP)
        eq_osm = overpass(f'[out:json][timeout:90];area({area})->.a;({filtros});out center tags;', f'{cid}_equip.json')
        vistos, cuenta, equip = set(), {}, []
        elems = sorted(eq_osm['elements'], key=lambda e: (0 if e['tags'].get('name') else 1))
        for e in elems:
            t = e['tags']
            tipo = next((v for (k, val), v in TIPOS_EQUIP.items() if t.get(k) == val), None)
            nombre = t.get('name') or t.get('brand')
            if not tipo or not nombre or nombre.lower() in vistos:
                continue
            if cuenta.get(tipo, 0) >= MAX_TIPO.get(tipo, 3) or len(equip) >= MAX_EQUIP:
                continue
            c = e.get('center', e)
            lonlat = (c['lon'], c['lat'])
            if not dentro_de(lonlat, anill):
                continue
            vistos.add(nombre.lower())
            cuenta[tipo] = cuenta.get(tipo, 0) + 1
            x, y = pr.xy(*lonlat)
            equip.append({'t': tipo, 'n': nombre, 'x': round(x, 1), 'y': round(y, 1), 'marca': t.get('brand', '')})
        print(f'   equipamiento: {len(equip)} ({", ".join(f"{k}:{v}" for k, v in cuenta.items())})')

        # ---- costanera: calles costeras reales o, si no hay, la costa cerca del centro
        cost_pts = []
        if costa['elements']:
            q_c = f'[out:json][timeout:60];area({area})->.a;way["highway"]["name"~"{PATRON_COSTANERA}",i](area.a);out geom;'
            vias = overpass(q_c, f'{cid}_costanera.json')
            cx, cy = pos.get('Centro', next(iter(pos.values()), [50, 36]))
            cadenas = unir_tramos([[(g['lon'], g['lat']) for g in e['geometry']] for e in vias['elements']])
            cadenas = [[pr.xy(*p) for p in c] for c in cadenas if c[0] != c[-1]]
            cadenas = [c for c in cadenas if min(math.hypot(x - cx, y - cy) for x, y in c) < 25]
            # recorrido continuo de norte a sur: se parte por la cadena más al norte y se sigue por la más cercana
            if cadenas:
                actual = min(cadenas, key=lambda c: min(p[1] for p in c))
                cadenas.remove(actual)
                if actual[0][1] > actual[-1][1]:
                    actual = actual[::-1]
                cost_pts = list(actual)
                while cadenas:
                    fin = cost_pts[-1]
                    sig = min(cadenas, key=lambda c: min(math.hypot(c[0][0] - fin[0], c[0][1] - fin[1]), math.hypot(c[-1][0] - fin[0], c[-1][1] - fin[1])))
                    d = min(math.hypot(sig[0][0] - fin[0], sig[0][1] - fin[1]), math.hypot(sig[-1][0] - fin[0], sig[-1][1] - fin[1]))
                    if d > 12:
                        break
                    cadenas.remove(sig)
                    if math.hypot(sig[-1][0] - fin[0], sig[-1][1] - fin[1]) < math.hypot(sig[0][0] - fin[0], sig[0][1] - fin[1]):
                        sig = sig[::-1]
                    cost_pts += sig
            if len(cost_pts) < 6:
                cost_pts = []
                for cad in unir_tramos(tramos):
                    pts = [pr.xy(*p) for p in cad]
                    pts = [p for p in pts if math.hypot(p[0] - cx, p[1] - cy) < 22]
                    if len(pts) > len(cost_pts):
                        cost_pts = pts
                if cost_pts and cost_pts[0][1] > cost_pts[-1][1]:
                    cost_pts = cost_pts[::-1]
            cost_pts = simplificar(cost_pts, 0.3) if len(cost_pts) > 2 else cost_pts
        costanera = [path(t) for t in partir_en(cost_pts, 3)]

        # ---- terrenos donde construir: alrededor de cada sector, en tierra y fuera del mar
        mar_xy = []
        for cad in unir_tramos(tramos):
            if cad[0] != cad[-1]:
                pts = recortar([pr.xy(*p) for p in cad], pr.alto)
                if len(pts) > 1:
                    ini, fin = pts[0], pts[-1]
                    mar_xy.append(pts + ([(fin[0], pr.alto + 20), (-20, pr.alto + 20), (-20, -20), (ini[0], -20)]
                                         if ini[1] < fin[1] else [(fin[0], -20), (-20, -20), (-20, pr.alto + 20), (ini[0], pr.alto + 20)]))
        tierra_xy = [[pr.xy(*p) for p in a] for a in anill if len(a) > 20]
        ocupados = [tuple(v) for v in pos.values()]
        terrenos = []
        for (nom, lat, lon, dueno, tam, zt) in SITIOS.get(cid, []):
            x, y = pr.xy(lon, lat)
            sec = min(pos, key=lambda n: math.hypot(pos[n][0] - x, pos[n][1] - y))
            terrenos.append([round(x, 1), round(y, 1), sec, nom, dueno, tam, zt])
            ocupados.append((x, y))
        for nombre, (sx, sy) in pos.items():
            n_max = 4 if nombre.startswith('Centro') else 3
            hechos = 0
            for r in (6.5, 9.5, 12.5):
                for ang in range(0, 360, 30):
                    if hechos >= n_max:
                        break
                    x = sx + r * math.cos(math.radians(ang + r * 7))
                    y = sy + r * math.sin(math.radians(ang + r * 7))
                    if not (3 < x < 97 and 3 < y < pr.alto - 3):
                        continue
                    if not dentro_de((x, y), tierra_xy) or dentro_de((x, y), mar_xy):
                        continue
                    if min(math.hypot(x - a, y - b) for a, b in ocupados) < 5:
                        continue
                    if any(math.hypot(x - q['x'], y - q['y']) < 2.2 for q in equip):
                        continue
                    ocupados.append((x, y))
                    terrenos.append([round(x, 1), round(y, 1), nombre])
                    hechos += 1
        print(f'   terrenos: {len(terrenos)} · costanera: {len(costanera)} tramos')

        salida[cid] = {'alto': pr.alto, 'tierra': tierra, 'mar': mar, 'islas': islas,
                       'rios': [r for r in rios if r.count('L') > 0], 'rutas': rutas, 'sectores': pos,
                       'equip': equip, 'costanera': costanera, 'terrenos': terrenos,
                       'nombresCostanera': NOMBRES_COSTANERA.get(cid, ['Tramo norte', 'Tramo centro', 'Tramo sur'])}

    if '--lugares' in sys.argv:
        return
    with open(os.path.join(RAIZ, 'js', 'mapas.js'), 'w') as f:
        f.write('// Generado por herramientas/mapas.py — no editar a mano.\n')
        f.write('// Datos © OpenStreetMap contributors (ODbL).\n')
        f.write('const MAPAS = ' + json.dumps(salida, ensure_ascii=False, separators=(',', ':')) + ';\n')
    print('\nEscrito js/mapas.js')
    if problemas:
        print('\nPROBLEMAS:\n  ' + '\n  '.join(problemas))


if __name__ == '__main__':
    main()
