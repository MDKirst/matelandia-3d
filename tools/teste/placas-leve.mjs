// 21/11: salva algumas placas/letreiros do modo leve para ver se ficaram legíveis
import { chromium } from 'playwright-core';
import { readdirSync, writeFileSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const pg=await (await nav.newContext({viewport:{width:812,height:375},isMobile:true,hasTouch:true})).newPage();
await pg.goto('http://localhost:8737/?sala=teste-auto&leve=1',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
const url=await pg.evaluate(async()=>{ const {scene}=await import('/js/cena.js'); const quer={'256x128':1,'512x64':1,'128x160':1,'512x192':1,'1024x1024':1}; const achados=[];
  scene.traverse(x=>{ for(const m of [].concat(x.material||[])) { const t=m.map; const i=t&&t.image; if(!i||!i.width||i.tagName!=='CANVAS') continue; const d=i.width+'x'+i.height; if(quer[d]){ quer[d]=0; achados.push(i); } } });
  const W=1100, cv=document.createElement('canvas'); cv.width=W; cv.height=achados.reduce((s,i)=>s+Math.min(i.height,560)+10,0); const k=cv.getContext('2d'); k.fillStyle='#888'; k.fillRect(0,0,W,cv.height);
  let y=0; for(const i of achados){ const h=Math.min(i.height,560); k.drawImage(i,0,0,i.width,h,0,y,i.width,h); y+=h+10; } return cv.toDataURL(); });
writeFileSync(join(fotos,'placas-leve.png'),Buffer.from(url.split(',')[1],'base64')); console.log('ok'); await nav.close();
