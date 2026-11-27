// Conversa ampliada com os moradores (25/11, pedido do Maicon):
//  · memória do jogador: o último acontecimento (preso, fugiu, atropelou, terreno, negócio…) vira assunto
//  · papo livre: depois da amizade 5, ou enquanto o morador "digere" a cena anterior, a janela abre um
//    menu (novidades/fofoca/jornal, favor, dica do jogo) em vez de uma frase só
//  · favores: levar o item do morador até um lugar da cidade (GPS), paga M$ e conta conquista
// Tudo no navegador (localStorage). A janela é a do moradores.js (passada em `ui`).
import { $ } from './cena.js';
import { horaJogo } from './ceu.js';
import { toXZ } from './geo.js';
import { LUGARES } from './publicos.js';
import { pontoDoEndereco } from './numeracao.js';
import { marcarDestino, gps, limparGPS } from './mapa.js';
import { ganhar as ganharM, fmt } from './terrenos.js';
import { contar } from './conquistas.js';
import { noticiasRecentes } from './jornal.js';
import { saudacao } from './rotina.js';
import { perguntarIA, iaLigada, iaRestante } from './ia-papo.js';
import { EXTRA, REACOES, REACAO_DE, FOFOCAS, DICAS, PEDIDOS, SEM_FAVOR, OBRIGADO } from './conversa-dados.js';

const CHAVE='matelandia3d.conversa', VALE_MS=25*60e3, FAVOR_CADA_MS=4*60e3, RAIO_CHEGOU=18;
const dados=(()=>{ try{ const d=JSON.parse(localStorage.getItem(CHAVE)); if(d&&d.comentou) return d; }catch(e){} return { fato:null, comentou:{}, favor:null, ultFavor:{}, favores:0 }; })();
const salvar=()=>{ try{ localStorage.setItem(CHAVE,JSON.stringify(dados)); }catch(e){} };
const sorteia=l=>l[(Math.random()*l.length)|0];
let tAviso=0;
function avisar(t){ const a=$('aviso'); if(!a) return; a.textContent=t; a.style.opacity=1; clearTimeout(tAviso); tAviso=setTimeout(()=>a.style.opacity=0,4500); }

/* ───────── memória: o que o jogador andou fazendo ───────── */
export function lembrar(tipo){ dados.fato={ tipo, t:Date.now() }; salvar(); }
const FATO_TXT={ atropelou:'atropelou alguém há pouco', roubo:'roubou uma bicicleta há pouco', batida:'bateu o carro há pouco', briga:'se meteu numa briga há pouco', favor:'fez um favor pra um morador há pouco',
  casa:'comprou uma casa', negocio:'abriu um negócio na cidade', trabalho:'fez um trabalho na cidade', surra:'levou uma surra da turma', preso:'foi preso pela polícia', fugiu:'fugiu da polícia',
  terreno:'comprou um terreno', entrega:'fez uma entrega', hospital:'foi parar no hospital', empinou:'empinou a moto na rua' };   // contexto pra IA
const fatoFresco=()=>dados.fato&&Date.now()-dados.fato.t<VALE_MS?dados.fato:null;
// fala sobre o último fato, se este morador ainda não comentou (id = modelo do morador)
export function reacao(id, marcar=true){
  const f=fatoFresco(); if(!f||dados.comentou[id]===f.t) return null;
  const txt=REACAO_DE[id]?.[f.tipo]||sorteia(REACOES[f.tipo]||['']); if(!txt) return null;
  if(marcar){ dados.comentou[id]=f.t; salvar(); }
  return txt;
}
// balão curto ao cumprimentar (G): às vezes o povo comenta o que viu
export function comentarioRapido(id){ if(Math.random()>0.5) return null; const t=reacao(id,false); return t&&t.length<=60?t:null; }

const motivoParaTipo=m=>/atropel/i.test(m)?'atropelou':/roubo de bike/i.test(m)?'roubo':/batida/i.test(m)?'batida':/tiro|agress/i.test(m)?'briga':null;
addEventListener('matelandia:crime',e=>{ const t=motivoParaTipo(e.detail?.motivo||''); if(t) lembrar(t); });
addEventListener('matelandia:negocio',()=>lembrar('negocio'));
addEventListener('matelandia:casa',()=>lembrar('casa'));
addEventListener('matelandia:trabalho',()=>lembrar('trabalho'));
addEventListener('matelandia:surra',()=>lembrar('surra'));
// o resto chega pelo letreiro de avisos (mesmo truque das conquistas)
const aviso=$('aviso');
if(aviso) new MutationObserver(()=>{ const t=aviso.textContent||'';
  if(t.startsWith('PRESO')) lembrar('preso');
  else if(t.includes('despistou a polícia')) lembrar('fugiu');
  else if(t.startsWith('Terreno comprado!')) lembrar('terreno');
  else if(t.startsWith('Entrega feita!')) lembrar('entrega');
  else if(t.includes('acordou no hospital')) lembrar('hospital');
  else if(t.startsWith('🏍️ Empinou')) lembrar('empinou');
}).observe(aviso,{childList:true,characterData:true,subtree:true});

/* ───────── lugares para os favores ───────── */
const FIXOS=[ ['Prefeitura',271,11], ['Hospital Padre Tezza',-698,-51], ['Parque Farroupilha',-586,-80], ['Colégio Euclides',-770,177], ['Cemitério Municipal',-1240,480] ];
let destinos=null;
const bonito=n=>n.charAt(0)+n.slice(1).toLowerCase().replace(/(^|[\s·])(\p{L})/gu,(a,b,c)=>b+c.toUpperCase()).replace(/\b(De|Da|Do|Dos|Das|E)\b/g,s=>s.toLowerCase());
function montarDestinos(){
  const l=FIXOS.map(([nome,x,z])=>({nome,x,z}));
  const pub=window.__publicos||{};
  for(const L of LUGARES){ if(window.__publicos&&pub[L.nome]!=='ok') continue;   // "virou terreno"/"sem prédio": não existe no jogo
    if(L.tipo==='social'||/CAPS/.test(L.nome)) continue;                          // lugar sensível não vira recado de favor
    let x,z; if(L.ll) [x,z]=toXZ(...L.ll); else if(L.end){ const e=pontoDoEndereco(...L.end); if(!e) continue; x=e.x; z=e.z; } else if(L.xz) [x,z]=L.xz; else continue;
    const nome=/^(CRAS|CAPS|UBS|CMEI|PREVIMAT)/.test(L.nome)?L.nome.replace(/ · .*/,''):bonito(L.nome.replace(/ · .*/,''));
    l.push({nome:/^(UBS|CMEI)/.test(nome)?L.nome:nome,x,z}); }
  for(const d of l) d.no=/^(Prefeitura|Câmara|Rodoviária|Agência|Polícia|Secretaria|Escola|Casa|UBS|Previmat|PREVIMAT)/i.test(d.nome)?'na':'no';
  return l;
}
function escolherDestino(px,pz){
  destinos??=montarDestinos();
  const bons=destinos.filter(d=>{ const k=Math.hypot(d.x-px,d.z-pz); return k>150&&k<900; });
  return sorteia(bons.length?bons:destinos);
}

/* ───────── favor ───────── */
function pedirFavor(p, m, id){
  const ex=EXTRA[id]||{ item:'uma encomenda' };
  if(dados.favor){ const f=dados.favor;
    return f.id===id?{ txt:`E aí, já levou ${f.item} ${f.lugar}? Tô contando com você!`, desistir:true }
                    :{ txt:`Você já tá fazendo um favor pra ${f.quem}. Termina esse primeiro!` }; }
  if(Date.now()-(dados.ultFavor[id]||0)<FAVOR_CADA_MS) return { txt:sorteia(SEM_FAVOR) };
  const d=escolherDestino(p.x,p.z), dist=Math.hypot(d.x-p.x,d.z-p.z);
  const valor=Math.round((150+dist*0.8)/10)*10;
  return { txt:sorteia(PEDIDOS).replace('{item}',ex.item).replace('{lugar}',d.no+' '+d.nome)+`\n\nPago ${fmt(valor)}.`,
    aceitar:()=>{ dados.favor={ id, quem:m.nome, item:ex.item, lugar:d.no+' '+d.nome, x:d.x, z:d.z, valor }; salvar();
      marcarDestino(d.x,d.z,`Favor: ${d.nome}`,p.x,p.z); avisar(`📦 Favor pra ${m.nome}: leve ${ex.item} até ${d.nome}`); } };
}
function desistir(){ if(!dados.favor) return; if(gps.nome?.startsWith('Favor:')) limparGPS(); dados.favor=null; salvar(); }
// a cada quadro: chegou no lugar do favor?
export function atualizarFavor(jog){
  const f=dados.favor; if(!f) return;
  if(Math.hypot(jog.x-f.x,jog.z-f.z)>RAIO_CHEGOU) return;
  if(gps.nome?.startsWith('Favor:')) limparGPS();
  ganharM(f.valor); dados.ultFavor[f.id]=Date.now(); dados.favores++; dados.favor=null; salvar();
  lembrar('favor'); contar('camarada',5,'favores');
  avisar(`✅ Favor feito pra ${f.quem}: +${fmt(f.valor)} · "${sorteia(OBRIGADO)}"`);
}
export const favorAtual=()=>dados.favor;

/* ───────── papo livre ───────── */
// ui = { mostrar(titulo,sub,cor,texto,botoes,dica), fechar(), cor, outros:[{nome,quem}] }
export function papoLivre(p, m, id, ui, abertura){
  const ex=EXTRA[id]||{ papo:[] };
  const h=horaJogo();
  const reag=reacao(id);
  const primeira=[abertura, reag||`${sorteia(saudacao(h))} ${sorteia(ex.papo.length?ex.papo:['Tudo tranquilo por aqui.'])}`].filter(Boolean).join('\n\n');
  // conversa livre por IA (27/11): o jogador escreve, o morador responde no personagem (ia-papo.js)
  const hist=[]; let esperando=false;
  const entrada={ dica:`Fale com ${m.nome}…`, enviar:async txt=>{
    if(esperando) return; esperando=true;
    const fala=txt.slice(0,200);
    ui.mostrar(m.nome, m.quem, ui.cor, `Você: "${fala}"\n\n${m.nome} está pensando…`, [], '', null);
    $('papo')?.querySelector('p')?.classList.add('pensando');
    const f=fatoFresco();
    let r=await perguntarIA({ id, fala, amizade:ui.amizade|0, hora:Math.floor(horaJogo()), noticias:noticiasRecentes?.(3)||[], fato:f?FATO_TXT[f.tipo]||'':'', hist });
    esperando=false;
    if(!ui.aberto?.()) return;                                       // fechou (Esc) ou se afastou enquanto a IA pensava
    if(!r) r=iaRestante()<=0&&iaLigada()?'Ufa, hoje já conversei demais! Amanhã a gente prosa mais.':sorteia(ex.papo.length?ex.papo:['Hm… é mesmo? Conta mais.']);
    hist.push({ q:fala, r }); if(hist.length>6) hist.shift();
    tela(`Você: "${fala}"\n\n${r}`);
    if(!matchMedia('(pointer:coarse)').matches) $('papoIn')?.focus();
  } };
  const tela=(texto)=>ui.mostrar(m.nome, m.quem, ui.cor, texto, menu(), undefined, iaLigada()?entrada:null);
  const menu=()=>{
    const b=[['Quais as novidades?', ()=>tela(novidade(id, ui.outros))],
             ['Precisa de alguma ajuda?', ()=>favor()],
             ['Me dá uma dica?', ()=>tela(sorteia(DICAS))],
             ['Até mais!', ui.fechar]];
    return b;
  };
  const favor=()=>{ const r=pedirFavor(p,m,id);
    const b=[]; if(r.aceitar) b.push(['Pode deixar, eu levo!', ()=>{ r.aceitar(); ui.fechar(); }], ['Agora não dá.', ()=>tela('Tudo bem! Se mudar de ideia, é só falar.')]);
    else if(r.desistir) b.push(['Já vou, já vou!', ui.fechar], ['Desisto, foi mal.', ()=>{ desistir(); tela('Ah… tudo bem. Eu dou um jeito.'); }]);
    else b.push(['Beleza!', ()=>tela('Mais alguma coisa?')]);
    ui.mostrar(m.nome, m.quem, ui.cor, r.txt, b); };
  tela(primeira);
}
function novidade(id, outros){
  const ex=EXTRA[id]||{ papo:[] };
  const r=Math.random(), noticias=noticiasRecentes?.(6)||[];
  if(r<0.3&&noticias.length) return `Saiu no jornal: "${sorteia(noticias)}". Essa cidade não para!`;
  if(r<0.65&&outros.length){ const o=sorteia(outros); return sorteia(FOFOCAS).replace('{n}',o.nome).replace('{q}',o.quem); }
  return sorteia(ex.papo.length?ex.papo:DICAS);
}

export const _testeConversa={ dados, lembrar, montarDestinos:()=>(destinos=montarDestinos()), salvar };
