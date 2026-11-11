// Geografia → metros locais (x = leste, z = sul), centrados em LAT0/LON0
import { LAT0, LON0, LIMITE } from './config.js';

export const D2R = Math.PI/180;
const MX = 111320*Math.cos(LAT0*D2R), MZ = 110574;
export const toXZ = (lat,lon)=>[(lon-LON0)*MX, -(lat-LAT0)*MZ];
export const toLL = (x,z)=>[LAT0 - z/MZ, LON0 + x/MX];
export const tileLat = (y,n)=>Math.atan(Math.sinh(Math.PI*(1-2*y/n)))/D2R;

// borda do mundo em metros: [LX0,LZ0] canto noroeste, [LX1,LZ1] canto sudeste
export const [LX0,LZ0] = toXZ(LIMITE.n,LIMITE.w);
export const [LX1,LZ1] = toXZ(LIMITE.s,LIMITE.e);
