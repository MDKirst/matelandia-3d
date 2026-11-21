// Negócio próprio: no seu terreno vazio, V abre o cardápio de negócios; escolhido, o comércio aparece
// PRONTO no lote (prédio com vitrine, toldo, letreiro, balcão, prateleiras com produtos e atendente).
// Todos os jogadores veem (o tipo fica no Firebase, negocios/{lote}); o nome é "<Tipo> de <dono>",
// sem texto livre. Clientes (bots) entram, compram no balcão e saem, mais nos horários de movimento
// do tipo (rotina.js). Cada compra feita na frente do dono rende na hora; fora do jogo o caixa
// acumula pela renda/hora (até 8 h) e o dono recolhe com V.
import * as THREE from 'three';
import { clone as clonarEsqueleto } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { $ } from './cena.js';
import { lotes, ganchos, meu, salvo, salvar, loteEm, limparBlocos, LARG_LOTE as W, ganhar, fmt, avisarTerreno as avisar } from './terrenos.js';
import { nuvem, conectarNuvem, ouvirNegocios, abrirNegocioNuvem, fecharNegocioNuvem, renomearNegocioNuvem } from './nuvem.js';
import { limparFala } from './online.js';
import { carregarModelo, PESSOAS } from './pedestres.js';
import { horaJogo, luzExtra, porLuz, TEX_QUENTE } from './ceu.js';
import { perfil } from './rotina.js';
import { sortearPersona } from './personas.js';
import { estacionarMoto } from './veiculos.js';
import { musicaLoja } from './som.js';
import { acalmarCaes } from './caes.js';
import { vida } from './luta.js';
import { telaTex, texCache } from './canvastex.js';

// curvas de movimento por hora (as mesmas ideias do rotina.js)
const C_PADARIA=[[0,0],[5.5,0.05],[6.3,1],[9,0.5],[11,0.3],[15,0.5],[16.5,0.9],[18.5,0.6],[20,0.1],[24,0]];
const C_COMIDA=[[0,0.1],[10.8,0.15],[11.6,1],[13.6,0.3],[18.5,0.4],[19.8,1],[22.5,0.5],[24,0.1]];
const C_LOJA=[[0,0],[7.8,0.05],[8.5,0.8],[11.8,0.9],[12.2,0.5],[13.5,0.8],[18,0.7],[18.6,0.05],[24,0]];
const C_BAR=[[0,0.8],[2,0.3],[3,0.05],[11,0.1],[12,0.4],[14,0.15],[17,0.4],[18.5,0.8],[20,1],[24,0.8]];
const C_FARMA=[[0,0.15],[7,0.4],[8,0.8],[19,0.7],[22,0.3],[24,0.15]];
const C_SORVETE=[[0,0],[9.5,0.05],[10.5,0.4],[13,0.8],[16,1],[19,0.7],[21.5,0.2],[22,0],[24,0]];
export const TIPOS = {
  padaria:   { nome:'Padaria',    ic:'🥖', preco:6000,  hora:900,  venda:[8,25],   cor:0xF97316, piso:'#e9dcc4', prod:[0xc8893f,0xe0b070,0xa86b2e,0xf2d6a2,0x8a4f22], curva:C_PADARIA, fala:'Me vê 10 pães, por favor!' },
  lanchonete:{ nome:'Lanchonete', ic:'🍔', preco:7000,  hora:1100, venda:[15,40],  cor:0xdc2626, piso:'#f3e4cf', prod:[0xfacc15,0xdc2626,0x16a34a,0xf97316], curva:C_COMIDA, fala:'Um X-salada e um suco!', mesas:true },
  mercado:   { nome:'Mercado',    ic:'🛒', preco:9000,  hora:1400, venda:[20,90],  cor:0x16a34a, piso:'#e6e6e1', prod:[0xdc2626,0x2563eb,0xfacc15,0x16a34a,0xf97316,0xffffff,0x7c3aed], curva:C_LOJA, fala:'Só vim buscar arroz e feijão.' },
  roupas:    { nome:'Loja de Roupas', ic:'👕', preco:8000, hora:1200, venda:[40,150], cor:0x7c3aed, piso:'#efe9f5', prod:[0x1e3a8a,0xdb2777,0x0f766e,0xfbbf24,0x111827,0xf5f5f4], curva:C_LOJA, fala:'Tem essa camiseta no M?', araras:true },
  farmacia:  { nome:'Farmácia',   ic:'💊', preco:8500,  hora:1300, venda:[15,70],  cor:0x0d9488, piso:'#eef6f5', prod:[0xffffff,0x0ea5e9,0xf43f5e,0x22c55e,0xfde68a], curva:C_FARMA, fala:'Tem remédio pra dor de cabeça?' },
  bar:       { nome:'Bar',        ic:'🍻', preco:15000, hora:2200, venda:[20,80],  cor:0xb45309, piso:'#d6c2a0', prod:[0xf59e0b,0x7c2d12,0x16a34a,0xdc2626,0xfde68a], curva:C_BAR, fala:'Uma porção e um refri!', mesas:true, bar:true, fundo:22 },   // grande: ocupa quase o lote todo
  oficina:   { nome:'Oficina',    ic:'🔧', preco:10000, hora:1600, venda:[60,220], cor:0x334155, piso:'#9ca3af', prod:[0x111827,0x374151,0xb91c1c,0x1d4ed8], curva:C_LOJA, fala:'Meu carro tá fazendo um barulho…', oficina:true },
  // 21/11 (pedido do Maicon): mais opções depois de comprar o terreno
  sorveteria:{ nome:'Sorveteria', ic:'🍦', preco:6500, hora:1000, venda:[8,30],   cor:0xec4899, piso:'#fdf2f8', prod:[0xfbcfe8,0xfde68a,0x86efac,0x93c5fd,0x7c2d12,0xffffff], curva:C_SORVETE, fala:'Duas bolas de chocolate!', mesas:true },
  petshop:   { nome:'Pet Shop',    ic:'🐶', preco:7500, hora:1150, venda:[20,120], cor:0x0284c7, piso:'#eef6fb', prod:[0xf59e0b,0x16a34a,0xdc2626,0x7c3aed,0x0ea5e9], curva:C_LOJA, fala:'Tem ração pro meu cachorro?' },
  barbearia: { nome:'Barbearia',   ic:'💈', preco:7000, hora:1100, venda:[30,70],  cor:0x1e3a8a, piso:'#e5e7eb', prod:[0x111827,0xdc2626,0x2563eb,0xf5f5f4], curva:C_LOJA, fala:'Só um degradê, por favor.', mesas:true },
  acougue:   { nome:'Açougue',     ic:'🥩', preco:9500, hora:1450, venda:[30,160], cor:0xb91c1c, piso:'#f1f5f9', prod:[0xb91c1c,0xef4444,0xfca5a5,0xfef3c7,0x7f1d1d], curva:C_LOJA, fala:'Me vê 2 kg de picanha pro churrasco!' },
  pizzaria:  { nome:'Pizzaria',    ic:'🍕', preco:9000, hora:1400, venda:[25,90],  cor:0x15803d, piso:'#f5efe6', prod:[0xdc2626,0xfacc15,0x16a34a,0xf5f5f4,0x7c2d12], curva:C_COMIDA, fala:'Uma pizza grande de calabresa!', mesas:true },
  floricultura:{ nome:'Floricultura', ic:'🌷', preco:6000, hora:900, venda:[20,90], cor:0xdb2777, piso:'#f0fdf4', prod:[0xf43f5e,0xfacc15,0xa855f7,0xffffff,0x22c55e,0xfb923c], curva:C_LOJA, fala:'Um buquê de rosas, por favor.' },
  eletronicos:{ nome:'Eletrônicos', ic:'📱', preco:12000, hora:1800, venda:[60,400], cor:0x1f2937, piso:'#f3f4f6', prod:[0x111827,0x6b7280,0x2563eb,0xe5e7eb,0x0ea5e9], curva:C_LOJA, fala:'Quanto tá esse celular?' },
  papelaria: { nome:'Papelaria',   ic:'📚', preco:5500, hora:850,  venda:[5,40],   cor:0xca8a04, piso:'#fefce8', prod:[0x2563eb,0xdc2626,0x16a34a,0xfacc15,0xffffff,0x7c3aed], curva:C_LOJA, fala:'Tem caderno de 10 matérias?' },
  // moradia (21/11): casa para morar (sem renda; V descansa e enche a energia) e casa de aluguel (rende o aluguel)
  casa:      { nome:'Casa',        ic:'🏡', preco:20000, hora:0,    venda:[0,0], cor:0xf97316, piso:'#e7e5e4', prod:[0xffffff], curva:C_LOJA, fala:'', casa:true, residencial:true },
  aluguel:   { nome:'Casa de aluguel', ic:'🏠', preco:14000, hora:1000, venda:[0,0], cor:0x2563eb, piso:'#e7e5e4', prod:[0xffffff], curva:C_LOJA, fala:'', casa:true, residencial:true, alugada:true },
  // kitnet: prédio de 2 andares com 6 apartamentos para alugar; sem balcão nem clientes, rende o aluguel
  kitnet:    { nome:'Kitnets',     ic:'🏘️', preco:30000, hora:2400, venda:[0,0], cor:0x0f766e, piso:'#e7e5e4', prod:[0xffffff], curva:C_LOJA, fala:'', kitnet:true, residencial:true, unidades:6 },
};
const MAX_HORAS=8;
// o que aparece nos cartazes e no quadro de preços (desenhado aqui, com emoji)
const MENU = {
  padaria:   [['🥖','Pão francês','0,80'],['🥐','Croissant','6'],['🍰','Bolo de pote','12'],['☕','Cafezinho','4'],['🧀','Pão de queijo','5']],
  lanchonete:[['🍔','X-Salada','18'],['🌭','Cachorro-quente','12'],['🍟','Batata frita','14'],['🥤','Refri lata','6'],['🍕','Pizza broto','22']],
  mercado:   [['🍎','Frutas','5/kg'],['🥛','Leite','5'],['🍚','Arroz 5 kg','28'],['🫘','Feijão 1 kg','9'],['🍫','Chocolate','7']],
  roupas:    [['👕','Camiseta','39'],['👖','Calça jeans','119'],['👟','Tênis','199'],['🧢','Boné','49'],['👗','Vestido','89']],
  farmacia:  [['💊','Analgésico','9'],['🧴','Protetor solar','45'],['🩹','Curativos','7'],['🪥','Escova de dente','8'],['🧼','Sabonete','3']],
  bar:       [['🍟','Porção de fritas','28'],['🥟','Pastel','8'],['🍢','Espetinho','10'],['🥤','Refri lata','6'],['🧃','Suco natural','9']],
  oficina:   [['🛞','Pneu aro 14','320'],['🛢️','Troca de óleo','150'],['🔧','Revisão','250'],['🔋','Bateria','480'],['🧽','Lavagem','40']],
  sorveteria:[['🍦','Casquinha','6'],['🍨','Taça 3 bolas','18'],['🥤','Milk-shake','16'],['🍧','Açaí 500 ml','22'],['🍫','Picolé','5']],
  petshop:   [['🦴','Petisco','10'],['🥫','Ração 15 kg','139'],['🛁','Banho e tosa','60'],['🧸','Brinquedo','25'],['🦮','Coleira','35']],
  barbearia: [['💈','Corte','35'],['🧔','Barba','25'],['✂️','Corte + barba','50'],['🧴','Pomada','30'],['👦','Corte infantil','25']],
  acougue:   [['🥩','Picanha','79/kg'],['🍖','Costela','35/kg'],['🌭','Linguiça','25/kg'],['🍗','Frango','14/kg'],['🔥','Carvão 5 kg','22']],
  pizzaria:  [['🍕','Calabresa','49'],['🍕','Marguerita','45'],['🧀','Quatro queijos','55'],['🍫','Pizza doce','42'],['🥤','Refri 2 L','12']],
  floricultura:[['🌹','Buquê de rosas','60'],['🌻','Girassol','15'],['🪴','Vaso','35'],['🌵','Cacto','18'],['💐','Arranjo','90']],
  eletronicos:[['📱','Celular','1.299'],['🎧','Fone','89'],['🔌','Carregador','49'],['🔋','Power bank','119'],['💡','Lâmpada LED','15']],
  papelaria: [['📒','Caderno','25'],['✏️','Lápis','2'],['🖊️','Caneta','3'],['🎒','Mochila','89'],['📐','Régua','4']],
};
function texCartaz(it,cor){ return texCache('cartaz|'+it.join('|')+'|'+cor,()=>texCartaz0(it,cor)); }
function texCartaz0([ic,nome,preco],cor){
  const [cv,k]=telaTex(256,320);
  k.fillStyle='#fffaf0'; k.fillRect(0,0,256,320); k.fillStyle='#'+new THREE.Color(cor).getHexString(); k.fillRect(0,0,256,26); k.fillRect(0,294,256,26);
  k.textAlign='center'; k.textBaseline='middle'; k.font='120px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; k.fillText(ic,128,130);
  k.fillStyle='#1c1917'; let fs=34; k.font=`900 ${fs}px system-ui,sans-serif`; while(k.measureText(nome).width>236&&fs>18){ fs-=2; k.font=`900 ${fs}px system-ui,sans-serif`; } k.fillText(nome,128,222);
  k.fillStyle='#dc2626'; k.font='900 40px system-ui,sans-serif'; k.fillText('M$ '+preco,128,266);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
function texQuadro(itens,titulo){ return texCache('quadro|'+titulo+'|'+itens.slice(0,5).map(i=>i.join('/')).join('|'),()=>texQuadro0(itens,titulo)); }
function texQuadro0(itens,titulo){
  const [cv,k]=telaTex(1024,384);
  k.fillStyle='#1f2a24'; k.fillRect(0,0,1024,384); k.strokeStyle='#8b5a2b'; k.lineWidth=18; k.strokeRect(9,9,1006,366);
  k.fillStyle='#fef3c7'; k.textBaseline='middle'; k.textAlign='center'; k.font='900 54px system-ui,sans-serif'; k.fillText(titulo,512,58);
  itens.slice(0,5).forEach(([ic,nome,preco],i)=>{ const y=118+i*54;
    k.textAlign='left'; k.font='38px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; k.fillText(ic,60,y);
    k.fillStyle='#f5f5f4'; k.font='700 36px system-ui,sans-serif'; k.fillText(nome,120,y);
    k.textAlign='right'; k.fillStyle='#fde047'; k.fillText('M$ '+preco,964,y); k.fillStyle='#fef3c7'; });
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
// nome escolhido pelo dono (até 24 letras, sem palavrão: todos veem o letreiro) ou "<Tipo> de <dono>"
const limparNomeNeg=s=>limparFala(String(s||'').replace(/["'`&]/g,'')).slice(0,24).trim();
const nomeNeg=l=>l.negNome||`${TIPOS[l.negocio].nome} de ${l.donoNome||'Visitante'}`;   // "de": serve para qualquer nome

/* ───────── prédio pronto (coordenadas do lote: x = frente 0..12, z = fundo 0..24) ───────── */
const X0=1, X1=11, Z0=2, Z1=15, H=4.2, PORTA=[4.8,7.2];
const lamb=c=>new THREE.MeshLambertMaterial({color:c});
const MAT={ parede:lamb(0xf1ece2), base:lamb(0x6b6f73), vidro:new THREE.MeshLambertMaterial({color:0x9cc8e0,transparent:true,opacity:0.35}),
  laje:lamb(0xbdbab2), madeira:lamb(0x8b5a2b), balcao:lamb(0xe7e2d8), metal:lamb(0x9ca3af), escuro:lamb(0x1f2937) };
function cx3(g,m,x0,x1,y0,y1,z0,z1){ const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m); b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); g.add(b); return b; }
function texLetreiro(txt, ic, cor){ return texCache('letreiro|'+txt+'|'+ic+'|'+cor,()=>texLetreiro0(txt,ic,cor)); }
function texLetreiro0(txt, ic, cor){
  const [cv,k]=telaTex(1024,128);
  k.fillStyle='#'+new THREE.Color(cor).getHexString(); k.fillRect(0,0,1024,128);
  k.fillStyle='rgba(255,255,255,.18)'; k.fillRect(0,0,1024,10); k.fillRect(0,118,1024,10);
  k.fillStyle='#fff'; k.textAlign='center'; k.textBaseline='middle';
  let fs=64; k.font=`900 ${fs}px system-ui,sans-serif`; const t=ic+'  '+txt.toUpperCase();
  while(k.measureText(t).width>970&&fs>26){ fs-=2; k.font=`900 ${fs}px system-ui,sans-serif`; }
  k.fillText(t,512,68); const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=4; return tx;
}
function texPiso(c){ return texCache('piso|'+c,()=>texPiso0(c)); }
function texPiso0(c){ const cv=document.createElement('canvas'); cv.width=cv.height=64; const k=cv.getContext('2d'); k.fillStyle=c; k.fillRect(0,0,64,64);
  k.fillStyle='rgba(0,0,0,.09)'; k.fillRect(0,0,64,2); k.fillRect(0,0,2,64); const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,13); t.colorSpace=THREE.SRGBColorSpace; return t; }

/* ───────── kitnet (21/11): 2 andares, 3 apartamentos por andar, corredor com grade na frente do 2º andar,
   escada do lado direito, caixa d'água, varal e ar-condicionado. Não tem balcão: rende o aluguel. ───────── */
const KZ1=12, KH=3.0;
function montarKitnet(l,T){
  const g=new THREE.Group(), cor=lamb(T.cor), H2=KH*2+0.2, janelas=[];
  // paredes (oca por dentro), faixa colorida no térreo, lajes
  cx3(g,MAT.parede,X0,X0+0.2,0,H2,Z0,KZ1); cx3(g,MAT.parede,X1-0.2,X1,0,H2,Z0,KZ1); cx3(g,MAT.parede,X0,X1,0,H2,KZ1-0.2,KZ1); cx3(g,MAT.parede,X0,X1,0,H2,Z0,Z0+0.2);
  cx3(g,cor,X0-0.02,X1+0.02,0,0.5,Z0-0.03,KZ1+0.02);
  cx3(g,MAT.laje,X0-0.2,X1+0.2,KH,KH+0.2,Z0,KZ1+0.2); cx3(g,MAT.laje,X0-0.2,X1+0.2,H2,H2+0.25,Z0-0.2,KZ1+0.2);
  cx3(g,MAT.parede,X0-0.2,X1+0.2,H2+0.25,H2+1.1,Z0-0.2,Z0);                                     // platibanda (segura o letreiro)
  // fachada: em cada andar 3 apartamentos com porta + janela
  for(let a=0;a<2;a++){ const y=a*(KH+0.2);
    for(let k=0;k<3;k++){ const x0=X0+0.4+k*3.27;
      cx3(g,MAT.madeira,x0,x0+0.9,y,y+2.1,Z0-0.06,Z0); cx3(g,MAT.metal,x0+0.72,x0+0.8,y+0.95,y+1.05,Z0-0.1,Z0-0.06);   // porta e maçaneta
      cx3(g,MAT.escuro,x0+1.25,x0+2.75,y+0.9,y+2.15,Z0-0.05,Z0); cx3(g,MAT.vidro,x0+1.3,x0+2.7,y+0.95,y+2.1,Z0-0.08,Z0-0.05);   // janela
      janelas.push([x0+2,y+1.52]);
      const ac=cx3(g,lamb(0xf5f5f4),x0+1.6,x0+2.4,y+2.35,y+2.75,Z0-0.35,Z0); if(a===1) ac.position.y+=0.05;   // ar-condicionado
      const num=new THREE.Mesh(new THREE.PlaneGeometry(0.34,0.22),new THREE.MeshBasicMaterial({map:texLetreiro(String(a*3+k+1)+(a?'':''),'',T.cor)}));
      num.position.set(x0+0.45,y+2.32,Z0-0.08); num.rotation.y=Math.PI; g.add(num); } }
  // corredor do 2º andar com grade, pilares e escada do lado direito
  cx3(g,MAT.laje,X0,X1+0.9,KH,KH+0.2,Z0-1.3,Z0);
  for(const x of [X0+0.1,(X0+X1)/2,X1+0.75]) cx3(g,MAT.base,x-0.12,x+0.12,0,KH,Z0-1.25,Z0-1.01);
  cx3(g,MAT.metal,X0,X1+0.9,KH+1.0,KH+1.06,Z0-1.3,Z0-1.24);
  for(let x=X0;x<=X1+0.9;x+=0.3) cx3(g,MAT.metal,x,x+0.03,KH+0.2,KH+1.0,Z0-1.29,Z0-1.26);
  for(let i=0;i<12;i++){ const z1=Z0+5-i*0.42; cx3(g,MAT.laje,X1+0.05,X1+0.9,0,(i+1)*0.25,z1-0.42,z1); }
  cx3(g,MAT.metal,X1+0.86,X1+0.9,0.9,KH+1.0,Z0,Z0+5);                                         // corrimão
  // varal no corredor com roupas coloridas
  cx3(g,MAT.metal,X0+0.5,X0+4.5,KH+2.05,KH+2.07,Z0-1.0,Z0-0.98);
  [0xdc2626,0x2563eb,0xfacc15,0x16a34a,0xf5f5f4,0xdb2777].forEach((c,i)=>cx3(g,lamb(c),X0+0.7+i*0.62,X0+1.15+i*0.62,KH+1.55,KH+2.05,Z0-1.0,Z0-0.97));
  // caixa d'água no telhado
  const cxa=new THREE.Mesh(new THREE.CylinderGeometry(0.75,0.65,1.1,14),lamb(0x1d4ed8)); cxa.position.set(X1-1.5,H2+0.8,KZ1-2); g.add(cxa);
  // letreiro na platibanda e placa "ALUGA-SE" na frente
  const let1=new THREE.Mesh(new THREE.PlaneGeometry(X1-X0,0.8),new THREE.MeshBasicMaterial({map:texLetreiro(nomeNeg(l),T.ic,T.cor)}));
  let1.position.set((X0+X1)/2,H2+0.68,Z0-0.22); let1.rotation.y=Math.PI; g.add(let1);
  const placa=new THREE.Mesh(new THREE.PlaneGeometry(1.4,0.5),new THREE.MeshBasicMaterial({map:texLetreiro('Aluga-se','🔑',0xb91c1c)}));
  placa.position.set(X0+1.2,1.4,Z0-1.3); placa.rotation.y=Math.PI; g.add(placa); cx3(g,MAT.metal,X0+1.17,X0+1.23,0,1.15,Z0-1.31,Z0-1.27);
  // colisão: prédio, pilares e escada
  const oc=new Set(), cel=(u,v)=>oc.add(u+','+v);
  for(let u=X0;u<X1;u++) for(let v=Z0;v<KZ1;v++) cel(u,v);
  for(let v=Z0;v<Z0+5;v++) cel(X1,v);
  l.ocupaNeg=oc; l.balcao=Z0+2;
  Object.assign(g.userData,{ letreiro:let1.material.map, fundo:KZ1, lamps:[], porta:[X0,X1], janelas, letY:H2+0.68 });
  return g;
}

/* ───────── casa (21/11): térrea, telhado de duas águas, varanda, muro com portão, quintal com grama, árvore e
   canteiro. Casa para morar (placa com o nome) ou de aluguel (placa ALUGADA). Cor da parede pelo lote. ───────── */
const CORES_CASA=[0xfde68a,0xbfdbfe,0xfecaca,0xbbf7d0,0xf5f5f4,0xe9d5ff,0xfed7aa];
function montarCasa(l,T){
  const g=new THREE.Group(), hs=[...l.id].reduce((a,c)=>a*31+c.charCodeAt(0)|0,7), parede=lamb(CORES_CASA[Math.abs(hs)%CORES_CASA.length]);
  const telha=lamb(0xb45309), grama=lamb(0x4d7c3a), branco=lamb(0xf8fafc), HX0=2, HX1=10, HZ0=6, HZ1=15, HH=3, janelas=[];
  // quintal e caminho de pedra até a porta
  const q=new THREE.Mesh(new THREE.PlaneGeometry(11.4,23.4).rotateX(-Math.PI/2),grama); q.position.set(6,0.025,12); g.add(q);
  cx3(g,lamb(0xa8a29e),5.4,6.6,0,0.04,0.5,HZ0);
  // muro baixo na frente com portão de grade no meio
  for(const [a,b] of [[0.3,4.2],[7.8,11.7]]){ cx3(g,parede,a,b,0,1.1,0.3,0.5); cx3(g,branco,a,b,1.1,1.18,0.28,0.52); }
  for(let x=4.3;x<7.75;x+=0.18) cx3(g,MAT.escuro,x,x+0.04,0,1.3,0.38,0.42);
  cx3(g,MAT.escuro,4.2,7.8,1.26,1.32,0.36,0.44);
  // paredes (oca), porta, janelas
  cx3(g,parede,HX0,HX0+0.2,0,HH,HZ0,HZ1); cx3(g,parede,HX1-0.2,HX1,0,HH,HZ0,HZ1); cx3(g,parede,HX0,HX1,0,HH,HZ1-0.2,HZ1);
  for(const [a,b] of [[HX0,5.4],[6.6,HX1]]){ cx3(g,parede,a,b,0,0.9,HZ0,HZ0+0.2); cx3(g,parede,a,b,2.3,HH,HZ0,HZ0+0.2);
    const ja=a+0.6, jb=b-0.6; cx3(g,parede,a,ja,0.9,2.3,HZ0,HZ0+0.2); cx3(g,parede,jb,b,0.9,2.3,HZ0,HZ0+0.2);
    cx3(g,branco,ja,jb,0.9,2.3,HZ0-0.04,HZ0+0.02); cx3(g,MAT.vidro,ja+0.08,jb-0.08,0.98,2.22,HZ0-0.07,HZ0-0.03); janelas.push([(ja+jb)/2,1.6]); }
  cx3(g,parede,5.4,6.6,2.2,HH,HZ0,HZ0+0.2); cx3(g,MAT.madeira,5.45,6.55,0,2.2,HZ0-0.03,HZ0+0.05); cx3(g,MAT.metal,6.3,6.4,1.0,1.1,HZ0-0.08,HZ0-0.03);
  // telhado de duas águas (cumeeira ao longo da frente) e oitões
  const ab=0.55, larg=HX1-HX0+0.8, meia=(HZ1-HZ0)/2+0.5, alt=1.7, L=Math.hypot(meia,alt), ang=Math.atan2(alt,meia), zm=(HZ0+HZ1)/2;
  for(const sg of [-1,1]){ const p=new THREE.Mesh(new THREE.BoxGeometry(larg,0.14,L),telha); p.position.set((HX0+HX1)/2,HH+alt/2,zm+sg*meia/2); p.rotation.x=sg*ang; g.add(p); }
  const tri=new THREE.Shape([new THREE.Vector2(-(HZ1-HZ0)/2,0),new THREE.Vector2((HZ1-HZ0)/2,0),new THREE.Vector2(0,alt-0.1)]);
  for(const x of [HX0+0.1,HX1-0.1]){ const o=new THREE.Mesh(new THREE.ShapeGeometry(tri),parede); o.material=parede.clone(); o.material.side=THREE.DoubleSide; o.rotation.y=Math.PI/2; o.position.set(x,HH,zm); g.add(o); }
  // varanda na porta
  cx3(g,telha,4.4,7.6,2.55,2.67,4.6,HZ0); for(const x of [4.5,7.4]) cx3(g,branco,x,x+0.12,0,2.55,4.65,4.77);
  // árvore no quintal, canteiro de flores, caixa de correio
  cx3(g,MAT.madeira,9.6,9.9,0,2.2,19,19.3); const copa=new THREE.Mesh(new THREE.IcosahedronGeometry(1.5,0),new THREE.MeshLambertMaterial({color:0x3f6e2f,flatShading:true})); copa.position.set(9.75,3.2,19.15); g.add(copa);
  cx3(g,MAT.madeira,2.2,4.8,0,0.25,HZ0-1.0,HZ0-0.4);
  [0xf43f5e,0xfacc15,0xa855f7,0xffffff,0xfb923c,0xf43f5e].forEach((c,i)=>{ const f=new THREE.Mesh(new THREE.SphereGeometry(0.13,6,5),lamb(c)); f.position.set(2.45+i*0.42,0.36,HZ0-0.7); g.add(f); });
  cx3(g,MAT.escuro,8.4,8.47,0,1.0,0.6,0.67); cx3(g,lamb(T.cor),8.2,8.7,1.0,1.3,0.5,0.8);
  // placa no muro: nome da família ou ALUGADA
  const placa=new THREE.Mesh(new THREE.PlaneGeometry(3.2,0.5),new THREE.MeshBasicMaterial({map:T.alugada?texLetreiro('Alugada','🔑',0x2563eb):texLetreiro(nomeNeg(l),T.ic,T.cor)}));
  placa.position.set(2.25,0.75,0.27); placa.rotation.y=Math.PI; g.add(placa);
  // colisão: casa e muro (o portão fica aberto)
  const oc=new Set(), cel=(u,v)=>oc.add(u+','+v);
  for(let u=HX0;u<HX1;u++) for(let v=HZ0;v<HZ1;v++) cel(u,v);
  for(let u=0;u<12;u++) if(u<4||u>=8) cel(u,0);
  l.ocupaNeg=oc; l.balcao=HZ0+2;
  Object.assign(g.userData,{ letreiro:placa.material.map, fundo:HZ1, lamps:[], porta:[X0,X1], janelas:janelas.map(([x,y])=>[x,y]), janZ:HZ0, letLuz:[3.2,0.5,2.25,0.75,0.25] });
  return g;
}

function montarPredio(l){
  const T=TIPOS[l.negocio], g=new THREE.Group(), cor=lamb(T.cor);
  if(T.kitnet) return montarKitnet(l,T);
  if(T.casa) return montarCasa(l,T);
  const Z1=T.fundo||15;                                                        // fundo do prédio (o bar é mais comprido)
  // piso
  const piso=new THREE.Mesh(new THREE.PlaneGeometry(X1-X0,Z1-Z0,3,5).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({map:texPiso(T.piso)}));
  piso.position.set((X0+X1)/2,0.03,(Z0+Z1)/2); g.add(piso);
  // paredes: laterais e fundo inteiras; frente com vitrine dos dois lados da porta
  cx3(g,MAT.parede,X0,X0+0.2,0,H,Z0,Z1); cx3(g,MAT.parede,X1-0.2,X1,0,H,Z0,Z1); cx3(g,MAT.parede,X0,X1,0,H,Z1-0.2,Z1);
  const porta=T.oficina?[2,10]:PORTA;
  for(const [a,b] of [[X0,porta[0]],[porta[1],X1]]){ if(b-a<0.3) continue;
    cx3(g,MAT.base,a,b,0,0.6,Z0,Z0+0.2); cx3(g,MAT.vidro,a,b,0.6,2.9,Z0+0.05,Z0+0.15); cx3(g,MAT.parede,a,b,2.9,H,Z0,Z0+0.2);
    for(let x=a;x<=b+0.01;x+=(b-a)/Math.max(1,Math.round((b-a)/1.6))) cx3(g,MAT.escuro,x-0.04,x+0.04,0.6,2.9,Z0,Z0+0.2); }
  cx3(g,MAT.parede,porta[0],porta[1],T.oficina?3.4:2.6,H,Z0,Z0+0.2);                         // verga da porta
  if(T.oficina) for(let y=3.4;y<H;y+=0.12) cx3(g,MAT.metal,porta[0],porta[1],y,y+0.06,Z0-0.05,Z0);   // portão de enrolar aberto
  cx3(g,MAT.laje,X0-0.2,X1+0.2,H,H+0.3,Z0-0.2,Z1+0.2);                                        // laje
  // letreiro e toldo
  const let1=new THREE.Mesh(new THREE.PlaneGeometry(X1-X0,1.1),new THREE.MeshBasicMaterial({map:texLetreiro(nomeNeg(l),T.ic,T.cor)}));
  let1.position.set((X0+X1)/2,H-0.6,Z0-0.06); let1.rotation.y=Math.PI; g.add(let1);
  const toldo=new THREE.Mesh(new THREE.BoxGeometry(X1-X0-0.4,0.06,1.4),cor); toldo.position.set((X0+X1)/2,2.75,Z0-0.65); toldo.rotation.x=-0.32; g.add(toldo);
  const franja=new THREE.Mesh(new THREE.BoxGeometry(X1-X0-0.4,0.25,0.04),lamb(0xffffff)); franja.position.set((X0+X1)/2,2.42,Z0-1.3); g.add(franja);
  // balcão e caixa registradora
  const bz=T.oficina?12:T.bar?Z1-4:9;
  cx3(g,MAT.balcao,3,9,0,1.0,bz,bz+0.8); cx3(g,cor,3,9,1.0,1.06,bz-0.05,bz+0.85);
  cx3(g,MAT.metal,7.8,8.25,1.06,1.22,bz+0.3,bz+0.62); cx3(g,MAT.escuro,7.83,8.22,1.22,1.42,bz+0.52,bz+0.58);   // caixa registradora e tela
  const itens=MENU[l.negocio]||[];
  // estufa/expositor de vidro no balcão com produtos dentro
  cx3(g,MAT.metal,3.3,5.9,1.06,1.1,bz+0.05,bz+0.75); cx3(g,MAT.vidro,3.3,5.9,1.1,1.6,bz+0.05,bz+0.75); cx3(g,MAT.metal,3.3,5.9,1.6,1.63,bz+0.05,bz+0.75);
  { const geo=T.oficina?new THREE.CylinderGeometry(0.09,0.09,0.22,10):new THREE.SphereGeometry(0.09,10,8), m=new THREE.MeshLambertMaterial({color:0xffffff}),
      im=new THREE.InstancedMesh(geo,m,24), M=new THREE.Matrix4(), c=new THREE.Color(); let i=0;
    for(let a=0;a<2;a++) for(let x=0;x<12;x++){ im.setMatrixAt(i,M.makeTranslation(3.45+x*0.2,1.2+a*0.2,bz+0.25+a*0.2)); im.setColorAt(i,c.setHex(T.prod[(i*3+a)%T.prod.length])); i++; }
    g.add(im); }
  // copos/potes no balcão
  for(let i=0;i<3;i++){ const cp=new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.05,0.16,10),lamb(T.prod[i%T.prod.length])); cp.position.set(6.4+i*0.25,1.14,bz+0.4); g.add(cp); }
  // quadro de preços na parede do fundo (atrás do atendente) e cartazes nas laterais
  const quadro=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.72),new THREE.MeshBasicMaterial({map:texQuadro(itens,T.oficina?'SERVIÇOS':['padaria','lanchonete','bar'].includes(l.negocio)?'CARDÁPIO':'OFERTAS')}));
  quadro.position.set(6,2.75,Z1-0.22); quadro.rotation.y=Math.PI; g.add(quadro);
  itens.forEach((it,i)=>{ if(i>=4) return; const esq=i<2, z=4.6+(i%2)*4.2;
    const c=new THREE.Mesh(new THREE.PlaneGeometry(1.0,1.25),new THREE.MeshBasicMaterial({map:texCartaz(it,T.cor)}));
    c.position.set(esq?X0+0.22:X1-0.22,3.0,z); c.rotation.y=esq?Math.PI/2:-Math.PI/2; g.add(c); });
  // um cartaz na vitrine, virado para a rua
  if(itens[0]&&!T.oficina){ const v=new THREE.Mesh(new THREE.PlaneGeometry(0.9,1.12),new THREE.MeshBasicMaterial({map:texCartaz(itens[0],T.cor)})); v.position.set(2.6,1.6,Z0+0.17); v.rotation.y=Math.PI; g.add(v); }
  // produtos: prateleiras nas laterais (ou araras, mesas, pneus)
  const prods=[], cores=T.prod;
  const prat=(x0,x1)=>{ cx3(g,MAT.madeira,x0,x1,0,2.1,4,bz-0.6).material=MAT.madeira;
    for(let y=0.45;y<2.1;y+=0.55) for(let z=4.2;z<bz-0.8;z+=0.42) prods.push([(x0+x1)/2+(x0<5?0.35:-0.35),y+0.15,z,cores[(prods.length*7+3)%cores.length]]); };
  if(T.mesas){ prat(X0+0.2,X0+0.8);
    const filas=[]; for(let z=4.5;z<bz-2.2;z+=2.5) filas.push(z);
    for(const mx of (T.bar?[3.4,8.5]:[8.5])) for(const z of filas){ cx3(g,MAT.madeira,mx-0.9,mx+0.9,0.72,0.78,z,z+1.2); cx3(g,MAT.metal,mx-0.05,mx+0.05,0,0.72,z+0.55,z+0.65);
      for(const dx of [-0.75,0.75]) cx3(g,cor,mx+dx-0.22,mx+dx+0.22,0,0.45,z+0.38,z+0.82); } }
  else if(T.araras){ for(const x of [3,8]){ cx3(g,MAT.metal,x,x+0.05,0,1.6,4,8); cx3(g,MAT.metal,x,x+0.05,0,1.6,7.95,8); cx3(g,MAT.metal,x-0.02,x+0.07,1.55,1.6,4,8);
      for(let z=4.2;z<7.9;z+=0.28) prods.push([x+0.02,1.05,z,cores[(prods.length*5+1)%cores.length],'roupa']); } prat(X1-0.8,X1-0.2); }
  else if(T.oficina){ for(let i=0;i<6;i++){ const p=new THREE.Mesh(new THREE.TorusGeometry(0.33,0.13,8,16),MAT.escuro); p.rotation.y=Math.PI/2; p.position.set(X0+0.6,0.46+(i%3)*0.27,4+Math.floor(i/3)*0.9+(i%3)*0.05); g.add(p); }
    cx3(g,MAT.metal,X1-1.2,X1-0.3,0,1.1,4,6); cx3(g,lamb(0xb91c1c),X1-1.15,X1-0.35,1.1,1.6,4.2,5.8); }
  else { prat(X0+0.2,X0+0.8); prat(X1-0.8,X1-0.2); cx3(g,MAT.madeira,5.3,6.7,0,1.3,4.8,7.2);
    for(let y=0.5;y<1.4;y+=0.4) for(let z=5;z<7.1;z+=0.4) for(const x of [5.5,6.5]) prods.push([x,y+0.12,z,cores[(prods.length*3)%cores.length]]); }
  if(prods.length){ const geo=new THREE.BoxGeometry(0.3,0.3,0.3), geoR=new THREE.BoxGeometry(0.06,0.7,0.5), m=new THREE.MeshLambertMaterial({color:0xffffff});
    const normais=prods.filter(p=>!p[4]), roupas=prods.filter(p=>p[4]);
    for(const [lista,ge] of [[normais,geo],[roupas,geoR]]){ if(!lista.length) continue;
      const im=new THREE.InstancedMesh(ge,m,lista.length), M=new THREE.Matrix4(), c=new THREE.Color();
      lista.forEach(([x,y,z,k],i)=>{ im.setMatrixAt(i,M.makeTranslation(x,y,z)); im.setColorAt(i,c.setHex(k)); }); g.add(im); } }
  // colisão: paredes e balcão (a porta fica livre)
  const oc=new Set(), cel=(u,v)=>oc.add(u+','+v);
  for(let u=X0;u<X1;u++){ cel(u,Z1-1); if(u<Math.floor(porta[0])||u>=Math.ceil(porta[1])) cel(u,Z0); }
  for(let v=Z0;v<Z1;v++){ cel(X0,v); cel(X1-1,v); }
  for(let u=3;u<9;u++) cel(u,bz);
  // luminárias no teto (placas brancas; à noite acendem, ver abrirNaTela)
  const lamps=[], matL=new THREE.MeshBasicMaterial({color:0xfff6e0});
  for(let z=Z0+2.2;z<Z1-0.8;z+=3.4) for(const x of [3.6,8.4]){ const p=new THREE.Mesh(new THREE.BoxGeometry(1.3,0.06,0.32),matL); p.position.set(x,H-0.05,z); g.add(p); lamps.push([x,z]); }
  l.ocupaNeg=oc; l.balcao=bz; g.userData.letreiro=let1.material.map; g.userData.fundo=Z1; g.userData.lamps=lamps; g.userData.porta=porta;
  return g;
}

/* ───────── atendente e clientes ───────── */
const moldes=[]; let carregando=null;
function carregarMoldes(){ return carregando ??= (async()=>{ const nomes=[...PESSOAS].sort(()=>Math.random()-0.5).slice(0,6);
  for(const n of nomes){ const m=await carregarModelo(n); if(m) moldes.push(m); } })(); }
function boneco(){
  const m=moldes[(Math.random()*moldes.length)|0]; if(!m) return null;
  const obj=clonarEsqueleto(m.cena), e=(1.6+Math.random()*0.25)/m.altura; obj.scale.multiplyScalar(e); obj.traverse(o=>{ if(o.isMesh) o.frustumCulled=false; });
  const b={obj, pe:-m.base*e, mixer:new THREE.AnimationMixer(obj), acoes:{}, atual:null};
  for(const [n,c] of Object.entries(m.anims)) b.acoes[n]=b.mixer.clipAction(c);
  return b;
}
function animar(b,nome,vel=1){ const a=b.acoes[nome]||b.acoes.parado; if(!a) return; a.timeScale=vel; if(a===b.atual) return; if(b.atual) b.atual.fadeOut(0.25); a.reset().fadeIn(0.25).play(); b.atual=a; }

const abertos=new Map();   // id → { l, g, atendente, clientes:[], prox }
function abrirNaTela(l){
  fecharNaTela(l); if(!l.negocio) return;
  const g=montarPredio(l); l.grupo.add(g);
  const n={ l, g, atendente:null, clientes:[], prox:2+Math.random()*4 };
  { const lg=new THREE.Group(), F=g.userData.fundo; lg.position.copy(l.grupo.position); lg.rotation.copy(l.grupo.rotation);   // à noite: letreiro aceso, salão iluminado e luz na calçada
    const LL=g.userData.letLuz||[X1-X0, g.userData.letY?0.8:1.1, (X0+X1)/2, g.userData.letY||H-0.6, Z0-(g.userData.letY?0.23:0.07)];   // [larg, alt, x, y, z] do letreiro
    const s=luzExtra(new THREE.PlaneGeometry(LL[0],LL[1]),{map:g.userData.letreiro,forca:0.9}); s.position.set(LL[2],LL[3],LL[4]); s.rotation.y=Math.PI; lg.add(s);
    for(const [x,y] of g.userData.janelas||[]) if(Math.random()<0.75){ const j=luzExtra(new THREE.PlaneGeometry(1.4,1.15),{cor:0xffd9a0,forca:0.55}); j.position.set(x,y,(g.userData.janZ??Z0)-0.09); j.rotation.y=Math.PI; lg.add(j); }   // kitnet/casa: janelas acesas
    const cal=luzExtra(new THREE.PlaneGeometry(11,6).rotateX(-Math.PI/2),{map:TEX_QUENTE,forca:0.5}); cal.position.set((X0+X1)/2,0.07,Z0-1.5); lg.add(cal);
    if(!TIPOS[l.negocio].residencial){                                   // moradia: só janelas e letreiro (a luz de salão vazaria pelas paredes)
    const ch=luzExtra(new THREE.PlaneGeometry(X1-X0+3,F-Z0+3).rotateX(-Math.PI/2),{map:TEX_QUENTE,forca:0.55}); ch.position.set((X0+X1)/2,0.06,(Z0+F)/2); lg.add(ch);
    // luz de dentro: cada luminária brilha, as paredes e o teto ficam claros e a vitrine acende vista da rua
    const dupla=m=>{ m.material.side=THREE.DoubleSide; return m; };
    for(const [x,z] of g.userData.lamps){ const b=dupla(luzExtra(new THREE.PlaneGeometry(2.2,1.1).rotateX(Math.PI/2),{map:TEX_QUENTE,forca:1})); b.position.set(x,H-0.1,z); lg.add(b); }
    for(const [x,r] of [[X0+0.22,Math.PI/2],[X1-0.22,-Math.PI/2]]){ const p=luzExtra(new THREE.PlaneGeometry(F-Z0,H-0.3),{map:TEX_QUENTE,forca:0.35}); p.position.set(x,(H-0.3)/2+0.15,(Z0+F)/2); p.rotation.y=r; lg.add(p); }
    const fu=luzExtra(new THREE.PlaneGeometry(X1-X0,H-0.3),{map:TEX_QUENTE,forca:0.3}); fu.position.set((X0+X1)/2,(H-0.3)/2+0.15,F-0.22); fu.rotation.y=Math.PI; lg.add(fu);
    const pt=g.userData.porta;
    for(const [a,b] of [[X0,pt[0]],[pt[1],X1]]){ if(b-a<0.3) continue;
      const v=luzExtra(new THREE.PlaneGeometry(b-a,2.3),{cor:0xffd9a0,forca:0.3}); v.position.set((a+b)/2,1.75,Z0-0.01); v.rotation.y=Math.PI; lg.add(v); } }
    n.tiraLuz=porLuz(lg); }
  abertos.set(l.id,n);
  if(!TIPOS[l.negocio].residencial) carregarMoldes().then(()=>{ if(abertos.get(l.id)!==n||n.atendente) return; const b=boneco(); if(!b) return;
    b.obj.position.set(6,b.pe,l.balcao+1.5); b.obj.rotation.y=Math.PI; g.add(b.obj); animar(b,'parado'); n.atendente=b; });
  if(l.negocio==='oficina') carroNoConserto(n);
  if(l.negocio==='oficina'&&meu(l)){ const x=l.A[0]+l.t[0]*2.8+l.n[0]*1.0, z=l.A[1]+l.t[1]*2.8+l.n[1]*1.0;   // na frente da porta, de lado para a rua
    estacionarMoto(x,z,Math.atan2(-l.t[0],-l.t[1])); }
}
// oficina: carro (modelo de IA do jogo) parado de frente para a rua, capô aberto e um mecânico mexendo no motor
let carroCache=null;
const loaderCarro=new GLTFLoader(); loaderCarro.setMeshoptDecoder(MeshoptDecoder);
async function carroNoConserto(n){
  carroCache ??= new Promise(ok=>loaderCarro.load('assets/veiculos/hatch.glb',g=>ok(g.scene),undefined,()=>ok(null)));
  const molde=await carroCache; if(!molde||abertos.get(n.l.id)!==n) return;
  const carro=molde.clone(), cz=6.8; carro.position.set(6,0,cz); n.g.add(carro);           // frente = -Z = para a rua
  const box=new THREE.Box3().setFromObject(molde), tam=box.getSize(new THREE.Vector3());
  const frente=cz+box.min.z+0.35, topo=box.max.y*0.6, larg=Math.min(1.4,tam.x*0.58), compCapo=Math.min(1.1,tam.z*0.25);   // +0,35: o bico do carro é baixo
  // vão do motor: bloco escuro com peças, por cima do capô fechado do modelo
  cx3(n.g,MAT.escuro,6-larg/2,6+larg/2,topo-0.12,topo+0.02,frente,frente+compCapo);
  cx3(n.g,MAT.metal,5.6,6.2,topo+0.02,topo+0.22,frente+0.25,frente+0.8); cx3(n.g,lamb(0xb91c1c),6.3,6.55,topo+0.02,topo+0.14,frente+0.2,frente+0.45);
  cx3(n.g,lamb(0x111827),6-larg/2+0.1,6-larg/2+0.4,topo+0.02,topo+0.2,frente+0.55,frente+0.85);   // bateria
  // capô levantado, preso perto do para-brisa
  const piv=new THREE.Group(); piv.position.set(6,topo+0.04,frente+compCapo); n.g.add(piv);
  const capo=new THREE.Mesh(new THREE.BoxGeometry(larg,0.04,compCapo),lamb(0x9ca3af)); capo.position.set(0,0,-compCapo/2); piv.add(capo); piv.rotation.x=1.15;   // positivo: a ponta da frente sobe
  cx3(n.g,MAT.metal,6+larg/2-0.1,6+larg/2-0.08,topo,topo+0.7,frente+0.45,frente+0.47);           // vareta segurando o capô
  // colisão do carro
  for(let u=Math.floor(6-tam.x/2);u<Math.ceil(6+tam.x/2);u++) for(let v=Math.floor(cz+box.min.z);v<Math.ceil(cz+box.max.z);v++) n.l.ocupaNeg?.add(u+','+v);
  await carregarMoldes(); if(abertos.get(n.l.id)!==n) return;
  const m=boneco(); if(!m) return;
  m.obj.position.set(6.2,m.pe,frente-0.8); m.obj.rotation.y=0; n.g.add(m.obj); animar(m,'mexer'); n.mecanico=m; m.t=0;
}
function fecharNaTela(l){ const n=abertos.get(l.id); if(n){ n.tiraLuz?.(); l.grupo.remove(n.g); abertos.delete(l.id); } l.ocupaNeg=null; }

// cliente: calçada → porta → balcão → compra → porta → calçada → some
function novoCliente(n){
  const b=boneco(); if(!b) return; const lado=Math.random()<0.5?-1:1;
  const fila=n.clientes.length, bx=4+((fila*1.7+Math.random())%4);
  const bz=n.l.balcao, volta=n.l.negocio==='oficina'?[[9.3,Z0+1.2],[9.3,bz-0.7]]:[[6,Z0+1.2]];          // oficina: dá a volta no carro
  b.rota=[[W/2+lado*7,-1.6],[W/2+lado*1.5,-1.4],[6,Z0-0.4],...volta,[bx,bz-0.7],'comprar',...[...volta].reverse(),[6,Z0-0.4],[W/2-lado*1.5,-1.4],[W/2-lado*8,-1.6]];
  b.persona=sortearPersona(); b.passo=0; b.t=0; b.vel=(1.15+Math.random()*0.4)*b.persona.vel; const [x,z]=b.rota[0]; b.obj.position.set(x,b.pe,z); n.g.add(b.obj); n.clientes.push(b);
}
function andarCliente(n,b,dt,perto){
  const alvo=b.rota[b.passo];
  if(alvo==='comprar'){ animar(b, b.t%3<1.4&&b.acoes.mexer?'mexer':'parado'); b.obj.rotation.y=0; b.t+=dt;
    if(n.atendente) animar(n.atendente,'mexer');
    if(b.t>3.2*b.persona.balcao){ b.passo++; b.t=0; vender(n,perto,b.persona); if(n.atendente) animar(n.atendente,'parado'); } return; }
  if(!alvo){ n.g.remove(b.obj); n.clientes.splice(n.clientes.indexOf(b),1); return; }
  const p=b.obj.position, dx=alvo[0]-p.x, dz=alvo[1]-p.z, d=Math.hypot(dx,dz);
  if(d<0.15){ b.passo++; return; }
  const s=Math.min(d,b.vel*dt); p.x+=dx/d*s; p.z+=dz/d*s; b.obj.rotation.y=Math.atan2(dx,dz); animar(b,'andar',b.vel/1.3);
}
function vender(n,perto,pe){
  const T=TIPOS[n.l.negocio], k=pe?pe.compra[0]+Math.random()*(pe.compra[1]-pe.compra[0]):1, v=Math.max(1,Math.round((T.venda[0]+Math.random()*(T.venda[1]-T.venda[0]))*k));
  if(meu(n.l)&&perto){ ganhar(v); flutuar(n,`+${fmt(v)}`); const r=reg(n.l); r.vendas=(r.vendas||0)+1; salvar(); }
}
// "+M$ 20" subindo sobre o balcão
const flut=[];
function flutuar(n,txt){
  const cv=document.createElement('canvas'); cv.width=256; cv.height=64; const k=cv.getContext('2d');
  k.font='900 40px system-ui,sans-serif'; k.textAlign='center'; k.textBaseline='middle'; k.lineWidth=7; k.strokeStyle='#111'; k.strokeText(txt,128,34); k.fillStyle='#fcd34d'; k.fillText(txt,128,34);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace;
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true})); s.renderOrder=21; s.scale.set(2.4,0.6,1);
  s.position.set(6,2.2,n.l.balcao); n.g.add(s); flut.push({s,n,t:1.6});
}

/* ───────── caixa (renda acumulada) ───────── */
const reg=l=>{ salvo.negocios ??= {}; return salvo.negocios[l.id] ??= { coleta:Date.now() }; };
export const nomeDoNegocio=l=>l.negocio?nomeNeg(l):'';
export function caixa(l){ const T=TIPOS[l.negocio]; if(!T||!meu(l)) return 0; const h=Math.min(MAX_HORAS,(Date.now()-reg(l).coleta)/3.6e6); return Math.floor(h*T.hora/10)*10; }

/* ───────── interface: cardápio e painel ───────── */
let loteUI=null;
function abrirCardapio(l){
  loteUI=l; const g=$('negLista'); g.replaceChildren();
  const secao=t=>{ const h=document.createElement('div'); h.textContent=t; h.style.cssText='grid-column:1/-1;font-weight:800;margin:6px 2px 0;opacity:.85'; g.append(h); };
  const ordem=Object.entries(TIPOS).sort((a,b)=>(!!b[1].residencial)-(!!a[1].residencial));
  let sec=null;
  for(const [id,T] of ordem){ const s2=T.residencial?'🏠 Moradia':'🏪 Comércio'; if(s2!==sec){ sec=s2; secao(s2); }
    const b=document.createElement('button'); b.className='neg';
    const i=document.createElement('div'); i.className='ic'; i.textContent=T.ic;
    const tx=document.createElement('div'); const nm=document.createElement('b'); nm.textContent=T.nome;
    const pr=document.createElement('span'); pr.textContent=T.hora?`${fmt(T.preco)} · rende ${fmt(T.hora)}/h`+(T.residencial?' de aluguel':''):`${fmt(T.preco)} · para morar: V descansa`; tx.append(nm,pr); b.append(i,tx);
    b.disabled=salvo.saldo<T.preco; b.title=b.disabled?'Saldo insuficiente':'';
    b.onclick=()=>escolher(l,id); g.append(b); }
  $('negTit').textContent='🏗️ O que construir no seu terreno?';
  $('negInfo').textContent=`Saldo: ${fmt(salvo.saldo)}. O comércio aparece pronto, com atendente, e os clientes da cidade compram. Fora do jogo o caixa junta até ${MAX_HORAS} h de renda.`+(l.blocos.size?` Atenção: os ${l.blocos.size} blocos que você construiu aqui serão retirados.`:'');
  $('negAcoes').replaceChildren(); $('negocio').classList.add('on');
}
async function escolher(l,tipo){
  const T=TIPOS[tipo]; if(salvo.saldo<T.preco||!meu(l)) return;
  if(l.blocos.size&&!confirm(`Seu terreno tem ${l.blocos.size} blocos construídos.
Para montar o negócio (${T.nome}) eles serão retirados (o prédio pronto fica no lugar).

Continuar?`)) return;
  fecharUI(); avisar('Montando o comércio…');
  if(!await abrirNegocioNuvem(l.id,tipo)){ avisar('Não deu para abrir agora, tente de novo'); return; }
  if(l.blocos.size) limparBlocos(l);
  ganhar(-T.preco); reg(l).coleta=Date.now(); reg(l).vendas=0; salvar();
  l.negocio=tipo; l.negNome=''; abrirNaTela(l);
  avisar(`${T.ic} ${nomeNeg(l)} abriu as portas!`);
  dispatchEvent(new CustomEvent('matelandia:negocio',{detail:{tipo, nome:nomeNeg(l)}}));
}
function abrirPainel(l){
  loteUI=l; const T=TIPOS[l.negocio], cx=caixa(l);
  $('negTit').textContent=`${T.ic} ${nomeNeg(l)}`;
  $('negLista').replaceChildren();
  $('negInfo').textContent=T.kitnet?`Aluguel a receber: ${fmt(cx)}. São ${T.unidades} kitnets alugadas, rendendo ${fmt(T.hora)}/h juntas (junta até ${MAX_HORAS} h).`
    :`Caixa: ${fmt(cx)} (rende ${fmt(T.hora)}/h, junta até ${MAX_HORAS} h). Vendas no balcão com você por perto: ${reg(l).vendas||0}.`;
  const a=$('negAcoes'); a.replaceChildren();
  if(T.casa&&!T.hora){                                                    // casa para morar: descansar e demolir
    $('negInfo').textContent='Sua casa. Descansar enche a energia. No mapa ela aparece com 🏡.';
    const dor=document.createElement('button'); dor.textContent='😴 Descansar (energia cheia)'; dor.disabled=vida.e>=99.5;
    dor.onclick=()=>{ vida.e=100; fecharUI(); avisar('😴 Você descansou em casa: energia cheia'); };
    const dem=document.createElement('button'); dem.className='sec'; dem.textContent='Demolir a casa';
    dem.onclick=async()=>{ if(!confirm('Demolir a sua casa? O terreno fica vazio e o dinheiro gasto não volta.')) return;
      if(!await fecharNegocioNuvem(l.id)){ avisar('Não deu para demolir agora'); return; }
      delete salvo.negocios[l.id]; salvar(); l.negNome=''; dispatchEvent(new CustomEvent('matelandia:fechou',{detail:{tipo:l.negocio}})); l.negocio=null; fecharNaTela(l); fecharUI(); avisar('Casa demolida'); };
    const ren0=document.createElement('button'); ren0.className='sec'; ren0.textContent='✏️ Mudar nome da placa';
    ren0.onclick=()=>{ const r=prompt('Nome na placa (até 24 letras). Vazio volta ao padrão.', l.negNome||''); if(r===null) return;
      const nm=limparNomeNeg(r); l.negNome=nm; renomearNegocioNuvem(l.id,nm); abrirNaTela(l); fecharUI(); avisar(`Placa: ${nomeNeg(l)}`); };
    a.append(dor,ren0,dem); $('negocio').classList.add('on'); return; }
  if(T.casa) $('negInfo').textContent=`Aluguel a receber: ${fmt(cx)} (a casa rende ${fmt(T.hora)}/h, junta até ${MAX_HORAS} h). No mapa ela aparece com 🏠.`;
  const rec=document.createElement('button'); rec.textContent=`💰 Recolher ${fmt(cx)}`; rec.disabled=cx<=0;
  rec.onclick=()=>{ const v=caixa(l); ganhar(v); reg(l).coleta=Date.now(); salvar(); fecharUI(); avisar(`Caixa recolhido: +${fmt(v)}`); };
  const fec=document.createElement('button'); fec.className='sec'; fec.textContent='Fechar o negócio';
  fec.onclick=async()=>{ if(!confirm(`Fechar ${nomeNeg(l)}? O prédio some e o dinheiro gasto não volta.`)) return;
    const v=caixa(l); if(!await fecharNegocioNuvem(l.id)){ avisar('Não deu para fechar agora'); return; }
    ganhar(v); delete salvo.negocios[l.id]; salvar(); l.negNome=''; dispatchEvent(new CustomEvent('matelandia:fechou',{detail:{tipo:l.negocio}})); l.negocio=null; fecharNaTela(l); fecharUI(); avisar('Negócio fechado'+(v?` (caixa +${fmt(v)})`:'')); };
  const ren=document.createElement('button'); ren.className='sec'; ren.textContent='✏️ Mudar nome';
  ren.onclick=()=>{ const r=prompt('Nome do seu comércio (até 24 letras). Deixe vazio para voltar ao nome padrão.', l.negNome||''); if(r===null) return;
    const nm=limparNomeNeg(r); l.negNome=nm; renomearNegocioNuvem(l.id,nm); abrirNaTela(l); fecharUI(); avisar(`Agora se chama: ${nomeNeg(l)}`); };
  a.append(rec,ren,fec); $('negocio').classList.add('on');
}
function fecharUI(){ $('negocio').classList.remove('on'); loteUI=null; }
$('negFechar').addEventListener('click',fecharUI);
$('negocio').addEventListener('click',e=>{ if(e.target.id==='negocio') fecharUI(); });

// V (ou botão 🏪): no seu terreno vazio abre o cardápio; com negócio, o painel
export function acaoNegocio(x,z){
  const l=loteEm(x,z,1);
  if(!l){ avisar('Vá até o seu terreno para abrir um negócio (L leva até ele)'); return; }
  if(l.especial){ ganchos.acaoEspecial?.(l); return; }               // posto / balada: o negócio já vem pronto (especiais.js)
  if(!meu(l)){ avisar(l.negocio?`${TIPOS[l.negocio].ic} ${nomeNeg(l)}`:l.dono?`Terreno de ${l.donoNome||'outro jogador'}`:'Compre o terreno primeiro (B)'); return; }
  if(l.negocio) abrirPainel(l); else abrirCardapio(l);
}
// jogador dentro de uma farmácia (de qualquer jogador): pode comprar remédio no balcão
export const PRECO_REMEDIO=40;
export function farmaciaAqui(x,z){
  for(const n of abertos.values()){ const l=n.l; if(l.negocio!=='farmacia') continue;
    const dx=x-l.A[0], dz=z-l.A[1], u=dx*l.t[0]+dz*l.t[1], v=dx*l.n[0]+dz*l.n[1];
    if(u>X0&&u<X1&&v>Z0&&v<Z1) return n; }
  return null;
}
export function comprarRemedio(vida){
  if(vida.e>=99.5){ avisar('💊 Sua energia já está cheia'); return; }
  if(salvo.saldo<PRECO_REMEDIO){ avisar(`Saldo insuficiente para o remédio (${fmt(PRECO_REMEDIO)})`); return; }
  ganhar(-PRECO_REMEDIO); vida.e=100; avisar(`💊 Remédio tomado: energia cheia (−${fmt(PRECO_REMEDIO)})`);
}
// para o mapa grande: todos os negócios abertos, com ícone
export const pontosNegocios=()=>lotes.filter(l=>l.negocio&&TIPOS[l.negocio]).map(l=>({ x:l.A[0]+l.t[0]*6-l.n[0]*2, z:l.A[1]+l.t[1]*6-l.n[1]*2, ic:TIPOS[l.negocio].ic, nome:nomeNeg(l), tipo:meu(l)?(TIPOS[l.negocio].residencial?'minhaCasa':'meuNegocio'):l.negocio==='farmacia'?'farmacia':'negocio' }));
export const pertoDeNegocioMeu=(x,z)=>{ const l=loteEm(x,z,1); return !!(l&&meu(l)); };
ganchos.icone=l=>l.negocio&&TIPOS[l.negocio]?TIPOS[l.negocio].ic:null;   // minimapa (terrenos.js → desenhoLote)
ganchos.dica=l=>{
  if(!l.negocio) return '';
  const T=TIPOS[l.negocio];
  if(meu(l)){ if(T.casa&&!T.hora) return `${T.ic} Sua casa · V descansar`; const c=caixa(l); return `${T.ic} ${nomeNeg(l)} · V ${T.residencial?'aluguel':'caixa'} ${fmt(c)}`; }
  return `${T.ic} ${nomeNeg(l)} · aberto`;
};

/* ───────── ligação com o banco e o quadro ───────── */
export async function iniciarNegocios(){
  if(!await conectarNuvem()) return;
  ouvirNegocios(ns=>{
    for(const l of lotes){ const t=ns[l.id]?.t, tipo=TIPOS[t]?t:null;
      const nm=tipo?limparNomeNeg(ns[l.id].n):'';
      if(tipo===l.negocio&&nm===(l.negNome||'')&&(!tipo||abertos.has(l.id))) continue;
      l.negocio=tipo; l.negNome=nm; if(tipo) abrirNaTela(l); else fecharNaTela(l); }
  });
}
export function atualizarNegocios(dt, px, pz){
  const h=horaJogo(); let dentro=null;
  for(const n of abertos.values()){
    const l=n.l, d=Math.hypot(l.cx-px,l.cz-pz);
    if(d>160){ for(const b of n.clientes) n.g.remove(b.obj); n.clientes.length=0; continue; }   // longe: sem clientes
    const T=TIPOS[l.negocio], mov=perfil(h,T.curva);
    if(T.residencial) continue;                                         // kitnet/casa: sem balcão nem clientes
    { const dx=px-l.A[0], dz=pz-l.A[1], u=dx*l.t[0]+dz*l.t[1], v=dx*l.n[0]+dz*l.n[1]; if(u>X0&&u<X1&&v>Z0&&v<(T.fundo||Z1)) dentro=l.negocio; }   // jogador dentro da loja
    n.prox-=dt;
    if(n.prox<=0&&moldes.length){ n.prox=(5+Math.random()*7)/Math.max(0.15,mov); if(mov>0.08&&n.clientes.length<3) novoCliente(n); }
    for(const b of [...n.clientes]){ andarCliente(n,b,dt,d<60); b.obj.position.y=b.pe; b.mixer.update(dt); }
    if(n.atendente) n.atendente.mixer.update(dt);
    if(n.mecanico){ const m=n.mecanico; m.t+=dt; animar(m, m.t%9<6.5?'mexer':'parado'); m.mixer.update(dt); }
  }
  musicaLoja(dentro||ganchos.musicaEspecial?.()||null);                 // a balada (especiais.js) também toca
  for(let i=flut.length-1;i>=0;i--){ const f=flut[i]; f.t-=dt; f.s.position.y+=dt*0.8; f.s.material.opacity=Math.min(1,f.t); if(f.t<=0){ f.n.g.remove(f.s); flut.splice(i,1); } }
}

/* ───────── 🛒 balcão: o jogador compra produtos em qualquer negócio aberto (pedido do Maicon em 17/11) ─────────
   Cada produto desconta do saldo e muda algo no jogo. Efeitos (main.js aplica):
   e: energia +N · cheia: energia 100 · corrida: s correndo mais rápido · disfarce: some com as estrelas da polícia
   conserto: arruma o último veículo que dirigiu · turbo: s de turbo no veículo. No seu próprio negócio sai pela metade. */
export const PRODUTOS={
  padaria:   [['🥖','Pão francês',6,{e:10}], ['☕','Café',5,{e:5,corrida:60}], ['🍰','Bolo',22,{e:30}]],
  lanchonete:[['🍔','X-salada',22,{e:35}], ['🧃','Suco',8,{e:12}], ['🍟','Combo completo',40,{e:65}]],
  mercado:   [['🍱','Marmita',18,{e:35}], ['💧','Água',3,{e:5}], ['🍌','Banana',4,{e:8}], ['⚡','Energético',15,{e:15,corrida:120}]],
  roupas:    [['👟','Tênis de corrida',120,{corrida:300}], ['🧥','Roupa nova (disfarce)',150,{disfarce:true}], ['🧢','Boné',35,{e:5}]],
  farmacia:  [['💊','Remédio',PRECO_REMEDIO,{cheia:true}], ['🩹','Curativo',15,{e:25}], ['🍊','Vitamina C',20,{e:15,corrida:90}]],
  oficina:   [['🔧','Conserto do veículo',80,{conserto:true}], ['🚀','Turbo (5 min)',200,{turbo:300}], ['🧴','Lavagem',25,{conserto:'leve'}]],
  bar:       [['🥤','Refri',6,{e:8}], ['🍗','Porção',35,{e:45}], ['🧊','Água com gás',5,{e:6}]],
  sorveteria:[['🍦','Casquinha',6,{e:8}], ['🍧','Açaí',22,{e:30}], ['🥤','Milk-shake',16,{e:20,corrida:60}]],
  petshop:   [['🦴','Petiscos para os cachorros',12,{caes:300}], ['🥫','Ração (cachorros amigos 15 min)',40,{caes:900}]],
  barbearia: [['💈','Corte novo (disfarce)',35,{disfarce:true}], ['🧔','Barba feita',25,{e:10}]],
  acougue:   [['🔥','Espetinho na brasa',12,{e:25}], ['🍖','Churrasco completo',55,{e:80}]],
  pizzaria:  [['🍕','Pedaço de pizza',9,{e:15}], ['🍕','Pizza inteira',49,{e:90}]],
  floricultura:[['🌻','Girassol',15,{e:5}], ['💐','Arranjo (dá ânimo)',60,{e:20,corrida:60}]],
  eletronicos:[['🔋','Power bank (energia)',119,{e:30}], ['🎧','Fone com música (corre mais)',89,{corrida:180}]],
  papelaria: [['📒','Caderno',25,{e:3}], ['🍬','Bala',2,{e:4}]],
};
// jogador dentro de um negócio aberto (de qualquer jogador)?
export function lojaAqui(x,z){
  for(const n of abertos.values()){ const l=n.l, T=TIPOS[l.negocio]; if(!T||T.residencial) continue;
    const dx=x-l.A[0], dz=z-l.A[1], u=dx*l.t[0]+dz*l.t[1], v=dx*l.n[0]+dz*l.n[1];
    if(u>X0&&u<X1&&v>Z0&&v<(T.fundo||Z1)) return n; }
  return null;
}
const descreve=ef=>[ef.cheia?'energia cheia':ef.e?`+${ef.e} energia`:'', ef.corrida?`corre mais rápido ${ef.corrida>=120?Math.round(ef.corrida/60)+' min':ef.corrida+' s'}`:'',
  ef.disfarce?'a polícia perde você de vista':'', ef.conserto===true?'arruma o último veículo que você dirigiu':ef.conserto?'tira a sujeira e o amassado leve':'', ef.turbo?'veículo mais rápido':'', ef.caes?`os cachorros não correm atrás de você por ${Math.round(ef.caes/60)} min`:''].filter(Boolean).join(' · ');
// aplicar(ef) devolve texto de erro (não cobra) ou '' (deu certo)
export function abrirBalcao(n, aplicar){
  const l=n.l, T=TIPOS[l.negocio], dono=meu(l), lista=PRODUTOS[l.negocio]||[];
  $('balcaoTit').textContent=`${T.ic} ${nomeNeg(l)}`;
  $('balcaoInfo').textContent=(dono?'Seu negócio: aqui você paga só a metade. ':'')+`Saldo: ${fmt(salvo.saldo)}`;
  const g=$('balcaoLista'); g.replaceChildren();
  for(const [ic,nome,preco0,ef] of lista){ const preco=dono?Math.ceil(preco0/2):preco0;
    const b=document.createElement('button'); b.className='neg';
    const i=document.createElement('div'); i.className='ic'; i.textContent=ic;
    const tx=document.createElement('div'); const nm=document.createElement('b'); nm.textContent=`${nome} · ${fmt(preco)}`; const s=document.createElement('span'); s.textContent=descreve(ef); tx.append(nm,s); b.append(i,tx);
    b.disabled=salvo.saldo<preco; b.title=b.disabled?'Saldo insuficiente':'';
    b.onclick=()=>{ if(salvo.saldo<preco){ avisar('Saldo insuficiente'); return; }
      const erro=ef.caes&&Object.keys(ef).length===1?'':aplicar(ef); if(erro){ avisar(erro); return; }
      if(ef.caes) acalmarCaes(ef.caes);
      ganhar(-preco);
      $('balcao').classList.remove('on'); avisar(`${ic} ${nome}: ${descreve(ef)} (−${fmt(preco)})`);
      dispatchEvent(new CustomEvent('matelandia:comprou',{detail:{tipo:l.negocio,nome}})); };
    g.append(b); }
  $('balcao').classList.add('on');
}
$('balcaoFechar')?.addEventListener('click',()=>$('balcao').classList.remove('on'));
$('balcao')?.addEventListener('click',e=>{ if(e.target.id==='balcao') $('balcao').classList.remove('on'); });
// teste (console/tools/teste): monta um negócio no lote sem passar pelo banco
export const _teste={ abrirNaTela, fecharNaTela };
