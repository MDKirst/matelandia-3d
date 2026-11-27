// 27/11: morador refeito por IA (Stable Fast 3D + Mixamo) aparece andando na rua, de pé, sem erro.
// uso (com tools/servidor.py 8737 no ar): node tools/teste/morador.mjs <id do modelo, ex.: male-suit-24>
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join } from 'node:path';
const ID = process.argv[2] || 'dona-maria';
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error'&&!/404/.test(m.text())) erros.push(m.text().slice(0,200)); });
// ?pessoa=<id>: a rua inteira só com esse modelo
await pg.goto(`http://localhost:8737/?hora=10&sala=teste-auto&pessoa=${ID}`,{timeout:180000,waitUntil:'domcontentloaded'});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForFunction(async()=>{ const P=await import('/js/pedestres.js'); return P.pedestresVivos().length>3; },null,{timeout:120000,polling:1000});
await pg.waitForTimeout(8000);
console.log('MORADOR', ID, JSON.stringify(await pg.evaluate(async(ID)=>{
  const P=await import('/js/pedestres.js'), M=await import('/js/moradores.js'), p0=__jogo.jogador.position, jog={x:p0.x,z:p0.z,dirigindo:false,v:0};
  let p=null; for(let t=0;t<600&&!p;t+=0.1){ jog.x+=0.4; P.atualizarPedestres(0.1,jog); p=P.pedestresVivos().find(q=>q.modelo.nome===ID&&q.modo==='andar'); }
  if(!p) return { achou:false, modelos:[...new Set(P.pedestresVivos().map(q=>q.modelo.nome))] };
  const THREE=await import('three'); p.obj.updateMatrixWorld(true); const b=new THREE.Box3().setFromObject(p.obj,true);
  const r={ achou:true, nome:M.MORADORES?.[ID]?.nome, altura:+(b.max.y-b.min.y).toFixed(2), clipes:Object.keys(p.acoes) }; let dist=0, n=0;
  for(let i=0;i<100;i++){ const x=p.x,z=p.z; P.atualizarPedestres(0.05,{...jog}); if(p.modo!=='andar') continue; dist+=Math.hypot(p.x-x,p.z-z); n++; }
  r.mps=+(dist/((n||1)*0.05)).toFixed(2); return r; }, ID)));
console.log('ERROS', erros.length? erros : 'nenhum');
await nav.close();
