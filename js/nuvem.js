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

export const nuvem={ ok:false, uid:null };
let db=null, F=null;

// conecta e faz o login anônimo; devolve true se deu certo (sem internet: o jogo segue só no navegador)
export async function conectarNuvem(){
  console.info('nuvem: conectando…');
  try{
    const [app,auth,base]=await Promise.all([import(`${CDN}/firebase-app.js`),import(`${CDN}/firebase-auth.js`),import(`${CDN}/firebase-database.js`)]);
    const a=app.initializeApp(CONFIG), au=auth.getAuth(a);
    const cred=au.currentUser||await new Promise(ok=>{ const sai=auth.onAuthStateChanged(au,u=>{ if(u){ sai(); ok(u); } }); auth.signInAnonymously(au).catch(e=>{ console.warn('login anônimo',e); ok(null); }); });
    if(!cred) return false;
    db=base.getDatabase(a); F=base; nuvem.uid=cred.uid; nuvem.ok=true; console.info('nuvem: conectado');
    return true;
  }catch(e){ console.warn('nuvem indisponível',e); return false; }
}
const ref=c=>F.ref(db,c);
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
