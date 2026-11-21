// Pedestre feito por IA (TRELLIS + Mixamo) → GLB do jogo com os clipes que o pedestres.js usa:
// parado, andar, correr, acenar, mexer. Primeira: Dona Maria (20/11/2026).
// O movimento de avanço do quadril (x/z) é tirado: quem anda o pedestre pela calçada é o jogo.
// uso (em matelandia-3d/tools): npx tsx fbx-para-glb-pedestre.mts <personagem.fbx> <textura.jpg> <saida.glb> nome=arquivo.fbx ...
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample, weld } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import sharp from 'sharp';

// sem DOM (mesmos remendos do fbx-para-glb-luta.mts)
(globalThis as any).self = globalThis;
(globalThis as any).window = globalThis;
(globalThis as any).document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {} }) };
(globalThis as any).FileReader = class {
  result: unknown = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(b: Blob) { b.arrayBuffer().then((r) => ((this.result = r), this.onloadend?.())); }
  readAsDataURL(b: Blob) { b.arrayBuffer().then((r) => ((this.result = `data:${b.type};base64,${Buffer.from(r).toString('base64')}`), this.onloadend?.())); }
};
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');

const [arqBoneco, arqTextura, saida, ...pares] = process.argv.slice(2);
const lerFbx = (arq: string) => { const b = readFileSync(arq); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };

const boneco = lerFbx(arqBoneco);
boneco.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.material = new THREE.MeshStandardMaterial({ name: 'pele', roughness: 0.85 }); });
const quadrilY = (boneco.getObjectByName('mixamorigHips') as THREE.Object3D).position.y;

const clips: THREE.AnimationClip[] = [];
for (const par of pares) {
  const [nome, arq] = par.split('=');
  const clip = lerFbx(arq).animations[0];
  clip.name = nome;
  clip.tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion') || t.name === 'mixamorigHips.position');
  const q = clip.tracks.find((t) => t.name === 'mixamorigHips.position');
  if (q) {
    // no lugar: x/z do quadril presos no 1º quadro; altura na escala deste boneco (clipe baixado em outro boneco)
    const k = q.values[1] > 0 && Math.abs(quadrilY / q.values[1] - 1) > 0.05 ? quadrilY / q.values[1] : 1;
    const x0 = q.values[0], z0 = q.values[2];
    for (let i = 0; i < q.values.length; i += 3) { q.values[i] = x0 * k; q.values[i + 1] *= k; q.values[i + 2] = z0 * k; }
  }
  clips.push(clip);
  console.log(nome, clip.duration.toFixed(2), 's,', clip.tracks.length, 'trilhas (' + arq.split(/[\/]/).pop() + ')');
}

const glb = (await new GLTFExporter().parseAsync(boneco, { binary: true, animations: clips })) as ArrayBuffer;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression, KHRMeshQuantization]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.readBinary(new Uint8Array(glb));
// flip: a UV do FBX conta v de baixo para cima e a do glTF de cima para baixo
const jpg = await sharp(arqTextura).resize(1024, 1024).flip().jpeg({ quality: 85 }).toBuffer();
const textura = doc.createTexture('pele').setImage(new Uint8Array(jpg)).setMimeType('image/jpeg');
for (const m of doc.getRoot().listMaterials()) m.setBaseColorTexture(textura).setMetallicFactor(0);
await doc.transform(weld(), resample(), dedup(), prune({ keepLeaves: true }), quantize({ pattern: /^WEIGHTS/, quantizeWeight: 16 }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
writeFileSync(saida, await io.writeBinary(doc));
console.log('ok', saida);
