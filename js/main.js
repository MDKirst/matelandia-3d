// Ponto de entrada: monta o mundo e roda o loop
import * as THREE from 'three';
import { scene, camera, renderer, base, $ } from './cena.js';
import { toLL, LX0, LZ0, LX1, LZ1 } from './geo.js';
import { ANDAR, CORRER } from './config.js';
import { satelite } from './satelite.js';
import { ruas, predios, carregarCidade, status } from './cidade.js';
import { jogador, suporte, av, animar } from './avatar.js';
import { tecla, cam, toque, pedido } from './controles.js';
import { bloqueado, ruaMaisProxima, pontoLivre } from './mundo.js';
import { carregarPredios, atualizarTelhados } from './predios.js';
import { construirMarcos } from './marcos.js';
import { carregarLojas } from './lojas.js';
import { construirDetalhes, alturaLombada } from './detalhes.js';
import { iniciarPedestres, atualizarPedestres, posicoesPedestres } from './pedestres.js';
import { home, pronto, progresso } from './home.js';
import { atualizarEfeitos } from './efeitos.js';
import { danificar, efeitosVeiculos } from './veiculos.js';
import { baterNoCarro } from './transito.js';
import { quandoAtropelar, interagir, pedestrePerto, atualizarBaloes, quantosSeguem } from './pedestres.js';
import { iniciarPolicia, atualizarPolicia, crime, posicoesPolicia } from './policia.js';
import { somBatida, somExplosao, somPancada, somSirene, somMundo } from './som.js';
import { ganhar as pagar } from './terrenos.js';
import { iniciarTerrenos, comprar, alternarObra, dicaTerreno, obra, lotesMeus, terrenosNoMapa, avisarTerreno, sairObra } from './terrenos.js';
import { alternarCorrida, atualizarCorrida, alvoCorrida } from './entregas.js';
import { entrarOnline, sairOnline, enviarEstado, atualizarOnline, posicoesJogadores, golpearJogador, quandoApanhar } from './online.js';
import { vida, golpe, golpear, atualizarLuta, levarPancada, poseGolpe, DUR, DANO } from './luta.js';
import { golpearPedestre } from './pedestres.js';
addEventListener('matelandia:comecar',e=>{ if(!alvoCorrida()) comecar(e.detail, jogador.position.x, jogador.position.z); });
addEventListener('matelandia:jogar',e=>{ const d=e.detail; if(d.online) entrarOnline(d.nome,d.personagem); else sairOnline(); setTimeout(()=>conquista('boas_vindas'),1500); });
import { minimapa } from './minimapa.js';
import { sentar, descer, girarRodas } from './moto.js';
import { iniciarCeu, desenhar, horaJogo, relogioTxt, quantoNoite } from './ceu.js';
import { ganhar as conquista, contar, colecionar } from './conquistas.js';
import { pedirFoto, talvezFotografar } from './foto.js';
import { policia } from './policia.js';
import { trabalho, comecar, atualizarTrabalho, abrirTrabalhos } from './trabalhos.js';
import { iniciarJornal, noticiar } from './jornal.js';
import { revolta, quandoTurmaBater } from './pedestres.js';
import { iniciarNegocios, atualizarNegocios, acaoNegocio, pertoDeNegocioMeu } from './negocios.js';
import { frota, iniciarVeiculos, veiculoPerto, entrar, sair, dirigir, dentroDeVeiculo, frente, esquerda } from './veiculos.js';
import * as veic from './veiculos.js';
import { iniciarTransito, atualizarTransito, posicoesTransito, carros } from './transito.js';

// borda visível do mundo
{ const m=new THREE.MeshBasicMaterial({color:0xF97316,transparent:true,opacity:.18,side:THREE.DoubleSide,depthWrite:false}), H=45;
  const muro=(cx,cz,l,gira)=>{ const w=new THREE.Mesh(new THREE.PlaneGeometry(l,H),m); w.position.set(cx,H/2,cz); if(gira) w.rotation.y=Math.PI/2; scene.add(w); };
  muro((LX0+LX1)/2,LZ0,LX1-LX0,false); muro((LX0+LX1)/2,LZ1,LX1-LX0,false); muro(LX0,(LZ0+LZ1)/2,LZ1-LZ0,true); muro(LX1,(LZ0+LZ1)/2,LZ1-LZ0,true); }

// a pé: prédio, veículo estacionado ou carro do trânsito (antes o avatar entrava no carro)
function dentroDoTransito(x,z){
  for(const [tx,tz,ry,meio=2.2,larg=1.1] of [...posicoesTransito(),...posicoesPolicia()]){ const dx=x-tx, dz=z-tz; if(Math.abs(dx)>10||Math.abs(dz)>10) continue;
    const fx=-Math.sin(ry), fz=-Math.cos(ry); if(Math.abs(dx*fx+dz*fz)<meio+0.3 && Math.abs(-dx*fz+dz*fx)<larg+0.3) return true; }
  return false;
}
const travado=(x,z)=>bloqueado(x,z)||dentroDeVeiculo(x,z)||dentroDoTransito(x,z);

// carro do trânsito na frente do veículo do jogador?
// (se já estão encostados, deixa se afastar: senão o veículo travava para sempre)
function bateNoTransito(c,x,z,h){
  const p=c.obj.position;
  for(const [tx,tz,,meio=2.2,larg=1.1] of [...posicoesTransito(),...posicoesPolicia()]){
    const enc=(px,pz,ph)=>{ const [fx,fz]=frente(ph), [ex,ez]=esquerda(ph), dx=tx-px, dz=tz-pz;
      return Math.abs(dx*fx+dz*fz)<c.comp/2+meio-0.1 && Math.abs(dx*ex+dz*ez)<c.larg/2+larg; };
    if(!enc(x,z,h)) continue;
    if(enc(p.x,p.z,c.h) && Math.hypot(tx-x,tz-z)>=Math.hypot(tx-p.x,tz-p.z)) continue;   // saindo de perto
    return true; }
  return false;
}

let lugaresCache=[], gesto=0, estadoAPe='parado';
const TOQUE=matchMedia('(pointer:coarse)').matches;
// celular: os botões do painel sem as teclas do teclado ("Foto (P)" → "Foto")
if(TOQUE) for(const b of document.querySelectorAll('#btns button')) b.textContent=b.textContent.replace(/\s*\([^)]*\)\s*$/,'');
const relogio=new THREE.Clock(), alvo=new THREE.Vector3(); let rumo=0, tLento=0, passo=0, ruaAtual='', orbita=0.6;
function aPe(dt){
  let ix=(tecla.KeyD||tecla.ArrowRight?1:0)-(tecla.KeyA||tecla.ArrowLeft?1:0);
  let iy=(tecla.KeyW||tecla.ArrowUp?1:0)-(tecla.KeyS||tecla.ArrowDown?1:0);
  let correndo=tecla.ShiftLeft||tecla.ShiftRight;
  if(toque.joy){ ix=toque.joy.x; iy=-toque.joy.y; if(Math.hypot(ix,iy)>0.92) correndo=true; }
  if(vida.caido>0||golpe.tipo){ ix=0; iy=0; }                          // desmaiado ou no meio do golpe: parado
  const forca=Math.min(1,Math.hypot(ix,iy)); let estado='parado';
  const p=jogador.position;
  if(vida.empurra){ const [ex,ez]=vida.empurra; vida.empurra=null; if(!travado(p.x+ex,p.z+ez)){ p.x+=ex; p.z+=ez; } }
  if(forca>0.12){
    const {yaw}=cam;
    const vx=(-Math.sin(yaw)*iy+Math.cos(yaw)*ix), vz=(-Math.cos(yaw)*iy-Math.sin(yaw)*ix), l=Math.hypot(vx,vz);
    const vel=(correndo?CORRER:ANDAR)*forca*dt, dx=vx/l*vel, dz=vz/l*vel;
    if(travado(p.x,p.z)||!travado(p.x+dx,p.z+dz)){ p.x+=dx; p.z+=dz; }   // já dentro de algo (carro parou em cima, bloco posto no pé): deixa sair
    else if(!travado(p.x+dx,p.z)) p.x+=dx;
    else if(!travado(p.x,p.z+dz)) p.z+=dz;
    const a=Math.atan2(vx,vz); let d=a-rumo; d=Math.atan2(Math.sin(d),Math.cos(d)); rumo+=d*Math.min(1,dt*10);
    estado=correndo?'correr':'andar'; passo+=dt*(correndo?13:8);
  }
  p.x=Math.max(LX0+3,Math.min(LX1-3,p.x)); p.z=Math.max(LZ0+3,Math.min(LZ1-3,p.z));
  jogador.rotation.y=rumo; suporte.rotation.order='YXZ'; suporte.rotation.y=av.giroExtra;
  suporte.rotation.x=-vida.queda*Math.PI/2; suporte.position.y=vida.queda*0.12;   // desmaiado: deitado de costas
  if(gesto>0){ gesto-=dt; if(estado==='parado') estado='acenar'; }       // acenando para alguém
  estadoAPe=estado;
  animar(estado); if(av.mixer) av.mixer.update(dt);
  if(golpe.tipo) poseGolpe(suporte, golpe.tipo, golpe.t/DUR[golpe.tipo], Math.sin(rumo), Math.cos(rumo));
  if(av.boneco){ const s=estado==='parado'?0:Math.sin(passo)*(estado==='correr'?0.9:0.55), q=av.boneco.userData.partes;
    q[0].rotation.x=s; q[1].rotation.x=-s; q[2].rotation.x=-s; q[3].rotation.x=s; }
}

let distAPe=cam.dist;
function aoVolante(dt){
  const c=veic.dirigindo;
  let acel=(tecla.KeyW||tecla.ArrowUp?1:0)-(tecla.KeyS||tecla.ArrowDown?1:0);
  let giro=(tecla.KeyA||tecla.ArrowLeft?1:0)-(tecla.KeyD||tecla.ArrowRight?1:0);
  if(toque.joy){ acel=-toque.joy.y; giro=-toque.joy.x; }
  const v0=Math.abs(c.v);
  if(dirigir(dt, acel, giro, tecla.Space, bateNoTransito) && v0>4){            // bateu: estraga o veículo
    const inteiro=!c.quebrado; danificar(c,v0); somBatida(v0); if(inteiro&&c.quebrado) somExplosao();
    const [fx,fz]=frente(c.h), q=c.obj.position, alvoT=baterNoCarro(q.x+fx*c.comp*0.6,q.z+fz*c.comp*0.6,v0);
    if(alvoT&&v0>9) crime(1,'Batida');
  }
  const p=c.obj.position; jogador.position.set(p.x,0,p.z); rumo=c.h+Math.PI;
  if(c.tipo.moto){ girarRodas(c,dt);                                                    // moto: inclina na curva e o piloto vai junto
    c.obj.rotation.z=THREE.MathUtils.lerp(c.obj.rotation.z, giro*Math.min(1,Math.abs(c.v)/10)*0.32*Math.sign(c.v||1), Math.min(1,dt*5)); }
  // quebra-mola: eixo da frente e de trás sobem; quanto mais rápido, maior o pulo
  { const [fx,fz]=frente(c.h), a=c.comp*0.35, yf=alturaLombada(p.x+fx*a,p.z+fz*a), yt=alturaLombada(p.x-fx*a,p.z-fz*a), k=1+Math.max(0,Math.abs(c.v)-6)*0.25;
    p.y=(yf+yt)/2*k; c.obj.rotation.x=Math.atan2((yf-yt)*k,c.comp); }
  if(c.tipo.moto) sentar(jogador,c.obj,false);                                      // piloto no banco (anda e inclina com a moto)
  // câmera vem para trás do veículo quando ele anda (parado, dá para olhar em volta)
  if(Math.abs(c.v)>0.6){ let d=c.h-cam.yaw; d=Math.atan2(Math.sin(d),Math.cos(d)); cam.yaw+=d*Math.min(1,dt*2.5); }
  cam.dist+= (c.tipo.cam-cam.dist)*Math.min(1,dt*3);
  const s=document.createElement('small'); s.textContent=' km/h · '+c.tipo.nome+(c.quebrado?' · QUEBRADO':c.dano>0?` · motor ${Math.round(100-c.dano)}%`:'');
  $('velo').replaceChildren(String(Math.round(Math.abs(c.v)*3.6)), s);
  if(Math.abs(c.v)*3.6>100) conquista('veloz');
}

// preso: desce do veículo e aparece na frente do posto da PM
function prender(posto){
  if(veic.dirigindo){ sair(); jogador.visible=true; cam.dist=distAPe; $('velo').style.display='none'; }
  const [x,z]=pontoLivre(posto[0]+6,posto[1]+6); jogador.position.set(x,0,z);
  pagar(-500);                                                              // multa (o saldo não fica negativo)
}
quandoAtropelar(()=>{ somPancada(); crime(1,'Atropelamento'); revolta(jogador.position.x,jogador.position.z); });
// avacalhar: nocaute ou 2 pancadas em 20 s → a turma junta e bate (até desmaiar)
let pancadas=[];
quandoTurmaBater((dano,fx,fz)=>{ if(veic.dirigindo) return false; if(levarPancada(dano,fx,fz)) somPancada(); return vida.caido>0; },
  ()=>{ noticiar('surra'); dispatchEvent(new Event('matelandia:surra')); });

// soco/chute no meio do golpe: acerta pedestre ou outro jogador logo à frente
function acertar(tipo){
  const p=jogador.position, fx=Math.sin(rumo), fz=Math.cos(rumo);
  const ped=golpearPedestre(p.x,p.z,fx,fz,tipo), jog=golpearJogador(p.x,p.z,fx,fz,tipo,DANO[tipo]);
  if(ped||jog) somPancada();
  if(ped==='nocaute') crime(1,'Agressão');
  if(ped){ const t=performance.now(); pancadas=pancadas.filter(x=>t-x<20000); pancadas.push(t);
    if(ped==='nocaute'||pancadas.length>=2){ pancadas=[]; revolta(p.x,p.z); } }
}
quandoApanhar((dano,fx,fz)=>{ if(veic.dirigindo) return; if(levarPancada(dano,fx,fz)) somPancada(); }, ()=>[jogador.position.x,jogador.position.z]);

function trocarVeiculo(){
  if(veic.dirigindo){
    const era=veic.dirigindo, [x,z,h]=sair(); jogador.position.set(x,0,z); jogador.visible=true; rumo=h-Math.PI/2;
    if(era.tipo.moto){ descer(jogador); era.obj.rotation.z=0.12; }
    cam.dist=distAPe;                                                              // câmera volta para perto (a pé)
    $('velo').style.display='none';
  } else {
    const c=veiculoPerto(jogador.position.x,jogador.position.z); if(!c) return;
    distAPe=cam.dist; entrar(c); jogador.visible=!!c.tipo.moto; animar('parado');
    if(c.tipo.moto){ c.obj.rotation.z=0; sentar(jogador,c.obj,true); } conquista('motorista'); colecionar('frota','veic',c.tipo.id,5);
    $('velo').style.display='block';
  }
}

// 🏠 Meu terreno (L / botão): a pé vai direto para a calçada da frente; dirigindo, liga a seta até lá.
// Com 2 terrenos, cada aperto vai para o outro.
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
  else { if(pedido.usar){ pedido.usar=false; if(!(vida.caido>0)) trocarVeiculo(); }
    if(pedido.entrega){ pedido.entrega=false; if(trabalho.tipo) avisarTerreno('Termine o trabalho atual antes da entrega (O cancela)'); else alternarCorrida(veic.dirigindo); }
    if(pedido.trabalho){ pedido.trabalho=false; abrirTrabalhos(!!alvoCorrida()); }
    if(pedido.comprar){ pedido.comprar=false; if(!veic.dirigindo) comprar(jogador.position.x,jogador.position.z); }
    if(pedido.obra){ pedido.obra=false; if(!veic.dirigindo) alternarObra(jogador.position.x,jogador.position.z); }
    if(pedido.casa){ pedido.casa=false; irAoTerreno(); }
    if(pedido.negocio){ pedido.negocio=false; if(veic.dirigindo) avisarTerreno('Desça do veículo para cuidar do negócio'); else { if(obra.ativa) sairObra(); acaoNegocio(jogador.position.x,jogador.position.z); } }
    if(pedido.foto){ pedido.foto=false; if(!obra.ativa){ pedirFoto((ruaAtual?ruaAtual+' · ':'')+relogioTxt(horaJogo())); } }
    if(pedido.acao){ const a=pedido.acao; pedido.acao=null;                     // T/G/H/X com um pedestre perto
      if(!veic.dirigindo){ const p=jogador.position, alvo=pedestrePerto(p.x,p.z);
        if(alvo){ rumo=Math.atan2(alvo.x-p.x,alvo.z-p.z); if(a==='cumprimentar') gesto=2.2; interagir(a,p.x,p.z); if(a==='conversar') contar('papo',10); } } }
    if(pedido.golpe){ const g=pedido.golpe; pedido.golpe=null; if(!veic.dirigindo) golpear(g); }
    atualizarLuta(dt, acertar);
    if(veic.dirigindo) aoVolante(dt); else { jogador.visible=true; aPe(dt); } }
  const p=jogador.position;

  // dica de entrar / botão do celular
  const perto=!veic.dirigindo&&veiculoPerto(p.x,p.z);
  $('dica').style.display=perto?'block':'none'; if(perto) $('dica').textContent=`E · entrar ${perto.tipo.nome==='SUV'?'no':'na'} ${perto.tipo.nome}`;
  if(perto&&perto.tipo.id==='cavalo') $('dica').textContent='E · subir no cavalo mecânico';
  $('usar').style.display=(perto||veic.dirigindo)&&matchMedia('(pointer:coarse)').matches?'block':'none';
  $('usar').textContent=veic.dirigindo?'Sair':'Entrar';
  // pedestre perto (a pé): mostra as ações
  const terr=!home.aberta&&!veic.dirigindo&&!perto?dicaTerreno(p.x,p.z):'';
  if(terr){ $('dica').style.display='block'; $('dica').textContent=TOQUE?terr.replace(/\b[BCV] (?=comprar|construir|abrir|caixa)/g,'').replace(/^./,c=>c.toUpperCase()):terr; }   // celular: sem as teclas
  const gente=!home.aberta&&!veic.dirigindo&&!perto&&!terr&&pedestrePerto(p.x,p.z);
  if(gente){ $('dica').style.display='block'; $('dica').textContent='T conversar · G cumprimentar · H '+(gente.modo==='seguir'?'dispensar':'chamar')+' · X assustar'+(quantosSeguem()?` · ${quantosSeguem()} seguindo`:''); }
  $('acoes').style.display=gente&&matchMedia('(pointer:coarse)').matches?'flex':'none';
  $('luta').style.display=!home.aberta&&!veic.dirigindo&&matchMedia('(pointer:coarse)').matches?'flex':'none';

  const D=veic.dirigindo, outros=[[p.x,p.z,D?D.comp/2:0.5,D?D.larg/2:0.5], ...frota.filter(c=>c!==D).map(c=>[c.obj.position.x,c.obj.position.z,c.comp/2,c.larg/2])];
  for(const [x,z] of posicoesPedestres()) outros.push([x,z,0.3,0.3]);   // o trânsito para para pedestre na pista
  atualizarTransito(dt,p.x,p.z,outros);
  atualizarPedestres(dt,{x:p.x,z:p.z,dirigindo:!!D,v:D?D.v:0, veic:D?{x:D.obj.position.x,z:D.obj.position.z,h:D.h,meio:D.comp/2,larg:D.larg/2,v:D.v}:null},
    [...frota.filter(c=>c!==D).map(c=>[c.obj.position.x,c.obj.position.z,c.h,c.comp/2,c.larg/2]), ...posicoesTransito(), ...posicoesPolicia()]);   // pedestre não atravessa veículo
  if(!home.aberta) atualizarPolicia(dt,{x:p.x,z:p.z,dirigindo:!!D,v:D?D.v:0},prender);
  efeitosVeiculos(dt); atualizarEfeitos(dt); atualizarBaloes(dt); atualizarNegocios(dt,p.x,p.z);
  // celular: sem teclado, os botões de terreno aparecem conforme o lugar (B comprar / C construir / V negócio)
  { const toqueTela=matchMedia('(pointer:coarse)').matches&&!home.aberta&&!veic.dirigindo, tb=$('terrBtn');
    const d=toqueTela?dicaTerreno(p.x,p.z):'', acao=obra.ativa?'obra':d.startsWith('B comprar')?'comprar':d.startsWith('C construir')?'obra':null;
    $('negBtn').style.display=toqueTela&&!obra.ativa&&pertoDeNegocioMeu(p.x,p.z)?'block':'none';
    { const eb=$('entBtn'), dirige=TOQUE&&!home.aberta&&!!veic.dirigindo&&!trabalho.tipo, k=dirige?(alvoCorrida()?'c':'e'):'';   // entrega: só existia na tecla N
      eb.style.display=dirige?'block':'none'; if(k&&eb.dataset.k!==k){ eb.dataset.k=k; eb.textContent=k==='c'?'✖ Cancelar entrega':'🚚 Entrega'; } }
    tb.style.display=acao?'block':'none';
    if(acao&&tb.dataset.k!==acao+obra.ativa){ tb.dataset.k=acao+obra.ativa; tb.dataset.acao=acao; tb.textContent=obra.ativa?'✅ Sair da obra':acao==='comprar'?'💰 Comprar terreno':'🧱 Construir'; } }
  if(!home.aberta) atualizarCorrida(dt, veic.dirigindo);
  alvoTrab=!home.aberta?atualizarTrabalho(dt,p.x,p.z,!veic.dirigindo):null;
  // online: manda meu estado e move os outros jogadores
  if(!home.aberta){ const D2=veic.dirigindo; enviarEstado(dt,{x:p.x,z:p.z,r:rumo,a:D2?'parado':estadoAPe,vt:D2?D2.tipo.id:null,vh:D2?D2.h:null,e:vida.e,c:vida.caido>0,g:[golpe.seq,golpe.tipo||'']}); }
  atualizarOnline(dt);
  { let d=null; for(const [x,z] of posicoesPolicia()){ const k=Math.hypot(x-p.x,z-p.z); if(d===null||k<d) d=k; } somSirene(d); }   // sirene pela viatura mais perto
  { const D3=veic.dirigindo, d2=(x,z)=>Math.hypot(x-p.x,z-p.z);                   // motor, trânsito, gente, cidade, passos
    somMundo(dt,{ home:home.aberta, ape:estadoAPe,
      motor:D3&&!home.aberta?{v:D3.v,vmax:D3.tipo.vmax,quebrado:D3.quebrado}:null,
      carros:[...carros.filter(c=>c.r&&c.obj.visible).map(c=>[d2(c.obj.position.x,c.obj.position.z),c.v||0]), ...frota.filter(c=>c!==D3&&Math.abs(c.v||0)>0.5).map(c=>[d2(c.obj.position.x,c.obj.position.z),c.v])],
      pessoas:posicoesPedestres().map(([x,z])=>d2(x,z)), noite:quantoNoite() }); }

  if(home.aberta){ orbita+=dt*0.04;                                    // sobrevoo lento da cidade atrás da tela inicial
    alvo.set(p.x,0,p.z); camera.position.set(p.x+Math.sin(orbita)*170, 85, p.z+Math.cos(orbita)*170); camera.lookAt(alvo); }
  else { const {yaw,pitch,dist}=cam;
    alvo.set(p.x,veic.dirigindo?1.8:1.45,p.z);
    camera.position.set(p.x+dist*Math.sin(yaw)*Math.cos(pitch), alvo.y+dist*Math.sin(pitch), p.z+dist*Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(alvo); }
  base.position.set(p.x,0,p.z);
  satelite.atualizar(p.x,p.z);
  atualizarTelhados(dt,p.x,p.z);

  tLento+=dt;
  if(tLento>0.12){ tLento=0;
    minimapa(p.x,p.z,rumo, frota.filter(c=>c!==veic.dirigindo).map(c=>({x:c.obj.position.x,z:c.obj.position.z,h:c.h,comp:c.comp,larg:c.larg})), posicoesTransito(), alvoCorrida()||alvoTrab, posicoesJogadores(), terrenosNoMapa());
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
    desenhar(vs, home.aberta?[]:[jogador, D4&&D4.obj]); if(talvezFotografar(renderer.domElement)) conquista('fotografo'); }
}

status();
progresso('Carregando ruas…');
carregarCidade().then(async()=>{
  progresso('Levantando os prédios…');
  await carregarPredios();
  // árvore e banco não vão para cima da rua
  const ruaLonge=(x,z,folga=1.5)=>!ruas.some(r=>!r.pe&&x>r.bb[0]-12&&x<r.bb[2]+12&&z>r.bb[1]-12&&z<r.bb[3]+12&&r.pts.some((q,i)=>{ const n=r.pts[i+1]; if(!n) return false; const vx=n[0]-q[0], vz=n[1]-q[1]; let t=((x-q[0])*vx+(z-q[1])*vz)/(vx*vx+vz*vz||1); t=Math.max(0,Math.min(1,t)); return Math.hypot(x-q[0]-vx*t,z-q[1]-vz*t)<r.w/2+folga; }));   // folga: quanto além da beira da pista
  construirMarcos(predios, ruaLonge); status();
  progresso('Abrindo as lojas…');
  console.info('lojas', await carregarLojas());
  console.info('detalhes', await construirDetalhes());
  progresso('Chamando o povo para a rua…');
  try{ const l=lugaresCache=(await (await fetch('dados/lugares.json')).json()).lugares; await iniciarPedestres(l, jogador.position.x, jogador.position.z); }catch(e){ console.warn('pedestres',e); }
  const p=jogador.position, [x,z]=pontoLivre(p.x,p.z); p.set(x,0,z);   // não nascer dentro de uma casa
  progresso('Demarcando terrenos…');
  console.info('terrenos', iniciarTerrenos());
  iniciarNegocios().catch(e=>console.warn('negócios',e));
  iniciarJornal().catch(e=>console.warn('jornal',e));
  console.info('postes', iniciarCeu());
  progresso('Ligando os motores…');
  await iniciarVeiculos(); await iniciarTransito(jogador.position.x,jogador.position.z);
  await iniciarPolicia(lugaresCache);
  pronto(); });
quadro();
// gancho para testes no console
window.__jogo={vida,golpe,golpear,jogador,ruas,predios,tecla,frota,veic,pedido,lim:[LX0,LZ0,LX1,LZ1],cam:(d,p,y)=>{cam.dist=d;cam.pitch=p;cam.yaw=y;}};
