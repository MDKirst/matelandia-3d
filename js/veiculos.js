// Veículos dirigíveis (SUV, picape, cavalo mecânico, hatch, sedã e motos): estacionados perto do início,
// E (ou o botão no celular) entra e sai, direção simples estilo arcade.
// Convenção dos modelos em assets/veiculos/: frente = -Z, chão em y = 0, medidas reais em metros.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { scene, $ } from './cena.js';
import { ruas, pertoCruzamento } from './cidade.js';
import { bloqueado } from './mundo.js';
import { LX0, LZ0, LX1, LZ1 } from './geo.js';
import { fumaca, fogo, explosao } from './efeitos.js';
import { prepararRodas, URBANA } from './moto.js';
import { postesPerto } from './ceu.js';

// vmax em m/s, acel em m/s², entre = distância entre-eixos (raio de curva), cam = distância da câmera
const TIPOS = [
  { id:'suv',    nome:'SUV',             arq:'assets/veiculos/suv.glb',    vmax:24, acel:6,  entre:2.8, cam:9  },
  { id:'picape', nome:'Picape',          arq:'assets/veiculos/picape.glb', vmax:22, acel:5,  entre:3.1, cam:9.5 },
  { id:'cavalo', nome:'Cavalo mecânico', arq:'assets/veiculos/cavalo.glb', vmax:17, acel:2.8,entre:4.2, cam:13 },
  { id:'chopper', nome:'Moto custom',    arq:'assets/veiculos/chopper.glb', vmax:30, acel:7.5, entre:1.75, cam:6.5, moto:true },   // Bison Seca-Suvaco (Couro & Asfalto)
  // do Couro & Asfalto (modelos de IA), pedido do Maicon em 16/11
  { id:'hatch',  nome:'Hatch',           arq:'assets/veiculos/hatch.glb',  vmax:26, acel:6.5,entre:2.5, cam:8.5 },
  { id:'sedan',  nome:'Sedã',            arq:'assets/veiculos/sedan.glb',  vmax:27, acel:6,  entre:2.7, cam:9  },
  { id:'trail',  nome:'Moto trail',      arq:'assets/veiculos/trail.glb',  vmax:28, acel:8,  entre:1.5, cam:6, moto:true },
  { id:'urbana', nome:'Moto urbana',     arq:'assets/veiculos/urbana.glb', vmax:25, acel:7.5,entre:1.4, cam:6, moto:true },
  // as outras motos de IA do Couro & Asfalto (pedido do Maicon em 17/11)
  { id:'classica', nome:'Moto clássica', arq:'assets/veiculos/classica.glb', vmax:26, acel:7,  entre:1.45, cam:6, moto:true },
  { id:'custom',   nome:'Moto cruiser', arq:'assets/veiculos/custom.glb',   vmax:27, acel:7,  entre:1.65, cam:6.5, moto:true },
  { id:'esportiva',nome:'Moto esportiva',arq:'assets/veiculos/esportiva.glb',vmax:34, acel:9,  entre:1.3, cam:6, moto:true },
  { id:'naked',    nome:'Moto naked',    arq:'assets/veiculos/naked.glb',    vmax:31, acel:8.5,entre:1.4, cam:6, moto:true },
];
// 17/11 (pedido do Maicon: "os carros têm que pegar mais velocidade"): velocidade máxima +45% e arrancada +70%
// para todo veículo dirigível (aplicado nos dados, então velocímetro e som do motor acompanham)
// 21/11 ("quero mais velocidade nos carros"): de +45% para +75% na final e arrancada ×2
const MAIS_VELOCIDADE=1.75, MAIS_ARRANCADA=2.0;
const turbinar=lista=>{ for(const T of lista){ T.vmax=+(T.vmax*MAIS_VELOCIDADE).toFixed(1); T.acel=+(T.acel*MAIS_ARRANCADA).toFixed(2); } };
turbinar(TIPOS);
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);

// a moto do jogador fica na frente da oficina dele (negocios.js chama ao achar a oficina)
let vagaMoto=null;
export function estacionarMoto(x,z,h){
  vagaMoto={x,z,h}; const c=frota.find(c=>c.tipo.id==='chopper'); if(!c||c===dirigindo) return;
  c.obj.position.set(x,0,z); c.h=h; c.obj.rotation.y=h; c.obj.rotation.z=0.12; c.v=0; c.dano=0; for(const [m,cor] of c.mats) m.color.copy(cor);
}
export const frota = [];   // {tipo, obj, h, v, comp, larg}
export let dirigindo = null;

const frente = h=>[-Math.sin(h), -Math.cos(h)];
const esquerda = h=>[-Math.cos(h), Math.sin(h)];

// pontos do veículo que testam colisão (cantos e meio das laterais)
function contorno(c, x, z, h){
  const [fx,fz]=frente(h), [ex,ez]=esquerda(h), a=c.comp/2, b=c.larg/2-0.1, out=[];
  for(const [u,w] of [[a,b],[a,-b],[-a,b],[-a,-b],[a,0],[0,b],[0,-b],[-a,0]]) out.push([x+fx*u+ex*w, z+fz*u+ez*w]);
  return out;
}

// ponto (x,z) dentro do retângulo de algum veículo? (para o avatar a pé não atravessar)
export function dentroDeVeiculo(x,z,folga=0.35){
  for(const c of frota){ if(c===dirigindo) continue;
    const dx=x-c.obj.position.x, dz=z-c.obj.position.z, [fx,fz]=frente(c.h), [ex,ez]=esquerda(c.h);
    if(Math.abs(dx*fx+dz*fz)<c.comp/2+folga && Math.abs(dx*ex+dz*ez)<c.larg/2+folga) return true; }
  return false;
}

// estaciona em fila encostado no meio-fio direito das ruas largas de mão dupla mais perto do início.
// 21/11 (Maicon: "não quero esses carros obstruindo o trânsito"): nunca a menos de 16 m de um
// cruzamento (antes a fila seguia reto e atravessava a esquina) e bem colado no meio-fio.
function vagas(n){
  const cand=[];
  for(const r of ruas){ if(r.pe||!r.nome||r.tipo.startsWith('motorway')||r.mao||r.w<8) continue;
    let md=1e9, mi=0; r.pts.forEach((p,i)=>{ const d=Math.hypot(p[0],p[1]); if(d<md){ md=d; mi=i; } }); cand.push({r,i:mi,d:md}); }
  cand.sort((a,b)=>a.d-b.d);
  const out=[];
  for(const {r,i:i0} of cand){ if(out.length>=n) break;
    const off=-(r.w/2-1.15);                                          // meia largura do carro (~0,95) + folga do meio-fio
    for(const dir of [1,-1]){
      let quer=4, feito=0;
      for(let i=i0; out.length<n && i+dir>=0 && i+dir<r.pts.length; i+=dir){
        const a=r.pts[i], b=r.pts[i+dir], L=Math.hypot(b[0]-a[0],b[1]-a[1])||1e-6;
        const h=Math.atan2(-(b[0]-a[0]),-(b[1]-a[1])), [ex,ez]=esquerda(h);
        while(quer<=feito+L && out.length<n){ const t=(quer-feito)/L, x=a[0]+(b[0]-a[0])*t+ex*off, z=a[1]+(b[1]-a[1])*t+ez*off;
          if(!pertoCruzamento(x,z,16)&&!bloqueado(x,z)) out.push({x,z,h}); quer+=out.length&&out[out.length-1].x===x?9:3; }
        feito+=L;
      }
      if(out.length>=n) break;
    }
  }
  while(out.length<n){ const u=out[out.length-1]||{x:6,z:6,h:0}, [fx,fz]=frente(u.h); out.push({x:u.x+fx*9,z:u.z+fz*9,h:u.h}); }
  return out;
}

export async function iniciarVeiculos(){
  const lugares=vagas(TIPOS.length);
  await Promise.all(TIPOS.map((tipo,k)=>new Promise(ok=>loader.load(tipo.arq, g=>{
    const obj=g.scene, tam=new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    obj.traverse(o=>{ if(o.isMesh){ o.material.side=THREE.FrontSide; } });
    const L=lugares[k]; obj.rotation.order='YXZ'; obj.position.set(L.x,0,L.z); obj.rotation.y=L.h; scene.add(obj);   // YXZ: arfagem e rolagem no eixo do próprio veículo
    const mats=[]; obj.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); mats.push([o.material,o.material.color.clone()]); } });
    const c={tipo, obj, h:L.h, v:0, comp:tam.z, larg:tam.x, alt:tam.y, dano:0, quebrado:false, acum:0, queima:0, mats};
    if(tipo.moto){ obj.userData={...obj.userData,...g.scene.userData}; Object.assign(c,prepararRodas(obj)); obj.rotation.z=0.12; c.larg=Math.min(c.larg,0.9);
      if(vagaMoto&&tipo.id==='chopper'){ obj.position.set(vagaMoto.x,0,vagaMoto.z); c.h=vagaMoto.h; obj.rotation.y=vagaMoto.h; } }   // moto: no descanso, meio deitada
    frota.push(c); ok();
  }, undefined, e=>{ console.warn('veículo',tipo.arq,e); ok(); }))));
}

// veículo mais perto do ponto, se estiver ao alcance para entrar
export function veiculoPerto(x,z){
  let melhor=null, md=1e9;
  for(const c of frota){ const d=Math.hypot(x-c.obj.position.x,z-c.obj.position.z)-Math.max(c.comp,c.larg)/2; if(d<md){ md=d; melhor=c; } }
  return md<2.2?melhor:null;
}

export function entrar(c){ dirigindo=c; c.v=0; }

// devolve onde o avatar desce (lado do motorista; se bloqueado, o outro lado)
export function sair(){
  const c=dirigindo; if(!c) return null;
  const p=c.obj.position, [ex,ez]=esquerda(c.h), d=c.larg/2+0.9;
  dirigindo=null; c.v=0;
  for(const s of [1,-1]){ const x=p.x+ex*d*s, z=p.z+ez*d*s; if(!bloqueado(x,z)&&!dentroDeVeiculo(x,z,0.1)) return [x,z,c.h]; }
  return [p.x+ex*d, p.z+ez*d, c.h];
}

// um passo de física do veículo dirigido. acel: -1..1 (W/S), giro: -1..1 (A/D), freio de mão
export function dirigir(dt, acel, giro, freio, obstaculo){
  const c=dirigindo, T=c.tipo;
  if(c.quebrado) acel=Math.min(0,acel)*0.35;                                    // motor morto: só uma ré devagar, para sair de onde travou
  const tb=reforco.turbo>0?1.25:1;                                               // turbo da oficina
  if(acel>0) c.v += (c.v<0 ? T.acel*2.2 : T.acel*tb)*acel*dt;                       // frente (freia se estava de ré)
  else if(acel<0) c.v += (c.v>0 ? -T.acel*2.2 : -T.acel*0.6)*(-acel)*dt;         // freio, depois ré
  else c.v -= Math.sign(c.v)*Math.min(Math.abs(c.v), 1.6*dt);                   // rolagem
  if(freio) c.v -= Math.sign(c.v)*Math.min(Math.abs(c.v), 12*dt);
  const vmax=T.vmax*tb*(1-0.55*Math.max(0,c.dano-50)/50);                          // muito batido perde força
  c.v = Math.max(-vmax*0.3, Math.min(vmax, c.v));
  // bicicleta: quanto mais rápido, menos esterço
  const esterco = giro*0.6/(1+Math.abs(c.v)/18);                                // em alta, menos esterço (estilo GTA)
  // giro do modelo de bicicleta, limitado pela aderência (~1,2 g): em alta não dá cavalo de pau
  let w = c.v/T.entre*Math.tan(esterco);
  const wMax = 12/Math.max(Math.abs(c.v),1); w = Math.max(-wMax, Math.min(wMax, w));
  const nh = c.h + w*dt;
  const [fx,fz]=frente(nh), p=c.obj.position, nx=p.x+fx*c.v*dt, nz=p.z+fz*c.v*dt;
  const parede=(x0,z0,h0)=>contorno(c,x0,z0,h0).some(([x,z])=>bloqueado(x,z)||x<LX0+2||x>LX1-2||z<LZ0+2||z>LZ1-2);
  // já encostado num prédio/muro (nasceu ou foi parar em cima): deixa se mexer para sair
  // poste: o tronco (raio ~0,15 m) dentro do retângulo do veículo
  const poste=(x0,z0,h0)=>{ const [fx,fz]=frente(h0), [ex,ez]=esquerda(h0);
    return postesPerto(x0,z0,Math.max(c.comp,c.larg)/2+0.3).some(([qx,qz])=>{ const dx=qx-x0, dz=qz-z0;
      return Math.abs(dx*fx+dz*fz)<c.comp/2+0.15 && Math.abs(dx*ex+dz*ez)<c.larg/2+0.15; }); };
  const bate = (parede(nx,nz,nh)&&!parede(p.x,p.z,c.h)) || (poste(nx,nz,nh)&&!poste(p.x,p.z,c.h)) || dentroDeOutro(c,nx,nz,nh) || obstaculo?.(c,nx,nz,nh);
  if(bate){ c.v *= -0.25; return true; }
  p.set(nx,p.y,nz); c.h=nh; c.obj.rotation.y=nh;
  // leve inclinação na curva e no freio, só para dar vida
  c.obj.rotation.z = THREE.MathUtils.lerp(c.obj.rotation.z, -esterco*Math.min(1,Math.abs(c.v)/15)*0.06, Math.min(1,dt*6));
  return false;
}
function dentroDeOutro(c,x,z,h){
  for(const o of frota){ if(o===c) continue; const d=Math.hypot(x-o.obj.position.x,z-o.obj.position.z);
    if(d<(c.comp+o.comp)/2) for(const [px,pz] of contorno(c,x,z,h)) if(dentroDeVeiculo2(o,px,pz)) return true; }
  return false;
}
function dentroDeVeiculo2(o,x,z){ const dx=x-o.obj.position.x, dz=z-o.obj.position.z, [fx,fz]=frente(o.h), [ex,ez]=esquerda(o.h);
  return Math.abs(dx*fx+dz*fz)<o.comp/2 && Math.abs(dx*ex+dz*ez)<o.larg/2; }

export { frente, esquerda };

/* ───────── dano: fumaça cinza > fumaça preta > fogo > quebra ───────── */
export function danificar(c, impacto){
  if(c.quebrado||c.semDano) return;
  if(c.tipo.moto){ c.dano=Math.min(80, c.dano+(impacto-3.5)*3); return; }      // moto: soltar fumaça sim, quebrar não (senão trava no lugar)
  c.dano=Math.min(100, c.dano+(impacto-3.5)*7);
  // a lataria escurece conforme apanha
  const k=1-0.55*c.dano/100; for(const [m,cor] of c.mats) m.color.copy(cor).multiplyScalar(k);
  if(c.dano>=100){ c.quebrado=true; c.queima=25; c.v=0; for(const [m] of c.mats) m.color.setRGB(0.18,0.17,0.16);
    const p=motor(c); explosao(p.x,p.y,p.z); }
}
const P=new THREE.Vector3();
function motor(c){ return c.obj.localToWorld(P.set(0,c.alt*0.6,-c.comp*0.36)); }   // capô (frente = -Z)
export function efeitosVeiculos(dt){
  for(const c of frota){
    if(c.dano<35&&!c.quebrado) continue;
    if(c.quebrado) c.queima=Math.max(0,c.queima-dt);
    const fogoForte=c.quebrado&&c.queima>0, comFogo=c.dano>=70;
    c.acum+=dt*(fogoForte?40:comFogo?22:10);
    while(c.acum>=1){ c.acum-=1; const p=motor(c);
      if(fogoForte){ if(Math.random()<0.6) fogo(p.x,p.y,p.z,1.6); else fumaca(p.x,p.y+0.8,p.z,1,1.6); }
      else if(comFogo&&Math.random()<0.45) fogo(p.x,p.y,p.z,0.8);
      else fumaca(p.x,p.y+0.2,p.z, Math.min(1,(c.dano-35)/50)); }
  }
}

/* ───────── qualquer carro da rua (pedido do Maicon em 17/11) ─────────
   E perto de um carro do trânsito: ele sai da fila do trânsito e vira um veículo dirigível, igual aos
   estacionados. Ficam no máximo 4 desses soltos pela cidade; os largados longe somem. */
const DO_TRANSITO={
  hatch:{nome:'Hatch',vmax:26,acel:6.5,entre:2.5,cam:8.5}, sedan:{nome:'Sedã',vmax:27,acel:6,entre:2.7,cam:9},
  suv:{nome:'SUV',vmax:24,acel:6,entre:2.8,cam:9}, suv2:{nome:'SUV',vmax:24,acel:6,entre:2.8,cam:9},
  picape:{nome:'Picape',vmax:22,acel:5,entre:3.1,cam:9.5}, picape2:{nome:'Picape',vmax:22,acel:5,entre:3.1,cam:9.5},
  onibus:{nome:'Ônibus',vmax:18,acel:2.6,entre:6,cam:15}, ambulancia:{nome:'Ambulância',vmax:26,acel:5.5,entre:3.4,cam:10},
  'caminhonete-policia':{nome:'Viatura',vmax:29,acel:7,entre:3,cam:9.5}, 'viatura-suv':{nome:'Viatura',vmax:29,acel:7,entre:2.9,cam:9.5},
  cavalo:{nome:'Cavalo mecânico',vmax:17,acel:2.8,entre:4.2,cam:13}, cavalinho:{nome:'Carreta',vmax:16,acel:2.2,entre:7,cam:17},
  bike:{nome:'Bike elétrica',vmax:7.5,acel:3,entre:1.1,cam:5,moto:true},
  montaria:{nome:'Cavalo',vmax:9.5,acel:3.5,entre:2.2,cam:7.5,moto:true,montaria:true},   // cavalo montado (animais.js); ~60 km/h a galope   // roubada de criança (criancas.js); ~47 km/h depois do turbinar
};
turbinar(Object.values(DO_TRANSITO));
const ID_PAGA={ suv2:'suv', picape2:'picape', 'caminhonete-policia':'viatura', 'viatura-suv':'viatura', cavalinho:'carreta' };
export function adotar({obj, arq, x, z, h, esc=1, bicho=null, assento=null}){
  const base=DO_TRANSITO[arq]||DO_TRANSITO.sedan, tipo={ id:ID_PAGA[arq]||arq, ...base };
  const ry=obj.rotation.y; obj.rotation.set(0,0,0); obj.updateMatrixWorld(true);
  const tam=new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  obj.rotation.order='YXZ'; obj.position.set(x,0,z); obj.rotation.y=h??ry; scene.add(obj);
  const mats=[]; obj.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); mats.push([o.material,o.material.color.clone()]); } });
  const c={tipo, obj, h:h??ry, v:0, comp:tam.z, larg:tam.x, alt:tam.y, dano:0, quebrado:false, acum:0, queima:0, mats, solto:true};
  if(base.montaria){ Object.assign(c,{ montaria:true, bicho, assento, solto:false, semDano:true }); c.larg=Math.min(c.larg,0.9); frota.push(c); return c; }   // cavalo: some da frota ao desmontar (liberar)
  if(base.moto){ const rodas=prepararRodas(obj); rodas.raio*=esc; Object.assign(c,rodas); c.larg=Math.min(c.larg,0.9); c.assento=URBANA; }
  frota.push(c);
  const soltos=frota.filter(o=>o.solto&&o!==c&&o!==dirigindo);
  while(soltos.length>3){ const o=soltos.shift(); scene.remove(o.obj); frota.splice(frota.indexOf(o),1); }
  return c;
}
// tira da frota sem apagar o objeto (cavalo desmontado volta a ser bicho)
export function liberar(c){ const i=frota.indexOf(c); if(i>=0) frota.splice(i,1); }
// os soltos largados longe do jogador somem (não enchem a cidade)
export function recolherSoltos(px,pz){
  for(let i=frota.length-1;i>=0;i--){ const c=frota[i]; if(!c.solto||c===dirigindo) continue;
    if(Math.hypot(c.obj.position.x-px,c.obj.position.z-pz)>380){ scene.remove(c.obj); frota.splice(i,1); } }
}
// oficina: conserto deixa o veículo novo
export function consertar(c){
  if(!c) return false;
  c.dano=0; c.quebrado=false; c.queima=0; for(const [m,cor] of c.mats) m.color.copy(cor); return true;
}
// turbo comprado na oficina: mais velocidade e arrancada por um tempo (segundos)
export const reforco={ turbo:0 };
export const nomeDoTransito=a=>(DO_TRANSITO[a]||{nome:'carro'}).nome;
