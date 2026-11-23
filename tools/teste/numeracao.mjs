// numeração métrica: âncoras reais, par/ímpar por lado, número crescendo ao longo da rua, endereços das entregas
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join } from 'node:path';
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await (await nav.newContext({viewport:{width:800,height:600}})).newPage(); const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
await pg.goto('http://localhost:8737/?sala=teste-auto&hora=10',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
const r=await pg.evaluate(async()=>{
  const N=await import('/js/numeracao.js'), C=await import('/js/cidade.js'); const out={};
  out.prefeitura=N.endereco(272,20); out.cemiterio=N.endereco(-1175,499); out.cemiterioOutroLado=N.endereco(-1192,499);
  const t0=performance.now(); let ruim=0, total=0, lados=0, parOk=0;
  for(const r of C.ruas.filter(r=>r.nome&&!r.pe&&r.tipo!=='motorway')){
    const P=r.pts; let ant=null;
    for(let i=0;i<P.length-1;i++) for(const s of [0.25,0.75]){ const a=P[i], b=P[i+1], dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1, o=r.w/2+1.2;
      const x=a[0]+dx*s, z=a[1]+dz*s, d=N.endereco(x-dz/L*o,z+dx/L*o), e=N.endereco(x+dz/L*o,z-dx/L*o);
      if(!d||!e||d.rua!==r.nome||e.rua!==r.nome) continue; total++;
      if(d.par!==e.par){ lados++; } if((d.num%2===0)===d.par&&(e.num%2===0)===e.par) parOk++;
      if(Math.abs(d.num-e.num)>4) ruim++; }
  }
  out.amostras={total, ladosOpostos:lados, paridadeCerta:parOk, fronteiraDiferente:ruim, ms:Math.round(performance.now()-t0)};
  const E=await import('/js/entregas.js'); return out; });
console.log(JSON.stringify(r,null,1)); console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
