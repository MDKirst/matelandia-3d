// Polícia: atropelar ou bater forte deixa o jogador PROCURADO (★ a ★★★★★). As viaturas (caminhonete
// e SUV da polícia, modelos de IA) nascem longe e vêm atrás com o giroflex ligado; quando o jogador para
// ou está a pé, descem 4 PMs (o personagem 3D policial.glb) e correm para prender. Se alcança: PRESO.
// 21/11, pedido do Maicon: polícia mais rápida, 4 PMs por carro, ★★ = 3 viaturas, ★★★★ = 5 viaturas + helicóptero.
// Longe de todas as viaturas (e do helicóptero) por um tempo: despistou.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { scene, $ } from './cena.js';
import { toXZ } from './geo.js';
import { ruas } from './cidade.js';
import { bloqueado } from './mundo.js';
import { carregarModelo } from './pedestres.js';
import { LEVE } from './config.js';

const MAX_ESTRELAS=5;
const VIATURAS=[0,1,3,4,5,5];                 // viaturas atrás do jogador por nº de estrelas
const PMS_POR_CARRO=LEVE?2:4;                // celular fraco: 2 PMs por carro
const velViatura=()=>24+2*policia.estrelas;   // m/s: ★ 26 … ★★★★★ 34 (era 22)
const SOBE_A_CADA=35;                       // s de fuga com a polícia vendo: +1 estrela (como no GTA)
const velPM=()=>8.6+0.4*policia.estrelas;     // m/s a pé: ★ 9 … ★★★★★ 10,6 (era 5,2; o jogador corre a 10)

const loader=new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
let molde=null, moldeSuv=null, moldeGuarda=null, posto=[0,0];
export const policia={ estrelas:0, carros:[], heli:null };
let semVer=0, aviso=0, espera=0, fuga=0;

export async function iniciarPolicia(lugares){
  const pm=lugares.find(l=>/police|pol[ií]cia|\bPM\b/i.test((l.cat||'')+' '+l.n)); if(pm) posto=toXZ(pm.lat,pm.lon);
  // viatura = a caminhonete preta da polícia do Couro & Asfalto (modelo de IA), pedido do Maicon em 16/11
  await new Promise(ok=>loader.load('assets/veiculos/caminhonete-policia.glb',g=>{ molde=g.scene; ok(); },undefined,()=>ok()));
  await new Promise(ok=>loader.load('assets/veiculos/viatura-suv.glb',g=>{ moldeSuv=g.scene; ok(); },undefined,()=>ok()));   // SUV da polícia: metade das viaturas
  // policial que desce da viatura: o PM feito por IA (Mixamo); os movimentos dele têm nome em inglês
  moldeGuarda=await carregarModelo('policial');
  if(moldeGuarda){ const a=moldeGuarda.anims; a.parado??=a.Idle; a.andar??=a.Walk; a.correr??=a.Run; a.acenar??=a.Clapping; }
  else moldeGuarda=await carregarModelo('male-suit-24');
}

function avisar(txt,seg=3){ const a=$('aviso'); a.textContent=txt; a.style.opacity=1; aviso=seg; }
function hud(){ $('procurado').textContent=policia.estrelas?'★'.repeat(policia.estrelas)+'☆'.repeat(MAX_ESTRELAS-policia.estrelas):''; }

// algo grave aconteceu perto (atropelamento, batida forte): sobe o nível de procurado
export function crime(peso=1, motivo=''){
  const antes=policia.estrelas; policia.estrelas=Math.min(MAX_ESTRELAS,policia.estrelas+peso); semVer=0; fuga=0; hud();
  if(!antes) avisar(motivo?`${motivo} · a polícia está vindo!`:'A polícia está vindo!');
  else if(policia.estrelas>=4&&antes<4) avisar('🚁 Helicóptero da polícia no ar!');
  espera=Math.min(espera||1.5,1.5);   // a primeira viatura chega rápido
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
    const suv=moldeSuv&&Math.random()<0.5, obj=(suv?moldeSuv:molde).clone(); obj.rotation.order='YXZ';
    if(!suv) obj.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color.multiplyScalar(1.8); } });   // preta: clareia um pouco (como no trânsito)
    const box=new THREE.Box3().setFromObject(obj), tam=box.getSize(new THREE.Vector3());
    // giroflex: vermelho e azul no teto e no para-choque da frente (como no Couro & Asfalto)
    const luz=[0xff2a2a,0x2a5bff].map((c,i)=>{ const m=new THREE.Mesh(new THREE.BoxGeometry(0.45,0.16,0.3),new THREE.MeshBasicMaterial({color:c})); m.position.set(i?0.32:-0.32,tam.y+0.06,0.1); obj.add(m);
      const p=new THREE.Mesh(new THREE.BoxGeometry(0.22,0.1,0.06),m.material); p.position.set(i?0.45:-0.45,tam.y*0.42,box.min.z-0.02); obj.add(p); return m; });
    scene.add(obj);
    const h=Math.atan2(-(px-q[0]),-(pz-q[1]));
    policia.carros.push({obj,x:q[0],z:q[1],h,v:0,meio:tam.z/2,larg:tam.x/2,luz,re:0,travado:0,ult:[q[0],q[1]],guardas:[],desceu:false});
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

function tirar(c){ scene.remove(c.obj); for(const g of c.guardas) scene.remove(g.obj); c.guardas=[]; }
// roupa nova (disfarce) ou fim da perseguição: some com as estrelas e as viaturas atrás
export function perdoar(){ if(!policia.estrelas) return false; limpar(); return true; }
function limpar(){ for(const c of policia.carros) tirar(c); policia.carros=[]; tirarHeli(); policia.estrelas=0; semVer=0; fuga=0; hud(); }

// descem os PMs: motorista, carona e os dois de trás
function descerGuardas(c){
  if(c.desceu||!moldeGuarda) return; c.desceu=true;
  const e=1.8/moldeGuarda.altura;
  const ex=-Math.cos(c.h), ez=Math.sin(c.h), fx=-Math.sin(c.h), fz=-Math.cos(c.h);   // lado do motorista / frente
  const portas=[[1,0.25],[-1,0.25],[1,-0.45],[-1,-0.45]].slice(0,PMS_POR_CARRO);
  portas.forEach(([lado,frente],i)=>{
    const obj=clonarEsqueleto(moldeGuarda.cena); obj.scale.multiplyScalar(e);
    obj.traverse(o=>{ if(o.isMesh){ o.frustumCulled=false; o.material=o.material.clone(); if(!/skin|eye|hair|brow/i.test(o.material.name)) o.material.color.setHex(0x1e2d4f); } });  // farda azul-marinho
    const x=c.x+ex*lado*(c.larg+0.8)+fx*frente*c.meio, z=c.z+ez*lado*(c.larg+0.8)+fz*frente*c.meio;
    const g={obj, x, z, pe:-moldeGuarda.base*e, mixer:new THREE.AnimationMixer(obj), acoes:{}, atual:null,
      ritmo:0.92+Math.random()*0.16, cerco:i*Math.PI/2+Math.random()*0.4};   // cada um num ritmo e chegando por um lado
    for(const [n,a] of Object.entries(moldeGuarda.anims)) g.acoes[n]=g.mixer.clipAction(a);
    scene.add(obj); c.guardas.push(g);
  });
}
function animarGuarda(g,n){ const a=g.acoes[n]||g.acoes.parado; if(!a||a===g.atual) return; if(g.atual) g.atual.fadeOut(0.2); a.reset().fadeIn(0.2).play(); g.atual=a; }

/* ───────── helicóptero (★★★★ ou mais): feito de caixas, com rotor e holofote ───────── */
function novoHeli(x,z){
  const g=new THREE.Group(), M=(c)=>new THREE.MeshLambertMaterial({color:c});
  const caixa=(w,h,d,m,px,py,pz)=>{ const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m); o.position.set(px,py,pz); g.add(o); return o; };
  const azul=M(0x1e2d4f), branco=M(0xe8e8e8), vidro=new THREE.MeshLambertMaterial({color:0x6fa8dc,transparent:true,opacity:0.7});
  caixa(2.2,1.8,4.2,azul,0,0,0);                  // cabine
  caixa(2.25,0.5,4.25,branco,0,-0.2,0);           // faixa branca
  caixa(1.9,1.1,1.2,vidro,0,0.25,-2.4);           // para-brisa
  caixa(0.5,0.5,5.5,azul,0,0.4,4.6);              // cauda
  caixa(0.15,1.4,0.9,azul,0,1.0,7.1);             // deriva
  for(const s of [-1,1]) caixa(0.12,0.12,3.8,M(0x222222),s*1.0,-1.25,0);   // esquis
  const rotor=new THREE.Group(); rotor.position.y=1.25; g.add(rotor);
  for(const r of [0,Math.PI/2]){ const p=new THREE.Mesh(new THREE.BoxGeometry(11,0.06,0.35),M(0x111111)); p.rotation.y=r; rotor.add(p); }
  const cauda=new THREE.Mesh(new THREE.BoxGeometry(0.06,2.2,0.25),M(0x111111)); cauda.position.set(0.3,1.0,7.1); g.add(cauda);
  const luz=[0xff2a2a,0x2a5bff].map((c,i)=>caixa(0.3,0.18,0.3,new THREE.MeshBasicMaterial({color:c}),i?0.6:-0.6,0.95,0.8));
  // holofote: cone de luz até o chão + círculo claro em volta do jogador
  const cone=new THREE.Mesh(new THREE.ConeGeometry(6,1,24,1,true),new THREE.MeshBasicMaterial({color:0xfff6c8,transparent:true,opacity:0.10,depthWrite:false,side:THREE.DoubleSide}));
  const mancha=new THREE.Mesh(new THREE.CircleGeometry(6,32),new THREE.MeshBasicMaterial({color:0xfff6c8,transparent:true,opacity:0.22,depthWrite:false}));
  mancha.rotation.x=-Math.PI/2; scene.add(cone,mancha);
  scene.add(g);
  const ang=Math.random()*Math.PI*2;
  policia.heli={obj:g,rotor,cauda,luz,cone,mancha,x:x+Math.cos(ang)*160,z:z+Math.sin(ang)*160,y:45,h:0,giro:ang};
}
function tirarHeli(){ const H=policia.heli; if(!H) return; scene.remove(H.obj,H.cone,H.mancha); policia.heli=null; }
function atualizarHeli(dt,jog,pisca){
  const H=policia.heli; if(!H) return 1e9;
  H.giro+=dt*0.35;                                               // circula em volta do jogador, uns 18 m ao lado
  const ax=jog.x+Math.cos(H.giro)*18, az=jog.z+Math.sin(H.giro)*18, dx=ax-H.x, dz=az-H.z, d=Math.hypot(dx,dz);
  const vmax=policia.estrelas>=5?38:31, passo=Math.min(d,vmax*dt);
  if(d>0.01){ H.x+=dx/d*passo; H.z+=dz/d*passo; }
  const alvoH=Math.atan2(-(jog.x-H.x),-(jog.z-H.z)); let dh=alvoH-H.h; dh=Math.atan2(Math.sin(dh),Math.cos(dh)); H.h+=dh*Math.min(1,dt*2);
  H.y+=((d>40?55:32)-H.y)*Math.min(1,dt*0.8);
  H.obj.position.set(H.x,H.y,H.z); H.obj.rotation.set(Math.min(0.25,passo/dt/120),H.h,0,'YXZ');   // inclina para frente quando acelera
  H.rotor.rotation.y+=dt*28; H.cauda.rotation.x+=dt*40;
  H.luz[0].material.color.setHex(pisca?0xff2a2a:0x400808); H.luz[1].material.color.setHex(pisca?0x10204a:0x2a5bff);
  // holofote do helicóptero até o jogador
  const hx=jog.x-H.x, hz=jog.z-H.z, alt=H.y, L=Math.hypot(hx,alt,hz);
  H.cone.scale.set(1,L,1); H.cone.position.set((H.x+jog.x)/2,alt/2,(H.z+jog.z)/2);
  H.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),new THREE.Vector3(hx/L,-alt/L,hz/L));
  H.mancha.position.set(jog.x,0.15,jog.z);
  return Math.hypot(jog.x-H.x,jog.z-H.z);
}

// jog: {x,z,dirigindo,v}; prender(): o jogo leva o jogador para o posto
export function atualizarPolicia(dt, jog, prender){
  if(aviso>0){ aviso-=dt; if(aviso<=0) $('aviso').style.opacity=0; }
  if(!policia.estrelas) return;
  const quer=VIATURAS[policia.estrelas];
  if(policia.carros.length<quer){ espera-=dt; if(espera<=0){ novaViatura(jog.x,jog.z); espera=policia.estrelas>=2?1.5:3; } }
  if(policia.estrelas>=4&&!policia.heli) novoHeli(jog.x,jog.z);
  if(policia.estrelas<4) tirarHeli();
  let menorDist=1e9;
  const pisca=(performance.now()/180|0)%2;
  const dHeli=atualizarHeli(dt,jog,pisca);
  const parado=!jog.dirigindo||Math.abs(jog.v)<1.5;
  for(const c of policia.carros){
    c.luz[0].material.color.setHex(pisca?0xff2a2a:0x400808); c.luz[1].material.color.setHex(pisca?0x10204a:0x2a5bff);
    const dx=jog.x-c.x, dz=jog.z-c.z, d=Math.hypot(dx,dz); menorDist=Math.min(menorDist,d);
    const lento=!jog.dirigindo||Math.abs(jog.v)<5;
    if(c.guardas.length){
      // PMs a pé correndo atrás do jogador, cada um chegando por um lado (cerco)
      const sp=velPM();
      for(let i=c.guardas.length-1;i>=0;i--){ const g=c.guardas[i];
        const ax0=jog.x-g.x, az0=jog.z-g.z, dg=Math.hypot(ax0,az0);
        if(dg<1.5&&parado){ avisar('PRESO! Multa de M$ 500',2); prender(posto); limpar(); return; }
        if(dg>55){ scene.remove(g.obj); c.guardas.splice(i,1); continue; }          // ficou para trás: volta para a viatura
        const k=dg>4?Math.min(1,(dg-4)/10)*2.5:0;                                     // de longe abre o cerco, de perto vai reto
        const tx=jog.x+Math.cos(g.cerco)*k, tz=jog.z+Math.sin(g.cerco)*k, ax=tx-g.x, az=tz-g.z, da=Math.hypot(ax,az)||1;
        const v=sp*g.ritmo*dt, nx=g.x+ax/da*v, nz=g.z+az/da*v;
        if(!bloqueado(nx,nz)){ g.x=nx; g.z=nz; } else if(!bloqueado(nx,g.z)) g.x=nx; else if(!bloqueado(g.x,nz)) g.z=nz;
        animarGuarda(g,'correr'); g.obj.position.set(g.x,g.pe,g.z); g.obj.rotation.y=Math.atan2(ax0,az0); g.mixer.update(dt); }
      c.v=0; if(c.guardas.length) continue;
      c.desceu=false;                                                                 // todos voltaram: a viatura volta a perseguir
    }
    if(d<15&&lento){ c.v=0; descerGuardas(c); continue; }
    // segue a rota pelas ruas (refeita a cada 2 s); nos últimos 25 m vai direto ao jogador
    c.recalc=(c.recalc||0)-dt;
    if(c.recalc<=0){ c.rota=rota(c.x,c.z,jog.x,jog.z); c.recalc=2; }
    while(c.rota&&c.rota.length&&Math.hypot(c.rota[0][0]-c.x,c.rota[0][1]-c.z)<7) c.rota.shift();
    const [ax,az]=(d<25||!c.rota||!c.rota.length)?[jog.x,jog.z]:c.rota[0];
    const alvoH=Math.atan2(-(ax-c.x),-(az-c.z)); let dh=alvoH-c.h; dh=Math.atan2(Math.sin(dh),Math.cos(dh));
    if(c.re>0){ c.re-=dt; c.v=-5; c.h-=Math.sign(dh||1)*1.5*dt; }
    else { const curva=Math.abs(dh)>0.6?9:Math.abs(dh)>0.25?16:99;            // reduz para fazer a esquina
      const vmax=Math.min(curva,d>40?velViatura():d>18?15:8); c.v+=Math.sign(vmax-c.v)*Math.min(Math.abs(vmax-c.v),14*dt); c.h+=Math.max(-2.4*dt,Math.min(2.4*dt,dh)); }
    const fx=-Math.sin(c.h), fz=-Math.cos(c.h), nx=c.x+fx*c.v*dt, nz=c.z+fz*c.v*dt;
    if(bloqueado(nx+fx*c.meio*Math.sign(c.v||1),nz+fz*c.meio*Math.sign(c.v||1))){ if(c.re<=0) c.re=0.7; }
    else { c.x=nx; c.z=nz; }
    // travou mesmo assim: reaparece no próximo ponto da rota (longe) ou na rua mais perto
    c.travado+=dt; if(c.travado>3){ if(Math.hypot(c.x-c.ult[0],c.z-c.ult[1])<3){ const n=(c.rota&&c.rota[1])||maisPerto(c.x,c.z).p; c.x=n[0]; c.z=n[1]; c.re=0; c.recalc=0; } c.travado=0; c.ult=[c.x,c.z]; }
    c.obj.position.set(c.x,0,c.z); c.obj.rotation.y=c.h;
  }
  // longe de todas as viaturas por 12 s e sem o helicóptero em cima: despistou
  // (com helicóptero só despista indo além de 260 m dele: rua com moto rápida ou turbo)
  const visto=menorDist<=230||dHeli<260;
  if(policia.carros.length&&!visto){ semVer+=dt; if(semVer>12){ limpar(); avisar('Você despistou a polícia'); } } else semVer=0;
  // fugindo com a polícia na cola: a perseguição esquenta sozinha (22/11, pedido do Maicon)
  if(visto&&policia.estrelas<MAX_ESTRELAS){ fuga+=dt; if(fuga>=SOBE_A_CADA){ fuga=0; const antes=policia.estrelas; policia.estrelas++; hud(); espera=Math.min(espera,1.5);
    avisar(policia.estrelas>=4&&antes<4?'🚁 A perseguição esquentou: helicóptero no ar!':'🚨 A perseguição esquentou! Mais viaturas a caminho'); } }
  else if(!visto) fuga=Math.max(0,fuga-dt);
}
// viatura e PM para a batida no ponto das gangues (gangues.js)
export const moldesPolicia=()=>({ carro:molde, suv:moldeSuv, pm:moldeGuarda });
export const posicoesPolicia=()=>policia.carros.map(c=>[c.x,c.z,c.h,c.meio,c.larg]);
