// Conversa livre com moradores por IA (27/11, pedido do Maicon). A IA roda num Worker da Cloudflare
// (tools/ia-papo/worker.js): o jogo só manda a fala e recebe a resposta — nada de modelo baixado no navegador.
// Sem endereço configurado, sem internet ou cota do dia acabada → devolve null e o morador usa as falas prontas.
import { IA_PAPO } from './config.js';
import { limparFala } from './online.js';

const CHAVE = 'matelandia3d.iapapo', POR_DIA = 60, ESPERA_MS = 12e3;
const hoje = () => new Date().toISOString().slice(0, 10);
function conta() { try { const d = JSON.parse(localStorage.getItem(CHAVE)); if (d?.dia === hoje()) return d; } catch (e) {} return { dia: hoje(), n: 0 }; }

export const iaLigada = () => !!IA_PAPO;
export const iaRestante = () => Math.max(0, POR_DIA - conta().n);

// ctx = { id, fala, amizade, hora, noticias:[...], fato, hist:[{q,r}] }
export async function perguntarIA(ctx) {
  if (!IA_PAPO || iaRestante() <= 0) return null;
  const d = conta(); d.n++; try { localStorage.setItem(CHAVE, JSON.stringify(d)); } catch (e) {}
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ESPERA_MS);
  try {
    const r = await fetch(IA_PAPO, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ctx), signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    return limparFala(j?.r || '').length ? String(j.r).slice(0, 320) : null;
  } catch (e) { return null; }
  finally { clearTimeout(t); }
}
