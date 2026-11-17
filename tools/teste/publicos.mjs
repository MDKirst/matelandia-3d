// 17/11: bancos, polícias, prédios públicos e Parque Farroupilha. Lista antiga de terrenos em argv[2].
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const antes=process.argv[2]?JSON.parse(readFileSync(process.argv[2],'utf8')).idsLotes:null;
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[], info=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); if(/bancos\/pol/.test(m.text())) info.push(m.text()); });
await pg.goto('http://localhost:8737/?hora=11&sala=teste-auto',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:400000});
const ids=await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; const T=await import('/js/terrenos.js'); return T.lotes.map(l=>l.id); });
await pg.evaluate(()=>{ document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForFunction(()=>window.__publicos,null,{timeout:300000,polling:1000});
info.push(JSON.stringify(await pg.evaluate(()=>window.__publicos)));
if(antes){ console.log('TERRENOS antes',antes.length,'agora',ids.length,'sumiram',JSON.stringify(antes.filter(i=>!ids.includes(i)))); }
console.log('MONTAGEM',info.join(' | ').slice(0,1500));
await pg.waitForTimeout(3000);
const foto=async(nome,x,z,d,p,y)=>{ await pg.evaluate(([x,z,d,p,y])=>{ __jogo.jogador.position.set(x,0,z); __jogo.cam(d,p,y); },[x,z,d,p,y]); await pg.waitForTimeout(9000); await pg.screenshot({path:join(fotos,nome),timeout:240000}); console.log('foto',nome); };
await foto('pm.png',-522,100,30,0.35,Math.PI);
await foto('parque.png',-586,-78,110,1.35,0);
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
