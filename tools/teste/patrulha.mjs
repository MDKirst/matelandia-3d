// Fotos das viaturas da patrulha no trânsito (dia e noite).
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const erros=[];
for(const hora of [12,22]){
  const pg=await nav.newPage({viewport:{width:960,height:540}}); pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,160)); });
  await pg.goto(`http://localhost:8737/?hora=${hora}&sala=teste-auto`);
  await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
  await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
  await pg.waitForTimeout(3000);
  for(const k of [0,1]){
    const info=await pg.evaluate(k=>{ return import('/js/transito.js').then(T=>{ const c=T.carros.filter(c=>c.giro&&c.r)[k]; if(!c) return 'sem viatura '+T.carros.filter(c=>c.giro).length;
      const o=c.obj.position, h=c.obj.rotation.y; __jogo.jogador.position.set(o.x+Math.cos(h)*6,0,o.z-Math.sin(h)*6); __jogo.cam(9,0.25,h+2.4); return 'ok'; }); },k);
    await pg.waitForTimeout(1500); await pg.screenshot({path:join(fotos,`patrulha-${hora}-${k}.png`)}); console.log(hora,k,info);
  }
  await pg.close();
}
console.log(erros.length?erros.join('\n'):'sem erros'); await nav.close();
