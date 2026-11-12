// Volume da cidade: contornos de prédios do Overture (dados/predios.json, gerado por
// tools/baixar_predios.py). Altura quase nunca vem no Brasil, então é estimada pela área e
// pela distância do centro. Telhado de 4 águas nos contornos de 4 cantos, laje nos demais.
// As malhas são juntadas por quadra de 250 m (menos chamadas de desenho, e o three descarta
// as que estão fora da câmera).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from './cena.js';
import { toXZ, toLL, D2R } from './geo.js';
import { predios, bbox, ruas } from './cidade.js';
import { DADOS_PREDIOS, TILE_URL, ZOOM_MAX } from './config.js';
import { substituidoPorMarco } from './marcos.js';

const PAREDES = [0xf2ead9,0xe8dcc8,0xd9c7a8,0xcfd6da,0xe9c9a8,0xf0e6d6,0xc9d3b5,0xd8b08c,0xe6e1d3,0xbfcad3].map(c=>new THREE.Color(c));
const CERAMICA = [0xa5553a,0x9b4c33,0xb0603f,0x8f4a35,0xb86b4b].map(c=>new THREE.Color(c));
const FIBRO = [0x9a9a96,0x8a8f93,0xa7a9a6].map(c=>new THREE.Color(c));   // telha de fibrocimento / laje
// fachada: janela a cada 3 m, andares de 3,2 m (UV em metros, que o ExtrudeGeometry já dá);
// a textura é branca onde é parede, então a cor sorteada por prédio aparece por baixo
function texFachada(galpao){
  const cv=document.createElement('canvas'); cv.width=256; cv.height=256; const k=cv.getContext('2d');
  const px=x=>x/3*256, py=y=>256-y/3.2*256;               // metros → pixel (y conta do chão)
  k.fillStyle='#fff'; k.fillRect(0,0,256,256);
  for(let i=0;i<1500;i++){ k.fillStyle=`rgba(0,0,0,${Math.random()*0.05})`; k.fillRect(Math.random()*256,Math.random()*256,2,2); }
  if(galpao){                                             // telha metálica ondulada na parede, faixa de vitrô no alto
    for(let x=0;x<256;x+=10){ k.fillStyle='rgba(0,0,0,.07)'; k.fillRect(x,0,4,256); }
    k.fillStyle='#55606b'; k.fillRect(px(0.3),py(3.0),px(2.4),py(2.6)-py(3.0));
  } else {
    k.fillStyle='rgba(0,0,0,.18)'; k.fillRect(0,py(0.45),256,py(0)-py(0.45));          // barrado (sujeira de chuva)
    const x0=px(0.85), x1=px(2.15), y0=py(2.15), y1=py(0.95);
    k.fillStyle='#e9e4da'; k.fillRect(x0-6,y0-6,x1-x0+12,y1-y0+16);                   // moldura e peitoril
    k.fillStyle='#2e3b47'; k.fillRect(x0,y0,x1-x0,y1-y0);                              // vidro
    k.fillStyle='rgba(160,190,210,.35)'; k.fillRect(x0,y0,(x1-x0)/2-2,y1-y0);          // reflexo
    k.fillStyle='#d8d2c6'; k.fillRect((x0+x1)/2-2,y0,4,y1-y0); k.fillRect(x0,(y0+y1)/2-2,x1-x0,4); // caixilho
  }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8;
  t.repeat.set(1/3,-1/3.2); t.offset.set(0,1/3.2);       // v do Extrude = 1 − altura → aqui vira altura/3,2
  return t;
}
const mat = new THREE.MeshLambertMaterial({vertexColors:true, map:texFachada(false)});
const matGalpao = new THREE.MeshLambertMaterial({vertexColors:true, map:texFachada(true)});

// número pseudoaleatório estável por prédio (a cidade sai igual toda vez)
const sorte = (x,z,k=0)=>{ const s=Math.sin(x*12.9898+z*78.233+k*37.719)*43758.5453; return s-Math.floor(s); };
const area = pts=>{ let a=0; for(let i=0,j=pts.length-1;i<pts.length;j=i++) a+=(pts[j][0]+pts[i][0])*(pts[j][1]-pts[i][1]); return a/2; };
function dentro(x,z,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }

function altura(p,pts,A,cx,cz){
  if(p.h) return Math.min(Math.max(p.h,2.6),80);
  if(p.a) return p.a*3.2+0.4;
  const r=sorte(cx,cz), centro=Math.hypot(cx,cz)<450;
  if(A>600) return 6.5+r*2.5;                          // galpão, barracão, mercado
  if(centro&&A>120&&r<0.35) return 6.4+(r<0.08?3.2:0);  // sobrado / prédio de 3 andares no centro
  return 3.4+r*0.8;                                     // casa térrea
}

function pinta(g,cor){ const n=g.attributes.position.count, a=new Float32Array(n*3); for(let i=0;i<n;i++){ a[i*3]=cor.r; a[i*3+1]=cor.g; a[i*3+2]=cor.b; } g.setAttribute('color',new THREE.BufferAttribute(a,3)); return g; }

// paredes (sem tampa de cima quando vai ter telhado)
function paredes(pts,h,tampa){
  const s=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],-p[1])));
  const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,steps:1}).rotateX(-Math.PI/2);
  if(!tampa){ // só as paredes: tira as faces de cima e de baixo (normal vertical)
    const P=g.attributes.position, N=g.attributes.normal, keep=[];
    for(let t=0;t<P.count;t+=3){ if(Math.abs(N.getY(t))<0.9) keep.push(t,t+1,t+2); }
    const ng=new THREE.BufferGeometry();
    for(const nome of ['position','normal','uv']){ const src=g.attributes[nome], n=src.itemSize, arr=new Float32Array(keep.length*n); keep.forEach((v,i)=>{ for(let c=0;c<n;c++) arr[i*n+c]=src.array[v*n+c]; }); ng.setAttribute(nome,new THREE.BufferAttribute(arr,n)); }
    g.dispose(); return ng;
  }
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
}

// telhado de 4 águas sobre um contorno de 4 cantos: cumeeira no eixo mais comprido
function quatroAguas(pts,h,alt){
  const [a,b,c,d]=pts, L1=Math.hypot(b[0]-a[0],b[1]-a[1]), L2=Math.hypot(c[0]-b[0],c[1]-b[1]);
  const [p0,p1,p2,p3]=L1>=L2?[a,b,c,d]:[b,c,d,a];             // p0→p1 é o lado comprido
  const curto=Math.min(L1,L2), mid=(u,v)=>[(u[0]+v[0])/2,(u[1]+v[1])/2];
  const m03=mid(p0,p3), m12=mid(p1,p2), dx=m12[0]-m03[0], dz=m12[1]-m03[1], L=Math.hypot(dx,dz)||1;
  const recuo=Math.min(curto/2,L/2-0.01)/L;                    // cumeeira recua meio vão de cada ponta
  const r0=[m03[0]+dx*recuo,m03[1]+dz*recuo], r1=[m12[0]-dx*recuo,m12[1]-dz*recuo], y=h+alt, v=[];
  const T=(A,ya,B,yb,C,yc)=>{ // triângulo com a face para cima (troca a ordem se vier invertido)
    const ux=B[0]-A[0], uy=yb-ya, uz=B[1]-A[1], wx=C[0]-A[0], wy=yc-ya, wz=C[1]-A[1];
    const ny=uz*wx-ux*wz;
    if(ny>=0) v.push(A[0],ya,A[1], B[0],yb,B[1], C[0],yc,C[1]); else v.push(A[0],ya,A[1], C[0],yc,C[1], B[0],yb,B[1]);
  };
  T(p0,h,p1,h,r1,y); T(p0,h,r1,y,r0,y);    // água comprida 1
  T(p2,h,p3,h,r0,y); T(p2,h,r0,y,r1,y);    // água comprida 2
  T(p1,h,p2,h,r1,y); T(p3,h,p0,h,r0,y);    // tacaniças (pontas)
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  g.computeVertexNormals(); return g;
}

// mastros com as bandeiras do Brasil e do Paraná na frente da Prefeitura (parede virada para a rua)
function bandeira(desenho){ const cv=document.createElement('canvas'); cv.width=210; cv.height=150; desenho(cv.getContext('2d')); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t; }
const BANDEIRAS=[
  bandeira(k=>{ k.fillStyle='#1f9a46'; k.fillRect(0,0,210,150); k.fillStyle='#f7d117'; k.beginPath(); k.moveTo(105,12); k.lineTo(198,75); k.lineTo(105,138); k.lineTo(12,75); k.fill();
    k.fillStyle='#233f8f'; k.beginPath(); k.arc(105,75,36,0,7); k.fill(); k.strokeStyle='#fff'; k.lineWidth=6; k.beginPath(); k.arc(105,110,46,-2.35,-0.8); k.stroke(); }),   // Brasil
  bandeira(k=>{ k.fillStyle='#1f8a4a'; k.fillRect(0,0,210,150); k.fillStyle='#fff'; k.beginPath(); k.moveTo(0,40); k.lineTo(0,0); k.lineTo(40,0); k.lineTo(210,110); k.lineTo(210,150); k.lineTo(170,150); k.fill();
    k.fillStyle='#233f8f'; k.beginPath(); k.arc(105,75,26,0,7); k.fill(); }),                                                                                 // Paraná (simplificada)
];
function bandeiras(pts){
  let melhor=null, nota=1e9;
  for(let i=0;i<pts.length;i++){ const a=pts[i], c=pts[(i+1)%pts.length], L=Math.hypot(c[0]-a[0],c[1]-a[1]); if(L<6) continue;
    const t=[(c[0]-a[0])/L,(c[1]-a[1])/L], m=[(a[0]+c[0])/2,(a[1]+c[1])/2]; let nn=[t[1],-t[0]];
    if(dentro(m[0]+nn[0]*0.4,m[1]+nn[1]*0.4,pts)) nn=[-nn[0],-nn[1]];
    let d=1e9; for(const r of ruas){ if(r.pe) continue; const pref=/rui barbosa/i.test(r.nome)?-25:0;   // a frente com os mastros é na R. Rui Barbosa
      for(let k=0;k<r.pts.length-1;k++){ const p=r.pts[k], q=r.pts[k+1], vx=q[0]-p[0], vz=q[1]-p[1]; let u=((m[0]+nn[0]*4-p[0])*vx+(m[1]+nn[1]*4-p[1])*vz)/(vx*vx+vz*vz||1); u=Math.max(0,Math.min(1,u)); d=Math.min(d,Math.hypot(m[0]+nn[0]*4-p[0]-vx*u,m[1]+nn[1]*4-p[1]-vz*u)+pref); } }
    if(d<nota){ nota=d; melhor={m,nn,t}; } }
  if(!melhor) return;
  const {m,nn,t}=melhor, mastro=new THREE.MeshLambertMaterial({color:0xd9d9d6});
  [-2.4,0,2.4].forEach((o,i)=>{ const x=m[0]+nn[0]*4.5+t[0]*o, z=m[1]+nn[1]*4.5+t[1]*o;
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.08,9,8),mastro); pole.position.set(x,4.5,z); scene.add(pole);
    if(i===2) return;                                                                                  // 3º mastro (município): sem bandeira, não sei o desenho
    const f=new THREE.Mesh(new THREE.PlaneGeometry(2.1,1.5),new THREE.MeshLambertMaterial({map:BANDEIRAS[i],side:THREE.DoubleSide}));
    f.position.set(x+t[0]*1.1,8.1,z+t[1]*1.1); f.rotation.y=Math.atan2(nn[0],nn[1]); scene.add(f); });
}

// tampa plana (laje) na altura h
function laje(pts,h){
  const g=new THREE.ShapeGeometry(new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],-p[1])))).rotateX(-Math.PI/2).translate(0,h,0);
  g.deleteAttribute('uv'); return g.index?g.toNonIndexed():g;
}

/* ───────── Telhados com a imagem do satélite ─────────
   Os telhados de cada quadra de 250 m ficam numa malha própria, com UV = posição no chão.
   Perto do jogador, a quadra ganha uma textura montada com os blocos z18 da Esri (os mesmos do
   chão, já no cache do navegador): de cima, cada telhado mostra o telhado real. Longe, volta a
   cor sorteada. Nada é gravado em disco (regra da Esri: só online). */
const Q=250, MARGEM=30, TPX=576;                  // quadra, folga em volta, pixels da textura (~0,54 m/px)
const quadrasTelhado=[];                          // {x0,z0,mesh,mat,matTex,tex,estado,cores}
const matTelhadoCor=new THREE.MeshLambertMaterial({vertexColors:true});
const SOL=new THREE.Vector3(-0.5,1,0.35).normalize();
function uvs(g,x0,z0){
  const P=g.attributes.position, uv=new Float32Array(P.count*2), L=Q+2*MARGEM;
  for(let i=0;i<P.count;i++){ uv[i*2]=(P.getX(i)-(x0-MARGEM))/L; uv[i*2+1]=1-(P.getZ(i)-(z0-MARGEM))/L; }
  g.setAttribute('uv',new THREE.BufferAttribute(uv,2)); return g;
}
const gx=(lon,z)=>(lon+180)/360*256*2**z;
const gy=(lat,z)=>(1-Math.asinh(Math.tan(lat*D2R))/Math.PI)/2*256*2**z;
function carregarImg(url){ return new Promise((ok,no)=>{ const im=new Image(); im.crossOrigin='anonymous'; im.onload=()=>ok(im); im.onerror=no; im.src=url; }); }
async function texturaQuadra(q){
  const Z=ZOOM_MAX, [la0,lo0]=toLL(q.x0-MARGEM,q.z0-MARGEM), [la1,lo1]=toLL(q.x0+Q+MARGEM,q.z0+Q+MARGEM);
  const X0=gx(lo0,Z), X1=gx(lo1,Z), Y0=gy(la0,Z), Y1=gy(la1,Z), sx=TPX/(X1-X0), sy=TPX/(Y1-Y0);
  const cv=document.createElement('canvas'); cv.width=cv.height=TPX; const k=cv.getContext('2d');
  const pedidos=[];
  for(let tx=Math.floor(X0/256);tx<=Math.floor(X1/256);tx++) for(let ty=Math.floor(Y0/256);ty<=Math.floor(Y1/256);ty++)
    pedidos.push(carregarImg(TILE_URL(Z,tx,ty)).then(im=>k.drawImage(im,(tx*256-X0)*sx,(ty*256-Y0)*sy,256*sx+0.5,256*sy+0.5)));
  const res=await Promise.allSettled(pedidos);
  if(!res.some(r=>r.status==='fulfilled')) throw new Error('sem blocos');
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=4; return tex;
}
// sombreamento leve por face (a imagem já tem luz, então só um toque para separar as águas)
function sombra(g){ const N=g.attributes.normal, c=new Float32Array(N.count*3); for(let i=0;i<N.count;i++){ const v=0.8+0.25*Math.max(0,N.getX(i)*SOL.x+N.getY(i)*SOL.y+N.getZ(i)*SOL.z); c[i*3]=c[i*3+1]=c[i*3+2]=Math.min(1,v); } return new THREE.BufferAttribute(c,3); }

let tTelhado=0;
export function atualizarTelhados(dt,px,pz){
  tTelhado+=dt; if(tTelhado<0.5) return; tTelhado=0;
  for(const q of quadrasTelhado){
    const d=Math.hypot(q.x0+Q/2-px,q.z0+Q/2-pz);
    if(d<520&&q.estado==='cor'){
      q.estado='carregando';
      texturaQuadra(q).then(tex=>{
        if(q.estado!=='carregando'){ tex.dispose(); return; }
        q.tex=tex; q.matTex.map=tex; q.matTex.needsUpdate=true;
        q.mesh.geometry.setAttribute('color',q.sombra); q.mesh.material=q.matTex; q.estado='foto';
      }).catch(()=>{ q.estado='cor'; });
    } else if(d>800&&q.estado!=='cor'){
      if(q.tex){ q.tex.dispose(); q.tex=null; }
      q.mesh.geometry.setAttribute('color',q.cores); q.mesh.material=matTelhadoCor; q.estado='cor';
    }
  }
}

export async function carregarPredios(){
  let dados;
  try{ const r=await fetch(DADOS_PREDIOS); if(!r.ok) throw new Error('HTTP '+r.status); dados=await r.json(); }
  catch(e){ console.warn('Sem '+DADOS_PREDIOS+': cidade fica só com os prédios do OSM',e); return 0; }
  const osm=predios.slice(), quadras=new Map(); let n=0;
  const quadra=(cx,cz)=>{ const i=Math.floor(cx/Q), j=Math.floor(cz/Q), k=i+'_'+j; if(!quadras.has(k)) quadras.set(k,{i,j,paredes:[],galpoes:[],telhados:[]}); return quadras.get(k); };
  // prédios do OSM (Prefeitura, Câmara, Rodoviária…): mesma fachada e telhado do satélite dos outros
  for(const o of osm){ if(!o.osm) continue;
    let pts=o.pts.slice(), A=area(pts); if(A<0){ pts=pts.reverse(); A=-A; }
    const cx=(o.bb[0]+o.bb[2])/2, cz=(o.bb[1]+o.bb[3])/2, qd=quadra(cx,cz), r=sorte(cx,cz,1);
    try{
      const par=pinta(paredes(pts,o.h,false), o.branco?new THREE.Color(0xf6f6f3):PAREDES[(r*PAREDES.length)|0]);
      const quatro=pts.length===4&&A<900&&!o.branco;
      let tel; if(quatro){ const curto=Math.min(Math.hypot(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1]),Math.hypot(pts[2][0]-pts[1][0],pts[2][1]-pts[1][1])); tel=pinta(quatroAguas(pts,o.h,Math.min(curto*0.28,3)),CERAMICA[0]); }
      else tel=pinta(laje(pts,o.h),FIBRO[1]);
      (A>600&&!o.branco?qd.galpoes:qd.paredes).push(par); qd.telhados.push(uvs(tel,qd.i*Q,qd.j*Q));
      if(/prefeitura/i.test(o.nome)) bandeiras(pts);
    }catch(e){}
  }
  for(const p of dados.predios){
    let pts=p.c.map(([la,lo])=>toXZ(la,lo));
    let A=area(pts); if(Math.abs(A)<12) continue;              // menor que 12 m²: ruído
    if(A<0){ pts=pts.reverse(); A=-A; }                       // sentido anti-horário visto de cima
    const bb=bbox(pts), cx=(bb[0]+bb[2])/2, cz=(bb[1]+bb[3])/2;
    if(substituidoPorMarco(cx,cz,'overture',A)) continue;      // marco feito à mão no lugar
    if(osm.some(o=>cx>=o.bb[0]&&cx<=o.bb[2]&&cz>=o.bb[1]&&cz<=o.bb[3]&&dentro(cx,cz,o.pts))) continue; // já veio do OSM
    const h=altura(p,pts,A,cx,cz), r=sorte(cx,cz,1);
    const quatro=pts.length===4 && A<900;
    const qd=quadra(cx,cz), i=qd.i, j=qd.j;
    try{
      const par=pinta(paredes(pts,h,false), PAREDES[(r*PAREDES.length)|0]);
      let tel;
      if(quatro){ const curto=Math.min(Math.hypot(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1]),Math.hypot(pts[2][0]-pts[1][0],pts[2][1]-pts[1][1]));
        tel=pinta(quatroAguas(pts,h,Math.min(curto*0.28,3)), (A>400?FIBRO:CERAMICA)[(sorte(cx,cz,2)*5|0)%(A>400?3:5)]); }
      else tel=pinta(laje(pts,h), FIBRO[(r*3)|0]);
      (A>600?qd.galpoes:qd.paredes).push(par); qd.telhados.push(uvs(tel,i*Q,j*Q));
    }catch(e){ continue; }
    predios.push({pts,bb,h,galpao:A>600}); n++;
  }
  for(const qd of quadras.values()){
    for(const [lista,m] of [[qd.paredes,mat],[qd.galpoes,matGalpao]]){ if(!lista.length) continue;
      const g=mergeGeometries(lista,false); lista.forEach(x=>x.dispose());
      if(g){ g.computeBoundingSphere(); scene.add(new THREE.Mesh(g,m)); } }
    const t=mergeGeometries(qd.telhados,false); qd.telhados.forEach(x=>x.dispose()); if(!t) continue;
    t.computeBoundingSphere();
    const mesh=new THREE.Mesh(t,matTelhadoCor); scene.add(mesh);
    quadrasTelhado.push({x0:qd.i*Q, z0:qd.j*Q, mesh, cores:t.attributes.color, sombra:sombra(t),
      matTex:new THREE.MeshBasicMaterial({vertexColors:true}), tex:null, estado:'cor'});
  }
  return n;
}
