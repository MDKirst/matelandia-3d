// Modo online: jogadores na mesma cidade se veem. Sem servidor próprio: Trystero (WebRTC, conexão
// direta entre os navegadores; para se acharem usa relays públicos do Nostr). Funciona com o jogo
// no GitHub Pages. Cada um manda ~10× por segundo: nome, personagem, posição, rumo, animação e o
// veículo em que está. Terrenos, casas e dinheiro continuam só no navegador de cada um.
// Atenção: em conexão direta, cada jogador vê o IP dos outros (como numa chamada de vídeo).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene, $ } from './cena.js';

const TRYSTERO='https://cdn.jsdelivr.net/npm/trystero@0.26.0/+esm';
// ?sala=nome no link = sala particular (grupo de amigos ou teste), separada da sala pública
const PARTICULAR=(new URLSearchParams(location.search).get('sala')||'').toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,24);
const CONFIG={ appId:'matelandia3d-cidade-2026' }, SALA=PARTICULAR?'particular-'+PARTICULAR:'matelandia';
const LIMITE=15, SALAS_MAX=20, ESPERA=4000;   // até 15 por sala; cheia → abre a próxima
const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);

// filtro simples de nome (sem HTML, sem palavrão, até 16 letras)
const FEIO=/(porra|caralh|puta|merda|bucet|foder|fod[ae]|viad|cuzao|cuzão|arrombad|piroc|xoxot|vagabund|desgraç|corno|bosta)/gi;
export const limparFala=s=>(s||'').replace(/[\u0000-\u001f<>]/g,'').replace(/\s+/g,' ').trim().slice(0,120).replace(FEIO,'***');
export function limparNome(s){ s=(s||'').replace(/[<>&"'`]/g,'').replace(/\s+/g,' ').trim().slice(0,16).replace(FEIO,'***'); return s||'Visitante'; }

export const online={ ativo:false, sala:null, envio:null, outros:new Map(), eu:null, tentativa:0 };
let arquivos={}, tEnvio=0;

export async function entrarOnline(nome, personagem){
  online.eu={ n:limparNome(nome), p:personagem };
  if(online.ativo||online.entrando){ return; }
  online.entrando=true; const tentativa=++online.tentativa;
  let sala=null;
  try{
    const { joinRoom } = await import(TRYSTERO);
    // salas automáticas: entra na 1ª que tiver menos de LIMITE jogadores
    for(let i=1;i<=SALAS_MAX;i++){
      $('online').textContent=`🌐 procurando sala ${i}…`;
      sala=joinRoom(CONFIG,`${SALA}-${i}`);
      await new Promise(ok=>setTimeout(ok,ESPERA));                   // tempo para os que já estão lá aparecerem
      if(tentativa!==online.tentativa){ try{ sala.leave(); }catch(e){} return; }   // desligou o online no meio da busca
      if(Object.keys(sala.getPeers()).length<LIMITE||i===SALAS_MAX){ online.num=i; break; }
      try{ sala.leave(); }catch(e){}
    }
    online.sala=sala; online.ativo=true; tEnvio=1;
    const est=sala.makeAction('est'); online.envio=est;
    est.onMessage=(d,{peerId})=>receber(peerId,d);
    const fala=sala.makeAction('fala'); online.fala=fala;
    fala.onMessage=(d,{peerId})=>ouvir(peerId,d);
    $('chatBtn').style.display='inline-block'; $('chat').style.display='flex';
    linha(null,`Você entrou na sala ${PARTICULAR||online.num||1}. Aperte Enter para conversar.`);
    sala.onPeerJoin=()=>{ tEnvio=1; hud(); };                         // manda o estado já para quem chegou
    sala.onPeerLeave=id=>{ remover(id); hud(); };
    hud();
  }catch(e){ if(sala&&!online.ativo){ try{ sala.leave(); }catch(_){} } console.warn('online indisponível',e); $('online').textContent='🌐 online indisponível'; }
  finally{ online.entrando=false; }
}
export function sairOnline(){ online.tentativa++; if(online.sala){ try{ online.sala.leave(); }catch(e){} } online.ativo=false; online.sala=null; online.fala=null; fecharChat(); $('chatBtn').style.display='none'; $('chat').style.display='none'; for(const id of [...online.outros.keys()]) remover(id); hud(); }
function hud(){ const n=online.outros.size; $('online').textContent=online.ativo?`🌐 ${PARTICULAR?'sala '+PARTICULAR+(online.num>1?' '+online.num:''):'sala '+(online.num||1)} · ${n?n+(n>1?' jogadores':' jogador'):'ninguém por perto ainda'}`:''; }

// meu estado (chamado todo quadro pelo main): x,z,r (rumo), a (animação), vt (veículo) e vh (rumo do veículo)
export function enviarEstado(dt, s){
  if(!online.ativo||!online.envio) return;
  tEnvio+=dt; if(tEnvio<0.1) return; tEnvio=0;
  const r=v=>Math.round(v*100)/100;
  try{ online.envio.send({ n:online.eu.n, p:online.eu.p, x:r(s.x), z:r(s.z), r:r(s.r), a:s.a, vt:s.vt||null, vh:s.vh!=null?r(s.vh):null }); }catch(e){}
}

/* ───────── jogadores remotos ───────── */
function carregar(url){ return arquivos[url]??=new Promise(ok=>loader.load(url,g=>ok(g),undefined,()=>ok(null))); }
function etiqueta(nome){
  const cv=document.createElement('canvas'); cv.width=256; cv.height=64; const k=cv.getContext('2d');
  k.fillStyle='rgba(12,14,18,.75)'; k.beginPath(); k.roundRect(4,8,248,48,14); k.fill();
  k.fillStyle='#fcd34d'; k.font='800 30px system-ui,sans-serif'; k.textAlign='center'; k.textBaseline='middle'; k.fillText(nome,128,33);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true})); s.scale.set(2.2,0.55,1); s.renderOrder=21; return s;
}
async function receber(id,d){
  if(!d||typeof d.x!=='number'||typeof d.z!=='number') return;
  let o=online.outros.get(id);
  if(!o){ o={ id, x:d.x, z:d.z, r:d.r||0, alvo:{...d}, visto:0, grupo:new THREE.Group(), boneco:null, veic:null, vt:null, mixer:null, acoes:{}, atual:null, nome:'' };
    scene.add(o.grupo); online.outros.set(id,o); hud(); }
  o.alvo=d; o.visto=performance.now();
  const nome=limparNome(d.n);
  if(nome!==o.nome){ if(o.tag) o.grupo.remove(o.tag); o.tag=etiqueta(nome); o.grupo.add(o.tag); o.nome=nome; }
  if(d.p&&d.p!==o.pid){ o.pid=d.p; vestir(o,d.p); }
  if((d.vt||null)!==o.vt){ o.vt=d.vt||null; trocarVeiculo(o); }
}
async function vestir(o,pid){
  const url=pid==='maicon'?'assets/maicon-animado.glb':`assets/pessoas/${pid.replace(/[^a-z0-9-]/g,'')}.glb`;
  const g=await carregar(url); if(!g||o.pid!==pid) return;
  if(o.boneco) o.grupo.remove(o.boneco);
  const b=clonarEsqueleto(g.scene); b.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(b,true), e=1.75/((box.max.y-box.min.y)||1.75); b.scale.multiplyScalar(e);
  b.position.y=-box.min.y*e; b.traverse(m=>{ if(m.isMesh) m.frustumCulled=false; });
  o.grupo.add(b); o.boneco=b; o.mixer=new THREE.AnimationMixer(b); o.acoes={}; o.atual=null;
  const achar=re=>g.animations.find(a=>re.test(a.name));
  const A=c=>c?o.mixer.clipAction(c):null;
  o.acoes={ parado:A(achar(/^parado$|idle/i)), andar:A(achar(/^andar$|walk/i)), correr:A(achar(/^correr$|run/i)), acenar:A(achar(/acenar|wave|clap/i)) };
  if(o.tag){ o.tag.position.y=2.25; }
  if(o.veic) o.boneco.visible=false;
}
async function trocarVeiculo(o){
  if(o.veic){ scene.remove(o.veic); o.veic=null; }
  if(o.boneco) o.boneco.visible=!o.vt;
  if(!o.vt) return;
  const vt=o.vt.replace(/[^a-z0-9-]/g,''), g=await carregar(`assets/veiculos/${vt}.glb`); if(!g||o.vt!==vt) return;
  o.veic=g.scene.clone(); o.veic.rotation.order='YXZ'; scene.add(o.veic);
}
function remover(id){ const o=online.outros.get(id); if(!o) return; scene.remove(o.grupo); if(o.veic) scene.remove(o.veic); online.outros.delete(id); }

// suaviza o movimento entre as mensagens e toca a animação certa
export function atualizarOnline(dt){
  const agora=performance.now();
  for(const o of online.outros.values()){
    if(agora-o.visto>30000){ remover(o.id); hud(); continue; }   // aba em segundo plano manda pouco: 30 s de tolerância
    const a=o.alvo, k=Math.min(1,dt*8);
    o.x+=(a.x-o.x)*k; o.z+=(a.z-o.z)*k;
    let dr=(a.r||0)-o.r; dr=Math.atan2(Math.sin(dr),Math.cos(dr)); o.r+=dr*k;
    o.grupo.position.set(o.x,0,o.z);
    if(o.boneco){ o.boneco.rotation.y=o.r; const n=o.acoes[a.a]||o.acoes.parado; if(n&&n!==o.atual){ if(o.atual) o.atual.fadeOut(0.25); n.reset().fadeIn(0.25).play(); o.atual=n; } o.mixer.update(dt); }
    if(o.veic){ o.veic.position.set(o.x,0,o.z); if(a.vh!=null){ let dh=a.vh-o.veic.rotation.y; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); o.veic.rotation.y+=dh*k; } }
    if(o.tag) o.tag.position.y=o.vt?3.2:2.25;
    if(o.balao){ o.balao.position.y=(o.vt?3.2:2.25)+0.75; if(agora>o.balaoFim){ o.grupo.remove(o.balao); o.balao=null; } }
  }
}
export const posicoesJogadores=()=>[...online.outros.values()].map(o=>[o.x,o.z]);

/* ───────── chat da sala ───────── */
// Enter abre a caixa, Enter envia, Esc fecha. A fala aparece no histórico e num balão sobre o jogador.
let ultimoEnvio=0; const ultFala=new Map();
function linha(nome, txt, eu=false){
  const d=document.createElement('div');
  if(nome==null){ d.className='sis'; d.textContent=txt; }
  else{ if(eu) d.className='eu'; const b=document.createElement('b'); b.textContent=nome+': '; d.append(b, txt); }
  const log=$('chatLog'); log.append(d); while(log.children.length>8) log.firstChild.remove();
  setTimeout(()=>d.classList.add('velha'),15000);
}
function balao(txt){
  const cv=document.createElement('canvas'); cv.width=512; cv.height=96; const k=cv.getContext('2d');
  k.font='600 30px system-ui,sans-serif'; let t=txt; while(k.measureText(t).width>470&&t.length>4) t=t.slice(0,-2);
  if(t!==txt) t=t.trimEnd()+'…';
  const w=Math.min(500,k.measureText(t).width+36);
  k.fillStyle='rgba(255,255,255,.94)'; k.beginPath(); k.roundRect(256-w/2,6,w,62,16); k.fill();
  k.beginPath(); k.moveTo(244,66); k.lineTo(256,88); k.lineTo(268,66); k.fill();
  k.fillStyle='#111827'; k.textAlign='center'; k.textBaseline='middle'; k.fillText(t,256,38);
  const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tx,depthTest:false,transparent:true})); s.scale.set(4.2,0.79,1); s.renderOrder=22; return s;
}
function ouvir(id,d){
  if(!d||typeof d.t!=='string') return;
  const o=online.outros.get(id), agora=performance.now();
  if(agora-(ultFala.get(id)||0)<700) return; ultFala.set(id,agora);           // anti-flood
  const txt=limparFala(d.t); if(!txt) return;
  linha(o?.nome||limparNome(d.n), txt);
  if(!o) return;                                                           // ainda não sabemos onde ele está: só o histórico
  if(o.balao) o.grupo.remove(o.balao);
  o.balao=balao(txt); o.balaoFim=agora+7000; o.grupo.add(o.balao);
}
function enviarFala(){
  const inp=$('chatIn'), txt=limparFala(inp.value); inp.value='';
  if(!txt||!online.fala) return;
  const agora=performance.now(); if(agora-ultimoEnvio<800) return; ultimoEnvio=agora;
  try{ online.fala.send({t:txt, n:online.eu?.n}); }catch(e){}
  linha(online.eu?.n||'Você', txt, true);
}
function abrirChat(){ if(!online.ativo) return; $('chat').classList.add('aberto'); const i=$('chatIn'); i.focus(); }
function fecharChat(){ $('chat').classList.remove('aberto'); $('chatIn').blur(); }
$('chatIn').addEventListener('keydown',e=>{
  e.stopPropagation();                                                   // não anda nem abre o menu enquanto digita
  if(e.key==='Enter'){ enviarFala(); fecharChat(); }
  else if(e.key==='Escape') fecharChat();
});
$('chatIn').addEventListener('blur',()=>$('chat').classList.remove('aberto'));
addEventListener('keydown',e=>{
  if(e.key!=='Enter'||!online.ativo||document.body.classList.contains('em-home')) return;
  if(document.activeElement&&document.activeElement.tagName==='INPUT') return;
  e.preventDefault(); abrirChat();
});
$('chatBtn').addEventListener('click',e=>{ e.currentTarget.blur(); abrirChat(); });
