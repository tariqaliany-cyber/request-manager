// One-off: follow each branch's Google Maps short link (branchData.js) to
// the full URL and read its pin coordinates. Writes a JSON cache that
// build-branch-geo.mjs turns into src/branchGeo.js.
//   node scripts/resolve-branch-coords.mjs <out.json>
import fs from 'fs';
import { BRANCHES } from '../src/branchData.js';

const out = process.argv[2] || 'branch-coords.json';
const cache = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};

function coordsFrom(url) {
  let m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);        // the pin itself
  if (m) return [+m[2], +m[1]];
  m = url.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/);
  if (m) return [+m[2], +m[1]];
  m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);                 // map centre
  if (m) return [+m[2], +m[1]];
  return null;
}

async function resolve(url) {
  let cur = url;
  for (let i = 0; i < 6; i++) {
    const c = coordsFrom(cur);
    if (c) return c;
    const r = await fetch(cur, { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
    const loc = r.headers.get('location');
    if (!loc) return null;
    cur = new URL(loc, cur).href;
  }
  return coordsFrom(cur);
}

const todo = BRANCHES.filter(b => b.mapsUrl && !(b.num in cache));
let done = 0;
for (let i = 0; i < todo.length; i += 6) {
  await Promise.all(todo.slice(i, i + 6).map(async b => {
    try { cache[b.num] = await resolve(b.mapsUrl); } catch { cache[b.num] = null; }
    done++;
  }));
  fs.writeFileSync(out, JSON.stringify(cache));
}
const ok = Object.values(cache).filter(Boolean).length;
console.log(`resolved ${done} now; ${ok}/${Object.keys(cache).length} with coordinates`);
