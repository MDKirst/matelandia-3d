// Teclado, mouse/toque e o campo "Ir para"
import { cv, $ } from './cena.js';
import { toXZ } from './geo.js';
import { av, jogador } from './avatar.js';
import { satelite } from './satelite.js';
import { status } from './cidade.js';

export const tecla={};
export const cam={ yaw:0.6, pitch:0.42, dist:9 };  // câmera orbital atrás do avatar
export const toque={ joy:null };                    // joystick virtual (lado esquerdo da tela no celular)
const dedos={};
const digitando=()=>document.activeElement&&document.activeElement.tagName==='INPUT';

addEventListener('keydown',e=>{
  if(digitando()) return;
  tecla[e.code]=true;
  if(e.code==='KeyR') av.giroExtra+=Math.PI/2;
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
  if(e.pointerType!=='mouse'&&e.clientX<innerWidth*0.45&&!toque.joy) toque.joy={id:e.pointerId,x0:e.clientX,y0:e.clientY,x:0,y:0};
  else dedos[e.pointerId]={x:e.clientX,y:e.clientY};
});
cv.addEventListener('pointermove',e=>{
  const joy=toque.joy;
  if(joy&&e.pointerId===joy.id){ const c=v=>Math.max(-1,Math.min(1,v/55)); joy.x=c(e.clientX-joy.x0); joy.y=c(e.clientY-joy.y0); return; }
  const d=dedos[e.pointerId]; if(!d) return;
  cam.yaw-=(e.clientX-d.x)*0.006; cam.pitch=Math.max(0.06,Math.min(1.45,cam.pitch+(e.clientY-d.y)*0.005));
  d.x=e.clientX; d.y=e.clientY;
});
const soltar=e=>{ if(toque.joy&&e.pointerId===toque.joy.id) toque.joy=null; delete dedos[e.pointerId]; };
cv.addEventListener('pointerup',soltar); cv.addEventListener('pointercancel',soltar);
cv.addEventListener('wheel',e=>{ e.preventDefault(); cam.dist=Math.max(2.5,Math.min(80,cam.dist*(e.deltaY>0?1.12:0.89))); },{passive:false});

$('tp').addEventListener('keydown',e=>{
  if(e.key!=='Enter') return;
  const m=e.target.value.match(/(-?\d+(?:[.,]\d+)?)\s*[,; ]\s*(-?\d+(?:[.,]\d+)?)/);
  if(m){ const [x,z]=toXZ(parseFloat(m[1].replace(',','.')),parseFloat(m[2].replace(',','.'))); jogador.position.set(x,0,z); e.target.value=''; e.target.blur(); }
});
