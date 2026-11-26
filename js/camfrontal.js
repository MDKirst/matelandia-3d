// Câmera frontal e "sensação de moto" do Couro & Asfalto (25/11, pedido do Maicon).
//  · R (ou botão 🎥) alterna: câmera atrás ↔ frontal (olhos do piloto na moto e a pé; para-choque no carro)
//  · na moto a câmera inclina junto na curva e treme de leve com a velocidade (como no Couro & Asfalto)
// main.js chama cameraFrontal(dt) logo depois de posicionar a câmera de sempre.
import { camera, $ } from './cena.js';
import { altura } from './relevo.js';
import { cam } from './controles.js';
import { jogador } from './avatar.js';
import * as veic from './veiculos.js';

let frontal=false, t=0;
const digitando=()=>{ const a=document.activeElement; return a&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.isContentEditable); };
export function alternarCamera(){
  frontal=!frontal;
  if(!frontal){ const D=veic.dirigindo; jogador.visible=!D||!!D.tipo.moto; }
  const a=$('aviso'); if(a){ a.textContent=frontal?'🎥 Câmera frontal (R volta)':'🎥 Câmera atrás'; a.style.opacity=1; setTimeout(()=>a.style.opacity=0,1800); }
}
addEventListener('keydown',e=>{ if(e.code==='KeyR'&&!e.repeat&&!digitando()) alternarCamera(); });
// botão no celular, junto dos outros botões do canto
{ const b=document.createElement('button'); b.id='camBtn'; b.textContent='🎥'; b.title='Câmera frontal (R)';
  b.style.cssText='position:fixed;right:12px;top:50%;z-index:6;width:44px;height:44px;border-radius:50%;border:1px solid #475569;background:rgba(15,23,42,.75);color:#fff;font-size:20px;display:none';
  b.onclick=e=>{ alternarCamera(); e.currentTarget.blur(); }; document.body.append(b);
  if(matchMedia('(pointer:coarse)').matches) b.style.display='block'; }

export function cameraFrontal(dt){
  t+=dt;
  const D=veic.dirigindo, moto=D&&D.tipo.moto;
  if(!frontal){
    // câmera atrás: na moto inclina um pouco junto na curva e treme com a velocidade
    if(moto){ const k=Math.min(1,Math.abs(D.v)/30); camera.rotateZ((D.obj.rotation.z||0)*0.25); camera.position.y+=Math.sin(t*47)*0.012*k; }
    return;
  }
  jogador.visible=false;                                             // não enxerga a própria cabeça
  let x,z,y,fx,fz;
  if(D){
    fx=-Math.sin(D.h); fz=-Math.cos(D.h); const p=D.obj.position;
    if(moto){ x=p.x+fx*0.15; z=p.z+fz*0.15; y=1.55; }                 // olhos do piloto
    else { const f=(D.comp||4)/2+0.25; x=p.x+fx*f; z=p.z+fz*f; y=(D.comp||4)>7?2.4:1.05; }   // para-choque (ônibus: mais alto)
  } else {
    fx=-Math.sin(cam.yaw); fz=-Math.cos(cam.yaw); const p=jogador.position;
    x=p.x+fx*0.25; z=p.z+fz*0.25; y=1.62;
  }
  const h=altura(x,z);
  camera.position.set(x,h+y+(D?D.y||0:0),z);
  const olha=D?-0.04:-(cam.pitch-0.42)*0.8;                          // a pé o mouse sobe/desce o olhar
  camera.lookAt(x+fx*10, h+y+olha*10, z+fz*10);
  if(moto){ const k=Math.min(1,Math.abs(D.v)/30); camera.rotateZ((D.obj.rotation.z||0)*0.8); camera.position.y+=Math.sin(t*47)*0.02*k; }
}
export const cameraEhFrontal=()=>frontal;
