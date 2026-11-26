// Postos de gasolina e balada (pedido do Maicon em 17/11): lotes especiais com o prédio JÁ PRONTO.
// Ficam sempre na cidade (todos veem); quem compra o terreno (B, como qualquer terreno) vira o dono e
// recolhe a renda com V. A balada pisca no minimapa até alguém comprar. Os lugares e preços estão em
// especiais-dados.js; a compra usa o mesmo caminho dos terrenos (lotes/{id} no Firebase).
import * as THREE from 'three';
import { $ } from './cena.js';
import { lotes, ganchos, meu, salvo, salvar, ganhar, fmt, avisarTerreno as avisar } from './terrenos.js';
import { luzExtra, porLuz, TEX_QUENTE, horaJogo } from './ceu.js';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { jogador } from './avatar.js';
import { carregarModelo } from './pedestres.js';
import { membros, mirar } from './moto.js';
import { LEVE } from './config.js';
import { iniciarPostoVida, atualizarPostoVida } from './posto-vida.js';
import { musicaBalada } from './som.js';

const MAX_HORAS=8;
const lamb=c=>new THREE.MeshLambertMaterial({color:c});
function cx3(g,m,x0,x1,y0,y1,z0,z1){ const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m); b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); g.add(b); return b; }
function texto(linhas,{fundo='#111',cor='#fff',w=1024,h=160,borda=null}={}){
  const cv=document.createElement('canvas'); cv.width=w; cv.height=h; const k=cv.getContext('2d');
  k.fillStyle=fundo; k.fillRect(0,0,w,h); if(borda){ k.strokeStyle=borda; k.lineWidth=10; k.strokeRect(8,8,w-16,h-16); }
  k.fillStyle=cor; k.textAlign='center'; k.textBaseline='middle';
  linhas.forEach(([t,peso,tam],i)=>{ let f=tam; k.font=`${peso} ${f}px system-ui,sans-serif`; while(k.measureText(t).width>w-60&&f>18){ f-=2; k.font=`${peso} ${f}px system-ui,sans-serif`; }
    k.fillText(t,w/2,h*(i+0.5)/linhas.length+4); });
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
const hex=c=>'#'+new THREE.Color(c).getHexString();

/* ───────── posto (24 × 20 m): cobertura com duas ilhas de bombas, loja de conveniência e totem de preços ───────── */
function montarPosto(l){
  const e=l.especial, g=new THREE.Group(), marca=lamb(e.cor), branco=lamb(0xf8fafc), cinza=lamb(0x6b7280), escuro=lamb(0x1f2937), vidro=new THREE.MeshLambertMaterial({color:0x9cc8e0,transparent:true,opacity:0.4});
  const piso=new THREE.Mesh(new THREE.PlaneGeometry(24,20).rotateX(-Math.PI/2),lamb(0xa8a8a2)); piso.position.set(12,0.03,10); g.add(piso);
  // cobertura: pilares, teto branco e faixa da marca com o nome
  for(const [x,z] of [[5,5],[13,5],[5,11],[13,11]]) cx3(g,cinza,x-0.25,x+0.25,0,5,z-0.25,z+0.25);
  cx3(g,branco,2.5,15.5,5.25,5.6,2.5,13.5); cx3(g,marca,2.4,15.6,5,5.25,2.4,13.6);
  const letreiro=texto([[e.nome.toUpperCase(),900,92]],{fundo:hex(e.cor)});
  const fx=new THREE.Mesh(new THREE.PlaneGeometry(13,0.9),new THREE.MeshBasicMaterial({map:letreiro})); fx.position.set(9,5.3,2.33); fx.rotation.y=Math.PI; g.add(fx);
  // ilhas com bombas
  for(const z of [6.2,9.8]){ cx3(g,lamb(0xd1d5db),5.5,12.5,0,0.18,z-0.6,z+0.6);
    for(const x of [7,11]){ cx3(g,branco,x-0.45,x+0.45,0.18,1.9,z-0.25,z+0.25); cx3(g,marca,x-0.47,x+0.47,1.6,1.95,z-0.27,z+0.27); cx3(g,escuro,x-0.25,x+0.25,1.1,1.45,z-0.27,z+0.27);
      cx3(g,escuro,x+0.47,x+0.52,0.6,1.3,z-0.05,z+0.05); } }   // mangueira
  // loja de conveniência no fundo, com vitrine virada para as bombas
  const L0=15.5, L1=23.5, Z0=7, Z1=19, H=3.8;
  cx3(g,branco,L0,L1,0,H,Z1-0.2,Z1); cx3(g,branco,L1-0.2,L1,0,H,Z0,Z1); cx3(g,branco,L0,L0+0.2,0,H,Z0,Z1);
  cx3(g,branco,L0,21,0,0.5,Z0,Z0+0.2); cx3(g,vidro,L0,21,0.5,2.9,Z0+0.05,Z0+0.15); cx3(g,branco,L0,L1,2.9,H,Z0,Z0+0.2);
  cx3(g,marca,L0-0.2,L1+0.2,H,H+0.5,Z0-0.4,Z1+0.2); cx3(g,branco,L0,L1,H-0.1,H,Z0,Z1);
  const loja=new THREE.Mesh(new THREE.PlaneGeometry(7.4,0.8),new THREE.MeshBasicMaterial({map:texto([['CONVENIÊNCIA 24H',900,80]],{fundo:hex(e.cor)})})); loja.position.set((L0+L1)/2,3.35,Z0-0.06); loja.rotation.y=Math.PI; g.add(loja);
  cx3(g,lamb(0x8b5a2b),16.5,20.5,0,1.1,12,12.8);                                          // balcão
  for(let i=0;i<3;i++) cx3(g,lamb([0xdc2626,0x2563eb,0xfacc15][i]),16,23,0.4+i*0.55,0.75+i*0.55,18.3,18.8);   // prateleira do fundo
  // totem de preços na frente
  cx3(g,cinza,1.3,1.7,0,4.6,1.3,1.7);
  const precos=texto([[e.nome,900,64],['GASOLINA  5,89',800,54],['ETANOL  3,99',800,54],['DIESEL  5,99',800,54]],{fundo:hex(e.cor),w:512,h:640,borda:'#fff'});
  for(const r of [0,Math.PI]){ const p=new THREE.Mesh(new THREE.PlaneGeometry(1.8,2.25),new THREE.MeshBasicMaterial({map:precos})); p.position.set(1.5,5.6,1.5+(r?0.12:-0.12)); p.rotation.y=r?0:Math.PI; g.add(p); }
  cx3(g,marca,0.55,2.45,4.4,6.8,1.38,1.62);
  // à noite: luz debaixo da cobertura, letreiro e loja acesos
  const lg=new THREE.Group();
  const teto=luzExtra(new THREE.PlaneGeometry(13,11).rotateX(-Math.PI/2),{map:TEX_QUENTE,forca:0.9,cor:0xf0f6ff}); teto.position.set(9,0.06,8); lg.add(teto);
  const lt=luzExtra(new THREE.PlaneGeometry(13,0.9),{map:letreiro,forca:0.9}); lt.position.set(9,5.3,2.31); lt.rotation.y=Math.PI; lg.add(lt);
  const lj=luzExtra(new THREE.PlaneGeometry(L1-L0,Z1-Z0).rotateX(-Math.PI/2),{map:TEX_QUENTE,forca:0.6}); lj.position.set((L0+L1)/2,0.07,(Z0+Z1)/2); lg.add(lj);
  const vt=luzExtra(new THREE.PlaneGeometry(21-L0,2.3),{cor:0xffe2b0,forca:0.35}); vt.position.set((L0+21)/2,1.7,Z0-0.01); vt.rotation.y=Math.PI; lg.add(vt);
  // colisão: pilares, ilhas e loja (o resto é pátio aberto, dá para entrar de carro)
  // colisão: paredes da loja (porta aberta entre u 21 e 23,3), balcão, pilares, ilhas e totem; o pátio é livre
  l.ocupaEsp=(u,v)=>{ const naLoja=u>L0-0.1&&u<L1+0.1&&v>Z0-0.1&&v<Z1+0.1;
    if(naLoja&&(v>Z1-0.45||u>L1-0.45||u<L0+0.45||(v<Z0+0.45&&u<21)||(u>16.5&&u<20.5&&v>12&&v<12.8)||v>18.2)) return true;
    return [[5,5],[13,5],[5,11],[13,11]].some(([x,z])=>Math.abs(u-x)<0.35&&Math.abs(v-z)<0.35)
      ||((Math.abs(v-6.2)<0.6||Math.abs(v-9.8)<0.6)&&u>5.5&&u<12.5)||(Math.abs(u-1.5)<0.3&&Math.abs(v-1.5)<0.3); };
  return { g, lg, neon:[] };
}

/* ───────── balada (30 × 24 m): caixa escura com fachada de neon, entrada com tapete e corda, pista com luzes ───────── */
function montarBalada(l){
  const e=l.especial, g=new THREE.Group(), preto=lamb(0x111014), grafite=lamb(0x25232b), roxo=lamb(e.cor);
  const X0=2, X1=28, Z0=4, Z1=23, H=8;
  const piso=new THREE.Mesh(new THREE.PlaneGeometry(30,4).rotateX(-Math.PI/2),lamb(0x3f3f46)); piso.position.set(15,0.03,2); g.add(piso);
  cx3(g,preto,X0,X1,0,H,Z1-0.3,Z1); cx3(g,preto,X0,X0+0.3,0,H,Z0,Z1); cx3(g,preto,X1-0.3,X1,0,H,Z0,Z1); cx3(g,grafite,X0,X1,H-0.2,H,Z0,Z1);
  cx3(g,preto,X0,13.5,0,H,Z0,Z0+0.3); cx3(g,preto,16.5,X1,0,H,Z0,Z0+0.3); cx3(g,preto,13.5,16.5,3.2,H,Z0,Z0+0.3);
  const pista=new THREE.Mesh(new THREE.PlaneGeometry(X1-X0-1,Z1-Z0-1).rotateX(-Math.PI/2),lamb(0x18181b)); pista.position.set(15,0.04,(Z0+Z1)/2); g.add(pista);
  // ── dentro (17/11): pista de luz, palco com DJ e dançarinas, bar comprido de drinks SEM álcool, sofás, globo e feixes ──
  // (pedido do Maicon; sem pole dance e sem bebida alcoólica porque os alunos da escola jogam)
  const PX0=7, PX1=23, PZ0=7.5, PZ1=17.5;                                          // pista
  const ladrilhos=new THREE.InstancedMesh(new THREE.BoxGeometry(1.9,0.06,1.9),new THREE.MeshBasicMaterial({color:0xffffff}),40);
  { const M=new THREE.Matrix4(); let k=0; for(let i=0;i<8;i++) for(let j=0;j<5;j++){ M.makeTranslation(PX0+1+i*2,0.07,PZ0+1+j*2); ladrilhos.setMatrixAt(k,M); ladrilhos.setColorAt(k,new THREE.Color(0x222222)); k++; } }
  g.add(ladrilhos); ladrilhos.layers.enable(1);                                    // a pista acesa não escurece à noite
  cx3(g,grafite,9,21,0,1.0,19,22.7); cx3(g,lamb(0xd946ef),9,21,1.0,1.06,19,19.1);   // palco + borda de neon
  cx3(g,lamb(0x111827),13,17,1.0,2.15,19.5,20.3); cx3(g,lamb(0x22d3ee),13,17,2.15,2.2,19.5,20.3);   // cabine do DJ
  for(const x of [13.6,16.4]){ cx3(g,lamb(0x374151),x-0.35,x+0.35,2.2,2.24,19.6,20.2); }            // pratos
  for(const x of [9.6,20.4]){ cx3(g,lamb(0x111827),x-1.1,x+1.1,1.0,2.6,21.6,22.6); cx3(g,lamb(0x4b5563),x-0.5,x+0.5,1.6,2.2,21.55,21.62); }   // caixas de som
  for(const x of [10.6,19.4]) cx3(g,lamb(0xfacc15),x-0.6,x+0.6,1.0,1.35,20.2,21.4);                 // tablados das dançarinas
  // bar: balcão comprido na parede da esquerda, prateleira de garrafas coloridas (sucos, refri, drinks sem álcool)
  cx3(g,lamb(0x3b0764),3.6,4.6,0,1.1,6.5,18.5); cx3(g,lamb(0xe9d5ff),3.5,4.7,1.1,1.16,6.4,18.6);
  cx3(g,lamb(0x1f2937),X0+0.3,X0+0.8,0.9,3.2,6.5,18.5);
  { const cores=[0xf97316,0x22c55e,0xef4444,0xfacc15,0x38bdf8,0xa855f7,0xf472b6]; let n=0;
    for(const y of [1.35,2.05,2.75]) for(let z=6.9;z<18.2;z+=0.42){ const c=cores[(n++*3)%cores.length], m=new THREE.MeshLambertMaterial({color:c,transparent:true,opacity:0.85});
      const b=new THREE.Mesh(new THREE.CylinderGeometry(0.08,0.09,0.42,8),m); b.position.set(X0+0.6,y+0.21,z); g.add(b); } }
  for(let z=7.2;z<18;z+=1.6){ cx3(g,lamb(0x9ca3af),4.95,5.05,0,0.75,z-0.05,z+0.05); const s=new THREE.Mesh(new THREE.CylinderGeometry(0.28,0.28,0.08,12),lamb(0xd946ef)); s.position.set(5,0.78,z); g.add(s); }
  for(let z=7.4;z<18;z+=2.2){ const c=new THREE.Mesh(new THREE.CylinderGeometry(0.09,0.07,0.18,10),lamb([0xf97316,0x22c55e,0xf472b6][Math.round(z)%3])); c.position.set(4.1,1.25,z); g.add(c); }   // copos no balcão
  const letBar=texto([['DRINKS SEM ÁLCOOL · SUCOS · REFRI',900,70]],{fundo:'#3b0764',cor:'#f5d0fe'});
  const pb=new THREE.Mesh(new THREE.PlaneGeometry(9,0.9),new THREE.MeshBasicMaterial({map:letBar})); pb.position.set(X0+0.32,4.0,12.5); pb.rotation.y=Math.PI/2; g.add(pb);
  // sofás na parede da direita
  for(const z of [7,11.5,16]){ cx3(g,lamb(0x7c3aed),25.4,27.6,0,0.5,z-1.6,z+1.6); cx3(g,lamb(0x6d28d9),27.0,27.7,0.5,1.2,z-1.6,z+1.6); cx3(g,lamb(0x111827),24.2,25.0,0,0.45,z-0.5,z+0.5); }
  // globo espelhado e feixes de luz
  const globo=new THREE.Mesh(new THREE.IcosahedronGeometry(0.55,1),new THREE.MeshLambertMaterial({color:0xe5e7eb,flatShading:true,emissive:0x333333})); globo.position.set(15,H-1.3,12.5); g.add(globo); globo.layers.enable(1);
  cx3(g,lamb(0x9ca3af),14.98,15.02,H-0.75,H-0.2,12.48,12.52);
  const feixes=[]; [[5,5.5],[25,5.5],[5,19.5],[25,19.5]].forEach(([x,z],i)=>{ const m=new THREE.MeshBasicMaterial({color:[0xd946ef,0x22d3ee,0xfacc15,0x22c55e][i],transparent:true,opacity:0.22,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const f=new THREE.Mesh(new THREE.ConeGeometry(1.4,H-1,16,1,true).translate(0,-(H-1)/2,0),m); const p=new THREE.Group(); p.position.set(x,H-0.4,z); p.add(f); g.add(p); feixes.push(p); });
  const teto=g.children.find(o=>o.isMesh&&Math.abs(o.position.y-(H-0.1))<0.01&&o.geometry.parameters?.width>20);   // laje (some quando o jogador entra)
  // entrada: tapete, postes e corda vermelha
  const tapete=new THREE.Mesh(new THREE.PlaneGeometry(3,4).rotateX(-Math.PI/2),lamb(0xb91c1c)); tapete.position.set(15,0.05,2); g.add(tapete);
  for(const x of [12.8,17.2]) for(const z of [0.6,2.2,3.6]) cx3(g,lamb(0xd4af37),x-0.06,x+0.06,0,1,z-0.06,z+0.06);
  for(const x of [12.8,17.2]) cx3(g,lamb(0x991b1b),x-0.03,x+0.03,0.8,0.9,0.6,3.6);
  // letreiro e faixas de neon (piscam à noite; de dia ficam coloridas, apagadas)
  const nomeTex=texto([[e.nome.toUpperCase(),900,110]],{fundo:'#0b0b10',cor:'#f5d0fe'});
  const placa=new THREE.Mesh(new THREE.PlaneGeometry(16,2.2),new THREE.MeshBasicMaterial({map:nomeTex})); placa.position.set(15,5.6,Z0-0.05); placa.rotation.y=Math.PI; g.add(placa);
  const CORES=[0xd946ef,0x22d3ee,0xfacc15,0xf43f5e];
  const faixas=[]; for(let i=0;i<4;i++){ const m=new THREE.MeshBasicMaterial({color:CORES[i]}); const y=1.2+i*0.35;
    for(const [a,b] of [[X0+0.5,13],[17,X1-0.5]]){ const f=new THREE.Mesh(new THREE.BoxGeometry(b-a,0.12,0.08),m); f.position.set((a+b)/2,y+3.5,Z0-0.05); g.add(f); } faixas.push(m); }
  const lg=new THREE.Group(), neon=[];
  const ln=luzExtra(new THREE.PlaneGeometry(16,2.2),{map:nomeTex,forca:1}); ln.position.set(15,5.6,Z0-0.07); ln.rotation.y=Math.PI; lg.add(ln); neon.push(ln);
  for(let i=0;i<4;i++){ const c=luzExtra(new THREE.PlaneGeometry(24,4).rotateX(-Math.PI/2),{map:TEX_QUENTE,cor:CORES[i],forca:0.5}); c.position.set(15,0.06+i*0.002,1.5); lg.add(c); neon.push(c); }
  const dentro=luzExtra(new THREE.PlaneGeometry(X1-X0,Z1-Z0).rotateX(-Math.PI/2),{map:TEX_QUENTE,cor:0xc026d3,forca:0.7}); dentro.position.set(15,0.07,(Z0+Z1)/2); lg.add(dentro); neon.push(dentro);
  l.ocupaEsp=(u,v)=>{ if(u<X0||u>X1||v<Z0||v>Z1) return false; const borda=u<X0+0.4||u>X1-0.4||v>Z1-0.4||(v<Z0+0.4&&!(u>13.5&&u<16.5));
    return borda||(u>8.8&&u<21.2&&v>18.8)||(u>X0&&u<4.8&&v>6.3&&v<18.7)||(u>24.1&&v>5.2&&v<17.8); };
  const dentroDe=(x,z)=>{ const dx=x-l.A[0], dz=z-l.A[1], u=dx*l.t[0]+dz*l.t[1], v=dx*l.n[0]+dz*l.n[1]; return u>X0&&u<X1&&v>Z0&&v<Z1; };
  return { g, lg, neon, faixas, balada:{ ladrilhos, globo, feixes, teto, dentroDe, pista:[PX0,PX1,PZ0,PZ1] } };
}

/* ───────── caixa (renda) e painel do dono ───────── */
const reg=l=>{ salvo.especiais ??= {}; return salvo.especiais[l.id] ??= { coleta:Date.now() }; };
export function caixaEspecial(l){ if(!meu(l)) return 0; const h=Math.min(MAX_HORAS,(Date.now()-reg(l).coleta)/3.6e6); return Math.floor(h*l.especial.hora/10)*10; }
const ic=l=>l.especial.tipo==='posto'?'⛽':'🪩';
ganchos.especial=l=>{
  const e=l.especial;
  if(meu(l)) return `${ic(l)} ${e.nome} (seu) · V caixa ${fmt(caixaEspecial(l))}`;
  if(l.dono) return `${ic(l)} ${e.nome} · de ${l.donoNome||'outro jogador'}`;
  return `${ic(l)} ${e.nome} À VENDA · B comprar (${fmt(l.preco)}) · rende ${fmt(e.hora)}/h · saldo ${fmt(salvo.saldo)}`;
};
ganchos.acaoEspecial=l=>{
  const e=l.especial;
  if(!meu(l)){ avisar(l.dono?`${ic(l)} ${e.nome} é de ${l.donoNome||'outro jogador'}`:`${ic(l)} ${e.nome} está à venda: B para comprar (${fmt(l.preco)})`); return; }
  const cx=caixaEspecial(l);
  $('negTit').textContent=`${ic(l)} ${e.nome}`; $('negLista').replaceChildren();
  $('negInfo').textContent=`Caixa: ${fmt(cx)} (rende ${fmt(e.hora)}/h, junta até ${MAX_HORAS} h, mesmo com você fora do jogo).`;
  const a=$('negAcoes'); a.replaceChildren();
  const rec=document.createElement('button'); rec.textContent=`💰 Recolher ${fmt(cx)}`; rec.disabled=cx<=0;
  rec.onclick=()=>{ const v=caixaEspecial(l); ganhar(v); reg(l).coleta=Date.now(); salvar(); $('negocio').classList.remove('on'); avisar(`Caixa recolhido: +${fmt(v)}`); };
  a.append(rec); $('negocio').classList.add('on');
};

/* ───────── montagem e animação ───────── */
const prontos=[];
export function iniciarEspeciais(){
  for(const l of lotes){ if(!l.especial) continue;
    const m=l.especial.tipo==='posto'?montarPosto(l):montarBalada(l);
    l.grupo.add(m.g); m.lg.position.copy(l.grupo.position); m.lg.rotation.copy(l.grupo.rotation); porLuz(m.lg);
    prontos.push({ l, ...m });
    if(meu(l)) reg(l); }   // dono: começa a contar a renda
  iniciarPostoVida(lotes);                                               // frentistas, carros/motos na bomba e conveniência (posto-vida.js)
  return prontos.length;
}
/* ───────── gente na balada: carrega só quando o jogador chega perto ─────────
   3 pilotos Mixamo com as danças prontas (Danca1–3) + bonecos Quaternius com dança feita aqui (braços
   apontados no ritmo pelo mesmo mirar() da moto, corpo pulando e girando). DJ e atendente usam 'mexer'. */
const MIXAMO=['piloto-estradeiro','piloto-gladius','piloto-ludwick'];
const QUATERNIUS=['female-casual','female-jeans','male-casual','female-tank-top','male-shirt','female-casual-2-24','male-casual-hoodie-24','female-alternative','male-beach-24'];
const sorte=()=>Math.random();
async function encherBalada(p){
  const B=p.balada, [PX0,PX1,PZ0,PZ1]=B.pista, gente=[], nPista=LEVE?5:12;
  const nomes=[...MIXAMO.slice(0,LEVE?1:3), ...QUATERNIUS].slice(0,nPista);
  const extras=[['male-punk-24','dj'],['female-formal-24','bar'],['female-dress','palco'],['female-jeans','palco']];
  const moldes=await Promise.all([...nomes,...extras.map(e=>e[0])].map(carregarModelo));
  const por=(m,alt)=>{ const obj=clonarEsqueleto(m.cena), e=alt/m.altura; obj.scale.multiplyScalar(e); obj.position.y=-m.base*e; obj.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
    const corpo=new THREE.Group(); corpo.add(obj); p.l.grupo.add(corpo); const mixer=new THREE.AnimationMixer(obj), acoes={}; for(const [n,c] of Object.entries(m.anims)) acoes[n]=mixer.clipAction(c);
    return { corpo, obj, mixer, acoes, alt }; };
  const tocar=(d,nome)=>{ const a=d.acoes[nome]||d.acoes.parado||d.acoes.Idle; if(a){ a.reset().play(); a.time=sorte()*3; } };
  nomes.forEach((n,i)=>{ const m=moldes[i]; if(!m) return; const d=por(m,1.62+sorte()*0.2);
    d.x=PX0+1.2+sorte()*(PX1-PX0-2.4); d.z=PZ0+1.2+sorte()*(PZ1-PZ0-2.4); d.y=0.1; d.rumo=sorte()*0.8-0.4; d.ph=sorte()*6.28; d.tipo=MIXAMO.includes(n)?'mixamo':'quat';
    if(d.tipo==='mixamo') tocar(d,['Danca1','Danca2','Danca3'][i%3]); else { tocar(d,'parado'); d.r=membros(d.obj); d.estilo=i%3; }
    gente.push(d); });
  extras.forEach(([n,papel],k)=>{ const m=moldes[nomes.length+k]; if(!m) return; const d=por(m,papel==='palco'?1.68:1.72);
    if(papel==='dj'){ d.x=15; d.z=21.1; d.y=1.0; d.rumo=Math.PI; tocar(d,'mexer'); }
    if(papel==='bar'){ d.x=3.0; d.z=12.5; d.y=0; d.rumo=Math.PI/2; tocar(d,'mexer'); }
    if(papel==='palco'){ d.x=k===2?10.6:19.4; d.z=20.8; d.y=1.35; d.rumo=Math.PI; tocar(d,'parado'); d.tipo='quat'; d.r=membros(d.obj); d.estilo=3; d.ph=k; }
    d.papel=papel; gente.push(d); });
  for(const d of gente){ d.corpo.position.set(d.x,d.y,d.z); d.corpo.rotation.y=d.rumo; d.corpo.traverse(o=>o.layers.enable(1)); }   // camada 1: à noite são redesenhados claros (ceu.realcar), como o jogador
  // ninguém atravessa quem está dançando
  const antes=p.l.ocupaEsp; p.l.ocupaEsp=(u,v)=>antes(u,v)||gente.some(d=>d.papel!=='bar'&&d.papel!=='dj'&&d.papel!=='palco'&&Math.abs(u-d.x)<0.35&&Math.abs(v-d.z)<0.35);
  p.gente=gente;
}
const V=new THREE.Vector3(), V2=new THREE.Vector3();
function dancar(d,t,dt){
  d.mixer.update(dt);
  if(d.tipo!=='quat') return;
  const w=124/60*Math.PI*2, k=d.alt/1.75, forte=d.estilo===3?1.4:1, pulo=Math.abs(Math.sin(w*t/2+d.ph));
  d.corpo.position.y=d.y+0.07*forte*pulo;
  d.corpo.rotation.y=d.rumo+Math.sin(w*t/4+d.ph)*0.45*forte;
  d.corpo.rotation.z=Math.sin(w*t/2+d.ph)*0.06*forte;
  d.corpo.updateMatrixWorld(true);
  for(const s of [-1,1]){ const m=d.r?.[s]; if(!m?.braco) continue;
    let cima;
    if(d.estilo===0) cima=Math.sin(w*t/2+d.ph+(s>0?Math.PI:0))>0;           // braços revezando para o alto
    else if(d.estilo===1) cima=Math.sin(w*t/4+d.ph)>0.2;                      // os dois para cima juntos
    else cima=Math.sin(w*t+d.ph)>0.5;                                         // soquinho no ritmo
    const x=-s*(cima?0.32:0.28)*k;
    const alvo1=d.corpo.localToWorld(V.set(x,(cima?2.05:1.2)*k,(cima?0.12:0.32)*k));
    const alvo2=d.corpo.localToWorld(V2.set(x*(cima?1.2:0.7),(cima?2.5:1.5)*k,(cima?0.05:0.55)*k));
    mirar(m.braco,m.ante,alvo1); mirar(m.ante,m.mao,alvo2); }
}
let t=0, dentroBalada=false;
ganchos.musicaEspecial=()=>null;   // a balada tem música própria (som.js musicaBalada), ouvida já da porta
export function atualizarEspeciais(dt){
  t+=dt; const h=horaJogo(), noite=h>=18.5||h<6, jx=jogador.position.x, jz=jogador.position.z;
  dentroBalada=false; let dBal=null;
  atualizarPostoVida(dt,jx,jz);
  for(const p of prontos){
    if(p.balada){ const B=p.balada, d=Math.hypot(p.l.cx-jx,p.l.cz-jz), perto=d<85;
      if(perto&&!p.gente&&!p.enchendo){ p.enchendo=true; encherBalada(p).catch(e=>console.warn('balada',e)); }
      const dentro=B.dentroDe(jx,jz); dentroBalada=dentro; if(dBal==null||d<dBal) dBal=d; if(B.teto) B.teto.visible=!dentro;
      if(perto){ // pista de luz, globo e feixes
        if(Math.floor(t*4)!==B.passo){ B.passo=Math.floor(t*4); const c=new THREE.Color();
          for(let i=0;i<40;i++){ const on=((i*7+B.passo)%5)<2; B.ladrilhos.setColorAt(i,on?c.setHSL(((i*0.13+B.passo*0.07)%1),0.95,0.55):c.setHex(0x1a1a1a)); }
          B.ladrilhos.instanceColor.needsUpdate=true; }
        B.globo.rotation.y+=dt*0.8;
        B.feixes.forEach((f,i)=>{ f.rotation.x=Math.sin(t*0.9+i)*0.55; f.rotation.z=Math.cos(t*0.7+i*1.7)*0.55; });
        for(const g of p.gente||[]){ g.corpo.visible=true; dancar(g,t,dt); } }
      else for(const g of p.gente||[]) g.corpo.visible=false; }
    if(!p.neon.length) continue;
    // neon da balada: o nome pulsa e as cores do chão se revezam (mais forte de noite)
    p.neon[0].material.userData.forca=0.75+0.25*Math.sin(t*6);
    for(let i=1;i<=4;i++) p.neon[i].material.userData.forca=(Math.floor(t*2.5)%4===i-1?0.8:0.15)*(noite?1:0.4);
    p.faixas?.forEach((m,i)=>m.color.setHSL(((t*0.15+i*0.25)%1),0.9,Math.floor(t*4+i)%2?0.6:0.35));
  }
  musicaBalada(dBal==null?null:Math.max(0,dBal-12), dentroBalada);   // dBal: do meio do lote; a porta fica ~12 m antes
}
// para o mapa grande (ícone e nome) e o minimapa (balada à venda pisca)
export const pontosEspeciais=()=>prontos.map(({l})=>{ const c=[l.A[0]+l.t[0]*l.w/2+l.n[0]*l.d/2, l.A[1]+l.t[1]*l.w/2+l.n[1]*l.d/2];
  return { x:c[0], z:c[1], ic:ic(l), nome:l.especial.nome+(l.dono||meu(l)?'':' (à venda)'), tipo:meu(l)?'meuNegocio':'negocio' }; });
