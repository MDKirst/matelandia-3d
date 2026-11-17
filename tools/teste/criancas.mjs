// 17/11: poste sólido (carro para, pé barra) e crianças de bike elétrica atravessando a rua.
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540},deviceScaleFactor:2}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error'||/crian/i.test(m.text())) erros.push(m.text().slice(0,200)); });
await pg.goto('http://localhost:8737/?hora=10&sala=teste-auto');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForFunction(async()=>{ const C=await import('/js/criancas.js'); return C.estadoCriancas().pronto; },null,{timeout:120000,polling:1000});

// 1) poste: carro andando reto contra um poste para antes dele
console.log('POSTE', JSON.stringify(await pg.evaluate(async()=>{
  const ceu=await import('/js/ceu.js'), V=await import('/js/veiculos.js');
  const q=ceu.postes[Math.floor(ceu.postes.length/2)], r={ emCima:ceu.posteEm(q[0],q[1]), a1m:ceu.posteEm(q[0]+1,q[1]) };
  const c=V.frota.find(c=>c.tipo.id==='hatch'); const h=Math.PI/2;              // frente = -X
  c.obj.position.set(q[0]+8,0,q[1]); c.h=h; c.obj.rotation.y=h; c.v=0; V.entrar(c);
  let bateu=false; for(let i=0;i<200&&!bateu;i++) bateu=V.dirigir(0.05,1,0,false,null);
  r.bateu=bateu; r.distCentro=+(c.obj.position.x-q[0]).toFixed(2); r.meioComp=+(c.comp/2).toFixed(2); V.sair?.();
  return r; })));

// 2) crianças: simula 40 s com o jogador parado e conta as travessias (lado da rua trocou)
console.log('CRIANCAS', JSON.stringify(await pg.evaluate(async()=>{
  const C=await import('/js/criancas.js'), p=__jogo.jogador.position, jog={x:p.x,z:p.z,dirigindo:false,v:0};
  const lado0=new Map(), trav=new Map(); let maxV=0;
  for(let t=0;t<40;t+=0.05){ C.atualizarCriancas(0.05,jog);
    for(const [i,k] of C.criancas.entries()){ if(!k.via) continue; const lado=Math.abs(k.lat)>k.via.r.w/2?Math.sign(k.lat):0; maxV=Math.max(maxV,k.v);
      if(lado&&lado0.has(i)&&lado0.get(i)!==lado) trav.set(i,(trav.get(i)||0)+1); if(lado) lado0.set(i,lado); } }
  return { ...C.estadoCriancas(), lista:undefined, travessias:[...trav.values()].reduce((a,b)=>a+b,0), maxKmh:Math.round(maxV*3.6) }; })));

// 3) bate na criança com o carro: ela cai e o carro para
console.log('ATROPELA', JSON.stringify(await pg.evaluate(async()=>{
  const C=await import('/js/criancas.js'), V=await import('/js/veiculos.js'); const k=C.criancas.find(k=>k.via&&k.bike.visible);
  if(!k) return 'sem criança';
  const c=V.frota.find(c=>c.tipo.id==='sedan'), h=Math.PI/2; c.obj.position.set(k.x+6,0,k.z); c.h=h; c.obj.rotation.y=h; c.v=8; V.entrar(c);
  let bateu=false; for(let i=0;i<40&&!bateu;i++) bateu=V.dirigir(0.05,1,0,false,(c,x,z,h)=>!!C.bateNaCrianca(c,x,z,h));
  const r={bateu, caiu:k.cai>0}; V.sair?.(); return r; })));

// 4) foto: câmera perto de uma criança andando
await pg.evaluate(async()=>{ const C=await import('/js/criancas.js'); const k=C.criancas.find(k=>k.via&&k.bike.visible&&k.cai<=0)||C.criancas.find(k=>k.via);
  for(const c of __jogo.frota) c.obj.visible=false; k.vel=0; k.v=0; k.cruzar=99; const [fx,fz]=[-Math.sin(k.h),-Math.cos(k.h)];
  __jogo.jogador.position.set(k.x+fx*3.2,0,k.z+fz*3.2); __jogo.cam(2.2,0.1,Math.atan2(fx,fz)+1.2); });
await pg.waitForTimeout(8000);
await pg.screenshot({path:join(fotos,'criancas.png'),timeout:180000});
console.log(erros.length?erros.join('\n'):'sem erros'); await nav.close();
