// Bancos, polícias, prédios públicos e Parque Farroupilha (pedido do Maicon em 17/11).
// Endereços e coordenadas: sites da PMPR e da Polícia Civil do PR + busca de lugares (Firecrawl Maps).
// Bancos com NOME FICTÍCIO (regra do jogo); cor só lembra a da agência. Fachada é modelagem própria
// (sem foto de rua: o Maicon pode mandar foto como referência depois).
// Montado DEPOIS dos terrenos: nada aqui muda a lista de prédios que os terrenos usam. O prédio que ainda
// está de pé ganha a fachada nova por cima (um pouco maior); o que tinha sido tirado (comércio que virou
// terreno) só volta se nenhum terreno ocupar o lugar — senão o lugar fica para o terreno.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from './cena.js';
import { ruas, predios } from './cidade.js';
import { comerciosRemovidos, prediosOcultos } from './predios.js';
import { toXZ } from './geo.js';

export const LUGARES = [
  // bancos (nome fictício)
  { ll:[-25.2402972,-53.9789927], nome:'Banco Nacional do Oeste', tipo:'banco', cor:0xf6c915, faixa:0x1e3a8a, h:7 },   // Av. Duque de Caxias, 867
  { ll:[-25.2410675,-53.9791564], nome:'Banco Laranjeira',        tipo:'banco', cor:0xf3f4f6, faixa:0xea580c, h:7 },   // Av. Borges de Medeiros, 862
  { ll:[-25.2399992,-53.9793886], nome:'Coop. Vale Verde',        tipo:'banco', cor:0xf3f4f6, faixa:0x15803d, h:6.5 }, // Av. Duque de Caxias, 894
  { ll:[-25.2403992,-53.9778865], nome:'Coop. Raiz do Campo',     tipo:'banco', cor:0xf3f4f6, faixa:0x65a30d, h:6.5 }, // Av. Borges de Medeiros, 774
  { ll:[-25.2414132,-53.9789505], nome:'Coop. Confia Mais',       tipo:'banco', cor:0xf3f4f6, faixa:0x0f766e, h:6.5 }, // Av. Borges de Medeiros, 855
  { ll:[-25.2422407,-53.9789534], nome:'Banco Rubi',              tipo:'banco', cor:0xf3f4f6, faixa:0xb91c1c, h:7 },   // Av. Paraná, 835
  // polícias e prédios públicos
  { ll:[-25.2398708,-53.9885635], nome:'POLÍCIA CIVIL · DELEGACIA', tipo:'policia', cor:0xe5e7eb, faixa:0x1f2937, h:5 },   // R. Napoleão Laureano, 764
  { ll:[-25.2408439,-53.9861918], nome:'POLÍCIA MILITAR · 3ª CIA',  tipo:'policia', cor:0xd6d3c4, faixa:0x1d4ed8, h:5 },   // Av. Borges de Medeiros, 1575
  { ll:[-25.2394460,-53.9783280], nome:'CÂMARA MUNICIPAL',          tipo:'publico', cor:0xf1efe6, faixa:0xc9a227, h:7.4 },
  { ll:[-25.2413320,-53.9814490], nome:'FÓRUM',                     tipo:'publico', cor:0xece7da, faixa:0x7c2d12, h:7 },
  { ll:[-25.2416310,-53.9765800], nome:'RODOVIÁRIA',                tipo:'publico', cor:0xf3f4f6, faixa:0x0369a1, h:5.5 },
  { ll:[-25.2395370,-53.9846700], nome:'AGÊNCIA POSTAL',            tipo:'publico', cor:0xf3f4f6, faixa:0xeab308, h:5 },
  { ll:[-25.2409660,-53.9726900], nome:'CIRETRAN',                  tipo:'publico', cor:0xf3f4f6, faixa:0x15803d, h:5 },
];
export const PARQUE = { ll:[-25.2393607,-53.9862555], x0:-641, x1:-531, z0:-134, z1:-25, xMata:-445 };   // xMata: a mata do satélite segue para o leste (só árvores)   // quadra entre R. Alfredo Chaves e R. N. Sra. do Caravaggio, de frente para a Av. Duque de Caxias

const geos=[], placas=[], solidosTarde=[];
function cor(g,c){ if(g.index) g=g.toNonIndexed();                                  // primeiro desindexa: a cor vai em cada vértice
  const n=g.attributes.position.count, a=new Float32Array(n*3), k=new THREE.Color(c); for(let i=0;i<n;i++){ a[i*3]=k.r; a[i*3+1]=k.g; a[i*3+2]=k.b; }
  g.setAttribute('color',new THREE.BufferAttribute(a,3)); g.deleteAttribute('uv'); geos.push(g); return g; }
const caixa=(w,h,d,x,y,z,c,ry=0)=>{ const g=new THREE.BoxGeometry(w,h,d); g.rotateY(ry); g.translate(x,y+h/2,z); return cor(g,c); };
// prisma do contorno (x,z) entre y0 e y1, aumentado em volta do centro (k)
function prisma(pts,y0,y1,c,k=1){
  const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length, cz=pts.reduce((s,p)=>s+p[1],0)/pts.length;
  const sh=new THREE.Shape(pts.map(([x,z])=>new THREE.Vector2(cx+(x-cx)*k, -(cz+(z-cz)*k))));
  const g=new THREE.ExtrudeGeometry(sh,{depth:y1-y0,bevelEnabled:false}); g.rotateX(-Math.PI/2); g.translate(0,y0,0); return cor(g,c);
}
function texPlaca(txt,fundo,frente){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=160; const k=cv.getContext('2d');
  k.fillStyle=fundo; k.fillRect(0,0,1024,160); k.fillStyle=frente; k.textAlign='center'; k.textBaseline='middle';
  let f=96; k.font=`900 ${f}px system-ui,sans-serif`; while(k.measureText(txt).width>960&&f>28){ f-=2; k.font=`900 ${f}px system-ui,sans-serif`; }
  k.fillText(txt,512,84); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
const hex=c=>'#'+new THREE.Color(c).getHexString();
const dentro=(x,z,pts)=>{ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; };
const distSeg=(x,z,a,b)=>{ const vx=b[0]-a[0], vz=b[1]-a[1]; let t=((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t)); return Math.hypot(x-a[0]-vx*t,z-a[1]-vz*t); };
const distPoli=(x,z,pts)=>dentro(x,z,pts)?0:Math.min(...pts.map((a,i)=>distSeg(x,z,a,pts[(i+1)%pts.length])));
const distRua=(x,z)=>{ let m=1e9; for(const r of ruas){ if(r.pe) continue; const b=r.bb; if(x<b[0]-40||x>b[2]+40||z<b[1]-40||z>b[3]+40) continue; for(let i=0;i<r.pts.length-1;i++) m=Math.min(m,distSeg(x,z,r.pts[i],r.pts[i+1])-r.w/2); } return m; };
// o terreno (lote 12×24 ou especial) encosta no contorno?
const tocaLote=(pts,lotes)=>lotes.some(l=>{ const w=l.w||12, d=l.d||24; for(let u=0;u<=w;u+=1.5) for(let v=0;v<=d;v+=1.5){ const x=l.A[0]+l.t[0]*u+l.n[0]*v, z=l.A[1]+l.t[1]*u+l.n[1]*v; if(dentro(x,z,pts)) return true; } return false; });

function predioDe(x,z){
  let m=null, md=9;
  for(const [lista,tirado] of [[predios.filter(p=>!p.marco),false],[comerciosRemovidos,true],[prediosOcultos,true]]) for(const p of lista){
    const b=p.bb; if(x<b[0]-md||x>b[2]+md||z<b[1]-md||z>b[3]+md) continue;
    const d=distPoli(x,z,p.pts); if(d<md){ md=d; m={p,tirado}; } }
  return m;
}

function montar(L,lotes){
  const [x,z]=toXZ(...L.ll), achado=predioDe(x,z);
  if(!achado) return 'sem prédio';
  const {p,tirado}=achado, pts=p.pts;
  if(tirado&&tocaLote(pts,lotes)) return 'virou terreno';
  const h=Math.max(L.h,(p.h||0)+0.4), k=tirado?1:1.04;            // por cima do prédio que ainda está de pé
  prisma(pts,0,h-1.1,L.cor,k); prisma(pts,h-1.1,h,L.faixa,k+0.01); prisma(pts,h,h+0.25,0xd4d4d4,k+0.02);
  // frente: a parede mais perto de uma rua
  let melhor=null;
  pts.forEach((a,i)=>{ const b=pts[(i+1)%pts.length], L2=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L2<3) return; const m=[(a[0]+b[0])/2,(a[1]+b[1])/2], d=distRua(...m)-L2*0.02; if(!melhor||d<melhor.d) melhor={a,b,m,L2,d}; });
  if(melhor){ const {a,b,m,L2}=melhor, cx=pts.reduce((s,q)=>s+q[0],0)/pts.length, cz=pts.reduce((s,q)=>s+q[1],0)/pts.length;
    let nx=-(b[1]-a[1])/L2, nz=(b[0]-a[0])/L2; if((m[0]-cx)*nx+(m[1]-cz)*nz<0){ nx=-nx; nz=-nz; }
    const ry=Math.atan2(nx,nz), off=(tirado?0:Math.max(0.15,distPoli(m[0]+nx*0.01,m[1]+nz*0.01,pts)))+0.12;
    const px=m[0]+nx*(off+(k-1)*Math.hypot(m[0]-cx,m[1]-cz)), pz=m[1]+nz*(off+(k-1)*Math.hypot(m[0]-cx,m[1]-cz));
    const w=Math.min(L2*0.85,12), tex=texPlaca(L.nome.toUpperCase(),hex(L.faixa),L.tipo==='banco'&&L.cor===0xf6c915?'#1e3a8a':'#ffffff');
    const pl=new THREE.Mesh(new THREE.PlaneGeometry(w,1.0),new THREE.MeshBasicMaterial({map:tex})); pl.position.set(px,h-0.55,pz); pl.rotation.y=ry; placas.push(pl);
    caixa(2.0,2.5,0.2,px,0,pz,0x1f2937,ry);                                                       // porta de vidro escuro
    caixa(Math.min(L2*0.7,9),1.4,0.1,px+Math.cos(ry)*0,1.0,pz,0x3b5568,ry);                          // vidraça
    if(L.tipo==='banco'){ const ex=Math.cos(ry), ez=-Math.sin(ry); caixa(0.8,1.7,0.5,px+ex*2.2+nx*0.3,0,pz+ez*2.2+nz*0.3,0x374151,ry); }   // caixa eletrônico
    if(L.tipo==='policia'){ caixa(Math.min(L2*0.85,12),0.3,0.14,px,2.6,pz,L.faixa,ry); }            // faixa na marquise
  }
  if(tirado) solidosTarde.push(pts);
  return 'ok';
}

/* ───────── Parque Farroupilha: bosque com caminho em volta, lago, parquinho, bancos e placa ───────── */
const arvP=[];
function parque(lotes){
  const P=PARQUE, livre=(x,z,f=2)=>!predios.some(p=>{ const b=p.bb; return x>b[0]-f&&x<b[2]+f&&z>b[1]-f&&z<b[3]+f; })
    &&distRua(x,z)>3.5&&!tocaLote([[x-f,z-f],[x+f,z-f],[x+f,z+f],[x-f,z+f]],lotes);
  const cx=(P.x0+P.x1)/2, cz=(P.z0+P.z1)/2+6, rx=(P.x1-P.x0)/2-16, rz=(P.z1-P.z0)/2-18;
  // caminho oval (tijolinho) e lago no meio
  const anel=[]; for(let i=0;i<=48;i++){ const a=i/48*Math.PI*2; anel.push([cx+Math.cos(a)*rx, cz+Math.sin(a)*rz]); }
  for(let i=0;i<48;i++){ const [a,b]=[anel[i],anel[i+1]]; if(!livre(a[0],a[1],0.5)) continue; const L=Math.hypot(b[0]-a[0],b[1]-a[1]);
    const g=new THREE.BoxGeometry(L+0.4,0.06,2.4); g.rotateY(-Math.atan2(b[1]-a[1],b[0]-a[0])); g.translate((a[0]+b[0])/2,0.03,(a[1]+b[1])/2); cor(g,0xb8735a); }
  const lago=new THREE.Mesh(new THREE.CircleGeometry(1,40).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0x2f6f8f}));
  lago.scale.set(rx*0.45,1,rz*0.4); lago.position.set(cx,0.05,cz); placas.push(lago);
  caixa(rx*0.92,0.18,0.5,cx,0,cz-rz*0.4-0.2,0x9ca3af); caixa(rx*0.92,0.18,0.5,cx,0,cz+rz*0.4+0.2,0x9ca3af);
  // parquinho (balanço, escorregador, gira-gira) e bancos ao longo do caminho
  const px=cx-rx*0.62, pz=cz;
  for(const [dx,c] of [[-2,0xdc2626],[2,0x2563eb]]){ caixa(0.15,2.4,0.15,px+dx,0,pz-1,c); caixa(0.15,2.4,0.15,px+dx,0,pz+1,c); }
  caixa(4.3,0.15,0.15,px,2.4,pz-1,0xfacc15); caixa(0.6,0.08,0.4,px-1,0.6,pz-1,0x111827); caixa(0.6,0.08,0.4,px+1,0.6,pz-1,0x111827);
  { const g=new THREE.BoxGeometry(0.8,0.1,3.4); g.rotateX(0.55); g.translate(px+4,1.0,pz+3); cor(g,0xf97316); caixa(1,1.9,1,px+4,0,pz+1.2,0x16a34a); }
  { const g=new THREE.CylinderGeometry(1.4,1.4,0.15,16); g.translate(px-3,0.4,pz+4); cor(g,0xa855f7); }
  for(let i=0;i<48;i+=6){ const [a,b]=[anel[i],anel[i+1]], ang=Math.atan2(b[1]-a[1],b[0]-a[0]), nx=Math.sin(ang), nz=-Math.cos(ang);
    const x=a[0]+nx*2.4, z=a[1]+nz*2.4; if(livre(x,z,0.6)) caixa(1.8,0.5,0.5,x,0,z,0x8b5a2b,-ang); }
  // árvores: bosque fora do caminho e do lago, longe de casa, rua e terreno
  let n=0;
  for(let x=P.x0+5;x<P.xMata-4;x+=7.5) for(let z=P.z0+5;z<P.z1-4;z+=7.5){
    const jx=x+Math.sin(x*12.9+z*7.1)*2.2, jz=z+Math.cos(x*3.7+z*9.3)*2.2, e=((jx-cx)/rx)**2+((jz-cz)/rz)**2;
    if(e>0.78&&e<1.25) continue; if(e<0.3) continue;                        // caminho e lago
    if(!livre(jx,jz,2.2)) continue;
    arvP.push([jx,jz,0.8+Math.abs(Math.sin(jx*jz))*0.5, Math.abs(Math.sin(jx+jz))>0.93?1:0]); n++; }
  // placa na frente (Av. Duque de Caxias)
  const sx=cx, sz=P.z1-3; const pl=new THREE.Mesh(new THREE.PlaneGeometry(7,1.4),new THREE.MeshBasicMaterial({map:texPlaca('PARQUE FARROUPILHA','#14532d','#fef3c7'),side:THREE.DoubleSide}));
  pl.position.set(sx,1.9,sz); placas.push(pl); caixa(0.15,1.2,0.15,sx-3,0,sz,0x6b4f36); caixa(0.15,1.2,0.15,sx+3,0,sz,0x6b4f36);
  return n;
}

// chamado pelo main.js DEPOIS de iniciarTerrenos/iniciarEspeciais
export function iniciarPublicos(lotes){
  const rel={}; for(const L of LUGARES) rel[L.nome]=montar(L,lotes);
  const arv=parque(lotes);
  const g=mergeGeometries(geos,false); geos.forEach(x=>x.dispose());
  if(g) scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true})));
  for(const m of placas) scene.add(m);
  if(arvP.length){ const gT=new THREE.CylinderGeometry(0.22,0.3,3,6).translate(0,1.5,0), gC=new THREE.IcosahedronGeometry(2.6,0).translate(0,4.6,0);
    const t=new THREE.InstancedMesh(gT,new THREE.MeshLambertMaterial({color:0x6b4f36}),arvP.length), c=new THREE.InstancedMesh(gC,new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true}),arvP.length);
    const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), V=new THREE.Vector3(), S=new THREE.Vector3(), C=new THREE.Color();
    arvP.forEach(([x,z,e,k],i)=>{ M.compose(V.set(x,0,z),Q.setFromAxisAngle(new THREE.Vector3(0,1,0),i*1.3),S.set(e,e,e)); t.setMatrixAt(i,M); c.setMatrixAt(i,M); c.setColorAt(i,C.setHex(k?0xe3b31b:0x4b7a36).multiplyScalar(0.9+(i%5)*0.05));
      const p=[]; for(let j=0;j<6;j++){ const a=j/6*Math.PI*2; p.push([x+Math.cos(a)*0.35*e, z+Math.sin(a)*0.35*e]); } solidosTarde.push(p); });
    for(const m of [t,c]){ m.computeBoundingSphere(); scene.add(m); } }
  // colisão: entra em predios[] só agora (os terrenos já foram calculados com a lista antiga)
  const bb=pts=>{ let a=1e9,b=1e9,c=-1e9,d=-1e9; for(const p of pts){ a=Math.min(a,p[0]); b=Math.min(b,p[1]); c=Math.max(c,p[0]); d=Math.max(d,p[1]); } return [a,b,c,d]; };
  for(const pts of solidosTarde) predios.push({pts,bb:bb(pts),marco:true});
  window.__publicos={ ...rel, arvoresParque:arv };   // para o teste (tools/teste/publicos.mjs)
  return { ...rel, arvoresParque:arv };
}
