// Gangues de motoqueiros (25/11, pedido do Maicon: "as gangues de motoqueiros na cidade em 4", ideia do
// Couro & Asfalto). Quatro bondes com nome FICTÍCIO (brasão de motoclube real só com autorização), cada um
// rodando em comboio de 4 choppers no seu canto da cidade. Na paz, passam roncando e mexem com o jogador.
// Bater num deles ou atropelar → o bonde inteiro vem atrás (a pé, eles batem; de carro, cercam e xingam)
// por 45 s ou até o jogador sumir a 180 m. Derrubado, o motoqueiro levanta a moto depois de 8 s.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene, $ } from './cena.js';
import { ruas } from './cidade.js';
import { porModo } from './config.js';
import { rotaRuas } from './policia.js';
import { pontoNaRua } from './socorro.js';
import { prepararRodas, girarRodas, sentar, CHOPPER } from './moto.js';
import { levarPancada, vida } from './luta.js';
import * as veic from './veiculos.js';

export const BONDES=[
  { nome:'Lobos do Asfalto',   cor:0x6b7280, ic:'🐺' },
  { nome:'Caveiras da 277',    cor:0x1f2937, ic:'💀' },
  { nome:'Serpentes do Oeste', cor:0x15803d, ic:'🐍' },
  { nome:'Falcões de Ferro',   cor:0xb45309, ic:'🦅' },
];
const POR_BONDE=porModo(4,3), ATIVOS=porModo(2,1), RAIO_TERR=480, ESPACO=7, VEL=11;
const PILOTOS=['male-punk-24','male-suit-24','male-casual-2-24','male-farmer-24','male-worker-24'];
const FALA_PAZ=['Respeita o colete!','Bonita a moto, hein?','Aqui é território nosso!','Vrum vrum!','Bora, irmão!'];
const FALA_RAIVA=['Mexeu com um, mexeu com todos!','Pega ele!','Vai aprender a respeitar!'];
const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
let moldeMoto=null, moldes=[], falar=()=>{}, pronto=false;
const sorte=()=>Math.random(), sorteia=l=>l[(sorte()*l.length)|0];
let tAviso=0; function avisar(t){ const a=$('aviso'); if(!a) return; a.textContent=t; a.style.opacity=1; clearTimeout(tAviso); tAviso=setTimeout(()=>a.style.opacity=0,3500); }

export async function iniciarMotoqueiros(fala, carregarModelo){
  falar=fala;
  const [m,...p]=await Promise.all([new Promise(ok=>loader.load('assets/veiculos/chopper.glb',g=>ok(g.scene),undefined,()=>ok(null))), ...PILOTOS.map(n=>carregarModelo(n).catch(()=>null))]);
  moldeMoto=m; moldes=p.filter(Boolean); if(!moldeMoto||!moldes.length) return;
  // território de cada bonde: o centro de cada quadrante da malha de ruas
  const pts=[]; for(const r of ruas) if(!r.pe) for(const q of r.pts) pts.push(q);
  const med=k=>{ const v=pts.map(q=>q[k]).sort((a,b)=>a-b); return v[v.length>>1]; }, cx=med(0), cz=med(1);
  BONDES.forEach((b,i)=>{ const sx=i%2?1:-1, sz=i<2?-1:1, q=pts.filter(p=>(p[0]-cx)*sx>40&&(p[1]-cz)*sz>40&&Math.hypot(p[0]-cx,p[1]-cz)<900);
    b.centro=q.length?[q.reduce((s,p)=>s+p[0],0)/q.length, q.reduce((s,p)=>s+p[1],0)/q.length]:[cx+sx*300,cz+sz*300]; b.motos=[]; b.raiva=0; });
  pronto=true;
}

function montarMoto(b,i){
  const obj=moldeMoto.clone(true); obj.userData={...moldeMoto.userData}; obj.rotation.order='YXZ';
  const cor=new THREE.Color(b.cor);
  obj.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color.lerp(cor,0.45); } });
  const rodas=prepararRodas(obj);
  const m=moldes[(i+BONDES.indexOf(b))%moldes.length], boneco=clonarEsqueleto(m.cena), e=1.8/m.altura;
  boneco.scale.multiplyScalar(e); boneco.position.y=-m.base*e;
  boneco.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false; o.material=o.material.clone(); if(!/skin|eye|hair|brow|face/i.test(o.material.name)) o.material.color.lerp(cor,0.7); } });   // colete na cor do bonde
  const corpo=new THREE.Group(); corpo.add(boneco);
  scene.add(obj,corpo);
  return { obj, corpo, ...rodas, x:0, z:0, h:0, v:0, posada:false, caido:0, soco:0, fala:3+sorte()*8 };
}
function nascerBonde(b,jog){
  const q=pontoNaRua(jog.x,jog.z,110,190); if(!q) return false;
  if(Math.hypot(q[0]-b.centro[0],q[1]-b.centro[1])>RAIO_TERR+150) return false;
  if(!b.motos.length) for(let i=0;i<POR_BONDE;i++) b.motos.push(montarMoto(b,i));
  b.trilha=[[q[0],q[1]]]; b.rota=null; b.ri=0; b.raiva=0; b.ativo=true;
  for(const m of b.motos){ m.x=q[0]; m.z=q[1]; m.caido=0; m.obj.visible=m.corpo.visible=true; m.posada=false; }
  return true;
}
function sumirBonde(b){ b.ativo=false; for(const m of b.motos){ m.obj.visible=m.corpo.visible=false; } }

// líder segue uma rota pelas ruas até um ponto do território; os outros vão na trilha dele, um atrás do outro
function andarLider(b,m,dt){
  if(!b.rota||b.ri>=b.rota.length){ const d=pontoNaRua(b.centro[0],b.centro[1],60,RAIO_TERR)||b.centro; b.rota=rotaRuas(m.x,m.z,d[0],d[1]); b.ri=0; if(!b.rota.length) b.rota=[d]; }
  const [tx,tz]=b.rota[b.ri], dx=tx-m.x, dz=tz-m.z, d=Math.hypot(dx,dz);
  if(d<3){ b.ri++; return; }
  const alvoH=Math.atan2(-dx,-dz); let dh=alvoH-m.h; dh=Math.atan2(Math.sin(dh),Math.cos(dh));
  m.h+=Math.max(-2.5*dt,Math.min(2.5*dt,dh)); const vAlvo=Math.abs(dh)>0.5?6:VEL; m.v+=(vAlvo-m.v)*Math.min(1,dt*1.5);
  m.x+=-Math.sin(m.h)*m.v*dt; m.z+=-Math.cos(m.h)*m.v*dt; m.inc=-dh*0.6;
  const u=b.trilha[b.trilha.length-1]; if(Math.hypot(m.x-u[0],m.z-u[1])>1) { b.trilha.push([m.x,m.z]); if(b.trilha.length>60) b.trilha.shift(); }
}
function naTrilha(b,m,k,dt){                                             // k-ésimo da fila: ESPACO*k metros atrás do líder
  const T=b.trilha; let falta=ESPACO*k, i=T.length-1;
  while(i>0){ const L=Math.hypot(T[i][0]-T[i-1][0],T[i][1]-T[i-1][1]); if(L>=falta){ const t=falta/L; const x=T[i][0]+(T[i-1][0]-T[i][0])*t, z=T[i][1]+(T[i-1][1]-T[i][1])*t;
      const nh=Math.atan2(-(T[i][0]-T[i-1][0]),-(T[i][1]-T[i-1][1])); const dist=Math.hypot(x-m.x,z-m.z);
      m.v=dist/Math.max(dt,1e-3); m.x=x; m.z=z; let dh=nh-m.h; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); m.h+=dh*Math.min(1,dt*6); m.inc=-dh*0.6; return; }
    falta-=L; i--; }
  m.v=0;                                                                 // trilha curta (acabou de nascer): espera parado
}
function cacar(b,m,dt,jog,k){                                            // com raiva: cerca o jogador, cada um num lado
  const ang=k*Math.PI/2+b.raiva*0.15, tx=jog.x+Math.cos(ang)*1.7, tz=jog.z+Math.sin(ang)*1.7;
  const dx=tx-m.x, dz=tz-m.z, d=Math.hypot(dx,dz), dj=Math.hypot(jog.x-m.x,jog.z-m.z);
  const alvoH=Math.atan2(-dx,-dz); let dh=alvoH-m.h; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); m.h+=Math.max(-3*dt,Math.min(3*dt,dh));
  const vAlvo=d<0.8?0:Math.min(16,d*0.9); m.v+=(vAlvo-m.v)*Math.min(1,dt*2); m.inc=-dh*0.5;
  m.x+=-Math.sin(m.h)*m.v*dt; m.z+=-Math.cos(m.h)*m.v*dt;
  m.soco-=dt;
  if(dj<2.6&&m.soco<=0){ m.soco=2.2+sorte()*1.2;
    if(k<2&&!jog.dirigindo&&vida.caido<=0) levarPancada(6,(jog.x-m.x)/(dj||1),(jog.z-m.z)/(dj||1));   // só 2 batem; os outros cercam
    if(sorte()<0.35) falar(m,sorteia(FALA_RAIVA),2); }
}
function derrubar(b,m,motivo){
  m.caido=8; m.v=0;
  if(b.raiva<=0){ avisar(`${b.ic} ${motivo} Os ${b.nome} vieram atrás de você!`); falar(m,'Ô! Mexeu com o bonde errado!',3); }
  b.raiva=45;
}

export function atualizarMotoqueiros(dt, jog){
  if(!pronto) return;
  // quais bondes rodam: os de território mais perto do jogador (até ATIVOS)
  const ordem=[...BONDES].sort((a,c)=>Math.hypot(a.centro[0]-jog.x,a.centro[1]-jog.z)-Math.hypot(c.centro[0]-jog.x,c.centro[1]-jog.z));
  ordem.forEach((b,i)=>{ const perto=i<ATIVOS&&Math.hypot(b.centro[0]-jog.x,b.centro[1]-jog.z)<RAIO_TERR+350;
    if(b.ativo&&(!perto&&b.raiva<=0)) sumirBonde(b);
    else if(!b.ativo&&perto&&sorte()<dt*0.2) nascerBonde(b,jog); });
  const V=veic.dirigindo;
  for(const b of BONDES){ if(!b.ativo) continue;
    const lider=b.motos[0]; let longe=true;
    if(b.raiva>0){ b.raiva-=dt; if(Math.hypot(lider.x-jog.x,lider.z-jog.z)>180||b.motos.every(m=>m.caido>0)) b.raiva=0;
      if(b.raiva<=0){ b.trilha=[[lider.x,lider.z]]; b.rota=null; avisar(`${b.ic} Os ${b.nome} desistiram de você`); } }
    b.motos.forEach((m,k)=>{
      if(m.caido>0){ m.caido-=dt; m.v=0; }
      else if(b.raiva>0) cacar(b,m,dt,jog,k);
      else if(k===0) andarLider(b,m,dt);
      else naTrilha(b,m,k,dt);
      const dj=Math.hypot(m.x-jog.x,m.z-jog.z); if(dj<200) longe=false;
      // atropelado pelo jogador (carro/moto andando)
      if(V&&m.caido<=0&&Math.abs(V.v)>4&&Math.hypot(m.x-V.obj.position.x,m.z-V.obj.position.z)<(V.comp||3)/2+0.8) derrubar(b,m,'Você atropelou um motoqueiro!');
      // pose: moto e piloto
      m.obj.position.set(m.x,0,m.z); m.obj.rotation.y=m.h;
      m.obj.rotation.z=THREE.MathUtils.lerp(m.obj.rotation.z, m.caido>0?1.35:Math.max(-0.4,Math.min(0.4,m.inc||0)), Math.min(1,dt*5));
      if(dj<120){ girarRodas(m,dt); sentar(m.corpo,m.obj,!m.posada,CHOPPER); m.posada=true; }
      m.fala-=dt; if(m.fala<=0){ m.fala=9+sorte()*12; if(b.raiva<=0&&dj<16&&sorte()<0.5) falar(m,sorteia(FALA_PAZ),2.5); }
    });
    if(longe&&b.raiva<=0) sumirBonde(b);
  }
}
// soco/chute do jogador num motoqueiro (gangues.js chama junto com as gangues a pé)
export function golpearMotoqueiro(x,z,fx,fz,tipo){
  for(const b of BONDES){ if(!b.ativo) continue;
    for(const m of b.motos){ if(m.caido>0) continue; const ax=m.x-x, az=m.z-z, d=Math.hypot(ax,az);
      if(d>2.2||(ax*fx+az*fz)/(d||1)<0.3) continue;
      m.vida=(m.vida??3)-(tipo==='chute'?1.5:1);
      if(m.vida<=0){ m.vida=3; derrubar(b,m,'Você derrubou um motoqueiro!'); }
      else { falar(m,'Ai! Tá louco?',1.5); if(b.raiva<=0){ avisar(`${b.ic} Você bateu num dos ${b.nome}!`); } b.raiva=45; }
      return true; } }
  return false;
}
export const posicoesMotoqueiros=()=>BONDES.flatMap(b=>b.ativo?b.motos.map(m=>[m.x,m.z]):[]);
export const _testeMoto={ BONDES, nascerBonde };
