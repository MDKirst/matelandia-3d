// salva (ou compara) a lista de terrenos: nenhuma obra nova pode mudar terreno de lugar.  uso: node lotes-ids.mjs arquivo.json [comparar]
import { chromium } from 'playwright-core';
import { readdirSync, writeFileSync, readFileSync } from 'node:fs'; import { join } from 'node:path';
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg=await nav.newPage();
await pg.goto('http://localhost:8737/?sala=teste-auto&hora=10',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
const ids=await pg.evaluate(async()=>{ const T=await import('/js/terrenos.js'); return T.lotes.map(l=>l.id).sort(); });
if(process.argv[3]){ const antes=JSON.parse(readFileSync(process.argv[2],'utf8'));
  console.log('antes',antes.length,'agora',ids.length,'sumiram',JSON.stringify(antes.filter(i=>!ids.includes(i))),'novos',JSON.stringify(ids.filter(i=>!antes.includes(i)))); }
else { writeFileSync(process.argv[2],JSON.stringify(ids)); console.log('salvos',ids.length); }
await nav.close();
