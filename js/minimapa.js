// Minimapa redondo (norte para cima)
import { $ } from './cena.js';
import { ruas, predios } from './cidade.js';

const mm=$('mini').getContext('2d'); const MMS=380, ESC=0.75; // px por metro

export function minimapa(px,pz,rumo){
  const alc=MMS/2/ESC;
  mm.fillStyle='#22352a'; mm.fillRect(0,0,MMS,MMS);
  mm.save(); mm.translate(MMS/2,MMS/2); mm.scale(ESC,ESC); mm.translate(-px,-pz);
  mm.fillStyle='#8d8676';
  for(const p of predios){ const b=p.bb; if(b[2]<px-alc||b[0]>px+alc||b[3]<pz-alc||b[1]>pz+alc) continue;
    mm.beginPath(); p.pts.forEach((q,i)=>i?mm.lineTo(q[0],q[1]):mm.moveTo(q[0],q[1])); mm.fill(); }
  mm.lineCap='round'; mm.lineJoin='round';
  for(const r of ruas){ const b=r.bb; if(b[2]<px-alc||b[0]>px+alc||b[3]<pz-alc||b[1]>pz+alc) continue;
    mm.strokeStyle=r.pe?'#9aa58f':'#f1f5f9'; mm.lineWidth=Math.max(r.w,r.pe?2:5);
    mm.beginPath(); r.pts.forEach((q,i)=>i?mm.lineTo(q[0],q[1]):mm.moveTo(q[0],q[1])); mm.stroke(); }
  mm.restore();
  mm.save(); mm.translate(MMS/2,MMS/2); mm.rotate(-rumo);
  mm.fillStyle='#F97316'; mm.strokeStyle='#111'; mm.lineWidth=3;
  mm.beginPath(); mm.moveTo(0,18); mm.lineTo(11,-12); mm.lineTo(0,-5); mm.lineTo(-11,-12); mm.closePath(); mm.fill(); mm.stroke(); mm.restore();
  mm.fillStyle='#fff'; mm.font='bold 22px system-ui'; mm.textAlign='center'; mm.fillText('N',MMS/2,34);
}
