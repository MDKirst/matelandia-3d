// Sons gerados na hora com a Web Audio API (nenhum arquivo de áudio): sirene da polícia,
// batida, explosão e pancada do atropelamento. O navegador só libera áudio depois de um clique
// ou tecla, então o contexto nasce no primeiro gesto (o clique em JOGAR já serve). M liga/desliga.
let ctx=null, mestre=null, ruido=null, ligado=true;
try{ ligado=localStorage.getItem('matelandia3d.som')!=='0'; }catch(e){}

function iniciar(){
  if(ctx) { if(ctx.state==='suspended') ctx.resume(); return; }
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return;
  ctx=new AC(); mestre=ctx.createGain(); mestre.gain.value=ligado?0.8:0; mestre.connect(ctx.destination);
  // 2 s de ruído branco, reaproveitado por todos os sons
  ruido=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate); const d=ruido.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1;
}
for(const ev of ['pointerdown','keydown']) addEventListener(ev,iniciar);

export function alternarSom(){ ligado=!ligado; try{ localStorage.setItem('matelandia3d.som',ligado?'1':'0'); }catch(e){} if(mestre) mestre.gain.value=ligado?0.8:0; return ligado; }
export const somLigado=()=>ligado;

// rajada de ruído filtrado com volume que cai: base de batida, explosão e pancada
function rajada(t0, dur, vol, filtro, freq, q=0.7){
  const s=ctx.createBufferSource(); s.buffer=ruido; s.playbackRate.value=0.7+Math.random()*0.6;
  const f=ctx.createBiquadFilter(); f.type=filtro; f.frequency.value=freq; f.Q.value=q;
  const g=ctx.createGain(); g.gain.setValueAtTime(vol,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
  s.connect(f).connect(g).connect(mestre); s.start(t0,Math.random()*1.5); s.stop(t0+dur+0.05);
}
// tom grave que despenca (o "tum" do impacto)
function baque(t0, f0, f1, dur, vol){
  const o=ctx.createOscillator(); o.type='sine'; o.frequency.setValueAtTime(f0,t0); o.frequency.exponentialRampToValueAtTime(f1,t0+dur);
  const g=ctx.createGain(); g.gain.setValueAtTime(vol,t0); g.gain.exponentialRampToValueAtTime(0.001,t0+dur);
  o.connect(g).connect(mestre); o.start(t0); o.stop(t0+dur+0.05);
}

// impacto em m/s: mais rápido = mais alto e com vidro quebrando
export function somBatida(impacto){
  if(!ctx) return; const t=ctx.currentTime, k=Math.min(1,impacto/20);
  baque(t,120,38,0.35,0.6*k+0.2);
  rajada(t,0.25+0.25*k,0.55*k+0.15,'lowpass',900+1500*k);         // lataria
  rajada(t+0.02,0.18,0.35*k,'bandpass',2600,1.2);                 // chiado metálico
  if(impacto>10) for(let i=0;i<5;i++) rajada(t+0.05+i*0.035+Math.random()*0.03,0.12,0.25*k,'highpass',4500+Math.random()*2500,0.9);  // vidro
}
export function somExplosao(){
  if(!ctx) return; const t=ctx.currentTime;
  baque(t,90,22,1.4,0.75); rajada(t,1.6,0.6,'lowpass',700); rajada(t,0.6,0.3,'bandpass',1800,0.8);
}
export function somPancada(){
  if(!ctx) return; const t=ctx.currentTime; baque(t,95,45,0.22,0.8); rajada(t,0.12,0.35,'lowpass',600);
}

// plim de coleta (2 notas) e de entrega paga (3 notas subindo)
export function somEntrega(pago){
  if(!ctx) return; const t=ctx.currentTime, notas=pago?[659,784,1047]:[784,1047];
  notas.forEach((f,i)=>{ const o=ctx.createOscillator(); o.type='triangle'; o.frequency.value=f;
    const g=ctx.createGain(), t0=t+i*0.11; g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(0.35,t0+0.02); g.gain.exponentialRampToValueAtTime(0.001,t0+0.35);
    o.connect(g).connect(mestre); o.start(t0); o.stop(t0+0.4); });
}

// sirene: um oscilador só, sobe e desce (lamento); volume pela distância da viatura mais perto
let sirene=null;
export function somSirene(dist){
  if(!ctx) return;
  if(dist==null||dist>320){ if(sirene){ const s=sirene; sirene=null; s.g.gain.setTargetAtTime(0,ctx.currentTime,0.3); setTimeout(()=>{ s.o.stop(); s.lfo.stop(); },1500); } return; }
  if(!sirene){
    const o=ctx.createOscillator(); o.type='sawtooth'; o.frequency.value=950;
    const lfo=ctx.createOscillator(); lfo.type='sine'; lfo.frequency.value=0.33;                // um ciclo a cada 3 s
    const prof=ctx.createGain(); prof.gain.value=380; lfo.connect(prof).connect(o.frequency);   // 570 a 1330 Hz
    const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=2200;
    const g=ctx.createGain(); g.gain.value=0;
    o.connect(f).connect(g).connect(mestre); o.start(); lfo.start();
    sirene={o,lfo,f,g};
  }
  const vol=0.32*Math.max(0,1-dist/320)**1.6;
  sirene.g.gain.setTargetAtTime(vol,ctx.currentTime,0.15);
  sirene.f.frequency.setTargetAtTime(900+2400*Math.max(0,1-dist/200),ctx.currentTime,0.2);       // longe soa abafada
}

/* ───────── sons do mundo (contínuos), atualizados a cada quadro por somMundo() ─────────
   - motor do veículo que eu dirijo: dente de serra + quadrada grave, rotação sobe e "troca marcha"
   - trânsito: ronco + chiado de pneu, volume pela soma dos carros perto, tom pelo mais perto
   - gente: murmúrio (ruído na faixa da voz com sílabas aleatórias), volume pelo nº de pedestres perto
   - cidade: chiado grave de fundo + passarinho e buzina ao longe de vez em quando
   - passos do jogador a pé */
let mundo=null;
function voz(tipo, freq){ const o=ctx.createOscillator(); o.type=tipo; o.frequency.value=freq; o.start(); return o; }
function fonteRuido(){ const s=ctx.createBufferSource(); s.buffer=ruido; s.loop=true; s.playbackRate.value=0.9+Math.random()*0.2; s.start(0,Math.random()*1.5); return s; }
function filtro(tipo,freq,q=0.7){ const f=ctx.createBiquadFilter(); f.type=tipo; f.frequency.value=freq; f.Q.value=q; return f; }
function ganho(v=0){ const g=ctx.createGain(); g.gain.value=v; return g; }
function montarMundo(){
  const m={};
  // motor do jogador
  m.mA=voz('sawtooth',40); m.mB=voz('square',20); m.mF=filtro('lowpass',400,2); m.mG=ganho();
  const gb=ganho(0.5); m.mA.connect(m.mF); m.mB.connect(gb).connect(m.mF); m.mF.connect(m.mG).connect(mestre);
  // trânsito em volta
  m.tA=voz('sawtooth',55); m.tF=filtro('lowpass',260,1.5); m.tG=ganho(); m.tA.connect(m.tF).connect(m.tG).connect(mestre);
  m.pS=fonteRuido(); m.pF=filtro('bandpass',700,0.6); m.pG=ganho(); m.pS.connect(m.pF).connect(m.pG).connect(mestre);
  // murmúrio de gente: 2 faixas de voz, cada uma com "sílabas" (ganho que pula) próprias
  m.gente=[[480,1.2],[1100,1.4]].map(([f,q])=>{ const s=fonteRuido(), bp=filtro('bandpass',f,q), sil=ganho(), g=ganho(); s.connect(bp).connect(sil).connect(g).connect(mestre); return {bp,sil,g,f,prox:0}; });
  // fundo da cidade
  m.cS=fonteRuido(); m.cF=filtro('lowpass',320,0.5); m.cG=ganho(); m.cS.connect(m.cF).connect(m.cG).connect(mestre);
  m.proxEvento=ctx.currentTime+4; m.passo=0;
  return m;
}
const alvo=(p,v,tau=0.12)=>p.setTargetAtTime(v,ctx.currentTime,tau);
function passarinho(t0,vol){ const n=2+((Math.random()*4)|0), f0=2600+Math.random()*1800;
  for(let i=0;i<n;i++){ const t=t0+i*(0.09+Math.random()*0.06), o=ctx.createOscillator(); o.type='sine';
    o.frequency.setValueAtTime(f0,t); o.frequency.exponentialRampToValueAtTime(f0*(1.3+Math.random()*0.4),t+0.06);
    const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.01); g.gain.exponentialRampToValueAtTime(0.0001,t+0.08);
    o.connect(g).connect(mestre); o.start(t); o.stop(t+0.1); } }
// grilo: trinados curtos e agudos em 2-3 rajadas (noite)
function grilo(t0,vol){ const f=4200+Math.random()*700, rajadas=2+((Math.random()*2)|0);
  for(let r=0;r<rajadas;r++) for(let i=0;i<4;i++){ const t=t0+r*0.32+i*0.035, o=ctx.createOscillator(); o.type='sine'; o.frequency.value=f;
    const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+0.006); g.gain.exponentialRampToValueAtTime(0.0001,t+0.028);
    o.connect(g).connect(mestre); o.start(t); o.stop(t+0.04); } }
function buzinaLonge(t0,vol){ const d=0.18+Math.random()*0.35, f=filtro('lowpass',1200);
  const g=ctx.createGain(); g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(vol,t0+0.03); g.gain.setValueAtTime(vol,t0+d); g.gain.exponentialRampToValueAtTime(0.0001,t0+d+0.08);
  f.connect(g).connect(mestre);
  for(const fr of [392,494]){ const o=ctx.createOscillator(); o.type='square'; o.frequency.value=fr; o.connect(f); o.start(t0); o.stop(t0+d+0.1); } }
function pisada(t,vol){ const s=ctx.createBufferSource(); s.buffer=ruido; const f=filtro('lowpass',650), g=ctx.createGain();
  g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.001,t+0.07); s.connect(f).connect(g).connect(mestre); s.start(t,Math.random()*1.5); s.stop(t+0.09); }

// e: { home, motor:{v,vmax,quebrado}|null, ape:'parado'|'andar'|'correr', carros:[[dist,v]], pessoas:[dist] }
export function somMundo(dt, e){
  if(!ctx||ctx.state!=='running') return;
  mundo ??= montarMundo(); const m=mundo, t=ctx.currentTime;
  // motor
  if(e.motor&&!e.motor.quebrado){ const f=Math.min(1,Math.abs(e.motor.v)/e.motor.vmax), marcha=Math.min(4,(f*5)|0), giro=f*5-marcha;
    const rpm=e.motor.v<0?0.35:(marcha===0?giro*0.9:0.35+giro*0.65);               // 0..1 dentro da marcha
    const hz=34+rpm*70+marcha*6;
    alvo(m.mA.frequency,hz,0.06); alvo(m.mB.frequency,hz/2,0.06); alvo(m.mF.frequency,300+rpm*900,0.08); alvo(m.mG.gain,0.09+rpm*0.07,0.1); }
  else alvo(m.mG.gain,0,0.25);
  // trânsito: soma de 1/d (até 60 m), tom e chiado pelo mais perto
  let soma=0, maisPerto=null; for(const [d,v] of e.carros){ if(d>60) continue; soma+=Math.max(0,1-d/60)**2*Math.min(1,0.25+Math.abs(v)/12); if(!maisPerto||d<maisPerto[0]) maisPerto=[d,v]; }
  soma=Math.min(1.2,soma); const vp=maisPerto?Math.abs(maisPerto[1]):0;
  alvo(m.tA.frequency,45+vp*3.5,0.2); alvo(m.tG.gain,0.11*soma,0.2); alvo(m.pG.gain,0.07*soma*Math.min(1,vp/8),0.2); alvo(m.pF.frequency,500+vp*40,0.2);
  // gente: até 12 pessoas a menos de 25 m
  let povo=0; for(const d of e.pessoas) if(d<25) povo+=1-d/25; povo=Math.min(1,povo/5);
  for(const g of m.gente){ alvo(g.g.gain,0.09*povo*(e.home?0:1),0.3);
    if(t>=g.prox){ g.prox=t+0.08+Math.random()*0.22; g.sil.gain.setTargetAtTime(Math.random()<0.3?0.05:0.4+Math.random()*0.6,t,0.03); g.bp.frequency.setTargetAtTime(g.f*(0.8+Math.random()*0.5),t,0.05); } }
  // fundo da cidade + eventos ao longe
  alvo(m.cG.gain,e.home?0.05:0.035,0.5);
  if(t>=m.proxEvento){ m.proxEvento=t+3+Math.random()*7; const nt=e.noite||0; if(Math.random()<0.7){ if(Math.random()<nt) grilo(t+0.05,0.02+Math.random()*0.02); else passarinho(t+0.05,0.03+Math.random()*0.03); } else if(Math.random()>nt*0.7) buzinaLonge(t+0.05,0.025+Math.random()*0.02); }
  // passos a pé
  if(!e.home&&!e.motor&&(e.ape==='andar'||e.ape==='correr')){ const ritmo=e.ape==='correr'?0.29:0.48; m.passo-=dt; if(m.passo<=0){ m.passo=ritmo; pisada(t,e.ape==='correr'?0.22:0.14); } }
  else m.passo=0;
}

// volumes atuais dos sons do mundo (para conferir pelo console)
export const niveisSom=()=>mundo&&{ estado:ctx.state, motor:+mundo.mG.gain.value.toFixed(3), motorHz:+mundo.mA.frequency.value.toFixed(1), transito:+mundo.tG.gain.value.toFixed(3), gente:+mundo.gente[0].g.gain.value.toFixed(3), cidade:+mundo.cG.gain.value.toFixed(3) };

// Grava um som num WAV (sem tocar): renderiza num OfflineAudioContext. Usado para conferir os sons.
// nome: 'batida' | 'explosao' | 'pancada' | 'sirene'
export async function gravarSom(nome, seg=2){
  const real=[ctx,mestre,ruido,sirene], off=new OfflineAudioContext(1,44100*seg,44100);
  ctx=off; mestre=off.createGain(); mestre.gain.value=0.8; mestre.connect(off.destination); sirene=null;
  ruido=off.createBuffer(1,off.sampleRate*2,off.sampleRate); { const d=ruido.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1; }
  if(nome==='batida') somBatida(15); else if(nome==='explosao') somExplosao(); else if(nome==='pancada') somPancada(); else somSirene(30);
  const buf=await off.startRendering(); [ctx,mestre,ruido,sirene]=real;
  const d=buf.getChannelData(0); let pico=0; for(const v of d) pico=Math.max(pico,Math.abs(v));
  // WAV 16 bits
  const n=d.length, dv=new DataView(new ArrayBuffer(44+n*2)), w=(o,s)=>[...s].forEach((c,i)=>dv.setUint8(o+i,c.charCodeAt(0)));
  w(0,'RIFF'); dv.setUint32(4,36+n*2,true); w(8,'WAVEfmt '); dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true);
  dv.setUint32(24,44100,true); dv.setUint32(28,88200,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true); w(36,'data'); dv.setUint32(40,n*2,true);
  const g=pico>0.98?0.98/pico:1; for(let i=0;i<n;i++) dv.setInt16(44+i*2,Math.max(-1,Math.min(1,d[i]*g))*32767,true);
  return { pico, wav:new Uint8Array(dv.buffer) };
}

// música ambiente baixinha dentro dos comércios: acordes suaves, baixo e arpejo (gerados na hora).
// Cada tipo de loja tem andamento e tom próprios. tipo=null: some devagar e para de tocar.
const PROG=[[60,64,67,71],[57,60,64,67],[62,65,69,72],[55,59,62,65]];      // Cmaj7 · Am7 · Dm7 · G7 (MIDI)
const ESTILO={ padaria:[76,0], lanchonete:[92,2], mercado:[84,-3], roupas:[100,5], farmacia:[70,-5], oficina:[96,-2], bar:[104,3] };
const hz=m=>440*2**((m-69)/12);
let mus=null;
function notaMus(f,t0,dur,tipo,vol,ataque){
  const o=ctx.createOscillator(); o.type=tipo; o.frequency.value=f; const g=ctx.createGain();
  g.gain.setValueAtTime(0.0001,t0); g.gain.linearRampToValueAtTime(vol,t0+ataque+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
  o.connect(g).connect(mus.f); o.start(t0); o.stop(t0+dur+0.05);
}
export function musicaLoja(tipo){
  if(!ctx||ctx.state!=='running') return;
  if(!mus){ mus={ g:ctx.createGain(), f:ctx.createBiquadFilter(), prox:0, passo:0, tipo:null, fora:-1e9 };
    mus.g.gain.value=0; mus.f.type='lowpass'; mus.f.frequency.value=2000; mus.f.connect(mus.g).connect(mestre); }
  const t=ctx.currentTime;
  if(tipo){ if(mus.fora!==0){ mus.g.gain.setTargetAtTime(0.06,t,0.8); } mus.fora=0; mus.tipo=tipo; }
  else { if(mus.fora===0) mus.g.gain.setTargetAtTime(0,t,0.5); if(mus.fora===0) mus.fora=t; if(t-mus.fora>3){ mus.prox=0; return; } }
  const [bpm,tr]=ESTILO[mus.tipo]||[84,0], c=60/bpm/2;                     // c = colcheia
  if(mus.prox<t) mus.prox=t+0.05;
  while(mus.prox<t+0.4){ const s=mus.passo, ac=PROG[Math.floor(s/8)%4], tt=mus.prox;
    if(s%8===0) for(const n of ac) notaMus(hz(n+tr),tt,c*8,'triangle',0.09,0.3);          // acorde
    if(s%4===0) notaMus(hz(ac[0]+tr-24),tt,c*3,'sine',0.3,0.01);                         // baixo
    if(Math.random()<0.8) notaMus(hz(ac[[0,2,1,3,2,1,3,2][s%8]]+tr+12),tt,c*0.9,'sine',0.11,0.005);   // arpejo
    mus.passo++; mus.prox+=c; }
}
