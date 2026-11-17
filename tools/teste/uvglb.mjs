import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join } from 'node:path';
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true });
const pg=await nav.newPage(); await pg.goto('http://localhost:8737/?relevo=0&sala=teste-auto'); await pg.waitForTimeout(3000);
console.log(await pg.evaluate(async()=>{
  await import('/js/relevo.js').catch(()=>0);
  const THREE=await import('three'); const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js'); const {MeshoptDecoder}=await import('three/addons/libs/meshopt_decoder.module.js');
  const out=[];
  for(const f of ['valdir','piloto-ludwick']){ const l=new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder); const g=await l.loadAsync(`/assets/pessoas/${f}.glb`);
    g.scene.traverse(o=>{ if(!o.isMesh) return; const uv=o.geometry.attributes.uv; let a=[1e9,1e9,-1e9,-1e9]; const s=new Set();
      for(let i=0;i<uv.count;i++){ const u=uv.getX(i), v=uv.getY(i); a=[Math.min(a[0],u),Math.min(a[1],v),Math.max(a[2],u),Math.max(a[3],v)]; s.add(Math.round(u*100)+'_'+Math.round(v*100)); }
      const m=o.material; out.push(f+' n='+uv.count+' norm='+uv.normalized+' tipo='+uv.array.constructor.name+' faixa='+a.map(x=>x.toFixed(3))+' distintos='+s.size+' map='+(m.map?m.map.image.width+'x'+m.map.image.height+' flipY='+m.map.flipY:'nenhum')+' cor='+m.color.getHexString()+' verde='+(()=>{ const im=m.map.image, c=new OffscreenCanvas(im.width,im.height), k=c.getContext('2d'); k.drawImage(im,0,0); const d=k.getImageData(0,0,im.width,im.height).data; let gv=0,gv2=0,n=0; for(let i=0;i<uv.count;i+=40){ const u=uv.getX(i), v=uv.getY(i); for(const [vv,acc] of [[v,0],[1-v,1]]){ const x=Math.min(im.width-1,u*im.width|0), y=Math.min(im.height-1,vv*im.height|0), j=(y*im.width+x)*4; const verde=d[j+1]>200&&d[j]<60; if(acc) gv2+=verde; else gv+=verde; } n++; } return Math.round(100*gv/n)+'%/'+Math.round(100*gv2/n)+'%'; })()); }); }
  return out.join('\n'); }));
await nav.close();
