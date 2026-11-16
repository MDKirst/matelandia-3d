"""Altitude de Matelândia para o jogo (relevo: subidas e descidas).

Fonte: mosaicos "Terrarium" públicos da AWS (Open Data, sem cadastro), feitos de SRTM/NASA e outros
modelos de terreno abertos. Cada pixel RGB vira altura: (R*256 + G + B/256) - 32768 metros.
Saída: dados/relevo.json, uma grade em metros do jogo (x = leste, z = sul), a cada PASSO metros,
com altura em decímetros acima da mais baixa. Uso (dentro de matelandia-3d/): python tools/baixar_relevo.py
"""
import io, json, math, os, sys, urllib.request
from PIL import Image

LAT0, LON0 = -25.2398, -53.9810                 # iguais a js/config.js
LIM = dict(s=-25.2585, w=-54.0010, n=-25.2212, e=-53.9610)
Z, PASSO, MARGEM = 14, 20, 400                  # zoom dos mosaicos, metros entre pontos, folga além da borda
URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
CACHE = os.path.join(os.environ.get('TEMP', '.'), 'relevo-matelandia')

MX = 111320 * math.cos(math.radians(LAT0)); MZ = 110574
toXZ = lambda lat, lon: ((lon - LON0) * MX, -(lat - LAT0) * MZ)
toLL = lambda x, z: (LAT0 - z / MZ, LON0 + x / MX)

def tile_xy(lat, lon):
    n = 2 ** Z; return ((lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)

os.makedirs(CACHE, exist_ok=True)
mosaicos = {}
def mosaico(tx, ty):
    k = (tx, ty)
    if k not in mosaicos:
        arq = os.path.join(CACHE, f'{Z}_{tx}_{ty}.png')
        if not os.path.exists(arq):
            req = urllib.request.Request(URL.format(z=Z, x=tx, y=ty), headers={'User-Agent': 'matelandia-3d (jogo escolar)'})
            with urllib.request.urlopen(req, timeout=30) as r, open(arq, 'wb') as f: f.write(r.read())
            print('baixou', arq, os.path.getsize(arq), 'bytes')
        mosaicos[k] = Image.open(arq).convert('RGB')
    return mosaicos[k]

def altura(lat, lon):            # bilinear dentro do mosaico
    fx, fy = tile_xy(lat, lon); fx *= 256; fy *= 256
    x0, y0 = math.floor(fx), math.floor(fy); tx, ty = fx - x0, fy - y0
    def px(X, Y):
        r, g, b = mosaico(X // 256, Y // 256).getpixel((X % 256, Y % 256)); return r * 256 + g + b / 256 - 32768
    return (px(x0, y0) * (1 - tx) * (1 - ty) + px(x0 + 1, y0) * tx * (1 - ty) + px(x0, y0 + 1) * (1 - tx) * ty + px(x0 + 1, y0 + 1) * tx * ty)

X0, Z0 = toXZ(LIM['n'], LIM['w']); X1, Z1 = toXZ(LIM['s'], LIM['e'])
X0 -= MARGEM; Z0 -= MARGEM; X1 += MARGEM; Z1 += MARGEM
nx, nz = int((X1 - X0) / PASSO) + 2, int((Z1 - Z0) / PASSO) + 2
grade = [[altura(*toLL(X0 + i * PASSO, Z0 + j * PASSO)) for i in range(nx)] for j in range(nz)]
# suaviza (3x3) o chiado do modelo de 30 m
suave = [[sum(grade[max(0, min(nz - 1, j + b))][max(0, min(nx - 1, i + a))] for a in (-1, 0, 1) for b in (-1, 0, 1)) / 9 for i in range(nx)] for j in range(nz)]
base = min(min(l) for l in suave)
h = [round((v - base) * 10) for l in suave for v in l]
out = dict(fonte='AWS Terrain Tiles (Terrarium) - SRTM/NASA e outros, dados abertos', x0=round(X0, 2), z0=round(Z0, 2), passo=PASSO,
           nx=nx, nz=nz, base=round(base, 1), escala=0.1, h=h)
json.dump(out, open('dados/relevo.json', 'w'), separators=(',', ':'))
ac = [x / 10 for x in h]
print(f'grade {nx}x{nz} a cada {PASSO} m · altitude {base:.0f} a {base + max(ac):.0f} m (desnível {max(ac):.0f} m) · '
      f'{os.path.getsize("dados/relevo.json") // 1024} KB · mosaicos {len(mosaicos)}')
# desnível na área central (1 km em volta do centro)
c = [grade[j][i] for j in range(nz) for i in range(nx) if abs(X0 + i * PASSO) < 1000 and abs(Z0 + j * PASSO) < 1000]
print(f'centro (2x2 km): {min(c):.0f} a {max(c):.0f} m')
