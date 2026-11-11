// Marcos modelados à mão (em código, formas simples), no lugar do contorno genérico:
// Igreja Matriz, Colégio Estadual Euclides da Cunha, Praça Municipal e Praça Benjamin Luiz Biazus.
// Posição: OpenStreetMap; planta e medidas: vista de cima do satélite (sem Street View),
// então fachadas e alturas são interpretação, não cópia fiel.
// Coordenadas em metros locais (x leste, z sul), as mesmas do resto do jogo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, flat } from './cena.js';

const PRACA_MUNICIPAL = [[-111.7,-94.5],[6.3,-83.1],[-3.5,16.2],[-119.3,6.4]];   // OSM, leisure=park
const PRACA_BIAZUS    = [[-611.0,105.6],[-553.9,111.1],[-560.1,211.4],[-617.6,204.4]];
const IGREJA = { c:[-636,156.5], r:17.5 };              // contorno de 12 lados do Overture, ~37 m de diâmetro
const LOTE_COLEGIO = [-788,-675,85,196];                 // x0,x1,z0,z1 (OSM: amenity=school, desenhado como "prédio")

function dentroPoly(x,z,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }

// Prédio genérico que sai do mapa porque o marco o substitui.
// fonte: 'osm' | 'overture'; A = área em m²
export function substituidoPorMarco(x,z,fonte,A){
  if(Math.hypot(x-IGREJA.c[0],z-IGREJA.c[1])<IGREJA.r+4) return true;
  if(x>=LOTE_COLEGIO[0]&&x<=LOTE_COLEGIO[1]&&z>=LOTE_COLEGIO[2]&&z<=LOTE_COLEGIO[3]) return true;
  if(dentroPoly(x,z,PRACA_MUNICIPAL)) return fonte==='muro' || (fonte==='overture' && A<150);   // quiosques/palco saem; quadra coberta fica; praça sem muro
  if(dentroPoly(x,z,PRACA_BIAZUS)) return true;
  return false;
}

/* ───────── kit de montagem: tudo vira poucas malhas com cor por vértice ───────── */
const geos=[], pisos=[];
const cor = c=>new THREE.Color(c);
function por(g,c){ const n=g.attributes.position.count, a=new Float32Array(n*3), k=cor(c); for(let i=0;i<n;i++){ a[i*3]=k.r; a[i*3+1]=k.g; a[i*3+2]=k.b; } g.setAttribute('color',new THREE.BufferAttribute(a,3)); if(g.index) g=g.toNonIndexed(); g.deleteAttribute('uv'); geos.push(g); return g; }
const M=new THREE.Matrix4(), Qt=new THREE.Quaternion(), E=new THREE.Euler(), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1);
function poe(g,x,y,z,ry=0,c){ M.compose(V.set(x,y,z),Qt.setFromEuler(E.set(0,ry,0)),S); g.applyMatrix4(M); return por(g,c); }
const caixa=(w,h,d,x,y,z,c,ry=0)=>poe(new THREE.BoxGeometry(w,h,d),x,y+h/2,z,ry,c);

// polígonos de colisão que entram em predios[]
const solidos=[];
const ret=(x0,x1,z0,z1)=>solidos.push([[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
function retGirado(cx,cz,w,d,ry){ const c=Math.cos(ry), s=Math.sin(ry), p=[]; for(const [u,v] of [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]]) p.push([cx+u*c+v*s, cz-u*s+v*c]); solidos.push(p); }
function circulo(cx,cz,r,n=24){ const p=[]; for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; p.push([cx+Math.cos(a)*r, cz+Math.sin(a)*r]); } solidos.push(p); }

// piso plano (calçada, caminho): desenhado como o satélite, sem profundidade, por cima dele
const matPiso=new THREE.MeshBasicMaterial(flat({color:0xcfc8b8,side:THREE.DoubleSide}));
function caminho(pts,w){ const h=w/2, pos=[], idx=[]; for(let i=0;i<pts.length;i++){ const a=pts[Math.max(i-1,0)], b=pts[Math.min(i+1,pts.length-1)]; let dx=b[0]-a[0], dz=b[1]-a[1]; const l=Math.hypot(dx,dz)||1; dx/=l; dz/=l; pos.push(pts[i][0]-dz*h,0,pts[i][1]+dx*h, pts[i][0]+dz*h,0,pts[i][1]-dx*h); }
  for(let i=0;i<pts.length-1;i++){ const k=i*2; idx.push(k,k+1,k+2,k+1,k+3,k+2); }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.setIndex(idx); pisos.push(g); }
const elipse=(cx,cz,rx,rz,n=48)=>Array.from({length:n+1},(_,i)=>{ const a=i/n*Math.PI*2; return [cx+Math.cos(a)*rx, cz+Math.sin(a)*rz]; });

// árvore baixa: tronco + duas copas (instanciadas: centenas custam quase nada)
const arvores=[];
const arvore=(x,z,esc=1)=>arvores.push([x,z,esc]);

/* ───────── Igreja Matriz (planta redonda) ───────── */
function igreja(){
  const [cx,cz]=IGREJA.c, R=IGREJA.r, H=12;
  poe(new THREE.CylinderGeometry(R,R,H,36,1,true),cx,H/2,cz,0,0xece4d2);                      // parede
  poe(new THREE.CylinderGeometry(R+0.25,R+0.25,0.9,36,1,true),cx,H-0.45,cz,0,0xd8cdb4);       // cinta no alto
  for(let i=0;i<16;i++){ const a=i/16*Math.PI*2; if(Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))<0.35) continue; // deixa a frente (leste) livre
    caixa(1.3,7,0.25, cx+Math.cos(a)*(R+0.05), 2.2, cz-Math.sin(a)*(R+0.05), 0x5b7fa6, a+Math.PI/2); }   // vitrais
  poe(new THREE.CylinderGeometry(R,R,0.3,36),cx,H-0.15,cz,0,0xd9d6cf);                       // laje sob a cúpula
  const cup=new THREE.SphereGeometry(R+0.8,36,10,0,Math.PI*2,0,Math.PI*0.32); cup.scale(1,0.45,1);
  poe(cup,cx,H-(R+0.8)*0.45*Math.cos(Math.PI*0.32),cz,0,0xd9d6cf);                             // cúpula baixa e clara
  poe(new THREE.CylinderGeometry(2.2,2.6,3,12),cx,H+3.4,cz,0,0xece4d2);                        // lanternim
  poe(new THREE.ConeGeometry(2.6,3.5,12),cx,H+6.6,cz,0,0x9aa3a8);
  caixa(0.35,5,0.35,cx,H+8.3,cz,0xf4efe2); caixa(2.6,0.35,0.35,cx,H+11.3,cz,0xf4efe2);         // cruz
  // pórtico de entrada, virado para a Praça Biazus (leste)
  const px=cx+R+3.2;
  caixa(7,0.5,11,px,4.6,cz,0xd8cdb4); for(const dz of [-4.6,-1.6,1.6,4.6]) caixa(0.7,4.6,0.7,px+3,0,cz+dz,0xf1ece0);
  caixa(0.3,4.2,4,cx+R+0.1,0,cz,0x6b4a33);                                                     // porta de madeira
  caixa(8,0.25,13,px,0,cz,0xbdb5a5);                                                           // degrau
  circulo(cx,cz,R+0.3);
  for(const dz of [-4.6,-1.6,1.6,4.6]) retGirado(px+3,cz+dz,0.8,0.8,0);
}

/* ───────── Colégio Estadual Euclides da Cunha ───────── */
// blocos medidos na vista de cima: [x0,x1,z0,z1, andares, telhado]
const BLOCOS = [
  [-760,-740, 97,131, 2,'fibro'], [-775,-762,102,122, 1,'fibro'], [-773,-735,139,154, 2,'fibro'],
  [-762,-747,154,188, 1,'fibro'], [-780,-763,169,186, 1,'ceramica'], [-711,-695,101,111, 1,'fibro'],
];
function bloco(x0,x1,z0,z1,and,telhado){
  const w=x1-x0, d=z1-z0, cx=(x0+x1)/2, cz=(z0+z1)/2, H=and*3.4+0.6;
  caixa(w,H,d,cx,0,cz,0xeee6cf);
  caixa(w+0.1,0.9,d+0.1,cx,0,cz,0x6d8fb3);                                        // barrado
  for(let a=0;a<and;a++){ const y=a*3.4+1.5;                                       // faixas de janela nas faces compridas
    if(w>=d){ caixa(w-2,1.3,d+0.12,cx,y,cz,0x3d4f63); } else { caixa(w+0.12,1.3,d-2,cx,y,cz,0x3d4f63); } }
  const comp=Math.max(w,d), larg=Math.min(w,d), alt=Math.min(larg*0.22,2.2), ry=w>=d?0:Math.PI/2;
  const t=new THREE.CylinderGeometry(0.01,(larg/2+0.6)*Math.SQRT2,alt,4,1); t.rotateY(Math.PI/4); // pirâmide de 4 lados…
  t.scale((comp+1.2)/(larg+1.2),1,1);                                               // …esticada = 4 águas
  poe(t,cx,H+alt/2,cz,ry,telhado==='ceramica'?0xab5a3c:0x9da2a3);
  ret(x0,x1,z0,z1);
}
function colegio(){
  for(const b of BLOCOS) bloco(...b);
  // ginásio de esportes do CEEC: paredes + cobertura em arco
  const [x0,x1,z0,z1]=[-708,-680,148,192], w=x1-x0, cx=(x0+x1)/2, cz=(z0+z1)/2, H=8;
  caixa(w,H,z1-z0,cx,0,cz,0xe2dccb); caixa(w+0.1,1,z1-z0+0.1,cx,0,cz,0x6d8fb3);
  caixa(w+0.12,1.2,z1-z0-4,cx,H-2,cz,0x8a96a3);                                   // venezianas altas
  const arco=new THREE.CylinderGeometry(w/2+0.6,w/2+0.6,z1-z0+1,24,1,true,-Math.PI/2,Math.PI); arco.rotateX(-Math.PI/2); arco.scale(1,0.32,1);
  poe(arco,cx,H,cz,0,0xc9cdd0);
  ret(x0,x1,z0,z1);
  // muro do lote com portão na Rua Napoleão Laureano (sul)
  const [L0,L1,M0,M1]=LOTE_COLEGIO, h=1.9, e=0.25, portao=[-752,-740];
  caixa(L1-L0,h,e,(L0+L1)/2,0,M0,0xd9d2bf); ret(L0,L1,M0-e,M0+e);
  caixa(e,h,M1-M0,L0,0,(M0+M1)/2,0xd9d2bf); ret(L0-e,L0+e,M0,M1);
  caixa(e,h,M1-M0,L1,0,(M0+M1)/2,0xd9d2bf); ret(L1-e,L1+e,M0,M1);
  caixa(portao[0]-L0,h,e,(L0+portao[0])/2,0,M1,0xd9d2bf); ret(L0,portao[0],M1-e,M1+e);
  caixa(L1-portao[1],h,e,(portao[1]+L1)/2,0,M1,0xd9d2bf); ret(portao[1],L1,M1-e,M1+e);
  // placa
  for(const dx of [-3,3]) caixa(0.25,3.2,0.25,(portao[0]+portao[1])/2+dx+8,0,M1+2,0x4b5563);
  placa('COLÉGIO ESTADUAL', 'EUCLIDES DA CUNHA', (portao[0]+portao[1])/2+8, 3.6, M1+2.15);
  caminho([[(portao[0]+portao[1])/2,M1],[(portao[0]+portao[1])/2,154]],5);
  for(let i=0;i<7;i++) arvore(-725+((i*37)%30), 120+((i*53)%60), 0.9+((i*7)%3)*0.15);
}
const placas=[];
function placa(l1,l2,x,y,z){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=256; const k=cv.getContext('2d');
  k.fillStyle='#1f5f8b'; k.fillRect(0,0,1024,256); k.strokeStyle='#fff'; k.lineWidth=10; k.strokeRect(14,14,996,228);
  k.fillStyle='#fff'; k.textAlign='center'; k.font='bold 70px system-ui,sans-serif'; k.fillText(l1,512,108); k.font='bold 84px system-ui,sans-serif'; k.fillText(l2,512,204);
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=4;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(7.2,1.8),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
  m.position.set(x,y,z); placas.push(m);
}

/* ───────── Praça Municipal: oval, anfiteatro e concha acústica ───────── */
function pracaMunicipal(ruaLonge){
  const C=[-55,-34], RX=28, RZ=40;
  caminho(elipse(C[0],C[1],RX,RZ),3.2);
  caminho(elipse(C[0],C[1],RX*0.45,RZ*0.45),2.4);
  for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]) caminho([[C[0]+Math.cos(a)*RX*0.45,C[1]+Math.sin(a)*RZ*0.45],[C[0]+Math.cos(a)*RX,C[1]+Math.sin(a)*RZ]],2.2);
  // palco + concha (abre para o norte, para a arquibancada)
  const P=[-57.5,-1.5];
  caixa(10,1,7,P[0],0,P[1],0xe9e4d8); ret(P[0]-5,P[0]+5,P[1]-3.5,P[1]+3.5);
  const concha=new THREE.SphereGeometry(7,24,10,0,Math.PI,0,Math.PI/2); concha.scale(1,1.05,0.8);
  const mc=new THREE.Mesh(concha,new THREE.MeshLambertMaterial({color:0xf4f1ea,side:THREE.DoubleSide})); mc.position.set(P[0],1,P[1]+1.2); scene.add(mc);
  // arquibancada em degraus, semicírculo ao norte do palco
  const R0=7, passos=6, larg=1.7, sobe=0.42, ab=0.42*Math.PI;                 // ±75° em volta do norte
  for(let i=0;i<passos;i++){ const r0=R0+i*larg, r1=r0+larg, h=(i+1)*sobe;      // um degrau por vez, tons alternados
    const perfil=[new THREE.Vector2(r0,0),new THREE.Vector2(r0,h),new THREE.Vector2(r1,h),new THREE.Vector2(r1,0)];
    poe(new THREE.LatheGeometry(perfil,24,Math.PI-ab,ab*2),P[0],0,P[1],0,i%2?0xb3ab9b:0xcdc6b6); }
  const anel=[]; for(let i=0;i<=12;i++){ const a=Math.PI-ab+i/12*ab*2; anel.push([P[0]+Math.sin(a)*(R0+passos*larg),P[1]+Math.cos(a)*(R0+passos*larg)]); }
  for(let i=12;i>=0;i--){ const a=Math.PI-ab+i/12*ab*2; anel.push([P[0]+Math.sin(a)*R0,P[1]+Math.cos(a)*R0]); }
  solidos.push(anel);
  // bancos e postes no anel
  for(let i=0;i<14;i++){ const a=i/14*Math.PI*2+0.2, x=C[0]+Math.cos(a)*(RX-2.6), z=C[1]+Math.sin(a)*(RZ-2.6);
    if(Math.hypot(x-P[0],z-P[1])<R0+passos*larg+2) continue;
    const ry=Math.atan2(-RZ*Math.cos(a), -RX*Math.sin(a)); // banco ao longo do anel
    caixa(1.8,0.45,0.5,x,0,z,0x7a5a3a,ry); caixa(1.8,0.12,0.6,x,0.45,z,0x8b6a48,ry);
    if(i%2===0){ caixa(0.14,4,0.14,x,0,z,0x374151); caixa(0.5,0.25,0.5,x,4,z,0xfff3c4); } }
  // árvores: em volta do anel e no lado leste
  for(let i=0;i<22;i++){ const a=i/22*Math.PI*2, x=C[0]+Math.cos(a)*(RX+4), z=C[1]+Math.sin(a)*(RZ+4); if(z>-6&&Math.abs(x-P[0])<16) continue; if(!ruaLonge(x,z)) continue; arvore(x,z,1+(i%3)*0.15); }
  for(let i=0;i<10;i++){ const x=-18+(i%3)*7+((i*13)%5), z=-78+Math.floor(i/3)*20+((i*7)%6); if(ruaLonge(x,z)&&dentroPoly(x,z,PRACA_MUNICIPAL)) arvore(x,z,1.2); }
}

/* ───────── Praça Benjamin Luiz Biazus (em frente à igreja) ───────── */
function pracaBiazus(ruaLonge){
  const [a,b,c,d]=PRACA_BIAZUS;
  caminho([a,c],3); caminho([b,d],3);
  const meio=[(a[0]+c[0])/2,(a[1]+c[1])/2];
  caminho([[IGREJA.c[0]+IGREJA.r+7,IGREJA.c[1]],meio],4);                          // da porta da igreja ao centro
  for(let i=0;i<18;i++){ const u=0.12+((i*0.37)%0.76), v=0.12+((i*0.61)%0.76);
    const x=a[0]+(b[0]-a[0])*u+(d[0]-a[0])*v, z=a[1]+(b[1]-a[1])*u+(d[1]-a[1])*v;
    if(Math.abs(u-v)<0.12||Math.abs(u+v-1)<0.12) continue;                          // não plantar no caminho
    if(ruaLonge(x,z)) arvore(x,z,1.15+(i%4)*0.12); }
}

export function construirMarcos(predios, ruaLonge){
  igreja(); colegio(); pracaMunicipal(ruaLonge); pracaBiazus(ruaLonge);
  const g=mergeGeometries(geos,false); geos.forEach(x=>x.dispose());
  if(g) scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
  if(pisos.length){ const p=mergeGeometries(pisos,false); const m=new THREE.Mesh(p,matPiso); m.renderOrder=-7; m.frustumCulled=false; scene.add(m); }
  for(const m of placas) scene.add(m);
  // árvores instanciadas
  if(arvores.length){
    const tronco=new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22,0.3,3,6).translate(0,1.5,0),new THREE.MeshLambertMaterial({color:0x6b4f36}),arvores.length);
    const copa=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(2.6,0).translate(0,4.6,0),new THREE.MeshLambertMaterial({color:0x4f7a3a,flatShading:true}),arvores.length);
    const copa2=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1.9,0).translate(0.9,6.0,-0.4),new THREE.MeshLambertMaterial({color:0x5f8c44,flatShading:true}),arvores.length);
    arvores.forEach(([x,z,e],i)=>{ M.compose(V.set(x,0,z),Qt.setFromEuler(E.set(0,i*1.7,0)),S.set(e,e,e)); tronco.setMatrixAt(i,M); copa.setMatrixAt(i,M); copa2.setMatrixAt(i,M); S.set(1,1,1);
      const p=[]; for(let k=0;k<6;k++){ const a=k/6*Math.PI*2; p.push([x+Math.cos(a)*0.35*e, z+Math.sin(a)*0.35*e]); } solidos.push(p); });
    scene.add(tronco,copa,copa2);
  }
  const bb=pts=>{ let a=1e9,b=1e9,c=-1e9,d=-1e9; for(const p of pts){ a=Math.min(a,p[0]); b=Math.min(b,p[1]); c=Math.max(c,p[0]); d=Math.max(d,p[1]); } return [a,b,c,d]; };
  for(const pts of solidos) predios.push({pts,bb:bb(pts),marco:true});
  return { arvores:arvores.length, solidos:solidos.length };
}
