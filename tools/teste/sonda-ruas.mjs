// despeja as ruas com nome (para calibrar a numeração métrica)
import { chromium } from 'playwright-core';
import { readdirSync, writeFileSync } from 'node:fs'; import { join } from 'node:path';
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await (await nav.newContext({viewport:{width:800,height:600}})).newPage();
await pg.goto('http://localhost:8737/?sala=teste-auto&hora=10',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
const r=await pg.evaluate(async()=>{ const c=await import('/js/cidade.js'); return c.ruas.filter(r=>r.nome&&!r.pe).map(r=>({n:r.nome,t:r.tipo,w:r.w,p:r.pts.map(p=>[+p[0].toFixed(1),+p[1].toFixed(1)])})); });
writeFileSync(process.argv[2],JSON.stringify(r)); console.log(r.length,'vias'); await nav.close();
