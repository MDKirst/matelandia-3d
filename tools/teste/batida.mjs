// Noite na Vila Nova: QG marcado, barricada na rua, batida da PM com troca de tiro (19/11).
// Jogador de carro (a gangue não aborda) a ~40 m; força a batida e simula até acabar. Foto no meio do tiroteio.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); });
await pg.goto('http://localhost:8737/?hora=21&sala=teste-auto');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:300000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
const pos=await pg.evaluate(async()=>{ const G=await import('/js/gangues.js'), m=await import('/js/mundo.js');
  for(let i=0;i<200&&!G._gangues[0].moldes;i++) await new Promise(r=>setTimeout(r,500));
  const g=G._gangues[0], [a,b]=m.pontoLivre(g.c[0]+30,g.c[1]+30); __jogo.jogador.position.set(a,0,b); return [a|0,b|0]; });
const sim=(seg,forcar)=>pg.evaluate(async([seg,forcar])=>{ const G=await import('/js/gangues.js'), p=__jogo.jogador.position, log=[];
  const jog={x:p.x,z:p.z,y:0,dirigindo:true,caido:false}; let forcou=null;
  for(let t=0;t<seg;t+=0.05){ G.atualizarGangues(0.05,jog,()=>false,txt=>log.push(txt.slice(0,90))); if(forcar&&forcou===null&&G._gangues[0].membros.length) forcou=G.forcarBatida('corvos'); }
  const g=G._gangues[0], b=g.batida;
  return { forcou, log, estado:g.estado, presos:!!g.presos, membros:g.membros.length, caidos:g.membros.filter(x=>x.caido).length,
    pms:b?b.pms.length:0, pmsCaidos:b?b.pms.filter(x=>x.caido).length:0, carros:b?b.carros.length:0, t:b?+b.t.toFixed(1):null,
    barricada:g.barr?{visivel:g.barr.grupo.visible, pecas:g.barr.pontos.length}:null, qg:g.qg?.qg||null, ponto:g.ponto.map(n=>n|0) }; },[seg,forcar]);
console.log('pos',pos);
console.log('MEIO',JSON.stringify(await sim(12,true)));
// foto: câmera olhando a barricada
await pg.evaluate(async()=>{ const G=await import('/js/gangues.js'); const g=G._gangues[0], q=g.barr.q, p=__jogo.jogador.position; p.set(q[0]+g.barr.n[0]*14,0,q[1]+g.barr.n[1]*14); __jogo.cam(10,0.35,Math.atan2(g.barr.n[0],g.barr.n[1])); });
await pg.waitForTimeout(4000); await pg.screenshot({path:join(fotos,'batida.png')});
console.log('FIM',JSON.stringify(await sim(45,false)));
console.log(erros.length?erros.join('\n'):'sem erros'); await nav.close();
