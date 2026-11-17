// Confere: nenhum poste no asfalto, casas fora da calçada, árvores contadas; fotos de rua.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[], logs=[]; pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(/^(marcos|postes|casas)/.test(m.text())) logs.push(m.text()); });
const t0=Date.now(); await pg.goto('http://localhost:8737/?hora=12&sala=teste-auto');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:180000});
console.log('carregou em',Math.round((Date.now()-t0)/1000),'s ·',logs.join(' · '));
const r=await pg.evaluate(async()=>{ const { ruas, predios }=await import('/js/cidade.js'); const { postes }=await import('/js/ceu.js');
  const dist=(x,z,pe=false)=>{ let best=[1e9,null]; for(const r of ruas){ if(r.pe) continue; const b=r.bb; if(x<b[0]-20||x>b[2]+20||z<b[1]-20||z>b[3]+20) continue;
    for(let i=0;i<r.pts.length-1;i++){ const q=r.pts[i], n=r.pts[i+1], vx=n[0]-q[0], vz=n[1]-q[1]; let t=((x-q[0])*vx+(z-q[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t)); const d=Math.hypot(x-q[0]-vx*t,z-q[1]-vz*t)-r.w/2; if(d<best[0]) best=[d,r]; } } return best; };
  const postesNaRua=postes.filter(([x,z])=>dist(x,z)[0]<0).length;
  const over=predios.filter(p=>!p.marco&&!p.muro&&!p.osm), movidas=over.filter(p=>p.bb0&&(p.bb0[0]!==p.bb[0]||p.bb0[1]!==p.bb[1])).length;
  let naCalcada=0, naPista=0; for(const p of over){ let m=1e9; for(const q of p.pts){ const [d,r]=dist(q[0],q[1]); const lim=(r&&(r.tipo||'').startsWith('motorway'))?1:1.9; m=Math.min(m,d-lim); } if(m<-0.1) naCalcada++; let pista=false; for(const q of p.pts) if(dist(q[0],q[1])[0]<0) pista=true; if(pista) naPista++; }
  return { postes:postes.length, postesNaRua, casas:over.length, movidas, aindaNaCalcada:naCalcada, cantoNaPista:naPista }; });
console.log(JSON.stringify(r));
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForTimeout(3000);
for(const [nome,la,lo,yaw,d,p] of [['calcada1',-25.2443,-53.9746,2.0,14,0.25],['calcada2',-25.2405,-53.9800,0.8,16,0.3],['calcada-alto',-25.2425,-53.9770,1.2,60,0.75]]){
  await pg.evaluate(async([la,lo,yaw,d,p])=>{ const g=await import('/js/geo.js'); const { pontoLivre }=await import('/js/mundo.js'); const [x,z]=g.toXZ(la,lo); const [a,b]=pontoLivre(x,z); __jogo.jogador.position.set(a,0,b); __jogo.cam(d,p,yaw); },[la,lo,yaw,d,p]);
  await pg.waitForTimeout(3000); await pg.screenshot({path:join(fotos,`${nome}.png`)}); }
console.log(erros.length?'ERROS:\n'+erros.join('\n'):'sem erros de página'); await nav.close();
