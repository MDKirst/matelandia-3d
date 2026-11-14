// Rotina da cidade: cada tipo de lugar real (dados/lugares.json) tem horário de movimento.
// Escola enche na entrada e na saída das aulas, padaria cedo e no café da tarde, restaurante no
// almoço e na janta, bar e praça à noite, igreja no culto. Os pedestres usam isso para nascer em
// rodinha na porta, sair de dentro dos lugares e entrar neles quando passam na frente.
// É "realismo de mentira" (como o Oblivion fazia): ninguém tem casa nem emprego, só o horário pesa.

// [grupo, reconhece pela categoria/nome, curva [hora, movimento 0..1], peso (escola junta mais gente)]
const GRUPOS = [
  ['academia2',  /artes marciais|gym|fitness|academia|sport/i,
     [[0,0],[5.5,0],[6.2,1],[8.5,0.3],[17.5,0.4],[18.5,1],[21,0.3],[22,0],[24,0]], 1],
  ['escola',     /\bschool\b|col[eé]gio|(?<!auto)escola|creche|ceebja/i,
     [[0,0],[6.6,0],[7,1],[7.6,0.15],[11.4,0.15],[11.8,1],[12.4,0.2],[12.8,0.6],[13.2,0.1],[17,0.15],[17.4,1],[18,0],[24,0]], 3],
  ['padaria',    /bakery|padaria|panifica|coffee|caf[eé]|deli|confeitaria|food_and_beverage/i,
     [[0,0],[5.5,0],[6.3,1],[9,0.5],[11,0.3],[15,0.5],[16.5,0.9],[18.5,0.6],[20,0],[24,0]], 1.5],
  ['restaurante',/restaurant|eatery|lanchonete|pizzaria|churrascaria|hamburg/i,
     [[0,0],[10.8,0],[11.6,1],[13.6,0.2],[18.5,0.3],[19.8,1],[22.5,0.4],[23.5,0],[24,0]], 1.5],
  ['bar',        /\bbar\b|pub|boteco|choperia|amenity=bar|conveni[eê]ncia/i,
     [[0,0.8],[2,0.3],[3,0],[16,0],[18,0.6],[20,1],[24,0.8]], 1.5],
  ['igreja',     /worship|religious|igreja|par[oó]quia|templo|church|capela/i,
     [[0,0],[6.5,0],[7.5,0.7],[9,0],[18.6,0],[19.3,1],[20.6,0.6],[21,0],[24,0]], 2],
  ['academia',   /gym|fitness|academia|sport/i,
     [[0,0],[5.5,0],[6.2,1],[8.5,0.3],[17.5,0.4],[18.5,1],[21,0.3],[22,0],[24,0]], 1],
  ['saude',      /hospital|clinic|dental|pharmac|farm[aá]cia|medic|sa[uú]de|lab_|diagnos|physical_medicine/i,
     [[0,0.1],[7,0.2],[8,0.7],[17,0.6],[19,0.15],[24,0.1]], 1],
  ['posto',      /gas_station|fuel|posto/i,
     [[0,0.25],[6,0.6],[8,0.8],[19,0.8],[22,0.4],[24,0.25]], 0.8],
  ['comercio',   /./,
     [[0,0],[7.8,0],[8.5,0.8],[11.8,0.9],[12.2,0.5],[13.5,0.8],[18,0.7],[18.6,0],[24,0]], 0.6],
];
export const PRACA = [[0,0.05],[6,0.1],[9,0.3],[15,0.6],[17,1],[21,0.7],[23,0.15],[24,0.05]];

export function perfil(h, pts){
  for(let i=0;i<pts.length-1;i++){ const [a,va]=pts[i], [b,vb]=pts[i+1]; if(h>=a&&h<=b) return va+(vb-va)*(h-a)/((b-a)||1); }
  return pts[pts.length-1][1];
}
export function grupoDe(l){ const txt=(l.cat||'')+' '+(l.n||''); for(const g of GRUPOS) if(g[1].test(txt)) return g; return GRUPOS[GRUPOS.length-1]; }
export const movimento = (l,h)=>perfil(h,l.g[2]);
export const peso = l=>l.g[3];
export const nomeGrupo = l=>l.g[0].replace(/\d$/,'');

// falas que dependem da hora e do lugar
export function saudacao(h){ return h>=5&&h<12?['Bom dia!','Bom dia, vizinho!']:h>=12&&h<18.5?['Boa tarde!','Boa tarde, tudo bem?']:['Boa noite!','Boa noite, tudo certo?']; }
export const FALA_LUGAR = {
  escola:['Esperando meu filho sair da escola.','Hoje teve prova de matemática…','O sinal já vai tocar.','Vou chegar atrasado na aula!'],
  padaria:['O pão acabou de sair!','Vim buscar o pão quentinho.','Um cafezinho agora cai bem.'],
  restaurante:['O almoço aqui é bom demais.','Hora de comer!','Bora jantar?'],
  bar:['Bora assistir o jogo?','Só uma e já vou pra casa.','Aqui o pastel é famoso!'],
  igreja:['O culto já vai começar.','A missa foi bonita hoje.','Vim rezar um pouco.'],
  academia:['Hoje é dia de perna…','Bora treinar!','Tô cansado, mas firme!'],
  saude:['Vim pegar meu remédio.','A fila tá grande hoje.','Consulta marcada pra agora.'],
  posto:['Gasolina tá cara, hein!','Só vim calibrar o pneu.'],
  comercio:['Vim fazer umas comprinhas.','Tá tudo em promoção!','Já já fecha, corre!'],
  praca:['Que fim de tarde bonito!','A praça tá cheia hoje.','Sempre venho aqui à tardinha.'],
  madrugada:['Não consigo dormir…','Tô voltando do serviço.','Essa hora a cidade é silenciosa.'],
};
