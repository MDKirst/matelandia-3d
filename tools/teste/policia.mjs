// 22/11: polícia com 5 estrelas, viaturas por nível, helicóptero, 4 PMs, estrela que sobe na fuga, prisão
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
console.log(JSON.stringify(await pg.evaluate(async()=>{
  const P=await import('/js/policia.js'); const J=window.__jogo, p=J.jogador.position; const r={};
  const jog=()=>({x:p.x,z:p.z,dirigindo:false,v:0}); let presos=0; const prender=()=>{ presos++; };
  const passo=(seg,j=jog)=>{ for(let t=0;t<seg;t+=0.05) P.atualizarPolicia(0.05,j(),prender); };
  { P.crime(1,'teste'); let pm=0, quando=null; const dentro=()=>({x:p.x,z:p.z,dirigindo:true,v:0});   // parado no carro: descem, mas não prendem
    for(let t=0;t<15;t+=0.05){ P.atualizarPolicia(0.05,dentro(),prender); const n=P.policia.carros.reduce((a,c)=>a+c.guardas.length,0); if(n>pm){ pm=n; quando=+t.toFixed(1); } }
    r.pms={ desceram:pm, aos:quando+' s', presos }; P.perdoar(); }
  P.crime(2,'teste'); passo(6); r.estrelas2={estrelas:P.policia.estrelas, viaturas:P.policia.carros.length, heli:!!P.policia.heli, hud:document.getElementById('procurado').textContent};
  P.crime(2,'teste'); passo(6); r.estrelas4={estrelas:P.policia.estrelas, viaturas:P.policia.carros.length, heli:!!P.policia.heli};
  // fuga com a polícia vendo: +1 estrela em 35 s (longe do jogador para ninguém prender)
  const longe=()=>({x:p.x,z:p.z,dirigindo:true,v:30}); const e0=P.policia.estrelas; passo(36,longe); r.fuga={antes:e0, depois:P.policia.estrelas, heli:!!P.policia.heli};
  // a pé e parado: viatura chega, descem os PMs e prendem
  let maxPM=0, tPM=null, distMin=1e9; const t0=performance.now();
  for(let t=0;t<90&&!presos;t+=0.05){ P.atualizarPolicia(0.05,jog(),prender);
    for(const c of P.policia.carros){ if(c.guardas.length>maxPM){ maxPM=c.guardas.length; tPM=+t.toFixed(2); } distMin=Math.min(distMin,Math.hypot(c.x-p.x,c.z-p.z)); } }
  r.molde=!!P.moldesPolicia().pm; r.tPM=tPM; r.distMinViatura=+distMin.toFixed(1);
  r.prisao={presos, maxPMsPorViatura:maxPM, estrelasDepois:P.policia.estrelas, heliDepois:!!P.policia.heli};
  return r; }),null,1));
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
