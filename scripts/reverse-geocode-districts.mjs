// One-off: look up the district (حي) and city of each branch pin with
// OpenStreetMap Nominatim, in Arabic, at Nominatim's 1 request/second limit.
//   node scripts/reverse-geocode-districts.mjs <coords.json> <out.json>
import fs from 'fs';

const [coordsFile, out = 'branch-districts.json'] = process.argv.slice(2);
const coords = JSON.parse(fs.readFileSync(coordsFile, 'utf8'));
const cache = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const todo = Object.entries(coords).filter(([num, p]) => p && !(num in cache));
console.log('to look up:', todo.length);
for (const [num, [lon, lat]] of todo) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=17&addressdetails=1&accept-language=ar`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'request-manager-branch-geo/1.0 (one-off district lookup)' } });
    const j = await r.json();
    const a = j.address || {};
    cache[num] = {
      district: a.suburb || a.neighbourhood || a.quarter || a.city_district || a.residential || a.hamlet || a.village || null,
      city: a.city || a.town || a.village || a.county || null,
    };
  } catch (e) { console.log('fail', num, e.message); }
  fs.writeFileSync(out, JSON.stringify(cache, null, 1));
  await sleep(1100);
}
console.log('done', Object.keys(cache).length);
