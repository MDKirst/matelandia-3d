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
