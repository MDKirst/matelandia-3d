// Sensação de velocidade ao dirigir (pedido do Maicon em 21/11: "efeitos tipo GTA 6"):
//  - câmera abre o ângulo (FOV) conforme a velocidade
//  - linhas de vento na borda da tela (CSS, quase de graça)
//  - tremida leve em alta (no próprio canvas, sem mexer na câmera)
//  - fumaça dos pneus traseiros na freada forte e na curva fechada em alta
// O jogo chama efeitosVelocidade() a cada quadro em que está dirigindo; sem chamada, tudo some sozinho.
import { camera, cv } from './cena.js';
import { fumaca } from './efeitos.js';
import { frente, esquerda } from './veiculos.js';
import { LEVE } from './config.js';

const FOV0 = camera.fov, FOV_EXTRA = 16;
let k = 0, alvoK = 0, ultima = 0, acumFumaca = 0;

const linhas = document.createElement('div');
linhas.id = 'linhasVento';
const st = document.createElement('style');
st.textContent = `#linhasVento{position:fixed;inset:-10%;pointer-events:none;z-index:2;opacity:0;
  background:repeating-conic-gradient(from 0deg at 50% 46%, rgba(255,255,255,.55) 0deg .35deg, transparent .35deg 4.2deg);
  -webkit-mask:radial-gradient(ellipse at 50% 46%, transparent 0 34%, #000 74%); mask:radial-gradient(ellipse at 50% 46%, transparent 0 34%, #000 74%)}`;
document.head.append(st); document.body.append(linhas);

function aplicar(){
  const fov = FOV0 + FOV_EXTRA * k;
  if (Math.abs(camera.fov - fov) > 0.05){ camera.fov = fov; camera.updateProjectionMatrix(); }
  linhas.style.opacity = (k * k * 0.6).toFixed(3);
  if (k > 0.02) linhas.style.transform = `rotate(${(Math.random() * 4).toFixed(2)}deg)`;   // pisca de leve: parece vento passando
  const tr = k > 0.55 ? (k - 0.55) * 4.5 : 0;                                              // tremida só lá em cima
  cv.style.transform = tr > 0.05 ? `translate(${((Math.random() - 0.5) * tr).toFixed(2)}px,${((Math.random() - 0.5) * tr).toFixed(2)}px) scale(1.006)` : '';
}

// c = veículo dirigido; freando = pé no freio com o carro andando; giro = volante (−1..1)
export function efeitosVelocidade(dt, c, freando, giro){
  ultima = performance.now();
  const v = Math.abs(c.v), base = c.tipo.vmax * 0.32;                  // começa a aparecer a ~1/3 da final
  alvoK = Math.max(0, Math.min(1, (v - base) / (c.tipo.vmax - base)));
  k += (alvoK - k) * Math.min(1, dt * 2.5);
  aplicar();
  // fumaça de pneu: freada forte ou curva fechada rápida
  const derrapa = (freando && v > 12) || (Math.abs(giro) > 0.75 && v > c.tipo.vmax * 0.55);
  if (!derrapa || c.quebrado) { acumFumaca = 0; return; }
  acumFumaca += dt * (LEVE ? 14 : 30);
  const [fx, fz] = frente(c.h), [ex, ez] = esquerda(c.h), p = c.obj.position, tras = c.comp * 0.42;
  const rodas = c.tipo.moto ? [0] : [-1, 1];
  while (acumFumaca >= 1){ acumFumaca -= 1;
    for (const l of rodas){ const x = p.x - fx * tras + ex * l * c.larg * 0.4, z = p.z - fz * tras + ez * l * c.larg * 0.4;
      fumaca(x, p.y + 0.25, z, 0, 0.45); } }
}

// parou de dirigir (desceu, pausou, abriu o menu): volta ao normal devagar
setInterval(() => {
  if (performance.now() - ultima < 250 || k < 0.002) return;
  k *= 0.7; if (k < 0.01) k = 0; aplicar();
}, 60);
