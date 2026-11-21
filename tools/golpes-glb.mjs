// Arquivo só de golpes (20/11): os socos do Mixamo do Fortão (Soco, Soco2…) e, quando houver, chutes (Chute…),
// sem malha nem textura — só ossos mixamorig* e o giro deles. O avatar.js empresta esses clipes a qualquer
// personagem do Mixamo que não tenha golpe próprio (Maicon, Valdir, Policial, pilotos…). Sem a posição do
// quadril: cada boneco tem a sua altura (o do Fortão afundaria/flutuaria os outros).
// uso (em matelandia-3d/tools): node golpes-glb.mjs ../assets/pessoas/fortao.glb ../assets/pessoas/golpes.glb
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
const [ent, sai] = process.argv.slice(2);
await MeshoptDecoder.ready; await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const doc = await io.read(ent), r = doc.getRoot();
for (const a of r.listAnimations()) {
  if (!/^(soco|chute)\d*$/i.test(a.getName())) { a.dispose(); continue; }
  for (const c of a.listChannels()) if (c.getTargetPath() !== 'rotation') { c.getSampler()?.dispose(); c.dispose(); }
}
for (const n of r.listNodes()) { n.setMesh(null); n.setSkin(null); }
for (const m of r.listMeshes()) m.dispose();
for (const s of r.listSkins()) s.dispose();
for (const e of r.listExtensionsUsed()) e.dispose();
await doc.transform(resample(), dedup(), prune());
doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
await io.write(sai, doc);
console.log('ok', sai, r.listAnimations().map((a) => a.getName() + '(' + a.listChannels().length + ')').join(' '));
