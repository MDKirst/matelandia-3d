// 27/11: conversa livre por IA com morador. Precisa do simulador (node tools/ia-papo/simular.mjs) e IA_PAPO apontando pra ele.
// uso: NODE_PATH=tools/teste/node_modules node tools/teste/ia-papo.mjs [largura altura]
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const W=+(process.argv[2]||1280), H=+(process.argv[3]||720), cel=W<600, tag=cel?'cel':'pc';
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await (await nav.newContext({ viewport:{width:W,height:H}, isMobile:cel, hasTouch:cel })).newPage();
const erros=[]; pg.on('pageerror',e=>erros.push(e.message)); pg.on('response',r=>{ if(r.status()>=400) erros.push(r.status()+' '+r.url()); }); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); });
await pg.addInitScript(()=>{ if(!sessionStorage.getItem('limpo')){ localStorage.removeItem('matelandia3d.moradores'); sessionStorage.setItem('limpo','1'); } });
await pg.goto('http://localhost:8737/?sala=teste-moradores',{waitUntil:'domcontentloaded',timeout:120000});
for(let tent=0;;tent++){ try{
  await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
  await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; const o=document.getElementById('onlineJog'); if(o) o.checked=false; document.getElementById('jogar').click(); }); break;
} catch(e){ if(tent>=2) throw e; console.log('recarregou, tentando de novo:',e.message.slice(0,80)); } }
await pg.waitForFunction(async()=>{ const P=await import('/js/pedestres.js'); return P.pedestresVivos().some(p=>p.modelo); },null,{timeout:300000});
// prepara: raio grande (jogador parado longe), escolhe a Dona Maria se houver
const quem=await pg.evaluate(async()=>{ const M=await import('/js/moradores.js'), P=await import('/js/pedestres.js'); M._teste.raio=1e9;
  const vivos=P.pedestresVivos().filter(p=>M._teste.MORADORES[p.modelo?.nome]); const p=vivos.find(p=>p.modelo.nome==='dona-maria')||vivos[0];
  window.__p=p; return p.modelo.nome; });
console.log('morador:',quem);
const texto=()=>pg.evaluate(()=>document.getElementById('papo')?.classList.contains('on')?document.getElementById('papo').innerText.replace(/\n+/g,' | ').slice(0,220):'(fechado)');
// abre já no papo livre (amizade 5)
await pg.evaluate(async()=>{ const M=await import('/js/moradores.js'), P=await import('/js/pedestres.js'); M._teste.dados.amizade[window.__p.modelo.nome]=5; M._teste.abrirMorador(window.__p,P.falar); });
console.log('abriu:',await texto(), '| caixa:', await pg.evaluate(()=>!!document.getElementById('papoIn')));
// digitar com o teclado de verdade: números e letras de ação (T, J, 1) NÃO podem mexer no jogo
await pg.click('#papoIn'); await pg.keyboard.type('oi, tudo bem? 1 T J'); 
console.log('digitado:', await pg.evaluate(()=>document.getElementById('papoIn').value));
await pg.keyboard.press('Enter');
await pg.waitForFunction(()=>!/pensando/.test(document.getElementById('papo').innerText),null,{timeout:60000});
console.log('resposta 1:', await texto());
await pg.fill('#papoIn','e a cidade?'); await pg.keyboard.press('Enter');
await pg.waitForFunction(()=>/e a cidade/.test(document.getElementById('papo').innerText)&&!/pensando/.test(document.getElementById('papo').innerText),null,{timeout:60000});
console.log('resposta 2:', await texto());
await pg.screenshot({path:join(fotos,`ia-papo-${tag}.png`),timeout:300000});
await pg.keyboard.press('Escape'); console.log('depois do Esc:', await texto());
await pg.evaluate(()=>{ localStorage.removeItem('matelandia3d.moradores'); localStorage.removeItem('matelandia3d.iapapo'); });
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
