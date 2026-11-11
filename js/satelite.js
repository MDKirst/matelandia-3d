// Satélite Esri em blocos, carregados conforme o avatar anda (sempre online: os termos
// da Esri não permitem baixar em massa para uso offline; a atribuição fica na tela)
import * as THREE from 'three';
import { scene, renderer, flat } from './cena.js';
import { detalharSatelite } from './texturas.js';
import { toXZ, toLL, tileLat, D2R, LX0, LZ0, LX1, LZ1 } from './geo.js';
import { TILE_URL, ZOOM_INICIAL, ZOOM_MAX, ZOOM_FUNDO, RAIO_DETALHE, RAIO_FUNDO } from './config.js';

const texLoader = new THREE.TextureLoader(); texLoader.setCrossOrigin('anonymous');
const ANISO = renderer.capabilities.getMaxAnisotropy();

class CamadaSatelite{
  constructor(z,raio,ordem,recorta){ this.z=z; this.r=raio; this.ordem=ordem; this.recorta=recorta; this.tiles=new Map(); this.cx=null; this.cy=null; }
  atualizar(px,pz){
    const [lat,lon]=toLL(px,pz), n=2**this.z;
    const cx=Math.floor((lon+180)/360*n);
    const cy=Math.floor((1-Math.asinh(Math.tan(lat*D2R))/Math.PI)/2*n);
    if(cx===this.cx&&cy===this.cy) return;
    this.cx=cx; this.cy=cy;
    const quer=[];
    for(let dx=-this.r;dx<=this.r;dx++) for(let dy=-this.r;dy<=this.r;dy++) quer.push([cx+dx,cy+dy,dx*dx+dy*dy]);
    quer.sort((a,b)=>a[2]-b[2]);
    for(const [x,y] of quer){ const k=x+'/'+y; if(!this.tiles.has(k)) this.criar(x,y,k); }
    for(const [k,t] of this.tiles) if(Math.abs(t.x-cx)>this.r+1||Math.abs(t.y-cy)>this.r+1) this.remover(k,t);
  }
  criar(x,y,k){
    const n=2**this.z;
    const [x0,z0]=toXZ(tileLat(y,n),   x/n*360-180);
    const [x1,z1]=toXZ(tileLat(y+1,n), (x+1)/n*360-180);
    if(this.recorta){ const M=200; if(x1<LX0-M||x0>LX1+M||z1<LZ0-M||z0>LZ1+M) return; } // fora da cidade: não baixa
    const mat=detalharSatelite(new THREE.MeshBasicMaterial(flat({color:0xffffff})));
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(x1-x0,z1-z0).rotateX(-Math.PI/2),mat);
    mesh.position.set((x0+x1)/2,0,(z0+z1)/2); mesh.renderOrder=this.ordem; mesh.visible=false; scene.add(mesh);
    const t={x,y,mesh,vivo:true}; this.tiles.set(k,t);
    texLoader.load(TILE_URL(this.z,x,y), tex=>{
      if(!t.vivo){ tex.dispose(); return; }
      tex.colorSpace=THREE.SRGBColorSpace; tex.anisotropy=ANISO; mat.map=tex; mat.needsUpdate=true; mesh.visible=true;
    }, undefined, ()=>{});
  }
  remover(k,t){ t.vivo=false; scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.map?.dispose(); t.mesh.material.dispose(); this.tiles.delete(k); }
  limpar(){ for(const [k,t] of [...this.tiles]) this.remover(k,t); this.cx=null; }
}

const fundo = new CamadaSatelite(ZOOM_FUNDO, RAIO_FUNDO, -20);
let detalhe = new CamadaSatelite(ZOOM_INICIAL, RAIO_DETALHE, -10, true);

export const satelite = {
  get zoom(){ return detalhe.z; },
  atualizar(px,pz){ fundo.atualizar(px,pz); detalhe.atualizar(px,pz); },
  // muda o zoom da camada de detalhe (16..ZOOM_MAX); devolve o zoom em uso
  mudarZoom(delta){
    const z=Math.min(ZOOM_MAX,Math.max(16,detalhe.z+delta));
    if(z!==detalhe.z){ detalhe.limpar(); detalhe=new CamadaSatelite(z,RAIO_DETALHE,-10,true); }
    return z;
  }
};
