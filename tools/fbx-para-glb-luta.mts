// Piloto do Mixamo (FBX com esqueleto) + animações do Mixamo (FBX "Without Skin") → um GLB para o jogo.
// O FBXLoader e o GLTFExporter do three rodam no Node com dois remendos (sem DOM: a textura do FBX
// fica de fora e entra depois pelo gltf-transform, a mesma PNG que foi para o Mixamo).
// Cópia do Couro & Asfalto (scripts/modelos-ia/fbx-para-glb.ts) para o Matelândia 3D, 19/11/2026: + golpes de luta.
// Animações da pasta jogo/GDB; os golpes (Soco/Chute) e a guarda vêm de jogo/GDB/luta e são opcionais
// (o que não estiver lá fica de fora; sem golpe o jogo usa a pose por código do luta.js).
// uso (em matelandia-3d/tools): npx tsx fbx-para-glb-luta.mts <personagem.fbx> <textura.png> <pasta GDB> <saida.glb> [pasta com os clipes de luta]
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

// sem DOM: imagem vazia para o FBXLoader e FileReader em cima do Blob do Node para o GLTFExporter
(globalThis as any).self = globalThis;
(globalThis as any).window = globalThis;
(globalThis as any).document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {} }) };
(globalThis as any).FileReader = class {
  result: unknown = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(b: Blob) {
    b.arrayBuffer().then((r) => ((this.result = r), this.onloadend?.()));
  }
  readAsDataURL(b: Blob) {
    b.arrayBuffer().then((r) => ((this.result = `data:${b.type};base64,${Buffer.from(r).toString('base64')}`), this.onloadend?.()));
  }
};
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

const [arqPiloto, arqTextura, pastaAnim, saida, pastaLuta] = process.argv.slice(2);
// arquivo do Mixamo → nome que o jogo usa (tipo Animacao em src/jogo/bonecos.ts)
const ANIMACOES: Record<string, string> = {
  'Sitting Idle': 'Sitting',
  'Breathing Idle': 'Idle',
  Running: 'Run',
  'Injured Walk': 'Walk',
  Victory: 'Jump',
  Clapping: 'Clapping',
  'Falling Back Death': 'Death',
  'Getting Up': 'Standing',
  // encontro do fim da corrida: dança quando vence, soca o ar quando fica de fora do pódio
  'Hip Hop Dancing': 'Danca1',
  'Brooklyn Uprock': 'Danca2',
  'Rumba Dancing': 'Danca3',
  'Jab Cross': 'Punch',
};

const lerFbx = (arq: string) => {
  const b = readFileSync(arq);
  return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '');
};

const piloto = lerFbx(arqPiloto);
piloto.traverse((o) => {
  const m = o as THREE.SkinnedMesh;
  if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ name: 'piloto', roughness: 0.8 });
});
// luta (19/11): clipes do Mixamo baixados pelo Maicon (com pele: o FBXLoader só usa o movimento). Cada clipe tem vários
// socos seguidos; o jogo recorta UM soco (~0,55 s em volta do pico do alcance da mão, achado com tools/picos-soco.mts).
// O jogo alterna Soco, Soco2… a cada J (avatar.js acoesDeGolpe). Sem chute: o K segue com a pose por código.
const LUTA: { arq: string; nome: string; de?: number; ate?: number }[] = [
  { arq: 'Fight Idle', nome: 'Idle' },                         // guarda de lutador no lugar da respiração parada
  { arq: 'Punching Bag', nome: 'Soco', de: 0.83, ate: 1.38 },  // direto de direita
  { arq: 'Punching Bag', nome: 'Soco2', de: 0.17, ate: 0.72 }, // jab de esquerda
  { arq: 'Fist Fight A', nome: 'Soco3', de: 1.27, ate: 1.82 }, // esquerda longa
  { arq: 'Hook', nome: 'Soco4', de: 0.9, ate: 1.45 },          // gancho de esquerda
];
const temGuarda = !!pastaLuta && existsSync(join(pastaLuta, 'Fight Idle.fbx'));
// Animações da pasta GDB foram baixadas em OUTRO boneco: o quadril vem noutra escala (o Fortão afundava 95 cm andando).
// Uma escala só para a pasta toda, medida na respiração em pé (Breathing Idle) contra o quadril do personagem em pé.
// Os clipes de luta foram baixados no próprio personagem: não mexe.
const quadrilY = (piloto.getObjectByName('mixamorigHips') as THREE.Object3D).position.y;
const filtrar = (clip: THREE.AnimationClip, k = 1) => {
  clip.tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === 'mixamorigHips.position');
  const q = clip.tracks.find((t) => t.name === 'mixamorigHips.position');
  if (q && k !== 1) for (let i = 0; i < q.values.length; i++) q.values[i] *= k;
  return clip;
};
const kGDB = (() => { const q = lerFbx(join(pastaAnim, 'Breathing Idle.fbx')).animations[0].tracks.find((t) => t.name === 'mixamorigHips.position');
  const k = q && q.values[1] > 0 ? quadrilY / q.values[1] : 1; console.log(`quadril das animações GDB ×${k.toFixed(2)}`); return Math.abs(k - 1) > 0.05 ? k : 1; })();
// recorte reamostrado a 30 qps: TODAS as trilhas ficam (o subclip do three descarta osso com poucas chaves → pose T no golpe)
const recortar = (clip: THREE.AnimationClip, de: number, ate: number) => new THREE.AnimationClip(clip.name, ate - de, clip.tracks.map((t) => {
  const it = t.createInterpolant(), n = Math.round((ate - de) * 30) + 1, tempos: number[] = [], vals: number[] = [];
  for (let i = 0; i < n; i++) { const tt = Math.min(ate, de + i / 30); tempos.push(tt - de); vals.push(...(it.evaluate(tt) as ArrayLike<number>)); }
  const T = t.constructor as any; return new T(t.name, tempos, vals);
}));
const clips: THREE.AnimationClip[] = [];
if (pastaLuta) for (const g of LUTA) {
  const caminho = join(pastaLuta, `${g.arq}.fbx`);
  if (!existsSync(caminho)) { console.log('(sem', g.arq + ')'); continue; }
  let clip = filtrar(lerFbx(caminho).animations[0]);
  if (g.de !== undefined) clip = recortar(clip, g.de, g.ate!);
  clip.name = g.nome; clips.push(clip);
  console.log(g.nome, clip.duration.toFixed(2), 's,', clip.tracks.length, 'trilhas (' + g.arq + ')');
}
for (const [arq, nome] of Object.entries(ANIMACOES)) {
  const caminho = join(pastaAnim, `${arq}.fbx`);
  if (arq === 'Breathing Idle' && temGuarda) continue;
  const clip = lerFbx(caminho).animations[0];
  clip.name = nome;
  filtrar(clip, kGDB);   // só giro dos ossos + posição do quadril (na escala do personagem)
  clips.push(clip);
  console.log(nome, clip.duration.toFixed(2), 's,', clip.tracks.length, 'trilhas');
}

const glb = (await new GLTFExporter().parseAsync(piloto, { binary: true, animations: clips })) as ArrayBuffer;

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.readBinary(new Uint8Array(glb));
// flip: a UV do FBX conta v de baixo para cima e a do glTF de cima para baixo (sem isso a roupa sai embaralhada)
const jpg = await sharp(arqTextura).resize(1024, 1024).flip().jpeg({ quality: 85 }).toBuffer();
const textura = doc.createTexture('piloto').setImage(new Uint8Array(jpg)).setMimeType('image/jpeg');
for (const m of doc.getRoot().listMaterials()) m.setBaseColorTexture(textura).setMetallicFactor(0);
await doc.transform(weld(), resample(), dedup(), prune({ keepLeaves: true }), quantize({ pattern: /^WEIGHTS/, quantizeWeight: 16 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
writeFileSync(saida, await io.writeBinary(doc));
console.log('ok', saida);
