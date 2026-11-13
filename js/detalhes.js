// Detalhes de rua, gerados a partir dos dados (nada disso está mapeado no OSM de Matelândia):
//  - porta em cada prédio, na parede virada para a rua (portão de enrolar nos galpões);
//  - meio-fio de verdade (15 cm de altura), cortado nos cruzamentos;
//  - muro ou grade na frente dos lotes que têm casa (frente de loja e praça ficam abertas),
//    com vão de portão a cada lote; entram na colisão;
//  - quebra-molas perto de escola, igreja e hospital e no meio das ruas residenciais longas.
//    Posição SUPOSTA. O veículo dá o solavanco e o trânsito reduz antes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from './cena.js';
import { toXZ } from './geo.js';
import { ruas, predios } from './cidade.js';
import { substituidoPorMarco } from './marcos.js';

const COM_CALCADA = new Set(['primary','secondary','tertiary','residential','unclassified','living_street','primary_link','secondary_link','tertiary_link']);
const CALCADA = 2.6, GUIA = 0.3;     // iguais aos de cidade.js
const sorte=(x,z,k=0)=>{ const s=Math.sin(x*12.9898+z*78.233+k*37.719)*43758.5453; return s-Math.floor(s); };

const pecas=[];                      // geometrias com cor por vértice → uma malha só
function pinta(g,c){ const k=new THREE.Color(c), n=g.attributes.position.count, a=new Float32Array(n*3); for(let i=0;i<n;i++){ a[i*3]=k.r; a[i*3+1]=k.g; a[i*3+2]=k.b; } g.setAttribute('color',new THREE.BufferAttribute(a,3)); if(g.index) g=g.toNonIndexed(); if(g.attributes.uv) g.deleteAttribute('uv'); pecas.push(g); return g; }
const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1);
// caixa de comprimento L ao longo da direção (dx,dz), centro (x,y0+h/2,z)
function viga(x,z,dx,dz,L,larg,h,y0,c){ const g=new THREE.BoxGeometry(larg,h,L); M.compose(V.set(x,y0+h/2,z),Q.setFromEuler(E.set(0,Math.atan2(dx,dz),0)),S); g.applyMatrix4(M); return pinta(g,c); }

function dentro(x,z,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }

// grade de busca dos prédios (centro → lista)
const G=30, grade=new Map();
function indexar(lista){ for(const p of lista){ const cx=(p.bb[0]+p.bb[2])/2, cz=(p.bb[1]+p.bb[3])/2, k=Math.floor(cx/G)+'_'+Math.floor(cz/G); if(!grade.has(k)) grade.set(k,[]); grade.get(k).push(p); } }
function perto(x,z,r){ const out=[]; for(let i=Math.floor((x-r)/G);i<=Math.floor((x+r)/G);i++) for(let j=Math.floor((z-r)/G);j<=Math.floor((z+r)/G);j++){ const l=grade.get(i+'_'+j); if(l) for(const p of l) out.push(p); } return out; }
const ocupado=(x,z)=>perto(x,z,20).some(p=>x>=p.bb[0]&&x<=p.bb[2]&&z>=p.bb[1]&&z<=p.bb[3]&&dentro(x,z,p.pts));

function distRua(x,z){
  let md=1e9;
  for(const r of ruas){ if(r.pe) continue; const b=r.bb; if(x<b[0]-40||x>b[2]+40||z<b[1]-40||z>b[3]+40) continue;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], c=r.pts[i+1], vx=c[0]-a[0], vz=c[1]-a[1];
      let t=((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t));
      md=Math.min(md, Math.hypot(x-a[0]-vx*t, z-a[1]-vz*t)-r.w/2); } }
  return md;
}

// linha paralela ao eixo da via, deslocada 'off' (positivo = esquerda de quem segue os pontos)
function paralela(pts,off){ const n=pts.length, q=[]; for(let i=0;i<n;i++){ const a=pts[Math.max(i-1,0)], c=pts[Math.min(i+1,n-1)]; let dx=c[0]-a[0], dz=c[1]-a[1]; const l=Math.hypot(dx,dz)||1; q.push([pts[i][0]+dz/l*off, pts[i][1]-dx/l*off]); } return q; }
// percorre a linha em passos de 'passo' metros: cb(x,z,dx,dz)
function andar(q,passo,cb){ let sobra=0; for(let i=0;i<q.length-1;i++){ const a=q[i], b=q[i+1], L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<1e-3) continue; const dx=(b[0]-a[0])/L, dz=(b[1]-a[1])/L;
  for(let s=sobra; s<L; s+=passo) cb(a[0]+dx*s, a[1]+dz*s, dx, dz); sobra=(sobra-L)%passo; if(sobra<0) sobra+=passo; } }

// junta passos seguidos na mesma direção num trecho só; emite(x0,z0,x1,z1,dx,dz,extra) ao fechar
function trechos(passo,emite){
  let ini=null, fim=null, d=null, ex=null;
  const fecha=()=>{ if(ini){ emite(ini[0],ini[1],fim[0]+d[0]*passo,fim[1]+d[1]*passo,d[0],d[1],ex); } ini=null; };
  return { add(x,z,dx,dz,extra){ if(ini&&(Math.abs(dx-d[0])>1e-6||Math.abs(dz-d[1])>1e-6||Math.hypot(x-fim[0],z-fim[1])>passo*1.5||extra!==ex)) fecha();
      if(!ini){ ini=[x,z]; d=[dx,dz]; ex=extra; } fim=[x,z]; }, fecha };
}

/* ───────── portas ───────── */
const CORES_PORTA=[0x6b4a33,0x7a5a3c,0xf1ede4,0x4b5563,0x8a5a2b];
function portas(casas){
  let n=0;
  for(const p of casas){
    const pts=p.pts; let melhor=null, nota=1e9;
    for(let i=0;i<pts.length;i++){ const a=pts[i], c=pts[(i+1)%pts.length], L=Math.hypot(c[0]-a[0],c[1]-a[1]); if(L<(p.galpao?5:2.2)) continue;
      const t=[(c[0]-a[0])/L,(c[1]-a[1])/L], m=[(a[0]+c[0])/2,(a[1]+c[1])/2]; let nn=[t[1],-t[0]];
      if(dentro(m[0]+nn[0]*0.3,m[1]+nn[1]*0.3,pts)) nn=[-nn[0],-nn[1]];
      const s=distRua(m[0]+nn[0]*2,m[1]+nn[1]*2)-Math.min(L,10)*0.15; if(s<nota){ nota=s; melhor={m,nn,t,L}; } }
    if(!melhor||nota>40) continue;
    const {m,nn,t,L}=melhor, des=(sorte(m[0],m[1],3)-0.5)*Math.max(0,L-3)*0.6;
    const x=m[0]+t[0]*des+nn[0]*0.05, z=m[1]+t[1]*des+nn[1]*0.05, ang=Math.atan2(nn[0],nn[1]);
    const g=p.galpao?new THREE.PlaneGeometry(Math.min(4.5,L*0.5),Math.min(4.2,(p.h||6)-0.8)):new THREE.PlaneGeometry(0.95,2.1);
    const h=g.parameters.height; M.compose(V.set(x,h/2,z),Q.setFromEuler(E.set(0,ang,0)),S); g.applyMatrix4(M);
    pinta(g, p.galpao?0x8d949b:CORES_PORTA[(sorte(m[0],m[1],4)*CORES_PORTA.length)|0]);
    if(!p.galpao){ viga(x+nn[0]*0.25,z+nn[1]*0.25,t[0],t[1],1.5,0.5,0.12,0,0xc9c3b6); }   // degrau
    n++;
  }
  return n;
}

/* ───────── cruzamentos (para cortar meio-fio e muro) ───────── */
let cruz=[];
function montarCruz(){
  const cont=new Map(), k=p=>Math.round(p[0]*10)+'_'+Math.round(p[1]*10);
  for(const r of ruas){ if(r.pe) continue; const vis=new Set(); for(const p of r.pts){ const c=k(p); if(vis.has(c)) continue; vis.add(c); cont.set(c,(cont.get(c)||0)+1); } }
  for(const r of ruas) if(!r.pe) for(const p of r.pts) if(cont.get(k(p))>1) cruz.push(p);
}
const pertoCruz=(x,z,r)=>cruz.some(p=>Math.abs(p[0]-x)<r&&Math.abs(p[1]-z)<r&&Math.hypot(p[0]-x,p[1]-z)<r);

/* ───────── meio-fio 3D ───────── */
function meioFio(){
  for(const r of ruas){ if(r.pe||!COM_CALCADA.has(r.tipo)) continue;
    for(const lado of [1,-1]){ const q=paralela(r.pts,lado*(r.w/2+GUIA/2));
      const t=trechos(1.0,(x0,z0,x1,z1,dx,dz)=>{ const L=Math.hypot(x1-x0,z1-z0); viga((x0+x1)/2,(z0+z1)/2,dx,dz,L+0.03,GUIA,0.15,0,0xd6d3cb); });
      andar(q,1.0,(x,z,dx,dz)=>{ if(pertoCruz(x,z,r.w/2+CALCADA+3.5)) t.fecha(); else t.add(x,z,dx,dz,0); }); t.fecha(); } }
}

/* ───────── muros e grades ───────── */
const solidos=[];
let matGrade=null;
function texGrade(){
  const cv=document.createElement('canvas'); cv.width=128; cv.height=128; const k=cv.getContext('2d');
  k.clearRect(0,0,128,128); k.fillStyle='#2b2f33';
  for(let x=4;x<128;x+=16) k.fillRect(x,0,4,128);        // barras a cada 12,5 cm
  k.fillRect(0,6,128,6); k.fillRect(0,116,128,6);        // travessas
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.colorSpace=THREE.SRGBColorSpace; return t;
}
const grades=[];
// o "lote" atrás do muro na verdade é outra pista? (canteiro central de avenida de pista dupla, ou faixa
// espremida entre duas ruas): ponto a menos de meia pista + calçada + folga de outra rua que não 'eu'
function outraRuaPerto(x,z,eu){
  for(const r of ruas){ if(r===eu||r.pe) continue; const b=r.bb, f=r.w/2+CALCADA+2; if(x<b[0]-f||x>b[2]+f||z<b[1]-f||z>b[3]+f) continue;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], c=r.pts[i+1], vx=c[0]-a[0], vz=c[1]-a[1];
      let t=((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t));
      if(Math.hypot(x-a[0]-vx*t,z-a[1]-vz*t)<f) return true; } }
  return false;
}
function muros(lojas){
  const PASSO=1.0;
  for(const r of ruas){ if(r.pe||!COM_CALCADA.has(r.tipo)) continue;
    for(const lado of [1,-1]){ const off=lado*(r.w/2+GUIA+CALCADA+0.12), q=paralela(r.pts,off);
      let lote=0, lim=10+sorte(off,r.w,1)*6, n=0;
      const t=trechos(PASSO,(x0,z0,x1,z1,dx,dz,id)=>{
        const L=Math.hypot(x1-x0,z1-z0), cx=(x0+x1)/2, cz=(z0+z1)/2, nx=-dz, nz=dx;
        const tipo=sorte(id,off,2)<0.6?0:1, cor=[0xe8dfcf,0xd9cbb2,0xe6e2d8,0xcfd8d4,0xead2c0][(sorte(id,off,5)*5)|0];
        if(tipo===0) viga(cx,cz,dx,dz,L+0.02,0.18,1.8,0,cor);              // muro rebocado
        else { viga(cx,cz,dx,dz,L+0.02,0.18,0.55,0,cor); grades.push([cx,cz,dx,dz,L]); }   // mureta + grade
        solidos.push([[x0-nx*0.12,z0-nz*0.12],[x1-nx*0.12,z1-nz*0.12],[x1+nx*0.12,z1+nz*0.12],[x0+nx*0.12,z0+nz*0.12]]);
      });
      andar(q,PASSO,(x,z,dx,dz)=>{
        lote+=PASSO;
        if(lote>lim){ lote=0; lim=10+sorte(x,z,1)*6; n++; }
        const nx=-dz*lado, nz=dx*lado;                                     // para dentro do lote
        const livre = lote<3                                                // vão do portão no começo de cada lote
          || pertoCruz(x,z,r.w/2+CALCADA+5)
          || substituidoPorMarco(x,z,'muro',0)
          || outraRuaPerto(x+nx*3,z+nz*3,r)                                // canteiro central / entre duas ruas
          || ocupado(x,z)||ocupado(x+nx*0.6,z+nz*0.6)                      // prédio colado na calçada
          || lojas.some(l=>Math.abs(l[0]-x)<14&&Math.abs(l[1]-z)<14)       // frente de comércio fica aberta
          || !perto(x+nx*10,z+nz*10,14).some(p=>Math.hypot((p.bb[0]+p.bb[2])/2-x-nx*10,(p.bb[1]+p.bb[3])/2-z-nz*10)<14); // terreno vazio: sem muro
        if(livre) t.fecha(); else t.add(x,z,dx,dz,n);
      }); t.fecha(); } }
  if(grades.length){
    matGrade ??= new THREE.MeshLambertMaterial({map:texGrade(),transparent:false,alphaTest:0.5,side:THREE.DoubleSide});
    const gs=grades.map(([x,z,dx,dz,L])=>{ const g=new THREE.PlaneGeometry(L,1.3); const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setX(i,uv.getX(i)*L);
      M.compose(V.set(x,0.55+0.65,z),Q.setFromEuler(E.set(0,Math.atan2(dx,dz)+Math.PI/2,0)),S); return g.applyMatrix4(M); });
    const g=mergeGeometries(gs,false); gs.forEach(x=>x.dispose()); scene.add(new THREE.Mesh(g,matGrade));
  }
}

/* ───────── quebra-molas ───────── */
export const lombadas=[];   // {x,z,dx,dz,w}  (dx,dz = direção da rua)
function quebraMolas(lugares){
  const alvo=[];
  for(const l of lugares) if(/school|college|place_of_learning|hospital|church|worship|kindergarten|escola|col[eé]gio|creche|igreja|hospital/i.test((l.cat||'')+' '+l.n)) alvo.push(toXZ(l.lat,l.lon));
  for(const r of ruas){ if(r.pe||!['residential','unclassified','living_street'].includes(r.tipo)) continue;    // rua residencial longa
    let L=0; for(let i=0;i<r.pts.length-1;i++) L+=Math.hypot(r.pts[i+1][0]-r.pts[i][0],r.pts[i+1][1]-r.pts[i][1]);
    if(L>260&&sorte(r.pts[0][0],r.pts[0][1],7)<0.6){ let s=0; for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], b=r.pts[i+1], l=Math.hypot(b[0]-a[0],b[1]-a[1]); if(s+l>=L/2){ const t=(L/2-s)/l; alvo.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]); break; } s+=l; } } }
  for(const [x,z] of alvo){
    let melhor=null, md=45;
    for(const r of ruas){ if(r.pe||!COM_CALCADA.has(r.tipo)) continue; const b=r.bb; if(x<b[0]-md||x>b[2]+md||z<b[1]-md||z>b[3]+md) continue;
      for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], c=r.pts[i+1], vx=c[0]-a[0], vz=c[1]-a[1], L2=vx*vx+vz*vz||1; let t=((x-a[0])*vx+(z-a[1])*vz)/L2; t=Math.max(0.15,Math.min(0.85,t));
        const px=a[0]+vx*t, pz=a[1]+vz*t, d=Math.hypot(x-px,z-pz); if(d<md){ const L=Math.sqrt(L2); md=d; melhor={x:px,z:pz,dx:vx/L,dz:vz/L,w:r.w}; } } }
    if(!melhor||pertoCruz(melhor.x,melhor.z,14)||lombadas.some(o=>Math.hypot(o.x-melhor.x,o.z-melhor.z)<50)) continue;
    lombadas.push(melhor);
  }
  // corpo: meio cilindro achatado atravessando a rua, pintado de amarelo e preto
  const cv=document.createElement('canvas'); cv.width=16; cv.height=64; const k=cv.getContext('2d');
  k.fillStyle='#e8b923'; k.fillRect(0,0,16,32); k.fillStyle='#1f2328'; k.fillRect(0,32,16,32);
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace; tex.wrapT=THREE.RepeatWrapping;
  const gs=lombadas.map(o=>{ const g=new THREE.CylinderGeometry(1,1,o.w,16,1,true,0,Math.PI); g.rotateZ(Math.PI/2); g.scale(1,0.1,1.7);   // meia lua para cima, eixo atravessando a rua
    const uv=g.attributes.uv; for(let i=0;i<uv.count;i++) uv.setY(i,uv.getY(i)*o.w/1.2);  // faixa amarela/preta a cada ~60 cm
    M.compose(V.set(o.x,0,o.z),Q.setFromEuler(E.set(0,Math.atan2(o.dx,o.dz),0)),S); return g.applyMatrix4(M); });
  if(gs.length){ const g=mergeGeometries(gs,false); gs.forEach(x=>x.dispose()); const m=new THREE.Mesh(g,new THREE.MeshLambertMaterial({map:tex,color:0xdddddd})); scene.add(m); }
}
// altura do chão no ponto por causa de quebra-mola (0 a 0,1 m)
export function alturaLombada(x,z){
  for(const o of lombadas){ const ax=x-o.x, az=z-o.z; if(Math.abs(ax)>4||Math.abs(az)>4) continue;
    const ao=ax*o.dx+az*o.dz, lat=Math.abs(-ax*o.dz+az*o.dx); if(Math.abs(ao)<1.7&&lat<o.w/2) return 0.1*Math.sqrt(1-(ao/1.7)**2); }
  return 0;
}

export async function construirDetalhes(){
  const casas=predios.filter(p=>!p.marco&&!p.muro);
  indexar(casas); montarCruz();
  let lugares=[];
  try{ lugares=(await (await fetch('dados/lugares.json')).json()).lugares; }catch(e){}
  const lojas=lugares.filter(l=>l.f==='osm'||(l.conf??0)>=0.5).map(l=>toXZ(l.lat,l.lon));
  const nPortas=portas(casas); meioFio(); muros(lojas); quebraMolas(lugares);
  if(pecas.length){ const g=mergeGeometries(pecas,false); pecas.forEach(x=>x.dispose()); scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}))); }
  const bb=pts=>{ let a=1e9,b=1e9,c=-1e9,d=-1e9; for(const p of pts){ a=Math.min(a,p[0]); b=Math.min(b,p[1]); c=Math.max(c,p[0]); d=Math.max(d,p[1]); } return [a,b,c,d]; };
  for(const pts of solidos) predios.push({pts,bb:bb(pts),muro:true});
  return { portas:nPortas, muros:solidos.length, lombadas:lombadas.length };
}
