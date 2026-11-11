// Ponto de entrada: monta o mundo e roda o loop
import * as THREE from 'three';
import { scene, camera, renderer, base, $ } from './cena.js';
import { toLL, LX0, LZ0, LX1, LZ1 } from './geo.js';
import { ANDAR, CORRER } from './config.js';
import { satelite } from './satelite.js';
import { ruas, predios, carregarCidade, status } from './cidade.js';
import { jogador, suporte, av, animar } from './avatar.js';
import { tecla, cam, toque, pedido } from './controles.js';
import { bloqueado, ruaMaisProxima, pontoLivre } from './mundo.js';
import { carregarPredios } from './predios.js';
import { construirMarcos } from './marcos.js';
import { minimapa } from './minimapa.js';
import { frota, iniciarVeiculos, veiculoPerto, entrar, sair, dirigir, dentroDeVeiculo, frente, esquerda } from './veiculos.js';
import * as veic from './veiculos.js';
import { iniciarTransito, atualizarTransito, posicoesTransito } from './transito.js';

// borda visível do mundo
{ const m=new THREE.MeshBasicMaterial({color:0xF97316,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}), H=45;
  const muro=(cx,cz,l,gira)=>{ const w=new THREE.Mesh(new THREE.PlaneGeometry(l,H),m); w.position.set(cx,H/2,cz); if(gira) w.rotation.y=Math.PI/2; scene.add(w); };
  muro((LX0+LX1)/2,LZ0,LX1-LX0,false); muro((LX0+LX1)/2,LZ1,LX1-LX0,false); muro(LX0,(LZ0+LZ1)/2,LZ1-LZ0,true); muro(LX1,(LZ0+LZ1)/2,LZ1-LZ0,true); }

const travado=(x,z)=>bloqueado(x,z)||dentroDeVeiculo(x,z);

// carro do trânsito na frente do veículo do jogador?
function bateNoTransito(c,x,z,h){
  const [fx,fz]=frente(h), [ex,ez]=esquerda(h);
  for(const [tx,tz] of posicoesTransito()){ const dx=tx-x, dz=tz-z;
    if(Math.abs(dx*fx+dz*fz)<c.comp/2+2.1 && Math.abs(dx*ex+dz*ez)<c.larg/2+1.2) return true; }
  return false;
}

const relogio=new THREE.Clock(), alvo=new THREE.Vector3(); let rumo=0, tLento=0, passo=0, ruaAtual='';
function aPe(dt){
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
    if(!travado(p.x+dx,p.z+dz)){ p.x+=dx; p.z+=dz; }
    else if(!travado(p.x+dx,p.z)) p.x+=dx;
    else if(!travado(p.x,p.z+dz)) p.z+=dz;
    const a=Math.atan2(vx,vz); let d=a-rumo; d=Math.atan2(Math.sin(d),Math.cos(d)); rumo+=d*Math.min(1,dt*10);
    estado=correndo?'correr':'andar'; passo+=dt*(correndo?13:8);
  }
  p.x=Math.max(LX0+3,Math.min(LX1-3,p.x)); p.z=Math.max(LZ0+3,Math.min(LZ1-3,p.z));
  jogador.rotation.y=rumo; suporte.rotation.y=av.giroExtra;
  animar(estado); if(av.mixer) av.mixer.update(dt);
  if(av.boneco){ const s=estado==='parado'?0:Math.sin(passo)*(estado==='correr'?0.9:0.55), q=av.boneco.userData.partes;
    q[0].rotation.x=s; q[1].rotation.x=-s; q[2].rotation.x=-s; q[3].rotation.x=s; }
}

let distAPe=cam.dist;
function aoVolante(dt){
  const c=veic.dirigindo;
  let acel=(tecla.KeyW||tecla.ArrowUp?1:0)-(tecla.KeyS||tecla.ArrowDown?1:0);
  let giro=(tecla.KeyA||tecla.ArrowLeft?1:0)-(tecla.KeyD||tecla.ArrowRight?1:0);
  if(toque.joy){ acel=-toque.joy.y; giro=-toque.joy.x; }
  dirigir(dt, acel, giro, tecla.Space, bateNoTransito);
  const p=c.obj.position; jogador.position.set(p.x,0,p.z); rumo=c.h+Math.PI;
  // câmera vem para trás do veículo quando ele anda (parado, dá para olhar em volta)
  if(Math.abs(c.v)>0.6){ let d=c.h-cam.yaw; d=Math.atan2(Math.sin(d),Math.cos(d)); cam.yaw+=d*Math.min(1,dt*2.5); }
  cam.dist+= (c.tipo.cam-cam.dist)*Math.min(1,dt*3);
  const s=document.createElement('small'); s.textContent=' km/h · '+c.tipo.nome;
  $('velo').replaceChildren(String(Math.round(Math.abs(c.v)*3.6)), s);
}

function trocarVeiculo(){
  if(veic.dirigindo){
    const [x,z,h]=sair(); jogador.position.set(x,0,z); jogador.visible=true; rumo=h-Math.PI/2; // olhando para fora do veículo cam.dist=distAPe;
    $('velo').style.display='none';
  } else {
    const c=veiculoPerto(jogador.position.x,jogador.position.z); if(!c) return;
    distAPe=cam.dist; entrar(c); jogador.visible=false; animar('parado');
    $('velo').style.display='block';
  }
}

function quadro(){
  requestAnimationFrame(quadro);
  const dt=Math.min(relogio.getDelta(),0.05);
  if(pedido.usar){ pedido.usar=false; trocarVeiculo(); }
  if(veic.dirigindo) aoVolante(dt); else aPe(dt);
  const p=jogador.position;

  // dica de entrar / botão do celular
  const perto=!veic.dirigindo&&veiculoPerto(p.x,p.z);
  $('dica').style.display=perto?'block':'none'; if(perto) $('dica').textContent=`E · entrar ${perto.tipo.nome==='SUV'?'no':'na'} ${perto.tipo.nome}`;
  if(perto&&perto.tipo.id==='cavalo') $('dica').textContent='E · subir no cavalo mecânico';
  $('usar').style.display=(perto||veic.dirigindo)&&matchMedia('(pointer:coarse)').matches?'block':'none';
  $('usar').textContent=veic.dirigindo?'Sair':'Entrar';

  const D=veic.dirigindo, outros=[[p.x,p.z,D?D.comp/2:0.5,D?D.larg/2:0.5], ...frota.filter(c=>c!==D).map(c=>[c.obj.position.x,c.obj.position.z,c.comp/2,c.larg/2])];
  atualizarTransito(dt,p.x,p.z,outros);

  const {yaw,pitch,dist}=cam;
  alvo.set(p.x,veic.dirigindo?1.8:1.45,p.z);
  camera.position.set(p.x+dist*Math.sin(yaw)*Math.cos(pitch), alvo.y+dist*Math.sin(pitch), p.z+dist*Math.cos(yaw)*Math.cos(pitch));
  camera.lookAt(alvo);
  base.position.set(p.x,0,p.z);
  satelite.atualizar(p.x,p.z);

  tLento+=dt;
  if(tLento>0.12){ tLento=0;
    minimapa(p.x,p.z,rumo, frota.filter(c=>c!==veic.dirigindo).map(c=>({x:c.obj.position.x,z:c.obj.position.z,h:c.h,comp:c.comp,larg:c.larg})), posicoesTransito());
    const r=ruaMaisProxima(p.x,p.z), nome=r?r.nome:'';
    if(nome!==ruaAtual){ ruaAtual=nome;
      const el=$('street'); el.textContent=nome; // nome vem do OSM (editável por qualquer um): nunca como HTML
      if(nome){ const s=document.createElement('small'); s.textContent='MATELÂNDIA · PR'; el.appendChild(s); } }
    const [la,lo]=toLL(p.x,p.z); $('coord').textContent=la.toFixed(5)+', '+lo.toFixed(5);
  }
  renderer.render(scene,camera);
}

status();
carregarCidade().then(async()=>{
  await carregarPredios();
  // árvore e banco não vão para cima da rua
  const ruaLonge=(x,z)=>!ruas.some(r=>!r.pe&&x>r.bb[0]-12&&x<r.bb[2]+12&&z>r.bb[1]-12&&z<r.bb[3]+12&&r.pts.some((q,i)=>{ const n=r.pts[i+1]; if(!n) return false; const vx=n[0]-q[0], vz=n[1]-q[1]; let t=((x-q[0])*vx+(z-q[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t)); return Math.hypot(x-q[0]-vx*t,z-q[1]-vz*t)<r.w/2+1.5; }));
  construirMarcos(predios, ruaLonge); status();
  const p=jogador.position, [x,z]=pontoLivre(p.x,p.z); p.set(x,0,z);   // não nascer dentro de uma casa
  await iniciarVeiculos(); await iniciarTransito(jogador.position.x,jogador.position.z); });
quadro();
// gancho para testes no console
window.__jogo={jogador,ruas,predios,tecla,frota,veic,pedido,lim:[LX0,LZ0,LX1,LZ1],cam:(d,p,y)=>{cam.dist=d;cam.pitch=p;cam.yaw=y;}};
