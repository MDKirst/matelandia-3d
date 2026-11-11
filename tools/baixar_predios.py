"""Baixa os contornos de prédios do Overture Maps (tema buildings) para dados/predios.json.

O Overture junta OSM + contornos detectados por IA (Microsoft, Google). Os que vêm do
OpenStreetMap ficam de fora: o jogo já os tem em dados/matelandia.json (com nome).
Licença: ODbL — o crédito "Overture Maps Foundation / OpenStreetMap" fica na tela do jogo.
Uso (dentro de matelandia-3d/): python -I tools/baixar_predios.py
Requer: pip install overturemaps (traz pyarrow); shapely.
"""
import json, os, time
from overturemaps import core
from shapely import wkb
from shapely.geometry import Polygon, MultiPolygon

S, W, N, E = -25.2585, -54.0010, -25.2212, -53.9610
SAIDA = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dados', 'predios.json')

leitor = core.record_batch_reader('building', bbox=(W, S, E, N))
predios, fontes, pulados_osm = [], {}, 0
for lote in leitor:
    for r in lote.to_pylist():
        srcs = [s.get('dataset') for s in (r.get('sources') or []) if s]
        if 'OpenStreetMap' in srcs:
            pulados_osm += 1; continue
        g = wkb.loads(r['geometry'])
        partes = g.geoms if isinstance(g, MultiPolygon) else [g] if isinstance(g, Polygon) else []
        for p in partes:
            anel = list(p.exterior.coords)[:-1]           # sem repetir o 1º ponto; buracos ignorados
            if len(anel) < 3: continue
            item = {'c': [[round(y, 6), round(x, 6)] for x, y in anel]}  # [lat, lon], ~10 cm
            if r.get('height'): item['h'] = round(float(r['height']), 1)
            if r.get('num_floors'): item['a'] = int(r['num_floors'])
            if r.get('class'): item['t'] = r['class']
            predios.append(item)
        for s in srcs: fontes[s] = fontes.get(s, 0) + 1

meta = {'fonte': 'Overture Maps (buildings)', 'origens': fontes, 'baixado_em': time.strftime('%Y-%m-%d'),
        'limite': {'s': S, 'w': W, 'n': N, 'e': E}, 'sem_osm': pulados_osm,
        'licenca': 'ODbL 1.0 — © Overture Maps Foundation, © colaboradores do OpenStreetMap'}
os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
with open(SAIDA, 'w', encoding='utf-8') as f:
    json.dump({'meta': meta, 'predios': predios}, f, ensure_ascii=False, separators=(',', ':'))
com_h = sum(1 for p in predios if 'h' in p or 'a' in p)
print(f'{len(predios)} prédios ({com_h} com altura/andares), origens {fontes}, {pulados_osm} do OSM pulados, '
      f'{os.path.getsize(SAIDA)//1024} KB -> {os.path.abspath(SAIDA)}')
