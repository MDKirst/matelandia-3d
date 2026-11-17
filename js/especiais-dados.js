// Lotes especiais à venda (pedido do Maicon em 17/11): 3 postos de gasolina na marginal da BR-277
// (Av. Paraná e Av. JK) e uma balada grande na Av. Paraná. Lugares achados por sonda: retângulo sem
// prédio, rua ou terreno comum. Nomes fictícios (regra do jogo: letreiro nunca com nome real).
// frente: meio da frente do lote, já na beira da calçada · t: ao longo da rua · n: para dentro do lote
export const ESPECIAIS = [
  { tipo:'posto',  nome:'Auto Posto Ipê',      frente:[379.9,295.1],  t:[0.9965,0.0832],   n:[0.0832,-0.9965], w:24, d:20, preco:30000, hora:2500, cor:0x16a34a },
  { tipo:'posto',  nome:'Posto Trevo',         frente:[-197.3,723.6], t:[0.6408,-0.7677],  n:[0.7677,0.6408],  w:24, d:20, preco:30000, hora:2500, cor:0x2563eb },
  { tipo:'posto',  nome:'Posto Bem-te-vi',     frente:[882.8,311.6],  t:[-0.8779,0.4788],  n:[0.4788,0.8779],  w:24, d:20, preco:30000, hora:2500, cor:0xdc2626 },
  { tipo:'balada', nome:'Vórtice Club',        frente:[-520.7,212.9], t:[-0.9969,-0.0788], n:[0.0788,-0.9969], w:30, d:24, preco:50000, hora:4000, cor:0xd946ef },
];
// no formato dos terrenos (terrenos.js): A = canto, t = frente (+x local), n = fundo (+z local), com n à esquerda de t
export function comoLote(e){
  let t=e.t, A=[e.frente[0]-t[0]*e.w/2, e.frente[1]-t[1]*e.w/2];
  if(e.n[0]*(-t[1])+e.n[1]*t[0]<0){ A=[A[0]+t[0]*e.w, A[1]+t[1]*e.w]; t=[-t[0],-t[1]]; }
  const cx=A[0]+t[0]*e.w/2+e.n[0]*e.d/2, cz=A[1]+t[1]*e.w/2+e.n[1]*e.d/2;
  return { A, t, n:e.n, cx, cz, w:e.w, d:e.d, preco:e.preco, especial:e };
}
