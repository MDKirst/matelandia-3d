// Piloto do Mixamo (FBX com esqueleto) + animações do Mixamo (FBX "Without Skin") → um GLB para o jogo.
// O FBXLoader e o GLTFExporter do three rodam no Node com dois remendos (sem DOM: a textura do FBX
// fica de fora e entra depois pelo gltf-transform, a mesma PNG que foi para o Mixamo).
// Cópia do Couro & Asfalto (scripts/modelos-ia/fbx-para-glb.ts) para o Matelândia 3D, 19/11/2026: + golpes de luta.
// Animações da pasta jogo/GDB; os golpes (Soco/Chute) e a guarda vêm de jogo/GDB/luta e são opcionais
// (o que não estiver lá fica de fora; sem golpe o jogo usa a pose por código do luta.js).
// uso (em matelandia-3d/tools): npx tsx fbx-para-glb-luta.ts <personagem.fbx> <textura.png> <pasta GDB> <saida.glb>
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

const [arqPiloto, arqTextura, pastaAnim, saida] = process.argv.slice(2);
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
  // luta (19/11): Mixamo, "Without Skin", In Place, em GDB/luta; nomes que o jogo procura em avatar.js
  'luta/Fight Idle': 'Idle',          // guarda de lutador no lugar da respiração parada (se existir)
  'luta/Punching': 'Soco',
  'luta/Hook Punch': 'Soco2',
  'luta/Cross Punch': 'Soco3',
  'luta/Mma Kick': 'Chute',
  'luta/Roundhouse Kick': 'Chute2',
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
const clips: THREE.AnimationClip[] = [];
const temGuarda = existsSync(join(pastaAnim, 'luta/Fight Idle.fbx'));
for (const [arq, nome] of Object.entries(ANIMACOES)) {
  const caminho = join(pastaAnim, `${arq}.fbx`);
  if (!existsSync(caminho)) { if (arq.startsWith('luta/')) { console.log('(sem', arq + ')'); continue; } throw new Error('faltou ' + caminho); }
  if (arq === 'Breathing Idle' && temGuarda) continue;
  const clip = lerFbx(caminho).animations[0];
  // só giro dos ossos + posição do quadril (escala e posição dos outros ossos não mudam)
  clip.tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === 'mixamorigHips.position');
  clip.name = nome;
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
