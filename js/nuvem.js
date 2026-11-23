// Mundo compartilhado (Firebase Realtime Database): dono de cada terreno e os blocos construídos.
// Todos veem as construções na hora, e elas ficam gravadas mesmo com ninguém online.
// Login anônimo: cada navegador vira um "dono" (sem cadastro). As regras do banco (tools/regras-firebase.json)
// garantem que só o dono mexe no próprio terreno. Dinheiro continua no navegador de cada um.
const V='10.12.2', CDN=`https://www.gstatic.com/firebasejs/${V}`;
const CONFIG={
  apiKey:'AIzaSyDccC3haI081sBhFV9CCsbintSWRVdd7f0',          // chave pública do app web (não é senha)
  authDomain:'matelandia-3d.firebaseapp.com',
  databaseURL:'https://matelandia-3d-default-rtdb.firebaseio.com',
  projectId:'matelandia-3d',
  storageBucket:'matelandia-3d.firebasestorage.app',
  messagingSenderId:'322076732588',
  appId:'1:322076732588:web:aee542cb9bd3d5ed1c8309',
};

// conta: null = anônimo; {nome, foto} = entrou com o Google (o e-mail não é guardado no banco nem mostrado)
export const nuvem={ ok:false, uid:null, conta:null };
let db=null, F=null, A=null, au=null, ligando=null;
const ouvintesConta=new Set();
export function aoTrocarConta(cb){ ouvintesConta.add(cb); }
function marcarConta(u){
  const g=u&&!u.isAnonymous&&u.providerData.find(p=>p.providerId==='google.com');
  const antes=nuvem.uid; nuvem.uid=u?u.uid:null; nuvem.conta=g?{ nome:g.displayName||u.displayName||'', foto:g.photoURL||'' }:null;
  for(const cb of ouvintesConta) try{ cb(nuvem, antes!==nuvem.uid); }catch(e){ console.warn(e); }
}

// conecta e faz o login (anônimo, ou o Google de quem já entrou antes); devolve true se deu certo
// (sem internet: o jogo segue só no navegador). Pode ser chamada várias vezes: conecta uma só.
export function conectarNuvem(){ return ligando ??= ligar(); }
async function ligar(){
  console.info('nuvem: conectando…');
  try{
    const [app,auth,base]=await Promise.all([import(`${CDN}/firebase-app.js`),import(`${CDN}/firebase-auth.js`),import(`${CDN}/firebase-database.js`)]);
    const a=app.initializeApp(CONFIG); au=auth.getAuth(a); A=auth;
    const cred=await new Promise(ok=>{ const sai=auth.onAuthStateChanged(au,u=>{ if(u){ sai(); ok(u); } else auth.signInAnonymously(au).catch(e=>{ console.warn('login anônimo',e); sai(); ok(null); }); }); });
    if(!cred) return false;
    db=base.getDatabase(a); F=base; nuvem.ok=true; marcarConta(cred); console.info('nuvem: conectado');
    auth.onAuthStateChanged(au,u=>{ if(u&&u.uid!==nuvem.uid) marcarConta(u); });
    contarVisita();
    return true;
  }catch(e){ console.warn('nuvem indisponível',e); return false; }
}

// Entrar com o Google. Liga a conta Google à identidade anônima deste navegador: os terrenos continuam seus.
// Se essa conta Google já foi usada em outro aparelho, entra nela (os terrenos de lá vêm junto).
// Devolve 'ok' | 'trocou' (entrou numa conta que já existia) | 'cancelado' | 'bloqueado' | 'erro'
export async function entrarGoogle(confirmarTroca){
  if(!await conectarNuvem()) return 'erro';
  const prov=new A.GoogleAuthProvider(); prov.setCustomParameters({prompt:'select_account'});
  try{ const r=await A.linkWithPopup(au.currentUser,prov); await r.user.reload(); marcarConta(au.currentUser); return 'ok'; }
  catch(e){
    if(e.code==='auth/credential-already-in-use'){
      const c=A.GoogleAuthProvider.credentialFromError(e); if(!c) return 'erro';
      const vagas=Object.values(ultLotes).filter(d=>d?.dono===nuvem.uid).length;   // terrenos do visitante atual
      if(vagas&&confirmarTroca&&!await confirmarTroca(vagas)) return 'cancelado';
      await A.signInWithCredential(au,c); marcarConta(au.currentUser); return 'trocou';
    }
    if(e.code==='auth/popup-closed-by-user'||e.code==='auth/cancelled-popup-request') return 'cancelado';
    if(e.code==='auth/popup-blocked') return 'bloqueado';
    console.warn('entrar com Google',e); return 'erro';
  }
}
// Sair da conta Google: este navegador volta a ser um visitante anônimo novo (os terrenos ficam na conta Google)
export async function sairGoogle(){
  if(!A||!au) return; await A.signOut(au); const r=await A.signInAnonymously(au); marcarConta(r.user);
}
const ref=c=>c?F.ref(db,c):F.ref(db);   // ref('') = raiz (o Firebase recusa caminho vazio: a compra de terreno e casa dos jogadores falhava)
// contador de visitas: uma marca por navegador por dia (visitas/AAAA-MM-DD/uid, dia no horário de Brasília).
// Não guarda nome nem nada da pessoa; a regra só deixa gravar a própria marca, uma vez. Falha em silêncio.
function contarVisita(){
  if(/^(localhost|127\.|\[::1\])/.test(location.hostname)) return;      // teste no PC não conta
  const dia=new Date(Date.now()-3*3600e3).toISOString().slice(0,10);
  F.set(ref(`visitas/${dia}/${nuvem.uid}`),true).catch(()=>{});          // recusada = já contou hoje
}
const chave=k=>k.split(',').join('_');            // '3,4,0' → '3_4_0' (vírgula vira _ no banco)
const celula=c=>c.split('_').join(',');

// donos: cb({ id:{dono,nome} }) a cada mudança
let ultLotes={};   // última foto de lotes/ (para contar os terrenos do visitante ao trocar de conta)
export function ouvirLotes(cb){ if(!nuvem.ok) return; F.onValue(ref('lotes'),s=>{ ultLotes=s.val()||{}; cb(ultLotes); },e=>console.warn('lotes',e)); }
// blocos de um terreno: cb(Map 'i,j,k' → valor)
export function ouvirBlocos(id, cb){
  if(!nuvem.ok) return;
  F.onValue(ref('blocos/'+id),s=>{ const m=new Map(); const v=s.val()||{}; for(const k in v) if(typeof v[k]==='number') m.set(celula(k),v[k]); cb(m); },e=>console.warn('blocos',e));
}
// tenta ficar com o terreno (as regras recusam se o lote já tem dono). Devolve 'ok' ou 'ocupado'.
// 17/11: SEM limite de terrenos por jogador (pedido do Maicon); antes eram 2 vagas em donos/{uid}/s1|s2.
// admin (conta Google do criador do jogo): personagem Maicon e outras coisas só dele
export const ADMINS=['MyJ32756ZkMyoQiaboetnmrVPgr2'];
export const souAdmin=()=>nuvem.ok&&ADMINS.includes(nuvem.uid);
export async function tomarLote(id, nome){
  if(!nuvem.ok) return 'ocupado';
  try{
    await F.set(ref('lotes/'+id),{ dono:nuvem.uid, nome:(nome||'Visitante').slice(0,16) });
    return 'ok';
  }catch(e){ console.warn('tomarLote',e); return 'ocupado'; }
}
export function porBloco(id, k, v){ if(nuvem.ok) F.set(ref(`blocos/${id}/${chave(k)}`),v).catch(e=>console.warn('porBloco',e)); }
export function tirarBloco(id, k){ if(nuvem.ok) F.remove(ref(`blocos/${id}/${chave(k)}`)).catch(e=>console.warn('tirarBloco',e)); }
// sobe de uma vez (migração do que estava só no navegador)
export function subirBlocos(id, blocos){
  if(!nuvem.ok||!blocos.size) return; const tudo={}; for(const [k,v] of blocos) tudo[chave(k)]=v;
  F.update(ref('blocos/'+id),tudo).catch(e=>console.warn('subirBlocos',e));
}

// negócios: negocios/{lote} = { t:'padaria', desde:ms }. Só o dono do lote grava (ver regras).
export function ouvirNegocios(cb){ if(!nuvem.ok) return; F.onValue(ref('negocios'),s=>cb(s.val()||{}),e=>console.warn('negocios',e)); }
export async function abrirNegocioNuvem(id, tipo){ if(!nuvem.ok) return true; try{ await F.set(ref('negocios/'+id),{ t:tipo, desde:Date.now() }); return true; }catch(e){ console.warn('abrirNegocio',e); return false; } }
export function renomearNegocioNuvem(id, nome){ if(!nuvem.ok) return; (nome?F.set(ref(`negocios/${id}/n`),nome):F.remove(ref(`negocios/${id}/n`))).catch(e=>console.warn('renomear',e)); }
export async function fecharNegocioNuvem(id){ if(!nuvem.ok) return true; try{ await F.remove(ref('negocios/'+id)); return true; }catch(e){ console.warn('fecharNegocio',e); return false; } }

// jornal da cidade: jornal/{id} = { tipo, nome, rua?, neg?, uid, t }. Só tipos fixos (o texto é montado no jogo).
export function ouvirJornal(cb){ if(!nuvem.ok) return;
  F.onValue(F.query(ref('jornal'),F.orderByChild('t'),F.limitToLast(25)),s=>{ const l=[]; s.forEach(c=>{ l.push(c.val()); }); cb(l); },e=>console.warn('jornal',e)); }
export function postarJornal(ev){ if(!nuvem.ok) return; F.push(ref('jornal'),{ ...ev, uid:nuvem.uid, t:Date.now() }).catch(e=>console.warn('jornal',e)); }

// casas prontas: casas/{id} = { dono, nome }; donosCasa/{uid} = id (uma por jogador; o admin pode mais)
export function ouvirCasas(cb){ if(!nuvem.ok) return; F.onValue(ref('casas'),s=>cb(s.val()||{}),e=>console.warn('casas',e)); }
export async function comprarCasaNuvem(id, nome){
  if(!nuvem.ok) return 'ocupado';
  try{
    const dado={ dono:nuvem.uid, nome:(nome||'Visitante').slice(0,16) };
    if(souAdmin()){ await F.set(ref('casas/'+id),dado); return 'ok'; }
    if((await F.get(ref('donosCasa/'+nuvem.uid))).exists()) return 'limite';
    await F.update(ref(''),{ ['casas/'+id]:dado, ['donosCasa/'+nuvem.uid]:id });
    return 'ok';
  }catch(e){ console.warn('comprarCasa',e); return 'ocupado'; }
}

// dinheiro e caixa dos negócios na conta: jogadores/{uid} = { saldo, negocios:{lote:{coleta,vendas}}, t }
export async function lerJogador(){ if(!nuvem.ok) return null; try{ return (await F.get(ref('jogadores/'+nuvem.uid))).val(); }catch(e){ console.warn('lerJogador',e); return null; } }
export function gravarJogador(d){ if(!nuvem.ok) return; F.set(ref('jogadores/'+nuvem.uid),d).catch(e=>console.warn('gravarJogador',e)); }

// Personagem próprio (20/11): o aluno monta o personagem na Oficina (oficina.html) e sobe o GLB.
// personagens/{uid} = { nome, partes, tam, t, status:'pendente'|'aprovado'|'recusado' } (todos leem)
// personagensArq/{uid}/{0..7} = pedaços do GLB em base64 (≤ 600 mil caracteres cada).
// Só conta Google envia; o dono vê o dele na hora, os outros só depois que o admin aprova.
// Trocar o arquivo volta para 'pendente' (a regra não deixa mexer no arquivo de um personagem aprovado).
export const PERS_MAX=3_400_000, PERS_PEDACO=600_000;
const paraB64=buf=>{ const b=new Uint8Array(buf); let s=''; for(let i=0;i<b.length;i+=0x8000) s+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000)); return btoa(s); };
const deB64=s=>{ const t=atob(s), b=new Uint8Array(t.length); for(let i=0;i<t.length;i++) b[i]=t.charCodeAt(i); return b; };
export async function lerPersonagemInfo(uid){ if(!await conectarNuvem()) return null; try{ return (await F.get(ref('personagens/'+uid))).val(); }catch(e){ console.warn('personagem',e); return null; } }
export function ouvirPersonagens(cb){ if(!nuvem.ok) return ()=>{}; return F.onValue(ref('personagens'),s=>cb(s.val()||{}),e=>console.warn('personagens',e)); }
// baixa o GLB (ArrayBuffer) ou null; cache por uid+t enquanto a aba estiver aberta
const persCache=new Map();
export async function baixarPersonagem(uid, info){
  if(!await conectarNuvem()) return null;
  info??=await lerPersonagemInfo(uid); if(!info) return null;
  const k=uid+':'+info.t;
  if(!persCache.has(k)) persCache.set(k,(async()=>{
    const v=(await F.get(ref('personagensArq/'+uid))).val(); if(!v) return null;
    const partes=[]; for(let i=0;i<info.partes;i++){ if(typeof v[i]!=='string') return null; partes.push(deB64(v[i])); }
    const tot=partes.reduce((a,p)=>a+p.length,0), out=new Uint8Array(tot); let o=0; for(const p of partes){ out.set(p,o); o+=p.length; }
    return out.buffer;
  })().catch(e=>{ console.warn('baixar personagem',e); persCache.delete(k); return null; }));
  return persCache.get(k);
}
// envia o GLB da conta atual. Devolve 'ok' | 'sem-google' | 'grande' | 'erro'
export async function enviarPersonagem(buf, nome, progresso){
  if(!await conectarNuvem()) return 'erro';
  if(!nuvem.conta) return 'sem-google';
  if(buf.byteLength>PERS_MAX) return 'grande';
  try{
    await au.currentUser.getIdToken(true);            // o token passa a ter o e-mail do Google (a regra confere)
    const b64=paraB64(buf), partes=[]; for(let i=0;i<b64.length;i+=PERS_PEDACO) partes.push(b64.slice(i,i+PERS_PEDACO));
    const uid=nuvem.uid;
    await F.set(ref('personagens/'+uid),{ nome:String(nome||'Meu personagem').slice(0,16), partes:partes.length, tam:buf.byteLength, t:Date.now(), status:'pendente' });
    await F.remove(ref('personagensArq/'+uid));
    for(let i=0;i<partes.length;i++){ await F.set(ref(`personagensArq/${uid}/${i}`),partes[i]); progresso?.((i+1)/partes.length); }
    return 'ok';
  }catch(e){ console.warn('enviar personagem',e); return 'erro'; }
}
// apaga primeiro a ficha (a regra só deixa mexer no arquivo de quem não está aprovado)
export async function apagarPersonagem(){ if(!nuvem.ok) return; await F.remove(ref('personagens/'+nuvem.uid)).catch(()=>{}); await F.remove(ref('personagensArq/'+nuvem.uid)).catch(()=>{}); }
// admin: aprova ou recusa
// A aprovação vale só para o arquivo que o admin viu: grava o SHA-256 dele junto. Quem baixa confere o hash
// (se o aluno trocar o arquivo entre o "Ver" e o "Aprovar", o hash não bate e os outros veem o boneco padrão).
export async function hashDe(buf){ const h=await crypto.subtle.digest('SHA-256',buf); return [...new Uint8Array(h)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
export async function decidirPersonagem(uid, status, hash){ if(!souAdmin()) return false;
  try{ await F.update(ref('personagens/'+uid), status==='aprovado'?{ status, hash }:{ status, hash:null }); return true; }catch(e){ console.warn('decidir',e); return false; } }
// baixa sem cache (o admin sempre vê o que está no banco agora)
export function esquecerPersonagem(uid){ for(const k of [...persCache.keys()]) if(k.startsWith(uid+':')) persCache.delete(k); }
