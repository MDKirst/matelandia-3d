// Academia, força e carisma (25/11, pedido do Maicon: "coloque academia no jogo", whey/creatina deixam
// mais forte, "modo conquista"). Versão para alunos: carisma (elogios e desconto), sem namoro.
//  · Academia ao ar livre no Parque Farroupilha (aberta a todos, sem Firebase): E abre o balcão
//  · treino: +força (+carisma); whey dobra o ganho por 10 min; creatina: golpe +15% por 10 min
//  · força: soco/chute tiram mais energia de pedestre e gangue (jogador x jogador fica igual: trava anti-trapaça)
//  · carisma: banho/perfume, corte, roupa e treino sobem; moradores elogiam, lojas dão até 10% de desconto
// Tudo salvo no navegador. Força e carisma caem devagar sem treino.
import * as THREE from 'three';
import { scene, $ } from './cena.js';
import { vida } from './luta.js';
import { ganhar as conquistar } from './conquistas.js';

const CHAVE='matelandia3d.corpo', DESCANSO_TREINO=45e3;
const c=(()=>{ try{ const d=JSON.parse(localStorage.getItem(CHAVE)); if(d&&typeof d.forca==='number') return d; }catch(e){} return { forca:0, carisma:0, whey:0, creatina:0, ultTreino:0, t:Date.now() }; })();
const salvar=()=>{ try{ localStorage.setItem(CHAVE,JSON.stringify(c)); }catch(e){} };
const ativo=k=>c[k]>Date.now();

// desgaste: sem treino, −1 de força a cada 15 min e −1 de carisma a cada 10 min (contando o tempo fora do jogo também)
function desgastar(){ const agora=Date.now(), min=(agora-c.t)/60e3; if(min<1) return;
  const f=Math.floor(min/15), k=Math.floor(min/10); if(f||k){ c.forca=Math.max(0,c.forca-f); c.carisma=Math.max(0,c.carisma-k); c.t=agora; salvar(); hud(); } }

export const forca=()=>c.forca, carisma=()=>c.carisma;
// multiplicador de dano em pedestre/gangue: força 100 = +60%; creatina +15%
export const multGolpe=()=>(1+c.forca/100*0.6)*(ativo('creatina')?1.15:1);
// desconto pelo carisma: até 10%
export const descontoCarisma=()=>1-Math.min(0.1,c.carisma/1000);
// elogio quando o carisma está alto (pedestres.js ao cumprimentar, conversa.js ao abrir papo)
const ELOGIOS=['Tá em forma, hein!','Que estilo!','Andou treinando? Tá forte!','Gostei do visual!','Você tá com uma energia boa hoje!','Tá chique, hein!'];
export function elogio(){ if(c.carisma<20||Math.random()>c.carisma/130) return null; return ELOGIOS[(Math.random()*ELOGIOS.length)|0]; }

function hud(){
  let el=$('corpo'); if(!el){ const e=$('energia'); if(!e) return; el=document.createElement('div'); el.id='corpo'; el.style.cssText='font:600 13px system-ui,sans-serif;color:#e2e8f0;margin-top:4px'; e.after(el); }
  el.textContent=`💪 Força ${Math.round(c.forca)} · ✨ Carisma ${Math.round(c.carisma)}`+(ativo('whey')?' · 🥤':'')+(ativo('creatina')?' · ⚡':'');
}

// efeitos dos produtos (negocios.js chama ANTES de cobrar): devolve texto de erro (não cobra) ou ''
//   treino:1 · whey:s · creatina:s · carisma:N
export function efeitoCorpo(ef){
  if(ef.treino){
    if(Date.now()-c.ultTreino<DESCANSO_TREINO) return '💪 O músculo precisa descansar: treine de novo em alguns segundos';
    if(vida.e<20) return 'Energia baixa demais para treinar: coma algo antes';
    const ganho=(ativo('whey')?6:3)*(c.forca<50?1:0.6);
    c.forca=Math.min(100,c.forca+ganho); c.carisma=Math.min(100,c.carisma+1); c.ultTreino=Date.now(); vida.e=Math.max(5,vida.e-12);
    if(c.forca>=50) conquistar('marombeiro');
  }
  if(ef.whey) c.whey=Math.max(c.whey,Date.now())+ef.whey*1000;
  if(ef.creatina) c.creatina=Math.max(c.creatina,Date.now())+ef.creatina*1000;
  if(ef.carisma){ c.carisma=Math.min(100,c.carisma+ef.carisma); if(c.carisma>=50) conquistar('carismatico'); }
  if(ef.treino||ef.whey||ef.creatina||ef.carisma){ c.t=Date.now(); salvar(); hud(); }
  return '';
}
export const descreveCorpo=ef=>[ef.treino?`+força${ativo('whey')?' (dobrada pelo whey)':''}`:'', ef.whey?'treino rende o dobro por 10 min':'', ef.creatina?'golpes 15% mais fortes por 10 min':'', ef.carisma?`+${ef.carisma} carisma`:''].filter(Boolean).join(' · ');
// barbearia, roupas e o "banho e perfume" também dão carisma (usado pelos PRODUTOS)

/* ───────── academia ao ar livre no Parque Farroupilha ───────── */
// canto sudeste da quadra do parque (x -641..-531, z -134..-25), perto da calçada da Av. Duque de Caxias
export const ACADEMIA={ x:-548, z:-42, raio:9, nome:'Academia ao ar livre · Parque Farroupilha' };
export function academiaAqui(x,z){ return Math.hypot(x-ACADEMIA.x,z-ACADEMIA.z)<ACADEMIA.raio; }
function montar(){
  const g=new THREE.Group(); g.position.set(ACADEMIA.x,0,ACADEMIA.z);
  const M=k=>new THREE.MeshLambertMaterial({color:k}), amarelo=M(0xfacc15), azul=M(0x1d4ed8), cinza=M(0x6b7280), piso=M(0xb45309);
  const cx=(w,h,d,m,x,y,z)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(x,y,z); g.add(o); return o; };
  const tubo=(x0,y0,z0,x1,y1,z1,m=amarelo,r=0.06)=>{ const a=new THREE.Vector3(x0,y0,z0), b=new THREE.Vector3(x1,y1,z1), L=a.distanceTo(b);
    const o=new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,8),m); o.position.copy(a).add(b).multiplyScalar(0.5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.sub(a).normalize()); g.add(o); };
  cx(12,0.06,8,piso,0,0.03,0);                                                   // piso emborrachado
  // barra fixa
  tubo(-4.5,0,-2,-4.5,2.3,-2); tubo(-2.5,0,-2,-2.5,2.3,-2); tubo(-4.5,2.3,-2,-2.5,2.3,-2,cinza,0.04);
  // supino: banco + suporte + barra com anilhas
  cx(0.4,0.45,1.6,azul,0,0.4,-2); tubo(-0.5,0,-2.7,-0.5,1.1,-2.7); tubo(0.5,0,-2.7,0.5,1.1,-2.7); tubo(-1,1.1,-2.7,1,1.1,-2.7,cinza,0.03);
  for(const s of [-1,1]){ const an=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.06,16),M(0x111827)); an.rotation.z=Math.PI/2; an.position.set(s*0.85,1.1,-2.7); g.add(an); }
  // remada / leg press estilizados
  tubo(3,0,-2,3,1.4,-2.8); tubo(3,1.4,-2.8,4,1.4,-2.8); cx(0.5,0.4,0.5,azul,3.6,0.45,-1.6);
  // halteres no rack
  cx(2.4,0.7,0.5,cinza,0,0.35,2.4); for(let i=0;i<6;i++){ tubo(-0.9+i*0.36,0.78,2.25,-0.9+i*0.36,0.78,2.55,M(0x111827),0.07); }
  // placa
  const cv=document.createElement('canvas'); cv.width=512; cv.height=128; const k=cv.getContext('2d');
  k.fillStyle='#1d4ed8'; k.fillRect(0,0,512,128); k.fillStyle='#facc15'; k.font='bold 44px system-ui'; k.textAlign='center'; k.fillText('🏋️ ACADEMIA',256,58); k.fillStyle='#fff'; k.font='bold 30px system-ui'; k.fillText('ao ar livre · E treinar',256,104);
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const placa=new THREE.Mesh(new THREE.PlaneGeometry(3,0.75),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide})); placa.position.set(5,2.2,3); g.add(placa);
  tubo(4,0,3,4,2.2,3,cinza,0.05); tubo(6,0,3,6,2.2,3,cinza,0.05);
  scene.add(g);
}
let montado=false;
export function iniciarAcademia(){ if(montado) return; montado=true; montar(); desgastar(); hud(); setInterval(()=>{ desgastar(); hud(); },60e3); }
export const _testeCorpo={ c, salvar, hud };
