// Oficina do Personagem (20/11): o aluno transforma o modelo 3D feito por IA num personagem do jogo.
//  Passo 1: .glb da IA → em pé, 1,80 m, mais leve → .zip (OBJ + MTL + textura) para o Auto-Rigger do Mixamo.
//  Passo 2: .fbx do Mixamo (com esqueleto, pose T) → recebe os movimentos do jogo (os mesmos do Seu Valdir,
//           que vieram do Mixamo) → GLB pronto, conferido na prévia.
//  Passo 3: envia para o banco (só conta Google). O dono joga com ele na hora; os outros, depois da aprovação.
// Tudo roda no navegador: nenhum arquivo sai do computador do aluno antes do passo 3.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { nuvem, conectarNuvem, aoTrocarConta, entrarGoogle, sairGoogle, souAdmin, lerPersonagemInfo, ouvirPersonagens,
  baixarPersonagem, enviarPersonagem, apagarPersonagem, decidirPersonagem, esquecerPersonagem, hashDe, PERS_MAX } from './nuvem.js';

const $=id=>document.getElementById(id);
const MB=b=>(b/1048576).toFixed(1).replace('.',',')+' MB';
const milhar=n=>Math.round(n).toLocaleString('pt-BR');
function aviso(el, tipo, txt){ const d=document.createElement('div'); d.className='aviso '+tipo; d.textContent=txt; $(el).replaceChildren(d); }
const limpar=el=>$(el).replaceChildren();
const Aviso=txt=>Object.assign(new Error(txt),{ paraAluno:true });   // erro com texto para mostrar ao aluno

const gltfLoader=new GLTFLoader();
const draco=new DRACOLoader(); draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/gltf/');
gltfLoader.setDRACOLoader(draco); gltfLoader.setMeshoptDecoder(MeshoptDecoder);
const lerGLB=buf=>new Promise((ok,erro)=>gltfLoader.parse(buf,'',ok,erro));

/* ───────── prévias 3D (arrastar gira) ───────── */
const previas=[];
function criarPrevia(cv, giraSozinho){
  const r=new THREE.WebGLRenderer({canvas:cv,antialias:true,alpha:true}); r.setPixelRatio(Math.min(devicePixelRatio,2)); r.outputColorSpace=THREE.SRGBColorSpace;
  const cena=new THREE.Scene(), cam=new THREE.PerspectiveCamera(30,cv.width/cv.height,0.05,100);
  cena.add(new THREE.HemisphereLight(0xffffff,0x445566,2.4)); const sol=new THREE.DirectionalLight(0xfff1dd,2); sol.position.set(2,4,4); cena.add(sol);
  const chao=new THREE.Mesh(new THREE.CircleGeometry(0.7,48).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xF97316,transparent:true,opacity:.25})); cena.add(chao);
  // seta no chão: a frente do boneco tem que apontar para ela (para quem olha a tela)
  const seta=new THREE.Mesh(new THREE.ConeGeometry(0.09,0.22,3).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xfcd34d})); seta.position.set(0,0.01,0.85); seta.scale.y=0.15; cena.add(seta);
  cam.position.set(0,1.0,4.4); cam.lookAt(0,0.9,0);
  const pv={ cena, r, cam, giro:0, obj:null, mixer:null, auto:giraSozinho };
  pv.por=(obj)=>{
    if(pv.obj) cena.remove(pv.obj); pv.obj=null; pv.mixer=null; if(!obj) return;
    const g=new THREE.Group(); g.add(obj); g.updateMatrixWorld(true);
    const b=new THREE.Box3().setFromObject(obj,true), h=(b.max.y-b.min.y)||1, s=1.8/h, c=b.getCenter(new THREE.Vector3());
    obj.position.x-=c.x; obj.position.z-=c.z; obj.position.y-=b.min.y; g.scale.setScalar(s);
    obj.traverse(m=>{ if(m.isMesh) m.frustumCulled=false; });
    cena.add(g); pv.obj=g; return g;
  };
  let arr=null; cv.addEventListener('pointerdown',e=>{ arr=e.clientX; pv.auto=false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove',e=>{ if(arr==null) return; pv.giro+=(e.clientX-arr)*0.012; arr=e.clientX; });
  cv.addEventListener('pointerup',()=>{ arr=null; });
  previas.push(pv); return pv;
}
const relogio=new THREE.Clock();
(function quadro(){ requestAnimationFrame(quadro); const dt=Math.min(relogio.getDelta(),0.05);
  for(const pv of previas){ if(pv.auto) pv.giro+=dt*0.5; if(pv.obj) pv.obj.rotation.y=pv.giro; pv.mixer?.update(dt); pv.r.render(pv.cena,pv.cam); } })();
const prev1=criarPrevia($('prev1'),false), prev2=criarPrevia($('prev2'),true);

/* ───────── PASSO 1: GLB da IA → zip para o Mixamo ───────── */
let partes1=null;                    // [{geo, mat}] com a matriz do arquivo já aplicada
const orient={ y:0, x:0 };           // giros pedidos (múltiplos de 90°)
const MAX_TRI_MIXAMO=30000;

$('glb').addEventListener('change',async e=>{
  const f=e.target.files[0]; if(!f) return;
  limpar('msg1'); $('gerarZip').disabled=true; orient.y=0; orient.x=0;
  try{
    const g=await lerGLB(await f.arrayBuffer()); g.scene.updateMatrixWorld(true);
    partes1=[]; g.scene.traverse(m=>{ if(m.isMesh&&m.geometry?.attributes?.position){ const geo=m.geometry.clone(); geo.applyMatrix4(m.matrixWorld); partes1.push({geo,mat:[].concat(m.material)[0]}); } });
    if(!partes1.length) throw new Error('sem malha');
    mostrar1();
    $('giro1').hidden=false; $('dica1').hidden=false; $('gerarZip').disabled=false;
  }catch(err){ console.warn(err); partes1=null; prev1.por(null); $('info1').hidden=true; aviso('msg1','ruim','Não consegui abrir esse arquivo. Ele precisa ser um .glb (o que a IA de 3D entrega).'); }
});
$('girarE').onclick=()=>{ orient.y+=1; mostrar1(); };
$('girarD').onclick=()=>{ orient.y-=1; mostrar1(); };
$('levantar').onclick=()=>{ orient.x=(orient.x+1)%4; mostrar1(); };

// aplica giros, põe os pés no chão, centraliza e deixa com 1,80 m
function normalizar(){
  const m=new THREE.Matrix4().makeRotationY(orient.y*Math.PI/2).multiply(new THREE.Matrix4().makeRotationX(-orient.x*Math.PI/2));
  const out=partes1.map(p=>({ geo:p.geo.clone().applyMatrix4(m), mat:p.mat }));
  const b=new THREE.Box3(); for(const p of out){ p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); }
  const c=b.getCenter(new THREE.Vector3()), s=1.8/((b.max.y-b.min.y)||1);
  for(const p of out){ p.geo.translate(-c.x,-b.min.y,-c.z); p.geo.scale(s,s,s); }
  return out;
}
const triangulos=geo=>(geo.index?geo.index.count:geo.attributes.position.count)/3;
function mostrar1(){
  const out=normalizar(), g=new THREE.Group();
  for(const p of out){ const mat=p.mat?.map?new THREE.MeshStandardMaterial({map:p.mat.map,roughness:.9}):new THREE.MeshStandardMaterial({color:p.mat?.color||0xcccccc,roughness:.9}); g.add(new THREE.Mesh(p.geo,mat)); }
  prev1.giro=0; prev1.por(g);
  const tri=out.reduce((a,p)=>a+triangulos(p.geo),0), img=out.find(p=>p.mat?.map?.image)?.mat.map.image;
  const linhas=[['Triângulos',milhar(tri)+(tri>MAX_TRI_MIXAMO?` (vou reduzir para ~${milhar(MAX_TRI_MIXAMO)})`:'')],['Textura',img?`${img.width}×${img.height}`:'sem textura (fica só com a cor)'],['Altura','1,80 m']];
  $('info1').replaceChildren(...linhas.map(([k,v])=>{ const d=document.createElement('div'); const b=document.createElement('b'); b.textContent=v; d.append(k+': ',b); return d; }));
  $('info1').hidden=false;
}

// reduz a malha (meshoptimizer) até ~MAX_TRI_MIXAMO no total, sem rasgar as costuras da textura se der
async function reduzir(partes){
  const total=partes.reduce((a,p)=>a+triangulos(p.geo),0); if(total<=MAX_TRI_MIXAMO) return partes;
  const { MeshoptSimplifier:S }=await import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.21.0/meshopt_simplifier.module.js');
  const { mergeVertices }=await import('three/addons/utils/BufferGeometryUtils.js');
  await S.ready;
  const razao=MAX_TRI_MIXAMO/total;
  // A IA entrega a malha cortada nas costuras da textura (o mesmo ponto repetido com outra coordenada de textura).
  // Reduzir assim trava nas costuras; então solda os pontos iguais, reduz a malha soldada e, em cada triângulo
  // que sobrou, escolhe para cada canto a cópia original cuja coordenada de textura é a mais próxima da do 1º canto.
  return partes.map(p=>{
    const geo=p.geo.index?p.geo:mergeVertices(p.geo);
    const P=geo.attributes.position, U=geo.attributes.uv, idx=geo.index.array, n=P.count;
    const chave=new Map(), solda=new Uint32Array(n), copias=[], wpos=[];
    for(let v=0;v<n;v++){
      const k=Math.round(P.getX(v)*1e5)+','+Math.round(P.getY(v)*1e5)+','+Math.round(P.getZ(v)*1e5);
      let w=chave.get(k); if(w===undefined){ w=copias.length; chave.set(k,w); copias.push([]); wpos.push(P.getX(v),P.getY(v),P.getZ(v)); }
      solda[v]=w; copias[w].push(v);
    }
    const wi=[]; for(let k=0;k<idx.length;k+=3){ const a=solda[idx[k]], b=solda[idx[k+1]], c=solda[idx[k+2]]; if(a!==b&&b!==c&&a!==c) wi.push(a,b,c); }
    const alvo=Math.max(3,Math.floor(wi.length*razao/3)*3);
    const [res]=S.simplify(new Uint32Array(wi),new Float32Array(wpos),3,alvo,1,[]);
    const perto=(lista,v0)=>{ if(!U||lista.length===1) return lista[0]; const u=U.getX(v0), w=U.getY(v0); let best=lista[0], d=Infinity;
      for(const v of lista){ const e=(U.getX(v)-u)**2+(U.getY(v)-w)**2; if(e<d){ d=e; best=v; } } return best; };
    const novo=new Uint32Array(res.length);
    for(let k=0;k<res.length;k+=3){ const v0=copias[res[k]][0]; novo[k]=v0; novo[k+1]=perto(copias[res[k+1]],v0); novo[k+2]=perto(copias[res[k+2]],v0); }
    const out=geo.clone(); out.setIndex(new THREE.BufferAttribute(novo,1)); return { geo:out, mat:p.mat };
  });
}
// imagem (ImageBitmap/HTMLImage/canvas) → JPEG de no máximo `lado` px
async function paraJPEG(img, lado=1024){
  const k=Math.min(1,lado/Math.max(img.width,img.height)), cv=document.createElement('canvas');
  cv.width=Math.max(1,Math.round(img.width*k)); cv.height=Math.max(1,Math.round(img.height*k));
  cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
  return new Promise(ok=>cv.toBlob(b=>ok(b),'image/jpeg',0.88));
}
function baixarArquivo(blob, nome){ const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),30000); }

$('gerarZip').onclick=async()=>{
  const bt=$('gerarZip'); bt.disabled=true; aviso('msg1','neutro','Preparando…');
  try{
    const partes=await reduzir(normalizar());
    const { zipSync, strToU8 }=await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
    const arquivos={}; let obj='# Matelândia 3D · Oficina do Personagem\nmtllib personagem.mtl\n', mtl='';
    let base=0, tri=0;
    for(let i=0;i<partes.length;i++){
      const {geo,mat}=partes[i], P=geo.attributes.position, U=geo.attributes.uv, N=geo.attributes.normal;
      const idx=geo.index?geo.index.array:Array.from({length:P.count},(_,k)=>k);
      const novo=new Map(), usados=[];                         // só os vértices que sobraram depois da redução
      for(const v of idx) if(!novo.has(v)){ novo.set(v,usados.length); usados.push(v); }
      const L=[];
      for(const v of usados) L.push(`v ${P.getX(v).toFixed(4)} ${P.getY(v).toFixed(4)} ${P.getZ(v).toFixed(4)}`);
      if(U) for(const v of usados) L.push(`vt ${U.getX(v).toFixed(5)} ${(1-U.getY(v)).toFixed(5)}`);
      if(N) for(const v of usados) L.push(`vn ${N.getX(v).toFixed(4)} ${N.getY(v).toFixed(4)} ${N.getZ(v).toFixed(4)}`);
      L.push(`o parte${i}`,`usemtl mat${i}`);
      const ref=v=>{ const n=novo.get(v)+1+base; return U&&N?`${n}/${n}/${n}`:U?`${n}/${n}`:N?`${n}//${n}`:`${n}`; };
      for(let k=0;k<idx.length;k+=3){ L.push(`f ${ref(idx[k])} ${ref(idx[k+1])} ${ref(idx[k+2])}`); tri++; }
      obj+=L.join('\n')+'\n'; base+=usados.length;
      mtl+=`newmtl mat${i}\nKa 1 1 1\nKs 0 0 0\nd 1\nillum 1\n`;
      const img=mat?.map?.image;
      if(img){ const nome=partes.length>1?`textura${i}.jpg`:'textura.jpg'; arquivos[nome]=new Uint8Array(await (await paraJPEG(img)).arrayBuffer()); mtl+=`Kd 1 1 1\nmap_Kd ${nome}\n\n`; }
      else { const c=mat?.color||new THREE.Color(0.8,0.8,0.8); mtl+=`Kd ${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)}\n\n`; }
    }
    arquivos['personagem.obj']=strToU8(obj); arquivos['personagem.mtl']=strToU8(mtl);
    const zip=zipSync(arquivos,{level:6});
    baixarArquivo(new Blob([zip],{type:'application/zip'}),'personagem-para-mixamo.zip');
    aviso('msg1','ok',`Pronto: personagem-para-mixamo.zip (${MB(zip.length)}, ${milhar(tri)} triângulos). Agora suba esse .zip no Mixamo (tutorial, passo 3).`);
  }catch(err){ console.warn(err); aviso('msg1','ruim','Não consegui gerar o .zip. Tente outro arquivo ou avise o professor.'); }
  bt.disabled=false;
};

/* ───────── PASSO 2: FBX do Mixamo → GLB do jogo ───────── */
// movimentos do jogo: os do Seu Valdir (Mixamo). Nome no arquivo dele → nome que o jogo procura
const MOVIMENTOS={ Idle:'parado', Walk:'andar', Run:'correr', Clapping:'acenar' };
let doValdir=null;
function movimentosBase(){ return doValdir??=fetch('assets/pessoas/valdir.glb').then(r=>{ if(!r.ok) throw new Error('HTTP '+r.status); return r.arrayBuffer(); }).then(lerGLB); }

let fbxAtual=null, texUsuario=null, montado=null;   // montado: { buf, clips, raiz }
$('fbx').addEventListener('change',()=>montar());
$('tex').addEventListener('change',async e=>{
  const f=e.target.files[0]; texUsuario=null;
  if(f){ try{ texUsuario=await createImageBitmap(f,{imageOrientation:'flipY'}); }catch(err){ aviso('msg2','ruim','Não consegui abrir essa imagem.'); return; } }
  if($('fbx').files[0]) montar();
});

function esperarImagem(tex, ms=8000){
  return new Promise(ok=>{ const t0=performance.now();
    (function v(){ const i=tex?.image; if(i&&(i.width>0)&&(i.complete!==false)) return ok(i); if(performance.now()-t0>ms) return ok(null); setTimeout(v,100); })(); });
}

async function montar(){
  const f=$('fbx').files[0]; if(!f) return;
  montado=null; atualizarEnviar(); $('anims').hidden=true; $('info2').hidden=true;
  aviso('msg2','neutro','Montando o personagem…');
  try{
    const [{ FBXLoader }, { GLTFExporter }, base]=await Promise.all([import('three/addons/loaders/FBXLoader.js'), import('three/addons/exporters/GLTFExporter.js'), movimentosBase()]);
    let raiz;
    try{ raiz=new FBXLoader().parse(await f.arrayBuffer(),''); }catch(err){ console.warn(err); throw Aviso('Esse arquivo não abriu como .fbx. Baixe de novo do Mixamo em "FBX Binary (.fbx)".'); }
    fbxAtual=raiz;
    raiz.traverse(o=>{ if(o.isLight||o.isCamera) o.removeFromParent(); });
    raiz.animations=[];
    const peles=[]; raiz.traverse(o=>{ if(o.isSkinnedMesh) peles.push(o); });
    let hips=null; raiz.traverse(o=>{ if(!hips&&o.isBone&&/^mixamorig\d*Hips$/.test(o.name)) hips=o; });
    if(!peles.length||!hips) throw Aviso('Esse .fbx não tem o esqueleto do Mixamo. No Mixamo, marque as juntas (queixo, pulsos, cotovelos, joelhos e virilha) e baixe o personagem.');
    const prefixo=hips.name.slice(0,-4);

    // material: textura do arquivo (ou a escolhida), no máximo 1024 px, em JPEG
    let tri=0;
    for(const m of peles){
      const velho=[].concat(m.material)[0];
      let img=texUsuario;
      if(!img&&velho?.map) img=await esperarImagem(velho.map);
      let mapa=null;
      if(img){
        const k=Math.min(1,1024/Math.max(img.width,img.height)), cv=document.createElement('canvas');
        cv.width=Math.round(img.width*k); cv.height=Math.round(img.height*k); cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
        mapa=new THREE.CanvasTexture(cv); mapa.colorSpace=THREE.SRGBColorSpace; mapa.flipY=texUsuario?false:(velho?.map?.flipY??true);
        mapa.userData.mimeType='image/jpeg';
      }
      m.material=new THREE.MeshStandardMaterial({ map:mapa, color:mapa?0xffffff:(velho?.color||0xdddddd), roughness:.85, metalness:0 });
      tri+=triangulos(m.geometry);
    }

    // movimentos: copia as trilhas dos ossos do Valdir para os ossos de mesmo nome; o quadril anda na proporção da altura
    const vHips=base.scene.getObjectByName('mixamorigHips');
    const razao=vHips&&Math.abs(vHips.position.y)>1e-6?hips.position.y/vHips.position.y:1;
    const ossos=new Set(); raiz.traverse(o=>{ if(o.isBone) ossos.add(o.name); });
    const clips=[];
    for(const [orig,nome] of Object.entries(MOVIMENTOS)){
      const c=base.animations.find(a=>a.name===orig); if(!c) continue;
      const trilhas=[];
      for(const t of c.tracks){
        const i=t.name.lastIndexOf('.'), no=t.name.slice(0,i), prop=t.name.slice(i+1);
        if(prop==='scale') continue;
        const alvo=no.replace(/^mixamorig/,prefixo); if(!ossos.has(alvo)) continue;
        const n=t.clone(); n.name=alvo+'.'+prop;
        if(prop==='position'){ const v=n.values; for(let k=0;k<v.length;k++) v[k]*=razao; }
        trilhas.push(n);
      }
      if(trilhas.length) clips.push(new THREE.AnimationClip(nome,c.duration,trilhas));
    }
    if(clips.length<3) throw Aviso('Os ossos desse esqueleto não batem com os do Mixamo. Refaça o Auto-Rigger no Mixamo.');

    // exporta o GLB enxugado como os do jogo (tools/otimizar-pessoa.mjs); se passar do limite, tenta com textura menor
    const exportar=async()=>compactar(await new GLTFExporter().parseAsync(raiz,{binary:true,animations:clips}));
    let buf=await exportar();
    if(buf.byteLength>PERS_MAX){
      for(const m of peles){ const t=m.material.map; if(!t) continue; const cv=document.createElement('canvas'); cv.width=Math.round(t.image.width/2); cv.height=Math.round(t.image.height/2); cv.getContext('2d').drawImage(t.image,0,0,cv.width,cv.height); t.image=cv; t.needsUpdate=true; }
      buf=await exportar();
    }
    // confere lendo de volta, como o jogo vai ler
    const g=await lerGLB(buf.slice(0));
    const mix=new THREE.AnimationMixer(g.scene);
    prev2.por(g.scene); prev2.mixer=mix; prev2.acoes=Object.fromEntries(g.animations.map(a=>[a.name,mix.clipAction(a)]));
    tocar('andar');
    $('anims').hidden=false;
    const linhas=[['Triângulos',milhar(tri)+(tri>40000?' (pesado: pode deixar o jogo lento no celular)':'')],['Movimentos',g.animations.map(a=>a.name).join(', ')],['Tamanho',MB(buf.byteLength)+` (limite ${MB(PERS_MAX)})`]];
    $('info2').replaceChildren(...linhas.map(([k,v])=>{ const d=document.createElement('div'); const b=document.createElement('b'); b.textContent=v; d.append(k+': ',b); return d; })); $('info2').hidden=false;
    if(buf.byteLength>PERS_MAX){ aviso('msg2','ruim',`Ficou com ${MB(buf.byteLength)}, acima do limite de ${MB(PERS_MAX)}. Volte ao passo 1 e gere o .zip de novo com um modelo mais simples.`); return; }
    const semTex=peles.every(m=>!m.material.map);
    montado={ buf };
    aviso('msg2',semTex?'neutro':'ok',semTex?'Montado, mas sem textura (ficou de uma cor só). Se quiser a cor, escolha a textura.jpg do .zip do passo 1.':'Personagem montado! Confira os movimentos na prévia e vá para o passo 3.');
  }catch(err){ console.warn(err); prev2.por(null); aviso('msg2','ruim',err.paraAluno?err.message:'Não consegui montar o personagem com esse arquivo. Confira se é o .fbx baixado do Mixamo.'); }
  atualizarEnviar();
}
// mesmo enxugamento dos personagens do jogo: tira quadro-chave repetido, quantiza a malha e comprime (meshopt, sem perda)
async function compactar(buf){
  const [{ WebIO }, { ALL_EXTENSIONS, EXTMeshoptCompression }, { resample, dedup, prune, quantize }, { MeshoptEncoder }]=await Promise.all([
    import('https://cdn.jsdelivr.net/npm/@gltf-transform/core@4.5.1/+esm'), import('https://cdn.jsdelivr.net/npm/@gltf-transform/extensions@4.5.1/+esm'),
    import('https://cdn.jsdelivr.net/npm/@gltf-transform/functions@4.5.1/+esm'), import('https://cdn.jsdelivr.net/npm/meshoptimizer@1.3.0/meshopt_encoder.js')]);
  await MeshoptEncoder.ready;
  const io=new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder':MeshoptEncoder });
  const doc=await io.readBinary(new Uint8Array(buf));
  await doc.transform(resample(), dedup(), prune({ keepLeaves:true }),
    quantize({ quantizePosition:14, quantizeNormal:10, quantizeTexcoord:12, quantizeWeight:8 }));
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method:EXTMeshoptCompression.EncoderMethod.QUANTIZE });
  const out=await io.writeBinary(doc);
  return out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength);
}
function tocar(nome){ const a=prev2.acoes?.[nome]; if(!a) return; for(const x of Object.values(prev2.acoes)) x.stop(); a.reset().play();
  for(const b of document.querySelectorAll('#anims [data-anim]')) b.classList.toggle('forte',b.dataset.anim===nome); }
for(const b of document.querySelectorAll('#anims [data-anim]')) b.onclick=()=>tocar(b.dataset.anim);

/* ───────── PASSO 3: conta e envio ───────── */
const ROTULO={ pendente:'aguardando aprovação do professor', aprovado:'aprovado: todos veem', recusado:'recusado: só você vê' };
let meu=null;
async function mostrarConta(){
  const c=$('conta');
  if(!nuvem.ok){ c.textContent='Sem conexão com o jogo agora. Os passos 1 e 2 funcionam; para enviar, tente mais tarde.'; atualizarEnviar(); return; }
  if(!nuvem.conta){
    const b=Object.assign(document.createElement('button'),{className:'forte',textContent:'Entrar com Google'});
    b.onclick=async()=>{ b.disabled=true; const r=await entrarGoogle(async n=>confirm(`Essa conta Google já foi usada em outro aparelho e vai trazer o que está nela.\n\n${n} terreno(s) deste navegador ficam no mapa, mas você não vai mais poder construir neles.\n\nEntrar mesmo assim?`));
      if(r==='bloqueado') alert('O navegador bloqueou a janela do Google. Libere janelas pop-up para este site.'); else if(r==='erro') alert('Não deu para entrar com o Google agora.'); b.disabled=false; mostrarConta(); };
    c.replaceChildren(b,' Para enviar o personagem você precisa entrar com a sua conta Google.');
    meu=null; $('apagar').hidden=true; atualizarEnviar(); return;
  }
  meu=await lerPersonagemInfo(nuvem.uid);
  const s=Object.assign(document.createElement('button'),{textContent:'sair'}); s.onclick=async()=>{ await sairGoogle(); mostrarConta(); };
  const nome=document.createElement('b'); nome.textContent=nuvem.conta.nome||'conta Google';
  const partes=['✔ Entrou como ',nome,' '];
  if(meu){ const t=document.createElement('span'); t.className='tag '+meu.status; t.textContent=`seu personagem: ${meu.nome} · ${ROTULO[meu.status]||meu.status}`; partes.push(' · ',t,' '); if(!$('nomeP').value) $('nomeP').value=meu.nome; }
  partes.push(s); c.replaceChildren(...partes);
  $('apagar').hidden=!meu; atualizarEnviar();
  if(souAdmin()) ligarAdmin();
}
function atualizarEnviar(){ $('enviar').disabled=!(montado&&nuvem.conta); }
$('enviar').onclick=async()=>{
  const nome=$('nomeP').value.trim(); if(!nome){ aviso('msg3','ruim','Dê um nome para o personagem.'); $('nomeP').focus(); return; }
  if(meu&&meu.status==='aprovado'&&!confirm('Seu personagem já foi aprovado. Enviar outro volta para a fila de aprovação (os outros veem o boneco padrão até lá). Continuar?')) return;
  $('enviar').disabled=true; $('barra').hidden=false; $('barra').firstElementChild.style.width='5%'; aviso('msg3','neutro','Enviando…');
  const r=await enviarPersonagem(montado.buf,nome,p=>{ $('barra').firstElementChild.style.width=Math.round(5+p*95)+'%'; });
  $('barra').hidden=true;
  if(r==='ok') aviso('msg3','ok','Enviado! Abra o jogo, entre com a mesma conta Google e escolha o seu personagem (ele aparece primeiro na lista). Os outros jogadores veem depois que o professor aprovar.');
  else if(r==='sem-google') aviso('msg3','ruim','Entre com a conta Google antes de enviar.');
  else if(r==='grande') aviso('msg3','ruim','Arquivo grande demais. Volte ao passo 1 e simplifique o modelo.');
  else aviso('msg3','ruim','Não deu para enviar agora. Confira a internet e tente de novo.');
  mostrarConta();
};
$('apagar').onclick=async()=>{ if(!confirm('Apagar o seu personagem do jogo? Você volta a usar os personagens normais.')) return; await apagarPersonagem(); aviso('msg3','neutro','Personagem apagado.'); mostrarConta(); };

/* ───────── admin: fila de aprovação ───────── */
let adminLigado=false;
const vistos=new Map();   // uid → SHA-256 do arquivo que o admin viu
function ligarAdmin(){
  if(adminLigado) return; adminLigado=true; $('admin').hidden=false;
  ouvirPersonagens(todos=>{
    const ordem={pendente:0,recusado:1,aprovado:2};
    const itens=Object.entries(todos).sort((a,b)=>(ordem[a[1].status]??3)-(ordem[b[1].status]??3)||b[1].t-a[1].t);
    if(!itens.length){ const p=document.createElement('p'); p.textContent='Nenhum personagem enviado ainda.'; $('listaAdmin').replaceChildren(p); return; }
    $('listaAdmin').replaceChildren(...itens.map(([uid,info])=>{
      const d=document.createElement('div'); d.className='item';
      const n=document.createElement('span'); n.className='nome'; n.textContent=info.nome;
      const t=document.createElement('span'); t.className='tag '+info.status; t.textContent=info.status;
      const q=document.createElement('span'); q.className='info'; q.textContent=`${MB(info.tam||0)} · ${new Date(info.t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}`;
      const ver=Object.assign(document.createElement('button'),{textContent:'Ver'});
      ver.onclick=async()=>{ ver.disabled=true; esquecerPersonagem(uid); const buf=await baixarPersonagem(uid,info); ver.disabled=false;
        if(!buf){ aviso('msg2','ruim','Não consegui baixar esse personagem.'); return; }
        vistos.set(uid+':'+info.t,await hashDe(buf)); if(info.status!=='aprovado'){ ap.disabled=false; ap.title=''; }
        try{ const g=await lerGLB(buf.slice(0)); const mix=new THREE.AnimationMixer(g.scene); prev2.por(g.scene); prev2.mixer=mix; prev2.acoes=Object.fromEntries(g.animations.map(a=>[a.name,mix.clipAction(a)])); tocar('andar'); $('anims').hidden=false;
          aviso('msg2','neutro',`Mostrando o personagem "${info.nome}" enviado por um aluno.`); $('passo2').scrollIntoView({behavior:'smooth'}); }
        catch(err){ aviso('msg2','ruim','Arquivo com defeito.'); } };
      // só aprova depois de Ver: a aprovação fica presa ao arquivo exato que apareceu na prévia (hash)
      const ap=Object.assign(document.createElement('button'),{className:'forte',textContent:'Aprovar'}); ap.disabled=info.status==='aprovado'||!vistos.has(uid+':'+info.t); if(ap.disabled&&info.status!=='aprovado') ap.title='Clique em Ver antes';
      ap.onclick=()=>decidirPersonagem(uid,'aprovado',vistos.get(uid+':'+info.t));
      const re=Object.assign(document.createElement('button'),{textContent:'Recusar'}); re.disabled=info.status==='recusado'; re.onclick=()=>decidirPersonagem(uid,'recusado');
      d.append(n,t,q,ver,ap,re); return d;
    }));
  });
}

aoTrocarConta(()=>mostrarConta());
conectarNuvem().then(()=>mostrarConta());
