"""Baixa lojas, serviços e outros lugares com nome para dados/lugares.json.

Duas fontes, juntas:
  - Overture Maps, tema places (comércios de cadastros abertos; licença CDLA-Permissive-2.0);
  - OpenStreetMap, nós/áreas com shop/amenity/office/... e nome (ODbL).
Quando os dois têm o mesmo lugar (nome parecido a menos de 60 m), fica o do OSM.
Uso (dentro de matelandia-3d/): python -I tools/baixar_lugares.py
"""
import json, math, os, time, unicodedata, urllib.request
import xml.etree.ElementTree as ET
from overturemaps import core
from shapely import wkb

S, W, N, E = -25.2585, -54.0010, -25.2212, -53.9610
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dados', 'lugares.json')
CHAVES = ('shop', 'amenity', 'office', 'craft', 'tourism', 'leisure', 'healthcare')
FORA = {'parking', 'bench', 'waste_basket', 'bicycle_parking', 'toilets', 'drinking_water', 'park', 'pitch', 'playground'}

def norm(s):
    s = unicodedata.normalize('NFKD', s.lower()); return ''.join(c for c in s if c.isalnum())

def dist(a, b):
    return math.hypot((a[0]-b[0])*110574, (a[1]-b[1])*111320*math.cos(math.radians(a[0])))

# ---- OSM ----
osm = []
xml = urllib.request.urlopen(urllib.request.Request(
    f'https://api.openstreetmap.org/api/0.6/map?bbox={W},{S},{E},{N}', headers={'User-Agent': 'matelandia-3d/1.0'}), timeout=120).read()
raiz = ET.fromstring(xml)
nos = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in raiz.iter('node')}
for el in raiz:
    t = {x.get('k'): x.get('v') for x in el.iter('tag')}
    k = next((k for k in CHAVES if k in t), None)
    if not k or 'name' not in t or t[k] in FORA: continue
    if el.tag == 'node': p = (float(el.get('lat')), float(el.get('lon')))
    elif el.tag == 'way':
        pts = [nos[n.get('ref')] for n in el.iter('nd') if n.get('ref') in nos]
        if not pts: continue
        p = (sum(a for a, _ in pts)/len(pts), sum(b for _, b in pts)/len(pts))
    else: continue
    osm.append({'n': t['name'], 'cat': f'{k}={t[k]}', 'lat': round(p[0], 6), 'lon': round(p[1], 6), 'f': 'osm'})

# ---- Overture ----
ovt = []
for lote in core.record_batch_reader('place', bbox=(W, S, E, N)):
    for r in lote.to_pylist():
        nome = (r.get('names') or {}).get('primary')
        if not nome: continue
        if (r.get('operating_status') or 'open') != 'open': continue   # fechado de vez ou temporariamente
        g = wkb.loads(r['geometry'])
        cat = r.get('basic_category') or ((r.get('taxonomy') or {}).get('primary')) or ((r.get('categories') or {}).get('primary')) or ''
        ovt.append({'n': nome, 'cat': cat, 'lat': round(g.y, 6), 'lon': round(g.x, 6),
                    'conf': round(float(r.get('confidence') or 0), 2), 'f': 'overture'})

# ---- junta: o do OSM ganha quando é o mesmo lugar ----
lugares = list(osm)
for o in ovt:
    if any(dist((o['lat'], o['lon']), (p['lat'], p['lon'])) < 60 and (norm(o['n']) in norm(p['n']) or norm(p['n']) in norm(o['n'])) for p in osm):
        continue
    lugares.append(o)

meta = {'fontes': {'osm': len(osm), 'overture': len(ovt), 'final': len(lugares)}, 'baixado_em': time.strftime('%Y-%m-%d'),
        'limite': {'s': S, 'w': W, 'n': N, 'e': E},
        'licenca': 'OSM: ODbL 1.0 (© colaboradores do OpenStreetMap); Overture places: CDLA-Permissive-2.0 (© Overture Maps Foundation)'}
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
with open(SAIDA, 'w', encoding='utf-8') as f:
    json.dump({'meta': meta, 'lugares': lugares}, f, ensure_ascii=False, separators=(',', ':'))
print(json.dumps(meta['fontes']), os.path.getsize(SAIDA)//1024, 'KB')
