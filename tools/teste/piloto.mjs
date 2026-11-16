// Joga com cada piloto do Couro & Asfalto e tira foto (parado e andando).
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ids=(process.argv[2]||'piloto-estradeiro,piloto-gladius,piloto-ludwick').split(','); const erros=[];
for(const id of ids){
  const ctx=await nav.newContext({viewport:{width:640,height:360}}); await ctx.addInitScript(id=>localStorage.setItem('matelandia3d.personagem',id),id);
  const pg=await ctx.newPage(); pg.on('pageerror',e=>erros.push(id+': '+e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(id+': '+m.text().slice(0,160)); });
  await pg.goto('http://localhost:8737/?hora=12&sala=teste-auto');
  await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
  await pg.screenshot({path:join(fotos,`${id}-home.png`)});
  await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); __jogo.cam(4,0.2,0.6); });
  await pg.waitForTimeout(3000); await pg.screenshot({path:join(fotos,`${id}-jogo.png`)});
  await pg.keyboard.down('KeyW'); await pg.waitForTimeout(1200); await pg.screenshot({path:join(fotos,`${id}-andando.png`)}); await pg.keyboard.up('KeyW');
  console.log('ok',id); await ctx.close();
}
console.log(erros.length?erros.join('\n'):'sem erros'); await nav.close();
