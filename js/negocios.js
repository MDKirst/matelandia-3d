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
import { nuvem, conectarNuvem, ouvirNegocios, abrirNegocioNuvem, fecharNegocioNuvem } from './nuvem.js';
import { carregarModelo, PESSOAS } from './pedestres.js';
import { horaJogo } from './ceu.js';
import { perfil } from './rotina.js';
import { sortearPersona } from './personas.js';
import { musicaLoja } from './som.js';

// curvas de movimento por hora (as mesmas ideias do rotina.js)
const C_PADARIA=[[0,0],[5.5,0.05],[6.3,1],[9,0.5],[11,0.3],[15,0.5],[16.5,0.9],[18.5,0.6],[20,0.1],[24,0]];
const C_COMIDA=[[0,0.1],[10.8,0.15],[11.6,1],[13.6,0.3],[18.5,0.4],[19.8,1],[22.5,0.5],[24,0.1]];
const C_LOJA=[[0,0],[7.8,0.05],[8.5,0.8],[11.8,0.9],[12.2,0.5],[13.5,0.8],[18,0.7],[18.6,0.05],[24,0]];
const C_FARMA=[[0,0.15],[7,0.4],[8,0.8],[19,0.7],[22,0.3],[24,0.15]];
export const TIPOS = {
  padaria:   { nome:'Padaria',    ic:'🥖', preco:6000,  hora:900,  venda:[8,25],   cor:0xF97316, piso:'#e9dcc4', prod:[0xc8893f,0xe0b070,0xa86b2e,0xf2d6a2,0x8a4f22], curva:C_PADARIA, fala:'Me vê 10 pães, por favor!' },
  lanchonete:{ nome:'Lanchonete', ic:'🍔', preco:7000,  hora:1100, venda:[15,40],  cor:0xdc2626, piso:'#f3e4cf', prod:[0xfacc15,0xdc2626,0x16a34a,0xf97316], curva:C_COMIDA, fala:'Um X-salada e um suco!', mesas:true },
  mercado:   { nome:'Mercado',    ic:'🛒', preco:9000,  hora:1400, venda:[20,90],  cor:0x16a34a, piso:'#e6e6e1', prod:[0xdc2626,0x2563eb,0xfacc15,0x16a34a,0xf97316,0xffffff,0x7c3aed], curva:C_LOJA, fala:'Só vim buscar arroz e feijão.' },
  roupas:    { nome:'Loja de Roupas', ic:'👕', preco:8000, hora:1200, venda:[40,150], cor:0x7c3aed, piso:'#efe9f5', prod:[0x1e3a8a,0xdb2777,0x0f766e,0xfbbf24,0x111827,0xf5f5f4], curva:C_LOJA, fala:'Tem essa camiseta no M?', araras:true },
  farmacia:  { nome:'Farmácia',   ic:'💊', preco:8500,  hora:1300, venda:[15,70],  cor:0x0d9488, piso:'#eef6f5', prod:[0xffffff,0x0ea5e9,0xf43f5e,0x22c55e,0xfde68a], curva:C_FARMA, fala:'Tem remédio pra dor de cabeça?' },
  oficina:   { nome:'Oficina',    ic:'🔧', preco:10000, hora:1600, venda:[60,220], cor:0x334155, piso:'#9ca3af', prod:[0x111827,0x374151,0xb91c1c,0x1d4ed8], curva:C_LOJA, fala:'Meu carro tá fazendo um barulho…', oficina:true },
};
const MAX_HORAS=8;
// o que aparece nos cartazes e no quadro de preços (desenhado aqui, com emoji)
const MENU = {
  padaria:   [['🥖','Pão francês','0,80'],['🥐','Croissant','6'],['🍰','Bolo de pote','12'],['☕','Cafezinho','4'],['🧀','Pão de queijo','5']],
  lanchonete:[['🍔','X-Salada','18'],['🌭','Cachorro-quente','12'],['🍟','Batata frita','14'],['🥤','Refri lata','6'],['🍕','Pizza broto','22']],
  mercado:   [['🍎','Frutas','5/kg'],['🥛','Leite','5'],['🍚','Arroz 5 kg','28'],['🫘','Feijão 1 kg','9'],['🍫','Chocolate','7']],
  roupas:    [['👕','Camiseta','39'],['👖','Calça jeans','119'],['👟','Tênis','199'],['🧢','Boné','49'],['👗','Vestido','89']],
  farmacia:  [['💊','Analgésico','9'],['🧴','Protetor solar','45'],['🩹','Curativos','7'],['🪥','Escova de dente','8'],['🧼','Sabonete','3']],
  oficina:   [['🛞','Pneu aro 14','320'],['🛢️','Troca de óleo','150'],['🔧','Revisão','250'],['🔋','Bateria','480'],['🧽','Lavagem','40']],
};
function texCartaz([ic,nome,preco],cor){
  const cv=document.createElement('canvas'); cv.width=256; cv.height=320; const k=cv.getContext('2d');
  k.fillStyle='#fffaf0'; k.fillRect(0,0,256,320); k.fillStyle='#'+new THREE.Color(cor).getHexString(); k.fillRect(0,0,256,26); k.fillRect(0,294,256,26);
  k.textAlign='center'; k.textBaseline='middle'; k.font='120px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; k.fillText(ic,128,130);
  k.fillStyle='#1c1917'; let fs=34; k.font=`900 ${fs}px system-ui,sans-serif`; while(k.measureText(nome).width>236&&fs>18){ fs-=2; k.font=`900 ${fs}px system-ui,sans-serif`; } k.fillText(nome,128,222);
  k.fillStyle='#dc2626'; k.font='900 40px system-ui,sans-serif'; k.fillText('M$ '+preco,128,266);
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
function texQuadro(itens,titulo){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=384; const k=cv.getContext('2d');
  k.fillStyle='#1f2a24'; k.fillRect(0,0,1024,384); k.strokeStyle='#8b5a2b'; k.lineWidth=18; k.strokeRect(9,9,1006,366);
  k.fillStyle='#fef3c7'; k.textBaseline='middle'; k.textAlign='center'; k.font='900 54px system-ui,sans-serif'; k.fillText(titulo,512,58);
  itens.slice(0,5).forEach(([ic,nome,preco],i)=>{ const y=118+i*54;
    k.textAlign='left'; k.font='38px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; k.fillText(ic,60,y);
    k.fillStyle='#f5f5f4'; k.font='700 36px system-ui,sans-serif'; k.fillText(nome,120,y);
    k.textAlign='right'; k.fillStyle='#fde047'; k.fillText('M$ '+preco,964,y); k.fillStyle='#fef3c7'; });
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=4; return t;
}
const nomeNeg=l=>`${TIPOS[l.negocio].nome} de ${l.donoNome||'Visitante'}`;   // "de": serve para qualquer nome

/* ───────── prédio pronto (coordenadas do lote: x = frente 0..12, z = fundo 0..24) ───────── */
const X0=1, X1=11, Z0=2, Z1=15, H=4.2, PORTA=[4.8,7.2];
const lamb=c=>new THREE.MeshLambertMaterial({color:c});
const MAT={ parede:lamb(0xf1ece2), base:lamb(0x6b6f73), vidro:new THREE.MeshLambertMaterial({color:0x9cc8e0,transparent:true,opacity:0.35}),
  laje:lamb(0xbdbab2), madeira:lamb(0x8b5a2b), balcao:lamb(0xe7e2d8), metal:lamb(0x9ca3af), escuro:lamb(0x1f2937) };
function cx3(g,m,x0,x1,y0,y1,z0,z1){ const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0),m); b.position.set((x0+x1)/2,(y0+y1)/2,(z0+z1)/2); g.add(b); return b; }
function texLetreiro(txt, ic, cor){
  const cv=document.createElement('canvas'); cv.width=1024; cv.height=128; const k=cv.getContext('2d');
  k.fillStyle='#'+new THREE.Color(cor).getHexString(); k.fillRect(0,0,1024,128);
  k.fillStyle='rgba(255,255,255,.18)'; k.fillRect(0,0,1024,10); k.fillRect(0,118,1024,10);
  k.fillStyle='#fff'; k.textAlign='center'; k.textBaseline='middle';
  let fs=64; k.font=`900 ${fs}px system-ui,sans-serif`; const t=ic+'  '+txt.toUpperCase();
  while(k.measureText(t).width>970&&fs>26){ fs-=2; k.font=`900 ${fs}px system-ui,sans-serif`; }
  k.fillText(t,512,68); const tx=new THREE.CanvasTexture(cv); tx.colorSpace=THREE.SRGBColorSpace; tx.anisotropy=4; return tx;
}
function texPiso(c){ const cv=document.createElement('canvas'); cv.width=cv.height=64; const k=cv.getContext('2d'); k.fillStyle=c; k.fillRect(0,0,64,64);
  k.fillStyle='rgba(0,0,0,.09)'; k.fillRect(0,0,64,2); k.fillRect(0,0,2,64); const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(10,13); t.colorSpace=THREE.SRGBColorSpace; return t; }

function montarPredio(l){
  const T=TIPOS[l.negocio], g=new THREE.Group(), cor=lamb(T.cor);
  // piso
  const piso=new THREE.Mesh(new THREE.PlaneGeometry(X1-X0,Z1-Z0).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({map:texPiso(T.piso)}));
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
  const bz=T.oficina?12:9;
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
  const quadro=new THREE.Mesh(new THREE.PlaneGeometry(4.6,1.72),new THREE.MeshBasicMaterial({map:texQuadro(itens,T.oficina?'SERVIÇOS':['padaria','lanchonete'].includes(l.negocio)?'CARDÁPIO':'OFERTAS')}));
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
    for(const z of [4.5,7]) { cx3(g,MAT.madeira,7.6,9.4,0.72,0.78,z,z+1.2); cx3(g,MAT.metal,8.45,8.55,0,0.72,z+0.55,z+0.65);
      for(const dx of [-0.75,0.75]) cx3(g,cor,8.5+dx-0.22,8.5+dx+0.22,0,0.45,z+0.38,z+0.82); } }
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
  l.ocupaNeg=oc; l.balcao=bz;
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
  abertos.set(l.id,n);
  carregarMoldes().then(()=>{ if(abertos.get(l.id)!==n||n.atendente) return; const b=boneco(); if(!b) return;
    b.obj.position.set(6,b.pe,l.balcao+1.5); b.obj.rotation.y=Math.PI; g.add(b.obj); animar(b,'parado'); n.atendente=b; });
  if(l.negocio==='oficina') carroNoConserto(n);
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
function fecharNaTela(l){ const n=abertos.get(l.id); if(n){ l.grupo.remove(n.g); abertos.delete(l.id); } l.ocupaNeg=null; }

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
export function caixa(l){ const T=TIPOS[l.negocio]; if(!T||!meu(l)) return 0; const h=Math.min(MAX_HORAS,(Date.now()-reg(l).coleta)/3.6e6); return Math.floor(h*T.hora/10)*10; }

/* ───────── interface: cardápio e painel ───────── */
let loteUI=null;
function abrirCardapio(l){
  loteUI=l; const g=$('negLista'); g.replaceChildren();
  for(const [id,T] of Object.entries(TIPOS)){ const b=document.createElement('button'); b.className='neg';
    const i=document.createElement('div'); i.className='ic'; i.textContent=T.ic;
    const tx=document.createElement('div'); const nm=document.createElement('b'); nm.textContent=T.nome;
    const pr=document.createElement('span'); pr.textContent=`${fmt(T.preco)} · rende ${fmt(T.hora)}/h`; tx.append(nm,pr); b.append(i,tx);
    b.disabled=salvo.saldo<T.preco; b.title=b.disabled?'Saldo insuficiente':'';
    b.onclick=()=>escolher(l,id); g.append(b); }
  $('negTit').textContent='🏪 Abrir um negócio no seu terreno';
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
  l.negocio=tipo; abrirNaTela(l);
  avisar(`${T.ic} ${nomeNeg(l)} abriu as portas!`);
  dispatchEvent(new CustomEvent('matelandia:negocio',{detail:{tipo, nome:nomeNeg(l)}}));
}
function abrirPainel(l){
  loteUI=l; const T=TIPOS[l.negocio], cx=caixa(l);
  $('negTit').textContent=`${T.ic} ${nomeNeg(l)}`;
  $('negLista').replaceChildren();
  $('negInfo').textContent=`Caixa: ${fmt(cx)} (rende ${fmt(T.hora)}/h, junta até ${MAX_HORAS} h). Vendas no balcão com você por perto: ${reg(l).vendas||0}.`;
  const a=$('negAcoes'); a.replaceChildren();
  const rec=document.createElement('button'); rec.textContent=`💰 Recolher ${fmt(cx)}`; rec.disabled=cx<=0;
  rec.onclick=()=>{ const v=caixa(l); ganhar(v); reg(l).coleta=Date.now(); salvar(); fecharUI(); avisar(`Caixa recolhido: +${fmt(v)}`); };
  const fec=document.createElement('button'); fec.className='sec'; fec.textContent='Fechar o negócio';
  fec.onclick=async()=>{ if(!confirm(`Fechar ${nomeNeg(l)}? O prédio some e o dinheiro gasto não volta.`)) return;
    const v=caixa(l); if(!await fecharNegocioNuvem(l.id)){ avisar('Não deu para fechar agora'); return; }
    ganhar(v); delete salvo.negocios[l.id]; salvar(); dispatchEvent(new CustomEvent('matelandia:fechou',{detail:{tipo:l.negocio}})); l.negocio=null; fecharNaTela(l); fecharUI(); avisar('Negócio fechado'+(v?` (caixa +${fmt(v)})`:'')); };
  a.append(rec,fec); $('negocio').classList.add('on');
}
function fecharUI(){ $('negocio').classList.remove('on'); loteUI=null; }
$('negFechar').addEventListener('click',fecharUI);
$('negocio').addEventListener('click',e=>{ if(e.target.id==='negocio') fecharUI(); });

// V (ou botão 🏪): no seu terreno vazio abre o cardápio; com negócio, o painel
export function acaoNegocio(x,z){
  const l=loteEm(x,z,1);
  if(!l){ avisar('Vá até o seu terreno para abrir um negócio (L leva até ele)'); return; }
  if(!meu(l)){ avisar(l.negocio?`${TIPOS[l.negocio].ic} ${nomeNeg(l)}`:l.dono?`Terreno de ${l.donoNome||'outro jogador'}`:'Compre o terreno primeiro (B)'); return; }
  if(l.negocio) abrirPainel(l); else abrirCardapio(l);
}
export const pertoDeNegocioMeu=(x,z)=>{ const l=loteEm(x,z,1); return !!(l&&meu(l)); };
ganchos.dica=l=>{
  if(!l.negocio) return '';
  const T=TIPOS[l.negocio];
  if(meu(l)){ const c=caixa(l); return `${T.ic} ${nomeNeg(l)} · V caixa ${fmt(c)}`; }
  return `${T.ic} ${nomeNeg(l)} · aberto`;
};

/* ───────── ligação com o banco e o quadro ───────── */
export async function iniciarNegocios(){
  if(!await conectarNuvem()) return;
  ouvirNegocios(ns=>{
    for(const l of lotes){ const t=ns[l.id]?.t, tipo=TIPOS[t]?t:null;
      if(tipo===l.negocio&&(!tipo||abertos.has(l.id))) continue;
      l.negocio=tipo; if(tipo) abrirNaTela(l); else fecharNaTela(l); }
  });
}
export function atualizarNegocios(dt, px, pz){
  const h=horaJogo(); let dentro=null;
  for(const n of abertos.values()){
    const l=n.l, d=Math.hypot(l.cx-px,l.cz-pz);
    if(d>160){ for(const b of n.clientes) n.g.remove(b.obj); n.clientes.length=0; continue; }   // longe: sem clientes
    const T=TIPOS[l.negocio], mov=perfil(h,T.curva);
    { const dx=px-l.A[0], dz=pz-l.A[1], u=dx*l.t[0]+dz*l.t[1], v=dx*l.n[0]+dz*l.n[1]; if(u>X0&&u<X1&&v>Z0&&v<Z1) dentro=l.negocio; }   // jogador dentro da loja
    n.prox-=dt;
    if(n.prox<=0&&moldes.length){ n.prox=(5+Math.random()*7)/Math.max(0.15,mov); if(mov>0.08&&n.clientes.length<3) novoCliente(n); }
    for(const b of [...n.clientes]){ andarCliente(n,b,dt,d<60); b.obj.position.y=b.pe; b.mixer.update(dt); }
    if(n.atendente) n.atendente.mixer.update(dt);
    if(n.mecanico){ const m=n.mecanico; m.t+=dt; animar(m, m.t%9<6.5?'mexer':'parado'); m.mixer.update(dt); }
  }
  musicaLoja(dentro);
  for(let i=flut.length-1;i>=0;i--){ const f=flut[i]; f.t-=dt; f.s.position.y+=dt*0.8; f.s.material.opacity=Math.min(1,f.t); if(f.t<=0){ f.n.g.remove(f.s); flut.splice(i,1); } }
}
