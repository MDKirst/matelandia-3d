// Postos de gasolina e balada (pedido do Maicon em 17/11): lotes especiais com o prédio JÁ PRONTO.
// Ficam sempre na cidade (todos veem); quem compra o terreno (B, como qualquer terreno) vira o dono e
// recolhe a renda com V. A balada pisca no minimapa até alguém comprar. Os lugares e preços estão em
// especiais-dados.js; a compra usa o mesmo caminho dos terrenos (lotes/{id} no Firebase).
import * as THREE from 'three';
import { $ } from './cena.js';
import { lotes, ganchos, meu, salvo, salvar, ganhar, fmt, avisarTerreno as avisar } from './terrenos.js';
import { luzExtra, porLuz, TEX_QUENTE, horaJogo } from './ceu.js';

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
  cx3(g,grafite,9,21,0,1.2,19.5,22);                                               // palco do DJ
  cx3(g,lamb(0x7c2d12),X0+1,X0+3,0,1.1,8,18);                                      // balcão de sucos e refri (sem álcool: alunos jogam)
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
    return borda||(u>9&&u<21&&v>19.5)||(u>X0+1&&u<X0+3&&v>8&&v<18); };
  return { g, lg, neon, faixas };
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
  return prontos.length;
}
let t=0;
export function atualizarEspeciais(dt){
  t+=dt; const h=horaJogo(), noite=h>=18.5||h<6;
  for(const p of prontos){ if(!p.neon.length) continue;
    // neon da balada: o nome pulsa e as cores do chão se revezam (mais forte de noite)
    p.neon[0].material.userData.forca=0.75+0.25*Math.sin(t*6);
    for(let i=1;i<=4;i++) p.neon[i].material.userData.forca=(Math.floor(t*2.5)%4===i-1?0.8:0.15)*(noite?1:0.4);
    p.faixas?.forEach((m,i)=>m.color.setHSL(((t*0.15+i*0.25)%1),0.9,Math.floor(t*4+i)%2?0.6:0.35));
  }
}
// para o mapa grande (ícone e nome) e o minimapa (balada à venda pisca)
export const pontosEspeciais=()=>prontos.map(({l})=>{ const c=[l.A[0]+l.t[0]*l.w/2+l.n[0]*l.d/2, l.A[1]+l.t[1]*l.w/2+l.n[1]*l.d/2];
  return { x:c[0], z:c[1], ic:ic(l), nome:l.especial.nome+(l.dono||meu(l)?'':' (à venda)'), tipo:meu(l)?'meuNegocio':'negocio' }; });
