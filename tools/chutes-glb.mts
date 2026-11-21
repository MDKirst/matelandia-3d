// Chutes do Mixamo → assets/pessoas/chutes.glb (20/11), irmão do golpes.glb dos socos: só giro dos ossos mixamorig*,
// sem malha. Cada FBX (baixado pelo Maicon) é recortado em ~0,7 s em volta do instante em que um pé sobe mais alto
// em relação ao quadril; o avatar.js empresta como Chute, Chute2… a todo personagem do Mixamo.
// uso (em matelandia-3d/tools): npx tsx chutes-glb.mts <saida.glb> <chute1.fbx> [chute2.fbx…]
import { readFileSync, writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

(globalThis as any).self = globalThis;
(globalThis as any).window = globalThis;
(globalThis as any).document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {} }) };
(globalThis as any).FileReader = class {
  result: unknown = null; onloadend: (() => void) | null = null;
  readAsArrayBuffer(b: Blob) { b.arrayBuffer().then((r) => ((this.result = r), this.onloadend?.())); }
};
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
const ler = (a: string) => { const b = readFileSync(a); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };

const [saida, ...arqs] = process.argv.slice(2);
let rig: THREE.Object3D | null = null;
const clips: THREE.AnimationClip[] = [];
// recorte reamostrado a 30 qps com TODAS as trilhas (o subclip do three descarta osso com poucas chaves)
const recortar = (clip: THREE.AnimationClip, nome: string, de: number, ate: number) => new THREE.AnimationClip(nome, ate - de, clip.tracks.map((t) => {
  const it = t.createInterpolant(), n = Math.round((ate - de) * 30) + 1, tempos: number[] = [], vals: number[] = [];
  for (let i = 0; i < n; i++) { const tt = Math.min(ate, de + i / 30); tempos.push(tt - de); vals.push(...(it.evaluate(tt) as ArrayLike<number>)); }
  const T = t.constructor as any; return new T(t.name, tempos, vals);
}));
arqs.forEach((arq, i) => {
  const o = ler(arq), clip = o.animations[0];
  clip.tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion'));   // sem posição do quadril: cada boneco tem sua altura
  // pico: pé mais alto em relação ao quadril
  const mixer = new THREE.AnimationMixer(o), ac = mixer.clipAction(clip); ac.play();
  const pes = ['mixamorigRightFoot', 'mixamorigLeftFoot'].map((n) => o.getObjectByName(n)!), q = o.getObjectByName('mixamorigHips')!;
  const a = new THREE.Vector3(), h = new THREE.Vector3(); let melhor = [0, -1e9];
  for (let t = 0; t <= clip.duration; t += 1 / 30) { mixer.setTime(t); o.updateMatrixWorld(true); q.getWorldPosition(h);
    for (const p of pes) { const v = p.getWorldPosition(a).y - h.y; if (v > melhor[1]) melhor = [t, v]; } }
  ac.stop(); mixer.uncacheRoot(o);
  const t = melhor[0], nome = i ? `Chute${i + 1}` : 'Chute';
  clips.push(recortar(clip, nome, Math.max(0, t - 0.4), Math.min(clip.duration, t + 0.3)));
  console.log(nome, `pé no alto em ${t.toFixed(2)} s`, '(' + arq.split(/[\/]/).pop() + ')');
  if (!rig) { o.traverse((x) => { if ((x as THREE.Mesh).isMesh) x.visible = false; }); rig = o; }
});
// só os ossos vão para o GLB
const ossos = new THREE.Group(); ossos.add(rig!.getObjectByName('mixamorigHips')!);
const glb = (await new GLTFExporter().parseAsync(ossos, { binary: true, animations: clips })) as ArrayBuffer;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
const doc = await io.readBinary(new Uint8Array(glb));
await doc.transform(resample(), dedup(), prune({ keepLeaves: true }));
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
writeFileSync(saida, await io.writeBinary(doc));
console.log('ok', saida);
