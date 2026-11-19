// One-off: turns the geoBoundaries SAU ADM1 GeoJSON into src/saudiRegions.js
// (simplified, pre-projected SVG paths).
//   node scripts/build-saudi-regions.cjs <sau-adm1.geojson> src/saudiRegions.js
const g = require(process.argv[2]);
const out = process.argv[3];
const COS = Math.cos(24 * Math.PI / 180);
let minX=1e9,maxX=-1e9,minY=1e9,maxY=-1e9;
for (const f of g.features) { const c=f.geometry.coordinates; const ps=f.geometry.type==='Polygon'?[c]:c; ps.forEach(p=>p[0].forEach(([lo,la])=>{minX=Math.min(minX,lo);maxX=Math.max(maxX,lo);minY=Math.min(minY,la);maxY=Math.max(maxY,la);})); }
const PAD=8, W=800;
const K=(W-2*PAD)/((maxX-minX)*COS);
const H=Math.round((maxY-minY)*K+2*PAD);
const proj=([lo,la])=>[(lo-minX)*COS*K+PAD,(maxY-la)*K+PAD];
const area=r=>{let a=0;for(let i=0,j=r.length-1;i<r.length;j=i++)a+=(r[j][0]+r[i][0])*(r[j][1]-r[i][1]);return Math.abs(a/2);};
function dp(pts,eps){ if(pts.length<3)return pts; let md=0,mi=0; const [a,b]=[pts[0],pts[pts.length-1]]; const dx=b[0]-a[0],dy=b[1]-a[1],L=Math.hypot(dx,dy)||1;
  for(let i=1;i<pts.length-1;i++){const d=Math.abs(dy*pts[i][0]-dx*pts[i][1]+b[0]*a[1]-b[1]*a[0])/L; if(d>md){md=d;mi=i;}}
  if(md>eps){const l=dp(pts.slice(0,mi+1),eps),r=dp(pts.slice(mi),eps);return l.slice(0,-1).concat(r);} return [a,b]; }
function centroid(r){let a=0,cx=0,cy=0;for(let i=0,j=r.length-1;i<r.length;j=i++){const f=r[j][0]*r[i][1]-r[i][0]*r[j][1];a+=f;cx+=(r[j][0]+r[i][0])*f;cy+=(r[j][1]+r[i][1])*f;}a*=3;return [cx/a,cy/a];}
const NAMES={ 'SA-01':['riyadh','الرياض','Riyadh'],'SA-02':['makkah','مكة المكرمة','Makkah'],'SA-03':['madinah','المدينة المنورة','Madinah'],'SA-04':['eastern','الشرقية','Eastern'],'SA-05':['qassim','القصيم','Qassim'],'SA-06':['hail','حائل','Hail'],'SA-07':['tabuk','تبوك','Tabuk'],'SA-08':['northern','الحدود الشمالية','Northern Borders'],'SA-09':['jazan','جازان','Jazan'],'SA-10':['najran','نجران','Najran'],'SA-11':['baha','الباحة','Al Baha'],'SA-12':['jawf','الجوف','Al Jawf'],'SA-14':['asir','عسير','Asir'] };
const regions=g.features.map(f=>{const c=f.geometry.coordinates; const ps=(f.geometry.type==='Polygon'?[c]:c).map(p=>p[0].map(proj));
  const big=Math.max(...ps.map(area)); const keep=ps.filter(r=>area(r)>Math.max(4,big*0.002));
  const d=keep.map(r=>{const h=r.length>>1; const s=dp(r.slice(0,h+1),0.6).slice(0,-1).concat(dp(r.slice(h),0.6));return 'M'+s.map(([x,y])=>x.toFixed(1)+','+y.toFixed(1)).join('L')+'Z';}).join('');
  const main=keep.reduce((m,r)=>area(r)>area(m)?r:m); const [cx,cy]=centroid(main);
  const [id,ar,en]=NAMES[f.properties.shapeISO]; return {id,iso:f.properties.shapeISO,ar,en,cx:+cx.toFixed(1),cy:+cy.toFixed(1),area:Math.round(big),d};});
regions.sort((a,b)=>a.iso.localeCompare(b.iso));
const src=`// Saudi Arabia's 13 administrative regions, pre-projected to SVG paths.
// Source: geoBoundaries gbOpen SAU ADM1 (CC BY 4.0, wmgeolab/geoBoundaries@9469f09),
// simplified and projected (equirectangular, cos 24°) by a one-off script, so
// the app ships no map library and makes no network request for the shapes.
export const MAP_W = ${W};
export const MAP_H = ${H};
const GEO = { minLon: ${minX}, maxLat: ${maxY}, k: ${K}, cos: ${COS}, pad: ${PAD} };

// [lon, lat] → [x, y] in the map's viewBox.
export function project(lon, lat) {
  return [(lon - GEO.minLon) * GEO.cos * GEO.k + GEO.pad, (GEO.maxLat - lat) * GEO.k + GEO.pad];
}

export const REGIONS = ${JSON.stringify(regions,null,1)};
`;
require('fs').writeFileSync(out,src); console.log(W,H,src.length); regions.forEach(r=>console.log(r.id,r.cx,r.cy,r.area,r.d.length));
