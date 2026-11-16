// Campos de futebol de Matelândia (pedido do Maicon, 15/11/2026): o campo do Aymoré e o campo ao lado,
// nas quadras entre a R. Munhoz da Rocha, R. Gen. Dutra, R. Bento Gonçalves, R. Souza Naves/Av. Ipiranga
// e Av. Vital Brasil. Os cantos são os cruzamentos dessas ruas no mapa do jogo (OSM).
// Cada campo: gramado listrado com as linhas oficiais, traves com rede, alambrado com portão e banco de reservas.
import * as THREE from 'three';
import { scene, flat } from './cena.js';

// cantos da quadra (sentido: NO, NE, SE, SO) em metros do jogo
const QUADRAS = [
  { nome:'Campo da Vila Nova', cantos:[[-1178.2,425.2],[-1059.7,435.3],[-1068.8,556.7],[-1188.9,545.0]] },
  { nome:'Campo do Aymoré',    cantos:[[-1059.7,435.3],[-938.0,447.3],[-946.4,569.3],[-1068.8,556.7]] },
];
const RECUO = 9;   // m da esquina até o alambrado (rua + calçada)

// gramado do campo: um retângulo dentro da quadra, alinhado ao lado oeste (eixo comprido norte-sul)
export const CAMPOS = QUADRAS.map(q=>{
  const [a,b,c,d]=q.cantos, cx=(a[0]+b[0]+c[0]+d[0])/4, cz=(a[1]+b[1]+c[1]+d[1])/4;
  const ns=[(d[0]+c[0]-a[0]-b[0])/2,(d[1]+c[1]-a[1]-b[1])/2], comp=Math.hypot(...ns)-2*RECUO;            // norte→sul
  const lo=[(b[0]+c[0]-a[0]-d[0])/2,(b[1]+c[1]-a[1]-d[1])/2], larg=Math.hypot(...lo)-2*RECUO;            // oeste→leste
  const u=[ns[0]/Math.hypot(...ns), ns[1]/Math.hypot(...ns)];
  return { nome:q.nome, cx, cz, comp, larg, ang:Math.atan2(u[0],u[1]) };   // ang: rotação y que leva o +z local ao eixo norte→sul
});
// ponto dentro de algum campo (para tirar prédio que estava no gramado)
export function noCampo(x,z,folga=0){
  for(const f of CAMPOS){ const dx=x-f.cx, dz=z-f.cz, s=Math.sin(f.ang), c=Math.cos(f.ang);
    const lz=dx*s+dz*c, lx=dx*c-dz*s; if(Math.abs(lx)<f.larg/2+folga&&Math.abs(lz)<f.comp/2+folga) return f; }
  return null;
}

// tamanho das linhas: proporção de campo oficial (68 × 105 m), cabendo no gramado com folga
const medidas=(larg,comp)=>{ const ch=Math.min(105,comp-8), cw=Math.min(68,larg-8,ch*0.65); return [cw,ch]; };
function texGramado(larg,comp){
  const PX=6, W=Math.round(larg*PX), H=Math.round(comp*PX), cv=document.createElement('canvas'); cv.width=W; cv.height=H; const k=cv.getContext('2d');
  const faixas=12; for(let i=0;i<faixas;i++){ k.fillStyle=i%2?'#3f8a3a':'#4a9a42'; k.fillRect(0,i*H/faixas,W,H/faixas+1); }
  for(let i=0;i<4000;i++){ k.fillStyle=`rgba(${Math.random()<0.5?'20,60,20':'120,170,90'},${Math.random()*0.12})`; k.fillRect(Math.random()*W,Math.random()*H,2,2); }
  // linhas (medidas oficiais, encolhidas se o campo for menor)
  const m=x=>x*PX, cxp=W/2, cyp=H/2, [cw,ch]=medidas(larg,comp), CW=m(cw), CH=m(ch), mx=(W-CW)/2, mg=(H-CH)/2;
  k.strokeStyle='rgba(255,255,255,.92)'; k.lineWidth=m(0.12);
  k.strokeRect(mx,mg,CW,CH); k.beginPath(); k.moveTo(mx,cyp); k.lineTo(W-mx,cyp); k.stroke();
  k.beginPath(); k.arc(cxp,cyp,m(9.15),0,Math.PI*2); k.stroke();
  k.fillStyle='#fff'; k.beginPath(); k.arc(cxp,cyp,m(0.25),0,Math.PI*2); k.fill();
  const area=(y,s)=>{ const gw=Math.min(m(40.3),CW*0.7), gh=Math.min(m(16.5),CH*0.17), pw=m(18.3), ph=m(5.5);
    k.strokeRect(cxp-gw/2, s>0?y:y-gh, gw, gh); k.strokeRect(cxp-pw/2, s>0?y:y-ph, pw, ph);
    const py=y+s*Math.min(m(11),gh*0.67); k.beginPath(); k.arc(cxp,py,m(0.22),0,Math.PI*2); k.fill();
    k.beginPath(); k.arc(cxp,py,m(9.15),s>0?0.29*Math.PI:1.29*Math.PI,s>0?0.71*Math.PI:1.71*Math.PI); k.stroke(); };
  area(mg,1); area(H-mg,-1);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8; return t;
}

const BRANCO=new THREE.MeshLambertMaterial({color:0xf5f5f4}), FERRO=new THREE.MeshLambertMaterial({color:0x6b7280}),
  TELA=new THREE.MeshLambertMaterial({color:0x4d7c0f,transparent:true,opacity:0.35,side:THREE.DoubleSide,depthWrite:false}),
  REDE=new THREE.MeshLambertMaterial({color:0xffffff,transparent:true,opacity:0.3,side:THREE.DoubleSide,depthWrite:false}),
  BANCO=new THREE.MeshLambertMaterial({color:0x1d4ed8}), TETO=new THREE.MeshLambertMaterial({color:0xe5e7eb,transparent:true,opacity:0.8});
const barra=(g,m,x0,x1,y0,y1,z0,z1)=>{ const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m); b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); g.add(b); return b; };

function trave(g, z, s){   // s=+1: rede para trás de quem olha do meio (fundo em z+s)
  const L=7.32, A=2.44, P=0.12, F=1.8;
  barra(g,BRANCO,-L/2-P,-L/2,0,A,z-P/2,z+P/2); barra(g,BRANCO,L/2,L/2+P,0,A,z-P/2,z+P/2); barra(g,BRANCO,-L/2-P,L/2+P,A,A+P,z-P/2,z+P/2);
  const fundo=new THREE.Mesh(new THREE.PlaneGeometry(L,A),REDE); fundo.position.set(0,A/2,z+s*F); g.add(fundo);
  const teto=new THREE.Mesh(new THREE.PlaneGeometry(L,F).rotateX(-Math.PI/2),REDE); teto.position.set(0,A,z+s*F/2); g.add(teto);
  for(const x of [-L/2,L/2]){ const lado=new THREE.Mesh(new THREE.PlaneGeometry(F,A).rotateY(Math.PI/2),REDE); lado.position.set(x,A/2,z+s*F/2); g.add(lado); }
}

export function construirCampos(){
  for(const f of CAMPOS){
    const g=new THREE.Group(); g.position.set(f.cx,0,f.cz); g.rotation.y=f.ang; scene.add(g);
    const grama=new THREE.Mesh(new THREE.PlaneGeometry(f.larg,f.comp,12,12).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial(flat({map:texGramado(f.larg,f.comp)})));
    grama.renderOrder=-5; grama.rotation.y=Math.PI; g.add(grama);   // gira 180°: o desenho fica com o norte em −z local
    const mz=medidas(f.larg,f.comp)[1]/2; trave(g,-mz,-1); trave(g,mz,1);
    // alambrado (3 m), com portão no meio do lado leste
    const H=3, X=f.larg/2+1, Z=f.comp/2+1;
    const lados=[[[-X,-Z],[X,-Z]],[[X,-Z],[X,-2.5]],[[X,2.5],[X,Z]],[[X,Z],[-X,Z]],[[-X,Z],[-X,-Z]]];
    for(const [[x0,z0],[x1,z1]] of lados){ const L=Math.hypot(x1-x0,z1-z0), tela=new THREE.Mesh(new THREE.PlaneGeometry(L,H),TELA);
      tela.position.set((x0+x1)/2,H/2,(z0+z1)/2); tela.rotation.y=Math.atan2(x1-x0,z1-z0)-Math.PI/2; g.add(tela);
      const n=Math.ceil(L/4); for(let i=0;i<=n;i++){ const t=i/n; barra(g,FERRO,x0+(x1-x0)*t-0.04,x0+(x1-x0)*t+0.04,0,H,z0+(z1-z0)*t-0.04,z0+(z1-z0)*t+0.04); } }
    // bancos de reservas cobertos no lado oeste
    for(const s of [-1,1]){ const z=s*8; barra(g,BANCO,-f.larg/2+1.2,-f.larg/2+1.7,0,0.45,z-3,z+3); barra(g,TETO,-f.larg/2+0.9,-f.larg/2+2.2,2.1,2.15,z-3.2,z+3.2);
      for(const zz of [z-3,z+3]) barra(g,FERRO,-f.larg/2+0.9,-f.larg/2+0.98,0,2.1,zz-0.04,zz+0.04); }
  }
  return CAMPOS.length;
}
