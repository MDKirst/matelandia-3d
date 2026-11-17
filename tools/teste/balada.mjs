// 17/11: dentro da balada (pista de luz, DJ, bar sem álcool, gente dançando) à noite
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[]; pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error'||/balada/.test(m.text())) erros.push(m.text().slice(0,200)); });
await pg.goto('http://localhost:8737/?hora=22&sala=teste-auto',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:400000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForTimeout(3000);
const lugar=await pg.evaluate(async()=>{ const T=await import('/js/terrenos.js'); const l=T.lotes.find(l=>l.especial?.tipo==='balada'); const w=(u,v)=>[l.A[0]+l.t[0]*u+l.n[0]*v, l.A[1]+l.t[1]*u+l.n[1]*v];
  const [x,z]=w(15,8.5); __jogo.jogador.position.set(x,0,z); return {x,z,yaw:Math.atan2(-l.n[0],-l.n[1])}; });
// espera os dançarinos carregarem (atualizar na mão: headless quase não roda quadro)
await pg.evaluate(async()=>{ const E=await import('/js/especiais.js'); for(let i=0;i<40;i++){ E.atualizarEspeciais(0.05); await new Promise(r=>setTimeout(r,500)); } });
console.log('GENTE',await pg.evaluate(async()=>{ const E=await import('/js/especiais.js'); return 'ok'; }));
for(const [nome,d,p,dy] of [['balada-dentro.png',7,0.22,0],['balada-bar.png',6,0.25,-1.2]]){
  await pg.evaluate(([x,z,yaw,d,p,dy])=>{ __jogo.jogador.position.set(x,0,z); __jogo.cam(d,p,yaw+dy); },[lugar.x,lugar.z,lugar.yaw,d,p,dy]);
  await pg.evaluate(async()=>{ const E=await import('/js/especiais.js'); for(let i=0;i<6;i++) E.atualizarEspeciais(0.12); });
  await pg.waitForTimeout(8000); await pg.screenshot({path:join(fotos,nome),timeout:240000}); console.log('foto',nome); }
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
