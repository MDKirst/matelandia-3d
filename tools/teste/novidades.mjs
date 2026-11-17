// Testa as novidades de 17/11: balcão das lojas, pegar carro da rua, trabalhos novos (jardineiro, leiturista, motorista de app).
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:960,height:540}}); const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
await pg.goto('http://localhost:8737/?hora=12&sala=teste-auto');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
await pg.waitForTimeout(4000);
const ok=(nome,v)=>console.log((v?'✅':'❌')+' '+nome+(typeof v==='string'?' · '+v:''));
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForTimeout(3000);

// 1) balcão
const loja=await pg.evaluate(async()=>{ const t=await import('/js/terrenos.js'); const l=t.lotes.find(l=>l.negocio==='lanchonete')||t.lotes.find(l=>l.negocio);
  if(!l) return null; window.__l=l; const x=l.A[0]+l.t[0]*6+l.n[0]*8, z=l.A[1]+l.t[1]*6+l.n[1]*8; __jogo.jogador.position.set(x,0,z);
  __jogo.cam(7,0.5,Math.atan2(-l.n[0],-l.n[1])); return l.negocio; });
ok('achou negócio aberto', loja||false);
if(loja){
  await pg.waitForTimeout(1500);
  await pg.evaluate(()=>{ __jogo.pedido.usar=true; });
  await pg.waitForFunction(()=>document.getElementById('balcao').classList.contains('on'),null,{timeout:60000}).catch(()=>{});
  const aberto=await pg.evaluate(()=>document.getElementById('balcao').classList.contains('on'));
  ok('E abre o balcão', aberto);
  await pg.screenshot({path:join(fotos,'balcao.png')});
  if(aberto){
    const r=await pg.evaluate(async()=>{ const t=await import('/js/terrenos.js'); __jogo.vida.e=30; __jogo.vida.semApanhar=0; const s0=t.salvo.saldo, e0=__jogo.vida.e;
      const b=[...document.querySelectorAll('#balcaoLista button')].find(b=>!b.disabled); const nome=b?.querySelector('b').textContent; b?.click();
      return { nome, gastou:s0-t.salvo.saldo, energia:[e0,Math.round(__jogo.vida.e)], fechou:!document.getElementById('balcao').classList.contains('on') }; });
    ok('comprou e a energia subiu', r.gastou>0&&r.energia[1]>r.energia[0] ? `${r.nome}: −M$ ${r.gastou}, energia ${r.energia[0]}→${r.energia[1]}` : false);
  }
}

// 2) pegar carro da rua
const carro=await pg.evaluate(async()=>{ const tr=await import('/js/transito.js'); const p=__jogo.jogador.position;
  const c=tr.carros.filter(c=>c.r&&c.obj.visible&&!c.policia).sort((a,b)=>Math.hypot(a.obj.position.x-p.x,a.obj.position.z-p.z)-Math.hypot(b.obj.position.x-p.x,b.obj.position.z-p.z))[0];
  if(!c) return null; const ry=c.obj.rotation.y, fx=-Math.sin(ry), fz=-Math.cos(ry);
  p.set(c.obj.position.x+fx*(c.meio+1.2),0,c.obj.position.z+fz*(c.meio+1.2)); c.v=0; return c.arq; });
ok('achou carro do trânsito', carro||false);
if(carro){
  await pg.evaluate(()=>{ __jogo.pedido.usar=true; });
  await pg.waitForFunction(()=>!!__jogo.veic.dirigindo,null,{timeout:60000}).catch(()=>{});
  const d=await pg.evaluate(()=>{ const c=__jogo.veic.dirigindo; return c&&{nome:c.tipo.nome, solto:!!c.solto, comp:c.comp.toFixed(1)}; });
  ok('entrou no carro da rua', d&&d.solto?`${d.nome} (${d.comp} m)`:false);
  await pg.evaluate(()=>{ __jogo.cam(9,0.35,__jogo.veic.dirigindo.h); });
  await pg.waitForTimeout(2500); await pg.screenshot({path:join(fotos,'carro-da-rua.png')});
  await pg.evaluate(()=>{ __jogo.pedido.usar=true; });
  await pg.waitForFunction(()=>!__jogo.veic.dirigindo,null,{timeout:60000}).catch(()=>{});
}

// 3) trabalhos novos
for(const tipo of ['jardineiro','leiturista']){
  const r=await pg.evaluate(async(tipo)=>{ const tb=await import('/js/trabalhos.js'); const p=__jogo.jogador.position;
    tb.comecar(tipo,p.x,p.z); if(!tb.trabalho.tipo) return 'não começou';
    const meta=tb.trabalho.meta; let alvo=tb.atualizarTrabalho(0.01,p.x,p.z,true);
    for(let k=0;k<meta&&alvo;k++){ p.set(alvo[0],0,alvo[1]); for(let i=0;i<4;i++) alvo=tb.atualizarTrabalho(1,alvo[0],alvo[1],true)||alvo; alvo=tb.trabalho.tipo?tb.atualizarTrabalho(0.01,p.x,p.z,true):null; }
    return tb.trabalho.tipo?`parou em ${tb.trabalho.feitos} de ${meta}`:`completo (${meta} pontos)`; },tipo);
  ok(tipo, r.startsWith('completo')?r:false); if(!r.startsWith('completo')) console.log('   ',r);
}
const m=await pg.evaluate(async()=>{ const tb=await import('/js/trabalhos.js'); const p=__jogo.jogador.position;
  tb.comecar('motorista',p.x,p.z); if(!tb.trabalho.tipo) return 'não começou'; const log=[];
  for(let k=0;k<3;k++){ let a=tb.atualizarTrabalho(0.01,p.x,p.z,false,0); log.push(tb.trabalho.etapa+' '+Math.round(Math.hypot(a[0]-p.x,a[1]-p.z))+'m');
    if(k===0){ p.set(a[0]+3,0,a[1]); __jogo.cam(14,0.4,0); }
    tb.atualizarTrabalho(0.01,a[0],a[1],false,0); a=tb.atualizarTrabalho(0.01,a[0],a[1],false,0); log.push('levar '+Math.round(Math.hypot(a[0]-p.x,a[1]-p.z))+'m');
    p.set(a[0],0,a[1]); tb.atualizarTrabalho(0.01,a[0],a[1],false,0); }
  return (tb.trabalho.tipo?'incompleto ':'completo ')+log.join(', '); });
ok('motorista de app', m.startsWith('completo')?m:false); if(!m.startsWith('completo')) console.log('   ',m);
// foto de um passageiro esperando
await pg.evaluate(async()=>{ const tb=await import('/js/trabalhos.js'); const p=__jogo.jogador.position; tb.comecar('motorista',p.x,p.z); const a=tb.atualizarTrabalho(0.01,p.x,p.z,false,0); p.set(a[0]+4,0,a[1]+4); __jogo.cam(8,0.3,Math.atan2(4,4)); });
await pg.waitForTimeout(3000); await pg.screenshot({path:join(fotos,'passageiro.png')});
const fome=await pg.evaluate(async()=>{ const l=await import('/js/luta.js'); return [l.DESCANSO,l.FOME]; });
ok('fome configurada', `descanso até ${fome[0]}%, cai ${fome[1]*60}%/min`);
console.log(erros.length?'ERROS:\n'+erros.join('\n'):'sem erros de página'); await nav.close();
