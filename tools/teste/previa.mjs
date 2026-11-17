// 17/11: a prévia do personagem na tela inicial aparece (o relevo a empurrava para fora da câmera)
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:1280,height:720}}); const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
const t0=Date.now(); await pg.goto('http://localhost:8737/?sala=teste-auto',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:400000});
console.log('JOGAR em',Math.round((Date.now()-t0)/1000),'s (headless, sem placa de vídeo)');
await pg.waitForTimeout(8000);
const r=await pg.$('#prev').then(e=>e.boundingBox()); await pg.screenshot({path:join(fotos,'previa.png'),clip:r,timeout:240000});
const px=await pg.evaluate(()=>{ const c=document.getElementById('prev'), o=document.createElement('canvas'); o.width=c.width; o.height=c.height; const k=o.getContext('2d'); k.drawImage(c,0,0); const d=k.getImageData(0,0,o.width,o.height).data; let n=0; for(let i=3;i<d.length;i+=4) if(d[i]>20) n++; return n; });
console.log('pixels desenhados na prévia:',px); console.log(erros.length?erros.join('\n'):'sem erros'); await nav.close();
