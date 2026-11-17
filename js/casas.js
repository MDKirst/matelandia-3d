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
export function acharPorta(p){
  let melhor=null, nota=1e9;
  for(let i=0;i<p.pts.length;i++){ const a=p.pts[i], b=p.pts[(i+1)%p.pts.length], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<2.5) continue;
    const m=[(a[0]+b[0])/2,(a[1]+b[1])/2]; let n=[(b[1]-a[1])/L,-(b[0]-a[0])/L]; if(dentroP(m[0]+n[0]*0.5,m[1]+n[1]*0.5,p.pts)) n=[-n[0],-n[1]];
    const q=[m[0]+n[0]*1.2,m[1]+n[1]*1.2], d=distRua(q[0],q[1])-L*0.05;   // mais perto da rua (parede comprida desempata)
    if(d<nota){ nota=d; melhor=q; } }
  return melhor;
}
export function iniciarCasas(){
  for(const p of predios){ if(p.osm||p.galpao||p.marco) continue; const A=area(p.pts); if(A<35||A>350) continue;
    const cx=(p.bb[0]+p.bb[2])/2, cz=(p.bb[1]+p.bb[3])/2, b0=p.bb0||p.bb, id=Math.round((b0[0]+b0[2])/2)+'_'+Math.round((b0[1]+b0[3])/2); if(porId.has(id)) continue;   // id pela posição original (a casa recuada da calçada não muda de código)
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
  const meia=lamb(0xe7dcc8); movel(meia,1,2.0,0,H*0.55,-0.05,0.05); movel(meia,3.2,W/2,0,H*0.55,-0.05,0.05); movel(meia,1,1.1,0,H*0.55,-D/2,0);
  // cozinha (canto noroeste): bancada, pia, fogão, geladeira; mesa com 4 cadeiras
  movel(lamb(0xf5f5f4),-W/2,-1.6,0,0.9,-D/2,-D/2+0.65); caixa(lamb(0x57534e),-W/2,-1.6,0.9,0.95,-D/2,-D/2+0.65);
  caixa(lamb(0x9ca3af),-3.3,-2.7,0.95,0.97,-D/2+0.1,-D/2+0.55); caixa(lamb(0x111827),-2.2,-1.7,0.95,0.97,-D/2+0.1,-D/2+0.55);
  movel(lamb(0xe5e7eb),-W/2,-W/2+0.75,0,1.8,-D/2+0.8,-D/2+1.5);
  movel(lamb(0x92400e),-3.6,-2.0,0.72,0.78,-1.4,-0.4); caixa(lamb(0x78350f),-2.85,-2.75,0,0.72,-0.95,-0.85);
  for(const [x,z] of [[-3.9,-0.9],[-1.7,-0.9],[-2.8,-1.75],[-2.8,-0.05]]) caixa(lamb(0x7c2d12),x-0.22,x+0.22,0,0.45,z-0.22,z+0.22);
  // sala (canto sudeste): sofá virado para a TV, tapete, mesinha
  movel(lamb(0x1e3a8a),2.7,4.8,0,0.45,3.1,3.9); movel(lamb(0x1e40af),2.7,4.8,0.45,0.95,3.65,3.9,false);
  caixa(new THREE.MeshLambertMaterial({color:0xb45309}),2.6,4.9,0.005,0.015,0.8,2.8);
  movel(lamb(0x78350f),3.3,4.3,0,0.4,1.7,2.3);
  movel(lamb(0x292524),3.5,4.9,0,0.5,0.25,0.6);
  const tv=new THREE.Mesh(new THREE.PlaneGeometry(1.3,0.75),new THREE.MeshBasicMaterial({map:texTV()})); tv.position.set(4.2,1.05,0.62); sala.add(tv);
  caixa(lamb(0x111827),3.5,4.9,0.62,1.48,0.5,0.6);
  // quarto (canto nordeste): cama de casal, criados-mudos, guarda-roupa, quadro
  movel(lamb(0xf8fafc),2.3,4.4,0,0.55,-D/2+0.3,-D/2+2.4); caixa(lamb(0x7c3aed),2.3,4.4,0.55,0.6,-D/2+1.1,-D/2+2.4); caixa(lamb(0x5b21b6),2.3,4.4,0.3,1.1,-D/2+0.2,-D/2+0.32);
  movel(lamb(0x78350f),1.7,2.2,0,0.55,-D/2+0.3,-D/2+0.8); movel(lamb(0x78350f),4.45,W/2,0,0.55,-D/2+0.3,-D/2+0.8);
  movel(lamb(0x57534e),1.2,1.8,0,2.1,-2.6,-0.6);
  const q=new THREE.Mesh(new THREE.PlaneGeometry(1.2,0.8),lamb(0x0e7490)); q.position.set(3.35,1.8,-D/2+0.02); sala.add(q);
  /* ───── mais móveis (pedido do Maicon em 17/11) ───── */
  const cil=(m,x,z,r,y0,y1,seg=14)=>{ const c=new THREE.Mesh(new THREE.CylinderGeometry(r,r,y1-y0,seg),m); c.position.set(x,(y0+y1)/2,z); sala.add(c); return c; };
  const brilho=c=>new THREE.MeshBasicMaterial({color:c});
  const quadro=(cor,x,y,z,w,h,ry=0)=>{ const fr=new THREE.Mesh(new THREE.PlaneGeometry(w+0.1,h+0.1),lamb(0x3f2a1a)); fr.position.set(x,y,z); fr.rotation.y=ry; sala.add(fr);
    const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),lamb(cor)); p.position.copy(fr.position); p.rotation.y=ry; p.translateZ(0.01); sala.add(p); };
  // banheiro (canto sudoeste), meia-parede com vão virado para o leste
  movel(meia,-W/2,-2.9,0,H*0.55,1.55,1.65); movel(meia,-2.95,-2.85,0,H*0.55,1.55,2.6); movel(meia,-2.95,-2.85,0,H*0.55,3.4,D/2);
  caixa(lamb(0x93c5fd),-W/2,-2.95,0.004,0.012,1.65,D/2);                                              // piso de azulejo
  movel(lamb(0xf8fafc),-4.85,-4.35,0,0.42,3.25,3.75); caixa(lamb(0xf8fafc),-4.95,-4.85,0.3,0.9,3.2,3.8);   // vaso e caixa acoplada
  movel(lamb(0xf1f5f9),-4.0,-3.35,0,0.85,1.65,2.1); cil(lamb(0x94a3b8),-3.67,1.88,0.18,0.85,0.88);        // pia
  { const e=new THREE.Mesh(new THREE.PlaneGeometry(0.6,0.7),new THREE.MeshBasicMaterial({color:0xcfe8f5})); e.position.set(-3.67,1.35,1.67); sala.add(e); }   // espelho
  { const vidro=new THREE.Mesh(new THREE.BoxGeometry(0.04,1.9,0.95),new THREE.MeshLambertMaterial({color:0xbae6fd,transparent:true,opacity:0.35,depthWrite:false})); vidro.position.set(-4.1,0.95,2.15); sala.add(vidro); solidos.push([-W/2,1.65,-4.1,2.65]); }
  caixa(lamb(0xe2e8f0),-W/2,-4.12,0.004,0.06,1.67,2.63); cil(lamb(0x9ca3af),-4.75,2.15,0.12,1.85,1.88);   // box do chuveiro
  caixa(lamb(0x2563eb),-3.9,-3.3,0.004,0.016,3.2,3.7);                                                // tapetinho
  // escritório (entre o banheiro e a cozinha): escrivaninha com computador, cadeira e estante de livros
  movel(lamb(0xd6b88a),-2.6,-1.4,0.72,0.77,0.75,1.35); for(const x of [-2.55,-1.45]) caixa(lamb(0x8b6b45),x-0.03,x+0.03,0,0.72,0.8,1.3);
  caixa(lamb(0x111827),-2.25,-1.75,0.77,1.12,0.84,0.88);                                              // monitor
  { const tela=new THREE.Mesh(new THREE.PlaneGeometry(0.46,0.3),brilho(0x38bdf8)); tela.position.set(-2.0,0.95,0.885); sala.add(tela); }
  caixa(lamb(0x1f2937),-2.2,-1.8,0.77,0.79,1.0,1.15);                                                 // teclado
  movel(lamb(0x1f2937),-2.25,-1.75,0.42,0.48,1.55,2.05); caixa(lamb(0x1f2937),-2.25,-1.75,0.48,1.0,2.0,2.06); cil(lamb(0x6b7280),-2.0,1.8,0.04,0,0.42,8);   // cadeira
  movel(lamb(0x5c3a1e),-W/2,-4.6,0,2.0,-0.3,1.4);                                                     // estante
  for(let k=0;k<4;k++){ caixa(lamb(0x4a2e17),-4.6,-4.58,0.05+k*0.5,0.08+k*0.5,-0.3,1.4);
    for(let i=0;i<9;i++){ const z=-0.25+i*0.18, h=0.28+((i*7+k*3)%5)*0.03; caixa(lamb([0xdc2626,0x2563eb,0x16a34a,0xeab308,0x7c3aed,0xf97316][(i+k)%6]),-4.95,-4.62,0.08+k*0.5,0.08+k*0.5+h,z,z+0.13); } }
  // cozinha: armários altos, micro-ondas, fruteira e filtro
  caixa(lamb(0xd6d3d1),-W/2,-1.6,1.6,2.3,-D/2,-D/2+0.38); for(let x=-4.5;x<-1.6;x+=0.85) caixa(lamb(0x78716c),x,x+0.05,1.9,2.0,-D/2+0.38,-D/2+0.4);
  caixa(lamb(0x27272a),-4.7,-4.15,0.95,1.27,-D/2+0.08,-D/2+0.5); caixa(brilho(0x1e293b),-4.62,-4.3,1.0,1.22,-D/2+0.51,-D/2+0.52);
  cil(lamb(0xa16207),-2.8,-0.9,0.22,0.78,0.85); for(const [dx,dz,c] of [[-0.08,0,0xdc2626],[0.08,0.05,0xf59e0b],[0,-0.08,0x84cc16]]){ const fr=new THREE.Mesh(new THREE.SphereGeometry(0.08,8,6),lamb(c)); fr.position.set(-2.8+dx,0.92,-0.9+dz); sala.add(fr); }
  cil(lamb(0x60a5fa),-1.9,-D/2+0.33,0.12,0.95,1.35);
  // sala: poltrona, abajur de chão, videogame, quadros, relógio
  movel(lamb(0x9a3412),1.5,2.2,0,0.45,1.5,2.3); caixa(lamb(0x7c2d12),1.35,1.55,0.45,1.0,1.5,2.3); caixa(lamb(0x7c2d12),1.35,2.2,0.45,0.65,1.45,1.55); caixa(lamb(0x7c2d12),1.35,2.2,0.45,0.65,2.25,2.35);
  cil(lamb(0x44403c),1.25,3.65,0.18,0,0.04); cil(lamb(0x44403c),1.25,3.65,0.025,0.04,1.5,6); { const ab=new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.26,0.3,14,1,true),new THREE.MeshBasicMaterial({color:0xfde68a,side:THREE.DoubleSide})); ab.position.set(1.25,1.55,3.65); sala.add(ab); solidos.push([1.05,3.45,1.45,3.85]); }
  caixa(lamb(0xf8fafc),3.6,3.95,0.5,0.58,0.32,0.55); caixa(lamb(0x111827),3.7,3.88,0.5,0.53,0.64,0.74); caixa(lamb(0x111827),4.3,4.48,0.5,0.53,0.64,0.74);   // videogame e controles
  quadro(0xf97316,3.75,1.75,D/2-0.02,1.4,0.7,Math.PI); quadro(0x0f766e,W/2-0.02,1.7,2.2,0.8,0.6,-Math.PI/2); quadro(0x7c3aed,-W/2+0.02,1.7,-1.0,0.7,0.9,Math.PI/2);
  { const rel=new THREE.Mesh(new THREE.CircleGeometry(0.22,20),lamb(0xffffff)); rel.position.set(-0.3,2.1,-D/2+0.02); sala.add(rel);
    for(const [w,h,a] of [[0.02,0.14,0.6],[0.02,0.19,2.2]]){ const p=new THREE.Mesh(new THREE.PlaneGeometry(w,h),lamb(0x111827)); p.geometry.translate(0,h/2,0); p.position.set(-0.3,2.1,-D/2+0.03); p.rotation.z=a; sala.add(p); } }
  // quarto: tapete, abajures nos criados-mudos, cômoda com espelho
  caixa(lamb(0xf472b6),2.4,4.3,0.004,0.014,-1.45,-0.55);
  for(const x of [1.95,4.72]){ cil(lamb(0x44403c),x,-D/2+0.55,0.03,0.55,0.8,6); const a=new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.15,0.18,12),brilho(0xfde68a)); a.position.set(x,0.86,-D/2+0.55); sala.add(a); }
  movel(lamb(0x92400e),4.45,4.95,0,0.85,-1.3,-0.3); caixa(lamb(0x78350f),4.44,4.45,0.2,0.75,-1.25,-0.35);
  { const e=new THREE.Mesh(new THREE.PlaneGeometry(0.8,0.9),new THREE.MeshBasicMaterial({color:0xcfe8f5})); e.position.set(W/2-0.02,1.45,-0.8); e.rotation.y=-Math.PI/2; sala.add(e); }
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
