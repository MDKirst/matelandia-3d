// Gatos e cavalos (pedido do Maicon em 21/11). Modelos da Quaternius (CC0, Poly Pizza: "Cat" 2f54vbV0In e
// "White Horse" bEdE4rmZy9), enxugados por tools/otimizar-cao.mjs para assets/animais; cada bicho ganha uma cor.
//  - Gatos: na calçada perto do povo, mais à noite; ficam parados, andam devagar e miam. Fogem do jogador que chega
//    perto, do carro que vem rápido e dos cachorros (caes.js).
//  - Cavalos: pastando nos terrenos baldios (sem dono nem negócio) perto do jogador. Quem chega por trás leva coice.
// Quem chama é o pedestres.js, junto com os cachorros. Só existem perto da câmera.
import * as THREE from 'three';
import { porModo } from './config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene } from './cena.js';
import { bloqueado } from './mundo.js';
import { lotes, meu } from './terrenos.js';
import { posicoesCaes } from './caes.js';
import { levarPancada } from './luta.js';
import { somPancada } from './som.js';

const ESPECIES = {
  gato:   { arq:'assets/animais/gato.glb',   alt:[0.3,0.38], qtd:porModo(6,3), mat:'Cat_Main', cores:[0xe08a3c,0x8d8d8d,0x2b2b2b,0xf2efe8,0xc9a26b], balao:-1.75 },
  cavalo: { arq:'assets/animais/cavalo.glb', alt:[1.75,1.95], qtd:porModo(3,2), mat:'Main',     cores:[null,0x7a4a26,0x2d2523,0xb9b3a9,0xa86b32],      balao:-0.2 },
};
const MIAUS = ['Miau!','Miaaau…','Mrrr','Miau?'], CHIADOS = ['Fffff!','Ssss!'], RELINCHOS = ['Iiirrrííí!','Rrrrr!','Hmpf!'];
const sorte = ()=>Math.random(), sorteia = l=>l[(sorte()*l.length)|0];
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const moldes = {};
export const bichos = [];
let falarFn = ()=>{};

function carregar(nome){
  const E=ESPECIES[nome];
  return new Promise(ok=>loader.load(E.arq, g=>{
    g.scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(g.scene,true), anims={};
    for(const a of g.animations) anims[a.name]=a;
    moldes[nome]={ cena:g.scene, anims, altura:(box.max.y-box.min.y)||1, base:box.min.y }; ok(true);
  }, undefined, ()=>ok(false)));
}
export async function iniciarAnimais(falar){
  falarFn=falar;
  await Promise.all(Object.keys(ESPECIES).map(carregar));
  for(const [esp,E] of Object.entries(ESPECIES)) if(moldes[esp]) for(let i=0;i<E.qtd;i++) bichos.push({ esp, obj:null });
  return bichos.length;
}

function vestir(b){
  const E=ESPECIES[b.esp], m=moldes[b.esp], obj=clonarEsqueleto(m.cena), e=(E.alt[0]+sorte()*(E.alt[1]-E.alt[0]))/m.altura;
  obj.scale.multiplyScalar(e); b.pe=-m.base*e;
  const cor=sorteia(E.cores);
  obj.traverse(o=>{ if(!o.isMesh) return; o.frustumCulled=false;
    if(cor!=null&&o.material?.name===E.mat){ o.material=o.material.clone(); o.material.color.setHex(cor); } });
  scene.add(obj);
  Object.assign(b,{ obj, mixer:new THREE.AnimationMixer(obj), acoes:{}, atual:null, y:E.balao });
  for(const [n,a] of Object.entries(m.anims)) b.acoes[n]=b.mixer.clipAction(a);
}
function sumir(b){ if(b.obj){ scene.remove(b.obj); b.mixer.stopAllAction(); b.obj=null; } }
function animar(b, nome, vel=1){
  const a=b.acoes[nome]||b.acoes.parado; if(!a) return;
  a.timeScale=vel; if(a===b.atual) return;
  if(b.atual) b.atual.fadeOut(0.25);
  a.reset().fadeIn(0.25).play(); b.atual=a;
}
function andar(b, dx, dz){
  const nx=b.x+dx, nz=b.z+dz;
  if(b.cerca&&!dentroDoLote(b.cerca,nx,nz)) return false;
  if(!bloqueado(nx,nz)){ b.x=nx; b.z=nz; return true; }
  if(!bloqueado(nx,b.z)){ b.x=nx; return true; }
  if(!bloqueado(b.x,nz)){ b.z=nz; return true; }
  return false;
}
function virarPara(b, alvo, dt, k=6){ let d=alvo-b.rumo; d=Math.atan2(Math.sin(d),Math.cos(d)); b.rumo+=d*Math.min(1,dt*k); }

// terreno: x = frente 0..12 (ao longo da rua), z = fundo 0..24 (para dentro). Cavalo fica numa folga do meio.
const noLote=(l,u,v)=>[l.A[0]+l.t[0]*u+l.n[0]*v, l.A[1]+l.t[1]*u+l.n[1]*v];
function dentroDoLote(l,x,z){ const dx=x-l.A[0], dz=z-l.A[1], u=dx*l.t[0]+dz*l.t[1], v=dx*l.n[0]+dz*l.n[1], W=l.w||12, D=l.d||24; return u>1.5&&u<W-1.5&&v>2.5&&v<D-3; }
const baldio=l=>!l.dono&&!l.negocio&&!l.especial&&!(l.blocos?.size)&&!meu(l);

function nascer(b, gente, px, pz){
  const d=(x,z)=>Math.hypot(x-px,z-pz);
  if(b.esp==='cavalo'){
    const livres=lotes.filter(l=>baldio(l)&&!bichos.some(o=>o.cerca===l)&&d(l.cx??l.A[0],l.cz??l.A[1])>30&&d(l.cx??l.A[0],l.cz??l.A[1])<140);
    if(!livres.length) return false;
    const l=sorteia(livres), W=l.w||12, D=l.d||24, [x,z]=noLote(l,W*(0.25+sorte()*0.5),D*(0.2+sorte()*0.5));
    vestir(b); Object.assign(b,{ x, z, rumo:sorte()*Math.PI*2, cerca:l, modo:'comer', t:2+sorte()*5, falou:0, coice:0 });
    return true; }
  // gato: perto de um pedestre (já está na calçada), um pouco para o lado
  const cand=gente.filter(p=>p.obj&&d(p.x,p.z)>20&&d(p.x,p.z)<120); if(!cand.length) return false;
  const p=sorteia(cand), a=sorte()*Math.PI*2, x=p.x+Math.sin(a)*2.5, z=p.z+Math.cos(a)*2.5;
  if(bloqueado(x,z)) return false;
  vestir(b); Object.assign(b,{ x, z, rumo:a, cerca:null, modo:'parado', t:2+sorte()*6, falou:3+sorte()*10, coice:0 });
  return true;
}

// jog: {x,z,dirigindo,v,veic}; gente: pedestres; fator: gente na rua nesta hora (0–1, de madrugada perto de 0)
export function atualizarAnimais(dt, jog, gente, fator=1){
  if(!bichos.length) return;
  const caes=posicoesCaes(), quota={ gato:Math.round(ESPECIES.gato.qtd*(fator<0.5?1:0.6)), cavalo:ESPECIES.cavalo.qtd }, conta={ gato:0, cavalo:0 };
  for(const b of bichos){
    const k=conta[b.esp]++;
    if(!b.obj||Math.hypot(b.x-jog.x,b.z-jog.z)>170||(b.cerca&&!baldio(b.cerca))){
      if(k>=quota[b.esp]){ sumir(b); continue; }
      sumir(b); if(!nascer(b,gente,jog.x,jog.z)) continue; }
    if(b.esp==='gato') moverGato(b,dt,jog,caes); else moverCavalo(b,dt,jog);
    b.obj.position.set(b.x,b.pe,b.z); b.obj.rotation.y=b.rumo;
    if(Math.hypot(b.x-jog.x,b.z-jog.z)<porModo(80,40)) b.mixer.update(dt);
  }
}

function moverGato(b, dt, jog, caes){
  b.t-=dt; b.falou-=dt;
  const dx=jog.x-b.x, dz=jog.z-b.z, dJog=Math.hypot(dx,dz);
  // ameaça: jogador a pé muito perto, carro rápido ou cachorro por perto → foge para o lado oposto
  let ax=0, az=0, medo=null;
  if(!jog.dirigindo&&dJog<3.2){ ax=-dx; az=-dz; medo='jogador'; }
  else if(jog.dirigindo&&Math.abs(jog.v)>5&&dJog<10){ ax=-dx; az=-dz; medo='carro'; }
  for(const [cx,cz] of caes){ const d=Math.hypot(cx-b.x,cz-b.z); if(d<7){ ax+=(b.x-cx)*2; az+=(b.z-cz)*2; medo='cachorro'; } }
  if(medo){
    if(b.modo!=='fugir'){ b.modo='fugir'; if(b.falou<=0||medo==='cachorro'){ falarFn(b,sorteia(CHIADOS),1.2); b.falou=6; } }
    b.t=1.5; virarPara(b,Math.atan2(ax,az),dt,10);
    if(!andar(b,Math.sin(b.rumo)*4.2*dt,Math.cos(b.rumo)*4.2*dt)) b.rumo+=Math.PI/2*(sorte()<0.5?1:-1);
    animar(b,'andar',3); return; }
  if(b.modo==='fugir'&&b.t>0){ andar(b,Math.sin(b.rumo)*3*dt,Math.cos(b.rumo)*3*dt); animar(b,'andar',2.4); return; }
  // jogador parado ali perto (a pé): mia para ele de vez em quando
  if(!jog.dirigindo&&dJog<7&&b.falou<=0){ falarFn(b,sorteia(MIAUS),1.6); b.falou=10+sorte()*10; virarPara(b,Math.atan2(dx,dz),1,1); }
  if(b.t<=0){ const r=sorte(); b.modo=r<0.35?'andar':r<0.85?'parado':'pular'; b.t=b.modo==='pular'?1:2+sorte()*6; if(b.modo==='andar') b.rumo+=(sorte()-0.5)*2.5; }
  if(b.modo==='andar'){ if(!andar(b,Math.sin(b.rumo)*0.7*dt,Math.cos(b.rumo)*0.7*dt)) b.rumo+=Math.PI*(0.5+sorte()); animar(b,'andar'); }
  else animar(b,b.modo);
}

function moverCavalo(b, dt, jog){
  b.t-=dt; b.falou-=dt; b.coice-=dt;
  const dx=jog.x-b.x, dz=jog.z-b.z, dJog=Math.hypot(dx,dz);
  if(b.modo==='coice'){                                                    // coice em andamento: acerta no meio do golpe
    animar(b,'latir');
    if(!b.acertou&&b.t<0.7){ b.acertou=true;
      const fx=Math.sin(b.rumo), fz=Math.cos(b.rumo), tx=jog.x-b.x, tz=jog.z-b.z;
      if(!jog.dirigindo&&Math.hypot(tx,tz)<2.4&&tx*fx+tz*fz<0){ levarPancada(12,-fx,-fz); somPancada(); } }
    if(b.t<=0){ b.modo='parado'; b.t=1.5; } return; }
  // jogador a pé atrás do cavalo e colado: coice (avisa com um bufo antes)
  { const fx=Math.sin(b.rumo), fz=Math.cos(b.rumo);
    if(!jog.dirigindo&&dJog<2.2&&dx*fx+dz*fz<-0.6&&b.coice<=0){ b.modo='coice'; b.t=1.3; b.acertou=false; b.coice=6; falarFn(b,sorteia(RELINCHOS),1.4); return; } }
  // carro rápido ali do lado: galopa um pouco dentro do terreno
  if(jog.dirigindo&&Math.abs(jog.v)>8&&dJog<14&&b.modo!=='galope'){ b.modo='galope'; b.t=2.5; b.rumo=Math.atan2(-dx,-dz); if(b.falou<=0){ falarFn(b,sorteia(RELINCHOS),1.4); b.falou=8; } }
  if(b.modo==='galope'){ if(!andar(b,Math.sin(b.rumo)*5*dt,Math.cos(b.rumo)*5*dt)) b.rumo+=Math.PI*(0.6+sorte()*0.8); animar(b,'correr'); if(b.t<=0){ b.modo='parado'; b.t=2; } return; }
  if(b.t<=0){ const r=sorte(); b.modo=r<0.5?'comer':r<0.7?'farejar':r<0.85?'parado':'andar'; b.t=3+sorte()*7; if(b.modo==='andar') b.rumo+=(sorte()-0.5)*3; }
  if(b.modo==='andar'){ if(!andar(b,Math.sin(b.rumo)*1.1*dt,Math.cos(b.rumo)*1.1*dt)) b.rumo+=Math.PI*(0.5+sorte()); animar(b,'andar'); }
  else animar(b,b.modo);
}
export const posicoesAnimais=()=>bichos.filter(b=>b.obj).map(b=>[b.x,b.z,b.esp]);
