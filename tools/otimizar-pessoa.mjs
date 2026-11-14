// Enxuga os personagens da Quaternius (CC0) para o jogo:
//  - fica só o que o jogo usa, com nomes iguais nos dois conjuntos:
//    parado, andar, correr, sentar, acenar, mexer (as outras animações saem);
//  - resample tira quadro-chave redundante; dedup/prune limpam o resto;
//  - compressão meshopt sem perda (o GLTFLoader do jogo já tem o MeshoptDecoder).
// Uso (dentro de matelandia-3d/): node tools/otimizar-pessoa.mjs <pasta-com-glb> assets/pessoas
import { readdirSync, statSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, quantize, resample } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

const [fonte, saida] = process.argv.slice(2);
if (!fonte || !saida) { console.error('uso: node tools/otimizar-pessoa.mjs <pasta> assets/pessoas'); process.exit(1); }
// nome original (sem o prefixo "Man_"/"Female_") → nome no jogo
// (os da Poly Pizza vêm com o prefixo do esqueleto, "CharacterArmature|Walk", e o "Animated Woman" usa Walking/Running/SitIdle)
const USADAS = { Idle:'parado', Idle_Neutral:null, Walk:'andar', Walking:'andar', Run:'correr', Running:'correr', Sitting:'sentar', SitIdle:'sentar',
  Wave:'acenar', Clapping:'acenar', Interact:'mexer', PickUp:'mexer' };

await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions([...ALL_EXTENSIONS]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
mkdirSync(saida, { recursive: true });
let antes = 0, depois = 0;
for (const arq of readdirSync(fonte).filter(n => n.endsWith('.glb'))) {
  const doc = await io.read(join(fonte, arq));
  const vistos = new Set();
  for (const a of doc.getRoot().listAnimations()) {
    const base = a.getName().replace(/^.*\|/, '').replace(/^(Man|Female)_/, ''), novo = USADAS[base];
    if (!novo || vistos.has(novo)) { a.dispose(); continue; }
    a.setName(novo); vistos.add(novo);
  }
  await doc.transform(resample(), dedup(), prune({ keepLeaves: true }),
    quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }));   // KHR_mesh_quantization: o three lê direto
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const destino = join(saida, arq);
  await io.write(destino, doc);
  const a = statSync(join(fonte, arq)).size, d = statSync(destino).size; antes += a; depois += d;
  console.log(`${arq}: ${Math.round(a/1024)} KB → ${Math.round(d/1024)} KB · ${[...vistos].join(', ')}`);
}
console.log(`total: ${Math.round(antes/1024)} KB → ${Math.round(depois/1024)} KB`);
