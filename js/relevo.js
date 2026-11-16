// Relevo (subidas e descidas de Matelândia), pedido do Maicon em 15/11/2026.
// dados/relevo.json: grade de altitude a cada 20 m (tools/baixar_relevo.py, dados abertos SRTM/NASA via AWS).
// A lógica do jogo continua plana (colisão, terrenos, rotas em x/z). O relevo entra NA HORA DE DESENHAR:
// todo vértice de toda malha sobe conforme a altitude do ponto (x, z) onde está, na placa de vídeo.
// Assim chão, satélite, ruas, prédios, árvores, carros e pessoas sobem juntos, e o veículo inclina sozinho
// na ladeira. ?relevo=0 na URL desliga (cidade plana como antes).
import * as THREE from 'three';

const ligado = new URLSearchParams(location.search).get('relevo')!=='0';
const U = { tRelevo:{ value:null }, relevoInfo:{ value:new THREE.Vector4(0,0,20,0) }, relevoTam:{ value:new THREE.Vector2(2,2) } };
let grade=null;      // { x0, z0, passo, nx, nz, h: Float32Array (metros acima da base) }

const GLSL = /* glsl */`
uniform sampler2D tRelevo; uniform vec4 relevoInfo; uniform vec2 relevoTam;
float alturaRelevo(vec2 p){
  if(relevoInfo.w < 0.5) return 0.0;
  vec2 g = clamp((p - relevoInfo.xy) / relevoInfo.z, vec2(0.0), relevoTam - 1.001);
  ivec2 i = ivec2(floor(g)); vec2 f = fract(g);
  float a = texelFetch(tRelevo, i, 0).r,              b = texelFetch(tRelevo, i + ivec2(1,0), 0).r;
  float c = texelFetch(tRelevo, i + ivec2(0,1), 0).r, d = texelFetch(tRelevo, i + ivec2(1,1), 0).r;
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}`;
// posição final do vértice: no mundo, sobe a altura do chão daquele ponto
const PROJ = /* glsl */`
vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
  mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition = instanceMatrix * mvPosition;
#endif
vec4 rMundo = modelMatrix * mvPosition;
#ifndef SEM_RELEVO
  rMundo.y += alturaRelevo( rMundo.xz );
#endif
mvPosition = viewMatrix * rMundo;
gl_Position = projectionMatrix * mvPosition;`;

if(ligado){
  // todos os materiais do three passam por aqui antes de compilar
  THREE.ShaderChunk.project_vertex = PROJ;
  THREE.ShaderLib.sprite.vertexShader = THREE.ShaderLib.sprite.vertexShader
    .replace('vec4 mvPosition = modelViewMatrix * vec4( 0.0, 0.0, 0.0, 1.0 );',
             'vec4 rMundo = modelMatrix * vec4( 0.0, 0.0, 0.0, 1.0 ); rMundo.y += alturaRelevo( rMundo.xz ); vec4 mvPosition = viewMatrix * rMundo;');
  THREE.ShaderLib.sprite.vertexShader = THREE.ShaderLib.sprite.vertexShader.replace('#include <common>', '#include <common>\n'+GLSL);
  const vert = sh=>{ if(!sh.vertexShader.includes('float alturaRelevo')) sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+GLSL); Object.assign(sh.uniforms,U); };
  THREE.Material.prototype.onBeforeCompile = vert;
}
// o three esconde o que está fora da tela usando a posição PLANA da malha; com o relevo ela aparece mais alta,
// então a esfera de teste sobe junto (e cresce um pouco: dentro dela o chão também varia)
if(ligado){
  const testar=THREE.Frustum.prototype.intersectsSphere, s=new THREE.Sphere();
  THREE.Frustum.prototype.intersectsSphere=function(esf){
    if(!grade) return testar.call(this,esf);
    s.copy(esf); s.center.y+=altura(s.center.x,s.center.z); s.radius=s.radius*1.15+3;
    return testar.call(this,s);
  };
}
// para quem tem o próprio onBeforeCompile (texturas.js): chame isto dentro dele
export const prepararShaderRelevo = sh=>{ if(!sh.vertexShader.includes('float alturaRelevo')) sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\n'+GLSL); Object.assign(sh.uniforms,U); };   // vale também com o relevo desligado (a função devolve 0)

export async function carregarRelevo(){
  if(!ligado) return 0;
  try{
    const d=await (await fetch('dados/relevo.json')).json();
    const h=new Float32Array(d.h.length); for(let i=0;i<h.length;i++) h[i]=d.h[i]*d.escala;
    grade={ x0:d.x0, z0:d.z0, passo:d.passo, nx:d.nx, nz:d.nz, h };
    const tex=new THREE.DataTexture(h,d.nx,d.nz,THREE.RedFormat,THREE.FloatType);
    tex.magFilter=tex.minFilter=THREE.NearestFilter; tex.needsUpdate=true;
    U.tRelevo.value=tex; U.relevoInfo.value.set(d.x0,d.z0,d.passo,1); U.relevoTam.value.set(d.nx,d.nz);
    return Math.round(Math.max(...h));
  }catch(e){ console.warn('relevo: sem dados, cidade plana',e); return 0; }
}

// a mesma conta na CPU (câmera, balões, mira da construção)
export function altura(x,z){
  if(!grade) return 0;
  const {x0,z0,passo,nx,nz,h}=grade;
  let gx=(x-x0)/passo, gz=(z-z0)/passo; gx=Math.max(0,Math.min(nx-1.001,gx)); gz=Math.max(0,Math.min(nz-1.001,gz));
  const i=Math.floor(gx), j=Math.floor(gz), fx=gx-i, fz=gz-j, k=j*nx+i;
  return (h[k]*(1-fx)+h[k+1]*fx)*(1-fz)+(h[k+nx]*(1-fx)+h[k+nx+1]*fx)*fz;
}
export const relevoLigado = ()=>!!grade;
// material que NÃO deve subir com o chão (filtro da tela, céu, estrelas)
export const semRelevo = m=>{ m.defines={...(m.defines||{}),SEM_RELEVO:''}; return m; };
