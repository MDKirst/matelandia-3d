// 📰 Jornal da cidade: manchetes do que os jogadores fazem (abriu negócio, foi preso, apanhou da turma…).
// No banco vai só o tipo do fato, o nome do jogador e a rua; o texto da manchete é montado aqui
// (ninguém escreve texto livre no jornal). Quem está jogando vê a manchete nova passar no rodapé.
import { $ } from './cena.js';
import { nuvem, conectarNuvem, ouvirJornal, postarJornal } from './nuvem.js';
import { ruaMaisProxima } from './mundo.js';
import { jogador } from './avatar.js';

const NEG = { padaria:['🥖','Padaria'], lanchonete:['🍔','Lanchonete'], mercado:['🛒','Mercado'], roupas:['👕','Loja de Roupas'], farmacia:['💊','Farmácia'], oficina:['🔧','Oficina'], bar:['🍻','Bar'] };
const na = r=>r?` na ${r}`:'';
function manchete(e){
  const n=e.nome||'Visitante', r=e.rua||'';
  switch(e.tipo){
    case 'abriu':   { const [ic,nm]=NEG[e.neg]||['🏪','Negócio']; return `${ic} ${nm} de ${n} abre as portas${na(r)}`; }
    case 'fechou':  { const [,nm]=NEG[e.neg]||['','Negócio']; return `🔒 ${nm} de ${n} fecha as portas`; }
    case 'preso':   return `🚔 ${n} é preso pela polícia${na(r)}`;
    case 'surra':   return `🥊 ${n} avacalha e apanha da turma${na(r)}`;
    case 'fugiu':   return `🏃 ${n} despista a polícia e some${na(r)}`;
    case 'terreno': return `🏠 ${n} compra um terreno${na(r)}`;
  }
  return '';
}
const meuNome=()=>{ try{ return (localStorage.getItem('matelandia3d.nome')||'').trim().slice(0,16)||'Visitante'; }catch(e){ return 'Visitante'; } };
const ruaAqui=()=>{ const r=ruaMaisProxima(jogador.position.x,jogador.position.z); return (r&&r.nome||'').slice(0,48); };
const ultimo={};
export function noticiar(tipo, extra={}){
  if(!nuvem.ok) return;
  if(ultimo[tipo]&&Date.now()-ultimo[tipo]<60000) return;      // no máximo uma do mesmo tipo por minuto
  ultimo[tipo]=Date.now();
  const ev={ tipo, nome:meuNome() }; const r=ruaAqui(); if(r) ev.rua=r; if(extra.neg) ev.neg=extra.neg;
  postarJornal(ev);
}

let lista=[], vistos=null;
const ha=t=>{ const m=Math.max(0,Math.round((Date.now()-t)/60000)); return m<1?'agora':m<60?`há ${m} min`:m<1440?`há ${Math.round(m/60)} h`:`há ${Math.round(m/1440)} d`; };
function abrir(){
  const g=$('jornalLista'); g.replaceChildren();
  if(!lista.length){ const v=document.createElement('div'); v.className='vazio'; v.textContent=nuvem.ok?'Nada aconteceu ainda… seja a primeira manchete!':'Sem internet: o jornal não carregou.'; g.append(v); }
  for(const e of [...lista].reverse()){ const t=manchete(e); if(!t) continue;
    const it=document.createElement('div'); it.className='nota'; const b=document.createElement('b'); b.textContent=t; const s=document.createElement('span'); s.textContent=ha(e.t); it.append(b,s); g.append(it); }
  $('jornal').classList.add('on');
}
let tTicker=null;
function ticker(txt){ const k=$('manchete'); k.textContent='📰 '+txt; k.classList.add('on'); clearTimeout(tTicker); tTicker=setTimeout(()=>k.classList.remove('on'),7000); }
$('jornalBtn').addEventListener('click',e=>{ abrir(); e.currentTarget.blur(); });
$('jornalFechar').addEventListener('click',()=>$('jornal').classList.remove('on'));
$('jornal').addEventListener('click',e=>{ if(e.target.id==='jornal') $('jornal').classList.remove('on'); });

export async function iniciarJornal(){
  if(!await conectarNuvem()) return;
  ouvirJornal(l=>{
    lista=l.filter(e=>e&&typeof e.t==='number'&&manchete(e));
    const chave=e=>e.t+'|'+e.uid;
    if(vistos){ for(const e of lista) if(!vistos.has(chave(e))&&Date.now()-e.t<120000) ticker(manchete(e)); }   // nova enquanto joga
    vistos=new Set(lista.map(chave));
  });
}

// fatos que o jogo já avisa no letreiro do meio da tela
new MutationObserver(()=>{ const t=$('aviso').textContent;
  if(t.startsWith('PRESO')) noticiar('preso');
  else if(t.includes('despistou a polícia')) noticiar('fugiu');
  else if(t.startsWith('Terreno comprado!')) noticiar('terreno');
}).observe($('aviso'),{childList:true,characterData:true,subtree:true});
addEventListener('matelandia:negocio',e=>noticiar('abriu',{neg:e.detail.tipo}));
addEventListener('matelandia:fechou',e=>noticiar('fechou',{neg:e.detail.tipo}));
