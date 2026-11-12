// Partículas simples (sprites): fumaça cinza/preta e fogo. Um conjunto fixo de sprites é
// reciclado, então não cria objeto novo a cada quadro.
import * as THREE from 'three';
import { scene } from './cena.js';

function texRedonda(){
  const cv=document.createElement('canvas'); cv.width=cv.height=64; const k=cv.getContext('2d');
  const g=k.createRadialGradient(32,32,0,32,32,32); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.45,'rgba(255,255,255,.55)'); g.addColorStop(1,'rgba(255,255,255,0)');
  k.fillStyle=g; k.fillRect(0,0,64,64); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const TEX=texRedonda(), N=220, pool=[];
for(let i=0;i<N;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:TEX,transparent:true,depthWrite:false}));
  s.visible=false; s.renderOrder=5; scene.add(s); pool.push({s,vida:0,max:1,vx:0,vy:0,vz:0,cresce:0,tipo:''});
}
let prox=0;
// tipo: 'fumaca' (cor cinza: 0 claro … 1 preto) | 'fogo'
export function emitir(x,y,z,tipo,forca=1){
  const p=pool[prox]; prox=(prox+1)%N;
  const m=p.s.material, fogo=tipo==='fogo';
  p.tipo=tipo; p.vida=p.max=fogo?0.45+Math.random()*0.35:1.6+Math.random()*1.4;
  p.vx=(Math.random()-0.5)*(fogo?0.8:0.6); p.vz=(Math.random()-0.5)*(fogo?0.8:0.6); p.vy=fogo?2.2+Math.random()*1.5:1.1+Math.random()*0.8;
  p.cresce=fogo?0.6:1.4; p.s.position.set(x+(Math.random()-0.5)*0.5*forca, y, z+(Math.random()-0.5)*0.5*forca);
  const t=(fogo?0.7:0.5)*forca; p.s.scale.set(t,t,1); p.s.visible=true;
  m.blending=fogo?THREE.AdditiveBlending:THREE.NormalBlending;
  if(fogo) m.color.setRGB(1,0.45+Math.random()*0.3,0.08);
  else m.color.setRGB(0.7,0.7,0.7);
  m.opacity=fogo?0.95:0.55; m.needsUpdate=true;
  return p;
}
// fumaça com tom: 0 = cinza claro, 1 = preta
export function fumaca(x,y,z,escuro=0,forca=1){ const p=emitir(x,y,z,'fumaca',forca); const c=0.78-0.68*escuro; p.s.material.color.setRGB(c,c,c); return p; }
export const fogo=(x,y,z,forca=1)=>emitir(x,y,z,'fogo',forca);
// explosão: bola de fogo e fumaça preta para todo lado
export function explosao(x,y,z){
  for(let i=0;i<40;i++){ const p=fogo(x,y+0.5,z,2.2); p.vx*=6; p.vz*=6; p.vy*=1.6; }
  for(let i=0;i<30;i++){ const p=fumaca(x,y+1,z,1,2); p.vx*=4; p.vz*=4; }
}
export function atualizarEfeitos(dt){
  for(const p of pool){ if(!p.s.visible) continue;
    p.vida-=dt; if(p.vida<=0){ p.s.visible=false; continue; }
    const k=p.vida/p.max, s=p.s;
    s.position.x+=p.vx*dt; s.position.y+=p.vy*dt; s.position.z+=p.vz*dt;
    s.scale.x=s.scale.y=s.scale.x+p.cresce*dt;
    s.material.opacity=(p.tipo==='fogo'?0.95:0.55)*k;
  }
}
