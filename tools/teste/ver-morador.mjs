// 27/11: foto dos clipes de um morador novo (ver-pessoa.html), frente e lado. uso: node ver-morador.mjs <id> <saida-sem-ext> [comparar]
import { chromium } from 'playwright-core';
import { readdirSync, writeFileSync } from 'node:fs'; import { join } from 'node:path';
const [id, saida, comp='dona-maria'] = process.argv.slice(2);
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:1400,height:500}}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); });
await pg.goto(`http://localhost:8737/tools/ver-pessoa.html?m=${id}&c=${comp}`,{timeout:120000});
await pg.waitForFunction(()=>window.__info?.length>=6,null,{timeout:60000});
console.log(JSON.stringify(await pg.evaluate(()=>window.__info)));
for(const [nome,ang,t] of [['frente',0,0.4],['lado',Math.PI/2,0.4],['andando',0.35,0.9]]){
  const url=await pg.evaluate(([a,t])=>window.__quadro(t,a),[ang,t]); writeFileSync(`${saida}-${nome}.jpg`, Buffer.from(url.split(',')[1],'base64'));
}
console.log('ERROS', erros.length?erros:'nenhum'); await nav.close();
