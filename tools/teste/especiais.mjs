// 17/11: postos, balada e prefeitura. Confere que os terrenos de sempre não mudaram de id (arquivo com a lista antiga em argv[2]).
import { chromium } from 'playwright-core';
import { readdirSync, readFileSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const antes=process.argv[2]?JSON.parse(readFileSync(process.argv[2],'utf8')).idsLotes:null;
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); });
await pg.goto('http://localhost:8737/?hora=11&sala=teste-auto',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:400000});
const r=await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; const T=await import('/js/terrenos.js'), M=await import('/js/mundo.js');
  const esp=T.lotes.filter(l=>l.especial);
  return { ids:T.lotes.map(l=>l.id), esp:esp.map(l=>({id:l.id,nome:l.especial.nome,dica:T.dicaTerreno(l.cx,l.cz),bloqueia:M.bloqueado(l.A[0]+l.t[0]*19.5+l.n[0]*18,l.A[1]+l.t[1]*19.5+l.n[1]*18)})) }; });
if(antes){ const novos=r.ids.filter(i=>!antes.includes(i)), sumiram=antes.filter(i=>!r.ids.includes(i)); console.log('TERRENOS antes',antes.length,'agora',r.ids.length,'sumiram',JSON.stringify(sumiram),'novos',JSON.stringify(novos)); }
console.log('ESPECIAIS',JSON.stringify(r.esp,null,0));
await pg.evaluate(async()=>{ document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForTimeout(5000);
const foto=async(nome,fn)=>{ await pg.evaluate(fn); await pg.waitForTimeout(9000); await pg.screenshot({path:join(fotos,nome),timeout:240000}); console.log('foto',nome); };
await foto('posto.png',async()=>{ const T=await import('/js/terrenos.js'); const l=T.lotes.find(l=>l.especial?.tipo==='posto');
  const x=l.A[0]+l.t[0]*12-l.n[0]*6, z=l.A[1]+l.t[1]*12-l.n[1]*6; __jogo.jogador.position.set(x,0,z); __jogo.cam(16,0.3,Math.atan2(-l.n[0],-l.n[1])); });
await foto('balada.png',async()=>{ const T=await import('/js/terrenos.js'); const l=T.lotes.find(l=>l.especial?.tipo==='balada');
  const x=l.A[0]+l.t[0]*15-l.n[0]*6, z=l.A[1]+l.t[1]*15-l.n[1]*6; __jogo.jogador.position.set(x,0,z); __jogo.cam(18,0.25,Math.atan2(-l.n[0],-l.n[1])); });
await foto('prefeitura.png',async()=>{ __jogo.jogador.position.set(306,0,4); __jogo.cam(34,0.28,Math.atan2(0.996,0.086)); });
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
