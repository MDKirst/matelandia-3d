// Gera personas.js (usado pelo Worker) a partir dos dados do próprio jogo:
// js/moradores.js (MORADORES) + js/conversa-dados.js (EXTRA). Rodar sempre que mudar um morador:
//   node tools/ia-papo/gerar-personas.mjs
import { readFileSync, writeFileSync } from 'node:fs';
const raiz=new URL('../../', import.meta.url);
const ler=f=>readFileSync(new URL(f,raiz),'utf8');
function literal(txt, inicio){ const i=txt.indexOf(inicio); if(i<0) throw new Error('não achei '+inicio);
  const a=txt.indexOf('{',i); let n=0;
  for(let j=a;j<txt.length;j++){ const c=txt[j]; if(c==='{') n++; else if(c==='}'&&--n===0) return Function('return '+txt.slice(a,j+1))(); } }
const M=literal(ler('js/moradores.js'),'const MORADORES');
const E=literal(ler('js/conversa-dados.js'),'export const EXTRA');
const P={};
for(const [id,m] of Object.entries(M)){
  P[id]={ nome:m.nome, quem:m.quem,
    historia:m.cenas.slice(0,3).map(c=>c[0]),            // apresentação, história, coisa estranha
    prova:m.prova, peca:m.peca, porque:m.porque,
    papo:(E[id]?.papo)||[] };
}
writeFileSync(new URL('personas.js',import.meta.url),
  '// GERADO por gerar-personas.mjs — não editar à mão.\nexport const PERSONAS = '+JSON.stringify(P,null,1)+';\n');
console.log('personas:',Object.keys(P).length);
