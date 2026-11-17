// Fotos: árvores nas calçadas (quantas e como ficam) e o interior da casa com os móveis novos.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[], logs=[]; pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(/marcos/.test(m.text())) logs.push(m.text()); });
const t0=Date.now(); await pg.goto('http://localhost:8737/?hora=12&sala=teste-auto');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:180000});
console.log('carregou em',Math.round((Date.now()-t0)/1000),'s ·',logs.join(' '));
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForTimeout(3000);
const info=await pg.evaluate(async()=>{ const { scene }=await import('/js/cena.js'); let inst=0, n=0; scene.traverse(o=>{ if(o.isInstancedMesh&&o.geometry.type==='IcosahedronGeometry'){ inst++; n+=o.count; } }); return {malhas:inst, copas:n}; });
console.log('copas instanciadas',JSON.stringify(info));
for(const [nome,la,lo,yaw,d,p] of [['rua1',-25.2443,-53.9746,2.0,14,0.25],['rua2',-25.2405,-53.9800,0.8,18,0.35],['alto',-25.2443,-53.9746,1.2,90,0.7]]){
  await pg.evaluate(async([la,lo,yaw,d,p])=>{ const g=await import('/js/geo.js'); const { pontoLivre }=await import('/js/mundo.js'); const [x,z]=g.toXZ(la,lo); const [a,b]=pontoLivre(x,z); __jogo.jogador.position.set(a,0,b); __jogo.cam(d,p,yaw); },[la,lo,yaw,d,p]);
  await pg.waitForTimeout(3000); await pg.screenshot({path:join(fotos,`arvores-${nome}.png`)}); }
// casa
const ok=await pg.evaluate(async()=>{ const c=await import('/js/casas.js'); const nv=await import('/js/nuvem.js'); const p=__jogo.jogador.position;
  const casa=c.casas.sort((a,b)=>Math.hypot(a.cx-p.x,a.cz-p.z)-Math.hypot(b.cx-p.x,b.cz-p.z))[0]; nv.nuvem.uid=nv.nuvem.uid||'teste'; casa.dono=nv.nuvem.uid; casa.porta??=c.acharPorta(casa);
  p.set(casa.porta[0],0,casa.porta[1]); return c.entrarCasa(__jogo.jogador,casa.porta[0],casa.porta[1]); });
console.log('entrou na casa',ok);
for(const [nome,yaw,d,p] of [['casa-cima',0,13,1.3],['casa-sala',2.4,8,0.75],['casa-quarto',3.6,8,0.8],['casa-banheiro',-0.8,8,0.85]]){
  await pg.evaluate(([yaw,d,p])=>__jogo.cam(d,p,yaw),[yaw,d,p]); await pg.waitForTimeout(2500); await pg.screenshot({path:join(fotos,`${nome}.png`)}); }
// porta do quarto livre? (meio do vão, dos dois lados)
const passa=await pg.evaluate(async()=>{ const c=await import('/js/casas.js'); const d=c.casa.dentro; return [[2.6,0.4],[2.6,0],[2.6,-0.4]].map(([x,z])=>!c.bloqueioCasa(d.cx+x,d.cz+z)); });
console.log('vão da porta do quarto livre',passa);
console.log(erros.length?'ERROS:\n'+erros.join('\n'):'sem erros de página'); await nav.close();
