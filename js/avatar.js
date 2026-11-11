// Avatar em terceira pessoa: GLB padrão (assets/), GLB do usuário (guardado no IndexedDB)
// ou, se nada carregar, um boneco de caixas
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { scene, $ } from './cena.js';
import { status } from './cidade.js';
import { ALTURA_AVATAR, AVATAR_PADRAO } from './config.js';

export const jogador = new THREE.Group(); scene.add(jogador);
const sombra = new THREE.Mesh(new THREE.CircleGeometry(0.45,24).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.35,depthWrite:false}));
sombra.position.y=0.03; jogador.add(sombra);
export const suporte = new THREE.Group(); jogador.add(suporte);

// estado mutável compartilhado com o loop
export const av = { boneco:null, mixer:null, acoes:{}, acaoAtual:null, giroExtra:0 };

function criarBoneco(){
  const g=new THREE.Group();
  const M=c=>new THREE.MeshLambertMaterial({color:c});
  const caixa=(w,h,d,c,x,y,z)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(c)); m.position.set(x,y,z); return m; };
  g.add(caixa(0.46,0.62,0.26,0xF97316,0,1.16,0));
  const cab=new THREE.Mesh(new THREE.SphereGeometry(0.15,16,12),M(0xe8b796)); cab.position.y=1.62; g.add(cab);
  const membro=(c,x,y,h)=>{ const p=new THREE.Group(); p.position.set(x,y,0); const m=caixa(0.15,h,0.16,c,0,-h/2,0); p.add(m); g.add(p); return p; };
  g.userData.partes=[membro(0x1f2937,-0.12,0.85,0.85),membro(0x1f2937,0.12,0.85,0.85),membro(0xF97316,-0.31,1.45,0.6),membro(0xF97316,0.31,1.45,0.6)];
  return g;
}
function usarBoneco(){ suporte.clear(); av.mixer=null; av.acoes={}; av.acaoAtual=null; av.boneco=criarBoneco(); suporte.add(av.boneco); $('rm').hidden=true; }
usarBoneco();

const gltfLoader=new GLTFLoader();
const draco=new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
gltfLoader.setDRACOLoader(draco); gltfLoader.setMeshoptDecoder(MeshoptDecoder);

function carregarGLB(buf,salvar,padrao){
  gltfLoader.parse(buf,'',gltf=>{
    const m=gltf.scene; m.updateMatrixWorld(true);
    const cx=new THREE.Box3().setFromObject(m), tam=cx.getSize(new THREE.Vector3()), centro=cx.getCenter(new THREE.Vector3());
    if(!(tam.y>0)){ $('status').textContent='Não consegui medir esse modelo.'; return; }
    const esc=ALTURA_AVATAR/tam.y;
    m.position.set(-centro.x*esc,-cx.min.y*esc,-centro.z*esc); m.scale.multiplyScalar(esc);
    m.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    suporte.clear(); suporte.add(m); av.boneco=null;
    av.mixer=null; av.acoes={}; av.acaoAtual=null;
    if(gltf.animations.length){
      const mixer=av.mixer=new THREE.AnimationMixer(m);
      const achar=re=>gltf.animations.find(a=>re.test(a.name));
      const andar=achar(/walk|andar|caminh/i), correr=achar(/run|corr|sprint|jog/i), parado=achar(/idle|stand|parad|breath/i);
      const unico=!andar&&!correr&&!parado ? gltf.animations[0] : null;
      const A=c=>c?mixer.clipAction(c):null;
      av.acoes={parado:A(parado), andar:A(andar||correr||unico), correr:A(correr||andar||unico)};
    }
    $('rm').hidden=!!padrao;
    $('status').textContent=`Avatar carregado · ${gltf.animations.length} animação(ões)`+(gltf.animations.length?'':' — sem animação, ele desliza');
    setTimeout(status,4000);
    if(salvar) guardar(buf);
  },err=>{ console.error(err); $('status').textContent='Erro ao ler o GLB: '+(err.message||err); });
}

export function animar(estado){
  if(!av.mixer) return;
  const nova=av.acoes[estado]||null;
  if(nova===av.acaoAtual) return;
  if(av.acaoAtual) av.acaoAtual.fadeOut(0.25);
  if(nova) nova.reset().fadeIn(0.25).play();
  av.acaoAtual=nova;
}

// avatar padrão: arquivo em assets/ (se falhar, fica o boneco de caixas)
async function padrao(){
  try{ const r=await fetch(AVATAR_PADRAO); if(!r.ok) throw new Error('HTTP '+r.status); carregarGLB(await r.arrayBuffer(),false,true); }
  catch(e){ console.warn('Avatar padrão indisponível:',e); usarBoneco(); }
}

// guarda o avatar escolhido pelo usuário no navegador para não precisar recarregar toda vez
function db(){ return new Promise((ok,no)=>{ const r=indexedDB.open('matelandia3d',1); r.onupgradeneeded=()=>r.result.createObjectStore('a'); r.onsuccess=()=>ok(r.result); r.onerror=()=>no(r.error); }); }
async function guardar(buf){ try{ const d=await db(); d.transaction('a','readwrite').objectStore('a').put(buf,'avatar'); }catch(e){} }
async function esquecer(){ try{ const d=await db(); d.transaction('a','readwrite').objectStore('a').delete('avatar'); }catch(e){} }
async function restaurar(){ try{ const d=await db(); const r=d.transaction('a').objectStore('a').get('avatar'); r.onsuccess=()=>{ if(r.result) carregarGLB(r.result,false); else padrao(); }; r.onerror=()=>padrao(); }catch(e){ padrao(); } }
restaurar();

const lerArquivo=f=>{ if(f) f.arrayBuffer().then(b=>carregarGLB(b,true)); };
$('file').addEventListener('change',e=>{ lerArquivo(e.target.files[0]); e.target.value=''; });
$('rm').addEventListener('click',()=>{ esquecer(); padrao(); });
addEventListener('dragover',e=>{ e.preventDefault(); $('drop').style.display='flex'; });
addEventListener('dragleave',()=>{ $('drop').style.display='none'; });
addEventListener('drop',e=>{ e.preventDefault(); $('drop').style.display='none'; lerArquivo(e.dataTransfer.files[0]); });
