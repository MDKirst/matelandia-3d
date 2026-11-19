// Onde estão os socos dentro de cada clipe: alcance da mão (à frente do peito) ao longo do tempo
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
(globalThis as any).self = globalThis; (globalThis as any).window = globalThis;
(globalThis as any).document = { createElementNS: () => ({ addEventListener() {}, removeEventListener() {}, setAttribute() {}, style: {} }) };
const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js');
const ler = (a: string) => { const b = readFileSync(a); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), ''); };
const [pasta, ...arqs] = process.argv.slice(2);
const boneco = ler(join(pasta, 'Fortao.fbx'));
const osso = (n: string) => boneco.getObjectByName(n)!;
const mD = osso('mixamorigRightHand'), mE = osso('mixamorigLeftHand'), peito = osso('mixamorigSpine2');
const a = new THREE.Vector3(), p = new THREE.Vector3();
for (const arq of arqs) {
  const clip = ler(join(pasta, arq)).animations[0];
  clip.tracks = clip.tracks.filter(t => t.name.endsWith('.quaternion') || t.name === 'mixamorigHips.position');
  const mixer = new THREE.AnimationMixer(boneco); const ac = mixer.clipAction(clip); ac.play();
  const linhas: string[] = []; const serie: [number, number, number][] = [];
  for (let t = 0; t <= clip.duration; t += 1 / 30) {
    mixer.setTime(t); boneco.updateMatrixWorld(true); peito.getWorldPosition(p);
    const d = mD.getWorldPosition(a).z - p.z, e = mE.getWorldPosition(a).z - p.z; serie.push([t, d, e]);
  }
  // picos: máximo local acima de 60% do maior alcance
  for (const [k, nome] of [[1, 'D'], [2, 'E']] as const) {
    const mx = Math.max(...serie.map(s => s[k]));
    for (let i = 2; i < serie.length - 2; i++) { const v = serie[i][k];
      if (v > mx * 0.6 && v >= serie[i - 1][k] && v >= serie[i + 1][k] && v >= serie[i - 2][k] && v >= serie[i + 2][k]) linhas.push(`${nome}@${serie[i][0].toFixed(2)}s(${v.toFixed(0)})`); }
  }
  console.log(`${arq} ${clip.duration.toFixed(2)}s · repouso D ${serie[0][1].toFixed(0)} E ${serie[0][2].toFixed(0)} · picos: ${linhas.join(' ')}`);
  ac.stop(); mixer.uncacheRoot(boneco);
}
