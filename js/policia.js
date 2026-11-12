// Polícia: atropelar ou bater forte deixa o jogador PROCURADO (★ a ★★★). A viatura (caminhonete
// da polícia, modelo de IA) nasce longe e vem atrás com o giroflex ligado; quando o jogador para
// ou está a pé, o policial desce e corre para prender. Se alcança: PRESO, vai para o posto da PM.
// Longe de todas as viaturas por um tempo: despistou.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene, $ } from './cena.js';
import { toXZ } from './geo.js';
import { ruas } from './cidade.js';
import { bloqueado } from './mundo.js';
import { carregarModelo } from './pedestres.js';

const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
let molde=null, moldeGuarda=null, posto=[0,0];
export const policia={ estrelas:0, carros:[] };
let semVer=0, aviso=0, espera=0;

export async function iniciarPolicia(lugares){
  const pm=lugares.find(l=>/police|pol[ií]cia|\bPM\b/i.test((l.cat||'')+' '+l.n)); if(pm) posto=toXZ(pm.lat,pm.lon);
  await new Promise(ok=>loader.load('assets/veiculos/caminhonete-policia.glb',g=>{ molde=g.scene; ok(); },undefined,()=>ok()));
  moldeGuarda=await carregarModelo('male-suit-24');
}

function avisar(txt,seg=3){ const a=$('aviso'); a.textContent=txt; a.style.opacity=1; aviso=seg; }
function hud(){ $('procurado').textContent=policia.estrelas?'★'.repeat(policia.estrelas)+'☆'.repeat(3-policia.estrelas):''; }

// algo grave aconteceu perto (atropelamento, batida forte): sobe o nível de procurado
export function crime(peso=1, motivo=''){
  const antes=policia.estrelas; policia.estrelas=Math.min(3,policia.estrelas+peso); semVer=0; hud();
  if(!antes) avisar(motivo?`${motivo} · a polícia está vindo!`:'A polícia está vindo!');
  espera=Math.min(espera||2.5,2.5);   // a primeira viatura chega em alguns segundos
}

// viatura nasce numa rua entre 90 e 150 m do jogador
function novaViatura(px,pz){
  if(!molde) return;
  // pontos a cada 10 m ao longo das ruas (as do OSM só têm vértice nas pontas e nas curvas)
  const cand=[];
  for(const r of ruas){ if(r.pe) continue; const b=r.bb; if(b[0]>px+150||b[2]<px-150||b[1]>pz+150||b[3]<pz-150) continue;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], c=r.pts[i+1], L=Math.hypot(c[0]-a[0],c[1]-a[1]);
      for(let s=0;s<L;s+=10){ const q=[a[0]+(c[0]-a[0])*s/L, a[1]+(c[1]-a[1])*s/L], d=Math.hypot(q[0]-px,q[1]-pz); if(d>=90&&d<=150) cand.push(q); } } }
  for(let t=0;t<1&&cand.length;t++){
    const q=cand[(Math.random()*cand.length)|0];
    const obj=molde.clone(); obj.rotation.order='YXZ';
    obj.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color.multiplyScalar(1.8); } });   // a preta sumia no asfalto
    const box=new THREE.Box3().setFromObject(obj), tam=box.getSize(new THREE.Vector3());
    // giroflex: duas luzes no teto
    const luz=[0xff2a2a,0x2a5bff].map((c,i)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.16,0.3),new THREE.MeshBasicMaterial({color:c})); m.position.set(i?0.32:-0.32,tam.y+0.06,0.1); obj.add(m); return m; });
    scene.add(obj);
    const h=Math.atan2(-(px-q[0]),-(pz-q[1]));
    policia.carros.push({obj,x:q[0],z:q[1],h,v:0,meio:tam.z/2,larg:tam.x/2,luz,re:0,travado:0,ult:[q[0],q[1]],guarda:null});
    return;
  }
}
/* ───────── rota pelas ruas (A* no grafo de vértices do OSM) ───────── */
let grafo=null;
function montarGrafo(){
  const nos=new Map(), k=p=>Math.round(p[0]*10)+'_'+Math.round(p[1]*10);
  const no=p=>{ const c=k(p); if(!nos.has(c)) nos.set(c,{p,viz:[]}); return nos.get(c); };
  for(const r of ruas){ if(r.pe) continue; for(let i=0;i<r.pts.length-1;i++){ const a=no(r.pts[i]), b=no(r.pts[i+1]), d=Math.hypot(a.p[0]-b.p[0],a.p[1]-b.p[1]); a.viz.push([b,d]); b.viz.push([a,d]); } }
  grafo=[...nos.values()];
}
const maisPerto=(x,z)=>{ let m=null, md=1e9; for(const n of grafo){ const d=Math.hypot(n.p[0]-x,n.p[1]-z); if(d<md){ md=d; m=n; } } return m; };
function rota(x0,z0,x1,z1){
  grafo??=(montarGrafo(),grafo);
  const ini=maisPerto(x0,z0), fim=maisPerto(x1,z1); if(!ini||!fim) return [];
  const g=new Map([[ini,0]]), de=new Map(), aberto=[ini], h=n=>Math.hypot(n.p[0]-fim.p[0],n.p[1]-fim.p[1]);
  const f=new Map([[ini,h(ini)]]); let passos=0;
  while(aberto.length&&passos++<6000){
    let bi=0; for(let i=1;i<aberto.length;i++) if(f.get(aberto[i])<f.get(aberto[bi])) bi=i;
    const n=aberto.splice(bi,1)[0];
    if(n===fim){ const out=[]; let c=fim; while(c){ out.unshift(c.p); c=de.get(c); } return out; }
    for(const [v,d] of n.viz){ const ng=g.get(n)+d; if(ng<(g.get(v)??1e9)){ g.set(v,ng); de.set(v,n); f.set(v,ng+h(v)); if(!aberto.includes(v)) aberto.push(v); } }
  }
  return [];
}

function tirar(c){ scene.remove(c.obj); if(c.guarda) scene.remove(c.guarda.obj); }
function limpar(){ for(const c of policia.carros) tirar(c); policia.carros=[]; policia.estrelas=0; semVer=0; hud(); }

function descerGuarda(c){
  if(c.guarda||!moldeGuarda) return;
  const obj=clonarEsqueleto(moldeGuarda.cena), e=1.8/moldeGuarda.altura; obj.scale.multiplyScalar(e);
  obj.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false; o.material=o.material.clone(); if(!/skin|eye|hair|brow/i.test(o.material.name)) o.material.color.setHex(0x1e2d4f); } });  // farda azul-marinho
  const ex=-Math.cos(c.h), ez=Math.sin(c.h);                                         // lado do motorista
  const g={obj, x:c.x+ex*(c.larg+0.8), z:c.z+ez*(c.larg+0.8), pe:-moldeGuarda.base*e, mixer:new THREE.AnimationMixer(obj), acoes:{}, atual:null};
  for(const [n,a] of Object.entries(moldeGuarda.anims)) g.acoes[n]=g.mixer.clipAction(a);
  scene.add(obj); c.guarda=g;
}
function animarGuarda(g,n){ const a=g.acoes[n]||g.acoes.parado; if(!a||a===g.atual) return; if(g.atual) g.atual.fadeOut(0.2); a.reset().fadeIn(0.2).play(); g.atual=a; }

// jog: {x,z,dirigindo,v}; prender(): o jogo leva o jogador para o posto
export function atualizarPolicia(dt, jog, prender){
  if(aviso>0){ aviso-=dt; if(aviso<=0) $('aviso').style.opacity=0; }
  if(!policia.estrelas) return;
  const quer=policia.estrelas>=3?2:1;
  if(policia.carros.length<quer){ espera-=dt; if(espera<=0){ novaViatura(jog.x,jog.z); espera=6; } }
  let menorDist=1e9;
  const pisca=(performance.now()/180|0)%2;
  for(const c of policia.carros){
    c.luz[0].material.color.setHex(pisca?0xff2a2a:0x400808); c.luz[1].material.color.setHex(pisca?0x10204a:0x2a5bff);
    const dx=jog.x-c.x, dz=jog.z-c.z, d=Math.hypot(dx,dz); menorDist=Math.min(menorDist,d);
    const lento=!jog.dirigindo||Math.abs(jog.v)<4;
    if(c.guarda){
      // policial a pé correndo atrás do jogador
      const g=c.guarda, ax=jog.x-g.x, az=jog.z-g.z, dg=Math.hypot(ax,az);
      if(dg<1.4&&(!jog.dirigindo||Math.abs(jog.v)<1.5)){ avisar('PRESO!',4); prender(posto); limpar(); return; }
      if(dg>45){ scene.remove(g.obj); c.guarda=null; }                             // fugiu: volta para a viatura
      else { const sp=5.2, nx=g.x+ax/dg*sp*dt, nz=g.z+az/dg*sp*dt;
        if(!bloqueado(nx,nz)){ g.x=nx; g.z=nz; } else if(!bloqueado(nx,g.z)) g.x=nx; else if(!bloqueado(g.x,nz)) g.z=nz;
        animarGuarda(g,'correr'); g.obj.position.set(g.x,g.pe,g.z); g.obj.rotation.y=Math.atan2(ax,az); g.mixer.update(dt); }
      c.v=0; continue;
    }
    if(d<12&&lento){ c.v=0; descerGuarda(c); continue; }
    // segue a rota pelas ruas (refeita a cada 3 s); nos últimos 25 m vai direto ao jogador
    c.recalc=(c.recalc||0)-dt;
    if(c.recalc<=0){ c.rota=rota(c.x,c.z,jog.x,jog.z); c.recalc=3; }
    while(c.rota&&c.rota.length&&Math.hypot(c.rota[0][0]-c.x,c.rota[0][1]-c.z)<7) c.rota.shift();
    const [ax,az]=(d<25||!c.rota||!c.rota.length)?[jog.x,jog.z]:c.rota[0];
    const alvoH=Math.atan2(-(ax-c.x),-(az-c.z)); let dh=alvoH-c.h; dh=Math.atan2(Math.sin(dh),Math.cos(dh));
    if(c.re>0){ c.re-=dt; c.v=-4; c.h-=Math.sign(dh||1)*1.2*dt; }
    else { const curva=Math.abs(dh)>0.6?7:Math.abs(dh)>0.25?12:99;            // reduz para fazer a esquina
      const vmax=Math.min(curva,d>40?22:d>18?12:6); c.v+=Math.sign(vmax-c.v)*Math.min(Math.abs(vmax-c.v),8*dt); c.h+=Math.max(-1.8*dt,Math.min(1.8*dt,dh)); }
    const fx=-Math.sin(c.h), fz=-Math.cos(c.h), nx=c.x+fx*c.v*dt, nz=c.z+fz*c.v*dt;
    if(bloqueado(nx+fx*c.meio*Math.sign(c.v||1),nz+fz*c.meio*Math.sign(c.v||1))){ if(c.re<=0) c.re=0.9; }
    else { c.x=nx; c.z=nz; }
    // travou de vez longe do jogador: reaparece mais perto
    // travou mesmo assim: reaparece no próximo ponto da rota (longe) ou na rua mais perto
    c.travado+=dt; if(c.travado>4){ if(Math.hypot(c.x-c.ult[0],c.z-c.ult[1])<3){ const n=(c.rota&&c.rota[1])||maisPerto(c.x,c.z).p; c.x=n[0]; c.z=n[1]; c.re=0; c.recalc=0; } c.travado=0; c.ult=[c.x,c.z]; }
    c.obj.position.set(c.x,0,c.z); c.obj.rotation.y=c.h;
  }
  // longe de todas as viaturas por 12 s: despistou
  if(policia.carros.length&&menorDist>230){ semVer+=dt; if(semVer>12){ limpar(); avisar('Você despistou a polícia'); } } else semVer=0;
}
export const posicoesPolicia=()=>policia.carros.map(c=>[c.x,c.z,c.h,c.meio,c.larg]);
