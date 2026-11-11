// Configuração geral do jogo
export const Q = new URLSearchParams(location.search);

export const LAT0 = -25.2398, LON0 = -53.9810;               // centro da área urbana de Matelândia-PR
export const LIMITE = {s:-25.2585, w:-54.0010, n:-25.2212, e:-53.9610}; // o mundo do jogo acaba neste retângulo

export const ZOOM_MAX = 18;                                   // Esri não tem z19 em Matelândia ("Map data not yet available")
export const ZOOM_INICIAL = Math.min(ZOOM_MAX, parseInt(Q.get('z')) || 18); // zoom do satélite perto do avatar
export const ZOOM_FUNDO = 15, RAIO_DETALHE = 4, RAIO_FUNDO = 2;
export const TILE_URL = (z,x,y)=>`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

export const DADOS_CIDADE = 'dados/matelandia.json';         // gerado por tools/baixar_cidade.py
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
