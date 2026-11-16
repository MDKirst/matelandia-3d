// Teste automático do jogo com Playwright: abre o jogo (servidor local na porta 8737), passa por lugares e
// horários e salva fotos em tools/teste/fotos/. Também lista erros do console.
// Uso: node tools/teste/passeio.mjs [porta]   (o navegador é o Chromium que o Playwright já instalou)
import { chromium } from 'playwright-core';
import { mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui=dirname(fileURLToPath(import.meta.url)), fotos=join(aqui,'fotos'); mkdirSync(fotos,{recursive:true});
const porta=process.argv[2]||8737;
const base=join(process.env.LOCALAPPDATA,'ms-playwright');
const pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const exe=join(base,pasta,'chrome-win64','chrome.exe'); if(!existsSync(exe)) throw new Error('Chromium não achado: '+exe);

// lugares: [nome, lat, lon, yaw da câmera, distância, inclinação]
const LUGARES=[
  ['centro-rua',        -25.2398, -53.9810, 0.6, 9,  0.3],
  ['centro-alto',       -25.2398, -53.9810, 0.6, 90, 0.6],
  ['garibaldi-rampa',   -25.23765,-53.98394, 1.2, 9,  0.15],
  ['garibaldi-alto',    -25.23765,-53.98394, 1.2, 70, 0.5],
  ['campos-futebol',    -25.2443, -53.9905, 3.9, 80, 0.55],
  ['br277',             -25.2443, -53.9746, 2.0, 25, 0.3],
  ['borda-oeste',       -25.2400, -53.9950, 4.4, 40, 0.25],
];
const HORAS=[12, 18.5, 21.5];

const nav=await chromium.launch({ executablePath:exe, headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const erros=[];
for(const hora of HORAS){
  const pg=await nav.newPage({ viewport:{ width:1280, height:720 } });
  pg.on('console',m=>{ if(m.type()==='error') erros.push(`[${hora}h] ${m.text().slice(0,200)}`); });
  pg.on('pageerror',e=>erros.push(`[${hora}h] ERRO JS: ${e.message}`));
  await pg.goto(`http://localhost:${porta}/?hora=${hora}&sala=teste-auto`);
  await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
  await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
  for(const [nome,la,lo,yaw,dist,pitch] of LUGARES){
    await pg.evaluate(async([la,lo,yaw,dist,pitch])=>{ const g=await import('/js/geo.js'); const [x,z]=g.toXZ(la,lo); __jogo.jogador.position.set(x,0,z); __jogo.cam(dist,pitch,yaw); },[la,lo,yaw,dist,pitch]);
    await pg.waitForTimeout(2500);                                     // satélite e prédios carregam
    const arq=join(fotos,`${nome}-${String(hora).replace('.','_')}h.png`); await pg.screenshot({ path:arq });
    console.log('foto', arq);
  }
  await pg.close();
}
await nav.close();
console.log(erros.length?`\n${erros.length} erro(s):\n`+[...new Set(erros)].join('\n'):'\nsem erros no console');
