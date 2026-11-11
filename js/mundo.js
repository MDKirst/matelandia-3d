// Colisão com prédios e rua mais próxima
import { ruas, predios } from './cidade.js';

function dentro(x,z,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }

export function bloqueado(x,z){ for(const p of predios){ const b=p.bb; if(x<b[0]||z<b[1]||x>b[2]||z>b[3]) continue; if(dentro(x,z,p.pts)) return true; } return false; }

export function ruaMaisProxima(x,z){
  let melhor=null, md=30;
  for(const r of ruas){ const b=r.bb; if(!r.nome||x<b[0]-md||z<b[1]-md||x>b[2]+md||z>b[3]+md) continue;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], c=r.pts[i+1]; const vx=c[0]-a[0], vz=c[1]-a[1];
      let t=((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t));
      const d=Math.hypot(x-a[0]-vx*t, z-a[1]-vz*t)-r.w/2; if(d<md){ md=d; melhor=r; } } }
  return melhor;
}
