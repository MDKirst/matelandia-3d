// 💼 Trabalhos para juntar dinheiro (O ou botão 💼), além das entregas de veículo:
//  - Gari: recolher 8 sacos de lixo espalhados nas calçadas perto de você (a pé, encostando neles);
//  - Panfletagem: entregar panfleto para 6 pessoas (chegue perto; algumas recusam, conforme o jeito delas).
// Paga por item e um bônus se terminar antes do tempo. Um trabalho de cada vez, e não junto com entrega.
import * as THREE from 'three';
import { scene, camera, $ } from './cena.js';
import { ruas } from './cidade.js';
import { bloqueado } from './mundo.js';
import { ganhar, fmt, avisarTerreno as avisar } from './terrenos.js';
import { entregarPanfleto, semPanfleto } from './pedestres.js';
import { somEntrega } from './som.js';

export const TRABALHOS = {
  gari:      { ic:'🧹', nome:'Gari',         desc:'Recolha 8 sacos de lixo nas calçadas', meta:8, tempo:180, paga:90, bonus:300 },
  panfleto:  { ic:'📄', nome:'Panfletagem',  desc:'Entregue panfleto para 6 pessoas',      meta:6, tempo:150, paga:70, bonus:250 },
};
export const trabalho = { tipo:null };
const sacos=[];
const geoSaco=new THREE.IcosahedronGeometry(0.38,1).scale(1,0.85,1), matSaco=new THREE.MeshLambertMaterial({color:0x1f2937,flatShading:true});
const geoNo=new THREE.ConeGeometry(0.1,0.22,6), matNo=new THREE.MeshLambertMaterial({color:0xfacc15});
const COM_CALCADA=new Set(['primary','secondary','tertiary','residential','unclassified','living_street']);

function pontoCalcada(px,pz){
  const vias=ruas.filter(r=>!r.pe&&COM_CALCADA.has(r.tipo)&&r.pts.length>1&&r.bb[0]<px+120&&r.bb[2]>px-120&&r.bb[1]<pz+120&&r.bb[3]>pz-120);
  for(let t=0;t<60&&vias.length;t++){
    const r=vias[(Math.random()*vias.length)|0], i=(Math.random()*(r.pts.length-1))|0, a=r.pts[i], b=r.pts[i+1], s=Math.random();
    const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1, lado=Math.random()<0.5?1:-1, off=lado*(r.w/2+0.3+1.6);
    const x=a[0]+dx*s-dz/L*off, z=a[1]+dz*s+dx/L*off, d=Math.hypot(x-px,z-pz);
    if(d<20||d>115||bloqueado(x,z)) continue;
    if(sacos.some(q=>Math.hypot(q.x-x,q.z-z)<12)) continue;
    return [x,z];
  }
  return null;
}
function limpar(){ for(const s of sacos) scene.remove(s.obj); sacos.length=0; trabalho.tipo=null; $('trabalho').style.display='none'; }
function terminar(ok){
  const T=TRABALHOS[trabalho.tipo], feitos=trabalho.feitos, valor=feitos*T.paga+(ok?T.bonus:0);
  if(valor>0){ ganhar(valor); somEntrega(true); }
  avisar(ok?`${T.ic} Trabalho feito! +${fmt(valor)} (com bônus)`:`⏱ Tempo acabou: ${feitos} de ${T.meta} · +${fmt(valor)}`);
  if(ok) dispatchEvent(new CustomEvent('matelandia:trabalho',{detail:{tipo:trabalho.tipo}}));
  limpar();
}
export function comecar(tipo, px, pz){
  if(trabalho.tipo) limpar();
  const T=TRABALHOS[tipo]; Object.assign(trabalho,{ tipo, feitos:0, t:T.tempo, cd:0 });
  if(tipo==='gari'){ for(let i=0;i<T.meta;i++){ const p=pontoCalcada(px,pz); if(!p) continue;
      const g=new THREE.Group(); const s=new THREE.Mesh(geoSaco,matSaco); s.position.y=0.3; const n=new THREE.Mesh(geoNo,matNo); n.position.y=0.72; g.add(s,n);
      g.position.set(p[0],0,p[1]); g.rotation.y=Math.random()*6; scene.add(g); sacos.push({x:p[0],z:p[1],obj:g}); }
    if(!sacos.length){ limpar(); avisar('Sem calçada por perto: vá para uma rua da cidade'); return; }
    trabalho.meta=sacos.length; }
  else trabalho.meta=T.meta;
  $('trabalho').style.display='block'; avisar(`${T.ic} ${T.nome}: `+(tipo==='gari'?`recolha ${trabalho.meta} sacos de lixo nas calçadas`:T.desc.toLowerCase()));
}
export function cancelar(){ if(trabalho.tipo){ avisar('Trabalho cancelado'); limpar(); } }

// a cada quadro (a pé; no veículo o trabalho espera)
export function atualizarTrabalho(dt, px, pz, aPe){
  if(!trabalho.tipo) return null;
  const T=TRABALHOS[trabalho.tipo]; trabalho.t-=dt;
  if(trabalho.t<=0){ terminar(false); return null; }
  let alvo=null;
  if(trabalho.tipo==='gari'){
    for(const s of sacos) s.obj.rotation.y+=dt*0.6;
    if(aPe) for(let i=sacos.length-1;i>=0;i--){ const s=sacos[i]; if(Math.hypot(s.x-px,s.z-pz)<1.5){ scene.remove(s.obj); sacos.splice(i,1); trabalho.feitos++; somEntrega(false); } }
    let md=1e9; for(const s of sacos){ const d=Math.hypot(s.x-px,s.z-pz); if(d<md){ md=d; alvo=[s.x,s.z]; } }
  } else {
    trabalho.cd-=dt;
    if(aPe&&trabalho.cd<=0){ const r=entregarPanfleto(px,pz); if(r){ trabalho.cd=0.8; if(r==='ok'){ trabalho.feitos++; somEntrega(false); } } }
    alvo=semPanfleto(px,pz);
  }
  if(trabalho.feitos>=trabalho.meta){ terminar(true); return null; }
  // painel e seta
  $('trabalhoTxt').textContent=`${T.ic} ${T.nome}: ${trabalho.feitos} de ${trabalho.meta}`;
  const d=alvo?Math.hypot(alvo[0]-px,alvo[1]-pz):0;
  $('trabalhoDist').textContent=(alvo?`${Math.round(d)} m · `:'')+`⏱ ${Math.ceil(trabalho.t)} s`+(aPe?'':' · desça do veículo');
  if(alvo){ const fx=px-camera.position.x, fz=pz-camera.position.z, ang=Math.atan2(alvo[0]-px,alvo[1]-pz)-Math.atan2(fx,fz); $('trabalhoSeta').style.transform=`rotate(${-ang}rad)`; }
  return alvo;
}

// menu
export function abrirTrabalhos(emEntrega){
  const g=$('trabLista'); g.replaceChildren();
  for(const [id,T] of Object.entries(TRABALHOS)){ const b=document.createElement('button'); b.className='neg';
    const i=document.createElement('div'); i.className='ic'; i.textContent=T.ic;
    const tx=document.createElement('div'); const nm=document.createElement('b'); nm.textContent=T.nome; const s=document.createElement('span');
    s.textContent=`${T.desc} · ${fmt(T.paga)} cada + bônus ${fmt(T.bonus)} · ${String(Math.round(T.tempo/60*10)/10).replace('.',',')} min`; tx.append(nm,s); b.append(i,tx);
    b.disabled=emEntrega; b.onclick=()=>{ $('trabalhos').classList.remove('on'); dispatchEvent(new CustomEvent('matelandia:comecar',{detail:id})); }; g.append(b); }
  const e=document.createElement('div'); e.className='neg info'; e.textContent='🚚 Entregador: entre num veículo e aperte N (paga mais com caminhão e sem batida).'; g.append(e);
  $('trabInfo').textContent=emEntrega?'Termine a entrega antes de pegar outro trabalho.':trabalho.tipo?`Você está no trabalho de ${TRABALHOS[trabalho.tipo].nome}. Escolher outro cancela este.`:'Junte dinheiro para comprar um terreno e abrir o seu negócio.';
  const a=$('trabAcoes'); a.replaceChildren();
  if(trabalho.tipo){ const c=document.createElement('button'); c.className='sec'; c.textContent='Cancelar trabalho atual'; c.onclick=()=>{ cancelar(); $('trabalhos').classList.remove('on'); }; a.append(c); }
  $('trabalhos').classList.add('on');
}
$('trabFechar').addEventListener('click',()=>$('trabalhos').classList.remove('on'));
$('trabalhos').addEventListener('click',e=>{ if(e.target.id==='trabalhos') $('trabalhos').classList.remove('on'); });
