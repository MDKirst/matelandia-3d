// 20/11: Dona Maria (pedestre IA + Mixamo) nasce, anda devagar e o clipe 'andar' acompanha (pé não patina).
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join } from 'node:path';
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); });
await pg.goto('http://localhost:8737/?hora=10&sala=teste-auto',{timeout:180000,waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForFunction(async()=>{ const P=await import('/js/pedestres.js'); return P.pedestresVivos().length>5; },null,{timeout:120000,polling:1000});
await pg.waitForTimeout(15000);   // o resto dos modelos chega aos poucos
console.log('DONA MARIA', JSON.stringify(await pg.evaluate(async()=>{
  const P=await import('/js/pedestres.js'), p0=__jogo.jogador.position, jog={x:p0.x,z:p0.z,dirigindo:false,v:0};
  // simula até aparecer uma Dona Maria andando (gente some e renasce longe do jogador → anda com o jogador)
  let dm=null; for(let t=0;t<600&&!dm;t+=0.1){ jog.x+=0.4; P.atualizarPedestres(0.1,jog); dm=P.pedestresVivos().find(p=>p.modelo.nome==='dona-maria'&&p.modo==='andar'); }
  if(!dm) return { achou:false, modelos:[...new Set(P.pedestresVivos().map(p=>p.modelo.nome))] };
  const r={ achou:true, vel:+dm.vel.toFixed(2), alt:+(dm.obj.scale.y).toFixed(3) }; let dist=0, n=0, ts=[];
  for(let i=0;i<100;i++){ const x=dm.x,z=dm.z; P.atualizarPedestres(0.05,{...jog}); if(dm.modo!=='andar') continue; dist+=Math.hypot(dm.x-x,dm.z-z); n++; if(dm.atual) ts.push(dm.atual.timeScale); }
  r.mps=+(dist/(n*0.05)).toFixed(2); r.timeScale=+(ts.reduce((a,b)=>a+b,0)/(ts.length||1)).toFixed(2); r.clipeMps=+(0.25*r.timeScale).toFixed(2);
  return r; })));
console.log('ERROS', erros.length? erros : 'nenhum');
await nav.close();
