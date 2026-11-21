// 21/11: frota fora de cruzamento; trânsito desvia de carro estacionado; efeitos de velocidade
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const fotos=join(dirname(fileURLToPath(import.meta.url)),'fotos');
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await (await nav.newContext({viewport:{width:1280,height:720}})).newPage(); const erros=[]; pg.on('pageerror',e=>erros.push(e.message));
await pg.goto('http://localhost:8737/?sala=teste-auto&leve=0',{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
console.log(JSON.stringify(await pg.evaluate(async()=>{
  const V=await import('/js/veiculos.js'), C=await import('/js/cidade.js'), T=await import('/js/transito.js');
  const frota=V.frota.map(c=>({id:c.tipo.id,x:Math.round(c.obj.position.x),z:Math.round(c.obj.position.z),cruz:C.pertoCruzamento(c.obj.position.x,c.obj.position.z,15)}));
  // carro do trânsito numa rua de mão dupla: estacionado no meio-fio direito 30 m à frente
  const c=T.carros.find(o=>o.r&&!o.r.mao&&o.r.w>=7&&!o.r.tipo.startsWith('motorway')&&o.r.pts.length>3); if(!c) return {frota,erro:'sem carro'};
  for(const o of T.carros) if(o!==c){ o.r=null; o.obj.visible=false; }
  const a=c.r.pts[c.i], b=c.r.pts[c.i+c.dir], L=Math.hypot(b[0]-a[0],b[1]-a[1]), ux=(b[0]-a[0])/L, uz=(b[1]-a[1])/L;
  const off=c.r.w/2-1.15, ox=c.obj.position.x+ux*Math.min(30,L*0.8)-uz*(off-Math.min(c.r.w/4,2.2)), oz=c.obj.position.z+uz*Math.min(30,L*0.8)+ux*(off-Math.min(c.r.w/4,2.2));
  const est=[ox,oz,2.3,0.95,1]; let maxD=0, bateu=false, s0=null, passou=false;
  const pos0=[c.obj.position.x,c.obj.position.z];
  for(let k=0;k<160;k++){ T.atualizarTransito(0.05, pos0[0], pos0[1], [est]); if(!c.r) break;
    const dx=ox-c.obj.position.x, dz=oz-c.obj.position.z, f=dx*ux+dz*uz, l=Math.abs(-dx*uz+dz*ux);
    if(Math.abs(f)<2.3+c.meio-0.4&&l<0.95+c.larg-0.2) bateu=true; maxD=Math.max(maxD,Math.abs(c.desv||0)); if(f<-6) passou=true; }
  return { frota, rua:c.r?.nome, largura:c.r?.w, desvioMax:+maxD.toFixed(2), bateu, passou, v:+(c.v*3.6).toFixed(0)+' km/h' };
}),null,1));
// efeitos: entra num carro e simula alta velocidade
console.log(JSON.stringify(await pg.evaluate(async()=>{ const V=await import('/js/veiculos.js'), E=await import('/js/velocidade.js'), {camera}=await import('/js/cena.js');
  const c=V.frota.find(o=>o.tipo.id==='sedan'); c.v=c.tipo.vmax; for(let i=0;i<60;i++) E.efeitosVelocidade(0.05,c,true,0);
  return { vmaxSeda:Math.round(c.tipo.vmax*3.6)+' km/h', fov:+camera.fov.toFixed(1), vento:document.getElementById('linhasVento').style.opacity, fumaca:'ok' }; })));
await pg.screenshot({path:join(fotos,'velocidade.png'),timeout:240000});
console.log(erros.length?'ERROS\n'+[...new Set(erros)].join('\n'):'sem erros'); await nav.close();
