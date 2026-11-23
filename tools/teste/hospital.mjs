// 22/11: Hospital e Maternidade Padre Tezza (Av. Duque de Caxias × R. Alfredo Chaves) — fotos de frente e da esquina
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
// frente: n (para dentro) = (0.0715,-0.9975); fora = -n
const A=[-724.6,-47.3], t=[0.9975,0.0715], n=[0.0715,-0.9975], W=(u,v)=>[A[0]+t[0]*u+n[0]*v, A[1]+t[1]*u+n[1]*v];
const tiros=[['hospital-frente',...W(26,-16),20,0.18],['hospital-esquina',...W(62,-16),24,0.2],['hospital-cima',...W(26,6),75,0.8]];
for(const [nome,x,z,d,p] of tiros) for(const k of [0,1]){
  await pg.evaluate(([x,z,d,p,y])=>{ const J=window.__jogo; J.jogador.position.set(x,0,z); J.cam(d,p,y); for(const id of ['hint','ajuda','atalhos']){ const e=document.getElementById(id); if(e) e.style.display='none'; } },[x,z,d,p,Math.atan2(n[0],n[1])+k*Math.PI]);
  await pg.waitForTimeout(6000); await pg.screenshot({path:join(fotos,`${nome}-${k}.png`),timeout:240000}); console.log('ok',nome,k);
}
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
