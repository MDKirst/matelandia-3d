// Terrenos à venda e construção com blocos. Dono e blocos ficam no Firebase (todos veem; ver nuvem.js);
// sem internet, cai para o modo antigo (só no navegador). O saldo M$ é sempre do navegador.
//  - Lotes: espaços vazios de verdade atrás das calçadas (sem prédio, sem muro, fora das praças),
//    12 × 24 m, de frente para a rua; estacas nos cantos e placa VENDE-SE com o preço.
//  - B compra (se tiver saldo M$); C entra/sai do modo construção dentro do SEU terreno;
//    1–8 escolhem o bloco; clique esquerdo coloca, direito tira (no celular: botão Colocar/Tirar).
//  - Blocos de 1 m em grade alinhada com o lote; texturas desenhadas aqui (nada de outro jogo).
import * as THREE from 'three';
import { scene, camera, cv, flat, $ } from './cena.js';
import { ruas, predios } from './cidade.js';
import { bloqueado, definirBloqueioExtra } from './mundo.js';
import { substituidoPorMarco } from './marcos.js';
import { comerciosRemovidos } from './predios.js';
import { LX0, LZ0, LX1, LZ1 } from './geo.js';
import { nuvem, conectarNuvem, aoTrocarConta, ouvirLotes, ouvirBlocos, tomarLote, LIMITE_TERRENOS, porBloco, tirarBloco, subirBlocos } from './nuvem.js';

const W=12, D=24, ALT=20;                          // largura (frente), fundo, altura máxima em blocos
const COM_CALCADA=new Set(['primary','secondary','tertiary','residential','unclassified','living_street']);
const CALCADA=2.6, GUIA=0.3;
const CHAVE='matelandia3d.mundo';
const SALDO_INICIAL=5000;      // só para quem começa agora (quem já joga mantém o saldo): terreno + negócio pedem trabalho

/* ───────── blocos ───────── */
function tex(pinta){ const cv=document.createElement('canvas'); cv.width=cv.height=64; const k=cv.getContext('2d'); pinta(k); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.magFilter=THREE.NearestFilter; t.minFilter=THREE.NearestMipmapLinearFilter; return t; }
const ruido=(k,c,n=300,a=.12)=>{ for(let i=0;i<n;i++){ k.fillStyle=`rgba(${c},${Math.random()*a})`; k.fillRect(Math.random()*64|0,Math.random()*64|0,2,2); } };
export const BLOCOS=[
  { nome:'Tijolo',   t:tex(k=>{ k.fillStyle='#a8513a'; k.fillRect(0,0,64,64); k.fillStyle='#d8cfc0'; for(let y=0;y<64;y+=16){ k.fillRect(0,y,64,2); const o=(y/16)%2?16:0; for(let x=o;x<64;x+=32) k.fillRect(x,y,2,16); } ruido(k,'0,0,0'); }) },
  { nome:'Reboco',   t:tex(k=>{ k.fillStyle='#ece5d6'; k.fillRect(0,0,64,64); ruido(k,'120,110,90',500,.1); }) },
  { nome:'Madeira',  t:tex(k=>{ k.fillStyle='#9a6a3e'; k.fillRect(0,0,64,64); k.fillStyle='rgba(60,35,15,.5)'; for(let x=0;x<64;x+=16) k.fillRect(x,0,2,64); for(let i=0;i<30;i++){ k.fillStyle='rgba(60,35,15,.25)'; k.fillRect(Math.random()*64|0,Math.random()*64|0,1,8); } }) },
  { nome:'Telha',    t:tex(k=>{ k.fillStyle='#b5582f'; k.fillRect(0,0,64,64); for(let y=0;y<64;y+=12){ k.fillStyle='rgba(80,25,10,.45)'; k.fillRect(0,y+9,64,3); for(let x=(y/12)%2?8:0;x<64;x+=16){ k.fillStyle='rgba(255,200,160,.18)'; k.fillRect(x,y,8,9); } } }) },
  { nome:'Vidro',    t:tex(k=>{ k.fillStyle='rgba(150,200,230,.45)'; k.fillRect(0,0,64,64); k.fillStyle='#e8eef2'; k.fillRect(0,0,64,3); k.fillRect(0,61,64,3); k.fillRect(0,0,3,64); k.fillRect(61,0,3,64); k.fillStyle='rgba(255,255,255,.5)'; k.fillRect(10,10,6,24); }), vidro:true },
  { nome:'Concreto', t:tex(k=>{ k.fillStyle='#9ea2a4'; k.fillRect(0,0,64,64); ruido(k,'40,40,40',600,.12); k.fillStyle='rgba(60,60,60,.35)'; k.fillRect(0,31,64,2); }) },
  { nome:'Pedra',    t:tex(k=>{ k.fillStyle='#7d7a74'; k.fillRect(0,0,64,64); for(let i=0;i<14;i++){ k.fillStyle=`rgb(${110+Math.random()*50|0},${105+Math.random()*45|0},${95+Math.random()*40|0})`; k.beginPath(); k.ellipse(Math.random()*64,Math.random()*64,6+Math.random()*8,5+Math.random()*6,Math.random()*3,0,7); k.fill(); } }) },
  { nome:'Grama',    t:tex(k=>{ k.fillStyle='#5f8f3a'; k.fillRect(0,0,64,64); for(let i=0;i<250;i++){ k.fillStyle=Math.random()<.5?'#4f7d2f':'#78a84b'; k.fillRect(Math.random()*64|0,Math.random()*64|0,1,3); } }) },
  // peças finas: forma própria; porta e piso deixam passar; porta e janela viram de frente para a câmera
  { nome:'Porta', forma:'porta', passa:true, tecla:'9', t:tex(k=>{ k.fillStyle='#7a4f2c'; k.fillRect(0,0,64,64); k.strokeStyle='#5a3618'; k.lineWidth=3; k.strokeRect(10,6,44,22); k.strokeRect(10,36,44,22);
      k.fillStyle='#e2c26a'; k.beginPath(); k.arc(50,34,3.5,0,7); k.fill(); ruido(k,'40,20,5',150,.15); }) },
  { nome:'Janela', forma:'janela', tecla:'0', vidro:true, t:tex(k=>{ k.clearRect(0,0,64,64); k.fillStyle='rgba(140,190,225,.5)'; k.fillRect(0,0,64,64);
      k.fillStyle='#f3f1ea'; k.fillRect(0,0,64,6); k.fillRect(0,58,64,6); k.fillRect(0,0,6,64); k.fillRect(58,0,6,64); k.fillRect(30,0,4,64); k.fillRect(0,30,64,4);
      k.fillStyle='rgba(255,255,255,.55)'; k.fillRect(10,10,5,16); k.fillRect(40,38,5,14); }) },
  { nome:'Piso', forma:'piso', passa:true, tecla:'p', t:tex(k=>{ k.fillStyle='#d9cdb4'; k.fillRect(0,0,64,64); k.fillStyle='#b8aa8e'; for(let x=0;x<64;x+=32){ k.fillRect(x,0,2,64); k.fillRect(0,x,64,2); } ruido(k,'90,80,60',200,.1); }) },
  { nome:'Taco', forma:'piso', passa:true, t:tex(k=>{ k.fillStyle='#a8743f'; k.fillRect(0,0,64,64); for(let y=0;y<64;y+=8){ k.fillStyle=(y/8)%2?'rgba(70,45,20,.35)':'rgba(110,45,20,.35)'; k.fillRect(((y/8)%2)*16,y,64,8); k.fillStyle='rgba(50,30,10,.5)'; k.fillRect(0,y,64,1); } }) },
];
const geoBloco=new THREE.BoxGeometry(1,1,1);
// geometria de cada forma, centrada na célula (o chão da célula é y = -0,5)
const GEO={ bloco:geoBloco, porta:new THREE.BoxGeometry(0.92,2,0.09).translate(0,0.5,0), janela:new THREE.BoxGeometry(1,1,0.12), piso:new THREE.BoxGeometry(1,0.08,1).translate(0,-0.46,0) };
const ESCALA_FANTASMA={ bloco:[1,1,1,0], porta:[0.92,2,0.12,0.5], janela:[1,1,0.14,0], piso:[1,0.1,1,-0.45] };
const forma=tp=>BLOCOS[tp].forma||'bloco';
const mats=BLOCOS.map(b=>new THREE.MeshLambertMaterial({map:b.t, transparent:!!b.vidro, opacity:b.vidro?0.85:1, side:b.forma?THREE.DoubleSide:THREE.FrontSide}));
// valor guardado: tipo + 100 se a peça está girada 90°
const tipoDe=v=>v%100, giroDe=v=>v>=100?1:0;

/* ───────── estado salvo ───────── */
let salvo={ saldo:SALDO_INICIAL, terrenos:{} };   // terrenos: id → { blocos:[[i,j,k,tipo],...] }
try{ const s=JSON.parse(localStorage.getItem(CHAVE)); if(s&&typeof s.saldo==='number') salvo=s; }catch(e){}
let tSalvar=null;
function salvar(){ clearTimeout(tSalvar); tSalvar=setTimeout(()=>{ try{ localStorage.setItem(CHAVE,JSON.stringify(salvo)); }catch(e){ console.warn('não salvou',e); } },400); }
const fmt=v=>'M$ '+v.toLocaleString('pt-BR');
function hudSaldo(){ $('saldo').textContent='💰 '+fmt(salvo.saldo); }
// dinheiro ganho fora daqui (entregas)
export function ganhar(v){ salvo.saldo=Math.max(0,salvo.saldo+Math.round(v)); salvar(); hudSaldo(); }
export { fmt };

/* ───────── achar lotes vazios ───────── */
export const lotes=[];    // {id, A:[x,z], t:[tx,tz], n:[nx,nz], preco, grupo, chao, placa, meu, blocos:Map, ocupa:Set}
function paralela(pts,off){ const n=pts.length, q=[]; for(let i=0;i<n;i++){ const a=pts[Math.max(i-1,0)], c=pts[Math.min(i+1,n-1)]; let dx=c[0]-a[0], dz=c[1]-a[1]; const l=Math.hypot(dx,dz)||1; q.push([pts[i][0]+dz/l*off, pts[i][1]-dx/l*off]); } return q; }
function pertoDeRua(x,z,f){
  for(const r of ruas){ if(r.pe) continue; const b=r.bb; if(x<b[0]-30||x>b[2]+30||z<b[1]-30||z>b[3]+30) continue;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], c=r.pts[i+1], vx=c[0]-a[0], vz=c[1]-a[1]; let t=((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t));
      if(Math.hypot(x-a[0]-vx*t,z-a[1]-vz*t)<r.w/2+CALCADA+f) return true; } }
  return false;
}
function lotesVazios(){
  const cand=[];
  const vias=ruas.filter(r=>!r.pe&&COM_CALCADA.has(r.tipo)).sort((a,b)=>(a.pts[0][0]+a.pts[0][1])-(b.pts[0][0]+b.pts[0][1]));   // ordem fixa: mesmo id sempre
  for(const r of vias) for(const lado of [1,-1]){
    const q=paralela(r.pts, lado*(r.w/2+GUIA+CALCADA+0.6));
    for(let i=0;i<q.length-1;i++){
      const a=q[i], b=q[i+1], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<W+4) continue;
      const t=[(b[0]-a[0])/L,(b[1]-a[1])/L], n0=[-t[1],t[0]];
      // fundo do lote = lado que se afasta do eixo da rua
      const meio=[(a[0]+b[0])/2,(a[1]+b[1])/2], e0=r.pts[i], e1=r.pts[i+1]||e0, eixo=[(e0[0]+e1[0])/2,(e0[1]+e1[1])/2];
      const nn=((meio[0]-eixo[0])*n0[0]+(meio[1]-eixo[1])*n0[1])>=0?n0:[-n0[0],-n0[1]];
      for(let s=2; s+W<L-2; s+=W+2){
        let A=[a[0]+t[0]*s, a[1]+t[1]*s], tt=t;
        if(nn[0]*(-tt[1])+nn[1]*tt[0]<0){ A=[A[0]+tt[0]*W, A[1]+tt[1]*W]; tt=[-tt[0],-tt[1]]; }   // garante n = esquerda de t (casa com a rotação do grupo)
        const cx=A[0]+tt[0]*W/2+nn[0]*D/2, cz=A[1]+tt[1]*W/2+nn[1]*D/2;
        if(Math.hypot(cx,cz)>1100||cx<LX0+30||cx>LX1-30||cz<LZ0+30||cz>LZ1-30) continue;
        cand.push({A,t:tt,n:nn,cx,cz});
      }
    }
  }
  cand.sort((p,q)=>Math.hypot(p.cx,p.cz)-Math.hypot(q.cx,q.cz));     // primeiro os perto do centro
  // prédios de comércio que saíram (predios.js): para refazer os 70 terrenos de antes IGUAIS (os ids
  // são a posição e têm dono no banco), eles contam como prédio na primeira passada
  const removido=(x,z)=>comerciosRemovidos.some(p=>{ const b=p.bb; return x>=b[0]&&x<=b[2]&&z>=b[1]&&z<=b[3]&&dentroPoly(x,z,p.pts); });
  const livreCom=(c,bloq)=>{ for(let u=0.5;u<=W-0.5;u+=2.75) for(let v=0.5;v<=D-0.5;v+=2.9){
      const x=c.A[0]+c.t[0]*u+c.n[0]*v, z=c.A[1]+c.t[1]*u+c.n[1]*v;
      if(bloq(x,z)||substituidoPorMarco(x,z,'muro',0)||(v>1&&pertoDeRua(x,z,0.2))) return false; }
    return true; };
  const tocaRemovido=c=>{ for(let u=0.5;u<=W-0.5;u+=2.75) for(let v=0.5;v<=D-0.5;v+=2.9) if(removido(c.A[0]+c.t[0]*u+c.n[0]*v, c.A[1]+c.t[1]*u+c.n[1]*v)) return true; return false; };
  const ok=[];
  for(const c of cand){
    if(ok.length>=70) break;
    if(ok.some(o=>Math.hypot(o.cx-c.cx,o.cz-c.cz)<16)) continue;
    if(livreCom(c,(x,z)=>bloqueado(x,z)||removido(x,z))) ok.push(c);
  }
  // segunda passada: terrenos novos onde havia comércio (sem encostar nos de antes)
  const novos=[];
  for(const c of cand){
    if(novos.length>=LIMITE_NOVOS) break;
    if(ok.some(o=>Math.hypot(o.cx-c.cx,o.cz-c.cz)<16)||novos.some(o=>Math.hypot(o.cx-c.cx,o.cz-c.cz)<16)) continue;
    if(tocaRemovido(c)&&livreCom(c,bloqueado)) novos.push(c);
  }
  return [...ok,...novos];
}
const LIMITE_NOVOS=200;
function dentroPoly(x,z,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }

/* ───────── placa ───────── */
function placa(l1,l2,cor){
  const c=document.createElement('canvas'); c.width=512; c.height=256; const k=c.getContext('2d');
  k.fillStyle=cor; k.fillRect(0,0,512,256); k.strokeStyle='#fff'; k.lineWidth=12; k.strokeRect(8,8,496,240);
  k.fillStyle='#fff'; k.textAlign='center'; let fs=92; k.font=`900 ${fs}px system-ui,sans-serif`; while(k.measureText(l1).width>460&&fs>40){ fs-=4; k.font=`900 ${fs}px system-ui,sans-serif`; } k.fillText(l1,256,118);
  k.font='800 66px system-ui,sans-serif'; k.fillText(l2,256,206);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace;
  const g=new THREE.Group();
  const quadro=new THREE.Mesh(new THREE.PlaneGeometry(2.4,1.2),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide})); quadro.position.y=1.9; g.add(quadro);
  for(const x of [-0.9,0.9]){ const p=new THREE.Mesh(new THREE.BoxGeometry(0.1,1.4,0.1),new THREE.MeshLambertMaterial({color:0x6b4f36})); p.position.set(x,0.7,0); g.add(p); }
  return g;
}
const matChao=new THREE.MeshBasicMaterial(flat({color:0x9c8a6a,transparent:true,opacity:0.35}));
const matEstaca=new THREE.MeshLambertMaterial({color:0xf97316});

function montarLote(c,idx){
  const id=Math.round(c.cx)+'_'+Math.round(c.cz);
  const grupo=new THREE.Group(); grupo.position.set(c.A[0],0,c.A[1]); grupo.rotation.y=Math.atan2(-c.t[1],c.t[0]);   // local +x = frente (t), +z = fundo (n)
  // chão do lote (também é o alvo do raio da construção)
  const chao=new THREE.Mesh(new THREE.PlaneGeometry(W,D).rotateX(-Math.PI/2).translate(W/2,0,D/2),matChao); chao.renderOrder=-6.6; grupo.add(chao);
  for(const [x,z] of [[0,0],[W,0],[0,D],[W,D]]){ const e=new THREE.Mesh(new THREE.BoxGeometry(0.12,0.9,0.12),matEstaca); e.position.set(x,0.45,z); grupo.add(e); }
  const l={id, A:c.A, t:c.t, n:c.n, preco:Math.round((W*D*(22+((idx*37)%17)))/500)*500, grupo, chao, placa:null, blocos:new Map(), ocupa:new Set(), inst:[]};
  l.cx=c.cx; l.cz=c.cz;
  scene.add(grupo); trocarPlaca(l);
  // terreno já comprado neste navegador
  const s=salvo.terrenos[id]; if(s){ for(const [i,j,k,tp] of s.blocos||[]) l.blocos.set(i+','+j+','+k,tp); refazer(l); }
  lotes.push(l);
}
const meu=l=>nuvem.ok?l.dono===nuvem.uid:!!salvo.terrenos[l.id];
const meuNome=()=>{ try{ return (localStorage.getItem('matelandia3d.nome')||'').trim()||'Visitante'; }catch(e){ return 'Visitante'; } };
function trocarPlaca(l){
  if(l.placa) l.grupo.remove(l.placa);
  l.placa=null; if(meu(l)||l.dono) return;                         // comprado (por você ou outro): a placa sai
  l.placa=placa('VENDE-SE',fmt(l.preco),'#15803d');
  l.placa.position.set(W/2,0,0.8); l.placa.rotation.y=Math.PI;   // de frente para a rua
  l.grupo.add(l.placa);
}

/* ───────── blocos do lote: uma InstancedMesh por tipo ───────── */
const M4=new THREE.Matrix4(), V3=new THREE.Vector3(), QY=new THREE.Quaternion(), EY=new THREE.Vector3(0,1,0), UM=new THREE.Vector3(1,1,1);
function refazer(l){
  for(const m of l.inst) l.grupo.remove(m); l.inst=[];
  const porTipo=BLOCOS.map(()=>[]); l.ocupa=new Set();
  for(const [k,v] of l.blocos){ const [i,j,y]=k.split(',').map(Number), tp=tipoDe(v); porTipo[tp].push([i,j,y,giroDe(v)]); if(y<=1&&!BLOCOS[tp].passa) l.ocupa.add(i+','+j); }
  porTipo.forEach((lista,tp)=>{ if(!lista.length) return;
    const im=new THREE.InstancedMesh(GEO[forma(tp)],mats[tp],lista.length); im.userData.tipo=tp; im.userData.celulas=lista;
    lista.forEach(([i,j,y,g],n)=>{ M4.compose(V3.set(i+0.5,y+0.5,j+0.5),QY.setFromAxisAngle(EY,g?Math.PI/2:0),UM); im.setMatrixAt(n,M4); });
    im.instanceMatrix.needsUpdate=true; l.grupo.add(im); l.inst.push(im); });
  if(meu(l)&&salvo.terrenos[l.id]){ salvo.terrenos[l.id].blocos=[...l.blocos].map(([k,tp])=>[...k.split(',').map(Number),tp]); salvar(); }
}
// bloco no chão/primeiro andar bloqueia passagem (pessoa, carro, polícia)
function bloqueiaBloco(x,z){
  for(const l of lotes){ if(!l.ocupa.size&&!l.ocupaNeg) continue;
    const dx=x-l.A[0], dz=z-l.A[1], u=dx*l.t[0]+dz*l.t[1], v=dx*l.n[0]+dz*l.n[1];
    if(u<0||v<0||u>=W||v>=D) continue;
    const cel=Math.floor(u)+','+Math.floor(v); if(l.ocupa.has(cel)||l.ocupaNeg?.has(cel)) return true; }
  return false;
}

/* ───────── compra, modo construção ───────── */
export const obra={ ativa:false, lote:null, tipo:0, tirar:false, giro:0 };
function loteEm(x,z,margem=0){
  for(const l of lotes){ const dx=x-l.A[0], dz=z-l.A[1], u=dx*l.t[0]+dz*l.t[1], v=dx*l.n[0]+dz*l.n[1];
    if(u>=-margem&&v>=-margem-3&&u<=W+margem&&v<=D+margem) return l; }
  return null;
}
let aviso=null;
// celular não tem teclado: o aviso fala do botão em vez da tecla
const TOQUE=matchMedia('(pointer:coarse)').matches;
const semTecla=t=>!TOQUE?t:t.replace(/ ?C para construir/,' Toque em 🧱 Construir').replace(/V para cuidar dele/,'toque em 🏪 Negócio')
  .replace(/\(B\)/,'(💰 Comprar terreno)').replace(/aperte B/,'toque em 💰 Comprar terreno').replace(/\(L leva até ele\)/,'(🏠 Meu terreno leva até ele)');
function avisar(t){ t=semTecla(t); const a=$('aviso'); a.textContent=t; a.style.opacity=1; clearTimeout(aviso); aviso=setTimeout(()=>a.style.opacity=0,2500); }
let comprando=false;
export async function comprar(x,z){
  const l=loteEm(x,z,1); if(!l) return false;
  if(meu(l)){ avisar('Este terreno já é seu'); return true; }
  if(l.dono){ avisar(`Terreno de ${l.donoNome||'outro jogador'}`); return true; }
  if(salvo.saldo<l.preco){ avisar(`Saldo insuficiente (${fmt(salvo.saldo)})`); return true; }
  if(comprando) return true;
  if(nuvem.ok){ comprando=true; avisar('Comprando…'); const r=await tomarLote(l.id, meuNome()); comprando=false;
    if(r==='limite'){ avisar(`Cada jogador pode ter só ${LIMITE_TERRENOS} terrenos`); return true; }
    if(r!=='ok'){ avisar('Alguém comprou antes de você!'); return true; }
    l.dono=nuvem.uid; l.donoNome=meuNome(); }
  salvo.saldo-=l.preco; salvo.terrenos[l.id]={blocos:[]}; salvar(); hudSaldo(); trocarPlaca(l);
  avisar('Terreno comprado! C para construir'); return true;
}
export function alternarObra(x,z){
  if(obra.ativa){ sairObra(); return; }
  const l=loteEm(x,z,0); if(!l||!meu(l)){ avisar(l?'Compre o terreno primeiro (B)':'Entre no seu terreno para construir'); return; }
  if(l.negocio){ avisar('Aqui funciona o seu negócio: V para cuidar dele'); return; }
  obra.ativa=true; obra.lote=l; $('barra').style.display='flex'; fantasma.visible=true; marcarBarra();
}
function sairObra(){ obra.ativa=false; obra.lote=null; $('barra').style.display='none'; fantasma.visible=false; }

// dica do que dá para fazer aqui
export function dicaTerreno(x,z){
  const l=loteEm(x,z,1); if(!l) { if(obra.ativa) sairObra(); return ''; }
  if(obra.ativa) return 'Clique: colocar · Direito: tirar · 1–8 blocos · 9 porta · 0 janela · P piso · C: sair · V: negócio';
  const neg=ganchos.dica?.(l); if(neg) return neg;
  if(!meu(l)&&l.dono) return `Terreno de ${l.donoNome||'outro jogador'}`;
  return meu(l)?'C construir · V abrir um negócio':`B comprar terreno (${fmt(l.preco)}) · saldo ${fmt(salvo.saldo)}`;
}

/* ───────── mira: raio do mouse até o lote ───────── */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
const fantasma=new THREE.Mesh(geoBloco,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.35,depthWrite:false}));
fantasma.add(new THREE.LineSegments(new THREE.EdgesGeometry(geoBloco),new THREE.LineBasicMaterial({color:0xf97316})));
fantasma.visible=false;
let alvo=null;   // {lote, por:[i,j,k] (onde colocar), tira:[i,j,k] (o que tirar)}
function mirar(cx,cy){
  const l=obra.lote; if(!l) return;
  const r=cv.getBoundingClientRect(); ndc.set((cx-r.left)/r.width*2-1, -(cy-r.top)/r.height*2+1);
  ray.setFromCamera(ndc,camera);
  const hit=ray.intersectObjects([...l.inst,l.chao],false)[0];
  alvo=null; fantasma.visible=false; if(!hit) return;
  let por, tira=null;
  if(hit.object.isInstancedMesh){
    const c=hit.object.userData.celulas[hit.instanceId], f=hit.face.normal, n=c[3]?{x:f.z,y:f.y,z:-f.x}:f;   // peça girada: gira a normal junto
    tira=c.slice(0,3);
    if(BLOCOS[hit.object.userData.tipo].forma==='piso'&&n.y>0.5) por=c.slice(0,3);                         // em cima do piso: na mesma célula
    else por=[c[0]+Math.round(n.x),c[1]+Math.round(n.z),c[2]+Math.round(n.y)];
  }
  else { const p=l.grupo.worldToLocal(hit.point.clone()); por=[Math.floor(p.x),Math.floor(p.z),0]; }
  // porta e janela de frente para a câmera: olhando ao longo do fundo do lote, a peça fica de lado a lado
  const d0=l.grupo.worldToLocal(camera.position.clone()), d1=l.grupo.worldToLocal(hit.point.clone());
  obra.giro=Math.abs(d1.z-d0.z)>=Math.abs(d1.x-d0.x)?0:1;
  const dentro=c=>c[0]>=0&&c[1]>=0&&c[0]<W&&c[1]<D&&c[2]>=0&&c[2]<ALT;
  if(!dentro(por)) por=null;
  alvo={por,tira};
  const mostra=obra.tirar?tira:por; if(!mostra) return;
  if(fantasma.parent!==l.grupo) l.grupo.add(fantasma);
  const fm=obra.tirar?'bloco':forma(obra.tipo), [sx,sy,sz,oy]=ESCALA_FANTASMA[fm], gira=fm==='porta'||fm==='janela'?obra.giro:0;
  fantasma.position.set(mostra[0]+0.5,mostra[2]+0.5+oy,mostra[1]+0.5); fantasma.scale.set(sx,sy,sz).multiplyScalar(obra.tirar?1.04:1); fantasma.rotation.y=gira?Math.PI/2:0;
  fantasma.material.color.setHex(obra.tirar?0xff4444:0xffffff); fantasma.visible=true;
}
function agir(tirar){
  const l=obra.lote; if(!l||!alvo) return;
  if(tirar){ if(alvo.tira){ const k=alvo.tira.join(','); l.blocos.delete(k); refazer(l); tirarBloco(l.id,k); } }
  else if(alvo.por){
    const [i,j,y]=alvo.por, k=alvo.por.join(','), fm=forma(obra.tipo);
    if(l.blocos.size>=6000) return avisar('Limite de blocos neste terreno');
    const abaixo=l.blocos.get(i+','+j+','+(y-1));
    if(abaixo!==undefined&&forma(tipoDe(abaixo))==='porta') return avisar('Aí é a parte de cima da porta');
    if(fm==='porta'&&(y+1>=ALT||l.blocos.has(i+','+j+','+(y+1)))) return avisar('A porta precisa de 2 de altura livres');
    if(l.blocos.has(k)&&forma(tipoDe(l.blocos.get(k)))!=='piso') return;                          // só o piso pode ser substituído
    const gira=(fm==='porta'||fm==='janela')&&obra.giro?100:0;
    l.blocos.set(k,obra.tipo+gira); refazer(l); porBloco(l.id,k,obra.tipo+gira); dispatchEvent(new Event('matelandia:bloco')); }
}
let ini=null;
cv.addEventListener('pointerdown',e=>{ ini={x:e.clientX,y:e.clientY,b:e.button}; });
cv.addEventListener('pointermove',e=>{ if(obra.ativa&&e.pointerType==='mouse') mirar(e.clientX,e.clientY); });
cv.addEventListener('pointerup',e=>{
  if(!obra.ativa||!ini) return; const m=Math.hypot(e.clientX-ini.x,e.clientY-ini.y), b=ini.b; ini=null;
  if(m>6) return;                                                   // foi arrasto de câmera, não clique
  mirar(e.clientX,e.clientY); agir(b===2||obra.tirar);
});
cv.addEventListener('contextmenu',e=>{ if(obra.ativa) e.preventDefault(); });
addEventListener('keydown',e=>{
  if(!obra.ativa) return;
  const n=parseInt(e.key); if(n>=1&&n<=8){ obra.tipo=n-1; obra.tirar=false; marcarBarra(); }
  const ex=BLOCOS.findIndex(b=>b.tecla&&b.tecla===e.key.toLowerCase()); if(ex>=0){ obra.tipo=ex; obra.tirar=false; marcarBarra(); }
  if(e.code==='Escape'){ sairObra(); e.stopImmediatePropagation(); }
},true);

/* ───────── barra de blocos ───────── */
function montarBarra(){
  const b=$('barra'); b.replaceChildren();
  BLOCOS.forEach((bl,i)=>{ const d=document.createElement('button'); d.className='bloco'; d.title=bl.nome;
    const img=document.createElement('canvas'); img.width=img.height=40; img.getContext('2d').drawImage(bl.t.image,0,0,40,40);
    const n=document.createElement('span'); n.textContent=i<8?i+1:(bl.tecla||'').toUpperCase(); d.append(img,n);
    d.onclick=ev=>{ obra.tipo=i; obra.tirar=false; marcarBarra(); ev.currentTarget.blur(); }; b.append(d); });
  const t=document.createElement('button'); t.id='tirar'; t.textContent='Tirar'; t.onclick=ev=>{ obra.tirar=!obra.tirar; marcarBarra(); ev.currentTarget.blur(); }; b.append(t);
}
function marcarBarra(){ [...$('barra').querySelectorAll('.bloco')].forEach((d,i)=>d.classList.toggle('sel',i===obra.tipo&&!obra.tirar)); $('tirar').classList.toggle('sel',obra.tirar); }

export function iniciarTerrenos(){
  definirBloqueioExtra(bloqueiaBloco);
  lotesVazios().forEach(montarLote);
  montarBarra(); hudSaldo();
  ligarNuvem().catch(e=>console.warn('mundo compartilhado:',e));
  return lotes.length;
}

/* ───────── mundo compartilhado ───────── */
async function ligarNuvem(){
  // o que estava só neste navegador (antes do Firebase): guarda para subir se o terreno ainda estiver livre
  const locais=new Map(Object.entries(salvo.terrenos).map(([id,t])=>[id,new Map((t.blocos||[]).map(([i,j,k,tp])=>[i+','+j+','+k,tp]))]));
  if(!await conectarNuvem()){ console.info('mundo compartilhado indisponível: construções só neste navegador'); return; }
  const porId=new Map(lotes.map(l=>[l.id,l]));
  let primeira=true;
  ouvirLotes(async donos=>{
    for(const l of lotes){ const d=donos[l.id]; l.dono=d?.dono||null; l.donoNome=d?.nome||''; trocarPlaca(l);
      if(obra.ativa&&obra.lote===l&&!meu(l)) sairObra(); }
    if(!primeira) return; primeira=false;
    // migração: terrenos comprados antes, neste navegador
    for(const [id,bl] of locais){ const l=porId.get(id); if(!l) continue;
      if(l.dono===nuvem.uid){ continue; }
      if(!l.dono&&await tomarLote(id, meuNome())==='ok'){ l.dono=nuvem.uid; l.donoNome=meuNome(); trocarPlaca(l); subirBlocos(id, bl); continue; }
      delete salvo.terrenos[id]; ganhar(l.preco); avisar('Um terreno seu já tinha dono: dinheiro devolvido'); }
    for(const l of lotes){ if(meu(l)&&!salvo.terrenos[l.id]) salvo.terrenos[l.id]={blocos:[]}; } salvar();
  });
  // só aceita o que o jogo sabe desenhar: dado estragado no banco não pode travar o jogo de ninguém
  const valido=(k,v)=>{ if(!Number.isInteger(v)||v<0||tipoDe(v)>=BLOCOS.length||v>=100+BLOCOS.length) return false;
    const c=k.split(',').map(Number); return c.length===3&&c.every(Number.isInteger)&&c[0]>=0&&c[0]<W&&c[1]>=0&&c[1]<D&&c[2]>=0&&c[2]<ALT; };
  // entrou/saiu da conta Google: o dono muda de identidade → refaz placas e quem pode construir
  aoTrocarConta((n,mudou)=>{ if(!mudou) return;
    for(const l of lotes){ trocarPlaca(l); if(meu(l)&&!salvo.terrenos[l.id]) salvo.terrenos[l.id]={blocos:[]}; }
    if(obra.ativa&&!meu(obra.lote)) sairObra(); salvar(); });
  for(const l of lotes) ouvirBlocos(l.id, m=>{ for(const [k,v] of m) if(!valido(k,v)) m.delete(k); if(m.size>6000) return; l.blocos=m; refazer(l); });
}
export const lotesMeus=()=>lotes.filter(meu);
// para o minimapa e o "ir ao terreno": cantos do lote, centro e um ponto na calçada da frente
const desenhoLote=l=>{ const c=(u,v)=>[l.A[0]+l.t[0]*u+l.n[0]*v, l.A[1]+l.t[1]*u+l.n[1]*v];
  return { id:l.id, cantos:[c(0,0),c(W,0),c(W,D),c(0,D)], centro:c(W/2,D/2), frente:c(W/2,-1.5) }; };
export const terrenosNoMapa=()=>({ meus:lotes.filter(meu).map(desenhoLote), outros:lotes.filter(l=>l.dono&&!meu(l)).map(desenhoLote) });
export { avisar as avisarTerreno };
// para o negocios.js (sem import circular: ele registra a dica aqui)
export const ganchos={ dica:null };
// tira todos os blocos do terreno (para abrir um negócio no lugar)
export function limparBlocos(l){ if(!meu(l)) return; for(const k of [...l.blocos.keys()]) tirarBloco(l.id,k); l.blocos.clear(); refazer(l); }
export { sairObra };
export { meu, salvo, salvar, loteEm, W as LARG_LOTE, D as FUNDO_LOTE, meuNome };
