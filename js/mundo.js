// Colisão com prédios (grade espacial: com milhares de prédios não dá para testar um por um)
// e rua mais próxima
import { ruas, predios } from './cidade.js';

const CEL = 40;            // m
let grade = new Map(), indexados = 0;
const k = (i,j)=>i+'_'+j;

// (re)monta a grade quando chegam prédios novos
function indexar(){
  grade = new Map();
  for(const p of predios){ const b=p.bb;
    for(let i=Math.floor(b[0]/CEL);i<=Math.floor(b[2]/CEL);i++) for(let j=Math.floor(b[1]/CEL);j<=Math.floor(b[3]/CEL);j++){
      const c=k(i,j); if(!grade.has(c)) grade.set(c,[]); grade.get(c).push(p); } }
  indexados = predios.length;
}

function dentro(x,z,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }

export function bloqueado(x,z){
  if(indexados!==predios.length) indexar();
  const lista=grade.get(k(Math.floor(x/CEL),Math.floor(z/CEL))); if(!lista) return false;
  for(const p of lista){ const b=p.bb; if(x<b[0]||z<b[1]||x>b[2]||z>b[3]) continue; if(dentro(x,z,p.pts)) return true; }
  return false;
}

export function ruaMaisProxima(x,z){
  let melhor=null, md=30;
  for(const r of ruas){ const b=r.bb; if(!r.nome||x<b[0]-md||z<b[1]-md||x>b[2]+md||z>b[3]+md) continue;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], c=r.pts[i+1]; const vx=c[0]-a[0], vz=c[1]-a[1];
      let t=((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t));
      const d=Math.hypot(x-a[0]-vx*t, z-a[1]-vz*t)-r.w/2; if(d<md){ md=d; melhor=r; } } }
  return melhor;
}

// ponto livre mais perto (para o avatar não nascer dentro de uma casa)
export function pontoLivre(x,z){
  if(!bloqueado(x,z)) return [x,z];
  for(let r=2;r<80;r+=2) for(let a=0;a<16;a++){ const px=x+Math.cos(a/16*Math.PI*2)*r, pz=z+Math.sin(a/16*Math.PI*2)*r; if(!bloqueado(px,pz)) return [px,pz]; }
  return [x,z];
}
