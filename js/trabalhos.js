// 💼 Trabalhos para juntar dinheiro (O ou botão 💼), além das entregas de veículo:
//  - Gari: recolher 8 sacos de lixo espalhados nas calçadas perto de você (a pé, encostando neles);
//  - Panfletagem: entregar panfleto para 6 pessoas (chegue perto; algumas recusam, conforme o jeito delas);
//  - Jardineiro: regar 6 canteiros nas calçadas (parado 3 s em cada);
//  - Leiturista: anotar o relógio de luz de 6 casas (parado 2 s na porta);
//  - Motorista de app: buscar e levar 3 passageiros, com qualquer veículo.
// Paga por item e um bônus se terminar antes do tempo. Um trabalho de cada vez, e não junto com entrega.
import * as THREE from 'three';
import { scene, camera, $ } from './cena.js';
import { ruas } from './cidade.js';
import { bloqueado } from './mundo.js';
import { ganhar, fmt, avisarTerreno as avisar } from './terrenos.js';
import { entregarPanfleto, semPanfleto } from './pedestres.js';
import { casas, acharPorta } from './casas.js';
import { somEntrega } from './som.js';

export const TRABALHOS = {
  gari:       { ic:'🧹', nome:'Gari',             desc:'Recolha 8 sacos de lixo nas calçadas',              meta:8, tempo:180, paga:90,  bonus:300, onde:'calcada', modelo:'saco' },
  panfleto:   { ic:'📄', nome:'Panfletagem',      desc:'Entregue panfleto para 6 pessoas',                  meta:6, tempo:150, paga:70,  bonus:250 },
  jardineiro: { ic:'🌻', nome:'Jardineiro',       desc:'Regue 6 canteiros nas calçadas (3 s em cada)',      meta:6, tempo:200, paga:85,  bonus:280, onde:'calcada', modelo:'canteiro', segurar:3 },
  leiturista: { ic:'🔌', nome:'Leiturista de luz',desc:'Anote o relógio de luz de 6 casas (2 s na porta)',  meta:6, tempo:220, paga:95,  bonus:320, onde:'casa', modelo:'relogio', segurar:2 },
  motorista:  { ic:'🚕', nome:'Motorista de app', desc:'Busque e leve 3 passageiros (com qualquer veículo)', meta:3, tempo:360, paga:180, bonus:450, carro:true },
};
export const trabalho = { tipo:null };
const alvos=[];   // {x,z,obj,seg}
const COM_CALCADA=new Set(['primary','secondary','tertiary','residential','unclassified','living_street']);

/* ───────── modelos dos pontos ───────── */
const geoSaco=new THREE.IcosahedronGeometry(0.38,1).scale(1,0.85,1), matSaco=new THREE.MeshLambertMaterial({color:0x1f2937,flatShading:true});
const geoNo=new THREE.ConeGeometry(0.1,0.22,6), matNo=new THREE.MeshLambertMaterial({color:0xfacc15});
const geoFeixe=new THREE.CylinderGeometry(0.7,0.7,14,16,1,true);
const feixe=cor=>{ const m=new THREE.Mesh(geoFeixe,new THREE.MeshBasicMaterial({color:cor,transparent:true,opacity:0.22,depthWrite:false,side:THREE.DoubleSide})); m.position.y=7; return m; };
function modelo(tipo){
  const g=new THREE.Group();
  if(tipo==='saco'){ const s=new THREE.Mesh(geoSaco,matSaco); s.position.y=0.3; const n=new THREE.Mesh(geoNo,matNo); n.position.y=0.72; g.add(s,n); }
  else if(tipo==='canteiro'){                                                  // canteiro de terra com flores
    const t=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.25,0.8),new THREE.MeshLambertMaterial({color:0x6b4423})); t.position.y=0.12; g.add(t);
    for(let i=0;i<6;i++){ const f=new THREE.Mesh(new THREE.SphereGeometry(0.12,6,4),new THREE.MeshLambertMaterial({color:[0xfacc15,0xef4444,0xf472b6][i%3]})); f.position.set(-0.5+i*0.2,0.38,(i%2-0.5)*0.35); g.add(f); }
    g.add(feixe(0x22c55e)); }
  else if(tipo==='relogio'){                                                   // caixa do relógio de luz num poste curto
    const p=new THREE.Mesh(new THREE.BoxGeometry(0.12,1.3,0.12),new THREE.MeshLambertMaterial({color:0x9ca3af})); p.position.y=0.65;
    const c=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.55,0.25),new THREE.MeshLambertMaterial({color:0xe5e7eb})); c.position.y=1.35; g.add(p,c);
    g.add(feixe(0x38bdf8)); }
  else if(tipo==='passageiro'){                                                // passageiro esperando, com feixe amarelo
    const b=new THREE.Mesh(new THREE.CapsuleGeometry(0.28,0.9,4,8),new THREE.MeshLambertMaterial({color:0x2563eb})); b.position.y=0.75;
    const h=new THREE.Mesh(new THREE.SphereGeometry(0.2,10,8),new THREE.MeshLambertMaterial({color:0xd6a77a})); h.position.y=1.6; g.add(b,h);
    g.add(feixe(0xfacc15)); }
  else if(tipo==='destino') g.add(feixe(0x22c55e));
  return g;
}

/* ───────── onde pôr os pontos ───────── */
function pontoCalcada(px,pz,min=20,max=115){
  const vias=ruas.filter(r=>!r.pe&&COM_CALCADA.has(r.tipo)&&r.pts.length>1&&r.bb[0]<px+max&&r.bb[2]>px-max&&r.bb[1]<pz+max&&r.bb[3]>pz-max);
  for(let t=0;t<80&&vias.length;t++){
    const r=vias[(Math.random()*vias.length)|0], i=(Math.random()*(r.pts.length-1))|0, a=r.pts[i], b=r.pts[i+1], s=Math.random();
    const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1, lado=Math.random()<0.5?1:-1, off=lado*(r.w/2+0.3+1.6);
    const x=a[0]+dx*s-dz/L*off, z=a[1]+dz*s+dx/L*off, d=Math.hypot(x-px,z-pz);
    if(d<min||d>max||bloqueado(x,z)) continue;
    if(alvos.some(q=>Math.hypot(q.x-x,q.z-z)<12)) continue;
    return [x,z];
  }
  return null;
}
function portaDeCasa(px,pz){
  const perto=casas.filter(c=>{ const d=Math.hypot(c.cx-px,c.cz-pz); return d>15&&d<150&&!alvos.some(q=>q.casa===c); });
  for(let t=0;t<30&&perto.length;t++){ const c=perto.splice((Math.random()*perto.length)|0,1)[0]; c.porta??=acharPorta(c)||null;
    if(c.porta&&!bloqueado(c.porta[0],c.porta[1])) return [c.porta[0],c.porta[1],c]; }
  return null;
}
function porPonto(tipo,x,z,extra={}){ const g=modelo(tipo); g.position.set(x,0,z); g.rotation.y=Math.random()*6; scene.add(g); const a={x,z,obj:g,seg:0,...extra}; alvos.push(a); return a; }

function limpar(){ for(const s of alvos) scene.remove(s.obj); alvos.length=0; trabalho.tipo=null; $('trabalho').style.display='none'; }
function terminar(ok){
  const T=TRABALHOS[trabalho.tipo], feitos=trabalho.feitos, valor=feitos*T.paga+(ok?T.bonus:0);
  if(valor>0){ ganhar(valor); somEntrega(true); }
  avisar(ok?`${T.ic} Trabalho feito! +${fmt(valor)} (com bônus)`:`⏱ Tempo acabou: ${feitos} de ${T.meta} · +${fmt(valor)}`);
  if(ok) dispatchEvent(new CustomEvent('matelandia:trabalho',{detail:{tipo:trabalho.tipo}}));
  limpar();
}
export function comecar(tipo, px, pz){
  if(trabalho.tipo) limpar();
  const T=TRABALHOS[tipo]; Object.assign(trabalho,{ tipo, feitos:0, t:T.tempo, cd:0, etapa:null });
  if(T.onde){
    for(let i=0;i<T.meta;i++){ const p=T.onde==='casa'?portaDeCasa(px,pz):pontoCalcada(px,pz); if(!p) continue; porPonto(T.modelo,p[0],p[1],p[2]?{casa:p[2]}:{}); }
    if(!alvos.length){ limpar(); avisar(T.onde==='casa'?'Sem casas por perto: vá para um bairro':'Sem calçada por perto: vá para uma rua da cidade'); return; }
    trabalho.meta=alvos.length;
  } else if(T.carro){
    trabalho.meta=T.meta; if(!novoPassageiro(px,pz)){ limpar(); avisar('Sem rua por perto: vá para a cidade'); return; }
  } else trabalho.meta=T.meta;
  $('trabalho').style.display='block';
  avisar(`${T.ic} ${T.nome}: `+(tipo==='gari'?`recolha ${trabalho.meta} sacos de lixo nas calçadas`:T.desc.charAt(0).toLowerCase()+T.desc.slice(1)));
}
function novoPassageiro(px,pz){
  const p=pontoCalcada(px,pz,40,220)||pontoCalcada(px,pz,15,320); if(!p) return false;
  porPonto('passageiro',p[0],p[1]); trabalho.etapa='buscar'; return true;
}
export function cancelar(){ if(trabalho.tipo){ avisar('Trabalho cancelado'); limpar(); } }

// a cada quadro. aPe: o jogador está a pé · v: velocidade do veículo (m/s) se estiver dirigindo
export function atualizarTrabalho(dt, px, pz, aPe, v=0){
  if(!trabalho.tipo) return null;
  const T=TRABALHOS[trabalho.tipo]; trabalho.t-=dt;
  if(trabalho.t<=0){ terminar(false); return null; }
  let alvo=null, extra='';
  if(T.carro){                                                            // motorista de app
    const a=alvos[0];
    if(a&&!aPe&&Math.abs(v)<2.5&&Math.hypot(a.x-px,a.z-pz)<6){
      scene.remove(a.obj); alvos.length=0;
      if(trabalho.etapa==='buscar'){
        const d=pontoCalcada(px,pz,250,650)||pontoCalcada(px,pz,120,800);
        if(d){ porPonto('destino',d[0],d[1]); trabalho.etapa='levar'; somEntrega(false); avisar('🙋 Passageiro embarcou! Leve até o ponto verde'); }
        else novoPassageiro(px,pz);
      } else { trabalho.feitos++; somEntrega(false);
        if(trabalho.feitos<trabalho.meta){ avisar(`🚕 Corrida ${trabalho.feitos} de ${trabalho.meta} feita! Próximo passageiro no ponto amarelo`); novoPassageiro(px,pz); } }
    }
    const b=alvos[0]; if(b) alvo=[b.x,b.z];
    extra=aPe?' · entre num veículo':trabalho.etapa==='buscar'?' · pare no ponto amarelo':' · pare no ponto verde';
  } else if(T.onde){                                                       // gari, jardineiro, leiturista
    for(const s of alvos) if(T.modelo==='saco') s.obj.rotation.y+=dt*0.6;
    if(aPe) for(let i=alvos.length-1;i>=0;i--){ const s=alvos[i];
      if(Math.hypot(s.x-px,s.z-pz)<(T.segurar?1.8:1.5)){
        s.seg+=dt; if(T.segurar){ extra=` · ${T.modelo==='canteiro'?'regando':'anotando'} ${Math.min(100,Math.round(s.seg/T.segurar*100))}%`; }
        if(s.seg>=(T.segurar||0)){ scene.remove(s.obj); alvos.splice(i,1); trabalho.feitos++; somEntrega(false); }
      } else s.seg=0; }
    let md=1e9; for(const s of alvos){ const d=Math.hypot(s.x-px,s.z-pz); if(d<md){ md=d; alvo=[s.x,s.z]; } }
    if(!aPe) extra=' · desça do veículo';
  } else {                                                                 // panfletagem
    trabalho.cd-=dt;
    if(aPe&&trabalho.cd<=0){ const r=entregarPanfleto(px,pz); if(r){ trabalho.cd=0.8; if(r==='ok'){ trabalho.feitos++; somEntrega(false); } } }
    alvo=semPanfleto(px,pz); if(!aPe) extra=' · desça do veículo';
  }
  if(trabalho.feitos>=trabalho.meta){ terminar(true); return null; }
  // painel e seta
  $('trabalhoTxt').textContent=`${T.ic} ${T.nome}: ${trabalho.feitos} de ${trabalho.meta}`;
  const d=alvo?Math.hypot(alvo[0]-px,alvo[1]-pz):0;
  $('trabalhoDist').textContent=(alvo?`${Math.round(d)} m · `:'')+`⏱ ${Math.ceil(trabalho.t)} s`+extra;
  if(alvo){ const fx=px-camera.position.x, fz=pz-camera.position.z, ang=Math.atan2(alvo[0]-px,alvo[1]-pz)-Math.atan2(fx,fz); $('trabalhoSeta').style.transform=`rotate(${-ang}rad)`; }
  return alvo;
}

// menu
export function abrirTrabalhos(emEntrega){
  const g=$('trabLista'); g.replaceChildren();
  for(const [id,T] of Object.entries(TRABALHOS)){ const b=document.createElement('button'); b.className='neg';
    const i=document.createElement('div'); i.className='ic'; i.textContent=T.ic;
    const tx=document.createElement('div'); const nm=document.createElement('b'); nm.textContent=T.nome; const s=document.createElement('span');
    s.textContent=`${T.desc} · ${fmt(T.paga)} ${T.carro?'por corrida':'cada'} + bônus ${fmt(T.bonus)} · ${String(Math.round(T.tempo/60*10)/10).replace('.',',')} min`; tx.append(nm,s); b.append(i,tx);
    b.disabled=emEntrega; b.onclick=()=>{ $('trabalhos').classList.remove('on'); dispatchEvent(new CustomEvent('matelandia:comecar',{detail:id})); }; g.append(b); }
  const e=document.createElement('div'); e.className='neg info'; e.textContent='🚚 Entregador: entre num veículo e '+(matchMedia('(pointer:coarse)').matches?'toque em 🚚 Entrega':'aperte N')+' (paga mais com caminhão e sem batida).'; g.append(e);
  $('trabInfo').textContent=emEntrega?'Termine a entrega antes de pegar outro trabalho.':trabalho.tipo?`Você está no trabalho de ${TRABALHOS[trabalho.tipo].nome}. Escolher outro cancela este.`:'Junte dinheiro para comprar um terreno e abrir o seu negócio.';
  const a=$('trabAcoes'); a.replaceChildren();
  if(trabalho.tipo){ const c=document.createElement('button'); c.className='sec'; c.textContent='Cancelar trabalho atual'; c.onclick=()=>{ cancelar(); $('trabalhos').classList.remove('on'); }; a.append(c); }
  $('trabalhos').classList.add('on');
}
$('trabFechar').addEventListener('click',()=>$('trabalhos').classList.remove('on'));
$('trabalhos').addEventListener('click',e=>{ if(e.target.id==='trabalhos') $('trabalhos').classList.remove('on'); });
