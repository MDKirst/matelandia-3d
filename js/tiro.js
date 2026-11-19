// Tiro (19/11, pedido do Maicon): personagem que já vem com pistola na mão (Ricardo, malha "Pistol" da Quaternius)
// atira no lugar do soco (J / 👊). Clarão na mão + risco da bala; o acerto usa os mesmos golpear* da briga,
// com alcance longo e mira estreita (até ALCANCE m, no máximo LARGURA m de lado da linha do tiro).
import * as THREE from 'three';
import { scene } from './cena.js';

export const ALCANCE=30, LARGURA=0.8;

// a malha da arma dentro do modelo (ou null)
export const acharArma=raiz=>{ let a=null; raiz.traverse(o=>{ if(!a&&/^pistol/i.test(o.name)) a=o; }); return a; };   // na Quaternius é um grupo com 3 malhas

const MAO=/^(mixamorig)?RightHand$|^Hand.?R$|^Wrist.?R$|^hand_r$/i;   // Quaternius: WristR
const v=new THREE.Vector3();
// ponta da arma: mão direita + um palmo à frente (a pistola é malha com esqueleto: não tem posição própria)
export function bocaDaArma(raiz, fx, fz, alvo=new THREE.Vector3()){
  let mao=raiz.userData.maoArma;                                        // guardada por modelo (o suporte do jogador troca de personagem)
  if(mao===undefined||raiz.userData.maoDe!==raiz.children[0]){ mao=null; raiz.traverse(o=>{ if(!mao&&o.isBone&&MAO.test(o.name)) mao=o; });
    raiz.userData.maoArma=mao; raiz.userData.maoDe=raiz.children[0]; }
  if(mao){ mao.getWorldPosition(alvo); alvo.x+=fx*0.22; alvo.z+=fz*0.22; }
  else { raiz.getWorldPosition(alvo); alvo.set(alvo.x+fx*0.6, alvo.y+1.35, alvo.z+fz*0.6); }
  return alvo;
}

/* ───────── clarão + risco ───────── */
const riscos=[];
const matRisco=new THREE.LineBasicMaterial({color:0xffe08a,transparent:true,opacity:0.9});
const matClarao=new THREE.MeshBasicMaterial({color:0xffd166});
const geoClarao=new THREE.SphereGeometry(0.1,6,4);
export function desenharTiro(de, fx, fz, dist=ALCANCE){
  const ate=v.set(de.x+fx*dist, de.y-0.15, de.z+fz*dist);
  const L=new THREE.Line(new THREE.BufferGeometry().setFromPoints([de.clone(),ate.clone()]),matRisco);
  const f=new THREE.Mesh(geoClarao,matClarao); f.position.copy(de);
  L.renderOrder=f.renderOrder=20; scene.add(L,f); riscos.push({L,f,t:0.08});
}
export function atualizarTiros(dt){
  for(let i=riscos.length-1;i>=0;i--){ const r=riscos[i]; r.t-=dt;
    if(r.t<=0){ scene.remove(r.L,r.f); r.L.geometry.dispose(); riscos.splice(i,1); } }
}

// alvo está na linha do tiro? (frente do atirador, até alc m, perto da linha) · devolve a distância ou -1
export function naMira(dx, dz, fx, fz, alc=ALCANCE, larg=LARGURA){
  const ao=dx*fx+dz*fz; if(ao<=0.3||ao>alc) return -1;
  return Math.abs(dx*fz-dz*fx)<=larg ? ao : -1;
}
