// 21/11: moradores com história — passa um morador pelos 5 níveis, junta 7 peças e roda o final.
// uso: NODE_PATH=tools/teste/node_modules node tools/teste/moradores.mjs [largura altura]
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const W=+(process.argv[2]||1280), H=+(process.argv[3]||720), cel=W<600, tag=cel?'cel':'pc';
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await (await nav.newContext({ viewport:{width:W,height:H}, isMobile:cel, hasTouch:cel })).newPage();
const erros=[]; pg.on('pageerror',e=>erros.push(e.message)); pg.on('response',r=>{ if(r.status()>=400) erros.push(r.status()+' '+r.url()); }); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); });
await pg.addInitScript(()=>{ if(!sessionStorage.getItem('limpo')){ localStorage.removeItem('matelandia3d.moradores'); sessionStorage.setItem('limpo','1'); } });
await pg.goto('http://localhost:8737/?sala=teste-moradores',{waitUntil:'domcontentloaded',timeout:120000});
for(let tent=0;;tent++){ try{
  await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
  await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; const o=document.getElementById('onlineJog'); if(o) o.checked=false; document.getElementById('jogar').click(); }); break;
} catch(e){ if(tent>=2) throw e; console.log('recarregou, tentando de novo:',e.message.slice(0,80)); } }
await pg.waitForFunction(async()=>{ const P=await import('/js/pedestres.js'); return P.pedestresVivos().some(p=>p.modelo); },null,{timeout:300000});
// prepara: raio grande (jogador parado longe), escolhe a Dona Maria se houver
const quem=await pg.evaluate(async()=>{ const M=await import('/js/moradores.js'), P=await import('/js/pedestres.js'); M._teste.raio=1e9;
  const vivos=P.pedestresVivos().filter(p=>M._teste.MORADORES[p.modelo?.nome]); const p=vivos.find(p=>p.modelo.nome==='dona-maria')||vivos[0];
  window.__p=p; return p.modelo.nome; });
console.log('morador:',quem);
const clicar=n=>pg.evaluate(n=>document.querySelectorAll('#papo button')[n]?.click(),n);
const texto=()=>pg.evaluate(()=>document.getElementById('papo')?.classList.contains('on')?document.getElementById('papo').innerText.replace(/\n+/g,' | ').slice(0,160):'(fechado)');
const abrir=()=>pg.evaluate(async()=>{ const M=await import('/js/moradores.js'), P=await import('/js/pedestres.js'); M._teste.dados.ultima={}; return M._teste.abrirMorador(window.__p,P.falar); });
for(let nivel=0;nivel<5;nivel++){
  console.log('abriu:',await abrir()); console.log(' ',await texto());
  if(nivel===0||nivel===3) await pg.screenshot({path:join(fotos,`moradores-${tag}-n${nivel}.png`),timeout:300000});
  const passos=nivel===3?3:1;
  for(let s=0;s<passos;s++){ await clicar(s===0&&nivel===0?2:0); console.log('  reação:',await texto()); await clicar(0); }
  if(nivel===0){ console.log(' grosseria → nível', await pg.evaluate(async()=>{ const M=await import('/js/moradores.js'); return M._teste.dados.amizade[window.__p.modelo.nome]||0; }));
    await abrir(); await clicar(0); await clicar(0); }
  console.log(' nível agora', await pg.evaluate(async()=>{ const M=await import('/js/moradores.js'); return [M._teste.dados.amizade[window.__p.modelo.nome], M._teste.dados.pecas.length]; }));
}
await abrir(); console.log('nível 5:',await texto()); await clicar(0);
// 7 peças → final
console.log('final:', await pg.evaluate(async()=>{ const M=await import('/js/moradores.js'); M._teste.dados.pecas=Object.keys(M._teste.MORADORES).slice(0,7); M._teste.finalPlano(); return document.getElementById('papo').innerText.slice(0,120); }));
for(let i=0;i<2;i++) await clicar(0);
await pg.waitForTimeout(300); await pg.screenshot({path:join(fotos,`moradores-${tag}-final.png`),timeout:300000});
for(let i=0;i<10;i++) await clicar(0);
console.log('depois do final:', await pg.evaluate(async()=>{ const M=await import('/js/moradores.js'), C=await import('/js/conquistas.js'); return { final:M._teste.dados.final, conquista:C.tem('outro_lado'), aberto:document.getElementById('papo').classList.contains('on') }; }));
await pg.evaluate(()=>localStorage.removeItem('matelandia3d.moradores'));
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
