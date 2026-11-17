// Noite na Vila Nova: entra a pé, a gangue aborda, responde 4 ("não te devo satisfação") e eles atiram.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos'), [la,lo]=(process.argv[2]||'-25.2422,-53.9916').split(',').map(Number), resp=process.argv[3]||'4';
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error'||/gangue/i.test(m.text())) erros.push(m.text().slice(0,200)); });
await pg.goto('http://localhost:8737/?hora=21&sala=teste-auto');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.evaluate(async([la,lo])=>{ const g=await import('/js/geo.js'), m=await import('/js/mundo.js'); const [x,z]=g.toXZ(la,lo); const [a,b]=m.pontoLivre(x+40,z+40); __jogo.jogador.position.set(a,0,b); __jogo.cam(9,0.35,0.8); },[la,lo]);
const sim=(seg,resp)=>pg.evaluate(async([seg,resp])=>{ const G=await import('/js/gangues.js'), L=await import('/js/luta.js'); const p=__jogo.jogador.position, log=[];
  const jog={x:p.x,z:p.z,y:0,dirigindo:false,caido:false};
  for(let t=0;t<seg;t+=0.05){ jog.caido=L.vida.caido>0; G.atualizarGangues(0.05,jog,(d,fx,fz)=>{ L.levarPancada(d,fx,fz); return L.vida.caido>0; },txt=>log.push(txt));
    if(resp&&document.getElementById('gangue')?.classList.contains('on')){ log.push('PERGUNTA: '+document.querySelector('#gangue p').textContent); document.getElementById('gangue').dispatchEvent(new CustomEvent('tecla',{detail:'Digit'+resp})); resp=null; } }
  return { log, energia:Math.round(L.vida.e), caido:L.vida.caido>0, g:G.estadoGangues()[0] }; },[seg,resp]);
console.log(JSON.stringify(await sim(+(process.argv[4]||20),resp),null,1));
await pg.evaluate(async()=>{ const G=await import('/js/gangues.js'); const c=G.estadoGangues().find(g=>g.chefe)?.chefe; if(!c) return; const p=__jogo.jogador.position; __jogo.cam(11,0.3,Math.atan2(p.x-c[0],p.z-c[1])); });
await pg.waitForTimeout(1500);
console.log('BRACO',JSON.stringify(await pg.evaluate(async()=>{ const G=await import('/js/gangues.js'), T=await import('three'); const g=G._gangues[0]; return g.membros.map(p=>{ let b=null; p.modelo.traverse(o=>{ if(/^UpperArm\.?R$/.test(o.name)) b=o; }); const q=new T.Quaternion(); b.getWorldQuaternion(q); const v=new T.Vector3(0,1,0).applyQuaternion(q); return [g.estado, p.arma.visible, v.toArray().map(n=>+n.toFixed(2)), p.arma.position.toArray().map(n=>+n.toFixed(1)), [p.x|0,p.z|0]]; }); })));
await pg.screenshot({path:join(fotos,'gangue-tiro.png')});
console.log(erros.length?erros.join('\n'):'sem erros'); await nav.close();
