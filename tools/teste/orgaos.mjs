// 22/11: órgãos públicos — onde cada um foi montado, erro da numeração nas ruas com âncora e fotos
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); });
await pg.goto('http://localhost:8737/?hora=11&sala=teste-auto',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:400000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForFunction(()=>window.__publicos,null,{timeout:300000,polling:1000});
const r=await pg.evaluate(async()=>{ const N=await import('/js/numeracao.js'), P=await import('/js/publicos.js'), G=await import('/js/geo.js');
  const erro={}; for(const rua of ['Avenida Duque de Caxias','Avenida Borges de Medeiros','Rua Napoleão Laureano']) erro[rua]=Math.round(N.erroDaRua(rua));
  const pos={}; for(const L of P.LUGARES){ const p=L.end?N.pontoDoEndereco(...L.end):null, [x,z]=p?[p.x,p.z]:L.ll?G.toXZ(...L.ll):[0,0]; pos[L.nome]=L.placa||[x,z,0,1]; }
  const C=await import('/js/casas.js'); const naoVende=C.casas.filter(c=>c.qg&&!/^QG/.test(c.qg)).map(c=>c.qg);
  return { naoVende, montagem:window.__publicos, erro, pos, crasConfere:N.endereco(...(()=>{ const p=N.pontoDoEndereco('Avenida Duque de Caxias',699); return [p.x,p.z]; })()) }; });
console.log(JSON.stringify(r,null,1));
for(const nome of ['CRAS','UBS CENTRAL','ESCOLA MUNICIPAL DOM BOSCO','UBS VILA NOVA']){ const [x,z,nx,nz]=r.pos[nome];
  for(const k of [0,1]){
    await pg.evaluate(([x,z,nx,nz,k])=>{ __jogo.jogador.position.set(x+nx*16,0,z+nz*16); __jogo.cam(14,0.25,Math.atan2(nx,nz)+k*Math.PI); for(const id of ['hint','ajuda','atalhos']){ const e=document.getElementById(id); if(e) e.style.display='none'; } },[x,z,nx,nz,k]);
    await pg.waitForTimeout(7000); await pg.screenshot({path:join(fotos,'orgao-'+nome.split(' ').slice(0,2).join('-').toLowerCase()+'-'+k+'.png'),timeout:240000}); }
  console.log('foto',nome); }
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
