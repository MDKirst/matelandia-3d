// Renderizador, cena, câmera e luzes
import * as THREE from 'three';
import { LEVE } from './config.js';

export const $ = id=>document.getElementById(id);
export const cv = $('c');
export const renderer = new THREE.WebGLRenderer({canvas:cv, antialias:!LEVE, powerPreference:'high-performance'});
renderer.setPixelRatio(LEVE?Math.min(devicePixelRatio,1.25):Math.min(devicePixelRatio,2));   // celular: tela de 3x desenhava 9x os pixels
renderer.outputColorSpace = THREE.SRGBColorSpace;

export const scene = new THREE.Scene();
const CEU = 0xbfd9ee;
scene.background = new THREE.Color(CEU);
scene.fog = LEVE?new THREE.Fog(CEU, 170, 720):new THREE.Fog(CEU, 260, 1300);   // leve: neblina mais perto (e a câmera não desenha além dela)

export const camera = new THREE.PerspectiveCamera(60, 1, 0.3, LEVE?800:4000);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f7a, 1.6));
const sol = new THREE.DirectionalLight(0xfff2dd, 1.8); sol.position.set(-0.5,1,0.35); scene.add(sol);

function resize(){ renderer.setSize(innerWidth,innerHeight,false); camera.aspect=innerWidth/innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize',resize); resize();

// Camadas planas não usam depth: zero "z-fighting". A ordem de desenho vem do renderOrder.
export const flat = o=>Object.assign(o,{depthTest:false,depthWrite:false});

// Chão base (aparece enquanto o satélite carrega); segue o avatar
export const base = new THREE.Mesh(new THREE.PlaneGeometry(9000,9000).rotateX(-Math.PI/2), new THREE.MeshBasicMaterial(flat({color:0x6f8f5a})));
base.renderOrder = -30; scene.add(base);
