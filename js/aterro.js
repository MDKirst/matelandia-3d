// BR-277 em aterro nas trincheiras (23/11, pedido do Maicon): "existem duas trincheiras subterrâneas para passagem
// de um lado para o outro da cidade por baixo da BR". Na foto a BR fica num aterro e a rua passa no nível do chão,
// entre paredes de concreto (gabarito 5,50 m). Fora das trincheiras a BR continua no chão (dá para atravessar).
//
// O relevo (relevo.js) tem UMA altura por ponto x,z — tudo sobe junto. Aqui ficam dois níveis no mesmo x,z:
//  - a BR (malha própria, cidade.js) sobe `perfil(x,z)`: 6 m num platô em volta de cada trincheira e uma rampa
//    suave até o chão (70 m);
//  - a rua da trincheira continua no chão e passa por baixo (o tabuleiro da BR é o teto).
// Quem está "em cima" (nivel.alto) anda na BR elevada e não sai pela lateral (cairia); quem está embaixo não
// atravessa o aterro, só pela passagem. A colisão do mundo (mundo.bloqueado) consulta `aterro.cima` para saber
// de que nível se pergunta (padrão: chão).
import * as THREE from 'three';
import { toXZ } from './geo.js';
import { scene } from './cena.js';

const H=6.0, PLATO=14, RAMPA=70, ALCANCE=PLATO+RAMPA, ALTO=1.2;
// eixo da rua que passa por baixo (trecho do OSM sob as pontes da BR)
const DEF=[
  { nome:'Trincheira da Rua Assis Brasil', a:[-25.2429575,-53.9758592], b:[-25.242644,-53.9758361], larg:8 },   // way 468507852 (tunnel=yes)
  { nome:'Trincheira do viaduto de acesso', a:[-25.2460421,-53.9835297], b:[-25.2463852,-53.9830903], larg:8 },  // way 468507875 (gabarito 5,50 m)
];
export const trincheiras=DEF.map(d=>{
  const A=toXZ(...d.a), B=toXZ(...d.b), L=Math.hypot(B[0]-A[0],B[1]-A[1])||1, ux=(B[0]-A[0])/L, uz=(B[1]-A[1])/L;
  return { ...d, C:[(A[0]+B[0])/2,(A[1]+B[1])/2], u:[ux,uz], n:[-uz,ux], meia:d.larg/2+1.4 };   // meia: meia largura da passagem (rua + calçadinha)
});
export const aterro={ cima:false };          // de que nível a colisão está perguntando agora

// altura da BR acima do chão (0 longe das trincheiras)
export function perfil(x,z){
  let h=0;
  for(const t of trincheiras){ const d=Math.hypot(x-t.C[0],z-t.C[1]); if(d>=ALCANCE) continue;
    const s=d<=PLATO?1:(ALCANCE-d)/RAMPA, v=H*s*s*(3-2*s); if(v>h) h=v; }
  return h;
}
export const pertoDeTrincheira=(x,z,r=0)=>trincheiras.some(t=>Math.hypot(x-t.C[0],z-t.C[1])<ALCANCE+r);

// pista da BR perto das trincheiras (segmentos registrados pelo cidade.js)
let segs=[];
export function registrarBR(lista){       // lista: [{pts,w}] das pistas motorway
  segs=[];
  for(const {pts,w} of lista) for(let i=0;i<pts.length-1;i++){ const a=pts[i], b=pts[i+1];
    if(!pertoDeTrincheira(a[0],a[1],40)&&!pertoDeTrincheira(b[0],b[1],40)) continue;
    segs.push({a,b,w,bb:[Math.min(a[0],b[0])-w,Math.min(a[1],b[1])-w,Math.max(a[0],b[0])+w,Math.max(a[1],b[1])+w]}); }
}
function distSeg(x,z,a,b){ const vx=b[0]-a[0], vz=b[1]-a[1], L2=vx*vx+vz*vz||1; let t=((x-a[0])*vx+(z-a[1])*vz)/L2; t=Math.max(0,Math.min(1,t)); return Math.hypot(x-a[0]-vx*t,z-a[1]-vz*t); }
// ponto em cima da pista da BR (perto de trincheira)? folga negativa = mais para dentro
export function naBR(x,z,folga=0){
  for(const s of segs){ if(x<s.bb[0]||z<s.bb[1]||x>s.bb[2]||z>s.bb[3]) continue; if(distSeg(x,z,s.a,s.b)<s.w/2+folga) return true; }
  return false;
}
// dentro do vão de alguma trincheira (por baixo da BR)
export function passagem(x,z,folga=0){
  for(const t of trincheiras){ const dx=x-t.C[0], dz=z-t.C[1];
    if(Math.abs(dx*t.u[0]+dz*t.u[1])<45&&Math.abs(dx*t.n[0]+dz*t.n[1])<t.meia+folga) return true; }
  return false;
}
// no chão: o aterro (BR alta fora do vão) é sólido
export const solidoBaixo=(x,z)=>perfil(x,z)>ALTO&&naBR(x,z)&&!passagem(x,z);
// em cima: sair da pista onde ela está alta é cair → bloqueia (guard-rail)
export const foraAlto=(x,z)=>perfil(x,z)>ALTO&&!naBR(x,z,-0.2);
// para mundo.somarBloqueio: responde conforme o nível perguntado
export const bloqueioAterro=(x,z)=>{ if(!segs.length) return false; return aterro.cima?foraAlto(x,z):solidoBaixo(x,z); };

// nível de quem anda (jogador a pé ou o veículo dele): {alto}
// fora da pista → chão; na pista onde ela ainda está baixa → em cima; no resto mantém (embaixo no vão, em cima no tabuleiro)
export function atualizarNivel(st,x,z){
  if(!segs.length||!pertoDeTrincheira(x,z,5)){ st.alto=false; return st; }
  if(!naBR(x,z)) st.alto=false;
  else if(perfil(x,z)<ALTO) st.alto=true;
  return st;
}
// altura extra de quem está no nível st (para o desenho e a câmera)
export const alturaNivel=(st,x,z)=>st&&st.alto?perfil(x,z):0;
// algo no ponto, num veículo do trânsito/polícia que anda na rua r: está em cima?
export const altoNaRua=(r,x,z)=>!!r&&r.tipo&&r.tipo.startsWith('motorway')&&perfil(x,z)>ALTO;
// dois pontos estão em níveis diferentes? (perto das trincheiras)
export const outroNivel=(altoA,altoB)=>!!altoA!==!!altoB;

/* ───────── desenho: taludes do aterro e paredes da passagem ───────── */
const matTalude=new THREE.MeshLambertMaterial({color:0x7d8f57, side:THREE.DoubleSide});
const matConcreto=new THREE.MeshLambertMaterial({color:0x9c978d, side:THREE.DoubleSide});
function quad(arr,a,b,ya0,ya1,yb0,yb1){   // parede vertical de a até b (x,z), alturas embaixo/em cima em cada ponta
  arr.push(a[0],ya0,a[1], b[0],yb0,b[1], b[0],yb1,b[1],  a[0],ya0,a[1], b[0],yb1,b[1], a[0],ya1,a[1]);
}
function malha(pos,mat){
  if(!pos.length) return null; const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat); m.frustumCulled=false; scene.add(m); return m;
}
// pistas: [{pts (densas, 6 m),w}] — chamado pelo cidade.js depois de registrarBR
export function construirAterro(pistas){
  const tal=[], conc=[];
  for(const {pts,w} of pistas){ const n=pts.length; if(n<2) continue;
    const borda=[[],[]];
    for(let i=0;i<n;i++){ const a=pts[Math.max(i-1,0)], c=pts[Math.min(i+1,n-1)]; let dx=c[0]-a[0], dz=c[1]-a[1]; const l=Math.hypot(dx,dz)||1; dx/=l; dz/=l;
      borda[0].push([pts[i][0]-dz*w/2,pts[i][1]+dx*w/2,-dz,dx]); borda[1].push([pts[i][0]+dz*w/2,pts[i][1]-dx*w/2,dz,-dx]); }
    for(const b of borda) for(let i=0;i<n-1;i++){
      const p=b[i], q=b[i+1], hp=perfil(p[0],p[1]), hq=perfil(q[0],q[1]); if(hp<0.05&&hq<0.05) continue;
      const mx=(p[0]+q[0])/2, mz=(p[1]+q[1])/2, ox=(p[2]+q[2])/2, oz=(p[3]+q[3])/2;
      if(naBR(mx+ox*0.7,mz+oz*0.7)) continue;                                   // borda de dentro (a outra pista encosta): escondida
      if(passagem(mx,mz)){ quad(conc,[p[0],p[1]],[q[0],q[1]],hp-0.7,hp,hq-0.7,hq); continue; }   // vão: só a viga do tabuleiro
      quad(tal,[p[0],p[1]],[q[0],q[1]],-0.6,hp,-0.6,hq);                         // talude (parede de grama até o chão)
    }
  }
  // paredes de concreto dos dois lados da passagem, só no trecho debaixo da BR
  for(const t of trincheiras){
    let s0=null, s1=null;
    for(let s=-45;s<=45;s+=0.5){ const x=t.C[0]+t.u[0]*s, z=t.C[1]+t.u[1]*s; if(naBR(x,z)){ if(s0===null) s0=s; s1=s; } }
    if(s0===null) continue;
    for(const lado of [-1,1]) for(let s=s0;s<s1;s+=2){ const e=Math.min(s1,s+2);
      const a=[t.C[0]+t.u[0]*s+t.n[0]*t.meia*lado, t.C[1]+t.u[1]*s+t.n[1]*t.meia*lado], b=[t.C[0]+t.u[0]*e+t.n[0]*t.meia*lado, t.C[1]+t.u[1]*e+t.n[1]*t.meia*lado];
      quad(conc,a,b,-0.3,perfil(a[0],a[1]),-0.3,perfil(b[0],b[1])); }
    t.trecho=[s0,s1];
  }
  malha(tal,matTalude); malha(conc,matConcreto);
}
