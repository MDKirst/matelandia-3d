// Texturas procedurais do chão (desenhadas em canvas, nenhum arquivo de imagem):
// asfalto, calçada e o "grão" que dá detalhe de perto ao satélite (0,54 m por pixel vira
// borrão rente ao chão). Todas em coordenadas do mundo, então não emendam nem esticam.
import * as THREE from 'three';

// gerador pseudoaleatório com semente: a textura sai igual toda vez
function rng(s){ return ()=>{ s=(s*1664525+1013904223)>>>0; return s/4294967296; }; }

function textura(cv, cor=true){
  const t=new THREE.CanvasTexture(cv); t.wrapS=t.wrapT=THREE.RepeatWrapping; t.anisotropy=8;
  t.colorSpace=cor?THREE.SRGBColorSpace:THREE.NoColorSpace; return t;
}
function canvas(n){ const cv=document.createElement('canvas'); cv.width=cv.height=n; return [cv,cv.getContext('2d')]; }

// asfalto gasto: base escura, brita clara e escura, manchas grandes e algumas trincas
export function texAsfalto(){
  const N=512, [cv,k]=canvas(N), r=rng(7);
  k.fillStyle='#3b3e43'; k.fillRect(0,0,N,N);
  for(let i=0;i<60;i++){ const x=r()*N, y=r()*N, g=k.createRadialGradient(x,y,0,x,y,30+r()*90), c=r()<0.5?'0,0,0':'255,255,255';
    g.addColorStop(0,`rgba(${c},${0.015+r()*0.02})`); g.addColorStop(1,`rgba(${c},0)`); k.fillStyle=g; k.fillRect(0,0,N,N); }
  for(let i=0;i<26000;i++){ const v=r(); k.fillStyle=v<0.5?`rgba(15,16,18,${0.3+r()*0.4})`:`rgba(150,150,145,${0.15+r()*0.35})`; const s=r()<0.9?1:2; k.fillRect(r()*N,r()*N,s,s); }
  k.strokeStyle='rgba(20,20,22,.55)'; k.lineWidth=1.2;
  for(let i=0;i<7;i++){ let x=r()*N, y=r()*N; k.beginPath(); k.moveTo(x,y); for(let j=0;j<10;j++){ x+=(r()-0.5)*40; y+=(r()-0.5)*40; k.lineTo(x,y); } k.stroke(); }
  return textura(cv);
}

// calçada de concreto em placas (cada textura = 2 × 2 m, placas de 1 m), com sujeira
export function texCalcada(){
  const N=512, [cv,k]=canvas(N), r=rng(11);
  k.fillStyle='#b8b2a6'; k.fillRect(0,0,N,N);
  for(let i=0;i<14000;i++){ k.fillStyle=r()<0.5?`rgba(90,85,78,${r()*0.25})`:`rgba(230,226,218,${r()*0.25})`; k.fillRect(r()*N,r()*N,1.5,1.5); }
  for(let i=0;i<25;i++){ const x=r()*N, y=r()*N, g=k.createRadialGradient(x,y,0,x,y,20+r()*60); g.addColorStop(0,'rgba(70,65,55,.12)'); g.addColorStop(1,'rgba(70,65,55,0)'); k.fillStyle=g; k.fillRect(0,0,N,N); }
  k.fillStyle='rgba(80,76,70,.55)'; for(const p of [0,N/2]){ k.fillRect(p,0,3,N); k.fillRect(0,p,N,3); }
  return textura(cv);
}

// grão neutro (média ~0,5): tufos de grama, terra e pedrinhas em cinza; multiplica o satélite
export function texDetalhe(){
  const N=512, [cv,k]=canvas(N), r=rng(23);
  k.fillStyle='rgb(128,128,128)'; k.fillRect(0,0,N,N);
  for(let i=0;i<9000;i++){ const x=r()*N, y=r()*N, l=2+r()*6, a=r()*Math.PI*2, v=90+r()*80|0;
    k.strokeStyle=`rgba(${v},${v},${v},.55)`; k.lineWidth=1; k.beginPath(); k.moveTo(x,y); k.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l); k.stroke(); }
  for(let i=0;i<5000;i++){ const v=r()<0.5?70:190; k.fillStyle=`rgba(${v},${v},${v},${0.2+r()*0.3})`; k.fillRect(r()*N,r()*N,2,2); }
  // costura invisível: copia as bordas para dar repetição contínua
  const img=k.getImageData(0,0,N,N), d=img.data, B=24;
  for(let y=0;y<N;y++) for(let x=0;x<B;x++){ const t=x/B, i=(y*N+x)*4, j=(y*N+(N-B+x))*4; for(let c=0;c<3;c++) d[j+c]=d[j+c]*t+d[i+c]*(1-t); }
  for(let x=0;x<N;x++) for(let y=0;y<B;y++){ const t=y/B, i=(y*N+x)*4, j=((N-B+y)*N+x)*4; for(let c=0;c<3;c++) d[j+c]=d[j+c]*t+d[i+c]*(1-t); }
  k.putImageData(img,0,0);
  return textura(cv,false);
}

// Põe o grão no material do satélite: perto da câmera a cor ganha textura; some com a distância
let detalhe=null;
export function detalharSatelite(mat){
  detalhe ??= texDetalhe();
  mat.onBeforeCompile=sh=>{
    sh.uniforms.tDetalhe={value:detalhe};
    sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vMundo;')
      .replace('#include <project_vertex>','#include <project_vertex>\nvMundo=(modelMatrix*vec4(transformed,1.0)).xyz;');
    sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vMundo;\nuniform sampler2D tDetalhe;')
      .replace('#include <map_fragment>',`#include <map_fragment>
        float dCam=distance(vMundo,cameraPosition);
        float f=1.0-smoothstep(25.0,150.0,dCam);
        vec3 d1=texture2D(tDetalhe,vMundo.xz/5.0).rgb, d2=texture2D(tDetalhe,vMundo.xz/23.0+0.37).rgb;
        vec3 g=(d1*d2*4.0-1.0)*1.7+1.0;                       // grão de ~5 cm a ~1 m, contraste reforçado
        diffuseColor.rgb*=mix(vec3(1.0),clamp(g,0.45,1.6),f*0.85);`);
  };
  mat.customProgramCacheKey=()=>'satelite-detalhe';
  return mat;
}
