// Volume da cidade: contornos de prédios do Overture (dados/predios.json, gerado por
// tools/baixar_predios.py). Altura quase nunca vem no Brasil, então é estimada pela área e
// pela distância do centro. Telhado de 4 águas nos contornos de 4 cantos, laje nos demais.
// As malhas são juntadas por quadra de 250 m (menos chamadas de desenho, e o three descarta
// as que estão fora da câmera).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from './cena.js';
import { toXZ } from './geo.js';
import { predios, bbox } from './cidade.js';
import { DADOS_PREDIOS } from './config.js';

const PAREDES = [0xf2ead9,0xe8dcc8,0xd9c7a8,0xcfd6da,0xe9c9a8,0xf0e6d6,0xc9d3b5,0xd8b08c,0xe6e1d3,0xbfcad3].map(c=>new THREE.Color(c));
const CERAMICA = [0xa5553a,0x9b4c33,0xb0603f,0x8f4a35,0xb86b4b].map(c=>new THREE.Color(c));
const FIBRO = [0x9a9a96,0x8a8f93,0xa7a9a6].map(c=>new THREE.Color(c));   // telha de fibrocimento / laje
const mat = new THREE.MeshLambertMaterial({vertexColors:true});

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
  g.deleteAttribute('uv');
  if(!tampa){ // tira as faces de cima (normal para cima, no topo)
    const P=g.attributes.position, N=g.attributes.normal, keep=[];
    for(let t=0;t<P.count;t+=3){ const cima=N.getY(t)>0.9&&P.getY(t)>h-0.01; if(!cima) keep.push(t,t+1,t+2); }
    const ng=new THREE.BufferGeometry();
    for(const nome of ['position','normal']){ const src=g.attributes[nome], arr=new Float32Array(keep.length*3); keep.forEach((v,i)=>{ arr[i*3]=src.getX(v); arr[i*3+1]=src.getY(v); arr[i*3+2]=src.getZ(v); }); ng.setAttribute(nome,new THREE.BufferAttribute(arr,3)); }
    g.dispose(); return ng;
  }
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

export async function carregarPredios(){
  let dados;
  try{ const r=await fetch(DADOS_PREDIOS); if(!r.ok) throw new Error('HTTP '+r.status); dados=await r.json(); }
  catch(e){ console.warn('Sem '+DADOS_PREDIOS+': cidade fica só com os prédios do OSM',e); return 0; }
  const osm=predios.slice(), quadras=new Map(); let n=0;
  for(const p of dados.predios){
    let pts=p.c.map(([la,lo])=>toXZ(la,lo));
    let A=area(pts); if(Math.abs(A)<12) continue;              // menor que 12 m²: ruído
    if(A<0){ pts=pts.reverse(); A=-A; }                       // sentido anti-horário visto de cima
    const bb=bbox(pts), cx=(bb[0]+bb[2])/2, cz=(bb[1]+bb[3])/2;
    if(osm.some(o=>cx>=o.bb[0]&&cx<=o.bb[2]&&cz>=o.bb[1]&&cz<=o.bb[3]&&dentro(cx,cz,o.pts))) continue; // já veio do OSM
    const h=altura(p,pts,A,cx,cz), r=sorte(cx,cz,1);
    const telhado=pts.length===4 && A<900;
    const geos=[];
    try{
      geos.push(pinta(paredes(pts,h,!telhado), PAREDES[(r*PAREDES.length)|0]));
      if(telhado){ const curto=Math.min(Math.hypot(pts[1][0]-pts[0][0],pts[1][1]-pts[0][1]),Math.hypot(pts[2][0]-pts[1][0],pts[2][1]-pts[1][1]));
        geos.push(pinta(quatroAguas(pts,h,Math.min(curto*0.28,3)), (A>400?FIBRO:CERAMICA)[(sorte(cx,cz,2)*5|0)%(A>400?3:5)])); }
      else { const top=geos[0], P=top.attributes.position, N=top.attributes.normal, C=top.attributes.color, laje=FIBRO[(r*3)|0];
        for(let i=0;i<P.count;i++) if(N.getY(i)>0.9){ C.setXYZ(i,laje.r,laje.g,laje.b); } }
    }catch(e){ continue; }
    const k=Math.floor(cx/250)+'_'+Math.floor(cz/250); if(!quadras.has(k)) quadras.set(k,[]); quadras.get(k).push(...geos);
    predios.push({pts,bb}); n++;
  }
  for(const geos of quadras.values()){
    const g=mergeGeometries(geos,false); geos.forEach(x=>x.dispose()); if(!g) continue;
    g.computeBoundingSphere(); scene.add(new THREE.Mesh(g,mat));
  }
  return n;
}
