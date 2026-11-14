// Dia e noite.
// Relógio do jogo: 1 dia = 48 min de verdade, contado a partir do relógio do computador, então todos
// os jogadores online veem a mesma hora (?hora=21 na URL fixa a hora, para testar).
// Como a maior parte da cidade usa material sem luz (satélite, ruas, telhados), escurecer as luzes não
// bastaria: depois de desenhar a cena, um retângulo na tela inteira MULTIPLICA tudo por uma cor
// (branco de dia, laranja no fim da tarde, azul-escuro à noite). Em seguida vem uma segunda cena só
// de luzes (postes, janelas, faróis, estrelas), somada por cima e testando a profundidade da primeira
// (prédio na frente esconde a luz de trás). Custa um retângulo e poucas chamadas de desenho.
import * as THREE from 'three';
import { scene, renderer, camera } from './cena.js';
import { ruas } from './cidade.js';

const CICLO_MIN = 48;
const fixa = (()=>{ const h=parseFloat(new URLSearchParams(location.search).get('hora')); return isFinite(h)?((h%24)+24)%24:null; })();
export function horaJogo(){
  if(fixa!==null) return fixa;
  const min = Date.now()/60000;
  return ((min/CICLO_MIN*24) + 10) % 24;      // +10: no começo de cada hora "real" não cai sempre na mesma hora do jogo
}
export const relogioTxt = h=>String(Math.floor(h)).padStart(2,'0')+':'+String(Math.floor((h%1)*60)).padStart(2,'0');

// quadros-chave do dia: hora → cor que multiplica a cena, quanto de "noite" (luzes acesas)
const CHAVES = [
  [0,   0x2a3560, 1], [4.8, 0x2a3560, 1], [5.6, 0x7a6a8a, 0.75], [6.3, 0xffc9a0, 0.2], [7.2, 0xffffff, 0],
  [16.8,0xffffff, 0], [17.7,0xffd2a8, 0.05], [18.4,0xe8957a, 0.35], [19.0,0x6a5a88, 0.75], [19.7,0x2a3560, 1], [24, 0x2a3560, 1] ].map(([h,c,n])=>[h,new THREE.Color(c),n]);
const tinta = new THREE.Color(); let noite = 0;
function amostrar(h){
  for(let i=0;i<CHAVES.length-1;i++){ const [h0,c0,n0]=CHAVES[i], [h1,c1,n1]=CHAVES[i+1];
    if(h>=h0&&h<=h1){ const t=(h-h0)/(h1-h0||1); tinta.copy(c0).lerp(c1,t); noite=n0+(n1-n0)*t; return; } }
}
export const quantoNoite = ()=>noite;

// densidade de gente e de carros pela hora (1 = cheio)
const curva = (h,pts)=>{ for(let i=0;i<pts.length-1;i++){ const [a,va]=pts[i],[b,vb]=pts[i+1]; if(h>=a&&h<=b) return va+(vb-va)*(h-a)/(b-a||1); } return 1; };
export const fatorPessoas = h=>curva(h,[[0,0.15],[5,0.12],[7,0.6],[8.5,1],[18,1],[20,0.6],[22,0.3],[24,0.15]]);
export const fatorCarros  = h=>curva(h,[[0,0.25],[5,0.2],[6.5,0.7],[7.5,1],[19,1],[21,0.6],[23,0.35],[24,0.25]]);

/* ───────── passada que escurece ───────── */
const camTela = new THREE.OrthographicCamera(-1,1,1,-1,0,1), telaCena = new THREE.Scene();
const matTela = new THREE.MeshBasicMaterial({ color:0xffffff, depthTest:false, depthWrite:false, transparent:true,
  blending:THREE.CustomBlending, blendEquation:THREE.AddEquation, blendSrc:THREE.ZeroFactor, blendDst:THREE.SrcColorFactor });
telaCena.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2), matTela));

/* ───────── cena das luzes ───────── */
const luzes = new THREE.Scene();
function texBrilho(r0,g0,b0,suave=1){
  const cv=document.createElement('canvas'); cv.width=cv.height=64; const k=cv.getContext('2d');
  const g=k.createRadialGradient(32,32,0,32,32,32);
  g.addColorStop(0,`rgba(${r0},${g0},${b0},1)`); g.addColorStop(0.25*suave,`rgba(${r0},${g0},${b0},.55)`); g.addColorStop(1,`rgba(${r0},${g0},${b0},0)`);
  k.fillStyle=g; k.fillRect(0,0,64,64); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t;
}
const aditivo = o=>Object.assign(o,{ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending, fog:false });
const TEX_AMARELA = texBrilho(255,214,150), TEX_BRANCA = texBrilho(255,250,235), TEX_VERMELHA = texBrilho(255,40,30);

// postes: um a cada ~32 m nas ruas com calçada, alternando o lado; o poste existe de dia também
const COM_CALCADA = new Set(['primary','secondary','tertiary','residential','unclassified','living_street','primary_link','secondary_link','tertiary_link']);
export const postes = [];   // [x,z]
function montarPostes(){
  const pos=[]; let lado=1;
  for(const r of ruas){ if(r.pe||!COM_CALCADA.has(r.tipo)||r.pts.length<2) continue;
    let resto=10;
    for(let i=0;i<r.pts.length-1;i++){ const a=r.pts[i], b=r.pts[i+1], dx=b[0]-a[0], dz=b[1]-a[1], L=Math.hypot(dx,dz); if(L<0.5) continue;
      const ux=dx/L, uz=dz/L;
      for(let s=resto;s<L;s+=32){ lado=-lado; const off=lado*(r.w/2+0.55);
        pos.push([a[0]+ux*s-uz*off, a[1]+uz*s+ux*off, Math.atan2(-uz*lado,ux*lado)]); }   // braço aponta para a rua
      resto=(resto-L)%32; if(resto<0) resto+=32; } }
  // tira os que ficaram colados (cruzamentos, ruas paralelas)
  const G=new Map(), ok=[];
  for(const p of pos){ const k=Math.round(p[0]/12)+'_'+Math.round(p[1]/12); if(G.has(k)) continue; G.set(k,1); ok.push(p); }
  return ok;
}
let pontos, poças, ALTURA=7.2;
function construirPostes(){
  const lista=montarPostes(); postes.push(...lista.map(p=>[p[0],p[1]]));
  // malha do poste (concreto + braço + luminária) instanciada: 1 chamada de desenho para todos
  const geo=[new THREE.CylinderGeometry(0.09,0.14,ALTURA,6).translate(0,ALTURA/2,0),
    new THREE.BoxGeometry(1.6,0.08,0.08).translate(0.8,ALTURA-0.15,0),
    new THREE.BoxGeometry(0.5,0.12,0.24).translate(1.55,ALTURA-0.25,0)];
  const mats=[new THREE.MeshLambertMaterial({color:0xa9a9a2}), new THREE.MeshLambertMaterial({color:0x6b6f73}), new THREE.MeshLambertMaterial({color:0x50555a})];
  const M=new THREE.Matrix4(), Q=new THREE.Quaternion(), Y=new THREE.Vector3(0,1,0), V=new THREE.Vector3(), S=new THREE.Vector3(1,1,1);
  geo.forEach((g,i)=>{ const im=new THREE.InstancedMesh(g,mats[i],lista.length);
    lista.forEach((p,j)=>{ Q.setFromAxisAngle(Y,p[2]); im.setMatrixAt(j,M.compose(V.set(p[0],0,p[1]),Q,S)); });
    im.computeBoundingSphere(); scene.add(im); });
  // luz: brilho na luminária (pontos) + poça de luz no chão (quadrados instanciados)
  const cab=new Float32Array(lista.length*3);
  lista.forEach((p,j)=>{ cab[j*3]=p[0]+Math.cos(p[2])*1.55; cab[j*3+1]=ALTURA-0.35; cab[j*3+2]=p[1]-Math.sin(p[2])*1.55; });
  const gp=new THREE.BufferGeometry(); gp.setAttribute('position',new THREE.BufferAttribute(cab,3));
  pontos=new THREE.Points(gp, aditivo(new THREE.PointsMaterial({ map:TEX_AMARELA, size:3.2, sizeAttenuation:true, color:0xffffff })));
  pontos.frustumCulled=false; luzes.add(pontos);
  poças=new THREE.InstancedMesh(new THREE.PlaneGeometry(13,13).rotateX(-Math.PI/2), aditivo(new THREE.MeshBasicMaterial({ map:texBrilho(255,200,130,2.2), color:0x000000 })), lista.length);
  lista.forEach((p,j)=>{ poças.setMatrixAt(j,M.compose(V.set(cab[j*3],0.06,cab[j*3+2]),Q.identity(),S)); });
  poças.computeBoundingSphere(); poças.frustumCulled=false; luzes.add(poças);
  return lista.length;
}

// janelas acesas: cópia das paredes dos prédios com uma textura de janelas (algumas acesas),
// desenhada na cena das luzes. A textura cobre 8×6 janelas para não acender todas iguais.
const COLS=8, ANDARES=6;
function texJanelas(){
  const W=COLS*32, H=ANDARES*32, cv=document.createElement('canvas'); cv.width=W; cv.height=H; const k=cv.getContext('2d');
  k.fillStyle='#000'; k.fillRect(0,0,W,H);
  for(let c=0;c<COLS;c++) for(let a=0;a<ANDARES;a++){ if(Math.random()>0.42) continue;
    const quente=Math.random()<0.75, x0=c*32+32*0.85/3, x1=c*32+32*2.15/3, y1=H-a*32-32*0.95/3.2, y0=H-a*32-32*2.15/3.2;
    k.fillStyle=quente?`rgb(255,${190+Math.random()*40|0},${110+Math.random()*40|0})`:`rgb(${170+Math.random()*40|0},${200+Math.random()*30|0},255)`;
    k.globalAlpha=0.55+Math.random()*0.45; k.fillRect(x0,y0,x1-x0,y1-y0); k.globalAlpha=1; }
  const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.repeat.set(1/(3*COLS),-1/(3.2*ANDARES)); t.offset.set(0,1/(3.2*ANDARES)); t.magFilter=THREE.NearestFilter; return t;
}
const matJanelas = aditivo(new THREE.MeshBasicMaterial({ map:texJanelas(), color:0x000000, depthFunc:THREE.LessEqualDepth, polygonOffset:true, polygonOffsetFactor:-1, polygonOffsetUnits:-1 }));
const janelas=[];   // uma malha por quadra; só as perto da câmera vão para a tela (longe a neblina esconde)
export function acenderJanelas(geometrias){ for(const g of geometrias){ const m=new THREE.Mesh(g,matJanelas); luzes.add(m); janelas.push(m); } }
function janelasPerto(){ const c=camera.position;
  for(const m of janelas){ const s=m.geometry.boundingSphere; m.visible=s.center.distanceTo(c)<420+s.radius; } }

// estrelas: pontinhos numa cúpula longe (somem atrás dos prédios pela profundidade)
const estrelas = (()=>{ const n=900, p=new Float32Array(n*3);
  for(let i=0;i<n;i++){ const az=Math.random()*Math.PI*2, el=0.12+Math.acos(1-Math.random())*0.9, r=2600;
    p[i*3]=Math.cos(az)*Math.cos(el)*r; p[i*3+1]=Math.sin(el)*r; p[i*3+2]=Math.sin(az)*Math.cos(el)*r; }
  const g=new THREE.BufferGeometry(); g.setAttribute('position',new THREE.BufferAttribute(p,3));
  const o=new THREE.Points(g, aditivo(new THREE.PointsMaterial({ color:0x000000, size:2.2, sizeAttenuation:false })));
  o.frustumCulled=false; luzes.add(o); return o; })();

// faróis: 2 brancos na frente + 2 vermelhos atrás por veículo, e o facho no chão
const MAXV=32;
const farolPos=new Float32Array(MAXV*2*3), lanternaPos=new Float32Array(MAXV*2*3);
const gF=new THREE.BufferGeometry(); gF.setAttribute('position',new THREE.BufferAttribute(farolPos,3));
const gL=new THREE.BufferGeometry(); gL.setAttribute('position',new THREE.BufferAttribute(lanternaPos,3));
const farois=new THREE.Points(gF, aditivo(new THREE.PointsMaterial({ map:TEX_BRANCA, size:1.6, color:0x000000 })));
const lanternas=new THREE.Points(gL, aditivo(new THREE.PointsMaterial({ map:TEX_VERMELHA, size:0.9, color:0x000000 })));
const fachos=new THREE.InstancedMesh(new THREE.PlaneGeometry(5,13).rotateX(-Math.PI/2).translate(0,0,-6.5),
  aditivo(new THREE.MeshBasicMaterial({ map:(()=>{ const cv=document.createElement('canvas'); cv.width=32; cv.height=64; const k=cv.getContext('2d');
    const g=k.createLinearGradient(0,64,0,0); g.addColorStop(0,'rgba(255,245,215,.9)'); g.addColorStop(1,'rgba(255,245,215,0)'); k.fillStyle=g;
    k.beginPath(); k.moveTo(11,64); k.lineTo(21,64); k.lineTo(32,0); k.lineTo(0,0); k.fill(); const t=new THREE.CanvasTexture(cv); t.colorSpace=THREE.SRGBColorSpace; return t; })(), color:0x000000 })), MAXV);
for(const o of [farois,lanternas,fachos]){ o.frustumCulled=false; luzes.add(o); }
const Mf=new THREE.Matrix4(), Qf=new THREE.Quaternion(), Vf=new THREE.Vector3(), Sf=new THREE.Vector3(1,1,1), Yf=new THREE.Vector3(0,1,0);
// veiculos: [[x,z,ry,meio,larg]] (ry: o modelo olha para −Z)
function atualizarFarois(veiculos){
  let n=0;
  for(const [x,z,ry,meio=2.2,larg=0.9] of veiculos){ if(n>=MAXV) break;
    const fx=-Math.sin(ry), fz=-Math.cos(ry), lx=fz, lz=-fx, a=meio*0.96, l=larg*0.7;
    for(const s of [-1,1]){ const j=(n*2+(s>0?1:0))*3;
      farolPos[j]=x+fx*a+lx*l*s; farolPos[j+1]=0.75; farolPos[j+2]=z+fz*a+lz*l*s;
      lanternaPos[j]=x-fx*a+lx*l*s; lanternaPos[j+1]=0.85; lanternaPos[j+2]=z-fz*a+lz*l*s; }
    Qf.setFromAxisAngle(Yf,ry); fachos.setMatrixAt(n,Mf.compose(Vf.set(x+fx*a,0.07,z+fz*a),Qf,Sf)); n++; }
  gF.setDrawRange(0,n*2); gL.setDrawRange(0,n*2); fachos.count=n;
  gF.attributes.position.needsUpdate=true; gL.attributes.position.needsUpdate=true; fachos.instanceMatrix.needsUpdate=true;
}

// luzes de quem quiser (negócios dos jogadores): malhas somadas à noite, com força própria
const extras=[];
export const TEX_QUENTE=texBrilho(255,205,140,2.2);
export function luzExtra(geo,{map=null,cor=0xffffff,forca=1}={}){
  const m=aditivo(new THREE.MeshBasicMaterial({map,color:0x000000,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}));
  m.userData={cor:new THREE.Color(cor),forca}; extras.push(m); return new THREE.Mesh(geo,m);
}
export function porLuz(grupo){ luzes.add(grupo);
  return ()=>{ luzes.remove(grupo); grupo.traverse(o=>{ const i=extras.indexOf(o.material); if(i>=0) extras.splice(i,1); }); }; }
export function iniciarCeu(){ return construirPostes(); }

// chamado no lugar de renderer.render(scene,camera)
// à noite o filtro escurece tudo por igual; o jogador (e o veículo dele) é desenhado de novo por cima,
// com a luz só um pouco reduzida, para não virar um vulto. Usa a camada 1 do three (as luzes também).
let luzesCena=null;
function realcar(objs){
  luzesCena ??= scene.children.filter(o=>o.isLight).map(l=>{ l.layers.enable(1); return [l,l.intensity]; });
  for(const o of objs) if(o&&o.visible) o.traverse(x=>x.layers.enable(1));
  const k=1-0.5*noite; for(const [l,i] of luzesCena) l.intensity=i*k;
  const fundo=scene.background; scene.background=null;                          // com fundo, o three limparia a tela inteira
  camera.layers.set(1); renderer.render(scene,camera); camera.layers.set(0); scene.background=fundo;
  for(const [l,i] of luzesCena) l.intensity=i;
}
export function desenhar(veiculos, destaques=[]){
  amostrar(horaJogo());
  renderer.render(scene,camera);
  if(tinta.r>0.995&&tinta.g>0.995&&tinta.b>0.995) return;   // dia: nada a fazer
  const ac=renderer.autoClear; renderer.autoClear=false;
  matTela.color.copy(tinta); renderer.render(telaCena,camTela);
  if(noite>0.15&&destaques.length) realcar(destaques);
  if(noite>0.01){
    const k=noite;
    if(pontos){ pontos.material.color.setScalar(k); poças.material.color.setRGB(0.55*k,0.5*k,0.42*k); }
    matJanelas.color.setScalar(0.85*k);
    estrelas.material.color.setScalar(0.8*Math.max(0,k-0.4)/0.6);
    farois.material.color.setScalar(k); lanternas.material.color.setScalar(k); fachos.material.color.setScalar(0.45*k);
    atualizarFarois(veiculos); janelasPerto();
    for(const m of extras) m.color.copy(m.userData.cor).multiplyScalar(m.userData.forca*k);
    renderer.render(luzes,camera);
  }
  renderer.autoClear=ac;
}
