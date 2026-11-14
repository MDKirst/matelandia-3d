// Conquistas: ficam no navegador (localStorage). Aviso no canto quando ganha uma; lista no painel (🏆).
import { $ } from './cena.js';
import { somEntrega } from './som.js';

export const LISTA = [
  ['boas_vindas', '👋', 'Bem-vindo a Matelândia', 'Começou a jogar'],
  ['motorista',   '🚗', 'Primeira volta',          'Entrou num veículo'],
  ['frota',       '🔑', 'Colecionador de chaves',  'Dirigiu 5 veículos diferentes'],
  ['veloz',       '💨', 'Pé de chumbo',            'Passou de 100 km/h'],
  ['entregador',  '📦', 'Primeira entrega',        'Fez uma entrega'],
  ['entregador10','🚚', 'Entregador do mês',       'Fez 10 entregas'],
  ['proprietario','🏠', 'Dono do pedaço',          'Comprou um terreno'],
  ['construtor',  '🧱', 'Mão na massa',            'Colocou o primeiro bloco'],
  ['empresario',  '🏪', 'Empresário',              'Abriu um negócio no seu terreno'],
  ['mestre_obras','🏗️', 'Mestre de obras',         'Colocou 100 blocos'],
  ['papo',        '💬', 'Bom de papo',             'Conversou com 10 pedestres'],
  ['lider',       '🚶', 'Líder da turma',          'Teve 3 pessoas te seguindo'],
  ['explorador',  '🧭', 'Explorador',              'Passou por 25 ruas diferentes'],
  ['coruja',      '🦉', 'Coruja',                  'Andou pela cidade de madrugada'],
  ['procurado',   '⭐', 'Procurado',               'Chegou a 3 estrelas'],
  ['fugitivo',    '🏃', 'Fugitivo',                'Despistou a polícia'],
  ['xadrez',      '🚔', 'Sol nascendo quadrado',   'Foi preso'],
  ['trabalhador', '💼', 'Trabalhador',             'Terminou um trabalho de gari ou panfletagem'],
  ['surra',       '🥊', 'Aprendeu a lição',        'Apanhou da turma por avacalhar'],
  ['fotografo',   '📷', 'Fotógrafo',               'Tirou uma foto'],
  ['encontro',    '🤝', 'Encontro marcado',        'Ficou perto de outro jogador online'],
];
const CHAVE='matelandia3d.conquistas';
const dados=(()=>{ try{ const d=JSON.parse(localStorage.getItem(CHAVE)); if(d&&d.tem) return d; }catch(e){} return { tem:{}, cont:{}, ruas:[], veic:[] }; })();
const salvar=()=>{ try{ localStorage.setItem(CHAVE,JSON.stringify(dados)); }catch(e){} };

export const tem = id=>!!dados.tem[id];
const fila=[]; let mostrando=false;
export function ganhar(id){
  if(dados.tem[id]) return false; const c=LISTA.find(x=>x[0]===id); if(!c) return false;
  dados.tem[id]=Date.now(); salvar(); fila.push(c); if(!mostrando) proximo(); placar(); return true;
}
// contador: ganha quando chega no alvo
export function contar(id, alvo, chave=id){ if(dados.tem[id]) return; dados.cont[chave]=(dados.cont[chave]||0)+1; salvar(); if(dados.cont[chave]>=alvo) ganhar(id); }
// conjunto: ganha quando junta N itens diferentes (ruas, veículos)
export function colecionar(id, lista, item, alvo){ if(dados.tem[id]||!item) return; const l=dados[lista]; if(l.includes(item)) return; l.push(item); salvar(); if(l.length>=alvo) ganhar(id); }

function proximo(){
  const c=fila.shift(); if(!c){ mostrando=false; return; } mostrando=true;
  const t=$('trofeu'); t.replaceChildren();
  const i=document.createElement('div'); i.className='ic'; i.textContent=c[1];
  const tx=document.createElement('div'); const s=document.createElement('small'); s.textContent='🏆 Conquista'; const b=document.createElement('b'); b.textContent=c[2]; const d=document.createElement('span'); d.textContent=c[3];
  tx.append(s,b,d); t.append(i,tx); t.classList.add('on');
  try{ somEntrega(true); }catch(e){}
  setTimeout(()=>{ t.classList.remove('on'); setTimeout(proximo,450); }, 3800);
}

function placar(){ const n=Object.keys(dados.tem).length; $('trofeuBtn').textContent=`🏆 ${n}/${LISTA.length}`; }
function abrirLista(){
  const g=$('conqLista'); g.replaceChildren();
  for(const [id,ic,nome,desc] of LISTA){ const ok=!!dados.tem[id], el=document.createElement('div'); el.className='item'+(ok?' ok':'');
    const a=document.createElement('div'); a.className='ic'; a.textContent=ok?ic:'🔒';
    const tx=document.createElement('div'); const b=document.createElement('b'); b.textContent=nome; const s=document.createElement('span'); s.textContent=desc; tx.append(b,s);
    el.append(a,tx); g.append(el); }
  $('conqTit').textContent=`🏆 Conquistas · ${Object.keys(dados.tem).length} de ${LISTA.length}`;
  $('conquistas').classList.add('on');
}
$('trofeuBtn').addEventListener('click',e=>{ abrirLista(); e.currentTarget.blur(); });
$('conqFechar').addEventListener('click',()=>$('conquistas').classList.remove('on'));
$('conquistas').addEventListener('click',e=>{ if(e.target.id==='conquistas') $('conquistas').classList.remove('on'); });
placar();

// avisos do jogo que valem conquista (entregas, terreno, polícia avisam pelo mesmo letreiro)
new MutationObserver(()=>{ const t=$('aviso').textContent;
  if(t.startsWith('Entrega feita!')){ ganhar('entregador'); contar('entregador10',10,'entregas'); }
  else if(t.startsWith('Terreno comprado!')) ganhar('proprietario');
  else if(t.includes('despistou a polícia')) ganhar('fugitivo');
  else if(t.startsWith('PRESO')) ganhar('xadrez');
}).observe($('aviso'),{childList:true,characterData:true,subtree:true});
addEventListener('matelandia:negocio',()=>ganhar('empresario'));
addEventListener('matelandia:trabalho',()=>ganhar('trabalhador'));
addEventListener('matelandia:surra',()=>ganhar('surra'));
addEventListener('matelandia:bloco',()=>{ ganhar('construtor'); contar('mestre_obras',100,'blocos'); });
