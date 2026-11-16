// Foto de um comércio aberto à noite (de fora e de dentro), para conferir a luz.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos'), hora=process.argv[2]||21.5;
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
await pg.goto(`http://localhost:8737/?hora=${hora}&sala=teste-auto`);
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
await pg.waitForTimeout(4000);
const info=await pg.evaluate(async()=>{ const t=await import('/js/terrenos.js'); const nv=await import('/js/nuvem.js');
  const l=t.lotes.find(l=>l.negocio&&l.negocio!=='oficina')||t.lotes.find(l=>l.negocio); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click();
  if(!l) return null; window.__l=l; return l.id+' '+l.negocio; });
console.log('loja',info);
if(info){
  for(const [nome,u,v,d,p,yawExtra] of [['fora',6,-6,9,0.25,0],['dentro',6,3,6,0.12,0]]){
    await pg.evaluate(([u,v,d,p,ye])=>{ const l=window.__l; const x=l.A[0]+l.t[0]*u+l.n[0]*v, z=l.A[1]+l.t[1]*u+l.n[1]*v;
      __jogo.jogador.position.set(x,0,z); const yaw=Math.atan2(-l.n[0],-l.n[1])+ye; __jogo.cam(d,p,yaw); },[u,v,d,p,yawExtra]);
    await pg.waitForTimeout(2500); await pg.screenshot({path:join(fotos,`loja-${nome}-${hora}.png`)}); console.log('foto',nome);
  }
}
console.log(erros.length?erros.join('\n'):'sem erros'); await nav.close();
