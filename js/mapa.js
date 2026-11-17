// 🗺️ Mapa grande com GPS (pedido do Maicon, 16/11/2026), no jeito do GTA:
// M (ou ☰ → Mapa) abre a cidade inteira; arrastar move, roda/botões dão zoom, clique marca o destino.
// O GPS acha o caminho pelas ruas (A* no grafo das vias do OSM), desenha a rota em roxo no mapa e no
// minimapa e mostra a seta com a distância; se o jogador sair do caminho, a rota é refeita.
import { $ } from './cena.js';
import { ruas, predios } from './cidade.js';

/* ───────── grafo das ruas ───────── */
const nos=new Map();           // chave → {x,z,adj:[[chave,custo]]}
const chave=p=>Math.round(p[0]*2)+'_'+Math.round(p[1]*2);
function montarGrafo(){
  if(nos.size) return;
  for(const r of ruas){ if(r.pe||r.pts.length<2) continue;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], b=r.pts[i+1], ka=chave(a), kb=chave(b); if(ka===kb) continue;
      if(!nos.has(ka)) nos.set(ka,{x:a[0],z:a[1],adj:[]}); if(!nos.has(kb)) nos.set(kb,{x:b[0],z:b[1],adj:[]});
      const c=Math.hypot(b[0]-a[0],b[1]-a[1]); nos.get(ka).adj.push([kb,c]); nos.get(kb).adj.push([ka,c]); } }
}
function noMaisPerto(x,z){ let m=null, md=1e18; for(const [k,n] of nos){ const d=(n.x-x)**2+(n.z-z)**2; if(d<md){ md=d; m=k; } } return m; }
// A* com fila de prioridade simples (heap binário)
function rota(de,para){
  montarGrafo(); const a=noMaisPerto(...de), b=noMaisPerto(...para); if(!a||!b) return null;
  const alvo=nos.get(b), h=k=>{ const n=nos.get(k); return Math.hypot(n.x-alvo.x,n.z-alvo.z); };
  const g=new Map([[a,0]]), veio=new Map(), heap=[[h(a),a]];
  const push=it=>{ heap.push(it); let i=heap.length-1; while(i>0){ const p=(i-1)>>1; if(heap[p][0]<=heap[i][0]) break; [heap[p],heap[i]]=[heap[i],heap[p]]; i=p; } };
  const pop=()=>{ const t=heap[0], u=heap.pop(); if(heap.length){ heap[0]=u; let i=0; for(;;){ const l=2*i+1, r=l+1; let m=i; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===i) break; [heap[m],heap[i]]=[heap[i],heap[m]]; i=m; } } return t; };
  const feito=new Set();
  while(heap.length){ const [,k]=pop(); if(feito.has(k)) continue; feito.add(k);
    if(k===b){ const cam=[]; for(let c=b;c;c=veio.get(c)){ const n=nos.get(c); cam.push([n.x,n.z]); } cam.reverse(); cam.push(para); return cam; }
    const gk=g.get(k); for(const [v,c] of nos.get(k).adj){ const ng=gk+c; if(ng<(g.get(v)??1e18)){ g.set(v,ng); veio.set(v,k); push([ng+h(v),v]); } } }
  return null;
}

/* ───────── GPS ───────── */
export const gps={ destino:null, nome:'', rota:null, t:0 };
export function marcarDestino(x,z,nome,px,pz){ gps.destino=[x,z]; gps.nome=nome||'Destino'; gps.rota=rota([px,pz],[x,z]); gps.t=0; }
export function limparGPS(){ gps.destino=null; gps.rota=null; $('gps').style.display='none'; }
const distSeg=(x,z,a,b)=>{ const vx=b[0]-a[0], vz=b[1]-a[1]; let t=((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t)); return Math.hypot(x-a[0]-vx*t,z-a[1]-vz*t); };
// a cada quadro (barato); refaz a rota se saiu do caminho
export function atualizarGPS(dt,px,pz,camX,camZ,avisar){
  if(!gps.destino){ $('gps').style.display='none'; return; }
  const [dx,dz]=gps.destino, falta=Math.hypot(dx-px,dz-pz);
  if(falta<14){ avisar?.(`📍 Você chegou: ${gps.nome}`); limparGPS(); return; }
  gps.t-=dt;
  if(gps.t<=0){ gps.t=1;
    const R=gps.rota; let md=1e9, i0=0; if(R) for(let i=0;i<R.length-1;i++){ const d=distSeg(px,pz,R[i],R[i+1]); if(d<md){ md=d; i0=i; } }
    if(!R||md>30) gps.rota=rota([px,pz],gps.destino); else if(i0>0) gps.rota=R.slice(i0); }
  // seta: aponta para um ponto ~25 m à frente na rota
  let alvo=gps.destino, comp=0; const R=gps.rota;
  if(R&&R.length>1){ let ac=Math.hypot(R[1][0]-px,R[1][1]-pz); alvo=R[1];
    for(let i=1;i<R.length;i++){ comp+=i===1?ac:Math.hypot(R[i][0]-R[i-1][0],R[i][1]-R[i-1][1]); if(ac<25&&i+1<R.length){ alvo=R[i+1]; ac+=Math.hypot(R[i+1][0]-R[i][0],R[i+1][1]-R[i][1]); } } }
  else comp=falta;
  const el=$('gps'); el.style.display='block'; $('gpsTxt').textContent='📍 '+gps.nome;
  $('gpsDist').textContent=comp>=1000?(comp/1000).toFixed(1).replace('.',',')+' km':Math.round(comp)+' m';
  const ang=Math.atan2(alvo[0]-px,alvo[1]-pz)-Math.atan2(px-camX,pz-camZ);
  $('gpsSeta').style.transform=`rotate(${-ang}rad)`;
}

/* ───────── mapa grande ───────── */
const cv=$('mapaCv'), k=cv.getContext('2d');
const vista={ cx:0, cz:0, esc:0.35 };       // centro (m) e pixels por metro
let dados=()=>({ jogador:[0,0], rumo:0, pontos:[], terrenos:null, casas:null });
export function fonteMapa(f){ dados=f; }
let arrasto=null, moveu=false;
function tamanho(){ const r=cv.getBoundingClientRect(), dpr=Math.min(devicePixelRatio,2); cv.width=Math.round(r.width*dpr); cv.height=Math.round(r.height*dpr); return dpr; }
const tela=(x,z,dpr)=>[(x-vista.cx)*vista.esc*dpr+cv.width/2, (z-vista.cz)*vista.esc*dpr+cv.height/2];
const mundo=(sx,sy,dpr)=>[(sx*dpr-cv.width/2)/(vista.esc*dpr)+vista.cx, (sy*dpr-cv.height/2)/(vista.esc*dpr)+vista.cz];
export function desenharMapa(){
  if(!$('mapa').classList.contains('on')) return;
  const dpr=tamanho(), d=dados(), e=vista.esc*dpr, W=cv.width, H=cv.height;
  k.fillStyle='#1c2a20'; k.fillRect(0,0,W,H);
  k.save(); k.translate(W/2,H/2); k.scale(e,e); k.translate(-vista.cx,-vista.cz);
  const vx0=vista.cx-W/2/e-50, vx1=vista.cx+W/2/e+50, vz0=vista.cz-H/2/e-50, vz1=vista.cz+H/2/e+50;
  const poli=(pts)=>{ k.beginPath(); pts.forEach((q,i)=>i?k.lineTo(q[0],q[1]):k.moveTo(q[0],q[1])); k.closePath(); };
  if(d.terrenos){ for(const [lista,cor] of [[d.terrenos.livres||[],'rgba(34,197,94,.55)'],[d.terrenos.outros,'rgba(148,163,184,.5)'],[d.terrenos.meus,'#F97316']]) for(const l of lista){ k.fillStyle=cor; poli(l.cantos); k.fill(); }
    for(const l of d.terrenos.livres||[]) if(l.esp==='balada'){ k.fillStyle=Math.floor(performance.now()/450)%2?'rgba(217,70,239,.95)':'rgba(250,204,21,.95)'; poli(l.cantos); k.fill(); } }   // balada à venda pisca
  k.fillStyle='#6b665b';
  for(const p of predios){ const b=p.bb; if(b[2]<vx0||b[0]>vx1||b[3]<vz0||b[1]>vz1) continue; poli(p.pts); k.fill(); }
  if(d.casas){ for(const [lista,cor] of [[d.casas.outras,'#94a3b8'],[d.casas.minhas,'#F97316']]) for(const pts of lista){ k.fillStyle=cor; poli(pts); k.fill(); } }
  k.lineCap='round'; k.lineJoin='round';
  for(const r of ruas){ const b=r.bb; if(b[2]<vx0||b[0]>vx1||b[3]<vz0||b[1]>vz1) continue;
    k.strokeStyle=r.pe?'#8a967f':'#e8e6df'; k.lineWidth=Math.max(r.w,(r.pe?1.5:3)/e);
    k.beginPath(); r.pts.forEach((q,i)=>i?k.lineTo(q[0],q[1]):k.moveTo(q[0],q[1])); k.stroke(); }
  if(gps.rota){ k.strokeStyle='#a855f7'; k.lineWidth=Math.max(5,7/e); k.beginPath(); gps.rota.forEach((q,i)=>i?k.lineTo(q[0],q[1]):k.moveTo(q[0],q[1])); k.stroke(); }
  k.restore();
  // nomes das ruas maiores (só com zoom)
  if(vista.esc>0.6){ k.font=`600 ${11*dpr}px system-ui`; k.fillStyle='rgba(255,255,255,.75)'; k.textAlign='center'; const vistas=new Set();
    for(const r of ruas){ if(!r.nome||r.pe||r.w<6||vistas.has(r.nome)) continue; const m=r.pts[r.pts.length>>1]; const [sx,sy]=tela(m[0],m[1],dpr); if(sx<0||sy<0||sx>W||sy>H) continue; vistas.add(r.nome); k.fillText(r.nome,sx,sy-4*dpr); } }
  // pontos (negócios, hospital, delegacia…) e destino
  k.textAlign='center'; k.textBaseline='middle';
  for(const p of d.pontos){ const [sx,sy]=tela(p.x,p.z,dpr); if(sx<-20||sy<-20||sx>W+20||sy>H+20) continue;
    k.fillStyle='rgba(15,23,42,.85)'; k.beginPath(); k.arc(sx,sy,11*dpr,0,7); k.fill(); k.font=`${13*dpr}px system-ui`; k.fillText(p.ic,sx,sy+1*dpr); }
  if(gps.destino){ const [sx,sy]=tela(gps.destino[0],gps.destino[1],dpr); k.fillStyle='#a855f7'; k.strokeStyle='#fff'; k.lineWidth=2.5*dpr;
    k.beginPath(); k.moveTo(sx,sy); k.arc(sx,sy-18*dpr,10*dpr,Math.PI*0.8,Math.PI*2.2); k.closePath(); k.fill(); k.stroke(); }
  // jogador
  { const [sx,sy]=tela(d.jogador[0],d.jogador[1],dpr); k.save(); k.translate(sx,sy); k.rotate(-d.rumo); k.fillStyle='#F97316'; k.strokeStyle='#111'; k.lineWidth=2.5*dpr;
    k.beginPath(); k.moveTo(0,14*dpr); k.lineTo(9*dpr,-10*dpr); k.lineTo(0,-4*dpr); k.lineTo(-9*dpr,-10*dpr); k.closePath(); k.fill(); k.stroke(); k.restore(); }
  k.fillStyle='#fff'; k.font=`800 ${18*dpr}px system-ui`; k.fillText('N',W/2,22*dpr);
}
let piscar=null;   // redesenha enquanto aberto, para a balada à venda piscar
export function abrirMapa(){ const d=dados(); vista.cx=d.jogador[0]; vista.cz=d.jogador[1]; $('mapa').classList.add('on'); montarAtalhos(); desenharMapa(); clearInterval(piscar); piscar=setInterval(()=>{ if(dados().terrenos?.livres?.some(l=>l.esp==='balada')) desenharMapa(); },450); }
export function fecharMapa(){ $('mapa').classList.remove('on'); clearInterval(piscar); piscar=null; }
export function alternarMapa(){ $('mapa').classList.contains('on')?fecharMapa():abrirMapa(); }
const zoom=(f,sx,sy)=>{ const dpr=Math.min(devicePixelRatio,2), r=cv.getBoundingClientRect(); sx??=r.width/2; sy??=r.height/2;
  const [mx,mz]=mundo(sx,sy,dpr); vista.esc=Math.max(0.08,Math.min(4,vista.esc*f)); const [nx,nz]=mundo(sx,sy,dpr); vista.cx+=mx-nx; vista.cz+=mz-nz; desenharMapa(); };
cv.addEventListener('wheel',e=>{ e.preventDefault(); const r=cv.getBoundingClientRect(); zoom(e.deltaY>0?0.85:1.18,e.clientX-r.left,e.clientY-r.top); },{passive:false});
const toques=new Map(); let pinca=null;
cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); toques.set(e.pointerId,[e.clientX,e.clientY]); arrasto=[e.clientX,e.clientY]; moveu=false;
  if(toques.size===2){ const [a,b]=[...toques.values()]; pinca=Math.hypot(a[0]-b[0],a[1]-b[1]); } });
cv.addEventListener('pointermove',e=>{ if(!toques.has(e.pointerId)) return; toques.set(e.pointerId,[e.clientX,e.clientY]);
  if(toques.size===2&&pinca){ const [a,b]=[...toques.values()], d=Math.hypot(a[0]-b[0],a[1]-b[1]); zoom(d/pinca); pinca=d; moveu=true; return; }
  if(!arrasto) return; const dx=e.clientX-arrasto[0], dy=e.clientY-arrasto[1]; if(Math.abs(dx)+Math.abs(dy)>4) moveu=true;
  vista.cx-=dx/vista.esc; vista.cz-=dy/vista.esc; arrasto=[e.clientX,e.clientY]; desenharMapa(); });
const solta=e=>{ toques.delete(e.pointerId); if(toques.size<2) pinca=null;
  if(e.type==='pointerup'&&!moveu&&toques.size===0){ const r=cv.getBoundingClientRect(), dpr=Math.min(devicePixelRatio,2), [x,z]=mundo(e.clientX-r.left,e.clientY-r.top,dpr), d=dados();
    marcarDestino(x,z,'Ponto no mapa',d.jogador[0],d.jogador[1]); desenharMapa(); }
  if(toques.size===0) arrasto=null; };
cv.addEventListener('pointerup',solta); cv.addEventListener('pointercancel',solta);
$('mapaMais').onclick=()=>zoom(1.4); $('mapaMenos').onclick=()=>zoom(1/1.4);
$('mapaFechar').onclick=fecharMapa; $('mapaLimpar').onclick=()=>{ limparGPS(); desenharMapa(); };
addEventListener('resize',desenharMapa);
// atalhos de destino: o mais perto de cada tipo
function montarAtalhos(){
  const d=dados(), [px,pz]=d.jogador, el=$('mapaAtalhos'); el.replaceChildren();
  const tipos=[['🏡','Minha casa',p=>p.tipo==='minhaCasa'],['🏪','Meu negócio',p=>p.tipo==='meuNegocio'],['💊','Farmácia',p=>p.tipo==='farmacia'],['🏥','Hospital',p=>p.tipo==='hospital'],['🚔','Delegacia',p=>p.tipo==='policia'],['🟩','Terreno à venda',p=>p.tipo==='livre']];
  for(const [ic,nome,f] of tipos){ const lista=d.pontos.filter(f).concat(f({tipo:'livre'})&&d.terrenos?.livres?d.terrenos.livres.map(l=>({x:l.centro[0],z:l.centro[1],tipo:'livre'})):[]);
    if(!lista.length) continue; const m=lista.reduce((a,b)=>Math.hypot(a.x-px,a.z-pz)<Math.hypot(b.x-px,b.z-pz)?a:b);
    const b=document.createElement('button'); b.className='sec'; b.textContent=`${ic} ${nome}`;
    b.onclick=()=>{ marcarDestino(m.x,m.z,m.nome||nome,px,pz); vista.cx=(px+m.x)/2; vista.cz=(pz+m.z)/2; desenharMapa(); }; el.append(b); }
}
