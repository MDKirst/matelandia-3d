// 17/11: modo leve liga sozinho no celular (tela de toque) e o jogo roda sem erro
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx=await nav.newContext({ viewport:{width:844,height:390}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
const pg=await ctx.newPage(); const erros=[]; pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); });
const t0=Date.now(); await pg.goto('http://localhost:8737/?sala=teste-auto',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:400000});
console.log('JOGAR em',Math.round((Date.now()-t0)/1000),'s (headless)');
console.log(JSON.stringify(await pg.evaluate(async()=>{ const C=await import('/js/config.js'), cena=await import('/js/cena.js');
  return { leve:C.LEVE, caixa:document.getElementById('leveJog')?.checked, pixelRatio:cena.renderer.getPixelRatio(), far:cena.camera.far, fog:[cena.scene.fog.near,cena.scene.fog.far] }; })));
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForTimeout(12000);
await pg.screenshot({path:join(fotos,'leve-celular.png'),timeout:240000});
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
