// 21/11: memória de textura no celular (o iPhone fechava a aba com ~460 MB de textura).
// - telaTex(w,h): canvas com a mesma área LÓGICA de desenho (w×h), mas com metade dos pixels
//   no modo leve: o código de desenho continua igual (o contexto já vem escalado).
// - texCache(chave, fazer): placas/letreiros iguais usam UMA textura só (antes: uma por lote).
//   Ninguém dá dispose nessas texturas, então compartilhar é seguro.
// - modelos GLB: no modo leve, textura maior que 512 é reduzida para 512 ao carregar.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { LEVE } from './config.js';

export const ESCALA_TEX = LEVE ? 0.5 : 1;
export function telaTex(w, h){
  const s=ESCALA_TEX, cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(w*s)); cv.height=Math.max(1,Math.round(h*s));
  const k=cv.getContext('2d'); k.scale(s,s); return [cv,k];
}
const cache=new Map();
export function texCache(chave, fazer){ let t=cache.get(chave); if(!t){ t=fazer(); cache.set(chave,t); } return t; }

const MAX_GLB = 512;
function reduzir(tex, vistos){
  if(!tex||!tex.isTexture||vistos.has(tex)) return; vistos.add(tex);
  const im=tex.image; if(!im||!im.width||Math.max(im.width,im.height)<=MAX_GLB) return;
  const f=MAX_GLB/Math.max(im.width,im.height), cv=document.createElement('canvas');
  cv.width=Math.round(im.width*f); cv.height=Math.round(im.height*f);
  cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
  if(im.close) im.close();   // ImageBitmap: libera já
  tex.image=cv; tex.needsUpdate=true;
}
if(LEVE){
  const parse=GLTFLoader.prototype.parse;
  GLTFLoader.prototype.parse=function(data,path,onLoad,onError){
    return parse.call(this,data,path,gltf=>{
      try{ const vistos=new Set(); gltf.scene.traverse(o=>{ for(const m of [].concat(o.material||[])) for(const v of Object.values(m)) if(v&&v.isTexture) reduzir(v,vistos); }); }catch(e){ console.warn('reduzir textura',e); }
      onLoad(gltf);
    },onError);
  };
}
