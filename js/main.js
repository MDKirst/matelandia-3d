// Ponto de entrada: monta o mundo e roda o loop
import * as THREE from 'three';
import { scene, camera, renderer, base, $ } from './cena.js';
import { toLL, LX0, LZ0, LX1, LZ1 } from './geo.js';
import { ANDAR, CORRER } from './config.js';
import { satelite } from './satelite.js';
import { ruas, predios, carregarCidade, status } from './cidade.js';
import { jogador, suporte, av, animar } from './avatar.js';
import { tecla, cam, toque } from './controles.js';
import { bloqueado, ruaMaisProxima } from './mundo.js';
import { minimapa } from './minimapa.js';

// borda visível do mundo
{ const m=new THREE.MeshBasicMaterial({color:0xF97316,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}), H=45;
  const muro=(cx,cz,l,gira)=>{ const w=new THREE.Mesh(new THREE.PlaneGeometry(l,H),m); w.position.set(cx,H/2,cz); if(gira) w.rotation.y=Math.PI/2; scene.add(w); };
  muro((LX0+LX1)/2,LZ0,LX1-LX0,false); muro((LX0+LX1)/2,LZ1,LX1-LX0,false); muro(LX0,(LZ0+LZ1)/2,LZ1-LZ0,true); muro(LX1,(LZ0+LZ1)/2,LZ1-LZ0,true); }

const relogio=new THREE.Clock(), alvo=new THREE.Vector3(); let rumo=0, tLento=0, passo=0, ruaAtual='';
function quadro(){
  requestAnimationFrame(quadro);
  const dt=Math.min(relogio.getDelta(),0.05);
  let ix=(tecla.KeyD||tecla.ArrowRight?1:0)-(tecla.KeyA||tecla.ArrowLeft?1:0);
  let iy=(tecla.KeyW||tecla.ArrowUp?1:0)-(tecla.KeyS||tecla.ArrowDown?1:0);
  let correndo=tecla.ShiftLeft||tecla.ShiftRight;
  if(toque.joy){ ix=toque.joy.x; iy=-toque.joy.y; if(Math.hypot(ix,iy)>0.92) correndo=true; }
  const forca=Math.min(1,Math.hypot(ix,iy)); let estado='parado';
  const p=jogador.position;
  if(forca>0.12){
    const {yaw}=cam;
    const vx=(-Math.sin(yaw)*iy+Math.cos(yaw)*ix), vz=(-Math.cos(yaw)*iy-Math.sin(yaw)*ix), l=Math.hypot(vx,vz);
    const vel=(correndo?CORRER:ANDAR)*forca*dt, dx=vx/l*vel, dz=vz/l*vel;
    if(!bloqueado(p.x+dx,p.z+dz)){ p.x+=dx; p.z+=dz; }
    else if(!bloqueado(p.x+dx,p.z)) p.x+=dx;
    else if(!bloqueado(p.x,p.z+dz)) p.z+=dz;
    const a=Math.atan2(vx,vz); let d=a-rumo; d=Math.atan2(Math.sin(d),Math.cos(d)); rumo+=d*Math.min(1,dt*10);
    estado=correndo?'correr':'andar'; passo+=dt*(correndo?13:8);
  }
  p.x=Math.max(LX0+3,Math.min(LX1-3,p.x)); p.z=Math.max(LZ0+3,Math.min(LZ1-3,p.z));
  jogador.rotation.y=rumo; suporte.rotation.y=av.giroExtra;
  animar(estado); if(av.mixer) av.mixer.update(dt);
  if(av.boneco){ const s=estado==='parado'?0:Math.sin(passo)*(estado==='correr'?0.9:0.55), q=av.boneco.userData.partes;
    q[0].rotation.x=s; q[1].rotation.x=-s; q[2].rotation.x=-s; q[3].rotation.x=s; }

  const {yaw,pitch,dist}=cam;
  alvo.set(p.x,1.45,p.z);
  camera.position.set(p.x+dist*Math.sin(yaw)*Math.cos(pitch), 1.45+dist*Math.sin(pitch), p.z+dist*Math.cos(yaw)*Math.cos(pitch));
  camera.lookAt(alvo);
  base.position.set(p.x,0,p.z);
  satelite.atualizar(p.x,p.z);

  tLento+=dt;
  if(tLento>0.12){ tLento=0; minimapa(p.x,p.z,rumo);
    const r=ruaMaisProxima(p.x,p.z), nome=r?r.nome:'';
    if(nome!==ruaAtual){ ruaAtual=nome;
      const el=$('street'); el.textContent=nome; // nome vem do OSM (editável por qualquer um): nunca como HTML
      if(nome){ const s=document.createElement('small'); s.textContent='MATELÂNDIA · PR'; el.appendChild(s); } }
    const [la,lo]=toLL(p.x,p.z); $('coord').textContent=la.toFixed(5)+', '+lo.toFixed(5);
  }
  renderer.render(scene,camera);
}

status(); carregarCidade(); quadro();
// gancho para testes no console
window.__jogo={jogador,ruas,predios,tecla,lim:[LX0,LZ0,LX1,LZ1],cam:(d,p,y)=>{cam.dist=d;cam.pitch=p;cam.yaw=y;}};
