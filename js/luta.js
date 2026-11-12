// Briga: soco (J) e chute (K), barra de energia e desmaio.
// Nenhum personagem tem animação de golpe: o braço/perna é apontado para a frente por código,
// por cima da animação que está tocando. Funciona com o esqueleto do Mixamo (Maicon) e da Quaternius.
import * as THREE from 'three';
import { $ } from './cena.js';

export const DUR={ soco:0.38, chute:0.6 };          // duração do golpe (s)
export const DANO={ soco:12, chute:20 };            // energia tirada de outro jogador
const DESMAIO=5, ESPERA_CURA=4, CURA=5;             // s caído · s sem apanhar até começar a curar · energia/s

export const vida={ e:100, caido:0, queda:0, semApanhar:99, empurra:null };
export const golpe={ tipo:null, t:0, seq:0, acertou:false };

/* ───────── pose do golpe ───────── */
const OSSOS={
  braco:/^(mixamorig)?RightArm$|^UpperArm\.R$|^upperarm_r$/i,
  antebraco:/^(mixamorig)?RightForeArm$|^LowerArm\.R$|^lowerarm_r$/i,
  coxa:/^(mixamorig)?RightUpLeg$|^UpperLeg\.R$|^thigh_r$/i,
  canela:/^(mixamorig)?RightLeg$|^LowerLeg\.R$|^calf_r$/i,
};
function ossos(raiz){
  if(raiz.userData.ossos&&raiz.userData.ossosDe===raiz.children[0]) return raiz.userData.ossos;
  const o={}; raiz.traverse(n=>{ if(!n.isBone) return; for(const [k,re] of Object.entries(OSSOS)) if(!o[k]&&re.test(n.name)) o[k]=n; });
  raiz.userData.ossos=o; raiz.userData.ossosDe=raiz.children[0]; return o;
}
const Y=new THREE.Vector3(0,1,0), v=new THREE.Vector3(), d=new THREE.Vector3(), qa=new THREE.Quaternion(), qb=new THREE.Quaternion(), qc=new THREE.Quaternion();
// gira o osso (que aponta no seu +Y, padrão do Blender e do Mixamo) para a direção dir do mundo
function mirar(osso, dir, w){
  if(!osso||w<=0) return;
  osso.updateWorldMatrix(true,false);
  osso.getWorldQuaternion(qa);
  v.copy(Y).applyQuaternion(qa).normalize();
  qb.setFromUnitVectors(v,dir).multiply(qa);                         // orientação desejada no mundo
  osso.parent.getWorldQuaternion(qc).invert();
  osso.quaternion.slerp(qc.multiply(qb),w);
  osso.updateMatrixWorld(true);
}
// raiz: grupo que contém o modelo · t: 0..1 do golpe · (fx,fz): frente do personagem
export function poseGolpe(raiz, tipo, t, fx, fz){
  if(!raiz||!tipo||t<0||t>1) return;
  const o=ossos(raiz), w=Math.sin(Math.PI*Math.min(1,t*1.15));        // estica rápido, volta mais devagar
  if(tipo==='soco'){
    mirar(o.braco, d.set(fx,0.08,fz).normalize(), w);
    mirar(o.antebraco, d.set(fx,0.1,fz).normalize(), w);
  } else {
    mirar(o.coxa, d.set(fx,-0.35,fz).normalize(), w);                  // perna quase na horizontal
    mirar(o.canela, d.set(fx,-0.15,fz).normalize(), w);
  }
}

/* ───────── estado do jogador local ───────── */
export function golpear(tipo){
  if(golpe.tipo||vida.caido>0||!DUR[tipo]) return false;
  golpe.tipo=tipo; golpe.t=0; golpe.acertou=false; golpe.seq++; return true;
}
// onAcerto(tipo): chamado no meio do golpe (quando braço/perna está esticado)
export function atualizarLuta(dt, onAcerto){
  if(golpe.tipo){ golpe.t+=dt;
    if(!golpe.acertou&&golpe.t>=DUR[golpe.tipo]*0.45){ golpe.acertou=true; onAcerto(golpe.tipo); }
    if(golpe.t>=DUR[golpe.tipo]) golpe.tipo=null; }
  vida.semApanhar+=dt;
  if(vida.caido>0){ vida.caido-=dt; vida.queda=Math.min(1,vida.queda+dt*3);
    if(vida.caido<=0){ vida.e=100; vida.semApanhar=99; } }
  else { vida.queda=Math.max(0,vida.queda-dt*1.5);
    if(vida.semApanhar>ESPERA_CURA&&vida.e<100) vida.e=Math.min(100,vida.e+CURA*dt); }
  hud();
}
export function levarPancada(dano, fx, fz){
  if(vida.caido>0) return false;
  vida.e=Math.max(0,vida.e-dano); vida.semApanhar=0; vida.empurra=[fx*0.6,fz*0.6];
  golpe.tipo=null;
  if(vida.e<=0){ vida.caido=DESMAIO; aviso('Você desmaiou! Levanta em 5 s…'); }
  return true;
}
let ultHud=-1, tAviso=0;
function hud(){
  const e=Math.round(vida.e); if(e===ultHud&&!(vida.caido>0)) return; ultHud=e;
  $('energiaBarra').style.width=e+'%';
  $('energiaBarra').style.background=e>55?'#22c55e':e>25?'#facc15':'#ef4444';
  $('energiaTxt').textContent=vida.caido>0?'desmaiado':e+'%';
}
function aviso(txt){ const a=$('aviso'); a.textContent=txt; a.style.opacity=1; clearTimeout(tAviso); tAviso=setTimeout(()=>a.style.opacity=0,3500); }

/* ───────── barrinha sobre os outros jogadores ───────── */
export function barraSprite(){
  const cv=document.createElement('canvas'); cv.width=128; cv.height=16;
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true})); s.scale.set(1.1,0.14,1); s.renderOrder=21;
  s.userData={cv,t,e:-1}; return s;
}
export function pintarBarra(s, e){
  e=Math.max(0,Math.min(100,Math.round(e))); if(s.userData.e===e) return; s.userData.e=e;
  const k=s.userData.cv.getContext('2d'); k.clearRect(0,0,128,16);
  k.fillStyle='rgba(12,14,18,.8)'; k.fillRect(0,0,128,16);
  k.fillStyle=e>55?'#22c55e':e>25?'#facc15':'#ef4444'; k.fillRect(2,2,124*e/100,12);
  s.userData.t.needsUpdate=true;
}
