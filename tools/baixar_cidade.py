"""Baixa ruas e prédios de Matelândia do OpenStreetMap para dados/matelandia.json.

Tenta o Overpass (traz também ruas que só cruzam a borda); se nenhum servidor
responder, usa a API oficial do OSM. Saída no formato do Overpass "out geom".
Uso: python tools/baixar_cidade.py
"""
import json, os, sys, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

S, W, N, E = -25.2585, -54.0010, -25.2212, -53.9610
UA = {'User-Agent': 'matelandia-3d/1.0 (jogo educativo)'}
OVERPASS = ['https://overpass-api.de/api/interpreter',
            'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass.private.coffee/api/interpreter']
SAIDA = os.path.join(os.path.dirname(__file__), '..', 'dados', 'matelandia.json')

def overpass():
    q = f'[out:json][timeout:60];(way["highway"]({S},{W},{N},{E});way["building"]({S},{W},{N},{E}););out geom;'
    for u in OVERPASS:
        try:
            req = urllib.request.Request(u, data=urllib.parse.urlencode({'data': q}).encode(), headers=UA)
            j = json.load(urllib.request.urlopen(req, timeout=90))
            els = [e for e in j.get('elements', []) if e.get('type') == 'way' and e.get('geometry')]
            if els: return els, 'Overpass (' + urllib.parse.urlparse(u).netloc + ')'
        except Exception as e:
            print('  falhou', u, type(e).__name__, str(e)[:80], file=sys.stderr)
    return None, None

def osm_api():
    u = f'https://api.openstreetmap.org/api/0.6/map?bbox={W},{S},{E},{N}'
    root = ET.fromstring(urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read())
    nos = {n.get('id'): (float(n.get('lat')), float(n.get('lon'))) for n in root.iter('node')}
    els = []
    for w in root.iter('way'):
        tags = {t.get('k'): t.get('v') for t in w.iter('tag')}
        if 'highway' not in tags and 'building' not in tags: continue
        geo = [{'lat': nos[nd.get('ref')][0], 'lon': nos[nd.get('ref')][1]} for nd in w.iter('nd') if nd.get('ref') in nos]
        if len(geo) >= 2: els.append({'type': 'way', 'id': int(w.get('id')), 'tags': tags, 'geometry': geo})
    return els, 'API oficial do OpenStreetMap'

els, fonte = overpass()
if not els: els, fonte = osm_api()
for e in els:  # 7 casas decimais ≈ 1 cm: basta e enxuga o arquivo
    e['geometry'] = [{'lat': round(g['lat'], 7), 'lon': round(g['lon'], 7)} for g in e['geometry']]
    e.pop('bounds', None); e.pop('nodes', None)
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
meta = {'fonte': fonte, 'baixado_em': time.strftime('%Y-%m-%d'), 'limite': {'s': S, 'w': W, 'n': N, 'e': E},
        'licenca': 'Dados © colaboradores do OpenStreetMap, ODbL 1.0 (openstreetmap.org/copyright)'}
with open(SAIDA, 'w', encoding='utf-8') as f:
    json.dump({'meta': meta, 'elements': els}, f, ensure_ascii=False, separators=(',', ':'))
ruas = sum(1 for e in els if 'highway' in e['tags']); pred = sum(1 for e in els if 'building' in e['tags'])
print(f'{fonte}: {ruas} ruas, {pred} prédios, {os.path.getsize(SAIDA)//1024} KB -> {os.path.abspath(SAIDA)}')
