// Ruas e prédios do OpenStreetMap. Ordem de carga:
// <script id="cidade-embutida"> > dados/matelandia.json > Overpass / API do OSM ao vivo
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { scene, flat, $ } from './cena.js';
import { toXZ } from './geo.js';
import { LIMITE, OVERPASS, OSM_API, DADOS_CIDADE } from './config.js';

const LARGURA = {motorway:13,trunk:12,primary:10,secondary:9,tertiary:8,residential:7,unclassified:7,living_street:6,
  motorway_link:7,trunk_link:7,primary_link:7,secondary_link:7,tertiary_link:7,service:4,track:3.5,
  pedestrian:4,footway:1.8,path:1.5,cycleway:2,steps:1.8};
const A_PE = new Set(['pedestrian','footway','path','cycleway','steps']);
const matRua   = new THREE.MeshBasicMaterial(flat({color:0x34373c,side:THREE.DoubleSide}));
const matFaixa = new THREE.MeshBasicMaterial(flat({color:0xe9c24a,side:THREE.DoubleSide}));
const matPe    = new THREE.MeshBasicMaterial(flat({color:0xd9cdb8,side:THREE.DoubleSide}));
const matPredio= new THREE.MeshLambertMaterial({vertexColors:true});
const PAREDES = [0xe8dcc8,0xd9c7a8,0xcfd6da,0xe3b9a0,0xc9d3b5,0xf0e6d6,0xb9c4cf,0xd8b08c].map(c=>new THREE.Color(c));
const TELHADOS= [0xa5553a,0x8f4a35,0x9a9a96,0x6f7377,0xb0603f].map(c=>new THREE.Color(c));

export const ruas=[];     // {nome,tipo,pts,bb,w,pe}
export const predios=[];  // {pts,bb}
const vistos=new Set();
let carregando=true, erroRede=false, fonte='OpenStreetMap ao vivo';

function fita(pts,w,out){
  const n=pts.length; if(n<2) return; const h=w/2, b=out.pos.length/3;
  for(let i=0;i<n;i++){
    const a=pts[Math.max(i-1,0)], c=pts[Math.min(i+1,n-1)];
    let dx=c[0]-a[0], dz=c[1]-a[1]; const l=Math.hypot(dx,dz)||1; dx/=l; dz/=l;
    out.pos.push(pts[i][0]-dz*h,0,pts[i][1]+dx*h, pts[i][0]+dz*h,0,pts[i][1]-dx*h);
  }
  for(let i=0;i<n-1;i++){ const k=b+i*2; out.idx.push(k,k+1,k+2, k+1,k+3,k+2); }
}
function malha(out,mat,ordem){
  if(!out.idx.length) return;
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(out.pos,3)); g.setIndex(out.idx);
  const m=new THREE.Mesh(g,mat); m.renderOrder=ordem; m.frustumCulled=false; scene.add(m);
}
export const bbox = pts=>{ let a=1e9,b=1e9,c=-1e9,d=-1e9; for(const p of pts){ if(p[0]<a)a=p[0]; if(p[1]<b)b=p[1]; if(p[0]>c)c=p[0]; if(p[1]>d)d=p[1]; } return [a,b,c,d]; };

function construir(elements){
  const R={pos:[],idx:[]}, F={pos:[],idx:[]}, P={pos:[],idx:[]}, geos=[];
  for(const el of elements){
    if(el.type!=='way'||!el.geometry||vistos.has(el.id)) continue;
    vistos.add(el.id);
    const t=el.tags||{}; const pts=el.geometry.map(g=>toXZ(g.lat,g.lon));
    if(t.building){
      if(pts.length>1){ const a=pts[0], z=pts[pts.length-1]; if(a[0]===z[0]&&a[1]===z[1]) pts.pop(); }
      if(pts.length<3) continue;
      let h=parseFloat(t.height)||(parseFloat(t['building:levels'])*3.2)||(3.4+(el.id%7)*0.5);
      h=Math.min(Math.max(h,2.5),120);
      try{
        const s=new THREE.Shape(pts.map(p=>new THREE.Vector2(p[0],-p[1])));
        const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false}).rotateX(-Math.PI/2);
        const nrm=g.attributes.normal, cor=new Float32Array(nrm.count*3);
        const pa=PAREDES[el.id%PAREDES.length], te=TELHADOS[el.id%TELHADOS.length];
        for(let i=0;i<nrm.count;i++){ const c=nrm.getY(i)>0.9?te:pa; cor[i*3]=c.r; cor[i*3+1]=c.g; cor[i*3+2]=c.b; }
        g.setAttribute('color',new THREE.BufferAttribute(cor,3)); g.deleteAttribute('uv');
        geos.push(g); predios.push({pts,bb:bbox(pts)});
      }catch(e){}
    } else if(t.highway && LARGURA[t.highway] && t.area!=='yes'){
      const w=LARGURA[t.highway], pe=A_PE.has(t.highway);
      fita(pts,w,pe?P:R);
      if(!pe&&w>=7) fita(pts,0.16,F);
      ruas.push({nome:t.name||'',tipo:t.highway,pts,bb:bbox(pts),w,pe});
    }
  }
  malha(P,matPe,-6); malha(R,matRua,-5); malha(F,matFaixa,-4);
  if(geos.length){ const g=mergeGeometries(geos,false); if(g){ scene.add(new THREE.Mesh(g,matPredio)); } geos.forEach(x=>x.dispose()); }
}

// API oficial do OSM (XML): converte para o mesmo formato do Overpass "out geom"
function xmlParaElementos(txt){
  const doc=new DOMParser().parseFromString(txt,'application/xml'), nos=new Map(), els=[];
  for(const n of doc.getElementsByTagName('node')) nos.set(n.getAttribute('id'),{lat:+n.getAttribute('lat'),lon:+n.getAttribute('lon')});
  for(const w of doc.getElementsByTagName('way')){
    const tags={}; for(const t of w.getElementsByTagName('tag')) tags[t.getAttribute('k')]=t.getAttribute('v');
    if(!tags.highway&&!tags.building) continue;
    const geometry=[]; for(const nd of w.getElementsByTagName('nd')){ const p=nos.get(nd.getAttribute('ref')); if(p) geometry.push(p); }
    els.push({type:'way',id:+w.getAttribute('id'),tags,geometry});
  }
  if(!els.length) throw new Error('vazio'); return els;
}

// pergunta a todos os servidores ao mesmo tempo e usa o primeiro que responder
async function baixarCidade(){
  const bb=`${LIMITE.s},${LIMITE.w},${LIMITE.n},${LIMITE.e}`;
  const q=`[out:json][timeout:60];(way["highway"](${bb});way["building"](${bb}););out geom;`;
  const acs=[];
  const tent=OVERPASS.map(url=>{ const ac=new AbortController(); acs.push(ac); const tm=setTimeout(()=>ac.abort(),60000);
    return fetch(url,{method:'POST',body:'data='+encodeURIComponent(q),headers:{'Content-Type':'application/x-www-form-urlencoded'},signal:ac.signal})
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(j=>{ if(!j.elements||!j.elements.length) throw new Error('vazio'); return j.elements; })
      .finally(()=>clearTimeout(tm)); });
  { const ac=new AbortController(); acs.push(ac); const tm=setTimeout(()=>ac.abort(),60000);
    tent.push(fetch(OSM_API+`?bbox=${LIMITE.w},${LIMITE.s},${LIMITE.e},${LIMITE.n}`,{signal:ac.signal})
      .then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.text(); })
      .then(xmlParaElementos).finally(()=>clearTimeout(tm))); }
  try{ return await Promise.any(tent); } finally{ acs.forEach(x=>x.abort()); }
}

export async function carregarCidade(){
  const emb=document.getElementById('cidade-embutida');
  if(emb){ try{ construir(JSON.parse(emb.textContent).elements); carregando=false; fonte='dados salvos no arquivo'; status(); return; }catch(e){ console.warn(e); } }
  try{
    const r=await fetch(DADOS_CIDADE); if(!r.ok) throw new Error('HTTP '+r.status);
    const j=await r.json(); if(!j.elements?.length) throw new Error('vazio');
    construir(j.elements); carregando=false; fonte='dados locais'+(j.meta?.baixado_em?' de '+j.meta.baixado_em.split('-').reverse().join('/'):''); status(); return;
  }catch(e){ console.warn('Sem '+DADOS_CIDADE+', baixando do OpenStreetMap:',e); }
  for(;;){
    try{ construir(await baixarCidade()); erroRede=false; carregando=false; status(); return; }
    catch(e){ console.warn('OSM',e); erroRede=true; status(); await new Promise(r=>setTimeout(r,8000)); }
  }
}

export function status(){
  $('status').textContent = erroRede ? 'Sem resposta do OpenStreetMap — tentando de novo…'
    : carregando ? 'Carregando a cidade…' : `${ruas.length} ruas · ${predios.length} prédios · ${fonte}`;
}
