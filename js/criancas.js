// Crianças de bicicleta elétrica (pedido do Maicon em 17/11): andam pela calçada e pela beira da rua e
// atravessam do nada, na diagonal, sem olhar — principalmente quando o jogador vem dirigindo.
// A "bike elétrica" é a moto urbana de IA (assets/veiculos/urbana.glb, regra: todo veículo do jogo é de IA)
// encolhida e pintada de cor viva; a criança é um boneco Quaternius em escala de criança, posado
// pelo mesmo sentar() da moto do jogador. Atropelar não machuca: a criança cai, levanta e reclama.
import * as THREE from 'three';
import { porModo } from './config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene } from './cena.js';
import { ruas } from './cidade.js';
import { bloqueado } from './mundo.js';
import { horaJogo, fatorPessoas } from './ceu.js';
import { carregarModelo, falar } from './pedestres.js';
import { prepararRodas, girarRodas, sentar, URBANA } from './moto.js';

const QTD=porModo(9,4), LONGE=210, PERTO_MIN=45, PERTO_MAX=150;
const MODELOS=['male-casual-hoodie-24','female-casual','male-casual','female-jeans','male-punk-24','female-tank-top'];
const CORES=[0xff4fa3,0x2fb5ff,0x7dff4f,0xffd23f,0xb06bff,0xff7a2f];
const COM_CALCADA=new Set(['residential','tertiary','secondary','unclassified','living_street','tertiary_link','secondary_link']);
const FALAS_CAI=['Aiii! Ô tio, olha por onde anda!','Vou contar pra minha mãe!','Quase, hein!','Minha bike!'];
const FALAS_PASSA=['Uhuuul!','Sai da frente!','Bi-bi!','Ninguém me pega!','Corridaaa!'];
const sorte=()=>Math.random(), sorteia=l=>l[(sorte()*l.length)|0];
const frente=h=>[-Math.sin(h),-Math.cos(h)], esquerda=h=>[-Math.cos(h),Math.sin(h)];

export const criancas=[];
let vias=[], nos=new Map(), pronto=false;
const chave=p=>Math.round(p[0]*10)+'_'+Math.round(p[1]*10);

function montarVias(){
  vias=ruas.filter(r=>!r.pe&&COM_CALCADA.has(r.tipo)&&r.pts.length>1).map(r=>{
    const ac=[0]; for(let i=1;i<r.pts.length;i++) ac.push(ac[i-1]+Math.hypot(r.pts[i][0]-r.pts[i-1][0],r.pts[i][1]-r.pts[i-1][1]));
    return { r, ac, L:ac[ac.length-1] }; }).filter(v=>v.L>15);
  nos=new Map();
  for(const v of vias) for(const [i,fim] of [[0,0],[v.r.pts.length-1,1]]){ const k=chave(v.r.pts[i]); if(!nos.has(k)) nos.set(k,[]); nos.get(k).push({v,fim}); }
}
// ponto e direção da via na distância s (medida desde o 1º vértice)
function naVia(v,s){
  const {r,ac}=v; let i=1; while(i<ac.length-1&&ac[i]<s) i++;
  const a=r.pts[i-1], b=r.pts[i], L=ac[i]-ac[i-1]||1, t=Math.max(0,Math.min(1,(s-ac[i-1])/L));
  return { x:a[0]+(b[0]-a[0])*t, z:a[1]+(b[1]-a[1])*t, ux:(b[0]-a[0])/L, uz:(b[1]-a[1])/L };
}
const calcada=v=>v.r.w/2+1.3;

export async function iniciarCriancas(){
  montarVias(); if(!vias.length) return;
  const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const [bike, ...moldes]=await Promise.all([
    new Promise(ok=>loader.load('assets/veiculos/urbana.glb', g=>ok(g), undefined, ()=>ok(null))),
    ...MODELOS.map(carregarModelo)]);
  const ok=moldes.filter(Boolean); if(!bike||!ok.length) return;
  const tam=new THREE.Box3().setFromObject(bike.scene).getSize(new THREE.Vector3()), esc=1.55/tam.z;   // bike elétrica ~1,55 m
  for(let k=0;k<QTD;k++){
    const obj=bike.scene.clone(true); obj.userData={...bike.scene.userData}; obj.rotation.order='YXZ'; obj.scale.setScalar(esc);
    const cor=new THREE.Color(CORES[k%CORES.length]);
    obj.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color.lerp(cor,0.6); o.material.side=THREE.FrontSide; } });
    const rodas=prepararRodas(obj); rodas.raio*=esc;
    const m=ok[k%ok.length], boneco=clonarEsqueleto(m.cena), e=(1.22+sorte()*0.2)/m.altura;   // criança de 1,22 a 1,42 m
    boneco.scale.multiplyScalar(e); boneco.position.y=-m.base*e; boneco.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    const corpo=new THREE.Group(); corpo.add(boneco);
    obj.visible=corpo.visible=false; scene.add(obj); scene.add(corpo);
    criancas.push({ bike:obj, corpo, ...rodas, v:0, h:0, x:0, z:0, y:0.4, obj:corpo, via:null, s:0, dir:1, lat:0, latAlvo:0, vl:0,
      cruzar:2+sorte()*6, cai:0, fala:0, posada:false, vel:5+sorte()*2.5 });
  }
  pronto=true;
}

// põe a criança numa rua com calçada a uma distância boa do jogador (fora do campo de visão imediato)
function nascer(c,px,pz){
  for(let t=0;t<40;t++){
    const v=sorteia(vias), s=sorte()*v.L, q=naVia(v,s), d=Math.hypot(q.x-px,q.z-pz);
    if(d<PERTO_MIN||d>PERTO_MAX) continue;
    const lado=sorte()<0.5?-1:1, lat=lado*calcada(v);
    if(bloqueado(q.x-q.uz*lat,q.z+q.ux*lat)) continue;
    Object.assign(c,{ via:v, s, dir:sorte()<0.5?-1:1, lat, latAlvo:lat, vl:0, cai:0, cruzar:1+sorte()*5 });
    c.bike.visible=c.corpo.visible=true; c.posada=false; return true;
  }
  return false;
}
// chegou no fim da via: segue por outra que sai da mesma esquina (ou dá meia-volta)
function virarEsquina(c){
  const v=c.via, fim=c.dir>0?1:0, p=v.r.pts[fim?v.r.pts.length-1:0];
  const op=(nos.get(chave(p))||[]).filter(o=>o.v!==v);
  if(!op.length){ c.dir=-c.dir; c.s=Math.max(0,Math.min(v.L,c.s)); c.lat=-c.lat; c.latAlvo=-c.latAlvo; return; }
  const o=sorteia(op); c.via=o.v; c.dir=o.fim?-1:1; c.s=o.fim?o.v.L:0;
  c.latAlvo=Math.sign(c.lat||1)*calcada(o.v); c.lat=Math.max(-calcada(o.v),Math.min(calcada(o.v),c.lat));
}

// jog: {x,z,dirigindo,veic:{x,z,h,v}}
export function atualizarCriancas(dt,jog){
  if(!pronto) return;
  const h=horaJogo(), quantas=Math.round(QTD*Math.min(1,fatorPessoas(h)*(h>=6&&h<21?1:0.3)));
  criancas.forEach((c,k)=>{
    const longe=!c.via||Math.hypot(c.x-jog.x,c.z-jog.z)>LONGE;
    if(k>=quantas){ if(longe||!c.bike.visible){ c.bike.visible=c.corpo.visible=false; c.via=null; } }
    else if(longe&&!nascer(c,jog.x,jog.z)){ c.bike.visible=c.corpo.visible=false; return; }
    if(!c.via||!c.bike.visible) return;
    mover(c,dt,jog);
  });
}

function mover(c,dt,jog){
  const v=c.via, borda=calcada(v);
  c.fala=Math.max(0,c.fala-dt);
  if(c.cai>0){                                                                       // caída: bike deitada, depois levanta
    c.cai-=dt; c.v=0; c.bike.rotation.z=THREE.MathUtils.lerp(c.bike.rotation.z, c.cai>0.6?1.35:0, Math.min(1,dt*6));
    posar(c); return; }
  // imprudência: atravessa a rua na diagonal de tempos em tempos e, se o jogador vem de carro, cruza na frente dele
  c.cruzar-=dt;
  const naCalcada=Math.abs(c.lat)>v.r.w/2;
  if(jog.dirigindo&&naCalcada&&Math.hypot(c.x-jog.x,c.z-jog.z)<38&&Math.abs(jog.v)>5&&sorte()<dt*0.9) c.cruzar=0;
  if(c.cruzar<=0){
    const r=sorte();
    if(r<0.75) c.latAlvo=-Math.sign(c.lat||1)*borda;                                    // pro outro lado
    else c.latAlvo=(sorte()*2-1)*(v.r.w/2-0.8);                                         // zigue-zague no meio da rua
    c.cruzar=4+sorte()*9;
    if(c.fala<=0&&sorte()<0.35){ falar(c,sorteia(FALAS_PASSA),2.2); c.fala=8; }
  }
  // velocidade: acelera até a dela; para se o jogador a pé estiver bem na frente
  const [fx,fz]=frente(c.h);
  let alvo=c.vel;
  if(!jog.dirigindo){ const dx=jog.x-c.x, dz=jog.z-c.z; if(Math.hypot(dx,dz)<1.6&&dx*fx+dz*fz>0) alvo=0; }
  c.v+=Math.max(-8*dt,Math.min(3*dt,alvo-c.v));
  c.vl=Math.max(-3.8,Math.min(3.8,(c.latAlvo-c.lat)*2.2));
  const s0=c.s, l0=c.lat;
  c.s+=c.dir*c.v*dt; c.lat+=c.vl*dt;
  if(c.s<0||c.s>v.L){ virarEsquina(c); return mover(c,0,jog); }
  let q=naVia(c.via,c.s), x=q.x-q.uz*c.lat, z=q.z+q.ux*c.lat;
  if(bloqueado(x,z)){                                                                 // calçada estreita (muro, casa): vai pra beira do asfalto
    c.s=s0; c.lat=l0; c.latAlvo=Math.sign(c.latAlvo||1)*(v.r.w/2-0.5);
    q=naVia(c.via,c.s); x=q.x-q.uz*c.lat; z=q.z+q.ux*c.lat; }
  // rumo = direção do movimento (frente + lateral)
  const mx=q.ux*c.dir*c.v-q.uz*c.vl, mz=q.uz*c.dir*c.v+q.ux*c.vl;
  if(Math.hypot(mx,mz)>0.3){ const alvoH=Math.atan2(-mx,-mz); let d=alvoH-c.h; d=Math.atan2(Math.sin(d),Math.cos(d));
    c.h+=d*Math.min(1,dt*6); c.bike.rotation.z=THREE.MathUtils.lerp(c.bike.rotation.z,-d*0.6,Math.min(1,dt*5)); }
  c.x=x; c.z=z;
  girarRodas(c,dt); posar(c);
}
function posar(c){
  c.bike.position.set(c.x,0,c.z); c.bike.rotation.y=c.h;
  sentar(c.corpo,c.bike,!c.posada,URBANA); c.posada=true;
}

// o veículo do jogador (c, na posição x,z,h) encostou numa criança? Ela cai e o carro para.
// Encostado e se afastando, deixa sair (senão travava em cima dela).
export function bateNaCrianca(veic,x,z,h){
  const [fx,fz]=frente(h), [ex,ez]=esquerda(h), p=veic.obj.position;
  for(const c of criancas){ if(!c.via||!c.bike.visible) continue;
    const enc=(px,pz,ph)=>{ const [ax,az]=frente(ph), [bx,bz]=esquerda(ph), dx=c.x-px, dz=c.z-pz;
      return Math.abs(dx*ax+dz*az)<veic.comp/2+0.7 && Math.abs(dx*bx+dz*bz)<veic.larg/2+0.35; };
    if(!enc(x,z,h)) continue;
    if(enc(p.x,p.z,veic.h)&&Math.hypot(c.x-x,c.z-z)>=Math.hypot(c.x-p.x,c.z-p.z)) continue;
    if(Math.abs(veic.v)>1.5&&c.cai<=0){ c.cai=2.8; falar(c,sorteia(FALAS_CAI),3); c.fala=10; c.latAlvo=c.lat; }
    return c;
  }
  return null;
}
// para o trânsito parar e para o minimapa
export const posicoesCriancas=()=>criancas.filter(c=>c.via&&c.bike.visible).map(c=>[c.x,c.z]);
export const estadoCriancas=()=>({ pronto, vias:vias.length, ativas:posicoesCriancas().length, lista:criancas.map(c=>({x:c.x|0,z:c.z|0,v:+c.v.toFixed(1),lat:+c.lat.toFixed(1),cai:c.cai>0})) });
