# Conversa com moradores por IA

O jogador para, aperta **T** e, no papo livre, escreve o que quiser. O morador responde no personagem.
A IA roda num **Worker da Cloudflare** (plano grátis). O jogo só manda a fala e o contexto curto,
então nenhum modelo é baixado no navegador.

- `worker.js`: o servidor. Ele guarda a persona, as regras para alunos, o filtro de palavrão e o limite de 8 por minuto por IP.
- `personas.js`: é gerado por `gerar-personas.mjs` a partir de `js/moradores.js` + `js/conversa-dados.js`.
  **Mudou um morador? Rode `node tools/ia-papo/gerar-personas.mjs` e publique o Worker de novo.**
- `simular.mjs`: roda o mesmo Worker no PC com uma IA falsa, para testar sem a Cloudflare.
- No jogo: `js/ia-papo.js` (30 falas por dia por navegador) e `IA_PAPO` em `js/config.js`.
  Com `IA_PAPO` vazio, a caixa de texto não aparece.

## Publicar (uma vez)
1. Crie uma conta grátis em https://dash.cloudflare.com/sign-up.
2. Num terminal, dentro de `tools/ia-papo`:
   ```
   npx wrangler login
   npx wrangler deploy
   ```
   O `login` abre o navegador para você autorizar. O `deploy` mostra o endereço, algo como
   `https://matelandia-papo.SEUNOME.workers.dev`.
3. Cole esse endereço em `IA_PAPO` no `js/config.js`, faça o commit e o push.

## Cota grátis
Endereço publicado (27/11): https://matelandia-papo.ia-papo.workers.dev

Workers AI dá 10 mil "neurons" por dia. O modelo é o `llama-3.3-70b-instruct-fp8-fast`, que rende umas
300 respostas por dia. O 8B rende umas 2 mil, mas foi testado e desobedeceu: puxou namoro e barzinho. Quando a cota acaba, o morador volta às falas prontas e o jogo segue normal.
Para trocar o modelo, mude `MODELO` no `wrangler.toml` e rode `npx wrangler deploy`.
