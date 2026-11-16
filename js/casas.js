// Casas prontas à venda (pedido do Maicon, 16/11/2026): qualquer casa da cidade (prédio residencial do
// Overture, 35–350 m², não galpão nem prédio público) pode ser comprada na porta (B). Cada jogador tem
// uma casa (o admin, quantas quiser). Dentro: sala, cozinha e quarto mobiliados, vistos de cima como
// casa de boneca; a cama enche a energia. O dono fica no Firebase (casas/{id}); o interior é igual para todos.
import * as THREE from 'three';
import { scene, $ } from './cena.js';
import { predios, ruas } from './cidade.js';
import { nuvem, conectarNuvem, ouvirCasas, comprarCasaNuvem } from './nuvem.js';
import { salvo, ganhar, fmt, avisarTerreno as avisar, meuNome } from './terrenos.js';

export const casas=[];          // {id, pts, bb, cx, cz, area, preco, porta:[x,z], dono, nome}
const porId=new Map();
const dentroP=(x,z,pts)=>{ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; };
const area=pts=>{ let a=0; for(let i=0,j=pts.length-1;i<pts.length;j=i++) a+=(pts[j][0]+pts[i][0])*(pts[j][1]-pts[i][1]); return Math.abs(a/2); };

// porta: meio da parede virada para a rua mais perto, 1,2 m para fora
// distância do ponto até a rua mais perto (qualquer rua de carro)
function distRua(x,z){ let d=1e9;
  for(const r of ruas){ if(r.pe) continue; const b=r.bb; if(x<b[0]-60||x>b[2]+60||z<b[1]-60||z>b[3]+60) continue;
    for(let k=0;k<r.pts.length-1;k++){ const u=r.pts[k], v=r.pts[k+1], vx=v[0]-u[0], vz=v[1]-u[1]; let t=((x-u[0])*vx+(z-u[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t)); d=Math.min(d,Math.hypot(x-u[0]-vx*t,z-u[1]-vz*t)-r.w/2); } }
  return d; }
function acharPorta(p){
  let melhor=null, nota=1e9;
  for(let i=0;i<p.pts.length;i++){ const a=p.pts[i], b=p.pts[(i+1)%p.pts.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<2.5) continue;
    const m=[(a[0]+b[0])/2,(a[1]+b[1])/2]; let n=[(b[1]-a[1])/L,-(b[0]-a[0])/L]; if(dentroP(m[0]+n[0]*0.5,m[1]+n[1]*0.5,p.pts)) n=[-n[0],-n[1]];
    const q=[m[0]+n[0]*1.2,m[1]+n[1]*1.2], d=distRua(q[0],q[1])-L*0.05;   // mais perto da rua (parede comprida desempata)
    if(d<nota){ nota=d; melhor=q; } }
  return melhor;
}
export function iniciarCasas(){
  for(const p of predios){ if(p.osm||p.galpao||p.marco) continue; const A=area(p.pts); if(A<35||A>350) continue;
    const cx=(p.bb[0]+p.bb[2])/2, cz=(p.bb[1]+p.bb[3])/2, id=Math.round(cx)+'_'+Math.round(cz); if(porId.has(id)) continue;
    const c={ id, pts:p.pts, bb:p.bb, cx, cz, area:A, preco:Math.max(8000,Math.round(A*70/500)*500), porta:null, dono:null, nome:'' };
    casas.push(c); porId.set(id,c); }
  ligar().catch(e=>console.warn('casas',e));
  return casas.length;
}
async function ligar(){ if(!await conectarNuvem()) return;
  ouvirCasas(d=>{ for(const c of casas){ const v=d[c.id]; c.dono=v?.dono||null; c.nome=v?.nome||''; } }); }
const minha=c=>c.dono&&c.dono===nuvem.uid;
export const casasNoMapa=()=>({ minhas:casas.filter(minha).map(c=>c.pts), outras:casas.filter(c=>c.dono&&!minha(c)).map(c=>c.pts) });

// casa cuja porta está perto do ponto (a porta só é calculada quando alguém chega perto)
export function casaPerto(x,z){
  let m=null, md=4;
  for(const c of casas){ const b=c.bb; if(x<b[0]-8||x>b[2]+8||z<b[1]-8||z>b[3]+8) continue;
    c.porta ??= acharPorta(c)||[0,0]; const d=Math.hypot(c.porta[0]-x,c.porta[1]-z); if(d<md){ md=d; m=c; } }
  return m;
}
export function dicaCasa(x,z){
  if(casa.dentro) return perto(casa.cama,1.6)?'E dormir (enche a energia)':perto(casa.porta,1.4)?'E sair de casa':'';
  const c=casaPerto(x,z); if(!c) return '';
  if(minha(c)) return 'E entrar na sua casa';
  if(c.dono) return `Casa de ${c.nome||'outro jogador'}`;
  return `B comprar esta casa (${fmt(c.preco)}) · saldo ${fmt(salvo.saldo)}`;
}
let comprando=false;
export async function comprarCasa(x,z){
  const c=casaPerto(x,z); if(!c) return false;
  if(minha(c)){ avisar('Esta casa já é sua: E para entrar'); return true; }
  if(c.dono){ avisar(`Casa de ${c.nome||'outro jogador'}`); return true; }
  if(!nuvem.ok){ avisar('Sem internet: não dá para comprar casa agora'); return true; }
  if(salvo.saldo<c.preco){ avisar(`Saldo insuficiente (${fmt(salvo.saldo)})`); return true; }
  if(comprando) return true; comprando=true; avisar('Comprando a casa…');
  const r=await comprarCasaNuvem(c.id, meuNome()); comprando=false;
  if(r==='limite'){ avisar('Você já tem uma casa'); return true; }
  if(r!=='ok'){ avisar('Alguém comprou antes de você!'); return true; }
  c.dono=nuvem.uid; c.nome=meuNome(); ganhar(-c.preco); avisar('🏡 Casa comprada! E na porta para entrar');
  dispatchEvent(new Event('matelandia:casa')); return true;
}

/* ───────── interior (casa de boneca, vista de cima) ───────── */
export const cenaCasa=new THREE.Scene();
cenaCasa.background=new THREE.Color(0x0b0d11);
cenaCasa.add(new THREE.HemisphereLight(0xfff4e0,0x3a3228,1.5));
const W=10, D=8, H=2.8;                 // cômodo em metros (x: oeste→leste, z: norte→sul); porta no meio da parede sul
const sala=new THREE.Group(); cenaCasa.add(sala);
for(const [x,z] of [[-2.5,-1.5],[2.5,2],[2.5,-2.2]]){ const l=new THREE.PointLight(0xffe2b8,7,9,1.6); l.position.set(x,2.5,z); sala.add(l); }
const lamb=c=>new THREE.MeshLambertMaterial({color:c});
const caixa=(m,x0,x1,y0,y1,z0,z1)=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m); b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); sala.add(b); return b; };
const solidos=[];                       // [x0,z0,x1,z1] onde não se anda
const movel=(m,x0,x1,y0,y1,z0,z1,bloqueia=true)=>{ if(bloqueia) solidos.push([x0,z0,x1,z1]); return caixa(m,x0,x1,y0,y1,z0,z1); };
function texTaco(){ const cv=document.createElement('canvas'); cv.width=cv.height=128; const k=cv.getContext('2d');
  for(let i=0;i<8;i++){ k.fillStyle=i%2?'#a0703f':'#b07c48'; k.fillRect(0,i*16,128,16); k.fillStyle='rgba(60,35,15,.35)'; k.fillRect(0,i*16,128,1); k.fillRect((i*37)%128,i*16,1,16); }
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(W/2,D/2); t.colorSpace=THREE.SRGBColorSpace; return t; }
function texTV(){ const cv=document.createElement('canvas'); cv.width=160; cv.height=90; const k=cv.getContext('2d'); const g=k.createLinearGradient(0,0,160,90); g.addColorStop(0,'#1e3a8a'); g.addColorStop(1,'#0ea5e9'); k.fillStyle=g; k.fillRect(0,0,160,90);
  k.fillStyle='#22c55e'; k.fillRect(0,62,160,28); k.fillStyle='#fff'; k.beginPath(); k.arc(80,70,5,0,7); k.fill(); k.font='bold 12px system-ui'; k.fillText('FUTEBOL AO VIVO',10,18); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t; }
{
  const piso=new THREE.Mesh(new THREE.PlaneGeometry(W,D).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({map:texTaco()})); sala.add(piso);
  const parede=new THREE.MeshLambertMaterial({color:0xefe6d6});
  // paredes externas (só a face de dentro aparece: de fora a câmera enxerga o interior)
  const muro=(m,x0,x1,z0,z1)=>{ const b=caixa(m,x0,x1,0,H,z0,z1); return b; };
  muro(parede,-W/2,W/2,-D/2-0.1,-D/2); muro(parede,-W/2-0.1,-W/2,-D/2,D/2); muro(parede,W/2,W/2+0.1,-D/2,D/2);
  muro(parede,-W/2,-0.7,D/2,D/2+0.1); muro(parede,0.7,W/2,D/2,D/2+0.1);
  solidos.push([-W/2-1,-D/2-1,W/2+1,-D/2],[-W/2-1,-D/2,-W/2,D/2],[W/2,-D/2,W/2+1,D/2],[-W/2,D/2,-0.7,D/2+1],[0.7,D/2,W/2,D/2+1]);
  // parede do quarto (com vão de porta)
  const meia=lamb(0xe7dcc8); movel(meia,1,2.2,0,H*0.55,-0.05,0.05); movel(meia,3.2,W/2,0,H*0.55,-0.05,0.05); movel(meia,1,1.1,0,H*0.55,-D/2,0);
  // cozinha (canto noroeste): bancada, pia, fogão, geladeira; mesa com 4 cadeiras
  movel(lamb(0xf5f5f4),-W/2,-1.6,0,0.9,-D/2,-D/2+0.65); caixa(lamb(0x57534e),-W/2,-1.6,0.9,0.95,-D/2,-D/2+0.65);
  caixa(lamb(0x9ca3af),-3.3,-2.7,0.95,0.97,-D/2+0.1,-D/2+0.55); caixa(lamb(0x111827),-2.2,-1.7,0.95,0.97,-D/2+0.1,-D/2+0.55);
  movel(lamb(0xe5e7eb),-W/2,-W/2+0.75,0,1.8,-D/2+0.8,-D/2+1.5);
  movel(lamb(0x92400e),-3.6,-2.0,0.72,0.78,-1.4,-0.4); caixa(lamb(0x78350f),-2.85,-2.75,0,0.72,-0.95,-0.85);
  for(const [x,z] of [[-3.9,-0.9],[-1.7,-0.9],[-2.8,-1.75],[-2.8,-0.05]]) caixa(lamb(0x7c2d12),x-0.22,x+0.22,0,0.45,z-0.22,z+0.22);
  // sala (canto sudeste): sofá virado para a TV, tapete, mesinha
  movel(lamb(0x1e3a8a),1.6,4.4,0,0.45,3.1,3.9); movel(lamb(0x1e40af),1.6,4.4,0.45,0.95,3.65,3.9,false);
  caixa(new THREE.MeshLambertMaterial({color:0xb45309}),1.4,4.6,0.005,0.015,0.8,2.8);
  movel(lamb(0x78350f),2.4,3.6,0,0.4,1.6,2.2);
  movel(lamb(0x292524),2.0,4.0,0,0.5,0.25,0.6);
  const tv=new THREE.Mesh(new THREE.PlaneGeometry(1.6,0.9),new THREE.MeshBasicMaterial({map:texTV()})); tv.position.set(3,1.1,0.62); sala.add(tv);
  caixa(lamb(0x111827),2.15,3.85,0.62,1.58,0.5,0.6);
  // quarto (canto nordeste): cama de casal, criados-mudos, guarda-roupa, quadro
  movel(lamb(0xf8fafc),2.3,4.4,0,0.55,-D/2+0.3,-D/2+2.4); caixa(lamb(0x7c3aed),2.3,4.4,0.55,0.6,-D/2+1.1,-D/2+2.4); caixa(lamb(0x5b21b6),2.3,4.4,0.3,1.1,-D/2+0.2,-D/2+0.32);
  movel(lamb(0x78350f),1.7,2.2,0,0.55,-D/2+0.3,-D/2+0.8); movel(lamb(0x78350f),4.45,W/2,0,0.55,-D/2+0.3,-D/2+0.8);
  movel(lamb(0x57534e),1.2,1.8,0,2.1,-2.6,-0.6);
  const q=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.8),lamb(0x0e7490)); q.position.set(3.35,1.8,-D/2+0.02); sala.add(q);
  // planta na entrada
  caixa(lamb(0x7c2d12),-1.6,-1.2,0,0.4,3.3,3.7); const f=new THREE.Mesh(new THREE.IcosahedronGeometry(0.45,0),lamb(0x16a34a)); f.position.set(-1.4,0.85,3.5); sala.add(f);
}
export const casa={ dentro:null, porta:[0,D/2-0.6], cama:[3.35,-D/2+2.8] };
const perto=(alvo,r)=>{ const p=casa.pos; return p&&Math.hypot(p.x-casa.dentro.cx-alvo[0],p.z-casa.dentro.cz-alvo[1])<r; };
// pode andar aqui? (coordenadas do mundo, com a casa no centro)
export function bloqueioCasa(x,z){
  const c=casa.dentro; if(!c) return false; const lx=x-c.cx, lz=z-c.cz;
  if(Math.abs(lx)>W/2-0.25||Math.abs(lz)>D/2-0.25) return true;
  return solidos.some(([x0,z0,x1,z1])=>lx>x0-0.25&&lx<x1+0.25&&lz>z0-0.25&&lz<z1+0.25);
}
// entra: o boneco vai para a cena da casa, montada no lugar da casa (o relevo sobe tudo igual)
export function entrarCasa(jogador,x,z){
  const c=casaPerto(x,z); if(!c||!minha(c)) return false;
  casa.dentro=c; casa.pos=jogador.position; sala.position.set(c.cx,0,c.cz);
  scene.remove(jogador); cenaCasa.add(jogador); jogador.position.set(c.cx+casa.porta[0],0,c.cz+casa.porta[1]);
  avisar('🏡 Em casa · cama: E para dormir · porta: E para sair'); return true;
}
export function sairCasa(jogador){
  const c=casa.dentro; if(!c) return false; casa.dentro=null;
  cenaCasa.remove(jogador); scene.add(jogador); jogador.position.set(c.porta[0],0,c.porta[1]); return true;
}
// E dentro de casa: porta sai, cama dorme. Devolve o que fez
export function usarEmCasa(jogador){
  if(!casa.dentro) return null;
  if(perto(casa.porta,1.4)){ sairCasa(jogador); return 'saiu'; }
  if(perto(casa.cama,1.6)){ const f=$('flash'); f.style.background='#000'; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
    setTimeout(()=>{ f.style.background=''; },600); avisar('😴 Você descansou: energia cheia'); return 'dormiu'; }
  return 'nada';
}
