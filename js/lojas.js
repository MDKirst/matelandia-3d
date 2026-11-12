// Lojas e serviços nos lugares reais, com NOME FICTÍCIO (dados/lugares.json: OSM + Overture places, gerado por
// tools/baixar_lugares.py). Cada lugar vai para o prédio mais perto, na parede virada para a
// rua: letreiro com o nome, toldo com a cor do ramo e porta. Sem prédio por perto, vira um
// totem na calçada. Os nomes são desenhados em poucas texturas grandes (atlas).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene } from './cena.js';
import { toXZ } from './geo.js';
import { ruas, predios } from './cidade.js';
import { substituidoPorMarco } from './marcos.js';

const DADOS = 'dados/lugares.json';
// ramo → [cor do letreiro, cor do toldo]; o ramo sai da categoria e, sem ela, do nome
const RAMOS = [
  ['mercado0',/food_and_beverage_store/i, '#15803d', 0x16a34a],
  ['comida',  /restaurant|eatery|food|cafe|coffee|bakery|bar\b|pub|pizza|burger|snack|ice_cream|deli|lanch|pizz|padaria|sorvet|hamburg|churrasc|pastel|espetinho|bar |chopp|doceria|confeit/i, '#b91c1c', 0xdc2626],
  ['mercado', /supermarket|grocery|butcher|greengrocer|convenience|market|mercad|açougue|acougue|hortifruti|sacol|atacad|distribuidora/i, '#15803d', 0x16a34a],
  ['saude',   /pharmacy|drug|hospital|clinic|dentist|dental|doctor|health|physio|physical_medicine|diagnos|wellness|animal|pet_|veterin|optic|farm[aá]c|cl[ií]nica|odonto|fisio|vet|laborat|ótica|otica/i, '#0f766e', 0x14b8a6],
  ['banco',   /bank|atm|credit|financ|insurance|lottery|banco|sicredi|sicoob|cresol|caixa|lot[eé]rica|seguro/i, '#1d4ed8', 0x2563eb],
  ['carro',   /car_|auto|fuel|gas_station|tire|motorcycle|mechanic|vehicle|posto|mec[aâ]nica|pneu|motos|auto ?pe[cç]as|borrachar|lava|funilar/i, '#c2410c', 0xea580c],
  ['moda',    /cloth|fashion|shoe|boutique|jewel|beauty|hair|salon|barber|cosmetic|moda|cal[cç]ados|boutique|sal[aã]o|cabelei|barbear|est[eé]tica|perfum/i, '#a21caf', 0xc026d3],
  ['casa',    /furniture|hardware|home|building|material|paint|electronics|mobile_phone|computer|m[oó]veis|material|constru|tintas|vidra|el[eé]tric|celular|inform/i, '#854d0e', 0xca8a04],
  ['fe',      /church|worship|religio|igreja|iead|assembl|par[oó]quia|templo/i, '#475569', null],
];
const PADRAO = ['servico', null, '#334155', 0x64748b];
const ramoDe = l=>RAMOS.find(r=>r[1].test(l.cat||''))||RAMOS.find(r=>r[1].test(l.n))||PADRAO;
// lugar que não é loja de rua (loteamento, bairro, rodovia, órgão sem fachada…)
// Nome FICTÍCIO no letreiro (pedido do Maicon): o lugar, o ramo e a cor vêm dos dados reais,
// mas o nome é inventado, sorteado de forma fixa pela posição (sai igual toda vez).
const TIPO_NOME = {
  comida:  ['Lanchonete','Restaurante','Pizzaria','Padaria','Sorveteria','Bar','Pastelaria','Churrascaria','Cafeteria','Doceria'],
  mercado: ['Mercado','Supermercado','Mercearia','Açougue','Hortifruti','Atacado'],
  saude:   ['Farmácia','Clínica','Odonto','Ótica','Laboratório','Fisioterapia','Pet Shop'],
  banco:   ['Cooperativa','Banco','Lotérica','Seguros','Crédito'],
  carro:   ['Auto Peças','Mecânica','Borracharia','Auto Posto','Lava-Car','Moto Peças','Funilaria'],
  moda:    ['Boutique','Modas','Calçados','Salão','Barbearia','Estética'],
  casa:    ['Materiais','Móveis','Vidraçaria','Elétrica','Tintas','Celulares','Informática'],
  fe:      ['Igreja','Comunidade','Capela'],
  servico: ['Escritório','Contabilidade','Imobiliária','Gráfica','Autoescola','Studio','Agência','Despachante'],
};
const COMPLEMENTO = ['Bom Sabor','Sol Nascente','Pé Vermelho','Bela Vista','Três Marias','Vale Verde','Recanto','Primavera','Horizonte','Estrela',
  'Boa Esperança','Novo Tempo','Dois Irmãos','Ipê Amarelo','Araucária','Colonial','Do Bairro','Central','Imperial','Oeste','Fronteira','Progresso',
  'Família','Bem-Estar','Arco-Íris','Campo Verde','Serra Azul','Rio Claro','Do Povo','União'];
const COMPLEMENTO_FE = ['Boa Nova','Fonte de Vida','Esperança','Paz e Luz','Monte Sião','Nova Aliança'];
function nomeFicticio(ramo,x,z){
  const h=k=>{ const s=Math.sin(x*12.9898+z*78.233+k*37.719)*43758.5453; return s-Math.floor(s); };
  const id=ramo==='mercado0'?'mercado':ramo, tipos=TIPO_NOME[id]||TIPO_NOME.servico, comp=id==='fe'?COMPLEMENTO_FE:COMPLEMENTO;
  return tipos[(h(1)*tipos.length)|0]+' '+comp[(h(2)*comp.length)|0];
}
const NAO_LOJA = /loteamento|lotemento|residencial|jardim |condom[ií]nio|bairro|rodovia|br-?277|^pr-|estrada|promo[cç]/i;

/* ───────── atlas de nomes ───────── */
const CEL_W=512, CEL_H=128, ATLAS=2048, POR_ATLAS=(ATLAS/CEL_W)*(ATLAS/CEL_H);
const atlas=[];  // {cv,k,n,quads:[]}
function celula(nome, fundo){
  let a=atlas[atlas.length-1];
  if(!a||a.n>=POR_ATLAS){ const cv=document.createElement('canvas'); cv.width=cv.height=ATLAS; a={cv,k:cv.getContext('2d'),n:0,pos:[],uv:[]}; atlas.push(a); }
  const i=a.n++, cx=(i%(ATLAS/CEL_W))*CEL_W, cy=Math.floor(i/(ATLAS/CEL_W))*CEL_H, k=a.k;
  k.fillStyle=fundo; k.fillRect(cx,cy,CEL_W,CEL_H);
  k.strokeStyle='rgba(255,255,255,.85)'; k.lineWidth=6; k.strokeRect(cx+5,cy+5,CEL_W-10,CEL_H-10);
  const txt=nome.trim().replace(/\s+/g,' ').toUpperCase().slice(0,34);
  let fs=64; k.font=`800 ${fs}px system-ui,"Segoe UI",sans-serif`;
  while(k.measureText(txt).width>CEL_W-40&&fs>22){ fs-=2; k.font=`800 ${fs}px system-ui,"Segoe UI",sans-serif`; }
  k.fillStyle='#fff'; k.textAlign='center'; k.textBaseline='middle'; k.fillText(txt,cx+CEL_W/2,cy+CEL_H/2+2);
  return { a, u0:cx/ATLAS, u1:(cx+CEL_W)/ATLAS, v0:1-(cy+CEL_H)/ATLAS, v1:1-cy/ATLAS };
}
// quadro (letreiro) no plano vertical: centro c, direção ao longo da parede t, normal n
function quadro(cel,c,t,w,h){
  const {a,u0,u1,v0,v1}=cel, P=[], U=[];
  const pt=(s,u)=>[c[0]+t[0]*s, c[1]+u, c[2]+t[1]*s];
  const A=pt(-w/2,-h/2), B=pt(w/2,-h/2), C=pt(w/2,h/2), D=pt(-w/2,h/2);
  P.push(...A,...B,...C, ...A,...C,...D); U.push(u0,v0,u1,v0,u1,v1, u0,v0,u1,v1,u0,v1);
  a.pos.push(...P); a.uv.push(...U);
}

/* ───────── toldos, portas, totens (cor por vértice) ───────── */
const peças=[];
function pinta(g,c){ const k=new THREE.Color(c), n=g.attributes.position.count, a=new Float32Array(n*3); for(let i=0;i<n;i++){ a[i*3]=k.r; a[i*3+1]=k.g; a[i*3+2]=k.b; } g.setAttribute('color',new THREE.BufferAttribute(a,3)); if(g.index) g=g.toNonIndexed(); g.deleteAttribute('uv'); peças.push(g); }
function quad(p,c){ const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(p,3)); g.computeVertexNormals(); pinta(g,c); }

function dentro(x,z,pts){ let c=false; for(let i=0,j=pts.length-1;i<pts.length;j=i++){ const a=pts[i],b=pts[j]; if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]) c=!c; } return c; }
function distRua(x,z){
  let md=1e9;
  for(const r of ruas){ if(r.pe) continue; const b=r.bb; if(x<b[0]-60||x>b[2]+60||z<b[1]-60||z>b[3]+60) continue;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], c=r.pts[i+1], vx=c[0]-a[0], vz=c[1]-a[1];
      let t=((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t));
      md=Math.min(md, Math.hypot(x-a[0]-vx*t, z-a[1]-vz*t)-r.w/2); } }
  return md;
}

// pontos na calçada em frente a cada loja (para as entregas): {x,z,nome,ramo}
export const pontosLoja=[];

export async function carregarLojas(){
  let dados;
  try{ const r=await fetch(DADOS); if(!r.ok) throw new Error('HTTP '+r.status); dados=await r.json(); }
  catch(e){ console.warn('Sem '+DADOS+': cidade sem letreiros',e); return 0; }
  const casas=predios.filter(p=>!p.marco);
  const usado=new Map();                 // parede → quantos letreiros já tem
  let n=0, totens=0;
  for(const l of dados.lugares){
    if(l.f==='overture'&&(l.conf??0)<0.5) continue;
    if(NAO_LOJA.test(l.n)) continue;
    const [x,z]=toXZ(l.lat,l.lon);
    if(substituidoPorMarco(x,z,'loja',0)) continue;
    const ramo=ramoDe(l);
    // prédio mais perto (contém o ponto ou a menos de 25 m)
    let melhor=null, md=25;
    for(const p of casas){ const b=p.bb; if(x<b[0]-md||x>b[2]+md||z<b[1]-md||z>b[3]+md) continue;
      if(dentro(x,z,p.pts)){ melhor=p; md=0; break; }
      for(let i=0;i<p.pts.length;i++){ const a=p.pts[i], c=p.pts[(i+1)%p.pts.length], vx=c[0]-a[0], vz=c[1]-a[1];
        let t=((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t)); const d=Math.hypot(x-a[0]-vx*t,z-a[1]-vz*t); if(d<md){ md=d; melhor=p; } } }
    const nomeF=nomeFicticio(ramo[0],x,z), cel=celula(nomeF, ramo[2]);   // nome inventado, nunca o real
    if(!melhor){ // totem na calçada
      const h=3.2; pinta(new THREE.BoxGeometry(0.18,h,0.18).translate(x,h/2,z),0x4b5563);
      quadro(cel,[x,h,z+0.06],[1,0],2.6,0.65); quadro(cel,[x,h,z-0.06],[-1,0],2.6,0.65);   // lê dos dois lados
      totens++; n++; continue; }
    // parede virada para a rua (e perto do ponto)
    let parede=null, nota=1e9;
    const pts=melhor.pts;
    for(let i=0;i<pts.length;i++){ const a=pts[i], c=pts[(i+1)%pts.length], L=Math.hypot(c[0]-a[0],c[1]-a[1]); if(L<2.5) continue;
      const t=[(c[0]-a[0])/L,(c[1]-a[1])/L], m=[(a[0]+c[0])/2,(a[1]+c[1])/2]; let nn=[t[1],-t[0]];
      if(dentro(m[0]+nn[0]*0.4,m[1]+nn[1]*0.4,pts)) nn=[-nn[0],-nn[1]];
      const s=distRua(m[0]+nn[0]*3,m[1]+nn[1]*3)+0.25*Math.hypot(m[0]-x,m[1]-z)-Math.min(L,8)*0.3;
      if(s<nota){ nota=s; parede={a,c,L,t,m,nn,k:melhor.bb.join()+'|'+i}; } }
    if(!parede) continue;
    const vez=usado.get(parede.k)||0; usado.set(parede.k,vez+1); if(vez>=3) continue;   // no máximo 3 por parede
    const H=Math.max(3.2,(melhor.h||3.6)); const w=vez===0?Math.min(parede.L*0.8,5.5):Math.min(parede.L*0.4,4), alto=w/4;
    const desloc=vez===0?0:(vez%2?1:-1)*Math.min(parede.L/4,w*0.6);
    const {t,nn,m}=parede, cx=m[0]+t[0]*desloc+nn[0]*0.07, cz=m[1]+t[1]*desloc+nn[1]*0.07;
    const ys=Math.min(H-0.35-alto/2, 2.9+alto/2);
    // o letreiro olha para fora: a direção ao longo da parede depende do lado
    const tt=[ nn[1], -nn[0] ];   // direita de quem olha a fachada de fora
    quadro(cel,[cx,ys,cz],tt,w,alto);
    if(ramo[0]!=='fe') pontosLoja.push({x:cx+nn[0]*2.2, z:cz+nn[1]*2.2, nome:nomeF, ramo:ramo[0]});
    if(ramo[3]!==null){ // toldo inclinado + porta
      const y0=ys-alto/2-0.08, y1=y0-0.55, sai=1.1, hw=w/2;
      const P=(s,o,y)=>[cx+tt[0]*s+nn[0]*o, y, cz+tt[1]*s+nn[1]*o];
      const A=P(-hw,0,y0), B=P(hw,0,y0), C=P(hw,sai,y1), D=P(-hw,sai,y1);
      quad([...A,...C,...B, ...A,...D,...C],ramo[3]);
      const pa=P(-0.65,0.03,0), pb=P(0.65,0.03,0), pc=P(0.65,0.03,2.2), pd=P(-0.65,0.03,2.2);
      quad([...pa,...pc,...pb, ...pa,...pd,...pc],0x2f3640);
      const va=P(0.9,0.03,0.6), vb=P(Math.min(hw,0.9+1.6),0.03,0.6), vc=P(Math.min(hw,0.9+1.6),0.03,2.1), vd=P(0.9,0.03,2.1);   // vitrine
      if(hw>1.4) quad([...va,...vc,...vb, ...va,...vd,...vc],0x9cc3d5);
    }
    n++;
  }
  for(const a of atlas){
    const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.Float32BufferAttribute(a.pos,3)); g.setAttribute('uv',new THREE.Float32BufferAttribute(a.uv,2));
    const tex=new THREE.CanvasTexture(a.cv); tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=8;
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide})); m.frustumCulled=false; scene.add(m);
  }
  if(peças.length){ const g=mergeGeometries(peças,false); scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide}))); }
  return { lojas:n, totens };
}
