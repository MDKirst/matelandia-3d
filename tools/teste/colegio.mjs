// 21/11: foto da esquina do Colégio Euclides (Av. Paraná × Napoleão Laureano)
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await (await nav.newContext({viewport:{width:1280,height:720}})).newPage(); const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
await pg.goto('http://localhost:8737/?sala=teste-auto&hora=10',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; const o=document.getElementById('onlineJog'); if(o) o.checked=false; document.getElementById('jogar').click(); });
await pg.waitForFunction(()=>window.__jogo,null,{timeout:200000});
const tiros=[['cemiterio-portao',-1175,499,15,0.2,1.35],['cemiterio-cima',-1180,470,70,0.75,0.6],['cemiterio-dentro',-1215,505,10,0.3,1.7]];
for(const [nome,x,z,d,p,y] of tiros){
  await pg.evaluate(([x,z,d,p,y])=>{ const J=window.__jogo; J.jogador.position.set(x,0,z); J.cam(d,p,y); for(const k of ['hint','ajuda','atalhos']){ const e=document.getElementById(k); if(e) e.style.display='none'; } },[x,z,d,p,y]);
  await pg.waitForTimeout(6000);
  await pg.screenshot({path:join(fotos,nome+'.png'),timeout:240000}); console.log('ok',nome);
}
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
