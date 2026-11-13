// Minimapa redondo (norte para cima)
import { $ } from './cena.js';
import { ruas, predios } from './cidade.js';

const mm=$('mini').getContext('2d'); const MMS=380, ESC=0.75; // px por metro

// rumo: direção da seta do jogador (0 = +Z, sul). veiculos: [{x,z,h,comp,larg}] estacionados;
// transito: [[x,z],...]
// alvo: [x,z] da entrega (fica na borda do mapa se estiver longe)
// jogadores: [[x,z]] dos outros jogadores online (pontos azuis)
// terrenos: { meus:[{cantos,centro}], outros:[...] } — os seus em laranja (com 🏠 na borda se longe), dos outros em cinza
export function minimapa(px,pz,rumo,veiculos=[],transito=[],alvo=null,jogadores=[],terrenos=null){
  const alc=MMS/2/ESC;
  mm.fillStyle='#22352a'; mm.fillRect(0,0,MMS,MMS);
  mm.save(); mm.translate(MMS/2,MMS/2); mm.scale(ESC,ESC); mm.translate(-px,-pz);
  if(terrenos){ const lote=(l,fill,stroke)=>{ const [x,z]=l.centro; if(Math.abs(x-px)>alc+20||Math.abs(z-pz)>alc+20) return;
      mm.beginPath(); l.cantos.forEach((q,i)=>i?mm.lineTo(q[0],q[1]):mm.moveTo(q[0],q[1])); mm.closePath(); mm.fillStyle=fill; mm.fill(); mm.strokeStyle=stroke; mm.lineWidth=2.5; mm.stroke(); };
    for(const l of terrenos.outros) lote(l,'rgba(148,163,184,.45)','#cbd5e1');
    for(const l of terrenos.meus) lote(l,'rgba(249,115,22,.75)','#fff7ed'); }
  mm.fillStyle='#8d8676';
  for(const p of predios){ const b=p.bb; if(b[2]<px-alc||b[0]>px+alc||b[3]<pz-alc||b[1]>pz+alc) continue;
    mm.beginPath(); p.pts.forEach((q,i)=>i?mm.lineTo(q[0],q[1]):mm.moveTo(q[0],q[1])); mm.fill(); }
  mm.lineCap='round'; mm.lineJoin='round';
  for(const r of ruas){ const b=r.bb; if(b[2]<px-alc||b[0]>px+alc||b[3]<pz-alc||b[1]>pz+alc) continue;
    mm.strokeStyle=r.pe?'#9aa58f':'#f1f5f9'; mm.lineWidth=Math.max(r.w,r.pe?2:5);
    mm.beginPath(); r.pts.forEach((q,i)=>i?mm.lineTo(q[0],q[1]):mm.moveTo(q[0],q[1])); mm.stroke(); }
  mm.fillStyle='#64748b';
  for(const [x,z] of transito){ mm.beginPath(); mm.arc(x,z,3.2,0,Math.PI*2); mm.fill(); }
  mm.fillStyle='#38bdf8'; mm.strokeStyle='#0c4a6e'; mm.lineWidth=1.5;
  for(const v of veiculos){ mm.save(); mm.translate(v.x,v.z); mm.rotate(-v.h); mm.fillRect(-v.larg/2-1,-v.comp/2-1,v.larg+2,v.comp+2); mm.strokeRect(-v.larg/2-1,-v.comp/2-1,v.larg+2,v.comp+2); mm.restore(); }
  mm.fillStyle='#22d3ee'; mm.strokeStyle='#083344'; mm.lineWidth=2;
  for(const [x,z] of jogadores){ mm.beginPath(); mm.arc(x,z,5.5,0,Math.PI*2); mm.fill(); mm.stroke(); }
  mm.restore();
  // 🏠 em cada terreno seu (na borda do mapa quando longe)
  for(const l of terrenos?.meus||[]){ let dx=(l.centro[0]-px)*ESC, dz=(l.centro[1]-pz)*ESC; const d=Math.hypot(dx,dz), lim=MMS/2-18; if(d>lim){ dx*=lim/d; dz*=lim/d; }
    mm.fillStyle='#F97316'; mm.strokeStyle='#111'; mm.lineWidth=3; mm.beginPath(); mm.arc(MMS/2+dx,MMS/2+dz,13,0,Math.PI*2); mm.fill(); mm.stroke();
    mm.font='16px system-ui'; mm.textAlign='center'; mm.fillText('🏠',MMS/2+dx,MMS/2+dz+6); }
  mm.save(); mm.translate(MMS/2,MMS/2); mm.rotate(-rumo);
  mm.fillStyle='#F97316'; mm.strokeStyle='#111'; mm.lineWidth=3;
  mm.beginPath(); mm.moveTo(0,18); mm.lineTo(11,-12); mm.lineTo(0,-5); mm.lineTo(-11,-12); mm.closePath(); mm.fill(); mm.stroke(); mm.restore();
  if(alvo){ let dx=(alvo[0]-px)*ESC, dz=(alvo[1]-pz)*ESC; const d=Math.hypot(dx,dz), lim=MMS/2-16; if(d>lim){ dx*=lim/d; dz*=lim/d; }
    mm.fillStyle='#facc15'; mm.strokeStyle='#111'; mm.lineWidth=3; mm.beginPath(); mm.arc(MMS/2+dx,MMS/2+dz,12,0,Math.PI*2); mm.fill(); mm.stroke();
    mm.fillStyle='#111'; mm.font='bold 16px system-ui'; mm.textAlign='center'; mm.fillText('📦',MMS/2+dx,MMS/2+dz+6); }
  mm.fillStyle='#fff'; mm.font='bold 22px system-ui'; mm.textAlign='center'; mm.fillText('N',MMS/2,34);
}
