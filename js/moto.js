// Moto custom (chopper de guidão alto, a Bison Seca-Suvaco do Couro & Asfalto, modelo de IA):
// rodas girando em pivô no eixo, inclinação na curva e o piloto SENTADO com as mãos nas manoplas.
// O piloto é o próprio boneco do jogador: os ossos de coxa, canela, braço e antebraço são
// apontados para o banco, as pedaleiras e o guidão (vale para os esqueletos Mixamo e Quaternius).
import * as THREE from 'three';

// medidas do modelo (motos-ia.ts do Couro & Asfalto): altura do banco, guidão [altura, z],
// meia largura das manoplas, z do banco e da pedaleira (frente = −Z)
export const CHOPPER = { banco:0.74, guidao:[1.49,-0.32], manopla:0.47, selim:0.26, pe:-0.42 };

// pivôs nos eixos para as rodas girarem no lugar (o nó da roda vem com a origem fora do centro)
export function prepararRodas(obj){
  const ex=obj.userData.eixos||[-0.95,0.86], ey=obj.userData.eixoY||[0.34,0.34], raio=(ey[0]+ey[1])/2;
  obj.updateMatrixWorld(true); const rodas=[];
  ['rodaD','rodaT'].forEach((nome,i)=>{ const m=obj.getObjectByName(nome); if(!m) return;
    const piv=new THREE.Group(); piv.position.set(0,ey[i],ex[i]); obj.add(piv); piv.updateMatrixWorld(true); piv.attach(m); rodas.push(piv); });
  return { rodas, raio };
}
export function girarRodas(c,dt){ if(!c.rodas) return; for(const p of c.rodas) p.rotation.x-=c.v*dt/c.raio; }

/* ───────── piloto ───────── */
const lado=(n,s)=>s<0?/left|\.l$/i.test(n):/right|\.r$/i.test(n);
const filhoOsso=o=>o&&o.children.find(c=>c.isBone);
function membros(raiz){
  const b=[]; raiz.traverse(o=>{ if(o.isBone) b.push(o); });
  const acha=(re,s)=>b.find(o=>re.test(o.name)&&lado(o.name,s));
  const r={};
  for(const s of [-1,1]){
    const coxa=acha(/up_?leg|upper_?leg/i,s), canela=filhoOsso(coxa), pe=filhoOsso(canela);
    const braco=acha(/upper_?arm|(left|right)arm$/i,s), ante=filhoOsso(braco), mao=filhoOsso(ante);
    r[s]={coxa,canela,pe,braco,ante,mao};
  }
  return r;
}
const qa=new THREE.Quaternion(), qb=new THREE.Quaternion(), qc=new THREE.Quaternion(), va=new THREE.Vector3(), vb=new THREE.Vector3(), vt=new THREE.Vector3();
// gira o osso para que a direção osso→filho aponte para o alvo (mundo)
function mirar(osso, filho, alvo){
  if(!osso||!filho) return;
  osso.getWorldPosition(va); filho.getWorldPosition(vb);
  const d=vb.sub(va).normalize(), t=vt.copy(alvo).sub(va).normalize(); if(d.lengthSq()<1e-6) return;
  qa.setFromUnitVectors(d,t); osso.getWorldQuaternion(qb); osso.parent.getWorldQuaternion(qc);
  osso.quaternion.copy(qc.invert().multiply(qa.multiply(qb))); osso.updateMatrixWorld(true);
}
const ponto=(moto,x,y,z)=>moto.localToWorld(new THREE.Vector3(x,y,z));

// põe o jogador (Group com o boneco) sentado na moto. Chamado a cada quadro enquanto pilota
// (a moto inclina e anda; o boneco vai junto). Os ossos são apontados só quando montar=true.
export function sentar(jogador, moto, montar){
  const M=CHOPPER;
  moto.updateMatrixWorld(true);
  const banco=ponto(moto,0,M.banco,M.selim);
  if(montar){ jogador.userData.altQuadril=quadril(jogador); }
  const hq=jogador.userData.altQuadril||0.9;
  jogador.rotation.order='YXZ'; jogador.rotation.y=moto.rotation.y+Math.PI; jogador.rotation.z=-moto.rotation.z; jogador.rotation.x=0;
  jogador.position.set(banco.x,banco.y+0.06-hq,banco.z);
  if(!montar) return;
  jogador.updateMatrixWorld(true);
  const r=membros(jogador);
  for(const s of [-1,1]){ const m=r[s]; if(!m.coxa) continue;
    // pernas: joelho à frente do banco, pé na pedaleira avançada (comando à frente, jeito de chopper)
    mirar(m.coxa,m.canela,ponto(moto,s*0.24,M.banco+0.06,M.pe+0.2));
    mirar(m.canela,m.pe,ponto(moto,s*0.3,0.36,M.pe));
    // braços: cotovelo meio aberto, mão na manopla do guidão alto
    const [gy,gz]=M.guidao, mao=ponto(moto,s*M.manopla,gy,gz);
    mirar(m.braco,m.ante,ponto(moto,s*(M.manopla-0.04),gy-0.28,(gz+M.selim)/2));
    mirar(m.ante,m.mao,mao);
  }
}
// altura do quadril do boneco em pé (média das coxas), em relação aos pés
function quadril(jogador){
  jogador.updateMatrixWorld(true); const r=membros(jogador), y0=jogador.getWorldPosition(new THREE.Vector3()).y;
  const ys=[-1,1].map(s=>r[s].coxa?.getWorldPosition(new THREE.Vector3()).y).filter(v=>v!=null);
  return ys.length?ys.reduce((a,b)=>a+b,0)/ys.length-y0:0.9;
}
export function descer(jogador){ jogador.rotation.z=0; jogador.rotation.x=0; }
