// Modo foto: P (ou 📷) copia a tela do jogo logo depois de desenhar (o painel e os botões são HTML,
// então não saem na foto), põe a marca "Matelândia 3D · rua · hora" e mostra para salvar ou compartilhar.
import { $ } from './cena.js';

let pedido=null;
export const pedirFoto = legenda=>{ pedido=legenda; };
let blobAtual=null, urlAtual=null;

// chamado no fim do quadro, logo depois do render (o buffer do WebGL ainda está lá)
export function talvezFotografar(canvas){
  if(pedido===null) return false;
  const legenda=pedido; pedido=null;
  const W=canvas.width, H=canvas.height, c=document.createElement('canvas'); c.width=W; c.height=H; const k=c.getContext('2d');
  k.drawImage(canvas,0,0);
  // marca: faixa escura embaixo, à direita
  const s=Math.max(1,H/720), pad=18*s;
  k.font=`900 ${30*s}px system-ui,sans-serif`; const t1='Matelândia 3D';
  k.font=`600 ${17*s}px system-ui,sans-serif`; const w2=k.measureText(legenda).width;
  k.font=`900 ${30*s}px system-ui,sans-serif`; const w1=k.measureText(t1).width;
  const bw=Math.max(w1,w2)+pad*2, bh=72*s, x=W-bw-pad, y=H-bh-pad;
  k.fillStyle='rgba(12,14,18,.62)'; k.beginPath(); k.roundRect(x,y,bw,bh,12*s); k.fill();
  k.fillStyle='#F97316'; k.fillRect(x,y+10*s,4*s,bh-20*s);
  k.textAlign='right'; k.textBaseline='alphabetic';
  k.fillStyle='#fff'; k.fillText(t1,x+bw-pad,y+36*s);
  k.font=`600 ${17*s}px system-ui,sans-serif`; k.fillStyle='#fcd34d'; k.fillText(legenda,x+bw-pad,y+60*s);
  // flash
  const f=$('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  c.toBlob(b=>{ if(!b) return; blobAtual=b; if(urlAtual) URL.revokeObjectURL(urlAtual); urlAtual=URL.createObjectURL(b);
    $('fotoImg').src=urlAtual; $('foto').classList.add('on');
    $('fotoShare').style.display=navigator.canShare&&navigator.canShare({files:[new File([b],'x.png',{type:'image/png'})]})?'':'none'; }, 'image/png');
  return true;
}
const nomeArq=()=>'matelandia3d-'+new Date().toISOString().slice(0,19).replace(/[-:T]/g,'')+'.png';
$('fotoSalvar').addEventListener('click',()=>{ if(!urlAtual) return; const a=document.createElement('a'); a.href=urlAtual; a.download=nomeArq(); a.click(); });
$('fotoShare').addEventListener('click',async()=>{ if(!blobAtual) return; try{ await navigator.share({files:[new File([blobAtual],nomeArq(),{type:'image/png'})], title:'Matelândia 3D'}); }catch(e){} });
$('fotoFechar').addEventListener('click',()=>$('foto').classList.remove('on'));
