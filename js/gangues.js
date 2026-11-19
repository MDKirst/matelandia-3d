// Gangues da noite (pedido do Maicon em 16/11): duas gangues rivais, os Corvos na Vila Nova e os Tubarões
// na Vila Pasa (do outro lado da BR-277, posição pelo mapa da prefeitura). Das 19h às 5h ficam reunidas numa esquina do bairro. Jogador a pé que entra no território
// é abordado e interrogado (1–4 ou clique); conforme a resposta, deixam passar, dão um prazo para sair ou
// sacam a arma e atiram. Quem mora no bairro (tem casa lá) passa direto. O tiro tira energia como a briga:
// desmaiou, acorda no hospital (main.js). Dá para revidar no soco e no chute (3 golpes derrubam um).
import * as THREE from 'three';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene, $ } from './cena.js';
import { toXZ } from './geo.js';
import { ruas } from './cidade.js';
import { bloqueado, pontoLivre } from './mundo.js';
import { horaJogo } from './ceu.js';
import { carregarModelo, falar } from './pedestres.js';
import { poseGolpe } from './luta.js';
import { naMira } from './tiro.js';
import { casas } from './casas.js';
import { nuvem } from './nuvem.js';
import { somTiro, somPancada } from './som.js';

const GANGUES=[
  { id:'corvos',   nome:'Corvos',   bairro:'Vila Nova',  ll:[-25.2422,-53.9916], cor:0xb91c1c, ic:'🐦‍⬛',
    modelos:['male-casual-hoodie-24','male-punk-24','male-casual-2-24','male-shirt'] },
  { id:'tubaroes', nome:'Tubarões', bairro:'Vila Pasa', ll:[-25.2445,-53.9717], cor:0x1d4ed8, ic:'🦈',
    modelos:['male-long-sleeve','male-beach-24','male-casual','male-worker-24'] },
];
const RAIO=140, PERTO=260, VIDA=3, PRAZO=20;
const noite=()=>{ const h=horaJogo(); return h>=19||h<5; };
const sorte=()=>Math.random(), sorteia=l=>l[(sorte()*l.length)|0];
const dist=(a,b,x,z)=>Math.hypot(a-x,b-z);

// esquina de encontro: o vértice de rua (com nome) mais perto do centro do bairro
function esquina(c){
  let m=null, md=1e9;
  for(const r of ruas){ if(r.pe||!r.nome) continue; for(const p of r.pts){ const d=dist(p[0],p[1],c[0],c[1]); if(d<md){ md=d; m=p; } } }
  return m?pontoLivre(m[0]+4,m[1]+4):c;
}

let pronto=false;
export async function iniciarGangues(){
  for(const g of GANGUES){
    g.c=toXZ(g.ll[0],g.ll[1]); g.ponto=esquina(g.c); g.membros=[]; g.estado='calmo'; g.liberado=0; g.queimado=0; g.prazo=0; g.aviso=0;
    g.moldes=(await Promise.all(g.modelos.map(carregarModelo))).filter(Boolean);
  }
  pronto=true;
}
// bandana na testa e pistola na mão direita (só aparece quando saca)
function vestir(g,m,i){
  const obj=clonarEsqueleto(m.cena), e=1.78/m.altura; obj.scale.multiplyScalar(e); obj.rotation.order='YXZ';
  obj.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
  const corpo=new THREE.Group(); corpo.add(obj); scene.add(corpo);
  const band=new THREE.Mesh(new THREE.CylinderGeometry(0.17,0.18,0.09,14,1,true),new THREE.MeshLambertMaterial({color:g.cor,side:THREE.DoubleSide}));
  let cabeca=null, mao=null; obj.traverse(o=>{ if(!o.isBone) return; if(!cabeca&&/head/i.test(o.name)) cabeca=o; if(!mao&&/(right.?hand|hand\.?r|hand_r|lowerarm\.?r|rightforearm)$/i.test(o.name)) mao=o; });
  const arma=new THREE.Group(); { const pr=new THREE.MeshLambertMaterial({color:0x111111});
    const cano=new THREE.Mesh(new THREE.BoxGeometry(0.04,0.05,0.2),pr); cano.position.set(0,0.02,0.07); arma.add(cano);
    const cabo=new THREE.Mesh(new THREE.BoxGeometry(0.035,0.11,0.05),pr); cabo.position.set(0,-0.04,0); cabo.rotation.x=0.25; arma.add(cabo); }
  arma.scale.setScalar(1.6); arma.visible=false; scene.add(arma); scene.add(band);
  const mixer=new THREE.AnimationMixer(obj), acoes={}; for(const [n,c] of Object.entries(m.anims)) acoes[n]=mixer.clipAction(c);
  const [x,z]=pontoLivre(g.ponto[0]+Math.cos(i*1.6)*2.2, g.ponto[1]+Math.sin(i*1.6)*2.2);
  return { g, obj:corpo, modelo:obj, pe:-m.base*e, x, z, y:0, rumo:0, mixer, acoes, atual:null, cabeca, mao, band, arma, vida:VIDA, caido:0, cd:1+sorte()*2, casa:[x,z] };
}
function animar(p,nome,vel=1){ const a=p.acoes[nome]||p.acoes.parado; if(!a) return; a.timeScale=vel; if(a===p.atual) return; if(p.atual) p.atual.fadeOut(0.25); a.reset().fadeIn(0.25).play(); p.atual=a; }
function sumir(g){ for(const p of g.membros){ scene.remove(p.obj); scene.remove(p.band); scene.remove(p.arma); } g.membros=[]; g.estado='calmo'; }
function nascer(g){ if(g.membros.length||!g.moldes.length) return; g.membros=g.moldes.map((m,i)=>vestir(g,m,i)); g.estado='calmo'; }

/* ───────── tiro: clarão na arma + risco até o alvo ───────── */
const riscos=[];
const matRisco=new THREE.LineBasicMaterial({color:0xffe08a,transparent:true,opacity:0.9});
const clarao=new THREE.MeshBasicMaterial({color:0xffd166});
function atirar(p,x,y,z){
  const de=new THREE.Vector3(); p.arma.getWorldPosition(de);
  const L=new THREE.Line(new THREE.BufferGeometry().setFromPoints([de,new THREE.Vector3(x,y,z)]),matRisco); scene.add(L);
  const f=new THREE.Mesh(new THREE.SphereGeometry(0.09,6,4),clarao); f.position.copy(de); scene.add(f);
  riscos.push({o:[L,f],t:0.07});
}

/* ───────── interrogatório ───────── */
let pergunta=null;   // { g, t }
function caixa(){
  let d=$('gangue'); if(d) return d;
  d=document.createElement('div'); d.id='gangue'; document.body.append(d);
  const st=document.createElement('style'); st.textContent=`
  #gangue{position:fixed;left:50%;bottom:120px;transform:translateX(-50%);z-index:11;display:none;width:min(520px,calc(100vw - 32px));
    background:rgba(12,14,18,.92);border:2px solid #b91c1c;border-radius:14px;padding:14px 16px;color:#f8fafc;font:14px system-ui,sans-serif}
  #gangue.on{display:block} #gangue b{display:block;font-size:16px;margin-bottom:4px} #gangue p{margin:0 0 10px;color:#e2e8f0}
  #gangue button{display:block;width:100%;text-align:left;margin-top:6px;padding:9px 12px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#f8fafc;font:600 14px system-ui,sans-serif;cursor:pointer}
  #gangue button:hover{background:#334155} #gangue small{color:#94a3b8}`; document.head.append(st);
  d.addEventListener('tecla',e=>{ const n=+String(e.detail).replace('Digit',''); if(n>=1&&n<=4) responder(n); });
  return d;
}
function abrirPergunta(g){
  const rival=GANGUES.find(o=>o!==g);
  pergunta={g,t:14}; const d=caixa(); d.replaceChildren(); d.style.borderColor='#'+new THREE.Color(g.cor).getHexString();
  const t=document.createElement('b'); t.textContent=`${g.ic} ${g.nome} · ${g.bairro}`;
  const q=document.createElement('p'); q.textContent=sorteia(['Ô, parceiro! Tu é de onde? Que que tá fazendo na quebrada a essa hora?','Para aí! Nunca te vi por aqui. Veio fazer o quê na '+g.bairro+'?','Chega mais. Tá perdido? Aqui é área dos '+g.nome+'.']);
  d.append(t,q);
  ['Moro aqui, tô indo pra casa.','Tô só de passagem, já tô saindo.',`Sou dos ${rival.nome}.`,'Não te devo satisfação.'].forEach((txt,i)=>{
    const b=document.createElement('button'); b.textContent=`${i+1}. ${txt}`; b.onclick=()=>{ responder(i+1); b.blur(); }; d.append(b); });
  const s=document.createElement('small'); s.textContent='Responda com 1, 2, 3 ou 4. Ficar calado ou correr também é resposta.'; d.append(s);
  d.classList.add('on'); falar(g.membros[0],'Para aí! Tu é de onde?',3);
}
function fecharPergunta(){ pergunta=null; $('gangue')?.classList.remove('on'); }
const moraEm=g=>casas.some(c=>c.dono&&c.dono===nuvem.uid&&dist(...(c.porta||[c.cx,c.cz]),g.c[0],g.c[1])<RAIO+30);
function responder(n){
  if(!pergunta) return; const g=pergunta.g, chefe=g.membros[0]; fecharPergunta();
  if(n===1){ if(moraEm(g)||sorte()<0.5){ liberar(g); falar(chefe,'Então vai direto pra casa. Boa noite, vizinho.',3.5); }
    else hostil(g,'Mentira! Nunca te vi aqui!'); }
  else if(n===2){ g.estado='prazo'; g.prazo=PRAZO; falar(chefe,`Então vaza! Tem ${PRAZO} segundos.`,3.5); }
  else if(n===3) hostil(g,`${GANGUES.find(o=>o!==g).nome} aqui? Perdeu! Os ${g.nome} não perdoam!`);
  else hostil(g,'Folgado! Vai aprender a respeitar!');
}
function liberar(g){ g.estado='liberado'; g.liberado=1; }
let avisar=()=>{};
function hostil(g,fala){
  g.estado='hostil'; g.queimado=1; g.tHostil=0; fecharPergunta();
  if(g.membros[0]) falar(g.membros[0],fala||'Pega ele!',3);
  for(const p of g.membros) if(!p.caido) p.cd=0.5+sorte()*0.8;
  avisar(`🔫 Os ${g.nome} sacaram as armas! Corre pra fora da ${g.bairro}!`);
}

// soco/chute do jogador num membro (até 1,8 m na frente). Devolve true se acertou.
export function golpearGangue(x,z,fx,fz,tipo){
  for(const g of GANGUES) for(const p of g.membros){ if(p.caido) continue;
    const ax=p.x-x, az=p.z-z, d=Math.hypot(ax,az);
    if(tipo==='tiro'){ if(naMira(ax,az,fx,fz)<0) continue; } else if(d>1.8||(ax*fx+az*fz)/(d||1)<0.35) continue;
    p.vida-=tipo==='tiro'?2:tipo==='chute'?1.5:1; p.x+=fx*0.4; p.z+=fz*0.4;
    if(p.vida<=0){ p.caido=40; falar(p,'Ai!',1.5); }
    if(g.estado!=='hostil') hostil(g,'Bateu num dos nossos!');
    return true; }
  return false;
}
export const posicoesGangues=()=>GANGUES.flatMap(g=>g.membros.filter(p=>!p.caido).map(p=>[p.x,p.z]));
export const territorio=(x,z)=>noite()?GANGUES.find(g=>g.c&&dist(x,z,g.c[0],g.c[1])<RAIO)||null:null;

// jog: {x,z,dirigindo,caido} · bater(dano,fx,fz) → true se o jogador desmaiou · aviso(txt)
export function atualizarGangues(dt, jog, bater, aviso){
  if(!pronto) return; avisar=aviso;
  for(let i=riscos.length-1;i>=0;i--){ const r=riscos[i]; r.t-=dt; if(r.t<=0){ for(const o of r.o){ scene.remove(o); o.geometry.dispose(); } riscos.splice(i,1); } }
  const ehNoite=noite();
  for(const g of GANGUES){
    const dJ=dist(jog.x,jog.z,g.c[0],g.c[1]);
    if(!ehNoite||dJ>PERTO+80){ if(g.membros.length){ sumir(g); if(pergunta?.g===g) fecharPergunta(); } if(!ehNoite){ g.liberado=0; g.queimado=0; } continue; }
    if(dJ<PERTO) nascer(g); if(!g.membros.length) continue;
    const dentro=dJ<RAIO;
    g.aviso-=dt; if(dentro&&g.aviso<=0&&g.estado!=='hostil'){ g.aviso=60; aviso(`${g.ic} Território dos ${g.nome} (${g.bairro}) · cuidado à noite`); }
    // decide o que fazer com quem chegou
    if(g.estado==='calmo'&&dentro&&!jog.dirigindo&&!jog.caido){
      if(moraEm(g)){ liberar(g); falar(g.membros[0],'Boa noite, vizinho!',2.5); }
      else if(g.queimado) hostil(g,'Voltou? Agora vai!');
      else if(!g.liberado){ g.estado='abordar'; g.tAbordar=0; }
    }
    if(g.estado==='abordar'&&(!dentro||jog.dirigindo)) g.estado='calmo';
    if(g.estado==='prazo'){ g.prazo-=dt; if(!dentro) liberar(g); else if(g.prazo<=0) hostil(g,'Avisei! Agora vai!'); }
    if(g.estado==='hostil'){ g.tHostil+=dt; if(jog.caido||dJ>RAIO+60){ g.estado='calmo'; if(jog.caido&&g.membros[0]) falar(g.membros[0],`Aqui é ${g.bairro}! Some daqui!`,3); } }
    if(pergunta?.g===g){ pergunta.t-=dt; const ch=g.membros[0];
      if(pergunta.t<=0) { fecharPergunta(); hostil(g,'Ficou mudo? Então vai!'); }
      else if(ch&&dist(jog.x,jog.z,ch.x,ch.z)>12){ fecharPergunta(); hostil(g,'Tá correndo por quê? Pega ele!'); } }
    for(const [i,p] of g.membros.entries()) mover(g,p,i,dt,jog,bater,dentro);
  }
}

function andarAte(p,tx,tz,vel,dt){
  const ax=tx-p.x, az=tz-p.z, d=Math.hypot(ax,az); if(d<0.05) return d;
  const nx=p.x+ax/d*vel*dt, nz=p.z+az/d*vel*dt;
  if(!bloqueado(nx,nz)){ p.x=nx; p.z=nz; } else if(!bloqueado(nx,p.z)) p.x=nx; else if(!bloqueado(p.x,nz)) p.z=nz;
  p.rumo=Math.atan2(ax,az); return d;
}
const V=new THREE.Vector3();
function mover(g,p,i,dt,jog,bater){
  let mirando=false;
  if(p.caido>0){ p.caido-=dt; animar(p,'parado'); p.modelo.rotation.x=-Math.PI/2; p.y=0.2; if(p.caido<=0){ p.vida=VIDA; p.modelo.rotation.x=0; p.y=0; } }
  else if(g.estado==='abordar'||pergunta?.g===g){
    // o chefe chega na frente, os outros cercam
    const ang=Math.atan2(p.x-jog.x,p.z-jog.z)+(i?(i-1.5)*0.9:0), r=i?2.6:1.6;
    const d=andarAte(p,jog.x+Math.sin(ang)*r,jog.z+Math.cos(ang)*r,i?4:3.2,dt);
    if(d>0.4) animar(p,d>4?'correr':'andar'); else { p.rumo=Math.atan2(jog.x-p.x,jog.z-p.z); animar(p,'parado'); }
    if(i===0&&!pergunta&&g.estado==='abordar'){ g.tAbordar=(g.tAbordar||0)+dt;   // chegou perto (ou travou no caminho): pergunta assim mesmo
      if(dist(p.x,p.z,jog.x,jog.z)<3.5||g.tAbordar>10){ g.estado='perguntando'; g.tAbordar=0; abrirPergunta(g); } }
  }
  else if(g.estado==='hostil'){
    const d=dist(p.x,p.z,jog.x,jog.z);
    if(d>9+i*1.5) { andarAte(p,jog.x,jog.z,4.6,dt); animar(p,'correr'); }
    else { p.rumo=Math.atan2(jog.x-p.x,jog.z-p.z); animar(p,'parado'); mirando=true;
      p.cd-=dt; if(p.cd<=0&&!jog.caido){ p.cd=1+sorte()*1.1; somTiro(d);
        const acerta=!jog.dirigindo&&sorte()<Math.max(0.25,0.8-d*0.04), ex=acerta?0:(sorte()-0.5)*3;
        atirar(p,jog.x+ex,(jog.y||0)+1.2,jog.z+ex);
        if(acerta){ const l=d||1; bater(7+sorte()*5,(jog.x-p.x)/l,(jog.z-p.z)/l); } } }
  }
  else { // calmo / liberado / prazo: de volta à esquina, em roda conversando
    const d=andarAte(p,p.casa[0],p.casa[1],1.4,dt);
    if(d>0.3) animar(p,'andar'); else { p.rumo=Math.atan2(g.ponto[0]-p.x,g.ponto[1]-p.z); animar(p, p.acoes.mexer&&(performance.now()/1000+i*1.3)%5<1.6?'mexer':'parado'); }
    if(g.estado==='prazo'&&i===0&&dist(p.x,p.z,jog.x,jog.z)<25){ p.rumo=Math.atan2(jog.x-p.x,jog.z-p.z); mirando=true; }
  }
  p.mixer.update(dt);
  p.obj.position.set(p.x,p.y+p.pe,p.z); p.obj.rotation.y=p.rumo; p.obj.updateMatrixWorld(true);
  if(mirando) poseGolpe(p.modelo,'soco',0.45,Math.sin(p.rumo),Math.cos(p.rumo));
  p.arma.visible=mirando||g.estado==='hostil';
  if(p.mao){ p.mao.getWorldPosition(V); const f=/lowerarm|forearm/i.test(p.mao.name)?0.3:0.05;   // antebraço: a arma vai na ponta (onde fica a mão)
    p.arma.position.set(V.x+Math.sin(p.rumo)*f,V.y,V.z+Math.cos(p.rumo)*f); p.arma.rotation.set(0,p.rumo,0); }
  if(p.cabeca){ p.cabeca.getWorldPosition(V); p.band.position.set(V.x,V.y+0.16,V.z); p.band.rotation.y=p.rumo; p.band.visible=!p.caido; }
}
// para o teste automático (tools/teste/gangue.mjs)
export const estadoGangues=()=>GANGUES.map(g=>({ id:g.id, estado:g.estado, membros:g.membros.length, chefe:g.membros[0]&&[g.membros[0].x|0,g.membros[0].z|0], tA:g.tAbordar, moldes:g.moldes?.length, c:g.c, ponto:g.ponto, pronto }));
export const _gangues=GANGUES;
