// Teclado, mouse/toque e o campo "Ir para"
import { cv, $ } from './cena.js';
import { toXZ } from './geo.js';
import { av, jogador } from './avatar.js';
import { satelite } from './satelite.js';
import { status } from './cidade.js';
import { alternarSom } from './som.js';
import { alternarMapa, fecharMapa } from './mapa.js';

export const tecla={};
export const cam={ yaw:0.6, pitch:0.42, dist:9 };  // câmera orbital atrás do avatar
export const toque={ joy:null };                    // joystick virtual (lado esquerdo da tela no celular)
export const pedido={ usar:false, acao:null };      // usar: entrar/sair do veículo (E); acao: interagir com pedestre
const dedos={};
const digitando=()=>document.activeElement&&document.activeElement.tagName==='INPUT';

// janela aberta (negócio, trabalhos, jornal, conquistas, foto): Esc fecha só ela; as outras teclas esperam
const JANELAS='#negocio.on,#trabalhos.on,#jornal.on,#conquistas.on,#foto.on,#mapa.on,#gangue.on,#balcao.on,#papo.on';
export const janelaAberta=()=>document.querySelector(JANELAS);
addEventListener('keydown',e=>{ const j=janelaAberta(); if(!j) return;
  e.stopImmediatePropagation(); if(j.id==='gangue'||j.id==='papo'){ j.dispatchEvent(new CustomEvent('tecla',{detail:e.code})); for(const k in tecla) tecla[k]=false; return; }   // interrogatório da gangue: só 1–4
  if(e.code==='Escape'||(e.code==='KeyM'&&j.id==='mapa')) j.classList.remove('on');
  for(const k in tecla) tecla[k]=false; },true);
addEventListener('keydown',e=>{
  if(digitando()) return;
  tecla[e.code]=true;
  if((e.code==='KeyE'||e.code==='KeyF')&&!e.repeat) pedido.usar=true;
  const ACOES={KeyT:'conversar',KeyG:'cumprimentar',KeyH:'seguir',KeyX:'assustar'};
  if(ACOES[e.code]&&!e.repeat) pedido.acao=ACOES[e.code];
  if(e.code==='KeyJ'&&!e.repeat) pedido.golpe='soco';
  if(e.code==='KeyK'&&!e.repeat) pedido.golpe='chute';
  if(e.code==='KeyB'&&!e.repeat) pedido.comprar=true;
  if(e.code==='KeyC'&&!e.repeat) pedido.obra=true;
  if(e.code==='KeyN'&&!e.repeat) pedido.entrega=true;
  if(e.code==='KeyL'&&!e.repeat) pedido.casa=true;
  if(e.code==='KeyP'&&!e.repeat) pedido.foto=true;
  if(e.code==='KeyV'&&!e.repeat) pedido.negocio=true;
  if(e.code==='KeyO'&&!e.repeat) pedido.trabalho=true;
  if(e.code==='KeyQ'&&!e.repeat) alternarAtalhos();
  if(e.code==='KeyY'&&!e.repeat){ $('status').textContent=alternarSom()?'🔊 Som ligado (Y)':'🔇 Som desligado (Y)'; setTimeout(status,2500); }
  if(e.code==='KeyM'&&!e.repeat) alternarMapa();
  if(e.code==='BracketRight'||e.code==='BracketLeft'){
    const z=satelite.mudarZoom(e.code==='BracketRight'?1:-1);
    $('status').textContent='Detalhe do satélite: zoom '+z; setTimeout(status,2500);
  }
  if(e.code.startsWith('Arrow')||e.code==='Space') e.preventDefault();
});
addEventListener('keyup',e=>{ tecla[e.code]=false; });
addEventListener('blur',()=>{ for(const k in tecla) tecla[k]=false; });

cv.addEventListener('pointerdown',e=>{
  document.activeElement?.blur?.();
  try{ cv.setPointerCapture(e.pointerId); }catch(_){}
  if(e.pointerType!=='mouse'&&e.clientX<innerWidth*0.45&&!toque.joy){ toque.joy={id:e.pointerId,x0:e.clientX,y0:e.clientY,x:0,y:0}; desenharJoy(); }
  else dedos[e.pointerId]={x:e.clientX,y:e.clientY};
});
cv.addEventListener('pointermove',e=>{
  const joy=toque.joy;
  if(joy&&e.pointerId===joy.id){ const c=v=>Math.max(-1,Math.min(1,v/55)); joy.x=c(e.clientX-joy.x0); joy.y=c(e.clientY-joy.y0); desenharJoy(); return; }
  const d=dedos[e.pointerId]; if(!d) return;
  cam.yaw-=(e.clientX-d.x)*0.006; cam.pitch=Math.max(0.06,Math.min(1.45,cam.pitch+(e.clientY-d.y)*0.005));
  d.x=e.clientX; d.y=e.clientY;
});
const soltar=e=>{ if(toque.joy&&e.pointerId===toque.joy.id){ toque.joy=null; desenharJoy(); } delete dedos[e.pointerId]; };
// joystick visível (celular): descansa no canto de baixo à esquerda; vai para onde o polegar encosta
if(matchMedia('(pointer:coarse)').matches) document.body.classList.add('toque');
function desenharJoy(){
  const el=$('joy'); if(!el) return; const j=toque.joy, bola=el.firstElementChild;
  if(!j){ el.classList.add('parado'); el.style.left=el.style.top=''; bola.style.transform=''; return; }
  const m=Math.hypot(j.x,j.y)||1, k=Math.min(1,m)/m;                    // bolinha dentro do círculo
  el.classList.remove('parado'); el.style.left=j.x0+'px'; el.style.top=j.y0+'px';
  bola.style.transform=`translate(${j.x*k*36}px,${j.y*k*36}px)`;
}
cv.addEventListener('pointerup',soltar); cv.addEventListener('pointercancel',soltar);
cv.addEventListener('wheel',e=>{ e.preventDefault(); cam.dist=Math.max(2.5,Math.min(80,cam.dist*(e.deltaY>0?1.12:0.89))); },{passive:false});

$('tp').addEventListener('keydown',e=>{
  if(e.key!=='Enter') return;
  const m=e.target.value.match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
  if(m){ const [x,z]=toXZ(parseFloat(m[1].replace(',','.')),parseFloat(m[2].replace(',','.'))); jogador.position.set(x,0,z); e.target.value=''; e.target.blur(); }
});
$('usar').addEventListener('click',e=>{ pedido.usar=true; e.currentTarget.blur(); });
$('casaBtn').addEventListener('click',e=>{ pedido.casa=true; e.currentTarget.blur(); });
$('fotoBtn').addEventListener('click',e=>{ pedido.foto=true; e.currentTarget.blur(); });
$('trabBtn').addEventListener('click',e=>{ pedido.trabalho=true; e.currentTarget.blur(); });
$('casaCtx').addEventListener('click',e=>{ pedido[e.currentTarget.dataset.acao||'usar']=true; e.currentTarget.blur(); });
// atalho rápido (☰ / Q): os botões do painel ficam escondidos até pedir; ao escolher um, fecha
export function alternarAtalhos(abrir){ const t=$('top'); const vai=abrir??t.classList.contains('fechado'); t.classList.toggle('fechado',!vai); $('atalhoBtn').setAttribute('aria-expanded',vai); }
$('mapaBtn').addEventListener('click',e=>{ alternarMapa(); e.currentTarget.blur(); });
$('atalhoBtn').addEventListener('click',e=>{ alternarAtalhos(); e.currentTarget.blur(); });
for(const b of document.querySelectorAll('#btns button')) b.addEventListener('click',()=>alternarAtalhos(false));
$('entBtn').addEventListener('click',e=>{ pedido.entrega=true; e.currentTarget.blur(); });
$('ajudaBtn').addEventListener('click',e=>{ const fora=document.body.classList.toggle('sem-ajuda'); try{ localStorage.setItem('matelandia3d.ajuda',fora?'0':'1'); }catch(_){} e.currentTarget.blur(); });
try{ if(localStorage.getItem('matelandia3d.ajuda')!=='1') document.body.classList.add('sem-ajuda'); }catch(_){ document.body.classList.add('sem-ajuda'); }
$('terrBtn').addEventListener('click',e=>{ pedido[e.currentTarget.dataset.acao||'comprar']=true; e.currentTarget.blur(); });
$('negBtn').addEventListener('click',e=>{ pedido.negocio=true; e.currentTarget.blur(); });
for(const b of document.querySelectorAll('#acoes button')) b.addEventListener('click',e=>{ pedido.acao=b.dataset.acao; e.currentTarget.blur(); });
for(const b of document.querySelectorAll('#luta button')) b.addEventListener('click',e=>{ if(b.dataset.pulo) pedido.pulo=true; else pedido.golpe=b.dataset.golpe; e.currentTarget.blur(); });
