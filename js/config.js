// Configuração geral do jogo
export const Q = new URLSearchParams(location.search);
// modo leve (17/11, pedido do Maicon): automático no celular (tela de toque); ?leve=1 força, ?leve=0 desliga.
// Menos pixels, sem suavização, visão mais curta e menos gente/carros por perto.
export const LEVE = Q.get('leve')==='1' || (Q.get('leve')!=='0' && matchMedia('(pointer:coarse)').matches);
export const porModo = (normal, leve)=>LEVE?leve:normal;

// conversa com moradores por IA (27/11): endereço do Worker da Cloudflare (tools/ia-papo). Vazio = só falas prontas.
export const IA_PAPO = '';

export const LAT0 = -25.2398, LON0 = -53.9810;               // centro da área urbana de Matelândia-PR
export const LIMITE = {s:-25.2585, w:-54.0010, n:-25.2212, e:-53.9610}; // o mundo do jogo acaba neste retângulo

export const ZOOM_MAX = 18;                                   // Esri não tem z19 em Matelândia ("Map data not yet available")
export const ZOOM_INICIAL = Math.min(ZOOM_MAX, parseInt(Q.get('z')) || 18); // zoom do satélite perto do avatar
export const ZOOM_FUNDO = 15, RAIO_DETALHE = LEVE?3:4, RAIO_FUNDO = 2;   // leve: menos ladrilhos de satélite em volta
export const TILE_URL = (z,x,y)=>`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

export const DADOS_CIDADE = 'dados/matelandia.json';         // gerado por tools/baixar_cidade.py
export const DADOS_PREDIOS = 'dados/predios.json';           // gerado por tools/baixar_predios.py (Overture)
export const OVERPASS = [
  'https://overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
];
export const OSM_API = 'https://api.openstreetmap.org/api/0.6/map'; // reserva: Overpass às vezes some

export const AVATAR_PADRAO = 'assets/maicon-animado.glb';
export const ANDAR = 4, CORRER = 10; // m/s
export const ALTURA_AVATAR = 1.75;
