// Reproduz a compra de terreno de um jogador novo (login anônimo) no ponto dado, e desfaz depois.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join } from 'node:path';
const [la,lo]=(process.argv[2]||'-25.24129,-53.97795').split(',').map(Number);
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await (await nav.newContext()).newPage({viewport:{width:640,height:360}}); const log=[];
pg.on('console',m=>{ if(/tomarLote|PERMISSION|permission|warn/i.test(m.text())) log.push(m.type()+': '+m.text().slice(0,300)); });
await pg.goto('http://localhost:8737/?hora=12&sala=teste-auto');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
const r=await pg.evaluate(async([la,lo])=>{
  const nv=await import('/js/nuvem.js'), t=await import('/js/terrenos.js'), g=await import('/js/geo.js');
  for(let i=0;i<40&&!nv.nuvem.uid;i++) await new Promise(o=>setTimeout(o,500));
  const [x,z]=g.toXZ(la,lo); const l=t.lotes.reduce((a,b)=>Math.hypot(b.A[0]-x,b.A[1]-z)<Math.hypot(a.A[0]-x,a.A[1]-z)?b:a);
  const out={uid:nv.nuvem.uid, ok:nv.nuvem.ok, lote:l.id, dono:l.dono||null};
  out.r=await nv.tomarLote(l.id,'Teste');
  if(out.r==='ok'){ const D=await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js'); await D.remove(D.ref(D.getDatabase(),'lotes/'+l.id)); out.desfeito=true; }
  return out; },[la,lo]);
console.log(JSON.stringify(r)); console.log(log.join('\n')); await nav.close();
