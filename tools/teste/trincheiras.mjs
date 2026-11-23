// 23/11: BR em aterro nas trincheiras — fotos de fora e de dentro da passagem + lógica dos níveis.
import { chromium } from 'playwright-core';
import { readdirSync, mkdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos'); mkdirSync(fotos,{recursive:true});
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:900,height:560}}); const erros=[];
pg.on('pageerror',e=>erros.push(e.message)); pg.on('console',m=>{ if(m.type()==='error') erros.push(m.text().slice(0,200)); });
await pg.goto('http://localhost:8737/?hora=12&sala=teste-auto&leve=0');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:180000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.waitForTimeout(15000);
const quadros=async n=>{ for(let i=0;i<n;i++) await pg.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>r()))); };
const qual=+(process.argv[2]||0);
// 1) de fora, de lado e de cima: o aterro com o vão
await pg.evaluate(async q=>{ const A=await import('/js/aterro.js'), J=__jogo, t=A.trincheiras[q];
  J.jogador.position.set(t.C[0]+t.u[0]*(t.trecho[0]-14),0,t.C[1]+t.u[1]*(t.trecho[0]-14)); J.cam(16,0.28,Math.atan2(-t.u[0],-t.u[1])+0.35); },qual);
await quadros(6); await pg.screenshot({path:join(fotos,`trincheira${qual}-fora.png`)});
// 2) jogador andando pela passagem (a pé) de uma ponta à outra
const r=await pg.evaluate(async q=>{ const A=await import('/js/aterro.js'), J=__jogo, t=A.trincheiras[q], p=J.jogador.position;
  p.set(t.C[0]+t.u[0]*-30,0,t.C[1]+t.u[1]*-30); J.cam(9,0.22,Math.atan2(-t.u[0],-t.u[1]));
  return { inicio:[p.x,p.z] }; },qual);
await pg.evaluate(()=>{ __jogo.tecla.KeyW=true; });
let pos=[]; for(let i=0;i<40;i++){ await quadros(1); pos.push(await pg.evaluate(async q=>{ const A=await import('/js/aterro.js'), t=A.trincheiras[q], p=__jogo.jogador.position, dx=p.x-t.C[0], dz=p.z-t.C[1]; return [+(dx*t.u[0]+dz*t.u[1]).toFixed(1), +(dx*t.n[0]+dz*t.n[1]).toFixed(1), +p.y.toFixed(2)]; },qual)); if(pos.at(-1)[0]>2) break; }
await pg.evaluate(()=>{ __jogo.tecla.KeyW=false; });
await quadros(3); await pg.screenshot({path:join(fotos,`trincheira${qual}-dentro.png`)});
console.log('ANDANDO', JSON.stringify(pos.filter((_,i)=>i%3===0||i===pos.length-1)));
// 3) colisão: no chão, ao lado da passagem, o aterro é sólido; em cima, sair pela lateral é bloqueado
console.log('COLISAO', JSON.stringify(await pg.evaluate(async q=>{ const A=await import('/js/aterro.js'), M=await import('/js/mundo.js'), t=A.trincheiras[q];
  const pt=(s,l)=>[t.C[0]+t.u[0]*s+t.n[0]*l, t.C[1]+t.u[1]*s+t.n[1]*l];
  const r={}; A.aterro.cima=false; r.chao_noVao=M.bloqueado(...pt(0,0)); r.chao_aoLadoDoVao=M.bloqueado(...pt(0,t.meia+3));
  A.aterro.cima=true; r.cima_naBR=M.bloqueado(...pt(0,t.meia+3)); const fora=pt(t.trecho[1]+6,t.meia+3); r.cima_foraDaBR=M.bloqueado(...fora); A.aterro.cima=false;
  return r; },qual)));
console.log('ERROS', erros.slice(0,5));
await nav.close();
