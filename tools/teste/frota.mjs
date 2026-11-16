// Foto da frota estacionada e de uma viatura chamada (procurado), para conferir os modelos.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:640,height:360}}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error'||/veículo/.test(m.text())) erros.push(m.text().slice(0,200)); });
await pg.goto('http://localhost:8737/?hora=12&sala=teste-auto');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForTimeout(2000);
const info=await pg.evaluate(()=>__jogo.frota.map(c=>`${c.tipo.id} ${c.obj.position.x.toFixed(0)},${c.obj.position.z.toFixed(0)} ${c.comp.toFixed(1)}m`));
console.log(info.join('\n'));
for(const id of ['hatch','trail','urbana']){
  await pg.evaluate(id=>{ const c=__jogo.frota.find(c=>c.tipo.id===id); __jogo.jogador.position.set(c.obj.position.x+3,0,c.obj.position.z+3); __jogo.cam(7,0.35,0.8); },id);
  await pg.waitForTimeout(1500); await pg.screenshot({path:join(fotos,`frota-${id}.png`),timeout:60000}); console.log('foto',id);
}
await pg.evaluate(async()=>{ const p=await import('/js/policia.js'); p.crime(3,'teste'); });
for(let i=0;i<10;i++){ await pg.waitForTimeout(1500); const n=await pg.evaluate(async()=>{ const p=await import('/js/policia.js'); return p.policia.carros.length; }); if(n) break; }
await pg.evaluate(async()=>{ const p=await import('/js/policia.js'); const c=p.policia.carros[0]; if(!c) return; __jogo.jogador.position.set(c.obj.position.x+4,0,c.obj.position.z+4); __jogo.cam(8,0.3,0.8); });
await pg.waitForTimeout(800); await pg.screenshot({path:join(fotos,'viatura.png')});
console.log(erros.length?erros.join('\n'):'sem erros'); await nav.close();
