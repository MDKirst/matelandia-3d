// Numeração das casas como a dos Correios / prefeituras (numeração métrica, ABNT):
// o número é a distância em metros desde o começo da rua; andando no sentido em que o número cresce,
// PARES ficam à direita e ÍMPARES à esquerda. O começo é a ponta da rua mais perto do centro (Praça Municipal).
// Ruas com o mesmo nome em vários trechos (avenida de pista dupla, rua cortada) são medidas juntas.
// Âncoras reais corrigem o começo e o sentido onde se sabe o número de verdade.
import { ruas } from './cidade.js';

const CENTRO=[-55,-40];                                   // Praça Municipal
const ANCORAS=[                                           // número real conhecido num ponto da rua
  { nome:'Avenida Duque de Caxias', x:271.8, z:10.75, num:800 },   // Prefeitura (Paço 25 de Julho)
  { nome:'Rua Munhoz da Rocha',     x:-1180, z:499,   num:208 },   // portão do Cemitério Municipal
];
const k=p=>Math.round(p[0])+'_'+Math.round(p[1]);
let porNome=null;                                         // nome → { vias:[{r,acc,a,b}], D:Map, sgn, base }

function montar(){
  porNome=new Map();
  for(const r of ruas){
    if(!r.nome||r.pe||r.pts.length<2) continue;
    let g=porNome.get(r.nome); if(!g) porNome.set(r.nome,g={vias:[],D:new Map(),sgn:1,base:0});
    const acc=[0]; for(let i=1;i<r.pts.length;i++) acc.push(acc[i-1]+Math.hypot(r.pts[i][0]-r.pts[i-1][0],r.pts[i][1]-r.pts[i-1][1]));
    g.vias.push({r,acc,pa:r.pts[0],pb:r.pts[r.pts.length-1]});
  }
  for(const [nome,g] of porNome){
    // pontas a menos de 20 m viram o mesmo nó (as duas pistas de uma avenida terminam lado a lado)
    const nos=[]; const no=p=>{ for(const n of nos) if(Math.hypot(n[0]-p[0],n[1]-p[1])<20) return n[2]; const c=k(p); nos.push([p[0],p[1],c]); return c; };
    for(const v of g.vias){ v.a=no(v.pa); v.b=no(v.pb); }
    // pontas: nós de ponta que só aparecem uma vez
    const vez=new Map(), pos=new Map();
    for(const v of g.vias){ for(const [c,p] of [[v.a,v.pa],[v.b,v.pb]]){ vez.set(c,(vez.get(c)||0)+1); pos.set(c,p); } }
    let pontas=[...vez].filter(([,n])=>n===1).map(([c])=>c); if(!pontas.length) pontas=[...pos.keys()];
    const dC=c=>{ const p=pos.get(c); return Math.hypot(p[0]-CENTRO[0],p[1]-CENTRO[1]); };
    // Dijkstra pelos trechos (poucos nós: varredura simples); trechos soltos começam pela distância em linha reta
    const D=g.D, falta=new Set(pos.keys());
    let origem=pontas.sort((a,b)=>dC(a)-dC(b))[0], p0=pos.get(origem);
    D.set(origem,0);
    while(falta.size){
      let c=null, m=Infinity; for(const x of falta){ const d=D.get(x); if(d!==undefined&&d<m){ m=d; c=x; } }
      if(c===null){                                        // outro pedaço da mesma rua, sem ligação
        let melhor=null, dm=Infinity; for(const x of falta){ const p=pos.get(x), d=Math.hypot(p[0]-p0[0],p[1]-p0[1]); if(d<dm){ dm=d; melhor=x; } }
        D.set(melhor,dm); continue;
      }
      falta.delete(c);
      for(const v of g.vias){ const L=v.acc[v.acc.length-1];
        if(v.a===c&&(D.get(v.b)??Infinity)>m+L) D.set(v.b,m+L);
        if(v.b===c&&(D.get(v.a)??Infinity)>m+L) D.set(v.a,m+L); }
    }
    // âncora: escolhe o sentido que não deixa número negativo e encosta no número real
    const an=ANCORAS.find(a=>a.nome===nome);
    if(an){ const d0=medir(g,an.x,an.z,999)?.d; if(d0!==undefined){
      const ds=[...D.values()], piorMais=Math.min(...ds.map(d=>an.num+(d-d0))), piorMenos=Math.min(...ds.map(d=>an.num-(d-d0)));
      g.sgn=piorMenos>piorMais?-1:1; g.base=an.num-g.sgn*d0; } }
  }
}

// ponto mais perto da rua g: distância desde o começo, sentido crescente e lado do ponto
function medir(g,x,z,raio){
  let best=null;
  for(const v of g.vias){ const P=v.r.pts, Lt=v.acc[v.acc.length-1];
    if(x<v.r.bb[0]-raio||x>v.r.bb[2]+raio||z<v.r.bb[1]-raio||z>v.r.bb[3]+raio) continue;
    for(let i=0;i<P.length-1;i++){ const a=P[i], b=P[i+1], dx=b[0]-a[0], dz=b[1]-a[1], L2=dx*dx+dz*dz||1;
      const s=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/L2)), px=a[0]+dx*s, pz=a[1]+dz*s, e=Math.hypot(x-px,z-pz);
      if(e>raio||(best&&e>=best.e)) continue;
      const al=v.acc[i]+s*Math.sqrt(L2), d1=(g.D.get(v.a)??0)+al, d2=(g.D.get(v.b)??0)+(Lt-al), frente=d1<=d2;
      const L=Math.sqrt(L2), ux=(frente?dx:-dx)/L, uz=(frente?dz:-dz)/L;            // sentido em que a distância cresce
      const direita=(x-px)*(-uz)+(z-pz)*ux>0;                                        // direita de (ux,uz) = (-uz,ux)  (x leste, z sul)
      best={ e, d:Math.min(d1,d2), direita, px, pz, ux, uz };
    }
  }
  return best;
}

// endereço do ponto (x,z): { rua, num, par, lado:{x,z} } da rua com nome mais perto (até `raio` m), ou null
export function endereco(x,z,raio=45){
  if(!porNome) montar();
  let melhor=null, gm=null;
  for(const [nome,g] of porNome){ if(g.vias[0].r.tipo==='motorway') continue;
    const m=medir(g,x,z,raio); if(m&&(!melhor||m.e<melhor.e)){ melhor=m; melhor.rua=nome; gm=g; } }
  if(!melhor) return null;
  const dist=gm.base+gm.sgn*melhor.d, direita=gm.sgn>0?melhor.direita:!melhor.direita;   // sentido invertido: lados trocam
  let num=Math.max(1,Math.round(dist));
  if((num%2===0)!==direita) num+=1;                                                       // par à direita, ímpar à esquerda
  return { rua:melhor.rua, num, par:direita };
}
export const textoEndereco=e=>e?`${e.rua}, ${e.num}`:'';
