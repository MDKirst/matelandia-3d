// Veículos dirigíveis (SUV, picape, cavalo mecânico): estacionados perto do início,
// E (ou o botão no celular) entra e sai, direção simples estilo arcade.
// Convenção dos modelos em assets/veiculos/: frente = -Z, chão em y = 0, medidas reais em metros.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { scene, $ } from './cena.js';
import { ruas } from './cidade.js';
import { bloqueado } from './mundo.js';
import { LX0, LZ0, LX1, LZ1 } from './geo.js';
import { fumaca, fogo, explosao } from './efeitos.js';

// vmax em m/s, acel em m/s², entre = distância entre-eixos (raio de curva), cam = distância da câmera
const TIPOS = [
  { id:'suv',    nome:'SUV',             arq:'assets/veiculos/suv.glb',    vmax:24, acel:6,  entre:2.8, cam:9  },
  { id:'picape', nome:'Picape',          arq:'assets/veiculos/picape.glb', vmax:22, acel:5,  entre:3.1, cam:9.5 },
  { id:'cavalo', nome:'Cavalo mecânico', arq:'assets/veiculos/cavalo.glb', vmax:17, acel:2.8,entre:4.2, cam:13 },
];
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);

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

// estaciona em fila na rua com nome mais perto do início, encostado na margem direita
function vagas(n){
  let melhor=null, md=1e9;
  for(const r of ruas){ if(r.pe||!r.nome||r.tipo==='motorway') continue;
    r.pts.forEach((p,i)=>{ const d=Math.hypot(p[0],p[1]); if(d<md&&d>8){ md=d; melhor={r,i}; } }); }
  if(!melhor) return Array.from({length:n},(_,k)=>({x:6+k*9,z:6,h:0}));
  // anda pela rua a partir desse ponto e põe um veículo a cada 9 m
  const {r}=melhor, out=[], dir=melhor.i<r.pts.length-1?1:-1, off=-(r.w/2-0.9); // encostado no meio-fio direito
  let quer=0, feito=0, h=0;
  for(let i=melhor.i; out.length<n && i+dir>=0 && i+dir<r.pts.length; i+=dir){
    const a=r.pts[i], b=r.pts[i+dir], L=Math.hypot(b[0]-a[0],b[1]-a[1])||1e-6;
    h=Math.atan2(-(b[0]-a[0]),-(b[1]-a[1])); const [ex,ez]=esquerda(h);
    while(quer<=feito+L && out.length<n){ const t=(quer-feito)/L; out.push({x:a[0]+(b[0]-a[0])*t+ex*off, z:a[1]+(b[1]-a[1])*t+ez*off, h}); quer+=9; }
    feito+=L;
  }
  while(out.length<n){ const u=out[out.length-1]||{x:6,z:6,h}, [fx,fz]=frente(u.h); out.push({x:u.x+fx*9,z:u.z+fz*9,h:u.h}); } // rua curta: segue reto
  return out;
}

export async function iniciarVeiculos(){
  const lugares=vagas(TIPOS.length);
  await Promise.all(TIPOS.map((tipo,k)=>new Promise(ok=>loader.load(tipo.arq, g=>{
    const obj=g.scene, tam=new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    obj.traverse(o=>{ if(o.isMesh){ o.material.side=THREE.FrontSide; } });
    const L=lugares[k]; obj.rotation.order='YXZ'; obj.position.set(L.x,0,L.z); obj.rotation.y=L.h; scene.add(obj);   // YXZ: arfagem e rolagem no eixo do próprio veículo
    const mats=[]; obj.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); mats.push([o.material,o.material.color.clone()]); } });
    frota.push({tipo, obj, h:L.h, v:0, comp:tam.z, larg:tam.x, alt:tam.y, dano:0, quebrado:false, acum:0, queima:0, mats}); ok();
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
  if(c.quebrado) acel=Math.min(0,acel)*0;                                       // motor morto: só rola e freia
  if(acel>0) c.v += (c.v<0 ? T.acel*2.2 : T.acel)*acel*dt;                       // frente (freia se estava de ré)
  else if(acel<0) c.v += (c.v>0 ? -T.acel*2.2 : -T.acel*0.6)*(-acel)*dt;         // freio, depois ré
  else c.v -= Math.sign(c.v)*Math.min(Math.abs(c.v), 1.6*dt);                   // rolagem
  if(freio) c.v -= Math.sign(c.v)*Math.min(Math.abs(c.v), 12*dt);
  const vmax=T.vmax*(1-0.55*Math.max(0,c.dano-50)/50);                          // muito batido perde força
  c.v = Math.max(-vmax*0.3, Math.min(vmax, c.v));
  // bicicleta: quanto mais rápido, menos esterço
  const esterco = giro*0.6;
  // giro do modelo de bicicleta, limitado pela aderência (~1,2 g): em alta não dá cavalo de pau
  let w = c.v/T.entre*Math.tan(esterco);
  const wMax = 12/Math.max(Math.abs(c.v),1); w = Math.max(-wMax, Math.min(wMax, w));
  const nh = c.h + w*dt;
  const [fx,fz]=frente(nh), p=c.obj.position, nx=p.x+fx*c.v*dt, nz=p.z+fz*c.v*dt;
  const parede=(x0,z0,h0)=>contorno(c,x0,z0,h0).some(([x,z])=>bloqueado(x,z)||x<LX0+2||x>LX1-2||z<LZ0+2||z>LZ1-2);
  // já encostado num prédio/muro (nasceu ou foi parar em cima): deixa se mexer para sair
  const bate = (parede(nx,nz,nh)&&!parede(p.x,p.z,c.h)) || dentroDeOutro(c,nx,nz,nh) || obstaculo?.(c,nx,nz,nh);
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
  if(c.quebrado) return;
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
