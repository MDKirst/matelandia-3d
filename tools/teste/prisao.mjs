// 22/11: cena da prisão — derrubam, algemam, levam ao camburão, aparece detido na delegacia
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await (await nav.newContext({viewport:{width:1280,height:720}})).newPage(); const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
await pg.goto('http://localhost:8737/?sala=teste-auto&hora=11',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; const o=document.getElementById('onlineJog'); if(o) o.checked=false; document.getElementById('jogar').click(); });
await pg.waitForFunction(()=>window.__jogo,null,{timeout:200000});
const passo=(seg)=>pg.evaluate(async(seg)=>{ const P=await import('/js/policia.js'); const J=window.__jogo, p=J.jogador.position;
  for(let t=0;t<seg;t+=0.05){ P.atualizarPolicia(0.05,{x:p.x,z:p.z,dirigindo:false,v:0},J.prender); if(seg>=20&&P.policia.cena) break; }
  const c=P.policia.cena; return c?{t:+c.t.toFixed(2),algema:c.algema?c.algema.length:null,andando:c.andando,caido:+J.vida.caido.toFixed(1),pms:c.gs.length}:{cena:null,detido:+J.detido().toFixed(1),estrelas:P.policia.estrelas}; },seg);
console.log('chegada', JSON.stringify(await pg.evaluate(async()=>{ const P=await import('/js/policia.js'); const J=window.__jogo, r=J.ruas.find(r=>!r.pe&&r.w>=8&&r.nome&&r.pts.length>3); const q=r.pts[2]; J.jogador.position.set(q[0],0,q[1]); P.crime(1,'teste'); J.cam(4.5,0.3,0.6); return P.policia.estrelas; })));
console.log('cena', JSON.stringify(await passo(150)));
const fase=async(seg,nome)=>{ const r=await passo(seg); await pg.waitForTimeout(3500); await pg.screenshot({path:join(fotos,nome+'.png'),timeout:240000}); console.log(nome, JSON.stringify(r)); };
await fase(0.7,'prisao-1-golpe'); await fase(1.6,'prisao-2-algema'); await fase(3.2,'prisao-3-camburao');
console.log('fim', JSON.stringify(await passo(15)));
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
