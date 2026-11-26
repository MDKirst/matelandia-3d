// Ponto de entrada: monta o mundo e roda o loop
import * as THREE from 'three';
import { carregarRelevo, altura } from './relevo.js';
import { nuvem } from './nuvem.js';   // primeiro: muda os shaders antes de qualquer desenho
import { scene, camera, renderer, base, $ } from './cena.js';
import { toLL, toXZ, LX0, LZ0, LX1, LZ1 } from './geo.js';
import { ANDAR, CORRER } from './config.js';
import { satelite } from './satelite.js';
import { ruas, predios, carregarCidade, status } from './cidade.js';
import { jogador, suporte, av, animar, animarGolpe } from './avatar.js';
import { tecla, cam, toque, pedido } from './controles.js';
import { bloqueado, ruaMaisProxima, pontoLivre, somarBloqueio } from './mundo.js';
import { aterro, atualizarNivel, alturaNivel, perfil, bloqueioAterro } from './aterro.js';
import { carregarPredios, atualizarTelhados } from './predios.js';
import { construirMarcos } from './marcos.js';
import { carregarLojas } from './lojas.js';
import { construirDetalhes, alturaLombada } from './detalhes.js';
import { iniciarPedestres, atualizarPedestres, posicoesPedestres } from './pedestres.js';
import { iniciarGangues, atualizarGangues, golpearGangue, obstaculosGangues } from './gangues.js';
import { home, pronto, progresso } from './home.js';
import { atualizarEfeitos } from './efeitos.js';
import { danificar, efeitosVeiculos } from './veiculos.js';
import { baterNoCarro } from './transito.js';
import { quandoAtropelar, interagir, pedestrePerto, atualizarBaloes, quantosSeguem, pedestresDePe } from './pedestres.js';
import { posicoesAnimais, cavaloPerto, montar, desmontar, animarMontaria } from './animais.js';
import { iniciarPolicia, atualizarPolicia, crime, posicoesPolicia } from './policia.js';
import { somBatida, somExplosao, somPancada, somSirene, somMundo, somTiro } from './som.js';
import { desenharTiro, bocaDaArma, atualizarTiros } from './tiro.js';
import { ganhar as pagar, fmt } from './terrenos.js';
import { iniciarTerrenos, comprar, alternarObra, dicaTerreno, obra, lotesMeus, terrenosNoMapa, avisarTerreno, sairObra } from './terrenos.js';
import { alternarCorrida, atualizarCorrida, alvoCorrida } from './entregas.js';
import { entrarOnline, sairOnline, enviarEstado, atualizarOnline, posicoesJogadores, golpearJogador, quandoApanhar } from './online.js';
import { vida, golpe, golpear, atualizarLuta, levarPancada, poseGolpe, DUR, DANO, quandoAcordar } from './luta.js';
import { golpearPedestre } from './pedestres.js';
import { golpearCao } from './caes.js';
addEventListener('matelandia:comecar',e=>{ if(!alvoCorrida()) comecar(e.detail, jogador.position.x, jogador.position.z); });
addEventListener('matelandia:jogar',e=>{ const d=e.detail; if(d.online) entrarOnline(d.nome,d.personagem); else sairOnline(); setTimeout(()=>conquista('boas_vindas'),1500); });
import { minimapa } from './minimapa.js';
import { gps, atualizarGPS, fonteMapa, desenharMapa } from './mapa.js';
import { pontosNegocios } from './negocios.js';
import { casas as todasCasas } from './casas.js';
import { iniciarCasas, dicaCasa, comprarCasa, casa, cenaCasa, bloqueioCasa, entrarCasa, usarEmCasa, casasNoMapa } from './casas.js';
import { construirCampos } from './campos.js';
import { sentar, descer, girarRodas } from './moto.js';
import { iniciarCeu, desenhar, horaJogo, relogioTxt, quantoNoite, postes, posteEm } from './ceu.js';
import { iniciarCriancas, atualizarCriancas, bateNaCrianca, posicoesCriancas, bikePerto, tomarBike } from './criancas.js';
import { iniciarEspeciais, atualizarEspeciais, pontosEspeciais } from './especiais.js';
import { iniciarPublicos } from './publicos.js';
import { lotes as todosLotes } from './terrenos.js';
import { ganhar as conquista, contar, colecionar } from './conquistas.js';
import { pedirFoto, talvezFotografar } from './foto.js';
import { policia } from './policia.js';
import { trabalho, comecar, atualizarTrabalho, abrirTrabalhos } from './trabalhos.js';
import { iniciarJornal, noticiar } from './jornal.js';
import { revolta, quandoTurmaBater } from './pedestres.js';
import { lojaAqui, abrirBalcao } from './negocios.js';
import { carroDaRuaPerto, tirarDoTransito } from './transito.js';
import { perdoar } from './policia.js';
import { iniciarNegocios, atualizarNegocios, acaoNegocio, pertoDeNegocioMeu } from './negocios.js';
import { frota, iniciarVeiculos, veiculoPerto, entrar, sair, dirigir, dentroDeVeiculo, frente, esquerda } from './veiculos.js';
import * as veic from './veiculos.js';
import { iniciarTransito, atualizarTransito, posicoesTransito, carros } from './transito.js';
import { efeitosVelocidade } from './velocidade.js';
import { cameraFrontal } from './camfrontal.js';

// borda visível do mundo
{ const m=new THREE.MeshBasicMaterial({color:0xF97316,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}), H=45;
  const muro=(cx,cz,l,gira)=>{ const w=new THREE.Mesh(new THREE.PlaneGeometry(l,H),m); w.position.set(cx,H/2,cz); if(gira) w.rotation.y=Math.PI/2; scene.add(w); };
  muro((LX0+LX1)/2,LZ0,LX1-LX0,false); muro((LX0+LX1)/2,LZ1,LX1-LX0,false); muro(LX0,(LZ0+LZ1)/2,LZ1-LZ0,true); muro(LX1,(LZ0+LZ1)/2,LZ1-LZ0,true); }

// a pé: prédio, veículo estacionado ou carro do trânsito (antes o avatar entrava no carro)
// 23/11: o corpo tem largura (anel de 9 pontos, raio 0,28 m) — antes só o centro testava e meio boneco entrava na
// parede/no carro (e a câmera via através). Pedestres de pé e cavalos também são sólidos.
// As listas que mudam a cada quadro (trânsito, polícia, gente, cavalos) são lidas uma vez por quadro em aPe().
let obst={ transito:[], gente:[], cavalos:[] };
// BR em aterro nas trincheiras (aterro.js): o jogador está em cima (na BR alta) ou embaixo (chão/passagem)
somarBloqueio(bloqueioAterro);
const nivel={ alto:false };
const jogAlto=(x,z)=>nivel.alto&&perfil(x,z)>1.2;         // em cima de verdade (não só na BR no chão)
function lerObstaculos(){
  const p=jogador.position, eu=jogAlto(p.x,p.z);
  obst.transito=[...posicoesTransito(),...posicoesPolicia()].filter(o=>!!o[5]===eu);   // carro do outro nível (em cima/embaixo) não conta
  obst.gente=eu?[]:pedestresDePe();
  obst.cavalos=eu?[]:posicoesAnimais().filter(b=>b[2]==='cavalo');
}
function dentroDoTransito(x,z,folga=0.3,lista=obst.transito){
  for(const [tx,tz,ry,meio=2.2,larg=1.1] of lista){ const dx=x-tx, dz=z-tz; if(Math.abs(dx)>10||Math.abs(dz)>10) continue;
    const fx=-Math.sin(ry), fz=-Math.cos(ry); if(Math.abs(dx*fx+dz*fz)<meio+folga && Math.abs(-dx*fz+dz*fx)<larg+folga) return true; }
  return false;
}
const pontoTravado=(x,z)=>bloqueado(x,z)||posteEm(x,z,0.18)||dentroDeVeiculo(x,z,0.05)||dentroDoTransito(x,z,0.05)
  ||obst.gente.some(([gx,gz])=>Math.abs(gx-x)<0.3&&Math.abs(gz-z)<0.3&&Math.hypot(gx-x,gz-z)<0.3)
  ||obst.cavalos.some(([bx,bz])=>Math.abs(bx-x)<0.9&&Math.abs(bz-z)<0.9&&Math.hypot(bx-x,bz-z)<0.9);
const R_CORPO=0.28, ANEL=[[0,0],...Array.from({length:8},(_,i)=>[Math.sin(i*Math.PI/4)*R_CORPO,Math.cos(i*Math.PI/4)*R_CORPO])];
// quantos pontos do corpo estão dentro de algo (0 = livre)
const batidas=(x,z)=>casa.dentro?(bloqueioCasa(x,z)?1:0):ANEL.reduce((n,[a,b])=>n+(pontoTravado(x+a,z+b)?1:0),0);   // em casa: só paredes e móveis
const travado=(x,z)=>batidas(x,z)>0;
// já dentro de algo (carro parou em cima, bloco posto no pé): só aceita passo que tira o corpo de dentro;
// muito dentro, sai sozinho para o lugar livre mais perto
function pertoLivre(x,z){
  for(let r=0.3;r<=4;r+=0.3) for(let a=0;a<16;a++){ const px=x+Math.sin(a/16*Math.PI*2)*r, pz=z+Math.cos(a/16*Math.PI*2)*r; if(!travado(px,pz)) return [px,pz]; }
  return null;
}

// carro do trânsito na frente do veículo do jogador?
// (se já estão encostados, deixa se afastar: senão o veículo travava para sempre)
function bateNoTransito(c,x,z,h){
  const p=c.obj.position, eu=jogAlto(p.x,p.z);
  for(const [tx,tz,,meio=2.2,larg=1.1,alto] of [...posicoesTransito(),...posicoesPolicia()]){
    if(!!alto!==eu) continue;                                                       // em cima/embaixo da trincheira
    const enc=(px,pz,ph)=>{ const [fx,fz]=frente(ph), [ex,ez]=esquerda(ph), dx=tx-px, dz=tz-pz;
      return Math.abs(dx*fx+dz*fz)<c.comp/2+meio-0.1 && Math.abs(dx*ex+dz*ez)<c.larg/2+larg; };
    if(!enc(x,z,h)) continue;
    if(enc(p.x,p.z,c.h) && Math.hypot(tx-x,tz-z)>=Math.hypot(tx-p.x,tz-p.z)) continue;   // saindo de perto
    return true; }
  return false;
}

// cavalo no caminho do veículo do jogador (23/11: "carros colidem com outros itens"): para como num carro
function bateNoCavalo(c,x,z,h){
  const p=c.obj.position, [fx,fz]=frente(h), [ex,ez]=esquerda(h);
  for(const [bx,bz,esp] of posicoesAnimais()){ if(esp!=='cavalo') continue; const dx=bx-x, dz=bz-z; if(Math.abs(dx)>8||Math.abs(dz)>8) continue;
    if(Math.abs(dx*fx+dz*fz)<c.comp/2+0.9&&Math.abs(dx*ex+dz*ez)<c.larg/2+0.5&&Math.hypot(bx-x,bz-z)<Math.hypot(bx-p.x,bz-p.z)) return true; }
  return false;
}
let lugaresCache=[], gesto=0, estadoAPe='parado', camRua=[9,0.42];
const TOQUE=matchMedia('(pointer:coarse)').matches;
// celular: os botões do painel sem as teclas do teclado ("Foto (P)" → "Foto")
if(TOQUE) for(const b of document.querySelectorAll('#btns button')) b.textContent=b.textContent.replace(/\s*\([^)]*\)\s*$/,'');
// pulo (17/11, pedido do Maicon): Espaço a pé (no carro o Espaço continua sendo o freio de mão)
const pulo={ y:0, v:0, antes:false };
const relogio=new THREE.Clock(), alvo=new THREE.Vector3(); let rumo=0, tLento=0, passo=0, ruaAtual='', orbita=0.6;
function aPe(dt){
  let ix=(tecla.KeyD||tecla.ArrowRight?1:0)-(tecla.KeyA||tecla.ArrowLeft?1:0);
  let iy=(tecla.KeyW||tecla.ArrowUp?1:0)-(tecla.KeyS||tecla.ArrowDown?1:0);
  let correndo=tecla.ShiftLeft||tecla.ShiftRight;
  if(toque.joy){ ix=toque.joy.x; iy=-toque.joy.y; if(Math.hypot(ix,iy)>0.92) correndo=true; }
  if(vida.caido>0||golpe.tipo||detido>0||policia.cena){ ix=0; iy=0; }           // desmaiado, no meio do golpe ou sendo preso: parado
  const forca=Math.min(1,Math.hypot(ix,iy)); let estado='parado';
  { const quer=(tecla.Space&&!pulo.antes)||pedido.pulo; pulo.antes=!!tecla.Space; pedido.pulo=false;
    if(quer&&pulo.y===0&&vida.caido<=0&&!golpe.tipo&&detido<=0&&!casa.dentro) pulo.v=5.4;           // ~1 m de altura
    if(pulo.v||pulo.y){ pulo.v-=15*dt; pulo.y=Math.max(0,pulo.y+pulo.v*dt); if(pulo.y===0) pulo.v=0; } }
  const p=jogador.position;
  lerObstaculos(); aterro.cima=nivel.alto;                                   // a colisão pergunta do nível do jogador
  const n0=batidas(p.x,p.z), pode=(x,z)=>{ const n=batidas(x,z); return n===0||n<n0; };
  if(n0>=4&&!casa.dentro){ const l=pertoLivre(p.x,p.z); if(l){ p.x=l[0]; p.z=l[1]; } }
  if(vida.empurra){ const [ex,ez]=vida.empurra; vida.empurra=null; if(!travado(p.x+ex,p.z+ez)){ p.x+=ex; p.z+=ez; } }
  if(forca>0.12){
    const {yaw}=cam;
    const vx=(-Math.sin(yaw)*iy+Math.cos(yaw)*ix), vz=(-Math.cos(yaw)*iy-Math.sin(yaw)*ix), l=Math.hypot(vx,vz);
    const vel=(correndo?CORRER*(efeito.corrida>0?1.35:1):ANDAR)*forca*dt, dx=vx/l*vel, dz=vz/l*vel;
    if(pode(p.x+dx,p.z+dz)){ p.x+=dx; p.z+=dz; }                       // livre (ou saindo de dentro de algo)
    else if(pode(p.x+dx,p.z)) p.x+=dx;                                   // senão desliza na parede
    else if(pode(p.x,p.z+dz)) p.z+=dz;
    const a=Math.atan2(vx,vz); let d=a-rumo; d=Math.atan2(Math.sin(d),Math.cos(d)); rumo+=d*Math.min(1,dt*10);
    estado=correndo?'correr':'andar'; passo+=dt*(correndo?13:8);
  }
  if(policia.cena?.andando){ estado='andar'; passo+=dt*8; rumo=policia.cena.rumo; }  // algemado, levado até o camburão
  p.x=Math.max(LX0+3,Math.min(LX1-3,p.x)); p.z=Math.max(LZ0+3,Math.min(LZ1-3,p.z));
  aterro.cima=false; atualizarNivel(nivel,p.x,p.z); p.y=alturaNivel(nivel,p.x,p.z);   // em cima da BR alta: sobe junto
  jogador.rotation.y=rumo; suporte.rotation.order='YXZ'; suporte.rotation.y=av.giroExtra;
  suporte.rotation.x=-vida.queda*Math.PI/2; suporte.position.y=vida.queda*0.12+pulo.y;   // pulando sobe; desmaiado: deitado de costas
  if(gesto>0){ gesto-=dt; if(estado==='parado') estado='acenar'; }       // acenando para alguém
  estadoAPe=estado;
  animar(estado); if(av.mixer) av.mixer.update(dt);
  if(golpe.tipo&&!animarGolpe(golpe.tipo, golpe.seq)) poseGolpe(suporte, golpe.tipo, golpe.t/DUR[golpe.tipo], Math.sin(rumo), Math.cos(rumo));
  if(av.boneco){ const s=estado==='parado'?0:Math.sin(passo)*(estado==='correr'?0.9:0.55), q=av.boneco.userData.partes;
    q[0].rotation.x=s; q[1].rotation.x=-s; q[2].rotation.x=-s; q[3].rotation.x=s; }
}

let distAPe=cam.dist, volante=0;
// empinar (23/11, pedido do Maicon): na moto, dois toques rápidos no acelerar (W/↑ ou joystick para cima) levantam a
// roda da frente enquanto segura o acelerar; gira em volta da roda de trás. Solta, freia, vira muito ou passa de 4 s: desce.
const EMPINA_MAX=0.5, EMPINA_DURA=4;
const empina={ ang:0, ativo:false, t:0 };
function atualizarEmpina(dt,c,acel,giro){
  const apertou=acel>0.5;
  if(pedido.empinar){                                                          // toque duplo (controles.js); velho = era de antes de subir na moto
    if(c.tipo.moto&&performance.now()/1000-pedido.empinar<2&&c.v>-0.5){ empina.ativo=true; empina.t=0; if(!empina.aviso){ empina.aviso=1; avisarTerreno('🏍️ Empinou! Segure o acelerar'); } }
    pedido.empinar=0; }
  empina.t+=dt;
  if(!c.tipo.moto||!apertou||tecla.Space||Math.abs(giro)>0.8||empina.t>EMPINA_DURA||c.quebrado) empina.ativo=false;
  const alvoA=empina.ativo?EMPINA_MAX*(0.85+0.15*Math.sin(empina.t*3)):0;       // balança um pouco lá em cima
  empina.ang+=(alvoA-empina.ang)*Math.min(1,dt*(empina.ativo?4:6));
  if(empina.ang<0.002) empina.ang=0;
  if(empina.ang>0.25) conquista('empinou');
}
function aoVolante(dt){
  const c=veic.dirigindo;
  let acel=(tecla.KeyW||tecla.ArrowUp?1:0)-(tecla.KeyS||tecla.ArrowDown?1:0);
  let giro=(tecla.KeyA||tecla.ArrowLeft?1:0)-(tecla.KeyD||tecla.ArrowRight?1:0);
  if(toque.joy){ acel=-toque.joy.y; giro=-toque.joy.x; }
  else { const d=giro-volante, k=(Math.sign(d)!==Math.sign(volante)&&volante!==0?7:3.2)*dt;   // teclado: o volante gira aos poucos e volta mais rápido
    volante+=Math.max(-k,Math.min(k,d)); giro=volante; }
  const v0=Math.abs(c.v);
  let crianca=null;
  aterro.cima=nivel.alto; const emCima=jogAlto(c.obj.position.x,c.obj.position.z);
  const bateu=dirigir(dt, acel, giro, tecla.Space, (c,x,z,h)=>bateNoTransito(c,x,z,h)||(!emCima&&(bateNoCavalo(c,x,z,h)||!!(crianca=bateNaCrianca(c,x,z,h)))));
  aterro.cima=false; atualizarNivel(nivel,c.obj.position.x,c.obj.position.z);
  if(bateu && v0>4){            // bateu: estraga o veículo
    if(crianca&&v0>6) crime(1,'Atropelamento');
    const inteiro=!c.quebrado; danificar(c,v0); somBatida(v0); if(inteiro&&c.quebrado) somExplosao();
    const [fx,fz]=frente(c.h), q=c.obj.position, alvoT=baterNoCarro(q.x+fx*c.comp*0.6,q.z+fz*c.comp*0.6,v0);
    if(alvoT&&v0>9) crime(1,'Batida');
  }
  { const [fx,fz]=frente(c.h), a=c.comp*0.45, q=c.obj.position;                      // ladeira: subida segura, descida embala
    const inc=(altura(q.x+fx*a,q.z+fz*a)-altura(q.x-fx*a,q.z-fz*a))/(2*a);
    if(!tecla.Space) c.v-=9.8*Math.max(-0.35,Math.min(0.35,inc))*dt*0.55; }
  const p=c.obj.position; jogador.position.set(p.x,0,p.z); rumo=c.h+Math.PI;
  if(c.tipo.moto){ girarRodas(c,dt);                                                    // moto: inclina na curva e o piloto vai junto
    c.obj.rotation.z=THREE.MathUtils.lerp(c.obj.rotation.z, giro*Math.min(1,Math.abs(c.v)/10)*(0.32+0.18*Math.min(1,Math.abs(c.v)/25))*Math.sign(c.v||1), Math.min(1,dt*5)); }
  // quebra-mola: eixo da frente e de trás sobem; quanto mais rápido, maior o pulo
  { const [fx,fz]=frente(c.h), a=c.comp*0.35, yf=alturaLombada(p.x+fx*a,p.z+fz*a), yt=alturaLombada(p.x-fx*a,p.z-fz*a), k=1+Math.max(0,Math.abs(c.v)-6)*0.25;
    p.y=(yf+yt)/2*k; c.obj.rotation.x=Math.atan2((yf-yt)*k,c.comp);
    if(nivel.alto){ const hf=perfil(p.x+fx*a,p.z+fz*a), ht=perfil(p.x-fx*a,p.z-fz*a);    // na rampa do aterro: sobe e inclina
      p.y+=perfil(p.x,p.z); c.obj.rotation.x+=Math.atan2(hf-ht,2*a); } }
  c.alto=nivel.alto;
  atualizarEmpina(dt,c,acel,giro);
  if(empina.ang>0){ const r=c.comp*0.36;                                          // gira em volta da roda de trás (frente = -Z, trás = +Z)
    c.obj.rotation.x+=empina.ang; p.y+=r*Math.sin(empina.ang); }
  if(c.montaria) animarMontaria(c.bicho,c.v,dt);
  if(c.tipo.moto) sentar(jogador,c.obj,false,c.assento);                                      // piloto no banco (anda e inclina com a moto)
  // câmera vem para trás do veículo quando ele anda (parado, dá para olhar em volta)
  if(Math.abs(c.v)>0.6){ let d=c.h-cam.yaw; d=Math.atan2(Math.sin(d),Math.cos(d)); cam.yaw+=d*Math.min(1,dt*2.5); }
  cam.dist+= (c.tipo.cam-cam.dist)*Math.min(1,dt*3);
  const s=document.createElement('small'); s.textContent=' km/h · '+c.tipo.nome+(c.quebrado?' · QUEBRADO':c.dano>0?` · motor ${Math.round(100-c.dano)}%`:'')+(veic.reforco.turbo>0?' · 🚀 turbo':'');
  $('velo').replaceChildren(String(Math.round(Math.abs(c.v)*3.6)), s);
  if(Math.abs(c.v)*3.6>100) conquista('veloz');
  efeitosVelocidade(dt,c,(acel<0&&c.v>1)||!!tecla.Space,giro);   // FOV, vento, tremida e fumaça de pneu
}

// preso: desce do veículo e aparece na frente do posto da PM
function prender(posto){
  if(veic.dirigindo){ sair(); jogador.visible=true; cam.dist=distAPe; $('velo').style.display='none'; }
  const [x,z]=pontoLivre(posto[0]+6,posto[1]+6); jogador.position.set(x,0,z);
  pagar(-500);                                                              // multa (o saldo não fica negativo)
  detido=15; rumo=Math.atan2(x-posto[0],z-posto[1]);                       // fica detido na frente da delegacia, depois é liberado
}
let detido=0;
function cumprirPena(dt){
  if(detido<=0) return false;
  detido-=dt; const a=$('aviso'); a.style.opacity=1;
  a.textContent=detido>0?`🚔 Detido na delegacia: ${Math.ceil(detido)} s`:'Liberado! Comporte-se 😉';
  if(detido<=0) setTimeout(()=>{ if(!(detido>0)) a.style.opacity=0; },2500);
  return detido>0;
}
// o que o mapa grande mostra (pontos fixos dos lugares públicos + negócios e casa dos jogadores)
fonteMapa(()=>{ const pts=[...pontosNegocios(),...pontosEspeciais()];
  for(const l of lugaresCache){ const t=(l.cat||'')+' '+l.n; const tipo=/hospital/i.test(t)?'hospital':/police|pol[ií]cia|\bPM\b/i.test(t)?'policia':null; if(!tipo) continue;
    const [x,z]=toXZ(l.lat,l.lon); pts.push({x,z,ic:tipo==='hospital'?'🏥':'🚔',nome:l.n,tipo}); }
  for(const c of todasCasas) if(c.dono&&c.dono===nuvem.uid) pts.push({x:(c.porta||[c.cx,c.cz])[0],z:(c.porta||[c.cx,c.cz])[1],ic:'🏡',nome:'Minha casa',tipo:'minhaCasa'});
  return { jogador:[jogador.position.x,jogador.position.z], rumo, pontos:pts, terrenos:terrenosNoMapa(), casas:casasNoMapa() }; });
// desmaiou: acorda no hospital mais perto e paga a conta (como no GTA)
quandoAcordar(()=>{
  if(veic.dirigindo||casa.dentro) return;
  const hs=lugaresCache.filter(l=>/hospital/i.test((l.cat||'')+' '+l.n)).map(l=>toXZ(l.lat,l.lon)); if(!hs.length) return;
  const p=jogador.position, h=hs.reduce((a,b)=>Math.hypot(a[0]-p.x,a[1]-p.z)<Math.hypot(b[0]-p.x,b[1]-p.z)?a:b);
  const [x,z]=pontoLivre(h[0]+6,h[1]+6); p.set(x,0,z); pagar(-150);
  avisarTerreno('🏥 Você acordou no hospital · conta de M$ 150');
});
quandoAtropelar((x,z,k,morto)=>{ somPancada(); crime(morto?2:1,morto?'Atropelamento grave':'Atropelamento'); revolta(jogador.position.x,jogador.position.z); });
// avacalhar: nocaute ou 2 pancadas em 20 s → a turma junta e bate (até desmaiar)
let pancadas=[];
quandoTurmaBater((dano,fx,fz)=>{ if(veic.dirigindo) return false; if(levarPancada(dano,fx,fz)) somPancada(); return vida.caido>0; },
  ()=>{ noticiar('surra'); dispatchEvent(new Event('matelandia:surra')); });

// soco/chute no meio do golpe: acerta pedestre ou outro jogador logo à frente
function acertar(tipo){
  const p=jogador.position, fx=Math.sin(rumo), fz=Math.cos(rumo);
  if(tipo==='tiro'){ desenharTiro(bocaDaArma(suporte,fx,fz),fx,fz); somTiro(3); }
  const ped=golpearPedestre(p.x,p.z,fx,fz,tipo), jog=golpearJogador(p.x,p.z,fx,fz,tipo,DANO[tipo]), gan=golpearGangue(p.x,p.z,fx,fz,tipo);
  const cao=!ped&&!jog&&!gan&&golpearCao(p.x,p.z,fx,fz,tipo);           // chutou o cachorro: o bando vem (caes.js)
  if((ped||jog||gan||cao)&&tipo!=='tiro') somPancada();
  if(tipo==='tiro'&&(ped||jog)) crime(ped==='nocaute'?2:1, ped?'Tiro em pedestre':'Tiro em jogador');
  else if(ped==='nocaute') crime(1,'Agressão');
  if(ped){ const t=performance.now(); pancadas=pancadas.filter(x=>t-x<20000); pancadas.push(t);
    if(ped==='nocaute'||pancadas.length>=2){ pancadas=[]; revolta(p.x,p.z); } }
}
addEventListener('matelandia:bando',e=>avisarTerreno(`🐕 Mexeu com o cachorro: vieram ${e.detail.n}! Corre ou entra num carro`));
quandoApanhar((dano,fx,fz)=>{ if(veic.dirigindo) return; if(levarPancada(dano,fx,fz)) somPancada(); }, ()=>[jogador.position.x,jogador.position.z]);

// 🛒 produtos do balcão (negocios.js PRODUTOS): devolve texto de erro (não cobra) ou '' quando aplicou
const efeito={ corrida:0, ultimo:null };
function aplicarProduto(ef){
  if(ef.conserto){ const c=efeito.ultimo&&frota.includes(efeito.ultimo)?efeito.ultimo:null;
    if(!c) return 'Dirija um veículo antes: o conserto é no último que você usou';
    if(c.dano<=0&&!c.quebrado) return `${c.tipo.nome} já está inteiro`;
    if(ef.conserto==='leve'){ if(c.quebrado||c.dano>40) return 'Lavagem não resolve: precisa do conserto'; veic.consertar(c); return ''; }
    veic.consertar(c); return ''; }
  if(ef.turbo){ veic.reforco.turbo=Math.max(veic.reforco.turbo,ef.turbo); return ''; }
  if(ef.disfarce){ if(!perdoar()) return 'Ninguém está atrás de você: a roupa nova serve para despistar a polícia'; return ''; }
  const so=(ef.e||ef.cheia)&&!ef.corrida;
  if(so&&vida.e>=99.5) return 'Sua energia já está cheia';
  if(ef.cheia) vida.e=100; else if(ef.e) vida.e=Math.min(100,vida.e+ef.e);
  if(ef.corrida) efeito.corrida=Math.max(efeito.corrida,ef.corrida);
  return '';
}
function passarEfeitos(dt){
  if(efeito.corrida>0){ efeito.corrida-=dt; if(efeito.corrida<=0) avisarTerreno('👟 Acabou o efeito: correndo normal'); }
  if(veic.reforco.turbo>0){ veic.reforco.turbo-=dt; if(veic.reforco.turbo<=0) avisarTerreno('🚀 O turbo acabou'); }
}

function trocarVeiculo(){
  if(veic.dirigindo){
    aterro.cima=nivel.alto; const era=veic.dirigindo, [x,z,h]=sair(); aterro.cima=false; jogador.position.set(x,alturaNivel(nivel,x,z),z); jogador.visible=true; rumo=h-Math.PI/2;
    if(era.tipo.moto){ descer(jogador); era.obj.rotation.z=0.12; }
    if(era.montaria){ veic.liberar(era); desmontar(era.bicho); }                     // cavalo volta a pastar/passear
    cam.dist=distAPe;                                                              // câmera volta para perto (a pé)
    $('velo').style.display='none';
  } else {
    let c=veiculoPerto(jogador.position.x,jogador.position.z);
    const cv=!c&&cavaloPerto(jogador.position.x,jogador.position.z);
    if(cv){ c=veic.adotar({...montar(cv), arq:'montaria'}); avisarTerreno('🐎 Você montou no cavalo! E para descer'); }
    const bk=!c&&bikePerto(jogador.position.x,jogador.position.z);
    if(bk){ const r=tomarBike(bk); c=veic.adotar({...r, arq:'bike'}); crime(1,'Roubo de bike de criança'); }
    if(!c){ const t=carroDaRuaPerto(jogador.position.x,jogador.position.z); if(!t) return;          // carro da rua: o motorista desce e ele é seu
      const r=tirarDoTransito(t); c=veic.adotar(r);
      if(r.policia) crime(2,'Roubo de viatura'); else avisarTerreno(`🔑 Você pegou ${c.tipo.nome==='SUV'?'o':'a'} ${c.tipo.nome} da rua`); }
    efeito.ultimo=c;
    distAPe=cam.dist; entrar(c); pedido.empinar=0;   // toque duplo dado a pé não vale na moto jogador.visible=!!c.tipo.moto; animar('parado');
    if(c.tipo.moto){ c.obj.rotation.z=0; sentar(jogador,c.obj,true,c.assento); } conquista('motorista'); colecionar('frota','veic',c.tipo.id,5);
    $('velo').style.display='block';
  }
}

// 🏠 Meu terreno (L / botão): a pé vai direto para a calçada da frente; dirigindo, liga a seta até lá.
// Com vários terrenos, cada aperto vai para o próximo.
let idxCasa=-1, guiaCasa=null, alvoTrab=null;
function irAoTerreno(){
  const meus=terrenosNoMapa().meus;
  if(!meus.length){ avisarTerreno('Você ainda não tem terreno: ache uma placa VENDE-SE e aperte B'); return; }
  idxCasa=(idxCasa+1)%meus.length; const l=meus[idxCasa], qual=meus.length>1?` (${idxCasa+1} de ${meus.length})`:'';
  if(veic.dirigindo){ guiaCasa=l.id; avisarTerreno('Siga a seta até o seu terreno'+qual); return; }
  jogador.position.set(l.frente[0],0,l.frente[1]); rumo=Math.atan2(l.centro[0]-l.frente[0],l.centro[1]-l.frente[1]);
  cam.yaw=rumo+Math.PI; guiaCasa=null; avisarTerreno('🏠 Seu terreno'+qual+' · C para construir');
}
function atualizarGuia(px,pz){
  const g=$('guia'), l=guiaCasa&&terrenosNoMapa().meus.find(t=>t.id===guiaCasa);
  if(!l||home.aberta||alvoCorrida()){ g.style.display='none'; if(!l) guiaCasa=null; return; }
  const d=Math.hypot(l.centro[0]-px,l.centro[1]-pz);
  if(d<14){ guiaCasa=null; g.style.display='none'; avisarTerreno('🏠 Chegou no seu terreno'); return; }
  g.style.display='block'; $('guiaDist').textContent=`${Math.round(d)} m`;
  const fx=px-camera.position.x, fz=pz-camera.position.z, ang=Math.atan2(l.centro[0]-px,l.centro[1]-pz)-Math.atan2(fx,fz);
  $('guiaSeta').style.transform=`rotate(${-ang}rad)`;
}

function quadro(){
  requestAnimationFrame(quadro);
  const dt=Math.min(relogio.getDelta(),0.05);
  if(home.aberta){ pedido.usar=false; jogador.visible=false; }          // tela inicial: ninguém se mexe
  else { const preso=cumprirPena(dt); if(preso){ pedido.usar=false; pedido.golpe=null; pedido.casa=false; }
    if(pedido.usar){ pedido.usar=false;
      if(casa.dentro){ const r=usarEmCasa(jogador); if(r==='dormiu') vida.e=100; if(r==='saiu'){ cam.dist=camRua[0]; cam.pitch=camRua[1]; } }
      else if(!veic.dirigindo&&lojaAqui(jogador.position.x,jogador.position.z)) abrirBalcao(lojaAqui(jogador.position.x,jogador.position.z),aplicarProduto);   // balcão de qualquer negócio: comprar produtos
      else if(!veic.dirigindo&&!(policia.estrelas>0)&&entrarCasa(jogador,jogador.position.x,jogador.position.z)){ camRua=[cam.dist,cam.pitch]; cam.dist=7.5; cam.pitch=1.05; }
      else if(!(vida.caido>0)) trocarVeiculo(); }
    if(pedido.entrega){ pedido.entrega=false; if(trabalho.tipo) avisarTerreno('Termine o trabalho atual antes da entrega (O cancela)'); else alternarCorrida(veic.dirigindo); }
    if(pedido.trabalho){ pedido.trabalho=false; abrirTrabalhos(!!alvoCorrida()); }
    if(pedido.comprar){ pedido.comprar=false; if(!veic.dirigindo&&!casa.dentro){ const {x,z}=jogador.position; comprar(x,z).then(ok=>{ if(!ok) comprarCasa(x,z); }); } }
    if(pedido.obra){ pedido.obra=false; if(!veic.dirigindo) alternarObra(jogador.position.x,jogador.position.z); }
    if(pedido.casa){ pedido.casa=false; irAoTerreno(); }
    if(pedido.negocio){ pedido.negocio=false; if(veic.dirigindo) avisarTerreno('Desça do veículo para cuidar do negócio'); else { if(obra.ativa) sairObra(); acaoNegocio(jogador.position.x,jogador.position.z); } }
    if(pedido.foto){ pedido.foto=false; if(!obra.ativa){ pedirFoto((ruaAtual?ruaAtual+' · ':'')+relogioTxt(horaJogo())); } }
    if(pedido.acao){ const a=pedido.acao; pedido.acao=null;                     // T/G/H/X com um pedestre perto
      if(!veic.dirigindo){ const p=jogador.position, alvo=pedestrePerto(p.x,p.z);
        if(alvo){ rumo=Math.atan2(alvo.x-p.x,alvo.z-p.z); if(a==='cumprimentar') gesto=2.2; interagir(a,p.x,p.z); if(a==='conversar') contar('papo',10); } } }
    if(pedido.golpe){ const g=pedido.golpe==='soco'&&av.arma?'tiro':pedido.golpe; pedido.golpe=null; if(!veic.dirigindo) golpear(g); }   // quem tem arma (Ricardo) atira no J
    atualizarLuta(dt, acertar); atualizarTiros(dt);
    if(veic.dirigindo) aoVolante(dt); else { jogador.visible=true; aPe(dt); } }
  const p=jogador.position;

  // dica de entrar / botão do celular
  const perto=!veic.dirigindo&&!casa.dentro&&!home.aberta&&(veiculoPerto(p.x,p.z)||(cavaloPerto(p.x,p.z)&&{rua:true,cavalo:true,tipo:{id:'montaria',nome:'Cavalo'}})||(bikePerto(p.x,p.z)&&{rua:true,bike:true,tipo:{id:'bike',nome:'Bike elétrica'}})||(()=>{ const t=carroDaRuaPerto(p.x,p.z); return t&&{rua:true,policia:t.policia,tipo:{id:t.arq,nome:veic.nomeDoTransito(t.arq)}}; })());
  $('dica').style.display=perto?'block':'none'; if(perto) $('dica').textContent=`E · entrar ${perto.tipo.nome==='SUV'?'no':'na'} ${perto.tipo.nome}`;
  if(perto&&perto.tipo.id==='cavalo') $('dica').textContent='E · subir no cavalo mecânico';
  if(perto&&perto.rua) $('dica').textContent=`E · pegar ${perto.tipo.nome==='SUV'||perto.tipo.nome==='Ônibus'?'o':'a'} ${perto.tipo.nome}`+(perto.policia||perto.bike?' (crime!)':'');
  if(perto&&perto.cavalo) $('dica').textContent='E · montar no cavalo';
  $('usar').style.display=(perto||veic.dirigindo)&&matchMedia('(pointer:coarse)').matches?'block':'none';
  $('usar').textContent=veic.dirigindo?'Sair':'Entrar';
  // pedestre perto (a pé): mostra as ações
  const loja=!home.aberta&&!veic.dirigindo&&!casa.dentro&&lojaAqui(p.x,p.z);
  const terr=!home.aberta&&!veic.dirigindo&&!perto?(casa.dentro?dicaCasa(p.x,p.z):loja?(loja.l?.negocio==='academia'?'E academia: treinar, whey, creatina':'E comprar no balcão (comida, remédio, roupa, conserto…)'):dicaTerreno(p.x,p.z)||dicaCasa(p.x,p.z)):'';
  if(terr){ $('dica').style.display='block'; $('dica').textContent=TOQUE?terr.replace(/\b[BCV] (?=comprar|construir|abrir|caixa)/g,'').replace(/^./,c=>c.toUpperCase()):terr; }   // celular: sem as teclas
  const gente=!home.aberta&&!veic.dirigindo&&!perto&&!terr&&pedestrePerto(p.x,p.z);
  if(gente){ $('dica').style.display='block'; $('dica').textContent='T conversar · G cumprimentar · H '+(gente.modo==='seguir'?'dispensar':'chamar')+' · X assustar'+(quantosSeguem()?` · ${quantosSeguem()} seguindo`:''); }
  $('acoes').style.display=gente&&matchMedia('(pointer:coarse)').matches?'flex':'none';
  $('luta').style.display=!home.aberta&&!veic.dirigindo&&matchMedia('(pointer:coarse)').matches?'flex':'none';

  const eu=jogAlto(p.x,p.z);
  const D=veic.dirigindo, outros=[[p.x,p.z,D?D.comp/2:0.5,D?D.larg/2:0.5,0,eu?1:0], ...frota.filter(c=>c!==D).map(c=>[c.obj.position.x,c.obj.position.z,c.comp/2,c.larg/2,Math.abs(c.v||0)<0.5?1:0,c.alto&&perfil(c.obj.position.x,c.obj.position.z)>1.2?1:0])];   // 6º: em cima da BR alta (trincheira)   // 5º: estacionado (o trânsito desvia)
  for(const [x,z] of posicoesPedestres()) outros.push([x,z,0.3,0.3]);   // o trânsito para para pedestre na pista
  for(const [x,z] of posicoesCriancas()) outros.push([x,z,0.8,0.4]);    // e para a criança de bike que cruzou na frente
  outros.push(...obstaculosGangues());                                   // e na barricada das gangues (à noite)
  atualizarTransito(dt,p.x,p.z,outros);
  if(!casa.dentro) atualizarCriancas(dt,{x:p.x,z:p.z,dirigindo:!!D,v:D?D.v:0});
  atualizarPedestres(dt,{x:p.x,z:p.z,dirigindo:!!D,v:D?D.v:0, veic:D&&!eu?{x:D.obj.position.x,z:D.obj.position.z,h:D.h,meio:D.comp/2,larg:D.larg/2,v:D.v}:null},
    [...frota.filter(c=>c!==D).map(c=>[c.obj.position.x,c.obj.position.z,c.h,c.comp/2,c.larg/2]), ...posicoesTransito().filter(o=>!o[5]), ...posicoesPolicia()]);   // pedestre não atravessa veículo (o da BR alta passa por cima)
  if(!home.aberta) atualizarPolicia(dt,{x:p.x,z:p.z,dirigindo:!!D,v:D?D.v:0},prender);
  if(!home.aberta&&!casa.dentro) atualizarGangues(dt,{x:p.x,z:p.z,y:altura(p.x,p.z),dirigindo:!!D,caido:vida.caido>0||detido>0},
    (dano,fx,fz)=>{ if(levarPancada(dano,fx,fz)) somPancada(); return vida.caido>0; }, avisarTerreno);
  efeitosVeiculos(dt); atualizarEfeitos(dt); atualizarBaloes(dt); atualizarNegocios(dt,p.x,p.z); atualizarEspeciais(dt);
  // celular: sem teclado, os botões de terreno aparecem conforme o lugar (B comprar / C construir / V negócio)
  { const toqueTela=matchMedia('(pointer:coarse)').matches&&!home.aberta&&!veic.dirigindo, tb=$('terrBtn');
    const dc=toqueTela?(loja?'E balcao':dicaCasa(p.x,p.z)):'', cb=$('casaCtx'), ac=dc.startsWith('B ')?'comprar':dc.startsWith('E ')?'usar':null;   // casa: comprar, entrar, sair, dormir
    cb.style.display=ac&&!veic.dirigindo?'block':'none';
    if(ac&&cb.dataset.k!==dc){ cb.dataset.k=dc; cb.dataset.acao=ac; cb.textContent=dc==='E balcao'?'🛒 Balcão':dc.includes('comprar')?'🏡 Comprar casa':dc.includes('entrar')?'🚪 Entrar em casa':dc.includes('sair')?'🚪 Sair de casa':'🛏️ Dormir'; }
    const d=toqueTela&&!casa.dentro?dicaTerreno(p.x,p.z):'', acao=obra.ativa?'obra':d.startsWith('B comprar')?'comprar':d.startsWith('C construir')?'obra':null;
    $('negBtn').style.display=toqueTela&&!obra.ativa&&pertoDeNegocioMeu(p.x,p.z)?'block':'none';
    { const eb=$('entBtn'), dirige=TOQUE&&!home.aberta&&!!veic.dirigindo&&!trabalho.tipo, k=dirige?(alvoCorrida()?'c':'e'):'';   // entrega: só existia na tecla N
      eb.style.display=dirige?'block':'none'; if(k&&eb.dataset.k!==k){ eb.dataset.k=k; eb.textContent=k==='c'?'✖ Cancelar entrega':'🚚 Entrega'; } }
    tb.style.display=acao?'block':'none';
    if(acao&&tb.dataset.k!==acao+obra.ativa){ tb.dataset.k=acao+obra.ativa; tb.dataset.acao=acao; tb.textContent=obra.ativa?'✅ Sair da obra':acao==='comprar'?'💰 Comprar terreno':'🧱 Construir'; } }
  if(!home.aberta) atualizarCorrida(dt, veic.dirigindo);
  alvoTrab=!home.aberta?atualizarTrabalho(dt,p.x,p.z,!veic.dirigindo,veic.dirigindo?veic.dirigindo.v:0):null;
  if(!home.aberta){ veic.recolherSoltos(p.x,p.z); passarEfeitos(dt); }
  if(!home.aberta&&!casa.dentro) atualizarGPS(dt,p.x,p.z,camera.position.x,camera.position.z,avisarTerreno); else $('gps').style.display='none';
  // online: manda meu estado e move os outros jogadores
  if(!home.aberta){ const D2=veic.dirigindo; enviarEstado(dt,{x:p.x,z:p.z,r:rumo,a:D2?'parado':estadoAPe,vt:D2?(D2.tipo.id==='bike'?'urbana':D2.montaria?null:D2.tipo.id):null,vh:D2?D2.h:null,e:vida.e,c:vida.caido>0,g:[golpe.seq,golpe.tipo||'']}); }
  atualizarOnline(dt);
  { let d=null; for(const [x,z] of posicoesPolicia()){ const k=Math.hypot(x-p.x,z-p.z); if(d===null||k<d) d=k; } somSirene(d); }   // sirene pela viatura mais perto
  { const D3=veic.dirigindo, d2=(x,z)=>Math.hypot(x-p.x,z-p.z);                   // motor, trânsito, gente, cidade, passos
    somMundo(dt,{ home:home.aberta, ape:estadoAPe,
      motor:D3&&!home.aberta?{v:D3.v,vmax:D3.tipo.vmax,quebrado:D3.quebrado}:null,
      carros:[...carros.filter(c=>c.r&&c.obj.visible).map(c=>[d2(c.obj.position.x,c.obj.position.z),c.v||0]), ...frota.filter(c=>c!==D3&&Math.abs(c.v||0)>0.5).map(c=>[d2(c.obj.position.x,c.obj.position.z),c.v])],
      pessoas:posicoesPedestres().map(([x,z])=>d2(x,z)), noite:quantoNoite() }); }

  if(home.aberta){ orbita+=dt*0.04;                                    // sobrevoo lento da cidade atrás da tela inicial
    const ah=altura(p.x,p.z); alvo.set(p.x,ah,p.z); camera.position.set(p.x+Math.sin(orbita)*170, ah+85, p.z+Math.cos(orbita)*170); camera.lookAt(alvo); }
  else { const {yaw,pitch,dist}=cam;
    alvo.set(p.x,(veic.dirigindo?1.8:1.45)+altura(p.x,p.z)+alturaNivel(nivel,p.x,p.z),p.z);
    camera.position.set(p.x+dist*Math.sin(yaw)*Math.cos(pitch), alvo.y+dist*Math.sin(pitch), p.z+dist*Math.cos(yaw)*Math.cos(pitch));
    { const piso=altura(camera.position.x,camera.position.z)+1.2; if(camera.position.y<piso) camera.position.y=piso; }   // morro atrás: câmera não entra no chão
    { const c=camera.position, ox=alvo.x, oy=alvo.y, oz=alvo.z;       // câmera não entra em prédio/muro/casa (como no GTA): chega mais perto do jogador
      // 23/11: passo de 0,2 m (antes 5% da distância, ~0,45 m, pulava muro fino) e sem distância mínima de 1,6 m
      // (com a parede colada nas costas a câmera ficava do outro lado e via através dela). Dentro de casa: as paredes da casa.
      aterro.cima=nivel.alto;                                           // embaixo da BR: o aterro segura a câmera; em cima: não
      const L=Math.hypot(c.x-ox,c.y-oy,c.z-oz)||1, parede=casa.dentro?bloqueioCasa:bloqueado, ex=(c.z-oz)/L*0.22, ez=-(c.x-ox)/L*0.22;
      for(let s=0.2;s<=L+0.21;s+=0.2){ const t=Math.min(1,s/L), x=ox+(c.x-ox)*t, y=oy+(c.y-oy)*t, z=oz+(c.z-oz)*t;
        if((casa.dentro||y-altura(x,z)<14)&&(parede(x,z)||parede(x+ex,z+ez)||parede(x-ex,z-ez))){   // a lente tem largura: confere os lados também
          const u=Math.max(0.3,s-0.35)/L; c.set(ox+(c.x-ox)*u, oy+(c.y-oy)*u, oz+(c.z-oz)*u);
          if(!casa.dentro&&s<2) c.y+=(2-s)*0.2;                             // colada na parede: sobe um pouco e olha por cima da cabeça
          break; } }
      aterro.cima=false; }
    { const c=camera.position;                                          // câmera não entra no poste (tampava a tela toda)
      for(let k=0;k<8;k++){ const bate=postes.some(q=>Math.abs(q[0]-c.x)<0.8&&Math.abs(q[1]-c.z)<0.8&&Math.hypot(q[0]-c.x,q[1]-c.z)<0.8);
        if(!bate||c.y-altura(c.x,c.z)>8) break; c.lerp(alvo,0.12); } }
    camera.lookAt(alvo); cameraFrontal(dt); }   // R: câmera frontal; moto inclina a câmera (camfrontal.js)
  base.position.set(p.x,0,p.z);
  satelite.atualizar(p.x,p.z);
  atualizarTelhados(dt,p.x,p.z);

  tLento+=dt;
  if(tLento>0.12){ tLento=0;
    minimapa(p.x,p.z,rumo, frota.filter(c=>c!==veic.dirigindo).map(c=>({x:c.obj.position.x,z:c.obj.position.z,h:c.h,comp:c.comp,larg:c.larg})), posicoesTransito(), alvoCorrida()||alvoTrab, posicoesJogadores(), {...terrenosNoMapa(), casas:casasNoMapa()}, gps.rota);
    desenharMapa();
    atualizarGuia(p.x,p.z);
    const r=ruaMaisProxima(p.x,p.z), nome=r?r.nome:'';
    if(!home.aberta){ const h=horaJogo();                                      // conquistas que dependem do estado
      if(h<4.5&&!home.aberta) conquista('coruja');
      if(policia.estrelas>=3) conquista('procurado');
      if(quantosSeguem()>=3) conquista('lider');
      if(posicoesJogadores().some(([x,z])=>Math.hypot(x-p.x,z-p.z)<15)) conquista('encontro'); }
    if(nome!==ruaAtual){ ruaAtual=nome; if(nome&&!home.aberta) colecionar('explorador','ruas',nome,25);
      const el=$('street'); el.textContent=nome; // nome vem do OSM (editável por qualquer um): nunca como HTML
      if(nome){ const s=document.createElement('small'); s.textContent='MATELÂNDIA · PR'; el.appendChild(s); } }
    $('relogio').textContent=(quantoNoite()>0.5?'🌙 ':'☀️ ')+relogioTxt(horaJogo());
    const [la,lo]=toLL(p.x,p.z); $('coord').textContent=la.toFixed(5)+', '+lo.toFixed(5);
  }
  { const D4=veic.dirigindo, vs=posicoesTransito().concat(posicoesPolicia());          // faróis: trânsito, polícia e o seu
    if(D4) vs.push([D4.obj.position.x,D4.obj.position.z,D4.h,D4.comp/2,D4.larg/2]);
    if(casa.dentro) renderer.render(cenaCasa,camera); else desenhar(vs, home.aberta?[]:[jogador, D4&&D4.obj]); if(talvezFotografar(renderer.domElement)) conquista('fotografo'); }
}

status();
carregarRelevo(scene).then(m=>console.info('relevo: desnível',m,'m'));
progresso('Carregando ruas…');
carregarCidade().then(async()=>{
  progresso('Levantando os prédios…');
  await carregarPredios();
  // árvore e banco não vão para cima da rua
  const ruaLonge=(x,z,folga=1.5)=>!ruas.some(r=>!r.pe&&x>r.bb[0]-12&&x<r.bb[2]+12&&z>r.bb[1]-12&&z<r.bb[3]+12&&r.pts.some((q,i)=>{ const n=r.pts[i+1]; if(!n) return false; const vx=n[0]-q[0], vz=n[1]-q[1]; let t=((x-q[0])*vx+(z-q[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t)); return Math.hypot(x-q[0]-vx*t,z-q[1]-vz*t)<r.w/2+folga; }));   // folga: quanto além da beira da pista
  console.info('marcos', construirMarcos(predios, ruaLonge)); console.info('campos', construirCampos()); status();
  progresso('Abrindo as lojas…');
  console.info('lojas', await carregarLojas());
  console.info('detalhes', await construirDetalhes());
  progresso('Chamando o povo para a rua…');
  try{ const l=lugaresCache=(await (await fetch('dados/lugares.json')).json()).lugares; await iniciarPedestres(l, jogador.position.x, jogador.position.z); iniciarGangues().catch(e=>console.warn('gangues',e)); iniciarCriancas().catch(e=>console.warn('crianças',e)); }catch(e){ console.warn('pedestres',e); }
  const p=jogador.position, [x,z]=pontoLivre(p.x,p.z); p.set(x,0,z);   // não nascer dentro de uma casa
  progresso('Demarcando terrenos…');
  console.info('terrenos', iniciarTerrenos()); console.info('postos/balada', iniciarEspeciais()); console.info('bancos/polícias/parque', iniciarPublicos(todosLotes));
  console.info('casas à venda', iniciarCasas());
  iniciarNegocios().catch(e=>console.warn('negócios',e));
  iniciarJornal().catch(e=>console.warn('jornal',e));
  console.info('postes', iniciarCeu());
  progresso('Ligando os motores…');
  await iniciarVeiculos(); await iniciarTransito(jogador.position.x,jogador.position.z);
  await iniciarPolicia(lugaresCache);
  pronto(); });
quadro();
// gancho para testes no console
window.__jogo={empina,prender,detido:()=>detido,vida,golpe,golpear,jogador,ruas,predios,tecla,frota,veic,pedido,lim:[LX0,LZ0,LX1,LZ1],cam:(d,p,y)=>{cam.dist=d;cam.pitch=p;cam.yaw=y;}};
