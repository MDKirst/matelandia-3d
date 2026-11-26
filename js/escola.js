// Movimento do Colégio Estadual Euclides da Cunha (25/11, pedido do Maicon): nos horários de aula as
// crianças chegam a pé (de mochila) pelas calçadas e entram pelo portão da Av. Paraná; na saída fazem o
// caminho de volta. Ônibus escolar (amarelo) e van param na frente do portão, descem/sobem alunos e vão
// embora. O sinal toca no começo de cada horário. Só roda com o jogador a até 320 m da escola.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene } from './cena.js';
import { ruas } from './cidade.js';
import { horaJogo } from './ceu.js';
import { porModo } from './config.js';
import { rotaRuas } from './policia.js';
import { pontoNaRua, seguirRota } from './socorro.js';

export const ESCOLA={ portao:[-746,199], dentro:[-746,158], centro:[-731,140] };
// [início, fim, 'entra'|'sai'] em hora do jogo
const HORARIOS=[[6.75,7.5,'entra'],[11.5,12.15,'sai'],[12.7,13.3,'entra'],[17.25,18,'sai']];
const MAX=porModo(16,7), RAIO=320, VEL=1.45;
const MODELOS=['male-casual-hoodie-24','female-casual','male-casual','female-jeans','male-punk-24','female-tank-top','female-dress'];
const MOCHILAS=[0xdc2626,0x2563eb,0x16a34a,0xfacc15,0x7c3aed,0xec4899,0xf97316];
const FALAS=['Bora, vai bater o sinal!','Fiz a lição!','Hoje tem educação física!','Esqueci o estojo…','Tchau, mãe!','Prova de matemática hoje…','Recreio é a melhor hora!'];
const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
let moldes=[], moldeOnibus=null, moldeVan=null, falar=()=>{}, pronto=false;
const alunos=[], veiculos=[];
let horarioAtual=null, proxAluno=0;
const sorte=()=>Math.random(), sorteia=l=>l[(sorte()*l.length)|0];

export async function iniciarEscola(fala, carregarModelo){
  falar=fala;
  const [o,v,...m]=await Promise.all([
    new Promise(ok=>loader.load('assets/veiculos/onibus.glb',g=>ok(g.scene),undefined,()=>ok(null))),
    new Promise(ok=>loader.load('assets/veiculos/suv2.glb',g=>ok(g.scene),undefined,()=>ok(null))),
    ...MODELOS.map(n=>carregarModelo(n).catch(()=>null))]);
  moldeOnibus=o; moldeVan=v; moldes=m.filter(Boolean); pronto=true;
}

// ponto da rua mais perto do portão (onde ônibus e van param)
let parada=null;
function acharParada(){
  let best=null, md=1e9; const [gx,gz]=ESCOLA.portao;
  for(const r of ruas){ if(r.pe) continue; for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], b=r.pts[i+1], dx=b[0]-a[0], dz=b[1]-a[1], L2=dx*dx+dz*dz||1;
    const t=Math.max(0,Math.min(1,((gx-a[0])*dx+(gz-a[1])*dz)/L2)), x=a[0]+dx*t, z=a[1]+dz*t, d=Math.hypot(gx-x,gz-z); if(d<md){ md=d; best=[x,z]; } } }
  return best||ESCOLA.portao;
}

/* ───────── alunos a pé ───────── */
// rota pelas ruas com deslocamento para a calçada (3,2 m à direita do sentido)
function calcada(pts){
  const out=[]; for(let i=0;i<pts.length;i++){ const a=pts[Math.max(0,i-1)], b=pts[Math.min(pts.length-1,i+1)], dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1;
    out.push([pts[i][0]-dz/L*3.2, pts[i][1]+dx/L*3.2]); } return out;
}
function novoAluno(entra, de){
  if(!moldes.length) return null;
  const m=sorteia(moldes), obj=clonarEsqueleto(m.cena), e=(1.15+sorte()*0.3)/m.altura;
  obj.scale.multiplyScalar(e); obj.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
  const corpo=new THREE.Group(); corpo.add(obj); obj.position.y=-m.base*e;
  const mochila=new THREE.Mesh(new THREE.BoxGeometry(0.34,0.42,0.18),new THREE.MeshLambertMaterial({color:sorteia(MOCHILAS)}));
  mochila.position.set(0,(1.15+0.3/2)*0.62,-0.2); corpo.add(mochila);                  // nas costas (frente = +Z)
  const mixer=new THREE.AnimationMixer(obj), clip=m.anims.andar||Object.values(m.anims)[0]; if(clip) mixer.clipAction(clip).play();
  scene.add(corpo);
  // caminho: entra = rua → portão → pátio ; sai = pátio → portão → rua
  const ponto=de||pontoNaRua(...ESCOLA.portao,55,120)||[ESCOLA.portao[0]+60,ESCOLA.portao[1]];
  const rua=calcada(entra?rotaRuas(ponto[0],ponto[1],...ESCOLA.portao):rotaRuas(...ESCOLA.portao,ponto[0],ponto[1]));
  const cam=entra?[ponto,...rua,ESCOLA.portao,ESCOLA.dentro]:[ESCOLA.dentro,ESCOLA.portao,...rua,ponto];
  const a={ obj:corpo, mixer, cam, i:1, x:cam[0][0], z:cam[0][1], vel:VEL*(0.85+sorte()*0.35), fala:2+sorte()*8 };
  alunos.push(a); return a;
}
function tirarAluno(k){ const a=alunos[k]; scene.remove(a.obj); a.mixer.stopAllAction(); alunos.splice(k,1); }

/* ───────── ônibus e van ───────── */
function novoVeiculo(tipo, entra){
  const molde=tipo==='onibus'?moldeOnibus:moldeVan; if(!molde) return;
  parada??=acharParada();
  const q=pontoNaRua(...parada,120,200); if(!q) return;
  const obj=molde.clone(); obj.rotation.order='YXZ';
  obj.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color.lerp(new THREE.Color(tipo==='onibus'?0xfacc15:0xffffff),tipo==='onibus'?0.75:0.5); } });
  const box=new THREE.Box3().setFromObject(obj), tam=box.getSize(new THREE.Vector3());
  // placa ESCOLAR no teto
  const cv=document.createElement('canvas'); cv.width=256; cv.height=64; const k=cv.getContext('2d'); k.fillStyle='#facc15'; k.fillRect(0,0,256,64); k.fillStyle='#111'; k.font='bold 40px system-ui'; k.textAlign='center'; k.fillText('ESCOLAR',128,46);
  const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
  for(const s of [-1,1]){ const p=new THREE.Mesh(new THREE.PlaneGeometry(Math.min(2.2,tam.x*0.9),0.55),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide})); p.position.set(s*(tam.x/2+0.02),tam.y*0.78,0); p.rotation.y=s*Math.PI/2; obj.add(p); }
  scene.add(obj);
  veiculos.push({ obj, tipo, entra, x:q[0], z:q[1], h:Math.atan2(-(parada[0]-q[0]),-(parada[1]-q[1])), v:0, meio:tam.z/2, larg:tam.x/2,
    fase:'ir', t:0, re:0, travado:0, ult:[q[0],q[1]], rota:null, levar:tipo==='onibus'?6:3 });
}

function emHorario(h){ for(const H of HORARIOS) if(h>=H[0]&&h<H[1]) return H; return null; }
function sinal(){                                                         // "trim" curto de escola (WebAudio próprio)
  try{ const AC=window.AudioContext||window.webkitAudioContext; const ctx=sinal.ctx??=new AC(); if(ctx.state!=='running') return;
    const o=ctx.createOscillator(), g=ctx.createGain(), lfo=ctx.createOscillator(), lg=ctx.createGain(); o.type='square'; o.frequency.value=880; lfo.frequency.value=22; lg.gain.value=0.5;
    lfo.connect(lg).connect(g.gain); g.gain.value=0.05; o.connect(g).connect(ctx.destination); const t=ctx.currentTime; o.start(t); lfo.start(t); o.stop(t+2.2); lfo.stop(t+2.2); }catch(e){}
}

export function atualizarEscola(dt, jog){
  if(!pronto) return;
  const dEsc=Math.hypot(jog.x-ESCOLA.centro[0],jog.z-ESCOLA.centro[1]), h=horaJogo(), H=dEsc<RAIO?emHorario(h):null;
  if(H!==horarioAtual){ horarioAtual=H;
    if(H){ const entra=H[2]==='entra'; novoVeiculo('onibus',entra); setTimeout(()=>novoVeiculo('van',entra),4000); if(dEsc<150) sinal(); } }
  // alunos a pé
  if(H&&alunos.length<MAX){ proxAluno-=dt; if(proxAluno<=0){ proxAluno=1.2+sorte()*1.8; novoAluno(H[2]==='entra'); } }
  for(let k=alunos.length-1;k>=0;k--){ const a=alunos[k];
    if(dEsc>RAIO+60){ tirarAluno(k); continue; }
    const alvo=a.cam[a.i]; if(!alvo){ tirarAluno(k); continue; }
    const ax=alvo[0]-a.x, az=alvo[1]-a.z, d=Math.hypot(ax,az);
    if(d<0.6){ a.i++; if(a.i>=a.cam.length){ tirarAluno(k); continue; } }
    else { const p=Math.min(d,a.vel*dt); a.x+=ax/d*p; a.z+=az/d*p; a.obj.rotation.y=Math.atan2(ax,az); }
    a.obj.position.set(a.x,0,a.z);
    if(Math.hypot(a.x-jog.x,a.z-jog.z)<60) a.mixer.update(dt);
    a.fala-=dt; if(a.fala<=0){ a.fala=8+sorte()*14; if(Math.hypot(a.x-jog.x,a.z-jog.z)<14&&sorte()<0.5) falar(a,sorteia(FALAS),2.5); }
  }
  // ônibus e van
  for(let k=veiculos.length-1;k>=0;k--){ const c=veiculos[k]; c.t+=dt;
    if(c.fase==='ir'){ const d=seguirRota(c,dt,...parada,18); if(d<5||c.t>70){ c.v=0; c.fase='parado'; c.t=0; c.solta=0; } }
    else if(c.fase==='parado'){ c.solta-=dt;
      if(c.levar>0&&c.solta<=0){ c.solta=1.3; c.levar--;                                    // porta do lado da calçada
        const lx=c.x-Math.cos(c.h)*(c.larg+0.8), lz=c.z+Math.sin(c.h)*(c.larg+0.8);
        if(c.entra) novoAluno(true,[lx,lz]);
        else { const a=novoAluno(true,[ESCOLA.dentro[0],ESCOLA.dentro[1]]); if(a){ a.cam=[ESCOLA.dentro,ESCOLA.portao,[lx,lz]]; a.i=1; a.x=ESCOLA.dentro[0]; a.z=ESCOLA.dentro[1]; } } }
      if(c.t>18){ c.fase='sair'; c.t=0; c.saida=pontoNaRua(c.x,c.z,200,320)||[c.x+250,c.z]; c.rota=null; } }
    else { seguirRota(c,dt,c.saida[0],c.saida[1],10); if(c.t>35||Math.hypot(c.x-jog.x,c.z-jog.z)>RAIO+80){ scene.remove(c.obj); veiculos.splice(k,1); continue; } }
    c.obj.position.set(c.x,0,c.z); c.obj.rotation.y=c.h;
  }
}
export const posicoesEscolares=()=>veiculos.map(c=>[c.x,c.z,c.h,c.meio,c.larg]);
export const _testeEscola={ alunos, veiculos, novoAluno, novoVeiculo, acharParada:()=>(parada=acharParada()) };
