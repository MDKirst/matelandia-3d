// Tela inicial: título, escolha do personagem (prévia 3D girando) e o botão JOGAR.
// A cidade carrega por trás enquanto a câmera sobrevoa o centro. Esc ou ☰ Menu voltam aqui.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { $ } from './cena.js';
import { usarPersonagem } from './avatar.js';
import { nuvem, conectarNuvem, aoTrocarConta, entrarGoogle, sairGoogle } from './nuvem.js';

// Maicon + os 18 da Quaternius (assets/pessoas)
export const PERSONAGENS = [
  { id:'maicon', nome:'Maicon', papel:'o criador', arq:'assets/maicon-animado.glb', admin:true },
  ...[['male-casual','Lucas','casual'],['female-casual','Ana','casual'],['male-shirt','Pedro','camisa'],['female-dress','Clara','vestido'],
     ['male-long-sleeve','João','manga longa'],['female-tank-top','Júlia','regata'],['male-suit','Dr. Paulo','terno'],['female-alternative','Bia','alternativa'],
     ['male-casual-2-24','Rafa','casual'],['female-casual-2-24','Luana','casual'],['male-worker-24','Seu Antônio','trabalhador'],['female-worker-24','Dona Cida','trabalhadora'],
     ['male-farmer-24','Seu Valdir','agricultor'],['female-formal-24','Helena','social'],['male-casual-hoodie-24','Theo','moletom'],['female-suit-24','Marta','executiva'],
     ['male-beach-24','Kauã','praia'],['male-suit-24','Ricardo','executivo']]
    .map(([id,nome,papel])=>({ id, nome, papel, arq:`assets/pessoas/${id}.glb` })),
];

const guardado=()=>{ try{ return localStorage.getItem('matelandia3d.personagem'); }catch(e){ return null; } };
const guardar=id=>{ try{ localStorage.setItem('matelandia3d.personagem',id); }catch(e){} };
// O Maicon é só do admin: fica fora da lista até o navegador provar o código (link ?admin=código, uma vez;
// depois fica lembrado). No código do jogo vai só o hash, não o código.
const ADMIN_HASH='1199dc852d953fb37c6da26901d59eceeafd6a96adf67a6261c6037cfa176191';
let lista=PERSONAGENS.filter(p=>!p.admin);
let idx=Math.max(0,lista.findIndex(p=>p.id===guardado()));
async function liberarAdmin(){
  try{
    const url=new URL(location.href), daUrl=url.searchParams.get('admin'), cod=daUrl||localStorage.getItem('matelandia3d.admin');
    if(!cod) return;
    if(daUrl){ url.searchParams.delete('admin'); history.replaceState(null,'',url); }      // o código não fica na barra de endereço
    const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('matelandia3d:'+cod));
    if([...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join('')!==ADMIN_HASH){ localStorage.removeItem('matelandia3d.admin'); return; }
    localStorage.setItem('matelandia3d.admin',cod);
    const era=lista[idx].id, salvo=guardado();
    lista=PERSONAGENS; idx=Math.max(0,lista.findIndex(p=>p.id===(daUrl||!salvo||salvo==='maicon'?'maicon':era))); mostrar();
  }catch(e){}
}
export const home={ aberta:true };
// nome e online lembrados no navegador
try{ $('nomeJog').value=localStorage.getItem('matelandia3d.nome')||''; $('onlineJog').checked=localStorage.getItem('matelandia3d.online')!=='0'; }catch(e){}

/* ───────── prévia 3D ───────── */
const cv=$('prev'), r=new THREE.WebGLRenderer({canvas:cv, antialias:true, alpha:true});
r.setPixelRatio(Math.min(devicePixelRatio,2)); r.outputColorSpace=THREE.SRGBColorSpace;
const cena=new THREE.Scene(), cam=new THREE.PerspectiveCamera(30,cv.width/cv.height,0.1,50);
cena.add(new THREE.HemisphereLight(0xffffff,0x445566,2.2)); const sol=new THREE.DirectionalLight(0xfff1dd,2); sol.position.set(2,4,3); cena.add(sol);
const chao=new THREE.Mesh(new THREE.CircleGeometry(0.75,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xF97316,transparent:true,opacity:.25})); cena.add(chao);
cam.position.set(0,1.05,4.6); cam.lookAt(0,0.9,0);
const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const cache={}, arquivos={}; let atual=null, mixer=null, giro=0, pedido=0;
function mostrar(){
  const p=lista[idx], meu=++pedido;
  $('nomePers').replaceChildren(p.nome, Object.assign(document.createElement('small'),{textContent:p.papel}));
  const usar=g=>{
    if(meu!==pedido) return;
    if(atual) cena.remove(atual);
    atual=g.scene; atual.updateMatrixWorld(true);
    const b=new THREE.Box3().setFromObject(atual,true), e=1.8/((b.max.y-b.min.y)||1.8);
    atual.scale.setScalar(atual.scale.x*e); atual.updateMatrixWorld(true);
    const b2=new THREE.Box3().setFromObject(atual,true), c=b2.getCenter(new THREE.Vector3());
    atual.position.set(atual.position.x-c.x,atual.position.y-b2.min.y,atual.position.z-c.z);
    cena.add(atual);
    mixer=new THREE.AnimationMixer(atual);
    const clip=g.animations.find(a=>/^(parado|idle)$/i.test(a.name))||g.animations.find(a=>/idle|parad/i.test(a.name))||g.animations[0];
    if(clip) mixer.clipAction(clip).play();
  };
  if(cache[p.id]) usar(cache[p.id]);
  else baixar(p).then(buf=>loader.parse(buf.slice(0),'',g=>{ cache[p.id]=g; usar(g); },()=>{})).catch(()=>{});
}
// guarda o arquivo: a prévia usa, e o jogo reaproveita ao clicar em JOGAR
function baixar(p){ return arquivos[p.id] ??= fetch(p.arq).then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.arrayBuffer(); });
}
const relogio=new THREE.Clock();
(function quadro(){ requestAnimationFrame(quadro); if(!home.aberta) return; const dt=Math.min(relogio.getDelta(),0.05); giro+=dt*0.6; if(atual) atual.rotation.y=giro; if(mixer) mixer.update(dt); r.render(cena,cam); })();

/* ───────── botões ───────── */
const trocar=d=>{ idx=(idx+d+lista.length)%lista.length; mostrar(); };
$('ant').onclick=()=>trocar(-1); $('prox').onclick=()=>trocar(1);
addEventListener('keydown',e=>{
  if(home.aberta){ const digita=document.activeElement?.id==='nomeJog'; if(!digita&&e.code==='ArrowLeft') trocar(-1); if(!digita&&e.code==='ArrowRight') trocar(1); if(e.code==='Enter'&&!$('jogar').disabled) jogar(); return; }
  if(e.code==='Escape') abrir();
});
$('menu').onclick=e=>{ e.currentTarget.blur(); abrir(); };
$('jogar').onclick=()=>jogar();
let escolhido=null;
function jogar(){
  const p=lista[idx]; guardar(p.id);
  const nome=$('nomeJog').value.trim(), on=$('onlineJog').checked;
  try{ localStorage.setItem('matelandia3d.nome',nome); localStorage.setItem('matelandia3d.online',on?'1':'0'); }catch(e){}
  dispatchEvent(new CustomEvent('matelandia:jogar',{detail:{personagem:p.id, nome:nome||p.nome, online:on}}));
  if(escolhido!==p.id){ escolhido=p.id; baixar(p).then(buf=>usarPersonagem(p.arq,buf.slice(0))).catch(()=>usarPersonagem(p.arq)); }
  home.aberta=false; $('home').classList.add('fora'); document.body.classList.remove('em-home'); $('jogar').blur();
  setTimeout(()=>{ if(!home.aberta) $('home').style.display='none'; },400);   // some de vez depois do esmaecimento
}
function abrir(){ home.aberta=true; $('home').style.display=''; requestAnimationFrame(()=>$('home').classList.remove('fora')); document.body.classList.add('em-home'); relogio.getDelta(); }
// a cidade avisa quando dá para jogar
/* ───────── conta Google (opcional) ───────── */
function mostrarConta(){
  const c=$('conta'), g=nuvem.conta;
  if(!nuvem.ok){ c.style.display='none'; return; } c.style.display='';
  if(g){ const b=document.createElement('b'); b.textContent=g.nome||'conta Google';
    const s=Object.assign(document.createElement('button'),{className:'sair',textContent:'sair'}); s.onclick=sair;
    c.replaceChildren('✔ Entrou como ',b,' · ',s);
    if(!$('nomeJog').value.trim()&&g.nome) $('nomeJog').value=g.nome.split(' ')[0].slice(0,16);
  } else {
    const b=Object.assign(document.createElement('button'),{id:'google',className:'sec',textContent:'Entrar com Google'}); b.onclick=entrar;
    c.replaceChildren(b,Object.assign(document.createElement('span'),{textContent:'guarda seus terrenos em qualquer aparelho'}));
  }
}
async function entrar(){
  const b=$('google'); if(b){ b.disabled=true; b.textContent='Abrindo o Google…'; }
  const r=await entrarGoogle(async n=>confirm(`Essa conta Google já foi usada em outro aparelho e vai trazer os terrenos de lá.\n\n`+
    `${n===1?'O terreno':'Os '+n+' terrenos'} que você tem neste navegador como visitante ${n===1?'continua':'continuam'} no mapa, mas você não vai mais poder construir ${n===1?'nele':'neles'}.\n\nEntrar mesmo assim?`));
  if(r==='bloqueado') alert('O navegador bloqueou a janela do Google. Libere janelas pop-up para este site e tente de novo.');
  else if(r==='erro') alert('Não deu para entrar com o Google agora. Tente de novo mais tarde.');
  mostrarConta();
}
async function sair(){
  if(!confirm('Sair da conta Google?\n\nSeus terrenos continuam na sua conta e voltam quando você entrar de novo. Neste navegador você vira visitante.')) return;
  await sairGoogle(); mostrarConta();
}
$('conta').style.display='none';
aoTrocarConta(mostrarConta);
conectarNuvem().then(mostrarConta);

export function pronto(){ const b=$('jogar'); b.disabled=false; b.textContent='JOGAR'; $('carrega').textContent=''; }
export function progresso(txt){ $('carrega').textContent=txt; }
mostrar();
liberarAdmin();
