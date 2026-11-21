// 21/11: quais texturas ocupam memória (por tamanho e por objeto-raiz)
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join } from 'node:path';
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const url=process.argv[2]||'http://localhost:8737/?sala=teste-auto&leve=1';
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const ctx=await nav.newContext({ viewport:{width:812,height:375}, deviceScaleFactor:3, isMobile:true, hasTouch:true });
const pg=await ctx.newPage();
await pg.goto(url,{waitUntil:'domcontentloaded',timeout:120000});
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:500000});
console.log(JSON.stringify(await pg.evaluate(async()=>{ const cena=await import(new URL('js/cena.js',location.href).href); const S=cena.scene;
  const tv=new Map(); const caminho=x=>{ const n=[]; for(let o=x;o&&o!==S;o=o.parent) n.unshift(o.name||o.type); return n.slice(0,2).join('/'); };
  S.traverse(x=>{ for(const m of [].concat(x.material||[])) for(const [k,v] of Object.entries(m)) if(v&&v.isTexture&&!tv.has(v)) tv.set(v,{k,dono:caminho(x),mat:m.name}); });
  const porDim={}, porDono={};
  for(const [t,i] of tv){ const im=t.image; if(!im||!im.width) continue; const mb=im.width*im.height*4*1.33/1048576; const d=im.width+'x'+im.height+' '+(im.tagName||im.constructor.name);
    porDim[d]=porDim[d]||[0,0]; porDim[d][0]++; porDim[d][1]+=mb; const o=i.dono+' ['+i.k+']'; porDono[o]=porDono[o]||[0,0]; porDono[o][0]++; porDono[o][1]+=mb; }
  const f=o=>Object.entries(o).sort((a,b)=>b[1][1]-a[1][1]).slice(0,18).map(([k,[n,mb]])=>k+' ×'+n+' = '+mb.toFixed(0)+' MB');
  return { porDim:f(porDim), porDono:f(porDono) }; }),null,1));
await nav.close();
