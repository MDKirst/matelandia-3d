// Corridas de entrega: dentro de um veículo, N pega uma corrida (N de novo cancela).
// 1) buscar a carga a 150–500 m; 2) levar a 300–900 m, com tempo limite. Os pontos são os negócios abertos
// pelos jogadores e, sem negócio por perto, endereços da cidade (rua e número).
// Paga base + distância, bônus pelo tempo que sobrar, mais por veículo de carga; batida desconta;
// tempo esgotado ou veículo quebrado = falha. O dinheiro vai para o saldo M$ (terrenos.js).
import * as THREE from 'three';
import { scene, camera, $ } from './cena.js';
import { ganhar, fmt, lotes } from './terrenos.js';
import { nomeDoNegocio } from './negocios.js';
import { ruas } from './cidade.js';
import { somEntrega } from './som.js';

const PAGA_VEICULO={ suv:1.0, picape:1.2, cavalo:1.6, chopper:0.85 };   // moto leva menos carga
export const corrida={ etapa:null };   // etapa: null | 'buscar' | 'levar'

// coluna de luz no alvo
const coluna=new THREE.Mesh(new THREE.CylinderGeometry(2.2,2.2,60,24,1,true),
  new THREE.MeshBasicMaterial({color:0xfacc15,transparent:true,opacity:0.28,side:THREE.DoubleSide,depthWrite:false}));
coluna.position.y=30; coluna.visible=false; coluna.renderOrder=4; scene.add(coluna);
const anel=new THREE.Mesh(new THREE.RingGeometry(5.2,6,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xfacc15,transparent:true,opacity:0.8,depthWrite:false}));
anel.position.y=0.08; anel.visible=false; scene.add(anel);

function sortearLoja(x,z,dmin,dmax,evita){
  // negócio de jogador na faixa de distância (na calçada em frente)
  const negs=lotes.filter(l=>l.negocio).map(l=>({ id:l.id, x:l.A[0]+l.t[0]*6-l.n[0]*2, z:l.A[1]+l.t[1]*6-l.n[1]*2, nome:nomeDoNegocio(l) }))
    .filter(p=>{ const d=Math.hypot(p.x-x,p.z-z); return d>=dmin&&d<=dmax&&p.id!==evita?.id; });
  if(negs.length&&Math.random()<0.7) return negs[(Math.random()*negs.length)|0];
  // endereço: ponto na beira de uma rua com nome, número pela posição
  const vias=ruas.filter(r=>r.nome&&!r.pe&&r.tipo!=='motorway'&&r.pts.length>1);
  for(let t=0;t<80&&vias.length;t++){
    const r=vias[(Math.random()*vias.length)|0], i=(Math.random()*(r.pts.length-1))|0, a=r.pts[i], b=r.pts[i+1], s=Math.random();
    const dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz)||1, off=r.w/2+1.2, px=a[0]+dx*s-dz/L*off, pz=a[1]+dz*s+dx/L*off, d=Math.hypot(px-x,pz-z);
    if(d<dmin||d>dmax) continue;
    const num=10+Math.abs(Math.round(px*3.1+pz*7.3))%1900;
    return { x:px, z:pz, nome:`${r.nome}, ${num}` };
  }
  return negs[0]||null;
}
function avisar(t,seg=3){ const a=$('aviso'); a.textContent=t; a.style.opacity=1; clearTimeout(avisar.t); avisar.t=setTimeout(()=>a.style.opacity=0,seg*1000); }
function marcar(p){ coluna.position.x=anel.position.x=p.x; coluna.position.z=anel.position.z=p.z; coluna.visible=anel.visible=true; }
function encerrar(){ corrida.etapa=null; coluna.visible=anel.visible=false; $('missao').style.display='none'; }

// veiculo: o veículo dirigido (frota de veiculos.js)
export function alternarCorrida(veiculo){
  if(corrida.etapa){ encerrar(); avisar('Entrega cancelada'); return; }
  if(!veiculo) return avisar('Entre num veículo para fazer entregas');
  if(veiculo.quebrado) return avisar('Veículo quebrado: pegue outro');
  const p=veiculo.obj.position, de=sortearLoja(p.x,p.z,150,500)||sortearLoja(p.x,p.z,60,900);
  if(!de) return avisar('Nenhum destino por perto');
  Object.assign(corrida,{etapa:'buscar', de, para:null, veiculo, dano0:veiculo.dano, prazo:0, dist:0});
  marcar(de); $('missao').style.display='block';
  avisar('Nova entrega: busque em '+de.nome);
}

export function atualizarCorrida(dt, veiculo){
  if(!corrida.etapa) return null;
  const c=corrida, alvo=c.etapa==='buscar'?c.de:c.para;
  coluna.material.opacity=0.22+0.08*Math.sin(performance.now()/250);
  if(c.veiculo.quebrado){ encerrar(); avisar('Veículo quebrou: entrega perdida'); return null; }
  const p=c.veiculo.obj.position, d=Math.hypot(alvo.x-p.x,alvo.z-p.z);
  if(c.etapa==='levar'){ c.prazo-=dt; if(c.prazo<=0){ encerrar(); avisar('Tempo esgotado: entrega perdida'); return null; } }
  // chegou e parou (a pé também vale, perto do próprio veículo)
  if(d<7&&veiculo===c.veiculo&&Math.abs(c.veiculo.v)<2){
    if(c.etapa==='buscar'){
      const para=sortearLoja(alvo.x,alvo.z,300,900,alvo)||sortearLoja(alvo.x,alvo.z,150,1400,alvo);
      if(!para){ encerrar(); avisar('Sem destino por perto'); return null; }
      c.para=para; c.etapa='levar'; c.dist=Math.hypot(para.x-alvo.x,para.z-alvo.z); c.prazo=c.dist/7+35; c.prazoTotal=c.prazo;
      marcar(para); somEntrega(false); avisar('Carga coletada! Leve até '+para.nome);
    } else {
      const k=PAGA_VEICULO[c.veiculo.tipo.id]||1, bonus=1+0.6*(c.prazo/c.prazoTotal), batida=Math.max(0.3,1-(c.veiculo.dano-c.dano0)/120);
      const valor=Math.round((250+c.dist*1.4)*k*bonus*batida/10)*10;
      ganhar(valor); somEntrega(true); encerrar(); avisar(`Entrega feita! +${fmt(valor)}`+(batida<1?' (desconto pela batida)':''),4);
      return valor;
    }
  }
  // painel: o que fazer, distância, tempo e seta apontando o alvo
  const tempo=c.etapa==='levar'?` · ⏱ ${Math.ceil(c.prazo)} s`:'';
  $('missaoTxt').textContent=(c.etapa==='buscar'?'📦 Buscar em ':'🚚 Entregar em ')+alvo.nome;
  $('missaoDist').textContent=`${Math.round(d)} m${tempo}`;
  const cx=camera.position.x, cz=camera.position.z, fx=p.x-cx, fz=p.z-cz;                     // frente da câmera no chão
  const ang=Math.atan2(alvo.x-p.x,alvo.z-p.z)-Math.atan2(fx,fz);
  $('missaoSeta').style.transform=`rotate(${-ang}rad)`;
  return null;
}
export const alvoCorrida=()=>!corrida.etapa?null:(corrida.etapa==='buscar'?[corrida.de.x,corrida.de.z]:[corrida.para.x,corrida.para.z]);
