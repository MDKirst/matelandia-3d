// Quais lugares reais (dados/lugares.json) são COMÉRCIO. Pedido do Maicon (14/11/2026): os comércios
// prontos da cidade saem (prédio, letreiro e toldo) e o espaço vira terreno para os jogadores
// abrirem o próprio negócio. Ficam os lugares públicos: escola, igreja, prefeitura, hospital, praça…
export const NAO_LOJA = /loteamento|lotemento|residencial|jardim |condom[ií]nio|bairro|rodovia|br-?277|^pr-|estrada|promo[cç]/i;
const PUBLICO = /\bschool\b|amenity=school|place_of_learning|education|college|universi|escola|col[eé]gio|creche|ceebja|faculdade|worship|religio|igreja|par[oó]quia|templo|capela|church|government|prefeitura|c[aâ]mara|secretaria|f[oó]rum|cart[oó]rio|hospital|ubs|posto de sa[uú]de|police|pol[ií]cia|bombeiro|correios|post_office|community|cemit|stadium|est[aá]dio|gin[aá]sio|sports_hall|park|pra[çc]a|library|biblioteca|rodovi[aá]ria/i;

export const lugarValido = l=>!(l.f==='overture'&&(l.conf??0)<0.5);
export function ehComercio(l){
  if(!lugarValido(l)||NAO_LOJA.test(l.n||'')) return false;
  return !PUBLICO.test((l.cat||'')+' '+(l.n||''));
}

let cache=null;
export function carregarLugares(){
  return cache ??= fetch('dados/lugares.json').then(r=>r.ok?r.json():{lugares:[]}).then(d=>d.lugares||[]).catch(()=>[]);
}
