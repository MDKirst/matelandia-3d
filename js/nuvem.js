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
      const vagas=Object.keys((await F.get(ref('donos/'+nuvem.uid)).catch(()=>null))?.val()||{}).length;   // terrenos do visitante atual
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
const ref=c=>F.ref(db,c);
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
export function ouvirLotes(cb){ if(!nuvem.ok) return; F.onValue(ref('lotes'),s=>cb(s.val()||{}),e=>console.warn('lotes',e)); }
// blocos de um terreno: cb(Map 'i,j,k' → valor)
export function ouvirBlocos(id, cb){
  if(!nuvem.ok) return;
  F.onValue(ref('blocos/'+id),s=>{ const m=new Map(); const v=s.val()||{}; for(const k in v) if(typeof v[k]==='number') m.set(celula(k),v[k]); cb(m); },e=>console.warn('blocos',e));
}
// tenta ficar com o terreno: grava o lote e ocupa uma das 2 vagas do jogador numa gravação só
// (as regras recusam se o lote já tem dono ou se não há vaga). Devolve 'ok', 'limite' ou 'ocupado'
export const LIMITE_TERRENOS=2;
export async function tomarLote(id, nome){
  if(!nuvem.ok) return 'ocupado';
  try{
    const vagas=(await F.get(ref('donos/'+nuvem.uid))).val()||{};
    const vaga=['s1','s2'].find(v=>!vagas[v]); if(!vaga) return 'limite';
    await F.update(ref(''),{ ['lotes/'+id]:{ dono:nuvem.uid, nome:(nome||'Visitante').slice(0,16) }, [`donos/${nuvem.uid}/${vaga}`]:id });
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
