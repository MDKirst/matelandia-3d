// Servidor de teste do Worker SEM Cloudflare: usa o worker.js de verdade com uma "IA" falsa.
//   node tools/ia-papo/simular.mjs   → http://127.0.0.1:8799  (pôr esse endereço em IA_PAPO só p/ testar)
import { createServer } from 'node:http';
import w from './worker.js';
const env={ AI:{ run:async(modelo,o)=>{ const u=o.messages.at(-1).content, s=o.messages[0].content;
  return { response:`[teste] Você disse "${u}". Sou ${s.match(/Você é ([^,]+)/)[1]}, amizade ${s.match(/(\d) de 5/)[1]}, ${o.messages.length} mensagens.` }; } } };
createServer(async(rq,rs)=>{ let b=''; for await(const c of rq) b+=c;
  const r=await w.fetch(new Request('http://x'+rq.url,{method:rq.method,headers:rq.headers,body:rq.method==='POST'?b:undefined}),env);
  rs.writeHead(r.status,Object.fromEntries(r.headers)); rs.end(await r.text()); }).listen(8799,'127.0.0.1',()=>console.log('simulador em http://127.0.0.1:8799'));
