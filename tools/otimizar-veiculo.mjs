// Enxuga um veículo gerado por IA (TRELLIS: ~280 mil triângulos, 12 MB) para o jogo:
//  - centraliza (x = z = 0), apoia no chão (y = 0) e escala UNIFORME até o comprimento real
//    (o TRELLIS já sai com o comprimento no eixo Z, entre -0,5 e 0,5);
//  - simplifica com o meshoptimizer até --tri triângulos;
//  - fica só a textura de cor, reduzida para --tex px em WebP;
//  - grava com compressão meshopt (o GLTFLoader do jogo já tem o MeshoptDecoder).
// Uso (dentro de matelandia-3d/):
//   node tools/otimizar-veiculo.mjs <entrada.glb> assets/veiculos/<nome>.glb --comp=4.7 [--tri=30000] [--tex=1024] [--girar=180]
// --girar=180 vira o modelo quando a frente sai para trás. Frente do jogo = -Z.
// As bibliotecas vêm de tools/node_modules (junção, fora do git).
import { statSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization } from '@gltf-transform/extensions';
import { prune, quantize, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';

const [entrada, destino] = process.argv.slice(2);
const opc = Object.fromEntries(process.argv.slice(4).map(a => a.replace(/^--/, '').split('=')));
if (!entrada || !destino || !opc.comp) { console.error('uso: node tools/otimizar-veiculo.mjs entrada.glb saida.glb --comp=4.7 [--tri=30000] [--tex=1024] [--girar=180]'); process.exit(1); }
const COMP = Number(opc.comp), ALVO = Number(opc.tri ?? 30000), TEX = Number(opc.tex ?? 1024), VIRA = Number(opc.girar ?? 0) === 180;

await MeshoptEncoder.ready; await MeshoptSimplifier.ready;
const doc = await new NodeIO().registerExtensions([...ALL_EXTENSIONS]).read(entrada);
const prims = doc.getRoot().listMeshes().flatMap(m => m.listPrimitives());
if (prims.length !== 1) throw new Error(`esperava 1 primitiva, achei ${prims.length}`);
const prim = prims[0];
// o nó pode ter transformação: aplica na geometria para medir no espaço do mundo
const no = doc.getRoot().listNodes().find(n => n.getMesh());
const M = no.getWorldMatrix();

await doc.transform(weld());
const P = prim.getAttribute('POSITION'), N = prim.getAttribute('NORMAL');
const pos = new Float32Array(P.getArray()), nor = N ? new Float32Array(N.getArray()) : null, n = P.getCount();
for (let i = 0; i < n; i++) {
  const x = pos[i*3], y = pos[i*3+1], z = pos[i*3+2];
  pos[i*3]   = M[0]*x + M[4]*y + M[8]*z  + M[12];
  pos[i*3+1] = M[1]*x + M[5]*y + M[9]*z  + M[13];
  pos[i*3+2] = M[2]*x + M[6]*y + M[10]*z + M[14];
  if (nor) { const a = nor[i*3], b = nor[i*3+1], c = nor[i*3+2];
    const u = M[0]*a + M[4]*b + M[8]*c, v = M[1]*a + M[5]*b + M[9]*c, w = M[2]*a + M[6]*b + M[10]*c, l = Math.hypot(u, v, w) || 1;
    nor[i*3] = u/l; nor[i*3+1] = v/l; nor[i*3+2] = w/l; }
}
const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], pos[i*3+k]); mx[k] = Math.max(mx[k], pos[i*3+k]); }
const tam = [mx[0]-mn[0], mx[1]-mn[1], mx[2]-mn[2]];
if (tam[2] < tam[0]) console.warn('aviso: o lado mais comprido não está em Z — confira o modelo');
const e = COMP / tam[2], cx = (mn[0]+mx[0])/2, cz = (mn[2]+mx[2])/2, s = VIRA ? -1 : 1;
for (let i = 0; i < n; i++) {
  pos[i*3] = s*(pos[i*3]-cx)*e; pos[i*3+1] = (pos[i*3+1]-mn[1])*e; pos[i*3+2] = s*(pos[i*3+2]-cz)*e;
  if (nor && VIRA) { nor[i*3] *= -1; nor[i*3+2] *= -1; }
}
P.setArray(pos); if (N) N.setArray(nor);

const ind = prim.getIndices();
let idx = new Uint32Array(ind.getArray());
if (idx.length > ALVO*3) {
  const [novo, erro] = MeshoptSimplifier.simplify(idx, pos, 3, ALVO*3, 0.02, ['Permissive']);
  console.log(`triângulos ${idx.length/3} → ${novo.length/3} (erro ${erro.toFixed(4)})`);
  idx = novo;
}

// documento novo só com o necessário
const out = new Document(); const buf = out.createBuffer();
const acc = (tipo, arr) => out.createAccessor().setType(tipo).setArray(arr).setBuffer(buf);
const corOrig = prim.getMaterial()?.getBaseColorTexture();
const p = out.createPrimitive().setIndices(acc('SCALAR', idx));
p.setAttribute('POSITION', acc('VEC3', pos));
if (nor) p.setAttribute('NORMAL', acc('VEC3', nor));
const uv = prim.getAttribute('TEXCOORD_0'); if (uv) p.setAttribute('TEXCOORD_0', acc('VEC2', new Float32Array(uv.getArray())));
const mat = out.createMaterial('carroceria').setMetallicFactor(0).setRoughnessFactor(0.75);
if (corOrig) {
  const img = await sharp(Buffer.from(corOrig.getImage())).resize(TEX, TEX).webp({ quality: 82 }).toBuffer();
  mat.setBaseColorTexture(out.createTexture('cor').setImage(new Uint8Array(img)).setMimeType('image/webp'));
}
p.setMaterial(mat);
const medidas = { comprimento: +(tam[2]*e).toFixed(2), largura: +(tam[0]*e).toFixed(2), altura: +(tam[1]*e).toFixed(2) };
out.createScene('veiculo').addChild(out.createNode('corpo').setMesh(out.createMesh('corpo').addPrimitive(p))).setExtras({ medidas });
out.createExtension(EXTTextureWebP).setRequired(true);
out.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
await out.transform(prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12 }));
mkdirSync(dirname(destino), { recursive: true });
await new NodeIO().registerExtensions([EXTMeshoptCompression, EXTTextureWebP, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).write(destino, out);
const kb = f => Math.round(statSync(f).size / 1024);
console.log(`${entrada}: ${kb(entrada)} KB → ${destino}: ${kb(destino)} KB · ${medidas.comprimento} × ${medidas.largura} × ${medidas.altura} m`);
