// Socorro (25/11, pedido do Maicon): atropelado fica deitado reto no chão pedindo ajuda; uma ambulância
// (modelo de IA do Couro & Asfalto) vem pelas ruas, desce um socorrista, atende no local e:
//   · leve  → a pessoa levanta e agradece
//   · grave → vai de maca para dentro da ambulância, que sai para o hospital
// Sem ambulância livre (máx. 2) a pessoa espera; passou de 2 min, levanta sozinha.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene, $ } from './cena.js';
import { ruas } from './cidade.js';
import { bloqueado } from './mundo.js';
import { rotaRuas } from './policia.js';

const MAX=2, VEL=20, ESPERA_MAX=120, VEL_SOCORRISTA=2.6;
const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
let molde=null, moldeGente=null, falar=()=>{};
const fila=[], ambs=[];
let tAviso=0;
function avisar(t){ const a=$('aviso'); if(!a) return; a.textContent=t; a.style.opacity=1; clearTimeout(tAviso); tAviso=setTimeout(()=>a.style.opacity=0,3500); }
const sorteia=l=>l[(Math.random()*l.length)|0];

// carregarModelo vem do pedestres.js (passado para não criar import circular)
export async function iniciarSocorro(fala, carregarModelo){
  falar=fala;
  await new Promise(ok=>loader.load('assets/veiculos/ambulancia.glb',g=>{ molde=g.scene; ok(); },undefined,()=>ok()));
  moldeGente=await carregarModelo('male-shirt').catch(()=>null);
}

// pedestres.js chama quando o atropelado termina de cair
export function chamarSocorro(p){ if(!fila.includes(p)&&!ambs.some(a=>a.p===p)){ p.esperaSocorro=0; fila.push(p); } }

export function pontoNaRua(px,pz,dmin,dmax){
  const cand=[];
  for(const r of ruas){ if(r.pe) continue; const b=r.bb; if(b[0]>px+dmax||b[2]<px-dmax||b[1]>pz+dmax||b[3]<pz-dmax) continue;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], c=r.pts[i+1], L=Math.hypot(c[0]-a[0],c[1]-a[1]);
      for(let s=0;s<L;s+=10){ const q=[a[0]+(c[0]-a[0])*s/L, a[1]+(c[1]-a[1])*s/L], d=Math.hypot(q[0]-px,q[1]-pz); if(d>=dmin&&d<=dmax) cand.push(q); } } }
  return cand.length?cand[(Math.random()*cand.length)|0]:null;
}

function novaAmbulancia(p){
  const q=pontoNaRua(p.x,p.z,70,140); if(!q||!molde) return null;
  const obj=molde.clone(); obj.rotation.order='YXZ';
  const box=new THREE.Box3().setFromObject(obj), tam=box.getSize(new THREE.Vector3());
  const luz=[0xff2a2a,0xffffff].map((c,i)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.16,0.28),new THREE.MeshBasicMaterial({color:c})); m.position.set(i?0.32:-0.32,tam.y+0.06,box.min.z+0.5); obj.add(m); return m; });
  scene.add(obj);
  const a={ obj, luz, p, x:q[0], z:q[1], h:Math.atan2(-(p.x-q[0]),-(p.z-q[1])), v:0, meio:tam.z/2, larg:tam.x/2,
    fase:'ir', rota:null, recalc:0, re:0, travado:0, ult:[q[0],q[1]], t:0, soc:null, maca:null, grave:!!p.grave };
  falar(p,'🚑 Ambulância vindo!',3);
  avisar(a.grave?'🚑 Ambulância a caminho: atropelamento grave':'🚑 Ambulância a caminho');
  return a;
}

function dirigir(a,dt,ax,az,vmax){
  const d=Math.hypot(ax-a.x,az-a.z);
  const alvoH=Math.atan2(-(ax-a.x),-(az-a.z)); let dh=alvoH-a.h; dh=Math.atan2(Math.sin(dh),Math.cos(dh));
  if(a.re>0){ a.re-=dt; a.v=-4; a.h-=Math.sign(dh||1)*1.4*dt; }
  else { const curva=Math.abs(dh)>0.6?8:Math.abs(dh)>0.25?14:99, alvoV=Math.min(curva,vmax);
    a.v+=Math.sign(alvoV-a.v)*Math.min(Math.abs(alvoV-a.v),10*dt); a.h+=Math.max(-2.2*dt,Math.min(2.2*dt,dh)); }
  const fx=-Math.sin(a.h), fz=-Math.cos(a.h), nx=a.x+fx*a.v*dt, nz=a.z+fz*a.v*dt;
  if(bloqueado(nx+fx*a.meio*Math.sign(a.v||1),nz+fz*a.meio*Math.sign(a.v||1))){ if(a.re<=0) a.re=0.7; } else { a.x=nx; a.z=nz; }
  a.travado+=dt; if(a.travado>3){ if(Math.hypot(a.x-a.ult[0],a.z-a.ult[1])<3&&a.rota?.[1]){ [a.x,a.z]=a.rota[1]; a.rota.shift(); a.re=0; } a.travado=0; a.ult=[a.x,a.z]; }
}
// a: {x,z,h,v,meio,re,travado,ult,rota,destRota} — também usado pelo ônibus/van escolar (escola.js)
export function seguirRota(a,dt,tx,tz,perto){
  // rota calculada uma vez; só refaz se o destino mudou ou a ambulância saiu do caminho (refazer sempre
  // pega o cruzamento que já ficou para trás e ela volta, andando em círculo)
  const fora=a.rota&&a.rota.length&&Math.hypot(a.rota[0][0]-a.x,a.rota[0][1]-a.z)>45;
  if(!a.rota||a.destRota!==tx+','+tz||fora){ a.rota=rotaRuas(a.x,a.z,tx,tz); a.destRota=tx+','+tz; }
  while(a.rota&&a.rota.length&&Math.hypot(a.rota[0][0]-a.x,a.rota[0][1]-a.z)<7) a.rota.shift();
  const d=Math.hypot(tx-a.x,tz-a.z);
  const [ax,az]=(d<perto||!a.rota||!a.rota.length)?[tx,tz]:a.rota[0];
  dirigir(a,dt,ax,az,d>40?VEL:d>15?12:6);
  return d;
}

function novoSocorrista(a){
  if(!moldeGente) return null;
  const e=1.75/moldeGente.altura, obj=clonarEsqueleto(moldeGente.cena); obj.scale.multiplyScalar(e);
  obj.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false; o.material=o.material.clone(); if(!/skin|eye|hair|brow/i.test(o.material.name)) o.material.color.setHex(0xf2f2f2); } });   // uniforme branco
  const fx=-Math.sin(a.h), fz=-Math.cos(a.h);
  const s={ obj, x:a.x-fx*(a.meio+0.8), z:a.z-fz*(a.meio+0.8), pe:-moldeGente.base*e, mixer:new THREE.AnimationMixer(obj), acoes:{}, atual:null };
  for(const [n,c] of Object.entries(moldeGente.anims)) s.acoes[n]=s.mixer.clipAction(c);
  scene.add(obj); return s;
}
function animarS(s,n){ const c=s.acoes[n]||s.acoes.parado; if(!c||c===s.atual) return; if(s.atual) s.atual.fadeOut(0.2); c.reset().fadeIn(0.2).play(); s.atual=c; }
function andarS(s,tx,tz,dt){ const ax=tx-s.x, az=tz-s.z, d=Math.hypot(ax,az); if(d>0.05){ const k=Math.min(d,VEL_SOCORRISTA*dt); s.x+=ax/d*k; s.z+=az/d*k; s.obj.rotation.y=Math.atan2(ax,az); } return d; }

function tirar(a){ scene.remove(a.obj); if(a.soc) scene.remove(a.soc.obj); if(a.maca) scene.remove(a.maca); }
const livre=p=>p&&p.obj&&p.modo==='caido'&&p.ferido&&!p.levado;

export function atualizarSocorro(dt, jog){
  // quem espera: chama ambulância se houver vaga; espera demais levanta sozinho
  for(let i=fila.length-1;i>=0;i--){ const p=fila[i];
    if(!livre(p)){ fila.splice(i,1); continue; }
    p.esperaSocorro+=dt;
    if(p.esperaSocorro>ESPERA_MAX){ p.solto=true; fila.splice(i,1); continue; }
    if(ambs.length<MAX){ const a=novaAmbulancia(p); if(a){ ambs.push(a); fila.splice(i,1); } } }
  const pisca=(performance.now()/200|0)%2;
  for(let i=ambs.length-1;i>=0;i--){ const a=ambs[i], p=a.p; a.t+=dt;
    a.luz[0].material.color.setHex(pisca?0xff2a2a:0x400808); a.luz[1].material.color.setHex(pisca?0x333333:0xffffff);
    if(a.fase!=='sair'&&a.fase!=='levar'&&a.fase!=='voltar'&&!livre(p)){ if(a.soc) a.fase='voltar'; else { a.fase='sair'; a.t=0; } }                       // pessoa sumiu (jogador longe): volta
    if(a.fase==='ir'){
      const d=seguirRota(a,dt,p.x,p.z,22);
      if(d<7||(a.t>50&&d<20)){ a.v=0; a.fase='descer'; a.soc=novoSocorrista(a); if(!a.soc){ a.fase='atender'; a.t=0; } }
      else if(a.t>60){ [a.x,a.z]=pontoNaRua(p.x,p.z,4,14)||[p.x+4,p.z]; a.t=0; }            // não achou caminho: aparece perto
    } else if(a.fase==='descer'||a.fase==='voltar'||a.fase==='levar'){
      const s=a.soc, fx=-Math.sin(a.h), fz=-Math.cos(a.h), tras=[a.x-fx*(a.meio+0.8), a.z-fz*(a.meio+0.8)];
      const alvo=a.fase==='descer'?[p.x+0.6,p.z+0.6]:tras;
      const d=andarS(s,alvo[0],alvo[1],dt); animarS(s,d>0.2?'andar':'parado');
      if(a.fase==='levar'&&a.maca){ const bx=s.x-Math.sin(s.obj.rotation.y)*1.2, bz=s.z-Math.cos(s.obj.rotation.y)*1.2;
        a.maca.position.set(bx,0.7,bz); a.maca.rotation.y=s.obj.rotation.y;
        p.x=bx; p.z=bz; p.y=0.75; p.rumo=s.obj.rotation.y+Math.PI; }
      if(d<=0.2){
        if(a.fase==='descer'){ a.fase='atender'; a.t=0; s.obj.rotation.y=Math.atan2(p.x-s.x,p.z-s.z); falar(p,sorteia(['Ai… obrigado por vir!','Doeu muito…','Ainda bem que vocês chegaram!']),3); }
        else { scene.remove(s.obj); a.soc=null;
          if(a.fase==='levar'){ scene.remove(a.maca); a.maca=null; p.levado=true; avisar('🚑 A vítima foi levada para o hospital'); }
          a.fase='sair'; a.t=0; }
      }
      s.obj.position.set(s.x,s.pe,s.z); s.mixer.update(dt);
    } else if(a.fase==='atender'){
      if(a.soc){ animarS(a.soc,'parado'); a.soc.mixer.update(dt); }
      if(a.t>3.5){
        if(a.grave&&a.soc){ a.maca=new THREE.Mesh(new THREE.BoxGeometry(0.62,0.12,1.95),new THREE.MeshLambertMaterial({color:0xf8fafc})); scene.add(a.maca); p.carregado=true; a.fase='levar'; }
        else { p.solto=true; p.agradece=true; if(a.soc) a.fase='voltar'; else { a.fase='sair'; a.t=0; } }
      }
    } else if(a.fase==='sair'){
      if(!a.saida) a.saida=pontoNaRua(a.x,a.z,180,320)||[a.x+250,a.z];
      seguirRota(a,dt,a.saida[0],a.saida[1],10);
      if(a.t>30||Math.hypot(a.x-jog.x,a.z-jog.z)>200){ tirar(a); ambs.splice(i,1); continue; }
    }
    a.obj.position.set(a.x,0,a.z); a.obj.rotation.y=a.h;
  }
}
// para o trânsito/pedestres não atravessarem a ambulância: [x,z,h,meio,larg]
export const posicoesAmbulancias=()=>ambs.map(a=>[a.x,a.z,a.h,a.meio,a.larg]);
export const _testeSocorro={ ambs, fila };
