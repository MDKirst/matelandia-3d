// Cachorros (pedido do Maicon em 20/11): Shiba Inu e Husky da Quaternius (CC0, Poly Pizza), preparados por
// tools/otimizar-cao.mjs com os clipes parado, farejar, andar, correr, comer, latir e apanhar.
// Uns andam com dono (seguem um pedestre de perto), outros são soltos: passeiam pela calçada, farejam, comem.
// Latem para o jogador a pé que chega perto e correm do carro que vem rápido. Só existem perto da câmera.
// Quem chama é o pedestres.js (iniciarPedestres / atualizarPedestres), que passa a lista de pedestres vivos.
import * as THREE from 'three';
import { porModo } from './config.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene } from './cena.js';
import { bloqueado } from './mundo.js';
import { somLatido, somPancada } from './som.js';
import { dirigindo } from './veiculos.js';
import { vida } from './luta.js';

const QTD = porModo(8,4), RAIO_SOME = 180, RAIO_ANIMA = porModo(80,40);
const RACAS = [ { nome:'shiba', alt:0.58 }, { nome:'husky', alt:0.78 } ];   // altura total, da pata à ponta da orelha (m)
const LATIDOS = ['Au! Au!','Au au au!','Auuu!','Rrrr… au!'];
const MORDIDAS = ['Nhac!','Grrr… nhac!','Rrrr!'];
// moto (21/11, pedido do Maicon): cachorro que vê a moto passar corre atrás latindo e chama os outros por perto (bando);
// colado na roda tenta morder (tira energia). Moto rápida deixa o bando para trás; ele desiste e volta.
const VE_MOTO=16, CHAMA_BANDO=45, CORRE=7.5, DESISTE=6, MORDE_PERTO=1.5;
let avisoMordida=0, calmo=0;
// petisco/ração do pet shop (negocios.js): por s segundos os cachorros ficam amigos (não caçam a moto nem latem)
export function acalmarCaes(seg){ calmo=Math.max(calmo,seg); for(const c of caes) if(c.modo==='moto'){ c.modo='parado'; c.t=1; } }
const sorte = ()=>Math.random(), sorteia = l=>l[(sorte()*l.length)|0];

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const moldes = [];
export const caes = [];
let falarFn = ()=>{};

function carregar(r){
  return new Promise(ok=>loader.load(`assets/caes/${r.nome}.glb`, g=>{
    g.scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(g.scene,true), anims={};
    for(const a of g.animations) anims[a.name]=a;
    ok({ ...r, cena:g.scene, anims, altura:(box.max.y-box.min.y)||1, base:box.min.y });
  }, undefined, ()=>ok(null)));
}

// falar: o balão de fala dos pedestres (pedestres.js), para o "Au! Au!"
export async function iniciarCaes(falar){
  falarFn = falar;
  moldes.push(...(await Promise.all(RACAS.map(carregar))).filter(Boolean));
  if(!moldes.length) return 0;
  for(let i=0;i<QTD;i++) caes.push({ obj:null });
  return moldes.length;
}

function vestir(c, m){
  const obj=clonarEsqueleto(m.cena), e=m.alt*(0.85+sorte()*0.3)/m.altura;
  obj.scale.multiplyScalar(e); c.pe=-m.base*e;
  obj.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false; o.castShadow=false; } });
  scene.add(obj);
  c.obj=obj; c.modelo=m; c.mixer=new THREE.AnimationMixer(obj); c.acoes={}; c.atual=null;
  for(const [n,a] of Object.entries(m.anims)) c.acoes[n]=c.mixer.clipAction(a);
}
function animar(c, nome, vel=1){
  const a=c.acoes[nome]||c.acoes.parado; if(!a) return;
  a.timeScale=vel; if(a===c.atual) return;
  if(c.atual) c.atual.fadeOut(0.25);
  a.reset().fadeIn(0.25).play(); c.atual=a;
}

// nasce junto de um pedestre vivo (já está numa calçada): com ele de dono ou solto ali perto
function nascer(c, gente, px, pz){
  const vivos=gente.filter(p=>p.obj&&p.modo!=='caido'&&p.modo!=='turma'&&!caes.some(o=>o.dono===p)), d=p=>Math.hypot(p.x-px,p.z-pz);
  const cand=vivos.filter(p=>d(p)>25&&d(p)<150); if(!cand.length) return false;
  const p=sorteia(cand), m=sorteia(moldes);
  if(c.obj){ scene.remove(c.obj); c.mixer.stopAllAction(); }
  vestir(c,m);
  const comDono=sorte()<0.45, a=sorte()*Math.PI*2;
  // solto: de preferência junto de outro solto (matilha de rua)
  const amigo=!comDono&&sorte()<0.75?caes.find(o=>o!==c&&o.obj&&!o.dono&&d(o)>20&&d(o)<150):null, b=amigo||p;
  Object.assign(c, { x:b.x+Math.sin(a)*1.6, z:b.z+Math.cos(a)*1.6, rumo:p.rumo||a, dono:comDono?p:null, modo:comDono?'dono':'parado',
    t:1+sorte()*3, vel:0, latiu:0, y:-1.2,   // y: o balão de fala sai mais baixo (falar põe a 2,3 m)
    ladoDono:sorte()<0.5?1:-1 });
  if(bloqueado(c.x,c.z)){ c.x=p.x; c.z=p.z; }
  return true;
}

// passo com colisão: se bate, tenta deslizar num eixo; devolve false se parou
function andar(c, dx, dz){
  const nx=c.x+dx, nz=c.z+dz;
  if(!bloqueado(nx,nz)){ c.x=nx; c.z=nz; return true; }
  if(!bloqueado(nx,c.z)){ c.x=nx; return true; }
  if(!bloqueado(c.x,nz)){ c.z=nz; return true; }
  return false;
}
function virarPara(c, alvo, dt, k=6){ let d=alvo-c.rumo; d=Math.atan2(Math.sin(d),Math.cos(d)); c.rumo+=d*Math.min(1,dt*k); }

// jog: {x,z,dirigindo,v,veic}; gente: pedestres (pedestres.js); fator: quanta gente na rua nesta hora (0–1)
export function atualizarCaes(dt, jog, gente, fator=1){
  if(!moldes.length) return;
  avisoMordida=Math.max(0,avisoMordida-dt); calmo=Math.max(0,calmo-dt);
  const limite=Math.round(QTD*Math.min(1,0.35+fator));
  for(const [k,c] of caes.entries()){
    if(!c.obj||Math.hypot(c.x-jog.x,c.z-jog.z)>RAIO_SOME){
      if(k>=limite){ if(c.obj){ scene.remove(c.obj); c.mixer.stopAllAction(); c.obj=null; c.dono=null; } continue; }
      if(!nascer(c,gente,jog.x,jog.z)) continue; }
    mover(c,dt,jog);
    const dJog=Math.hypot(c.x-jog.x,c.z-jog.z);
    c.obj.position.set(c.x,c.pe,c.z); c.obj.rotation.y=c.rumo;
    if(dJog<RAIO_ANIMA) c.mixer.update(dt);
  }
}

function mover(c, dt, jog){
  c.t-=dt; c.latiu=Math.max(0,c.latiu-dt);
  const dx=jog.x-c.x, dz=jog.z-c.z, dJog=Math.hypot(dx,dz);
  const deMoto=jog.dirigindo&&!!dirigindo?.tipo?.moto;
  // moto passando: começa a perseguição e chama o bando
  if(deMoto&&calmo<=0&&dJog<VE_MOTO&&Math.abs(jog.v)>1.5&&c.modo!=='moto'&&!(c.cansou>0)){
    entrarNaCaca(c);
    for(const o of caes) if(o!==c&&o.obj&&o.modo!=='moto'&&!(o.cansou>0)&&Math.hypot(o.x-c.x,o.z-c.z)<CHAMA_BANDO) entrarNaCaca(o); }
  c.cansou=Math.max(0,(c.cansou||0)-dt);
  if(c.modo==='moto'){ cacarMoto(c,dt,jog,deMoto,dx,dz,dJog); return; }
  // carro do jogador vindo rápido: sai correndo para longe dele
  if(jog.dirigindo&&!deMoto&&Math.abs(jog.v)>6&&dJog<9&&c.modo!=='fugir'){ c.modo='fugir'; c.t=2; c.antes=c.dono?'dono':'parado'; }
  // jogador a pé chegando perto: late (cachorro com dono late menos)
  if(!jog.dirigindo&&calmo<=0&&dJog<5&&c.latiu<=0&&c.modo!=='fugir'&&c.modo!=='latir'&&sorte()<dt*(c.dono?0.6:1.6)){
    c.antes=c.modo==='latir'?c.antes:c.modo; c.modo='latir'; c.t=1.6; c.latiu=9+sorte()*8;
    falarFn(c, sorteia(LATIDOS), 1.8); somLatido(dJog, c.modelo.nome==='husky'); }
  if(c.dono&&(!c.dono.obj||c.dono.modo==='caido'||c.dono.modo==='turma')) c.dono=null;   // o dono sumiu/caiu: fica solto

  if(c.modo==='latir'){
    virarPara(c,Math.atan2(dx,dz),dt,8); animar(c,'latir');
    if(c.t<=0) c.modo=c.antes==='dono'&&c.dono?'dono':'parado';
    return; }
  if(c.modo==='fugir'){
    const l=dJog||1, rumo=Math.atan2(-dx/l,-dz/l); virarPara(c,rumo,dt,8);
    if(!andar(c,Math.sin(c.rumo)*5*dt,Math.cos(c.rumo)*5*dt)) c.rumo+=Math.PI/2*(sorte()<0.5?1:-1);
    animar(c,'correr'); if(c.t<=0) c.modo=c.dono?'dono':'parado';
    return; }
  if(c.modo==='dono'&&c.dono){
    // um pouco atrás e de lado do dono
    const p=c.dono, r=p.rumo||0, ax=p.x-Math.sin(r)*1.1+Math.cos(r)*0.6*c.ladoDono, az=p.z-Math.cos(r)*1.1-Math.sin(r)*0.6*c.ladoDono;
    const ex=ax-c.x, ez=az-c.z, d=Math.hypot(ex,ez);
    if(d>25){ c.x=ax; c.z=az; return; }                                   // ficou muito para trás (dono virou a esquina numa parede): reaparece junto
    if(d>0.35){ const v=Math.min(4.5,d*1.8); virarPara(c,Math.atan2(ex,ez),dt);
      andar(c,Math.sin(c.rumo)*v*dt,Math.cos(c.rumo)*v*dt); animar(c, v>2?'correr':'andar', v>2?v/4.5:Math.max(0.6,v/1.1)); }
    else { virarPara(c,r,dt,3); if(c.t<=0){ c.pose=sorteia(['parado','parado','farejar']); c.t=2+sorte()*3; } animar(c,c.pose||'parado'); }
    return; }
  // solto: alterna entre passear, parar, farejar e comer
  if(c.t<=0){
    const r=sorte();
    if(r<0.45){ c.modo='passear'; c.t=3+sorte()*5; c.rumo+=(sorte()-0.5)*2; }
    else { c.modo=r<0.65?'parado':r<0.85?'farejar':'comer'; c.t=2+sorte()*4; } }
  if(c.modo==='passear'){
    // matilha: se afastou demais dos outros soltos, volta para perto
    let m=null, md=1e9; for(const o of caes){ if(o===c||!o.obj||o.dono) continue; const d=Math.hypot(o.x-c.x,o.z-c.z); if(d<md){ md=d; m=o; } }
    if(m&&md>6&&md<60) virarPara(c,Math.atan2(m.x-c.x,m.z-c.z),dt,2);
    if(!andar(c,Math.sin(c.rumo)*1.1*dt,Math.cos(c.rumo)*1.1*dt)) c.rumo+=Math.PI*(0.5+sorte());
    animar(c,'andar'); }
  else animar(c,c.modo);
}
function entrarNaCaca(c){
  c.antes=c.dono?'dono':'parado'; c.modo='moto'; c.t=DESISTE; c.mordeu=0.5+sorte(); c.lado=sorte()<0.5?1:-1;
  if(c.latiu<=0){ falarFn(c,sorteia(LATIDOS),1.6); c.latiu=2.5+sorte()*2; }
}
function cacarMoto(c,dt,jog,deMoto,dx,dz,dJog){
  const vc=jog.veic, ok=deMoto&&vc;
  // larga a caçada: desceu da moto, moto longe demais ou correu mais que ele por tempo demais
  if(!ok||dJog>40||c.t<=0){ c.modo=c.antes==='dono'&&c.dono?'dono':'parado'; c.cansou=12+sorte()*8; c.t=1; return; }
  // alvo: do lado da roda de trás (cada cachorro escolhe um lado)
  const fx=-Math.sin(vc.h), fz=-Math.cos(vc.h), ex=-Math.cos(vc.h), ez=Math.sin(vc.h);
  const ax=vc.x-fx*0.9+ex*0.9*c.lado, az=vc.z-fz*0.9+ez*0.9*c.lado, ix=ax-c.x, iz=az-c.z, d=Math.hypot(ix,iz);
  const v=Math.min(CORRE,d*3+Math.abs(vc.v)*0.6);
  virarPara(c,Math.atan2(ix,iz),dt,9);
  if(d>0.2&&!andar(c,Math.sin(c.rumo)*v*dt,Math.cos(c.rumo)*v*dt)) c.lado=-c.lado;
  if(d<4) c.t=DESISTE;                                                    // grudado na moto: não cansa
  // mordida: colado e a moto não está rápida
  c.mordeu-=dt; c.latiu=Math.max(0,c.latiu-dt);
  if(dJog<MORDE_PERTO+1&&Math.abs(vc.v)<9&&c.mordeu<=0){
    c.mordeu=1.2+sorte()*1.3; animar(c,'latir',1.4);
    const dano=3+((sorte()*3)|0); vida.e=Math.max(15,vida.e-dano);            // na moto não derruba: no máximo deixa com 15
    falarFn(c,sorteia(MORDIDAS),1.2); somPancada();
    if(avisoMordida<=0){ dispatchEvent(new CustomEvent('matelandia:mordida',{detail:{dano}})); avisoMordida=4; }
    return; }
  if(c.latiu<=0&&sorte()<dt*1.5){ falarFn(c,sorteia(LATIDOS),1.2); somLatido(dJog,c.modelo.nome==='husky'); c.latiu=1.5+sorte()*2; }
  animar(c, v>2?'correr':'andar', v>2?Math.max(0.8,v/5):1);
}
// para o minimapa/teste
export const posicoesCaes=()=>caes.filter(c=>c.obj).map(c=>[c.x,c.z]);
