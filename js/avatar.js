// Avatar em terceira pessoa: o personagem escolhido na tela inicial (Maicon ou um da Quaternius);
// se o arquivo não carregar, um boneco de caixas
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { scene, $ } from './cena.js';
import { status } from './cidade.js';
import { ALTURA_AVATAR, AVATAR_PADRAO } from './config.js';
import { DUR } from './luta.js';
import { acharArma } from './tiro.js';

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
function usarBoneco(){ suporte.clear(); av.mixer=null; av.acoes={}; av.acaoAtual=null; av.arma=null; av.boneco=criarBoneco(); suporte.add(av.boneco); }
// sem boneco de caixas de saída: o avatar só aparece quando o personagem escolhido carrega

const gltfLoader=new GLTFLoader();
const draco=new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
gltfLoader.setDRACOLoader(draco); gltfLoader.setMeshoptDecoder(MeshoptDecoder);

function carregarGLB(buf){
  gltfLoader.parse(buf,'',gltf=>{
    const m=gltf.scene; m.updateMatrixWorld(true);
    const cx=new THREE.Box3().setFromObject(m,true), tam=cx.getSize(new THREE.Vector3()), centro=cx.getCenter(new THREE.Vector3());
    if(!(tam.y>0)){ $('status').textContent='Não consegui medir esse modelo.'; return; }
    const esc=ALTURA_AVATAR/tam.y;
    m.position.set(-centro.x*esc,-cx.min.y*esc,-centro.z*esc); m.scale.multiplyScalar(esc);
    m.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    suporte.clear(); suporte.add(m); av.boneco=null;
    av.mixer=null; av.acoes={}; av.acaoAtual=null; av.golpes={}; av.golpeSeq=null;
    av.arma=acharArma(m); botaoArma();
    if(gltf.animations.length){
      const mixer=av.mixer=new THREE.AnimationMixer(m);
      const achar=re=>gltf.animations.find(a=>re.test(a.name));
      const andar=achar(/walk|andar|caminh/i), correr=achar(/run|corr|sprint|jog/i), parado=achar(/idle|stand|parad|breath/i);
      const unico=!andar&&!correr&&!parado ? gltf.animations[0] : null;
      const A=c=>c?mixer.clipAction(c):null;
      const acena=achar(/acenar|wave|clap/i);
      av.acoes={parado:A(parado), andar:A(andar||correr||unico), correr:A(correr||andar||unico), acenar:A(acena)};   // acenar: só quem tem o gesto
      av.golpes=acoesDeGolpe(mixer,gltf.animations);
    }
  },err=>{ console.error(err); $('status').textContent='Erro ao ler o GLB: '+(err.message||err); });
}

// Golpes do Mixamo (19/11): animações "Soco", "Soco2"… e "Chute", "Chute2"… no GLB do personagem.
// Quem tem toca o golpe de verdade (alternando as variações); quem não tem segue com a pose por código (luta.js).
export function acoesDeGolpe(mixer, anims){
  const lista=re=>anims.filter(c=>re.test(c.name)).sort((a,b)=>a.name.localeCompare(b.name)).map(c=>{
    const a=mixer.clipAction(c); a.setLoop(THREE.LoopOnce,1); a.clampWhenFinished=true; a.golpe=true; return a; });
  return { soco:lista(/^soco\d*$/i), chute:lista(/^chute\d*$/i) };
}
// o golpe visível dura até 1,5× o tempo do golpe no jogo (o clipe do Mixamo é acelerado para caber)
export function velocidadeGolpe(a, tipo){ return Math.max(1, a.getClip().duration/(DUR[tipo]*1.5)); }
// true se o personagem tem o golpe do Mixamo (e ele foi disparado)
export function animarGolpe(tipo, seq){
  const l=av.golpes?.[tipo]; if(!av.mixer||!l?.length) return false;
  if(av.golpeSeq!==seq){ av.golpeSeq=seq; const a=l[seq%l.length];
    a.timeScale=velocidadeGolpe(a,tipo);
    if(av.acaoAtual&&av.acaoAtual!==a) av.acaoAtual.fadeOut(0.08);
    a.reset().fadeIn(0.08).play(); av.acaoAtual=a; }
  return true;
}

// botão 👊 do celular vira 🔫 com personagem armado
function botaoArma(){ const b=document.querySelector('#luta [data-golpe="soco"]'); if(!b) return;
  b.textContent=av.arma?'🔫':'👊'; b.title=av.arma?'Atirar (J)':'Soco (J)'; }

export function animar(estado){
  if(!av.mixer) return;
  if(av.acaoAtual?.golpe&&av.acaoAtual.isRunning()) return;     // deixa o soco/chute terminar
  const nova=av.acoes[estado]||(estado==='acenar'?av.acoes.parado:null)||null;
  if(nova===av.acaoAtual) return;
  if(av.acaoAtual) av.acaoAtual.fadeOut(0.25);
  if(nova) nova.reset().fadeIn(0.25).play();
  av.acaoAtual=nova;
}

// Personagem escolhido na tela inicial (não há mais upload de .glb): carrega o arquivo e troca
let pedido=0;
// buf: o arquivo já baixado pela prévia da tela inicial (entra na hora, sem baixar de novo)
export async function usarPersonagem(url, buf){
  const meu=++pedido;
  try{ if(!buf){ const r=await fetch(url); if(!r.ok) throw new Error('HTTP '+r.status); buf=await r.arrayBuffer(); } if(meu===pedido) carregarGLB(buf); }
  catch(e){ console.warn('Personagem indisponível:',url,e); if(meu===pedido) usarBoneco(); }
}
