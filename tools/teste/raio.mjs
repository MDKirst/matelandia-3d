// O que a câmera vê no meio da tela (raio da câmera, descontando a altura do chão ali).
import { chromium } from 'playwright-core';
import { readdirSync } from 'node:fs'; import { join } from 'node:path';
const [la,lo,yaw,dist,pitch]=(process.argv[2]||'-25.2443,-53.9746,2.0,25,0.3').split(',').map(Number);
const base=join(process.env.LOCALAPPDATA,'ms-playwright'), pasta=readdirSync(base).filter(n=>/^chromium-\d+$/.test(n)).sort().pop();
const nav=await chromium.launch({ executablePath:join(base,pasta,'chrome-win64','chrome.exe'), headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const pg=await nav.newPage({viewport:{width:640,height:360}});
await pg.goto('http://localhost:8737/?hora=12&sala=teste-auto');
await pg.waitForFunction(()=>document.getElementById('jogar')?.textContent==='JOGAR',null,{timeout:120000});
await pg.evaluate(async()=>{ const nv=await import('/js/nuvem.js'); nv.nuvem.ok=false; document.getElementById('onlineJog').checked=false; document.getElementById('jogar').click(); });
await pg.evaluate(async([la,lo,yaw,dist,pitch])=>{ const g=await import('/js/geo.js'); const [x,z]=g.toXZ(la,lo); __jogo.jogador.position.set(x,0,z); __jogo.cam(dist,pitch,yaw); },[la,lo,yaw,dist,pitch]);
await pg.waitForTimeout(2500); await pg.screenshot({path:'tools/teste/fotos/raio.png'});
console.log((await pg.evaluate(async()=>{
  const THREE=await import('three'); const { scene, camera } = await import('/js/cena.js'); const { altura } = await import('/js/relevo.js');
  const rc=new THREE.Raycaster(), out=[]; const c=camera.position;
  out.push(`cam ${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)} chão ${altura(c.x,c.z).toFixed(1)} jog ${__jogo.jogador.position.x.toFixed(1)},${__jogo.jogador.position.z.toFixed(1)}`);
  for(const [sx,sy] of [[0,0],[-0.5,-0.3],[0.3,-0.5],[-0.7,0.2]]){
    rc.setFromCamera(new THREE.Vector2(sx,sy),camera); rc.ray.origin.y-=altura(c.x,c.z);
    const h=rc.intersectObjects(scene.children,true).filter(i=>i.object.visible&&i.object.material?.colorWrite!==false).slice(0,3);
    out.push(`[${sx},${sy}] `+h.map(i=>`${i.distance.toFixed(1)}m ${i.object.type}:${i.object.name} v=${i.object.geometry.attributes.position.count} cor=${i.object.material.color?.getHexString()} pai=${i.object.parent?.name||i.object.parent?.type} ro=${i.object.renderOrder}`).join(' | '));
  }
  rc.setFromCamera(new THREE.Vector2(0,0),camera); rc.ray.origin.y-=altura(c.x,c.z); const o=rc.intersectObjects(scene.children,true)[0]?.object;
  if(o){ o.geometry.computeBoundingBox(); const b=o.geometry.boundingBox; out.push('bbox '+JSON.stringify([b.min,b.max].map(v=>[v.x,v.y,v.z].map(n=>n.toFixed(1))))+' pos='+o.position.toArray()+' mat='+o.material.type+' map='+!!o.material.map+' vc='+!!o.material.vertexColors+' attrs='+Object.keys(o.geometry.attributes)+' idx='+(o.geometry.index?.count)+' tr='+o.material.transparent+' side='+o.material.side+' def='+JSON.stringify(o.material.defines)); }
  return out.join('\n'); })));
await nav.close();
