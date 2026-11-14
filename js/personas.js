// Personas (como as de UX): cada bot da cidade tem um jeito que muda o que ele faz.
//  vel: ritmo do passo · vitrine/entrar: quanto para em loja e entra em lugar movimentado
//  segue: aceita seguir o jogador · briga: entra na turma contra quem avacalha (senão foge)
//  compra: quanto gasta (× valor da venda) · balcao: tempo no balcão (×) · recusa: recusa panfleto
export const PERSONAS = [
  { id:'apressado',   nome:'Apressado',   objetivo:'resolver tudo rápido',          vel:1.45, vitrine:0.08, entrar:0.6, segue:0.2, briga:0.35, compra:[0.8,1.0], balcao:0.55, recusa:0.6,
    falas:['Tô atrasado!','Não posso parar agora!','Rapidinho, por favor!'] },
  { id:'economico',   nome:'Econômico',   objetivo:'achar o melhor preço',          vel:1.0,  vitrine:0.6,  entrar:1.0, segue:0.6, briga:0.4,  compra:[0.45,0.7], balcao:1.4, recusa:0.1,
    falas:['Tá tudo caro, hein!','Tem promoção hoje?','Vou pesquisar mais um pouco.'] },
  { id:'curioso',     nome:'Curioso',     objetivo:'ver as novidades da cidade',    vel:1.05, vitrine:0.7,  entrar:1.4, segue:0.8, briga:0.3,  compra:[0.8,1.3], balcao:1.2, recusa:0.05,
    falas:['O que tem de novo por aqui?','Abriu loja nova, é?','Que legal isso!'] },
  { id:'sociavel',    nome:'Sociável',    objetivo:'encontrar os amigos',           vel:1.05, vitrine:0.3,  entrar:1.1, segue:1.0, briga:0.85, compra:[0.9,1.2], balcao:1.3, recusa:0.05,
    falas:['Oi! Quanto tempo!','Já conhece todo mundo aqui?','Bora tomar um café?'] },
  { id:'desconfiado', nome:'Desconfiado', objetivo:'não ser enganado',              vel:1.15, vitrine:0.25, entrar:0.7, segue:0.1, briga:0.1,  compra:[0.7,1.0], balcao:1.0, recusa:0.5,
    falas:['Hum… sei não.','Você não é daqui, né?','Não aceito nada de estranho.'] },
  { id:'esportista',  nome:'Esportista',  objetivo:'se exercitar',                  vel:1.4,  vitrine:0.12, entrar:0.8, segue:0.5, briga:1.0,  compra:[0.6,1.0], balcao:0.8, recusa:0.2,
    falas:['Bora caminhar!','Já fiz 5 km hoje!','Água e fruta, só isso.'] },
];
export const sortearPersona = ()=>PERSONAS[(Math.random()*PERSONAS.length)|0];
