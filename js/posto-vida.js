// Vida nos postos (pedido do Maicon em 21/11): carros e motos entram pela rua, param na bomba, o frentista vai até
// eles com a mangueira e abastece; depois saem. Na conveniência 24 h o atendente atende quem entra para comprar.
// Tudo em coordenadas do lote do posto (u = ao longo da rua 0..24, v = para dentro 0..20; a rua fica em v < 0),
// levadas para o mundo pelo grupo do lote. Só existe com o jogador a menos de ~90 m. Chamado por especiais.js.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene } from './cena.js';
import { carregarModelo, falar, PESSOAS } from './pedestres.js';
import { prepararRodas, girarRodas, sentar, URBANA } from './moto.js';
import { horaJogo, fatorPessoas } from './ceu.js';
import { LEVE } from './config.js';

const PERTO=90, LONGE=120;
const CARROS=['hatch','sedan','suv','picape','suv2','picape2'], MOTOS=['urbana','trail','classica'];
const PISTAS=[{ v:3.7, casa:[8.0,5.2], bomba:[9.6,5.2] }, { v:8.0, casa:[8.0,6.6], bomba:[9.6,6.6] }];   // pista 1: entre os pilares da frente e a ilha; pista 2: entre as ilhas (frentista em cima da ilha)   // frentista: onde espera e onde abastece
const PARA=9.3;                                                                   // u onde o veículo para na bomba
const PEDIDOS=['Completa, por favor!','Cinquenta no comum!','Enche o tanque!','Vinte de etanol!','Calibra o pneu também?'];
const RESPOSTAS=['Pode deixar!','É pra já!','Já vou!','Beleza, chefe!'];
const OBRIGADO=['Valeu!','Obrigado!','Boa viagem!','Volte sempre!'];
const sorte=()=>Math.random(), sorteia=l=>l[(sorte()*l.length)|0];
const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const veics={}; let carregando=null;
function carregarVeiculos(){ return carregando ??= Promise.all([...CARROS,...MOTOS].map(a=>new Promise(ok=>loader.load(`assets/veiculos/${a}.glb`,g=>{ veics[a]=g.scene; ok(); },undefined,()=>ok())))); }

const postos=[];   // { l, vivo, gente, veiculos, ... }
export function iniciarPostoVida(lotes){ for(const l of lotes) if(l.especial?.tipo==='posto') postos.push({ l, vivo:false }); return postos.length; }

// lote → mundo
const V=new THREE.Vector3();
const mundo=(p,u,v)=>{ p.l.grupo.updateMatrixWorld(); return p.l.grupo.localToWorld(V.set(u,0,v)).clone(); };
const rumoMundo=(p,du,dv)=>p.l.grupo.rotation.y+Math.atan2(du,dv);              // boneco: frente = +Z
function boneco(m, alt){
  const obj=clonarEsqueleto(m.cena), e=alt/m.altura; obj.scale.multiplyScalar(e); obj.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
  const corpo=new THREE.Group(); obj.position.y=-m.base*e; corpo.add(obj); scene.add(corpo);
  const mixer=new THREE.AnimationMixer(obj), acoes={}; for(const [n,c] of Object.entries(m.anims)) acoes[n]=mixer.clipAction(c);
  return { corpo, obj, mixer, acoes, atual:null, x:0, z:0, y:0 };
}
function animar(b,nome,vel=1){ const a=b.acoes[nome]||b.acoes.parado; if(!a) return; a.timeScale=vel; if(a===b.atual) return; if(b.atual) b.atual.fadeOut(0.25); a.reset().fadeIn(0.25).play(); b.atual=a; }
function porNoLugar(p,b,u,v,rumo){ const w=mundo(p,u,v); b.u=u; b.v=v; b.x=w.x; b.z=w.z; b.corpo.position.set(w.x,0,w.z); if(rumo!=null) b.corpo.rotation.y=rumo; }
// anda até (u,v); devolve true quando chegou
function irAte(p,b,u,v,dt,vel=1.3){
  const du=u-b.u, dv=v-b.v, d=Math.hypot(du,dv); if(d<0.12){ return true; }
  const s=Math.min(d,vel*dt); porNoLugar(p,b,b.u+du/d*s,b.v+dv/d*s,rumoMundo(p,du,dv)); animar(b,'andar',vel/1.3); return false;
}
function sumir(b){ if(!b) return; scene.remove(b.corpo); b.mixer?.stopAllAction(); }

async function acordar(p){
  p.carregando=true;
  const [mF,mF2,mA]=await Promise.all(['male-worker-24','female-worker-24','female-formal-24'].map(carregarModelo));
  await carregarVeiculos();
  p.moldes=(await Promise.all([...PESSOAS].sort(()=>sorte()-0.5).slice(0,5).map(carregarModelo))).filter(Boolean);
  if(!mF||!mA){ p.carregando=false; return; }
  // frentistas (um por pista) com mangueira; atendente atrás do balcão da conveniência
  p.frentistas=PISTAS.map((pi,i)=>{ const b=boneco(i?(mF2||mF):mF,1.72); b.pista=pi; b.modo='espera'; porNoLugar(p,b,pi.casa[0],pi.casa[1],rumoMundo(p,0,-1)); animar(b,'parado'); return b; });
  p.atendente=boneco(mA,1.66); porNoLugar(p,p.atendente,18.5,13.6,rumoMundo(p,0,-1)); animar(p.atendente,'parado');
  const mang=new THREE.MeshLambertMaterial({color:0x111111});
  p.mangueiras=PISTAS.map(()=>{ const m=new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.035,1,6),mang); m.visible=false; scene.add(m); return m; });
  p.veiculos=[null,null]; p.clientes=[]; p.proxVeic=2+sorte()*4; p.proxCliente=3+sorte()*6;
  p.vivo=true; p.carregando=false;
}
function dormir(p){
  for(const b of [...(p.frentistas||[]),p.atendente,...(p.clientes||[])]) sumir(b);
  for(const v of p.veiculos||[]) if(v){ scene.remove(v.obj); sumir(v.piloto); }
  for(const m of p.mangueiras||[]) scene.remove(m);
  Object.assign(p,{ vivo:false, frentistas:null, atendente:null, clientes:null, veiculos:null, mangueiras:null });
}

// veículo chegando: carro (≈70%) ou moto com piloto; entra pela rua do lado esquerdo e sai pela direita
function novoVeiculo(p,k){
  const moto=sorte()<0.3&&p.moldes.length, nome=moto?sorteia(MOTOS.filter(a=>veics[a])):sorteia(CARROS.filter(a=>veics[a])); if(!nome) return;
  const obj=veics[nome].clone(true); obj.userData={...veics[nome].userData}; obj.rotation.order='YXZ';
  let raio=0.3, rodas=null;
  if(moto){ const tam=new THREE.Box3().setFromObject(veics[nome]).getSize(new THREE.Vector3()); obj.scale.setScalar(2.05/tam.z); const r=prepararRodas(obj); rodas=r.rodas; raio=r.raio*obj.scale.x; }
  scene.add(obj);
  const lane=PISTAS[k].v, c={ obj, moto:!!moto, rodas, raio, v:0, pista:k, u:-6, vv:-3.5, h:0, fase:'chegando', t:0,
    rota:[[-6,-3.5],[3.2,-2.0],[4.6,lane],[PARA,lane]] };   // desvia do totem de preços (u 1,5)
  if(moto){ const m=sorteia(p.moldes); c.piloto=boneco(m,1.7); c.posado=false; }
  p.veiculos[k]=c;
}
function moverVeiculo(p,c,dt){
  const alvo=c.rota[0]; if(!alvo) return true;
  const du=alvo[0]-c.u, dv=alvo[1]-c.vv, d=Math.hypot(du,dv), fim=c.rota.length===1&&c.fase==='chegando';
  const vmax=fim?Math.max(0.6,Math.min(4,d*1.2)):5; c.v+=Math.max(-6*dt,Math.min(3*dt,vmax-c.v));
  if(d<0.15||(fim&&d<0.25)){ c.rota.shift(); if(!c.rota.length){ c.v=0; return true; } return false; }
  const s=Math.min(d,c.v*dt); c.u+=du/d*s; c.vv+=dv/d*s;
  const h=Math.atan2(-du,-dv); let dh=h-c.h; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); c.h+=dh*Math.min(1,dt*5);   // frente do veículo = −Z
  return false;
}
function posarVeiculo(p,c,dt){
  const w=mundo(p,c.u,c.vv); c.obj.position.set(w.x,0,w.z); c.obj.rotation.y=p.l.grupo.rotation.y+c.h; c.obj.rotation.z=c.moto&&c.v<0.2?0:0;
  if(c.rodas) girarRodas(c,dt);
  if(c.piloto){ sentar(c.piloto.corpo,c.obj,!c.posado,URBANA); c.posado=true; c.piloto.x=w.x; c.piloto.z=w.z; c.piloto.y=0.4; }
}

function atualizarPosto(p,dt,h){
  const mov=Math.max(0.25,fatorPessoas(h));
  // frentistas e veículos, pista por pista
  PISTAS.forEach((pi,k)=>{ const f=p.frentistas[k], c=p.veiculos[k], mg=p.mangueiras[k];
    if(!c){ p.proxVeic-=dt/2; if(p.proxVeic<=0&&!p.veiculos.some(o=>o&&o.fase==='chegando'&&o.u<2)){ p.proxVeic=(LEVE?14:8)+sorte()*12/mov; novoVeiculo(p,k); } }
    else {
      if(c.fase==='chegando'){ if(moverVeiculo(p,c,dt)){ c.fase='esperando'; c.t=0; falar(c.piloto||{obj:c.obj,x:c.obj.position.x,z:c.obj.position.z,y:0.2},sorteia(PEDIDOS),2.2); f.modo='indo'; } }
      else if(c.fase==='abastecendo'){ c.t-=dt; if(c.t<=0){ c.fase='saindo'; f.modo='voltando'; mg.visible=false; falar(f,sorteia(OBRIGADO),1.8);
          c.rota=[[13.6,pi.v],[17.5,-3.5],[30,-3.5]]; } }   // sai antes da loja (u ≥ 15,5)
      else if(c.fase==='saindo'){ if(moverVeiculo(p,c,dt)){ scene.remove(c.obj); sumir(c.piloto); p.veiculos[k]=null; } }
      posarVeiculo(p,c,dt); }
    // frentista
    if(f.modo==='indo'){ if(irAte(p,f,pi.bomba[0],pi.bomba[1],dt,1.6)){ f.modo='abastece'; const c2=p.veiculos[k]; if(c2){ c2.fase='abastecendo'; c2.t=c2.moto?4+sorte()*2:6+sorte()*4; falar(f,sorteia(RESPOSTAS),1.6); } } }
    else if(f.modo==='abastece'){ const c2=p.veiculos[k]; animar(f,'mexer'); if(c2) f.corpo.rotation.y=rumoMundo(p,c2.u-f.u,c2.vv-f.v);
      // mangueira: da bomba até a mão do frentista (na altura da cintura)
      const a=mundo(p,9.0,pi.v<6?5.95:6.45).setY(1.35), b=mundo(p,f.u+(c2?(c2.u-f.u)*0.35:0),f.v+(c2?(c2.vv-f.v)*0.35:0)).setY(1.0);
      mg.visible=true; mg.position.copy(a).add(b).multiplyScalar(0.5); mg.scale.y=a.distanceTo(b); mg.lookAt(b); mg.rotateX(Math.PI/2);
      if(!c2||c2.fase!=='abastecendo'){ f.modo='voltando'; mg.visible=false; } }
    else if(f.modo==='voltando'){ if(irAte(p,f,pi.casa[0],pi.casa[1],dt,1.3)){ f.modo='espera'; f.corpo.rotation.y=rumoMundo(p,0,-1); } }
    else animar(f, (Math.floor((performance.now()/1000+k*3)/5)%4===0)?'mexer':'parado');
  });
  // conveniência: cliente vem da calçada, entra pela porta (u 21–23), compra no balcão e sai
  p.proxCliente-=dt;
  if(p.proxCliente<=0&&p.clientes.length<2&&p.moldes.length){ p.proxCliente=(LEVE?16:9)+sorte()*14/mov;
    const b=boneco(sorteia(p.moldes),1.6+sorte()*0.25); porNoLugar(p,b,22.3+sorte()*0.6,-2.5); b.passo=0;
    b.rota=[[22.2,5.5],[22.2,8.2],[18.6+sorte()*0.8,11.3],'comprar',[22.2,8.2],[22.2,5.5],[22.4,-3]]; p.clientes.push(b); }
  for(const b of [...p.clientes]){ const r=b.rota[b.passo];
    if(r===undefined){ sumir(b); p.clientes.splice(p.clientes.indexOf(b),1); continue; }
    if(r==='comprar'){ b.t=(b.t||0)+dt; animar(b,b.t%3<1.5?'mexer':'parado'); b.corpo.rotation.y=rumoMundo(p,0,1); animar(p.atendente,'mexer');
      if(!b.falou){ b.falou=true; falar(b,sorteia(['Um café, por favor!','Tem pão de queijo?','Uma água gelada!','Me vê um energético.','Quanto é o salgado?']),2.2); }
      if(b.t>4){ b.passo++; b.t=0; animar(p.atendente,'parado'); falar(p.atendente,sorteia(OBRIGADO),1.6); } }
    else if(irAte(p,b,r[0],r[1],dt,1.3)) b.passo++;
    b.mixer.update(dt); }
  for(const f of p.frentistas) f.mixer.update(dt);
  p.atendente.mixer.update(dt);
  for(const c of p.veiculos) if(c?.piloto) c.piloto.mixer.update(dt);
}

export function atualizarPostoVida(dt,jx,jz){
  const h=horaJogo();
  for(const p of postos){ const d=Math.hypot(p.l.cx-jx,p.l.cz-jz);
    if(d<PERTO&&!p.vivo&&!p.carregando) acordar(p).catch(e=>{ console.warn('posto',e); p.carregando=false; });
    else if(d>LONGE&&p.vivo) dormir(p);
    if(p.vivo) atualizarPosto(p,dt,h); }
}
export const estadoPostos=()=>postos.map(p=>({ id:p.l.id, vivo:p.vivo, veiculos:p.veiculos?.map(v=>v&&{fase:v.fase,moto:v.moto,u:+v.u.toFixed(1)}), frentistas:p.frentistas?.map(f=>f.modo), clientes:p.clientes?.length }));
