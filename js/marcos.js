// Marcos modelados à mão (em código, formas simples), no lugar do contorno genérico:
// Igreja Matriz, Colégio Estadual Euclides da Cunha, Praça Municipal e Praça Benjamin Luiz Biazus.
// Posição: OpenStreetMap; planta e medidas: vista de cima do satélite (sem Street View),
// então fachadas e alturas são interpretação, não cópia fiel.
// Coordenadas em metros locais (x leste, z sul), as mesmas do resto do jogo.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, flat } from './cena.js';
import { ruas } from './cidade.js';
import { prediosOcultos } from './predios.js';

const PRACA_MUNICIPAL = [[-111.7,-94.5],[6.3,-83.1],[-3.5,16.2],[-119.3,6.4]];   // OSM, leisure=park
const PRACA_BIAZUS    = [[-611.0,105.6],[-553.9,111.1],[-560.1,211.4],[-617.6,204.4]];
const IGREJA = { c:[-636,156.5], r:17.5 };              // contorno de 12 lados do Overture, ~37 m de diâmetro
const LOTE_COLEGIO = [-788,-675,85,196];                 // x0,x1,z0,z1 (OSM: amenity=school, desenhado como "prédio")
const PREFEITURA = [[255.8,-22.1],[247.7,40.0],[289.1,44.4],[294.6,-19.3]];
// Cemitério Municipal: quadra entre R. Souza Naves (N), R. Munhoz da Rocha (L), Av. Vital Brasil (S) e R. Lino Dal Pozzo (O),
// pelos cruzamentos do OSM. Os túmulos vinham do Overture como dezenas de "casinhas" com janela (21/11, fotos do Maicon)
const CEMITERIO = [[-1297,418],[-1178,425],[-1189,545],[-1304,532]];   // OSM amenity=townhall (contorno do terreno inteiro)
// prédios do OSM que o marco substitui mas que os terrenos continuam enxergando (para nenhum terreno mudar de lugar)
export const ocultosMarcos = [];

function dentroPoly(x,z,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }

// Prédio genérico que sai do mapa porque o marco o substitui.
// fonte: 'osm' | 'overture'; A = área em m²
export function substituidoPorMarco(x,z,fonte,A){
  if(dentroPoly(x,z,PREFEITURA)) return fonte==='osm'?'oculto':true;
  if(dentroPoly(x,z,CEMITERIO)) return fonte==='osm'?'oculto':true;
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
export const arvores=[];
const arvore=(x,z,esc=1,cor=0)=>arvores.push([x,z,esc,cor]);   // cor: 0 verde · 1 ipê-amarelo · 2 ipê-roxo

/* ───────── Igreja Matriz (planta redonda) ───────── */
function igreja(){
  // Paróquia Nossa Senhora de Caravaggio (Igreja Matriz). Forma/cor/posição pela referência do
  // Maicon (só para ter noção; modelagem própria): corpo arredondado claro, faixa verde-escura no
  // alto com o nome, janelas em arco, entrada com marquise virada para o oeste (R. Alfredo Chaves),
  // sem torre; cruz branca alta solta à frente e cruz azul menor do outro lado.
  const [cx,cz]=IGREJA.c, R=IGREJA.r, H=10.5, PAREDE=0xe3eee6, VERDE=0x2c5a4a, CLARO=0xf2f4ef;
  poe(new THREE.CylinderGeometry(R,R,H,40,1,true),cx,H/2,cz,0,PAREDE);                        // parede
  poe(new THREE.CylinderGeometry(R+0.15,R+0.15,0.7,40,1,true),cx,0.35,cz,0,0xc9d3cc);         // rodapé
  poe(new THREE.CylinderGeometry(R+0.35,R+0.35,2.4,40,1,true),cx,H+1.2,cz,0,VERDE);           // faixa verde-escura no alto
  for(let i=0;i<22;i++){ const a=i/22*Math.PI*2; if(Math.abs(Math.atan2(Math.sin(a),Math.cos(a))-Math.PI)<0.42||Math.abs(Math.atan2(Math.sin(a),Math.cos(a))+Math.PI)<0.42) continue;   // frente (oeste) fica para a entrada
    const wx=cx+Math.cos(a)*(R+0.06), wz=cz-Math.sin(a)*(R+0.06), ry=a+Math.PI/2;
    caixa(1.3,5.4,0.22,wx,1.6,wz,0x4c6f9a,ry);                                                 // vitral
    poe(new THREE.CylinderGeometry(0.65,0.65,0.22,16,1,false,0,Math.PI).rotateX(Math.PI/2).rotateZ(Math.PI/2),wx,7,wz,ry,0x4c6f9a);   // arco
    caixa(1.6,0.2,0.3,wx,1.5,wz,CLARO,ry);
    const b=a+Math.PI/22; caixa(0.45,H-0.6,0.28,cx+Math.cos(b)*(R+0.1),0.6,cz-Math.sin(b)*(R+0.1),CLARO,b+Math.PI/2); }   // pilastras claras
  poe(new THREE.CylinderGeometry(R+0.3,R+0.3,0.3,40),cx,H+2.25,cz,0,0x55605c);               // laje
  const cup=new THREE.SphereGeometry(R+0.3,40,8,0,Math.PI*2,0,Math.PI*0.22); cup.scale(1,0.35,1);
  poe(cup,cx,H+2.4-(R+0.3)*0.35*Math.cos(Math.PI*0.22),cz,0,0x6f7a76);                        // cobertura baixa
  // entrada (oeste): fachada reta, marquise bege e portas de vidro
  const fx=cx-R+0.6;
  caixa(1.4,H,16,fx,0,cz,PAREDE); caixa(1.6,2.4,16.4,fx,H,cz,VERDE);
  caixa(4.2,0.45,12,fx-2.6,4.3,cz,0xd9b98a);                                                   // marquise
  for(const dz of [-5.4,-1.8,1.8,5.4]) caixa(0.45,4.3,0.45,fx-4.4,0,cz+dz,CLARO);
  for(const dz of [-3.6,0,3.6]) caixa(0.2,3.2,2.4,fx-0.72,0,cz+dz,0x5f7f9a);                   // portas de vidro
  caixa(0.7,1.5,0.7,fx-1.2,H+0.35,cz,0xf0ede4); caixa(1.1,0.25,1.1,fx-1.2,H+0.1,cz,0xe0dccf);   // imagem da santa no vão da faixa
  caixa(6,0.3,15,fx-3.5,0,cz,0xbdb5a5);                                                        // degraus
  letreiro('IGREJA MATRIZ','Nsa. Sra. de Caravaggio',fx-0.85,H+1.2,cz,-Math.PI/2);
  // cruzes soltas: branca alta à esquerda de quem chega, azul menor à direita
  const k1=[fx-9,cz-11], k2=[fx-7,cz+12];
  caixa(0.7,17,0.7,k1[0],0,k1[1],0xf4f4ef); caixa(0.7,0.7,5,k1[0],13.2,k1[1],0xf4f4ef); caixa(1.6,0.6,1.6,k1[0],0,k1[1],0xd6d3cb);
  caixa(0.45,8,0.45,k2[0],0,k2[1],0x2f5fb3); caixa(0.45,0.45,3,k2[0],6,k2[1],0x2f5fb3);
  retGirado(k1[0],k1[1],0.8,0.8,0); retGirado(k2[0],k2[1],0.5,0.5,0);
  circulo(cx,cz,R+0.3); ret(fx-0.8,fx+0.8,cz-8,cz+8);
  for(const dz of [-5.4,-1.8,1.8,5.4]) retGirado(fx-4.4,cz+dz,0.5,0.5,0);
}
// faixa com o nome da igreja na fachada (verde-escuro, letras claras)
function letreiro(l1,l2,x,y,z,ry){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=160; const k=cv.getContext('2d');
  k.fillStyle='#2c5a4a'; k.fillRect(0,0,1024,160); k.fillStyle='#e9e3c8'; k.textBaseline='middle';
  // dois textos, um de cada lado, com vão no meio para a imagem da santa
  const cabe=(t,peso,max)=>{ let f=64; k.font=`italic ${peso} ${f}px Georgia,serif`; while(k.measureText(t).width>max&&f>24){ f-=2; k.font=`italic ${peso} ${f}px Georgia,serif`; } };
  cabe(l1,700,400); k.textAlign='left'; k.fillText(l1,24,80);
  cabe(l2,600,400); k.textAlign='right'; k.fillText(l2,1000,82);
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(15,2.2),new THREE.MeshBasicMaterial({map:tex})); m.position.set(x,y,z); m.rotation.y=ry; placas.push(m);
}

/* ───────── Prefeitura Municipal (pedido do Maicon em 17/11) ─────────
   Forma, cor e posição pela foto que ele mandou (só referência; modelagem própria): prédio comprido de
   3 andares, corpo creme, pilares e vigas amarelos, faixas de janelas com parapeito branco, rampa com
   corrimão na frente, gramado, três mastros com bandeiras e a torre de antena atrás. Frente para a
   Rua Rui Barbosa (leste). Eixos: s = comprimento (norte), q = profundidade (leste = frente). */
function prefeitura(){
  const C=[271.8,10.75], N=[0.086,-0.996], E=[0.996,0.086], ry=Math.atan2(N[0],N[1]);
  const W=([q,s])=>[C[0]+E[0]*q+N[0]*s, C[1]+E[1]*q+N[1]*s];
  const bx=(q0,q1,s0,s1,y0,y1,c)=>{ const [x,z]=W([(q0+q1)/2,(s0+s1)/2]); caixa(Math.abs(q1-q0),y1-y0,Math.abs(s1-s0),x,y0,z,c,ry); };
  const CREME=0xe8dfb8, AMARELO=0xd9c35f, BRANCO=0xf3f0e4, VIDRO=0x3b4f63, CINZA=0x8e9196, LAJE=0xd6d1c2;
  const Q0=-19, Q1=-3, S0=-26, S1=26, AND=3.6, H=AND*3;
  bx(Q0,Q1,S0,S1,0,0.6,CINZA);                                         // base
  bx(Q0+0.4,Q1-0.4,S0+0.4,S1-0.4,0.6,H,CREME);                         // corpo
  for(let f=0;f<3;f++){ const y=f*AND;
    for(const [qa,qb] of [[Q1-0.45,Q1-0.3],[Q0+0.3,Q0+0.45]]) bx(qa,qb,S0+0.6,S1-0.6,y+1.05,y+3.0,VIDRO);   // janelas da frente e do fundo
    bx(Q1-0.3,Q1+0.15,S0+0.6,S1-0.6,y+0.15,y+1.05,BRANCO);             // parapeito branco (frente)
    bx(Q1-0.4,Q1+0.5,S0,S1,y+3.25,y+AND,AMARELO);                      // viga amarela
    for(const s0 of [S0-0.45,S1-0.15]) bx(Q0+2,Q1-2,s0,s0+0.6,y+1.2,y+2.9,VIDRO); }   // janelas das pontas
  for(let s=S0;s<=S1+0.01;s+=6.5) bx(Q1-0.45,Q1+0.65,s-0.45,s+0.45,0,H+0.6,AMARELO);   // pilares
  bx(Q0-0.4,Q1+0.9,S0-0.8,S1+0.8,H,H+0.45,LAJE); bx(Q0-0.4,Q1+0.9,S0-0.8,S1+0.8,H+0.45,H+0.9,BRANCO);   // laje e platibanda
  // entrada: portas de vidro e marquise
  bx(Q1+0.1,Q1+0.3,-3.2,3.2,0.6,3.1,0x22303d); bx(Q1,Q1+3.2,-4,4,3.1,3.35,BRANCO);
  for(const s of [-3.8,3.8]) bx(Q1+2.9,Q1+3.15,s-0.12,s+0.12,0.6,3.1,CINZA);
  // rampa até a porta (em degraus suaves) com corrimão
  for(let i=0;i<8;i++){ const s0=-22+i*2.3; bx(Q1+0.9,Q1+2.8,s0,s0+2.3,0,0.08+i*0.07,0xbab3a2); }
  bx(Q1+0.9,Q1+2.8,-3.6,3.6,0,0.6,0xbab3a2);
  for(let s=-22;s<=-4;s+=2) bx(Q1+2.8,Q1+2.9,s-0.04,s+0.04,0,1.2+(s+22)*0.03,0xc9ccd0);
  bx(Q1+2.78,Q1+2.92,-22,-4,1.15,1.25,0xc9ccd0);
  // mastros e bandeiras (cores simples: verde/amarelo, verde/branco e vermelho/amarelo)
  [[0x16a34a,0xfacc15],[0x15803d,0xf8fafc],[0xdc2626,0xfacc15]].forEach(([a,b],i)=>{ const s=-24+i*2.6, q=15;
    bx(q-0.07,q+0.07,s-0.07,s+0.07,0,9,0xd1d5db); bx(q-0.03,q+0.03,s+0.1,s+1.9,7.2,8.0,a); bx(q-0.03,q+0.03,s+0.1,s+1.9,8.0,8.8,b); });
  // torre de antena atrás (treliça simplificada, faixas vermelhas e brancas)
  { const q=-13, s=8; for(let k=0;k<8;k++) bx(q-0.35,q+0.35,s-0.35,s+0.35,H+0.9+k*3,H+0.9+(k+1)*3,k%2?0xf8fafc:0xdc2626);
    bx(q-1.4,q+1.4,s-0.06,s+0.06,H+18,H+18.2,0x9ca3af); bx(q-0.06,q+0.06,s-1.4,s+1.4,H+22,H+22.2,0x9ca3af); }
  // caminho de tijolinho da rua até a rampa
  caminho([W([19,-12]),W([10,-15]),W([4.5,-21])],1.8);
  // placa com o nome, no gramado
  placa('PREFEITURA MUNICIPAL','DE MATELÂNDIA',...(([x,z])=>[x,1.9,z])(W([16,4])));
  { const m=placas[placas.length-1]; const [x,z]=W([16,4]); m.position.set(x,1.9,z); m.rotation.y=Math.atan2(E[0],E[1]);
    for(const d of [-3,3]) bx(16-0.08,16+0.08,4+d-0.08,4+d+0.08,0,1.0,0x6b7280); }
  // colisão: o prédio (o resto é gramado)
  const [cx,cz]=W([(Q0+Q1)/2,0]); retGirado(cx,cz,Q1-Q0+1,S1-S0+1,ry);
}

/* ───────── Colégio Estadual Euclides da Cunha ───────── */
// blocos medidos na vista de cima: [x0,x1,z0,z1, andares, telhado]
const BLOCOS = [
  [-760,-740, 97,131, 2,'fibro'], [-775,-762,102,122, 1,'fibro'], [-773,-735,139,154, 2,'fibro'],
  [-762,-747,154,188, 1,'fibro'], [-780,-763,169,186, 1,'ceramica'], [-711,-695,101,111, 1,'fibro'],
];
function bloco(x0,x1,z0,z1,and,telhado){
  const w=x1-x0, d=z1-z0, cx=(x0+x1)/2, cz=(z0+z1)/2, H=and*3.4+0.6;
  caixa(w,H,d,cx,0,cz,0xf4f4f1);                                                   // branco
  caixa(w+0.1,0.9,d+0.1,cx,0,cz,0x2f5f9e);                                        // barrado azul
  for(let a=0;a<and;a++){ const y=a*3.4+1.5;                                       // faixas de janela nas faces compridas
    if(w>=d){ caixa(w-2,1.3,d+0.12,cx,y,cz,0x3d4f63); } else { caixa(w+0.12,1.3,d-2,cx,y,cz,0x3d4f63); } }
  const comp=Math.max(w,d), larg=Math.min(w,d), alt=Math.min(larg*0.22,2.2), ry=w>=d?0:Math.PI/2;
  const t=new THREE.CylinderGeometry(0.01,(larg/2+0.6)*Math.SQRT2,alt,4,1); t.rotateY(Math.PI/4); // pirâmide de 4 lados…
  t.scale((comp+1.2)/(larg+1.2),1,1);                                               // …esticada = 4 águas
  poe(t,cx,H+alt/2,cz,ry,telhado==='ceramica'?0xb05a3a:0x8fa0b4);
  ret(x0,x1,z0,z1);
}
// grade branca sobre mureta, com pilar a cada 2,5 m (como a da frente do colégio)
function gradeBranca(xa,za,xb,zb,L,ry){
  const BR=0xf3f3ef, cx=(xa+xb)/2, cz=(za+zb)/2, at=(t,y,w,hh,d)=>caixa(w,hh,d,xa+(xb-xa)*t,y,za+(zb-za)*t,BR,-ry);
  caixa(L,0.6,0.22,cx,0,cz,BR,-ry);                                                  // mureta
  caixa(L,0.06,0.06,cx,0.95,cz,BR,-ry); caixa(L,0.08,0.08,cx,2.15,cz,BR,-ry);        // travessas
  for(let s=0;s<=L;s+=0.16) at(s/L,0.6,0.035,1.6,0.035);                             // barras
  for(let s=0;s<=L;s+=2.5) at(s/L,0,0.3,2.35,0.3);                                    // pilares
  if(Math.abs(xb-xa)>Math.abs(zb-za)) ret(Math.min(xa,xb),Math.max(xa,xb),za-0.15,za+0.15); else ret(xa-0.15,xa+0.15,Math.min(za,zb),Math.max(za,zb));
}
// palmeira: tronco fino e 9 folhas compridas caindo em arco
function palmeira(x,z,h){
  const t=new THREE.CylinderGeometry(0.13,0.2,h,6); poe(t,x,h/2,z,0,0x9a8f7c);
  for(let k=0;k<9;k++){ const a=k/9*Math.PI*2+x;
    for(const [l0,l1,y0,dr] of [[0,1.5,0,0.25],[1.4,2.9,-0.33,0.75]]){                 // folha em 2 pedaços: sobe e cai
      const g=new THREE.BoxGeometry(0.55,0.04,l1-l0); g.translate(0,0,(l1-l0)/2); g.rotateX(dr); g.translate(0,y0,l0*Math.cos(0.25)); g.rotateY(a);
      g.translate(x,h,z); por(g,k%2?0x4f7f2a:0x5d8f33); } }
  circulo(x,z,0.25,8);
}
// bloco da esquina (Napoleão Laureano × Av. Paraná): fachada oeste com placas cinza-claras e frisos,
// janelas de moldura azul com painel branco e faixa vermelha, portão cinza escuro e placa de proibido estacionar
function fachadaEsquina(xf,z0,z1,xRua){
  const W=z1-z0, cz=(z0+z1)/2, H=3.4+0.6;
  caixa(0.08,H-0.9,W,xf-0.04,0.9,cz,0xcfcac0);                                        // revestimento (o barrado azul fica embaixo)
  for(let y=1.6;y<H;y+=0.7) caixa(0.1,0.04,W,xf-0.05,y,cz,0xa9a49a);                   // frisos
  for(const zj of [z0+2.2,z0+4.8,z0+7.4]){ caixa(0.12,1.7,1.7,xf-0.07,1.15,zj,0x1d4fa8);
    caixa(0.14,1.3,1.3,xf-0.08,1.35,zj,0xf5f5f5); caixa(0.15,0.3,1.3,xf-0.09,1.85,zj,0xc0262d); }
  caixa(0.16,2.9,3.4,xf-0.08,0,z1-3.2,0x4b5058);                                       // portão
  const px=xRua+0.9, pz=z1-6; caixa(0.07,2.3,0.07,px,0,pz,0x6b7280);                   // placa no gramado, junto da grade
  const disco=(r,d,cor,dx)=>{ const g=new THREE.CylinderGeometry(r,r,d,20); g.rotateZ(Math.PI/2); poe(g,px+dx,2.45,pz,0,cor); };
  disco(0.34,0.03,0xc0262d,-0.05); disco(0.27,0.035,0x2557b8,-0.06);
  const traco=new THREE.BoxGeometry(0.04,0.06,0.5); traco.rotateX(Math.PI/4); poe(traco,px-0.09,2.45,pz,0,0xc0262d);
}
function colegio(ruaLonge){
  for(const b of BLOCOS) bloco(...b);
  // ginásio de esportes do CEEC: paredes + cobertura em arco
  const [x0,x1,z0,z1]=[-708,-680,148,192], w=x1-x0, cx=(x0+x1)/2, cz=(z0+z1)/2, H=8;
  caixa(w,H,z1-z0,cx,0,cz,0xa7adb3); caixa(w+0.1,1.2,z1-z0+0.1,cx,0,cz,0xc9c6bd);   // chapa metálica cinza sobre base de concreto
  caixa(w+0.12,1.4,z1-z0-4,cx,H-2.2,cz,0x6f7a86);                                  // faixa de ventilação no alto
  const arco=new THREE.CylinderGeometry(w/2+0.6,w/2+0.6,z1-z0+1,24,1,true,-Math.PI/2,Math.PI); arco.rotateX(-Math.PI/2); arco.scale(1,0.32,1);
  poe(arco,cx,H,cz,0,0x2f63a8);                                                     // cobertura azul
  mural(x1+0.08,cz,z1-z0-2,H-2.6,Math.PI/2); mural(cx,z1+0.08,w-2,H-2.6,0);          // mural nas faces da esquina
  ret(x0,x1,z0,z1);
  // muro do lote com portão na Rua Napoleão Laureano (sul)
  // o retângulo do lote no OSM invade a rua: cada lado recua até sair da pista + calçada (3,3 m da beira)
  let [L0,L1,M0,M1]=LOTE_COLEGIO; const livre=(x,z)=>ruaLonge(x,z,3.3);
  for(let k=0;k<40&&!(livre(L0,(M0+M1)/2)&&livre(L0,M0+8)&&livre(L0,M1-8));k++) L0+=0.5;
  for(let k=0;k<40&&!(livre(L1,(M0+M1)/2)&&livre(L1,M0+8)&&livre(L1,M1-8));k++) L1-=0.5;
  for(let k=0;k<40&&!(livre((L0+L1)/2,M0)&&livre(L0+8,M0)&&livre(L1-8,M0));k++) M0+=0.5;
  for(let k=0;k<40&&!(livre((L0+L1)/2,M1)&&livre(L0+8,M1)&&livre(L1-8,M1));k++) M1-=0.5;
  const h=2.6, e=0.25, portao=[-752,-740], CINZA=0xb3b2ab;
  // muro alto de placas de concreto com pilar a cada 2 m
  const muro=(xa,za,xb,zb,tipo='concreto')=>{
    // corta o trecho que cair em cima de rua (esquinas)
    const N=Math.ceil(Math.hypot(xb-xa,zb-za)), ok=[]; for(let s=0;s<=N;s++){ const t=s/N; ok.push(livre(xa+(xb-xa)*t,za+(zb-za)*t)); }
    let s0=ok.indexOf(true), s1=ok.lastIndexOf(true); if(s0<0) return;
    const A=[xa+(xb-xa)*s0/N,za+(zb-za)*s0/N], B=[xa+(xb-xa)*s1/N,za+(zb-za)*s1/N]; [xa,za,xb,zb]=[A[0],A[1],B[0],B[1]];
    const L=Math.hypot(xb-xa,zb-za), ry=Math.atan2(zb-za,xb-xa); if(L<1) return;
    if(tipo==='grade') gradeBranca(xa,za,xb,zb,L,ry); else {
    caixa(L,h,e,(xa+xb)/2,0,(za+zb)/2,CINZA,-ry);
    for(let s=0;s<=L;s+=2){ const t=s/L; caixa(0.32,h+0.12,0.4,xa+(xb-xa)*t,0,za+(zb-za)*t,0x9d9c95,-ry); } }
    if(Math.abs(xb-xa)>Math.abs(zb-za)) ret(Math.min(xa,xb),Math.max(xa,xb),za-e,za+e); else ret(xa-e,xa+e,Math.min(za,zb),Math.max(za,zb)); };
  // 21/11 (fotos do Street View que o Maicon mandou, só como referência): na Av. Paraná (sul) é mureta
  // branca com grade branca e palmeiras; na esquina com a Napoleão Laureano fica a portaria
  const G0=165;                                                                     // da Napoleão Laureano: grade de G0 até a esquina
  muro(L0,M0,L1,M0); muro(L0,M0,L0,G0); muro(L0,G0,L0,M1,'grade'); muro(L1,M0,L1,M1);
  muro(L0,M1,portao[0],M1,'grade'); muro(portao[1],M1,L1,M1,'grade');
  fachadaEsquina(-780,169,186,L0);                                                    // o bloco de telhado de barro da esquina
  for(let x=L0+3;x<=L1-3;x+=7) if(x<portao[0]-2||x>portao[1]+2) if(livre(x,M1+1)) palmeira(x,M1-1.6,5.2+((x*13)%7)/7*1.6);   // palmeiras atrás da grade
  for(let z=G0+3;z<=M1-3;z+=7) palmeira(L0+1.6,z,5.4);
  // placa
  for(const dx of [-3,3]) caixa(0.25,3.2,0.25,(portao[0]+portao[1])/2+dx+8,0,M1+2,0x4b5563);
  placa('COLÉGIO ESTADUAL', 'EUCLIDES DA CUNHA', (portao[0]+portao[1])/2+8, 3.6, M1+2.15);
  caminho([[(portao[0]+portao[1])/2,M1],[(portao[0]+portao[1])/2,154]],5);
  for(let i=0;i<7;i++) arvore(-725+((i*37)%30), 120+((i*53)%60), 0.9+((i*7)%3)*0.15);
}
const placas=[];
function mural(x,z,w,h,ry){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=Math.round(1024*h/w); const k=cv.getContext('2d');
  let s=7; const r=()=>{ s=(s*1103515245+12345)%2147483648; return s/2147483648; };
  k.fillStyle='#1d6f8f'; k.fillRect(0,0,cv.width,cv.height);
  const cores=['#f2c14e','#f78154','#4d9078','#b4436c','#5fad56','#f2e9d8','#7b5ea7','#2ec4b6'];
  for(let i=0;i<34;i++){ const cx=r()*cv.width, cy=r()*cv.height, rr=30+r()*150;
    k.fillStyle=cores[(r()*cores.length)|0]; k.globalAlpha=0.85;
    if(i%3===0){ for(let p=0;p<6;p++){ const a=p/6*Math.PI*2; k.beginPath(); k.ellipse(cx+Math.cos(a)*rr*0.6,cy+Math.sin(a)*rr*0.6,rr*0.45,rr*0.22,a,0,7); k.fill(); } }   // flor
    else if(i%3===1){ k.beginPath(); k.ellipse(cx,cy,rr,rr*0.32,r()*3,0,7); k.fill(); }                                                                 // folha
    else { k.beginPath(); k.moveTo(cx,cy); for(let q=0;q<5;q++) k.quadraticCurveTo(cx+(r()-0.5)*rr*3,cy+(r()-0.5)*rr*3,cx+(r()-0.5)*rr*2,cy+(r()-0.5)*rr*2); k.fill(); } }
  k.globalAlpha=1;
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshLambertMaterial({map:tex}));
  m.position.set(x,1.3+h/2,z); m.rotation.y=ry; placas.push(m);
}
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

/* ───────── árvores nas calçadas (pedido do Maicon em 17/11) ─────────
   Uma a cada ~17 m nos dois lados das ruas da cidade, perto do meio-fio, sorteio fixo pela posição
   (todo mundo vê as mesmas). Fora de: BR, esquina (outra rua perto), frente de prédio/casa e terreno à venda.
   Algumas são ipê amarelo ou roxo. */
const hash=(x,z)=>{ const h=Math.sin(x*12.9898+z*78.233)*43758.5453; return h-Math.floor(h); };
function arvoresDeRua(predios, ruaLonge){
  const TIPOS=new Set(['primary','secondary','tertiary','residential','unclassified','living_street']);
  const CEL=30, grade=new Map(), kk=(i,j)=>i+'_'+j;
  for(const [lista,folga] of [[predios,2.2],[prediosOcultos,5],[ocultosMarcos,2.2]]) for(const p of lista){ const b=[p.bb[0]-folga,p.bb[1]-folga,p.bb[2]+folga,p.bb[3]+folga];
    for(let i=Math.floor(b[0]/CEL);i<=Math.floor(b[2]/CEL);i++) for(let j=Math.floor(b[1]/CEL);j<=Math.floor(b[3]/CEL);j++){ const c=kk(i,j); if(!grade.has(c)) grade.set(c,[]); grade.get(c).push(b); } }
  const perto=(x,z)=>(grade.get(kk(Math.floor(x/CEL),Math.floor(z/CEL)))||[]).some(b=>x>b[0]&&x<b[2]&&z>b[1]&&z<b[3]);
  const postas=[], ocupado=(x,z)=>postas.some(q=>Math.abs(q[0]-x)<6&&Math.abs(q[1]-z)<6);
  let n=0;
  for(const r of ruas){ if(r.pe||!TIPOS.has(r.tipo)||r.pts.length<2) continue;
    let resto=6;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], b=r.pts[i+1], dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz); if(L<1) continue;
      const ux=dx/L, uz=dz/L;
      for(let t=resto;t<L;t+=17){
        for(const lado of [1,-1]){ const off=lado*(r.w/2+0.8), x=a[0]+ux*t-uz*off+ux*lado*4, z=a[1]+uz*t+ux*off+uz*lado*4;   // lados desencontrados
          const sorte=hash(Math.round(x),Math.round(z)); if(sorte<0.22) continue;                    // umas falhas, para não ficar em fila de soldado
          if(perto(x,z)||ocupado(x,z)||!ruaLonge(x,z,0.4)) continue;
          const cor=sorte>0.95?1:sorte>0.915?2:0, esc=0.75+((sorte*7)%1)*0.45;
          arvore(x,z,esc,cor); postas.push([x,z]); n++; } }
      resto=((resto-L)%17+17)%17;
    } }
  return n;
}

/* ───────── Cemitério Municipal (21/11, pedido do Maicon com prints do Street View só como referência) ─────────
   Muro branco com a parte de cima azul-clara, portão de grade com arco azul na R. Munhoz da Rocha,
   túmulos-capela coloridos em fileiras, paredes de gavetas encostadas no muro e caminho central. */
function recuar(poly,d){                       // polígono (sentido horário na tela) recuado d metros para dentro
  const n=poly.length, L=[];
  for(let i=0;i<n;i++){ const a=poly[i], b=poly[(i+1)%n]; let dx=b[0]-a[0], dz=b[1]-a[1]; const l=Math.hypot(dx,dz); dx/=l; dz/=l;
    const nx=-dz, nz=dx;                                                             // normal para dentro (x leste, z sul)
    L.push([a[0]+nx*d,a[1]+nz*d,dx,dz]); }
  return L.map((p,i)=>{ const q=L[(i+n-1)%n], den=p[2]*q[3]-p[3]*q[2], t=((q[0]-p[0])*q[3]-(q[1]-p[1])*q[2])/den; return [p[0]+p[2]*t,p[1]+p[3]*t]; });
}
function cemiterio(){
  const P=recuar(CEMITERIO,7);                       // meia rua (3,5) + calçada
  const BRANCO=0xf4f4f1, AZUL=0xa9cbe8, AZUL_ARCO=0x3f7fc4, GRADE=0x5b6470;
  const portaoZ=499, PW=5;                                                            // nº 208 da Munhoz da Rocha
  const muroSeg=(a,b)=>{ const L=Math.hypot(b[0]-a[0],b[1]-a[1]); if(L<0.5) return; const ry=-Math.atan2(b[1]-a[1],b[0]-a[0]), cx=(a[0]+b[0])/2, cz=(a[1]+b[1])/2;
    caixa(L,1.3,0.25,cx,0,cz,BRANCO,ry); caixa(L,0.7,0.25,cx,1.3,cz,AZUL,ry); caixa(L+0.1,0.08,0.35,cx,2.0,cz,BRANCO,ry);
    for(let s=0;s<=L;s+=3){ const t=s/L; caixa(0.4,2.15,0.4,a[0]+(b[0]-a[0])*t,0,a[1]+(b[1]-a[1])*t,BRANCO,ry); }
    retGirado(cx,cz,L,0.3,ry); };
  for(let i=0;i<4;i++){ const a=P[i], b=P[(i+1)%4];
    if(i!==1){ muroSeg(a,b); continue; }                                              // lado leste: abre o portão
    const t=(portaoZ-a[1])/(b[1]-a[1]), L=Math.hypot(b[0]-a[0],b[1]-a[1]), dt=PW/2/L, ux=(b[0]-a[0])/L, uz=(b[1]-a[1])/L;
    const g0=[a[0]+(b[0]-a[0])*(t-dt),a[1]+(b[1]-a[1])*(t-dt)], g1=[a[0]+(b[0]-a[0])*(t+dt),a[1]+(b[1]-a[1])*(t+dt)];
    muroSeg(a,g0); muroSeg(g1,b);
    const gx=(g0[0]+g1[0])/2, gz=(g0[1]+g1[1])/2, ry=-Math.atan2(uz,ux);
    for(const g of [g0,g1]) caixa(0.6,2.4,0.6,g[0],0,g[1],BRANCO,ry);                // pilares do portão
    const arco=new THREE.TorusGeometry(PW/2+0.3,0.16,8,28,Math.PI); poe(arco,gx,2.3,gz,ry,AZUL_ARCO);
    const nx=-uz, nz=ux, ca=Math.cos(1.13), sa=Math.sin(1.13), w=PW/2-0.25;          // folhas abertas ~65° para dentro (oeste)
    for(const [g,sg] of [[g0,1],[g1,-1]]){
      const dx=ux*sg*ca+nx*sa, dz=uz*sg*ca+nz*sa, ang=-Math.atan2(dz,dx), ox=g[0]+dx*w/2, oz=g[1]+dz*w/2;
      caixa(w,0.06,0.05,ox,1.9,oz,GRADE,ang); caixa(w,0.06,0.05,ox,0.2,oz,GRADE,ang);
      for(let k=0;k<=w;k+=0.14){ const f=k/w-0.5; caixa(0.03,1.75,0.03,ox+dx*w*f,0.2,oz+dz*w*f,GRADE,ang); } }
  }
  // caminho central, do portão para oeste
  const [ox,oz]=[(P[1][0]+P[2][0])/2,portaoZ], wx=(P[0][0]+P[3][0])/2;
  caminho([[ox+1,oz],[wx+3,oz+(P[3][1]-P[0][1])*0.0]],4);
  // gavetas (ossuário) encostadas no muro leste e norte: bloco cinza com a grade das tampas
  const gavetas=(a,b)=>{ const L=Math.hypot(b[0]-a[0],b[1]-a[1]), ux=(b[0]-a[0])/L, uz=(b[1]-a[1])/L, nx=-uz, nz=ux, ry=-Math.atan2(uz,ux);
    const cx=(a[0]+b[0])/2+nx*0.9, cz=(a[1]+b[1])/2+nz*0.9; caixa(L,2.4,1.2,cx,0,cz,0x9a958e,ry); caixa(L+0.2,0.12,1.5,cx,2.4,cz,0xd6d3cc,ry);
    for(let y=0.5;y<2.4;y+=0.5) caixa(L,0.05,0.04,cx+nx*0.61,y,cz+nz*0.61,0xcfcac2,ry);
    for(let s=0.35;s<L;s+=0.7) caixa(0.05,2.3,0.04,a[0]+ux*s+nx*1.51,0.05,a[1]+uz*s+nz*1.51,0xcfcac2,ry);
    retGirado(cx,cz,L,1.2,ry); };
  { const a=P[1], b=P[2], L=Math.hypot(b[0]-a[0],b[1]-a[1]), t=(portaoZ-a[1])/(b[1]-a[1]);
    const lerp=u=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
    gavetas(lerp(0.04),lerp(t-6/L)); gavetas(lerp(t+6/L),lerp(0.96)); }
  { const a=P[0], b=P[1]; const lerp=u=>[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u]; gavetas(lerp(0.08),lerp(0.92)); }
  // túmulos-capela em fileiras (frente para o corredor), alguns com cruz
  const CORES=[0xf4f4f1,0xf4f4f1,0xe9b7c9,0xb9d4ea,0xc9c9c9,0xefe3c6,0xc9b7e0,0xf4f4f1], TETOS=[0x9aa3ad,0xb05a3a,0xd9d6cf];
  const I=recuar(P,3.2), u0=I[0], uu=[I[1][0]-I[0][0],I[1][1]-I[0][1]], Lu=Math.hypot(...uu), ux=uu[0]/Lu, uz=uu[1]/Lu, vx=-uz, vz=ux;
  const ry=-Math.atan2(uz,ux); let r=11;
  const sorte=()=>{ r=(r*1103515245+12345)%2147483648; return r/2147483648; };
  for(let v=2;v<140;v+=4.6){
    let fila=null; const fecha=(s1)=>{ if(fila){ const s0=fila, cx=u0[0]+ux*(s0+s1)/2+vx*v, cz=u0[1]+uz*(s0+s1)/2+vz*v; retGirado(cx,cz,s1-s0,2.6,ry); fila=null; } };
    for(let s=1;s<Lu+20;s+=1.9){
      const x=u0[0]+ux*s+vx*v, z=u0[1]+uz*s+vz*v;
      const ok=dentroPoly(x,z,I)&&Math.abs(z-portaoZ)>3.2&&sorte()>0.1;
      if(!ok){ fecha(s-0.95); continue; } if(fila===null) fila=s-0.95;
      const w=1.5, d=2.5, h=1.3+sorte()*0.9, c=CORES[(sorte()*CORES.length)|0];
      caixa(w,h,d,x,0,z,c,ry); caixa(w+0.3,0.15,d+0.3,x,0,z,0xd9d6cf,ry);
      const t=new THREE.CylinderGeometry(w*0.62,w*0.62,d+0.2,3); t.rotateZ(Math.PI/2); t.rotateX(-Math.PI/2); t.scale(1,0.55,1); t.rotateY(Math.PI/2);
      poe(t,x,h+0.18,z,ry,TETOS[(sorte()*TETOS.length)|0]);
      if(sorte()<0.35){ const cy=h+0.55; caixa(0.08,0.75,0.08,x,cy,z,0xf4f4f1,ry); caixa(0.45,0.08,0.08,x,cy+0.45,z,0xf4f4f1,ry); }
    }
    fecha(Lu+20);
  }
  // árvores da calçada (sibipirunas) do lado da Munhoz da Rocha, como nas fotos
  { const a=CEMITERIO[1], b=CEMITERIO[2]; for(let k=1;k<10;k++){ const t=k/10, x=a[0]+(b[0]-a[0])*t+5.4, z=a[1]+(b[1]-a[1])*t; if(Math.abs(z-portaoZ)>4) arvore(x-10.3,z,1.15); } }
}

export function construirMarcos(predios, ruaLonge){
  igreja(); colegio(ruaLonge); pracaMunicipal(ruaLonge); pracaBiazus(ruaLonge); prefeitura(); cemiterio();
  const deRua=arvoresDeRua(predios, ruaLonge);
  const g=mergeGeometries(geos,false); geos.forEach(x=>x.dispose());
  if(g) scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
  if(pisos.length){ const p=mergeGeometries(pisos,false); const m=new THREE.Mesh(p,matPiso); m.renderOrder=-7; m.frustumCulled=false; scene.add(m); }
  for(const m of placas) scene.add(m);
  // árvores instanciadas
  if(arvores.length){
    const gT=new THREE.CylinderGeometry(0.22,0.3,3,6).translate(0,1.5,0), gC=new THREE.IcosahedronGeometry(2.6,0).translate(0,4.6,0), gC2=new THREE.IcosahedronGeometry(1.9,0).translate(0.9,6.0,-0.4);
    const mT=new THREE.MeshLambertMaterial({color:0x6b4f36}), mC=new THREE.MeshLambertMaterial({color:0xffffff,flatShading:true});
    const CORES=[[0x4f7a3a,0x5f8c44],[0xe3b31b,0xf2c94c],[0x9b4f9e,0xb565b8]], PED=500, pedacos=new Map(), cor=new THREE.Color();
    arvores.forEach((a,i)=>{ const c=Math.floor(a[0]/PED)+'_'+Math.floor(a[1]/PED); if(!pedacos.has(c)) pedacos.set(c,[]); pedacos.get(c).push([...a,i]);
      const [x,z,e]=a, p=[]; for(let k=0;k<6;k++){ const g=k/6*Math.PI*2; p.push([x+Math.cos(g)*0.35*e, z+Math.sin(g)*0.35*e]); } solidos.push(p); });
    for(const lista of pedacos.values()){
      const tronco=new THREE.InstancedMesh(gT,mT,lista.length), copa=new THREE.InstancedMesh(gC,mC,lista.length), copa2=new THREE.InstancedMesh(gC2,mC,lista.length);
      lista.forEach(([x,z,e,k,i],j)=>{ M.compose(V.set(x,0,z),Qt.setFromEuler(E.set(0,i*1.7,0)),S.set(e,e,e)); tronco.setMatrixAt(j,M); copa.setMatrixAt(j,M); copa2.setMatrixAt(j,M); S.set(1,1,1);
        const tom=0.88+((i*0.37)%1)*0.24; copa.setColorAt(j,cor.setHex(CORES[k||0][0]).multiplyScalar(tom)); copa2.setColorAt(j,cor.setHex(CORES[k||0][1]).multiplyScalar(tom)); });
      for(const m of [tronco,copa,copa2]){ m.computeBoundingSphere(); scene.add(m); }
    }
  }
  const bb=pts=>{ let a=1e9,b=1e9,c=-1e9,d=-1e9; for(const p of pts){ a=Math.min(a,p[0]); b=Math.min(b,p[1]); c=Math.max(c,p[0]); d=Math.max(d,p[1]); } return [a,b,c,d]; };
  for(const pts of solidos) predios.push({pts,bb:bb(pts),marco:true});
  return { arvores:arvores.length, deRua, solidos:solidos.length };
}
