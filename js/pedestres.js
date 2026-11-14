// Pedestres: personagens da Quaternius (CC0, assets/pessoas, preparados por tools/otimizar-pessoa.mjs).
// Andam pelas calçadas seguindo as ruas do OSM; na esquina viram, atravessam ou voltam; param na
// frente das lojas olhando a vitrine; nas praças ficam em grupinhos conversando. Fogem do carro
// que vem rápido e acenam para o jogador a pé. Só existem perto da câmera (somem longe e renascem).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene } from './cena.js';
import { toXZ } from './geo.js';
import { ruas } from './cidade.js';
import { bloqueado } from './mundo.js';
import { horaJogo, fatorPessoas } from './ceu.js';

export const PESSOAS = ['male-casual','female-casual','male-shirt','female-dress','male-long-sleeve','female-tank-top','male-suit','female-alternative',
  'male-casual-2-24','female-casual-2-24','male-worker-24','female-worker-24','male-farmer-24','female-formal-24','male-casual-hoodie-24','female-suit-24','male-beach-24','male-suit-24','male-punk-24','female-jeans'];
const COM_CALCADA = new Set(['primary','secondary','tertiary','residential','unclassified','living_street','primary_link','secondary_link','tertiary_link']);
const QTD = 34, RAIO_NASCE = [25, 140], RAIO_SOME = 190, RAIO_ANIMA = 90;
// praças (centro e raio aproximados, em metros locais): grupinhos conversando
const PRACAS = [ {c:[-55,-34], r:22}, {c:[-585,158], r:28} ];

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const moldes = [];            // {cena, anims:{nome:clip}, altura}
const gente = [];             // pessoas vivas
let lojas = [], vias = [], nos = null;
const chave = p=>Math.round(p[0]*10)+'_'+Math.round(p[1]*10);
const sorte = ()=>Math.random();

export function carregarModelo(nome){
  return new Promise(ok=>loader.load(`assets/pessoas/${nome}.glb`, g=>{
    g.scene.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(g.scene, true);   // true: mede com o esqueleto aplicado (a malha crua vem em outra escala)
    const anims={}; for(const a of g.animations) anims[a.name]=a;
    ok({nome, cena:g.scene, anims, altura:box.max.y-box.min.y||1.8, base:box.min.y});
  }, undefined, ()=>ok(null)));
}

function montarCaminhos(){
  vias = ruas.filter(r=>!r.pe&&COM_CALCADA.has(r.tipo)&&r.pts.length>1);
  nos = new Map();
  for(const r of vias) r.pts.forEach((p,i)=>{ const k=chave(p); if(!nos.has(k)) nos.set(k,[]); nos.get(k).push({r,i}); });
}

// ponto na calçada: eixo da rua + deslocamento para o lado escolhido (meio da calçada)
function naCalcada(p){
  const a=p.r.pts[p.i], b=p.r.pts[p.i+p.dir], dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1e-6, t=Math.min(1,p.s/L);
  const ux=dx/L, uz=dz/L, off=p.lado*(p.r.w/2+0.3+1.3);
  return { x:a[0]+dx*t-uz*off, z:a[1]+dz*t+ux*off, ux, uz, L };
}

function vestir(p, m){
  const obj=clonarEsqueleto(m.cena), alt=1.58+Math.random()*0.3, e=alt/m.altura;
  obj.scale.multiplyScalar(e); p.pe=-m.base*e;   // pés no chão
  obj.rotation.order='YXZ'; p.y=0; p.queda=0;      // YXZ: deita para trás no próprio eixo obj.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false; } });
  scene.add(obj);
  p.obj=obj; p.mixer=new THREE.AnimationMixer(obj); p.acoes={}; p.atual=null; p.modelo=m;
  for(const [n,c] of Object.entries(m.anims)) p.acoes[n]=p.mixer.clipAction(c);
}
function animar(p, nome, vel=1){
  const a=p.acoes[nome]||p.acoes.parado; if(!a) return;
  a.timeScale=vel;
  if(a===p.atual) return;
  if(p.atual) p.atual.fadeOut(0.3);
  a.reset().fadeIn(0.3).play(); p.atual=a;
}

// nasce numa calçada perto do jogador (mais gente onde há comércio) ou numa praça
function nascer(p, px, pz){
  if(p.obj){ scene.remove(p.obj); p.mixer.stopAllAction(); p.obj=null; }
  const m=moldes[(Math.random()*moldes.length)|0]; if(!m) return false;
  // praça perto? 1 em 4 vira grupinho
  const pr=PRACAS.find(q=>Math.hypot(q.c[0]-px,q.c[1]-pz)<RAIO_NASCE[1]);
  if(pr&&sorte()<0.25){
    const a=sorte()*Math.PI*2, d=sorte()*pr.r, cx=pr.c[0]+Math.cos(a)*d, cz=pr.c[1]+Math.sin(a)*d;
    vestir(p,m); p.modo='conversa'; p.x=cx; p.z=cz; p.rumo=sorte()*Math.PI*2; p.t=8+sorte()*25; p.r=null; return true;
  }
  for(let t=0;t<120;t++){
    const r=vias[(Math.random()*vias.length)|0], i=(Math.random()*(r.pts.length-1))|0, a=r.pts[i], b=r.pts[i+1], t0=Math.random();
    const q=[a[0]+(b[0]-a[0])*t0, a[1]+(b[1]-a[1])*t0], d=Math.hypot(q[0]-px,q[1]-pz);   // ponto no meio do trecho, não só no vértice
    if(d<RAIO_NASCE[0]||d>RAIO_NASCE[1]) continue;
    // rua sem comércio por perto aceita menos gente
    const comercio=lojas.some(l=>Math.abs(l[0]-q[0])<60&&Math.abs(l[1]-q[1])<60);
    if(!comercio&&sorte()<0.55) continue;
    const dir=sorte()<0.5?1:-1;
    const Lseg=Math.hypot(b[0]-a[0],b[1]-a[1]);
    vestir(p,m); Object.assign(p,{modo:'andar', r, dir, i:dir===1?i:i+1, s:(dir===1?t0:1-t0)*Lseg, lado:sorte()<0.5?1:-1, vel:1.1+sorte()*0.5, t:0, espera:0, visto:new Set()}); ladoCerto(p);
    const c=naCalcada(p); p.x=c.x; p.z=c.z; p.rumo=Math.atan2(c.ux,c.uz); return true;
  }
  return false;
}

// rua de mão única (avenida de pista dupla): só a calçada de fora (direita de quem segue a mão);
// a de dentro dá no canteiro central
const ladoCerto=p=>{ if(p.r.mao) p.lado=p.dir*p.r.mao; };
// meia-volta no meio do trecho
function meiaVolta(p){ const L=naCalcada(p).L; p.i=p.i+p.dir; p.dir=-p.dir; p.s=Math.max(0,L-p.s); if(p.r.mao) ladoCerto(p); else p.lado=-p.lado; }
// ponto dentro de algum veículo (caixa girada com folga): [x,z,ry,meio,larg]
const emVeiculo=(x,z,vs,f=0.5)=>vs.some(([vx,vz,ry,meio,larg])=>{ const dx=x-vx, dz=z-vz; if(Math.abs(dx)>12||Math.abs(dz)>12) return false;
  const fx=-Math.sin(ry), fz=-Math.cos(ry); return Math.abs(dx*fx+dz*fz)<meio+f && Math.abs(-dx*fz+dz*fx)<larg+f; });

// fim do trecho: segue a rua, vira na esquina (pode atravessar) ou volta
function esquina(p){
  const j=p.i+p.dir;
  if(j+p.dir>=0&&j+p.dir<p.r.pts.length&&sorte()<0.8){ p.i=j; return; }
  const op=[];
  for(const {r,i} of nos.get(chave(p.r.pts[j]))||[]){ if(r===p.r) continue; for(const dir of [1,-1]) if(i+dir>=0&&i+dir<r.pts.length) op.push({r,i,dir}); }
  if(op.length&&sorte()<0.85){ const o=op[(sorte()*op.length)|0]; p.r=o.r; p.i=o.i; p.dir=o.dir; if(sorte()<0.3) p.lado=-p.lado; ladoCerto(p); return; }  // atravessa às vezes
  p.i=j; p.dir=-p.dir; p.lado=-p.lado; ladoCerto(p);                                                     // volta pela mesma calçada
}

export async function iniciarPedestres(lugares, px, pz){
  montarCaminhos();
  lojas = lugares.filter(l=>l.f==='osm'||(l.conf??0)>=0.5).map(l=>toXZ(l.lat,l.lon));
  // carrega aos poucos: os 6 primeiros já povoam, o resto entra conforme chega
  const fila=[...PESSOAS].sort(()=>Math.random()-0.5);
  const primeiros=await Promise.all(fila.slice(0,6).map(carregarModelo)); moldes.push(...primeiros.filter(Boolean));
  (async()=>{ for(const n of fila.slice(6)){ const m=await carregarModelo(n); if(m) moldes.push(m); } })();
  for(let k=0;k<QTD;k++){ const p={}; nascer(p,px,pz); gente.push(p); }
}

// avisa quem quiser saber (a polícia) que alguém foi atropelado
let aoAtropelar=()=>{};
export function quandoAtropelar(f){ aoAtropelar=f; }

// jogador: {x,z, dirigindo, v (m/s), h, veic:{x,z,h,meio,larg,v}}; veiculos: [[x,z,ry,meio,larg]] (do jogador, estacionados e trânsito)
export function atualizarPedestres(dt, jog, veiculos=[]){
  const {x:px, z:pz}=jog;
  const limite=Math.round(QTD*fatorPessoas(horaJogo()));       // de madrugada a rua esvazia
  for(const [k,p] of gente.entries()){
    if(!p.obj||Math.hypot(p.x-px,p.z-pz)>RAIO_SOME){
      if(k>=limite){ if(p.obj){ scene.remove(p.obj); p.mixer.stopAllAction(); p.obj=null; } continue; }   // sobra: não renasce
      nascer(p,px,pz); if(!p.obj) continue; }
    const dJog=Math.hypot(p.x-px,p.z-pz);
    // atropelado: o veículo do jogador encostou nele andando
    const V=jog.veic;
    if(V&&Math.abs(V.v)>2.2&&p.modo!=='caido'&&p.modo!=='levantar'){
      const fx=-Math.sin(V.h), fz=-Math.cos(V.h), dx=p.x-V.x, dz=p.z-V.z;
      if(Math.abs(dx*fx+dz*fz)<V.meio+0.35&&Math.abs(-dx*fz+dz*fx)<V.larg+0.35){
        const sv=Math.sign(V.v), lado=Math.sign(-dx*fz+dz*fx)||1, k=Math.abs(V.v);
        p.modo='caido'; p.t=7+Math.random()*4; p.queda=0;
        p.vx=fx*sv*k*0.55-fz*lado*1.5; p.vz=fz*sv*k*0.55+fx*lado*1.5; p.vy=2+k*0.18;
        p.rumo=Math.atan2(-fx*sv,-fz*sv);                 // de frente para o carro: cai de costas
        animar(p,'parado'); aoAtropelar(p.x,p.z,k);
      }
    }
    if(p.modo==='caido'){
      p.x+=p.vx*dt; p.z+=p.vz*dt; p.y+=p.vy*dt; p.vy-=9.8*dt;
      if(p.y<=0){ p.y=0; p.vy=0; p.vx*=Math.max(0,1-6*dt); p.vz*=Math.max(0,1-6*dt); }
      p.queda=Math.min(1,p.queda+dt*3); p.t-=dt;
      if(p.t<=0) p.modo='levantar';
    } else if(p.modo==='levantar'){
      p.queda=Math.max(0,p.queda-dt*1.5);
      if(p.queda===0){ const ax=p.x-px, az=p.z-pz, l=Math.hypot(ax,az)||1; p.modo='fugir'; p.fx=ax/l; p.fz=az/l; p.t=2.5; }
    }
    // carro vindo rápido perto: sai correndo para o lado de fora
    else if(jog.dirigindo&&Math.abs(jog.v)>3&&dJog<9&&p.modo!=='fugir'){
      const ax=p.x-px, az=p.z-pz, l=Math.hypot(ax,az)||1; p.modo='fugir'; p.fx=ax/l; p.fz=az/l; p.t=1.6; }
    if(p.modo==='fugir'){
      p.x+=p.fx*4.5*dt; p.z+=p.fz*4.5*dt; p.rumo=Math.atan2(p.fx,p.fz); animar(p,'correr'); p.t-=dt;
      if(p.t<=0) p.modo=p.r?'voltar':'conversa', p.t=p.r?0:6;
    } else if(p.modo==='voltar'){                       // volta para a calçada depois do susto
      const c=naCalcada(p), ax=c.x-p.x, az=c.z-p.z, l=Math.hypot(ax,az);
      if(l<0.3) p.modo='andar'; else { p.x+=ax/l*1.4*dt; p.z+=az/l*1.4*dt; p.rumo=Math.atan2(ax,az); animar(p,'andar'); }
    } else if(p.modo==='andar'){
      // jogador a pé bem na frente: para e acena
      const fx=Math.sin(p.rumo), fz=Math.cos(p.rumo), fr=(px-p.x)*fx+(pz-p.z)*fz;
      if(!jog.dirigindo&&dJog<2.2&&fr>0){ animar(p, p.acoes.acenar?'acenar':'parado'); p.rumo=Math.atan2(px-p.x,pz-p.z); }
      else {
        // veículo no caminho (atravessando a rua ou carro na calçada): espera; travado 3 s, volta
        const sv={r:p.r,i:p.i,dir:p.dir,s:p.s,lado:p.lado};
        p.s+=p.vel*dt; let c=naCalcada(p), g=0;
        while(p.s>=c.L&&g++<6){ p.s-=c.L; esquina(p); c=naCalcada(p); }
        const frente=[c.x+c.ux*0.9, c.z+c.uz*0.9];
        if(emVeiculo(c.x,c.z,veiculos)||emVeiculo(frente[0],frente[1],veiculos)){
          Object.assign(p,sv); c=naCalcada(p); animar(p,'parado'); p.espera+=dt;
          if(p.espera>3){ p.espera=0; meiaVolta(p); c=naCalcada(p); }
        } else p.espera=0;
        p.x=c.x; p.z=c.z;
        const alvo=Math.atan2(c.ux,c.uz); let d=alvo-p.rumo; d=Math.atan2(Math.sin(d),Math.cos(d)); p.rumo+=d*Math.min(1,dt*6);
        if(!p.espera) animar(p,'andar',p.vel/1.3);
        // loja do lado da calçada: às vezes para olhando a vitrine
        for(const l of lojas){ if(Math.abs(l[0]-p.x)>7||Math.abs(l[1]-p.z)>7) continue; const k=l[0]+'_'+l[1]; if(p.visto.has(k)) continue; p.visto.add(k);
          if(sorte()<0.35){ p.modo='vitrine'; p.t=3+sorte()*7; p.rumo=Math.atan2(l[0]-p.x,l[1]-p.z); } break; }
      }
    } else if(p.modo==='vitrine'){
      animar(p, p.acoes.mexer&&p.t%4<1.5?'mexer':'parado'); p.t-=dt; if(p.t<=0) p.modo='andar';
    } else if(p.modo==='papo'){                          // falando com o jogador: vira para ele e gesticula
      p.rumo=Math.atan2(px-p.x,pz-p.z); p.t-=dt;
      animar(p, p.gesto&&p.acoes.acenar&&p.t>p.tMax-2.2?'acenar':(p.acoes.mexer&&Math.floor(p.t)%3===0?'mexer':'parado'));
      if(p.t<=0) p.modo=p.antes||'andar';
    } else if(p.modo==='seguir'){                        // vai atrás do jogador
      const ax=px-p.x, az=pz-p.z, d=Math.hypot(ax,az);
      if(d>70){ p.modo=p.r?'voltar':'conversa'; p.t=8; }  // ficou para trás
      else if(d>2.4){ const sp=d>7?4.6:1.6, nx=p.x+ax/d*sp*dt, nz=p.z+az/d*sp*dt;
        if(!bloqueado(nx,nz)&&!emVeiculo(nx,nz,veiculos,0.2)){ p.x=nx; p.z=nz; } else if(!bloqueado(nx,p.z)) p.x=nx; else if(!bloqueado(p.x,nz)) p.z=nz;
        p.rumo=Math.atan2(ax,az); animar(p, d>7?'correr':'andar'); }
      else { p.rumo=Math.atan2(ax,az); animar(p,'parado'); }
    } else if(p.modo==='conversa'){
      // vira para o vizinho mais perto e alterna entre parado e gesto
      let viz=null, md=4; for(const o of gente){ if(o===p||o.modo!=='conversa'||!o.obj) continue; const d=Math.hypot(o.x-p.x,o.z-p.z); if(d<md){ md=d; viz=o; } }
      if(viz) p.rumo=Math.atan2(viz.x-p.x,viz.z-p.z);
      p.t-=dt; animar(p, (Math.floor(p.t/3)%3===0&&p.acoes.acenar)?'acenar':'parado');
      if(p.t<=0) nascer(p,px,pz);
    }
    if(!p.obj) continue;                              // renasceu sem achar lugar: tenta no próximo quadro
    p.obj.position.set(p.x,(p.pe||0)+p.y+(p.queda>0?0.12:0),p.z); p.obj.rotation.y=p.rumo; p.obj.rotation.x=-p.queda*Math.PI/2;
    if(dJog<RAIO_ANIMA) p.mixer.update(dt);           // longe, congela a animação (economiza)
  }
}

/* ───────── interação com o jogador ───────── */
const FALAS={
  oi:['Oi!','E aí, tudo certo?','Bom dia!','Opa, beleza?','Olá, vizinho!','Fala, meu chapa!'],
  conversa:['Dizem que vai chover hoje.','Já passou na praça hoje?','O trânsito na Duque de Caxias tá puxado.','Tô indo no mercado.',
    'Que calor, hein!','Viu o jogo ontem?','Matelândia tá crescendo!','Cuidado com a polícia por aí…','Tô atrasado pro serviço!',
    'A festa da igreja é domingo.','Sabe onde fica a rodoviária?','Esse asfalto novo ficou bom.'],
  seguir:['Bora!','Tô indo junto.','Pode ir na frente.'],
  tchau:['Falou, até mais!','Tchau!','Até a próxima!'],
  susto:['Aaah!','Socorro!','Tá louco?!','Sai pra lá!'],
  cheio:['Já tem gente demais te seguindo!'],
};
const sorteia=l=>l[(Math.random()*l.length)|0];
// balões de fala: sprites com texto, presos acima da cabeça
const baloes=[];
function falar(p,txt,seg=3.5){
  let b=baloes.find(b=>b.p===p)||baloes.find(b=>b.t<=0);
  if(!b){ const cv=document.createElement('canvas'); cv.width=512; cv.height=150; const tex=new THREE.CanvasTexture(cv); tex.colorSpace=THREE.SRGBColorSpace;
    const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true})); sp.renderOrder=20; scene.add(sp); b={sp,cv,tex,t:0,p:null}; baloes.push(b); }
  const k=b.cv.getContext('2d'); k.clearRect(0,0,512,150);
  k.fillStyle='rgba(255,255,255,.95)'; k.strokeStyle='#111'; k.lineWidth=5;
  k.beginPath(); k.roundRect(6,6,500,108,26); k.fill(); k.stroke();
  k.beginPath(); k.moveTo(230,112); k.lineTo(256,146); k.lineTo(282,112); k.fill();
  k.fillStyle='#111'; k.textAlign='center'; k.textBaseline='middle';
  let fs=46; k.font=`700 ${fs}px system-ui,sans-serif`; while(k.measureText(txt).width>470&&fs>22){ fs-=2; k.font=`700 ${fs}px system-ui,sans-serif`; }
  k.fillText(txt,256,61); b.tex.needsUpdate=true;
  b.sp.scale.set(2.6,0.76,1); b.sp.visible=true; b.p=p; b.t=seg;
}
export function atualizarBaloes(dt){
  for(const b of baloes){ if(b.t<=0) continue; b.t-=dt;
    if(b.t<=0||!b.p.obj){ b.sp.visible=false; b.t=0; continue; }
    b.sp.position.set(b.p.x,(b.p.y||0)+2.3,b.p.z); }
}

// pedestre mais perto do jogador que pode interagir (de pé)
export function pedestrePerto(x,z,r=3.6){
  let m=null, md=r; for(const p of gente){ if(!p.obj||p.modo==='caido'||p.modo==='levantar') continue; const d=Math.hypot(p.x-x,p.z-z); if(d<md){ md=d; m=p; } } return m;
}
// acao: 'conversar' | 'cumprimentar' | 'seguir' | 'assustar'; devolve true se alguém respondeu
export function interagir(acao, jx, jz){
  const p=pedestrePerto(jx,jz); if(!p) return false;
  const parar=(t,gesto)=>{ if(p.modo!=='papo'&&p.modo!=='seguir') p.antes=p.modo==='vitrine'||p.modo==='fugir'||p.modo==='voltar'?'andar':p.modo; p.modo='papo'; p.t=p.tMax=t; p.gesto=gesto; };
  if(acao==='conversar'){ const seguia=p.modo==='seguir'; parar(5,false); falar(p,sorteia(FALAS.conversa),4.5); if(seguia) p.antes='seguir'; }
  else if(acao==='cumprimentar'){ const seguia=p.modo==='seguir'; parar(3,true); falar(p,sorteia(FALAS.oi),2.5); if(seguia) p.antes='seguir'; }
  else if(acao==='seguir'){
    if(p.modo==='seguir'||(p.modo==='papo'&&p.antes==='seguir')){ p.modo=p.r?'voltar':'conversa'; p.t=8; falar(p,sorteia(FALAS.tchau)); }
    else if(gente.filter(o=>o.modo==='seguir'||(o.modo==='papo'&&o.antes==='seguir')).length>=3) falar(p,FALAS.cheio[0]);
    else { p.modo='seguir'; falar(p,sorteia(FALAS.seguir)); }
  }
  else if(acao==='assustar'){ const ax=p.x-jx, az=p.z-jz, l=Math.hypot(ax,az)||1; p.modo='fugir'; p.fx=ax/l; p.fz=az/l; p.t=3; falar(p,sorteia(FALAS.susto),2); }
  return true;
}
// soco/chute do jogador: acerta o pedestre logo à frente (até 1,8 m, num cone de ~70°)
// devolve null, 'acertou' ou 'nocaute' (caiu: a polícia fica sabendo)
const FALAS_DOR=['Ai!','Ui!','Tá maluco?!','Para com isso!','Socorro, polícia!','Aiii!'];
export function golpearPedestre(jx,jz,fx,fz,tipo){
  let alvo=null, md=1.8;
  for(const p of gente){ if(!p.obj||p.modo==='caido'||p.modo==='levantar') continue;
    const dx=p.x-jx, dz=p.z-jz, d=Math.hypot(dx,dz); if(d>=md||d<0.01) continue;
    if((dx*fx+dz*fz)/d<0.35) continue; md=d; alvo=p; }
  if(!alvo) return null;
  const p=alvo; p.energia=(p.energia??100)-(tipo==='chute'?40:24);
  if(p.energia<=0){
    p.energia=100; p.modo='caido'; p.t=6+Math.random()*3; p.queda=0;
    const k=tipo==='chute'?3.2:2.2; p.vx=fx*k; p.vz=fz*k; p.vy=1.2; p.rumo=Math.atan2(-fx,-fz);   // cai de costas
    animar(p,'parado'); return 'nocaute';
  }
  p.x+=fx*0.35; p.z+=fz*0.35;                                  // tranco
  p.modo='fugir'; p.fx=fx; p.fz=fz; p.t=2.5; falar(p,sorteia(FALAS_DOR),2);
  return 'acertou';
}
export const quantosSeguem=()=>gente.filter(o=>o.modo==='seguir'||(o.modo==='papo'&&o.antes==='seguir')).length;

// para o trânsito e para o minimapa
export function posicoesPedestres(){ return gente.filter(p=>p.obj).map(p=>[p.x,p.z]); }
