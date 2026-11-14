// Trânsito de fundo: os mesmos veículos feitos por IA 3D (assets/veiculos) rodando pelas ruas do OSM,
// mão direita, respeitando mão única. Em cruzamento escolhem uma rua ao acaso; rua sem
// saída = meia-volta. Param se tiver algo na frente. Só existem perto do jogador.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { scene } from './cena.js';
import { ruas } from './cidade.js';
import { lombadas, alturaLombada } from './detalhes.js';
import { fumaca, fogo } from './efeitos.js';

// só modelos gerados por IA 3D, já em metros e com a frente em -Z; peso = chance de sair.
// suv/picape/cavalo: TRELLIS deste projeto. Os demais vieram do Couro & Asfalto (imagem do Gemini →
// Stable Fast 3D / TRELLIS, preparados lá); os modelados no Blender ficaram de fora.
// partes: peças em fila (z = centro da peça); so: tipos de via onde pode andar; tinta: aceita cor sorteada
const BR = new Set(['motorway','motorway_link','trunk','trunk_link']);
const MODELOS = [
  {partes:[{arq:'hatch'}], peso:5}, {partes:[{arq:'sedan'}], peso:5},
  {partes:[{arq:'suv'}], peso:3}, {partes:[{arq:'suv2'}], peso:3},
  {partes:[{arq:'picape'}], peso:3, tinta:true}, {partes:[{arq:'picape2'}], peso:3, tinta:true},
  {partes:[{arq:'onibus'}], peso:1}, {partes:[{arq:'ambulancia'}], peso:1},
  {partes:[{arq:'caminhonete-policia'}], peso:1, claro:1.8},
  {partes:[{arq:'cavalo'}], peso:1, so:BR},
  {partes:[{arq:'cavalinho',z:-5.5},{arq:'reboque-graneleiro',z:2.2}], peso:2, so:BR},   // carreta graneleira
];
// tinta por cima da textura (multiplica: pega bem na picape branca, quase nada no SUV preto)
const TINTAS = [0xffffff,0xffffff,0xd9443b,0x3b6fd9,0xb9bec4,0x3a3f45,0x2f8f5b,0xe0b54a];
import { horaJogo, fatorCarros } from './ceu.js';
const QTD = 18, RAIO_NASCE = [90, 320], RAIO_SOME = 420;
const TIPOS_OK = new Set(['motorway','motorway_link','trunk','trunk_link','primary','primary_link','secondary','secondary_link',
  'tertiary','tertiary_link','residential','unclassified','living_street']);

const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const moldes = {};
export const carros = [];   // {obj, r, i, dir, s, v, vAlvo}
let nos = null;             // chave de vértice → [{r,i}]  (ruas que se cruzam no mesmo nó do OSM)
const chave = p=>Math.round(p[0]*10)+'_'+Math.round(p[1]*10);

function montarGrafo(){
  nos = new Map();
  for(const r of ruas){ if(!TIPOS_OK.has(r.tipo)) continue;
    r.pts.forEach((p,i)=>{ const k=chave(p); if(!nos.has(k)) nos.set(k,[]); nos.get(k).push({r,i}); }); }
}
const pode = (r,dir)=>!r.mao||r.mao===dir;

// posição na faixa: centro do trecho + deslocamento para a direita (mão única: no meio)
function pose(c){
  const a=c.r.pts[c.i], b=c.r.pts[c.i+c.dir], dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1e-6, t=Math.min(1,c.s/L);
  const ux=dx/L, uz=dz/L, off=c.r.mao?0:Math.min(c.r.w/4,2.2);
  return { x:a[0]+dx*t-uz*off, z:a[1]+dz*t+ux*off, ux, uz, L };
}

function colocar(c, px, pz){
  // escolhe um trecho de rua a uma distância boa do jogador
  const ok=ruas.filter(r=>TIPOS_OK.has(r.tipo)&&r.pts.length>1&&(!c.so||c.so.has(r.tipo)));
  if(!ok.length){ c.obj.visible=false; c.r=null; return false; }
  for(let t=0;t<40;t++){
    const r=ok[Math.random()*ok.length|0], i=Math.random()*(r.pts.length-1)|0, p=r.pts[i], d=Math.hypot(p[0]-px,p[1]-pz);
    if(d<RAIO_NASCE[0]||d>RAIO_NASCE[1]) continue;
    let dir=Math.random()<0.5?1:-1; if(!pode(r,dir)) dir=-dir;
    c.r=r; c.dir=dir; c.i=dir===1?i:i+1; c.s=0; c.v=c.vAlvo=0; c.obj.visible=true; c.quebrado=0; c.forte=false; return true;
  }
  c.obj.visible=false; c.r=null; return false;
}

// chegou no fim do trecho: segue na mesma rua ou vira em outra que passa pelo mesmo nó
function proximo(c){
  const j=c.i+c.dir;
  if(j+c.dir>=0 && j+c.dir<c.r.pts.length && Math.random()<0.75){ c.i=j; return; }
  const op=[];
  for(const {r,i} of nos.get(chave(c.r.pts[j]))||[]){
    if(r===c.r&&i===j){ if(j+c.dir>=0&&j+c.dir<r.pts.length) op.push({r,i,dir:c.dir}); continue; }
    if(c.so&&!c.so.has(r.tipo)) continue;                    // carreta não entra na cidade
    for(const dir of [1,-1]) if(i+dir>=0&&i+dir<r.pts.length&&pode(r,dir)) op.push({r,i,dir});
  }
  if(op.length){ const o=op[Math.random()*op.length|0]; c.r=o.r; c.i=o.i; c.dir=o.dir; return; }
  if(pode(c.r,-c.dir)){ c.i=j; c.dir=-c.dir; return; }   // sem saída: meia-volta
  c.r=null;                                                  // mão única sem saída: some e renasce
}

export async function iniciarTransito(px,pz){
  montarGrafo();
  const arquivos=[...new Set(MODELOS.flatMap(m=>m.partes.map(p=>p.arq)))], cenas={};
  await Promise.all(arquivos.map(a=>new Promise(ok=>loader.load(`assets/veiculos/${a}.glb`, g=>{ cenas[a]=g.scene; ok(); }, undefined, e=>{ console.warn('veículo',a,e); ok(); }))));
  MODELOS.forEach((m,i)=>{
    if(!m.partes.every(p=>cenas[p.arq])) return;
    const grupo=new THREE.Group(); for(const p of m.partes){ const o=cenas[p.arq].clone(); o.position.z=p.z||0; grupo.add(o); }
    const box=new THREE.Box3().setFromObject(grupo), tam=box.getSize(new THREE.Vector3()), cz=(box.min.z+box.max.z)/2;
    for(const o of grupo.children) o.position.z-=cz;                                   // centro no meio do conjunto
    if(m.claro) grupo.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color.multiplyScalar(m.claro); } });
    moldes[i]={cena:grupo, meio:tam.z/2, larg:tam.x/2, m};
  });
  const sorteio=Object.keys(moldes).flatMap(i=>Array(moldes[i].m.peso).fill(i)); if(!sorteio.length) return;
  // passo sem divisor comum com o tamanho da lista: percorre todos os modelos antes de repetir
  const mdc=(a,b)=>b?mdc(b,a%b):a; let passo=7; while(mdc(passo,sorteio.length)!==1) passo++;
  for(let k=0;k<QTD;k++){
    const chaves=Object.keys(moldes), md=moldes[k<chaves.length?chaves[k]:sorteio[(k*passo+3)%sorteio.length]], obj=md.cena.clone(); obj.rotation.order='YXZ'; // um de cada, depois pelo peso
    const tinta=TINTAS[k%TINTAS.length];
    if(md.m.tinta&&tinta!==0xffffff) obj.traverse(o=>{ if(o.isMesh){ o.material=o.material.clone(); o.material.color.setHex(tinta); } });
    scene.add(obj);
    const c={obj, r:null, i:0, dir:1, s:0, v:0, vAlvo:0, vCruz:7+Math.random()*5, meio:md.meio, larg:md.larg, so:md.m.so};
    colocar(c,px,pz); carros.push(c);
  }
}

// outros: [[x,z,rf,rl]] obstáculos que o carro respeita (jogador, veículos estacionados); também desvia dos outros carros
export function atualizarTransito(dt, px, pz, outros){
  const limite=Math.round(QTD*fatorCarros(horaJogo()));        // menos carro de madrugada
  for(const [k,c] of carros.entries()){
    if(!c.r || Math.hypot(c.obj.position.x-px,c.obj.position.z-pz)>RAIO_SOME){
      if(k>=limite){ c.r=null; c.obj.visible=false; continue; }   // sobra: só volta quando a hora pedir
      colocar(c,px,pz); if(!c.r) continue; }
    let P=pose(c);
    if(c.quebrado){                                          // batido pelo jogador: parado soltando fumaça (some quando ficar longe)
      c.quebrado=Math.max(0.001,c.quebrado-dt); c.v=0; c.acum=(c.acum||0)+dt*(c.quebrado>20?14:6);
      const fx=-Math.sin(c.obj.rotation.y), fz=-Math.cos(c.obj.rotation.y);
      while(c.acum>=1){ c.acum-=1; const x=c.obj.position.x+fx*c.meio*0.75, z=c.obj.position.z+fz*c.meio*0.75;
        if(c.forte&&Math.random()<0.35) fogo(x,1.1,z,0.9); else fumaca(x,1.3,z,c.forte?0.8:0.3); }
      continue; }
    // tem algo até 9 m à frente, na mesma faixa?
    let livre=true;
    // rf = meia-largura na frente/trás, rl = meia-largura de lado
    const testar=(x,z,rf,rl)=>{ const dx=x-P.x, dz=z-P.z, f=dx*P.ux+dz*P.uz, l=Math.abs(-dx*P.uz+dz*P.ux); if(f>0&&f<7+rf&&l<1.3+rl) livre=false; };
    for(const o of outros) testar(o[0],o[1],o[2],o[3]);
    for(const d of carros) if(d!==c&&d.r&&d.obj.visible) testar(d.obj.position.x,d.obj.position.z,d.meio+c.meio-2.2,d.larg);
    const lim=c.r.tipo.startsWith('motorway')?Math.max(c.vCruz,16):c.vCruz;
    const lomb=lombadas.some(o=>{ const dx=o.x-P.x, dz=o.z-P.z, f=dx*P.ux+dz*P.uz; return f>-2&&f<16&&Math.abs(-dx*P.uz+dz*P.ux)<4; });
    c.vAlvo=livre?(lomb?Math.min(lim,3.5):lim):0;   // reduz antes do quebra-mola
    // preso há mais de 6 s (veículo estacionado na faixa, rua travada): longe do jogador some e
    // renasce em outro lugar; perto, espera (antes dava meia-volta pulando de faixa e podia cair
    // em cima do veículo do jogador)
    c.preso = c.v<0.3&&!livre ? (c.preso||0)+dt : 0;
    if(c.preso>6&&Math.hypot(P.x-px,P.z-pz)>45){ c.preso=0; c.r=null; continue; }
    c.v += Math.sign(c.vAlvo-c.v)*Math.min(Math.abs(c.vAlvo-c.v), (c.vAlvo<c.v?9:3)*dt);
    const antes={r:c.r,i:c.i,dir:c.dir,s:c.s};
    c.s += c.v*dt;
    let guard=0;
    while(c.r && c.s>=P.L && guard++<8){ c.s-=P.L; proximo(c); if(c.r) P=pose(c); }
    if(!c.r) continue;
    P=pose(c);
    // trava final: o passo não pode terminar em cima de ninguém (curva, troca de rua, faixa)
    const ocupado=outros.some(o=>Math.hypot(o[0]-P.x,o[1]-P.z)<Math.max(o[2],o[3])+c.meio-0.3) ||
      carros.some(d=>d!==c&&d.r&&d.obj.visible&&Math.hypot(d.obj.position.x-P.x,d.obj.position.z-P.z)<(c.meio+d.meio)*0.7&&Math.hypot(d.obj.position.x-c.obj.position.x,d.obj.position.z-c.obj.position.z)>=Math.hypot(d.obj.position.x-P.x,d.obj.position.z-P.z));
    if(ocupado){ Object.assign(c,antes); c.v=0; P=pose(c); }
    c.obj.position.set(P.x,alturaLombada(P.x,P.z),P.z);
    // vira suave (os modelos olham para -Z)
    const alvo=Math.atan2(-P.ux,-P.uz); let d=alvo-c.obj.rotation.y; d=Math.atan2(Math.sin(d),Math.cos(d));
    c.obj.rotation.y += d*Math.min(1,dt*6);
  }
}

// o jogador bateu num carro do trânsito: o mais perto do ponto quebra (forte = pega fogo)
export function baterNoCarro(x,z,impacto){
  let alvo=null, md=9; for(const c of carros){ if(!c.r||!c.obj.visible) continue; const d=Math.hypot(c.obj.position.x-x,c.obj.position.z-z); if(d<md){ md=d; alvo=c; } }
  if(!alvo) return null;
  alvo.quebrado=40; alvo.forte=alvo.forte||impacto>14; alvo.v=0;
  return alvo;
}

// para o minimapa e para a colisão do veículo do jogador
export function posicoesTransito(){ return carros.filter(c=>c.r&&c.obj.visible).map(c=>[c.obj.position.x,c.obj.position.z,c.obj.rotation.y,c.meio,c.larg]); }
