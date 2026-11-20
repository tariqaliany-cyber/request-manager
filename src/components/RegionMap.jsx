import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS } from '../storage';
import { branchLabel, getBranchInfo } from '../branchData';
import { AREA_AR } from '../branchDataAr';
import { MAP_W, MAP_H, REGIONS, project, unproject } from '../saudiRegions';
import { AREA_REGION } from '../regionData';
import { BRANCH_GEO } from '../branchGeo';
import StatusBadge from './StatusBadge';

// Work that is still open: everything except completed.
export const OPEN_STATUSES = ['received', 'scheduled', 'in_progress'];

// Regions too small at full-country zoom to fit "name + count"; they show the
// count only, and their name on click / in the region list under the map.
const SMALL = new Set(['baha', 'jazan']);
// Mid-size regions whose names collide on a phone-width map (count stays).
const MID = new Set(['asir', 'najran', 'qassim', 'jawf', 'northern', 'hail', 'madinah', 'makkah', 'tabuk']);
// Nudges where the polygon centroid is a poor label spot (viewBox units).
const LABEL_NUDGE = { eastern: [14, -10], makkah: [-6, 4], jazan: [6, -2], tabuk: [0, 16], northern: [6, 10], jawf: [-8, 10] };

const ZERO_FILL = '#EEF1F4';
const LIGHT = [0xD6, 0xE0, 0xEC];
const DARK  = [0x1E, 0x3A, 0x5F];
function fillFor(count, max) {
  if (!count) return ZERO_FILL;
  const t = max <= 1 ? 1 : 0.18 + 0.82 * Math.pow((count - 1) / (max - 1), 0.85);
  const c = LIGHT.map((l, i) => Math.round(l + (DARK[i] - l) * t));
  return `rgb(${c.join(',')})`;
}
const isDark = (count, max) => count > 0 && (max <= 1 || (count - 1) / (max - 1) > 0.4);

const FULL_VB = [0, 0, MAP_W, MAP_H];
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const NO_DISTRICT = 'حي غير محدد';

// ── Background tiles (only while zoomed in) ──
// "map": standard OpenStreetMap tiles; usage policy:
//   https://operations.osmfoundation.org/policies/tiles/ (light, interactive use).
// "sat": Esri World Imagery, with Esri's road and place-name overlays on top.
// Attribution for each is shown on the map. Each tile is drawn at its
// projected corners, so it lines up with the region shapes and branch pins
// drawn in this map's own projection.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const TILE_SOURCES = {
  map: { layers: [(z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`],
         attrib: '© OpenStreetMap contributors', link: 'https://www.openstreetmap.org/copyright' },
  sat: { layers: [(z, x, y) => `${ESRI}/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
                  (z, x, y) => `${ESRI}/Reference/World_Transportation/MapServer/tile/${z}/${y}/${x}`,
                  (z, x, y) => `${ESRI}/Reference/World_Boundaries_and_Places/MapServer/tile/${z}/${y}/${x}`],
         attrib: 'Imagery © Esri, Maxar, Earthstar Geographics', link: 'https://www.esri.com/en-us/legal/terms/full-master-agreement' },
};
const lon2tile = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2tile = (lat, z) => {
  const r = lat * Math.PI / 180;
  return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z);
};
const tile2lon = (x, z) => x / 2 ** z * 360 - 180;
const tile2lat = (y, z) => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / 2 ** z))) * 180 / Math.PI;

// Tiles covering viewBox `vb` when the map is `screenW` px wide.
// `coarser` drops the zoom by that many levels (used for the in-between
// levels of a flight, which are only seen while moving).
function tilesFor(vb, screenW, coarser = 0) {
  const [lonA, latA] = unproject(vb[0], vb[1]);
  const [lonB, latB] = unproject(vb[0] + vb[2], vb[1] + vb[3]);
  // Zoom where one 256px tile is about 256 screen px wide (one step sharper
  // on high-density screens).
  const dpr = typeof window !== 'undefined' && window.devicePixelRatio >= 1.5 ? 1 : 0;
  let z = Math.round(Math.log2(360 * screenW / ((lonB - lonA) * 256))) + dpr - coarser;
  z = Math.min(19, Math.max(4, z));
  let x0, x1, y0, y1;
  for (;;) {
    x0 = lon2tile(lonA, z); x1 = lon2tile(lonB, z);
    y0 = lat2tile(latA, z); y1 = lat2tile(latB, z);
    if ((x1 - x0 + 1) * (y1 - y0 + 1) <= 48 || z <= 4) break;
    z--;
  }
  const out = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
    const [ax, ay] = project(tile2lon(x, z), tile2lat(y, z));
    const [bx, by] = project(tile2lon(x + 1, z), tile2lat(y + 1, z));
    out.push({ key: `${z}/${x}/${y}`, z, tx: x, ty: y, x: ax, y: ay, w: bx - ax, h: by - ay });
  }
  return { z, tiles: out };
}

// Branch level: about 330 m across, street level.
const BRANCH_W = 0.12;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));

// Smallest map width (viewBox units, 1 unit ≈ 2.7 km) per drill level, so a
// city or district with a single branch still opens at a sensible zoom.
const MIN_W = [MAP_W, MAP_W / 3.2, 5, 1.2, BRANCH_W];

// Where a request's branch is: its pin (exact) when the branch has a map link,
// otherwise its city centre (approximate). null when the branch is unknown.
function locate(req) {
  const num = String(req.branchNumber ?? '');
  const info = getBranchInfo(num);
  const geo = BRANCH_GEO[num];
  const area = info?.area;
  const city = area && AREA_REGION[area];
  if (geo) {
    const region = geo[2] || city?.[0];
    if (!region) return null;
    const [x, y] = project(geo[0], geo[1]);
    return { branch: num, region, area: area || '—', district: geo[3] || NO_DISTRICT, x, y, exact: true };
  }
  if (!city) return null;
  const [x, y] = project(city[1], city[2]);
  return { branch: num, region: city[0], area, district: NO_DISTRICT, x, y, exact: false };
}

const areaName = (a) => AREA_AR[a] || a;
// Level → the key of the group an item falls in at that level.
const KEY = [it => it.loc.region, it => it.loc.area, it => it.loc.district, it => it.loc.branch];
const nameOf = (level, key) =>
  level === 0 ? REGION_BY_ID[key]?.ar : level === 1 ? areaName(key) : level === 2 ? key : branchLabel(key, 'ar');

function groupBy(items, keyFn) {
  const m = new Map();
  for (const it of items) {
    const k = keyFn(it);
    if (!m.has(k)) m.set(k, { key: k, items: [], branches: new Set() });
    const g = m.get(k);
    g.items.push(it);
    g.branches.add(it.loc.branch);
  }
  for (const g of m.values()) {
    g.x = g.items.reduce((s, it) => s + it.loc.x, 0) / g.items.length;
    g.y = g.items.reduce((s, it) => s + it.loc.y, 0) / g.items.length;
  }
  return [...m.values()].sort((a, b) => b.items.length - a.items.length || String(a.key).localeCompare(String(b.key), 'ar', { numeric: true }));
}

// `hero`: the dashboard's main view — region bubbles with overdue badges, KPIs
// above the map, and a side column ranking the regions with the chosen
// region's details. Without it, the compact map card (names + counts, chips).
export default function RegionMap({ requests, onSelect, hero = false }) {
  // Drill path: [regionId, area, district, branch]; [] = whole country.
  const [path, setPath]           = useState([]);
  const [focus, setFocus]         = useState(null);   // hero: region shown in the side panel (null = busiest)
  const [hover, setHover]         = useState(null);   // hero: region under the pointer (tooltip)
  const [showUnknown, setUnknown] = useState(false);
  const [vb, setVb]               = useState(FULL_VB);
  const [scale, setScale]         = useState(1);      // screen px per viewBox unit at full-country zoom
  // Tile layers, one per zoom level, oldest first: while flying in, each new
  // (sharper) level is drawn over the previous one so the map never goes blank.
  const [tileLayers, setTileLayers] = useState([]);
  const [modePick, setModePick]   = useState(null);   // 'map' | 'sat' | null (auto)
  const [box, setBox]             = useState({ w: MAP_W, h: MAP_H });   // the SVG's size on screen
  const vbRef   = useRef(FULL_VB);
  const scaleRef = useRef(1);
  const boxRef  = useRef({ w: MAP_W, h: MAP_H });
  const aspectRef = useRef(MAP_H / MAP_W);         // height/width of the view being drawn
  const expandedRef = useRef(false);
  const svgRef  = useRef(null);
  const pathRef = useRef({});
  const level = path.length;
  const expanded = level > 0;
  expandedRef.current = expanded;
  aspectRef.current = expanded ? boxRef.current.h / boxRef.current.w : MAP_H / MAP_W;

  const { items, unknown, byRegion, max } = useMemo(() => {
    const items = [], unknown = [];
    for (const req of requests || []) {
      if (!OPEN_STATUSES.includes(req.status)) continue;
      const loc = locate(req);
      if (loc && REGION_BY_ID[loc.region]) items.push({ req, loc }); else unknown.push({ req, loc: null });
    }
    const byRegion = Object.fromEntries(REGIONS.map(r => [r.id, 0]));
    for (const it of items) byRegion[it.loc.region]++;
    return { items, unknown, byRegion, max: Math.max(0, ...Object.values(byRegion)) };
  }, [requests]);

  // Requests inside the current drill scope, and its sub-groups (the next level).
  const scope = useMemo(() => items.filter(it => path.every((p, i) => KEY[i](it) === p)), [items, path]);
  const groups = useMemo(() => (level >= 1 && level <= 3 ? groupBy(scope, KEY[level]) : []), [scope, level]);

  // If the drilled-into place has no open requests left (after a refresh), step back.
  useEffect(() => {
    if (level > 1 && scope.length === 0) setPath(p => p.slice(0, -1));
  }, [level, scope.length]);

  const totalOpen = items.length + unknown.length;

  // Per-region breakdown for the hero view: status split, overdue, unassigned, cities.
  const { stats, kpi } = useMemo(() => {
    const today = new Date().toISOString().substring(0, 10);
    const overdue = (r) => !!r.dueDate && String(r.dueDate).substring(0, 10) < today;
    const stats = Object.fromEntries(REGIONS.map(r => [r.id, { n: 0, received: 0, scheduled: 0, in_progress: 0, overdue: 0, unassigned: 0, areas: new Set(), items: [] }]));
    for (const it of items) {
      const s = stats[it.loc.region];
      const od = overdue(it.req);
      s.n++; s[it.req.status]++; s.items.push({ ...it, od }); s.areas.add(it.loc.area);
      if (od) s.overdue++;
      if (!it.req.assignedTo) s.unassigned++;
    }
    const open = [...items, ...unknown].map(it => it.req);
    const ages = open.map(r => (Date.now() - new Date(r.createdAt).getTime()) / 864e5).filter(d => d >= 0 && isFinite(d));
    const kpi = {
      open: open.length,
      overdue: open.filter(overdue).length,
      unassigned: open.filter(r => !r.assignedTo).length,
      avgAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null,
    };
    return { stats, kpi };
  }, [items, unknown]);

  // Tiles for view `v` become the layer for their zoom level. `final` marks the
  // flight's destination: it is requested first (browsers fetch only a few
  // tiles at a time from one server, so it must not queue behind the
  // in-between levels) and is the only layer that gets the label overlays.
  // Returns the tile zoom; a no-op (no re-render) when nothing new is needed.
  const addTiles = (v, final = false) => {
    const { z, tiles } = tilesFor(v, expandedRef.current ? boxRef.current.w : scaleRef.current * MAP_W, final ? 0 : 1);
    setTileLayers(ls => {
      const same = ls.find(l => l.z === z);
      if (same && same.final === final && same.tiles.size === tiles.length && tiles.every(t => same.tiles.has(t.key))) return ls;
      const layer = { z, final: final || !!same?.final, tiles: new Map(tiles.map(t => [t.key, t])) };
      let rest = ls.filter(l => l.z !== z).map(l => (final && l.final ? { ...l, final: false } : l));
      // Keep the destination plus the two most recent in-between levels.
      const keepFinal = rest.find(l => l.final);
      rest = [...(keepFinal ? [keepFinal] : []), ...rest.filter(l => !l.final).slice(-2)];
      return [...rest, layer];
    });
    return z;
  };

  // Zoom (animated viewBox) to the current scope.
  const zoomKey = path.join('|') + '#' + scope.length;
  useEffect(() => {
    // What to fit: the whole country, or the scope's extent (padded, with a
    // minimum width per level). Its width/height are settled each frame from the
    // map's current shape, which changes when the card goes full screen.
    let fit = { cx: MAP_W / 2, cy: MAP_H / 2, bw: MAP_W, bh: MAP_H, minW: MAP_W };
    if (level > 0) {
      let b;
      const el = pathRef.current[path[0]];
      if (level === 1 && el) b = el.getBBox();
      else if (scope.length) {
        const xs = scope.map(it => it.loc.x), ys = scope.map(it => it.loc.y);
        b = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
      }
      if (b) {
        const pad = Math.max(b.width, b.height) * (level === 1 ? 0.12 : 0.3);
        fit = { cx: b.x + b.width / 2, cy: b.y + b.height / 2, bw: b.width + pad * 2, bh: b.height + pad * 2, minW: MIN_W[level] };
      }
    }
    const fitW = () => Math.max(fit.bw, fit.bh / aspectRef.current, fit.minW);
    if (level === 0) setTileLayers([]);
    const from = vbRef.current, start = performance.now();
    // Longer flights for bigger zoom changes (country → street ≈ 2.6 s).
    const doublings = Math.abs(Math.log2(fitW() / from[2]));
    const dur = Math.min(2600, Math.max(520, 450 + 260 * doublings));
    const ease = doublings > 2.5 ? easeInOut : easeOut;
    const targetVb = () => { const w = fitW(), h = w * aspectRef.current; return [fit.cx - w / 2, fit.cy - h / 2, w, h]; };
    // Destination tiles first; then every third zoom level on the way, at half resolution.
    let lastZ = level > 0 ? addTiles(targetVb(), true) : null;
    const finalZ = lastZ;
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur), e = ease(t);
      // Interpolate the zoom geometrically so deep zooms don't rush at the end.
      const w = from[2] * Math.pow(fitW() / from[2], e);
      const cx = (from[0] + from[2] / 2) + (fit.cx - (from[0] + from[2] / 2)) * e;
      const cy = (from[1] + from[3] / 2) + (fit.cy - (from[1] + from[3] / 2)) * e;
      const h = w * aspectRef.current;
      const next = [cx - w / 2, cy - h / 2, w, h];
      vbRef.current = next; setVb(next);
      if (level > 0) {
        if (t >= 1) addTiles(next, true);              // settle exactly on the final view
        else {
          const z = tilesFor(next, expandedRef.current ? boxRef.current.w : scaleRef.current * MAP_W, 1).z;
          if (z < finalZ - 1 && Math.abs(z - lastZ) >= 3) lastZ = addTiles(next);
        }
      }
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [zoomKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Labels/points keep a readable on-screen size whatever the map's size.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (!width) return;
      const scale = Math.min(width / MAP_W, height ? height / MAP_H : Infinity) || 1;
      setScale(scale); scaleRef.current = scale;
      setBox({ w: width, h: height || width * MAP_H / MAP_W });
      boxRef.current = { w: width, h: height || width * MAP_H / MAP_W };
      if (expandedRef.current) {
        aspectRef.current = boxRef.current.h / boxRef.current.w;
        // Re-fit the current view to the new shape (keeps its centre and width).
        const v = vbRef.current, h = v[2] * aspectRef.current;
        const next = [v[0], v[1] + v[3] / 2 - h / 2, v[2], h];
        vbRef.current = next; setVb(next);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Full-screen while drilled in: lock page scroll, Esc steps back one level.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setPath(p => p.slice(0, -1)); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [expanded]);

  // Everything except the region outlines is drawn in screen pixels: at street
  // level the map is zoomed ~6000x, which browsers can't render precisely in
  // SVG user units (tiles vanish, text blurs). X/Y turn map units into pixels.
  // Full screen: the map fills its whole (wider) area. Otherwise it keeps the
  // country's shape.
  const VW = expanded ? box.w : MAP_W * scale;     // the SVG's size in px
  const VH = expanded ? box.h : MAP_H * scale;
  const S = VW / vb[2];                            // px per map unit right now
  const X = (x) => (x - vb[0]) * S, Y = (y) => (y - vb[1]) * S;
  const px = S;
  // Region labels shrink a little with the map, but never below 0.7x.
  const lk = Math.max(scale, 0.7);
  // Satellite by default at branch level (street view), streets above it.
  const mode = modePick || (level === 4 ? 'sat' : 'map');
  const source = TILE_SOURCES[mode];
  const hasTiles = expanded && tileLayers.length > 0;

  // Bubble names that would overlap a busier neighbour's are left off the map
  // (the count stays; the name is in the chips under the map).
  const shownNames = new Set();
  if (level === 1 || level === 2) {
    const boxes = [];
    for (const g of groups) {                          // already busiest first
      const r = 14 + 4 * Math.sqrt(g.items.length);
      const w = 7.5 * String(nameOf(level, g.key)).length + 10;
      const cx = g.x * px, cy = g.y * px + r + 10;
      const box = [cx - w / 2, cy - 9, cx + w / 2, cy + 9];
      const hit = boxes.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
      if (!hit) { boxes.push(box); shownNames.add(g.key); }
    }
  }
  const drill = (key) => { setUnknown(false); setPath(p => [...p, key]); };
  const goTo = (n) => setPath(p => p.slice(0, n));
  const pickRegion = (id) => { setUnknown(false); setHover(null); setPath(p => (p[0] === id && p.length === 1 ? [] : [id])); };

  const sortedRegions = [...REGIONS].sort((a, b) => byRegion[b.id] - byRegion[a.id] || a.ar.localeCompare(b.ar, 'ar'));
  const branchNum = level === 4 ? path[3] : null;
  const branchInfo = branchNum ? getBranchInfo(branchNum) : null;
  const listItems = showUnknown && !expanded ? unknown : scope;
  const crumbs = [['السعودية', 0], ...path.map((p, i) => [nameOf(i, p), i + 1])];
  const childNoun = ['', 'المدن', 'الأحياء', 'الفروع'][level] || '';

  // ── Hero view: the region in the side panel, and the panel itself ──
  const heroTop = hero && level === 0;
  const busiest = sortedRegions.find(r => byRegion[r.id] > 0)?.id || null;
  const focusId = focus && byRegion[focus] > 0 ? focus : busiest;
  const ranked = sortedRegions.filter(r => byRegion[r.id] > 0);
  const STATUS_KEYS = ['received', 'scheduled', 'in_progress'];
  const f = focusId ? stats[focusId] : null;
  const focusList = f ? [...f.items].sort((a, b) => (b.od - a.od) || String(a.req.createdAt).localeCompare(String(b.req.createdAt))).slice(0, 4) : [];
  const clickRegion = (id) => {
    if (heroTop) { if (id === focusId) pickRegion(id); else setFocus(id); }
    else if (level === 0 || path[0] !== id) pickRegion(id);
  };
  // Bubbles shrink with the map down to a phone width; there the mid-size
  // regions' names are left off (they collide) — the ranking list has them.
  const bk = Math.min(1, Math.max(scale, 0.6));
  const narrow = scale < 0.7;
  const bubbleR = (n) => (11 + 4.2 * Math.sqrt(n)) * bk;

  const side = hero && (
    <aside className="rm-side" dir="rtl">
      <div className="rm-panel">
        <div className="rm-panel-title">
          <span>ترتيب المناطق</span>
          <span className="rm-panel-hint">
            {STATUS_KEYS.map(k => <span key={k}><i style={{ background: STATUS[k].color }} />{STATUS[k].ar}</span>)}
          </span>
        </div>
        {ranked.length === 0 ? <div className="rm-empty">لا توجد طلبات مفتوحة 🎉</div> : ranked.map(r => {
          const s = stats[r.id];
          return (
            <button key={r.id} className={`rm-rank${r.id === focusId ? ' on' : ''}`} onClick={() => setFocus(r.id)} onDoubleClick={() => pickRegion(r.id)}>
              <span className="rm-rank-name">{r.ar}</span>
              <span className="rm-rank-track">
                <span style={{ width: `${(s.n / max) * 100}%` }}>
                  {STATUS_KEYS.map(k => s[k] > 0 && <i key={k} style={{ flex: s[k], background: STATUS[k].color }} />)}
                </span>
              </span>
              <b>{s.n}</b>
              <span className="rm-rank-od">{s.overdue ? `⏰ ${s.overdue}` : ''}</span>
            </button>
          );
        })}
      </div>

      {f && f.n > 0 && (
        <div className="rm-panel rm-focus">
          <div className="rm-focus-head">
            <b>📍 منطقة {REGION_BY_ID[focusId].ar}</b>
            <span>{f.areas.size} {f.areas.size === 1 ? 'مدينة' : 'مدن'}</span>
          </div>
          <div className="rm-facts">
            <div><b>{f.n}</b>مفتوحة</div>
            <div><b style={{ color: f.overdue ? 'var(--status-red)' : undefined }}>{f.overdue}</b>متأخرة</div>
            <div><b style={{ color: f.unassigned ? '#B45309' : undefined }}>{f.unassigned}</b>غير مسندة</div>
          </div>
          <div className="rm-focus-pills">
            {STATUS_KEYS.map(k => f[k] > 0 && (
              <span key={k} className="badge" style={{ color: STATUS[k].color, background: STATUS[k].bg, fontSize: 11 }}>
                <span className="badge-dot" />{STATUS[k].ar} {f[k]}
              </span>
            ))}
          </div>
          {focusList.map(({ req, loc, od }) => (
            <button key={req.id} className="rm-focus-item" onClick={() => onSelect(req)}>
              <span className="rm-focus-main">
                <b>{branchLabel(req.branchNumber, 'ar')}</b>
                <span className="rm-focus-area"> · {areaName(loc.area)}</span>
                {od && <span className="rm-focus-od"> ⏰ متأخر</span>}
                <small>{req.problemDescription || '—'}</small>
              </span>
              <StatusBadge status={STATUS[req.status]} lang="ar" style={{ fontSize: 11, flexShrink: 0 }} />
            </button>
          ))}
          <div className="rm-focus-actions">
            <button className="rm-btn" onClick={() => pickRegion(focusId)}>
              عرض المدن والطلبات ({f.n}) ←
            </button>
          </div>
        </div>
      )}
    </aside>
  );

  const card = (
      <section className={`rm-card${expanded ? ' expanded' : ''}${hero ? ' hero' : ''}`}>
        {heroTop ? (
          <div className="rm-hero-head" dir="rtl">
            <div>
              <div className="rm-hero-title">الطلبات المفتوحة حسب المنطقة</div>
              <div className="rm-hero-sub">اضغط على منطقة لعرض تفاصيلها، واضغط مرة ثانية للنزول للمدن</div>
            </div>
            <div className="rm-kpis">
              <div><b>{kpi.open}</b>طلب مفتوح</div>
              <div><b style={{ color: kpi.overdue ? 'var(--status-red)' : undefined }}>{kpi.overdue}</b>متأخرة</div>
              <div><b style={{ color: kpi.unassigned ? '#B45309' : undefined }}>{kpi.unassigned}</b>غير مسندة</div>
              <div><b>{kpi.avgAge == null ? '—' : kpi.avgAge.toFixed(1)}</b>متوسط عمر الطلب (يوم)</div>
            </div>
          </div>
        ) : (
        <div className="rm-head">
          <span className="rm-title">🗺️ Open Requests by Region / <span dir="rtl">الطلبات المفتوحة حسب المنطقة</span></span>
          <span className="rm-total">{expanded ? `${scope.length} of ${totalOpen} open` : `${totalOpen} open`}</span>
          {expanded && <button className="rm-close" onClick={() => goTo(0)} aria-label="Close">✕</button>}
        </div>
        )}

        {expanded && (
          <nav className="rm-crumbs" dir="rtl">
            {crumbs.map(([label, n], i) => (
              <span key={n}>
                {i > 0 && <span className="rm-crumb-sep">‹</span>}
                {n === level
                  ? <b>{label}</b>
                  : <button className="rm-crumb" onClick={() => goTo(n)}>{label}</button>}
              </span>
            ))}
          </nav>
        )}

        <div className="rm-map-wrap">
          <svg ref={svgRef} className="rm-svg" viewBox={`0 0 ${VW.toFixed(2)} ${VH.toFixed(2)}`} role="img" aria-label="Open requests per region of Saudi Arabia">
            {hasTiles && (
              <g className={`rm-tiles ${mode}`}>
                {/* Coarse levels under fine ones; labels only on the destination. */}
                {[...tileLayers].sort((a, b) => a.z - b.z).map(layer => (
                  <g key={`${mode}-${layer.z}`}>
                    {[...layer.tiles.values()].map(t => {
                      const x = X(t.x), y = Y(t.y), w = t.w * S, h = t.h * S;
                      if (x > VW || y > VH || x + w < 0 || y + h < 0) return null;
                      return (layer.final ? source.layers : source.layers.slice(0, 1)).map((url, i) => (
                        // +0.5px overlap hides hairline seams between neighbouring tiles.
                        <image key={`${t.key}-${i}`} href={url(t.z, t.tx, t.ty)} x={x} y={y}
                          width={w + 0.5} height={h + 0.5} preserveAspectRatio="none"
                          className={i ? 'rm-tile-label' : undefined} />
                      ));
                    })}
                  </g>
                ))}
              </g>
            )}
            {/* Region outlines: the only part drawn in map units (scaled by the group).
                Left out inside a district (level 3+): there the scale is in the
                thousands and browsers smear the shapes over the whole map. */}
            {level < 3 && <g transform={`matrix(${S} 0 0 ${S} ${-vb[0] * S} ${-vb[1] * S})`}>
              {REGIONS.map((r, idx) => {
                const n = byRegion[r.id];
                const on = path[0] === r.id;
                // Zoomed in, the streets show through: the chosen region is
                // clear (outlined) and the others are washed out.
                const fill = !expanded ? fillFor(n, max) : on ? 'transparent' : 'rgba(241,245,249,.75)';
                return (
                  <path key={r.id}
                    ref={el => { pathRef.current[r.id] = el; }}
                    d={r.d}
                    vectorEffect="non-scaling-stroke"
                    className={`rm-region${on ? ' on' : ''}${heroTop && r.id === focusId ? ' focus' : ''}${expanded && !on ? ' wash' : ''}`}
                    style={{ fill, animationDelay: `${idx * 35}ms`, strokeWidth: (on || (heroTop && r.id === focusId) ? 2.2 : 1) * lk }}
                    onMouseEnter={heroTop ? () => setHover(r.id) : undefined}
                    onMouseLeave={heroTop ? () => setHover(h => (h === r.id ? null : h)) : undefined}
                    onClick={() => clickRegion(r.id)}>
                    <title>{`${r.ar} ${n}`}</title>
                  </path>
                );
              })}
            </g>}

            {/* Hero: a bubble per region with open requests (count inside, name
                under it, red badge = overdue); faint names for the rest. The
                focused region is drawn last so its gold ring sits on top. */}
            {heroTop && [...REGIONS].sort((a, b) => (a.id === focusId) - (b.id === focusId)).map(r => {
              const s = stats[r.id];
              const [dx, dy] = LABEL_NUDGE[r.id] || [0, 0];
              const x = X(r.cx + dx), y = Y(r.cy + dy);
              if (!s.n) {
                return SMALL.has(r.id) || narrow ? null : (
                  <text key={r.id} x={x} y={y} dy=".35em" textAnchor="middle" direction="rtl" className="rm-hero-zero"
                    style={{ fontSize: 13 * lk }}>{r.ar}</text>
                );
              }
              const rad = bubbleR(s.n), on = r.id === focusId;
              return (
                <g key={`${r.id}-${s.n}`} className={`rm-hero-bubble${on ? ' on' : ''}`}
                  onClick={() => clickRegion(r.id)} onMouseEnter={() => setHover(r.id)} onMouseLeave={() => setHover(h => (h === r.id ? null : h))}>
                  <title>{`${r.ar} · ${s.n}`}</title>
                  <circle cx={x} cy={y} r={rad + 4} className="rm-hero-halo" />
                  <circle cx={x} cy={y} r={rad} className="rm-hero-disc" />
                  <text x={x} y={y} dy=".35em" textAnchor="middle" className="rm-hero-n" style={{ fontSize: (s.n > 9 ? 17 : 15) * bk }}>{s.n}</text>
                  {!SMALL.has(r.id) && !(narrow && MID.has(r.id)) && (
                    <text x={x} y={y + rad + 15 * bk} textAnchor="middle" direction="rtl" className="rm-hero-name"
                      style={{ fontSize: 13.5 * bk }}>{r.ar}</text>
                  )}
                  {s.overdue > 0 && (
                    <>
                      <circle cx={x + rad * 0.74} cy={y - rad * 0.74} r={8.5} className="rm-hero-od" />
                      <text x={x + rad * 0.74} y={y - rad * 0.74} dy=".35em" textAnchor="middle" className="rm-hero-od-n">{s.overdue}</text>
                    </>
                  )}
                </g>
              );
            })}

            {level === 0 && !hero && REGIONS.map(r => {
              const n = byRegion[r.id];
              const [dx, dy] = LABEL_NUDGE[r.id] || [0, 0];
              const x = X(r.cx + dx), y = Y(r.cy + dy);
              const fs = (SMALL.has(r.id) ? 13 : 17) * lk;
              return (
                <g key={`${r.id}-${n}`} className="rm-label" onClick={() => pickRegion(r.id)} style={{ cursor: 'pointer' }}>
                  {SMALL.has(r.id) ? (
                    <>
                      <circle cx={x} cy={y} r={12 * lk} className="rm-small-dot" style={{ fill: n ? '#1E3A5F' : '#94A3B8', strokeWidth: 1.5 * lk }} />
                      <text x={x} y={y} dy=".35em" textAnchor="middle" className="rm-count rm-pop" style={{ fontSize: fs, fill: '#fff' }}>{n}</text>
                    </>
                  ) : (
                    <text x={x} y={y} textAnchor="middle" className="rm-pop" direction="rtl"
                      style={{ fontSize: fs, fill: isDark(n, max) ? '#fff' : '#0F172A' }}>
                      <tspan className={`rm-name${MID.has(r.id) ? ' rm-name-mid' : ''}`}>{r.ar} </tspan>
                      <tspan className="rm-count">{n}</tspan>
                    </text>
                  )}
                </g>
              );
            })}

            {/* Cities (level 1) / districts (level 2): a bubble per group. */}
            {(level === 1 || level === 2) && groups.map((g, i) => {
              const n = g.items.length;
              const r = 14 + 4 * Math.sqrt(n);
              const x = X(g.x), y = Y(g.y);
              return (
                <g key={`${level}-${g.key}-${n}`} className={`rm-bubble lvl${level}`} style={{ animationDelay: `${i * 30}ms` }}
                  onClick={() => drill(g.key)}>
                  <title>{`${nameOf(level, g.key)} · ${n}`}</title>
                  <circle cx={x} cy={y} r={r} style={{ strokeWidth: 2 }} />
                  <text x={x} y={y} dy=".35em" textAnchor="middle" className="rm-bubble-n" style={{ fontSize: 15 }}>{n}</text>
                  {shownNames.has(g.key) && <text x={x} y={y + r + 15} textAnchor="middle" direction="rtl" className="rm-bubble-name" style={{ fontSize: 14, strokeWidth: 3.5 }}>
                    {nameOf(level, g.key)}
                  </text>}
                </g>
              );
            })}

            {/* Branches (level 3, and the chosen one at level 4): the branch number on the pin. */}
            {level >= 3 && (level === 3 ? groups : groupBy(scope, KEY[3])).map((g, i) => {
              const n = g.items.length;
              const on = g.key === branchNum;
              const label = /^\d+$/.test(g.key) ? g.key : g.key.replace(/-(\d+)$/, ' $1');
              const w = Math.max(34, 9 * label.length + 18), h = 26;
              const x = X(g.x), y = Y(g.y);
              return (
                <g key={`b-${g.key}-${n}`} className={`rm-branch${on ? ' on' : ''}`} style={{ animationDelay: `${i * 30}ms` }}
                  onClick={() => (level === 3 ? drill(g.key) : null)}>
                  <title>{`${branchLabel(g.key, 'ar')} · ${n}`}</title>
                  <path d={`M${x},${y} l-5,-8 h10 z`} className="rm-branch-tip" />
                  <rect x={x - w / 2} y={y - 8 - h} width={w} height={h} rx={6} style={{ strokeWidth: 1.5 }} />
                  <text x={x} y={y - 8 - h / 2} dy=".35em" textAnchor="middle" style={{ fontSize: 14 }}>{label}</text>
                  <circle cx={x + w / 2} cy={y - 8 - h} r={9} className="rm-branch-badge" style={{ strokeWidth: 1.5 }} />
                  <text x={x + w / 2} y={y - 8 - h} dy=".35em" textAnchor="middle" className="rm-branch-badge-n" style={{ fontSize: 11 }}>{n}</text>
                </g>
              );
            })}
          </svg>

          {expanded && level > 0 && (
            <button className="rm-reset" onClick={() => goTo(level - 1)}>‹ رجوع</button>
          )}
          {expanded && (
            <div className="rm-mode" role="group" aria-label="Map type">
              <button className={mode === 'map' ? 'on' : ''} onClick={() => setModePick('map')}>🗺️ شوارع</button>
              <button className={mode === 'sat' ? 'on' : ''} onClick={() => setModePick('sat')}>🛰️ قمر صناعي</button>
            </div>
          )}
          {hasTiles && (
            <a className="rm-attrib" href={source.link} target="_blank" rel="noopener noreferrer">
              {source.attrib}
            </a>
          )}

          {heroTop && hover && stats[hover]?.n > 0 && (() => {
            const r = REGION_BY_ID[hover], s = stats[hover];
            const [dx, dy] = LABEL_NUDGE[hover] || [0, 0];
            const x = Math.min(Math.max(X(r.cx + dx), 112), VW - 112);
            const y = Y(r.cy + dy) + bubbleR(s.n) + 24 * bk;
            const below = y + 120 < VH;
            return (
              <div className="rm-tip" dir="rtl" style={{ left: x, top: below ? y : Y(r.cy + dy) - bubbleR(s.n) - 10, transform: below ? 'translateX(-50%)' : 'translate(-50%, -100%)' }}>
                <div className="rm-tip-head"><b>{r.ar}</b><span>{s.n} مفتوحة</span></div>
                <div className="rm-tip-bar">{STATUS_KEYS.map(k => s[k] > 0 && <i key={k} style={{ flex: s[k], background: STATUS[k].color }} />)}</div>
                <div className="rm-tip-body">
                  {STATUS_KEYS.filter(k => s[k] > 0).map(k => `${STATUS[k].ar} ${s[k]}`).join(' · ')}
                  <br />متأخرة {s.overdue} · غير مسندة {s.unassigned}
                </div>
                <div className="rm-tip-cta">{hover === focusId ? 'اضغط لعرض المدن ←' : 'اضغط لعرض التفاصيل'}</div>
              </div>
            );
          })()}
        </div>

        {level === 0 && (
          <>
            <div className="rm-legend">
              <span className="rm-legend-zero"><i style={{ background: ZERO_FILL }} />0</span>
              <span className="rm-legend-bar" />
              <span>{max}</span>
              {hero && <span className="rm-legend-od"><i>!</i> متأخرة</span>}
              <button className={`rm-unknown${showUnknown ? ' on' : ''}`} onClick={() => setUnknown(s => !s)}>
                غير محدد <b key={unknown.length} className="rm-pop">{unknown.length}</b>
              </button>
            </div>
            {!hero && <div className="rm-chips" dir="rtl">
              {sortedRegions.map(r => {
                const n = byRegion[r.id];
                return (
                  <button key={r.id} className={`rm-chip${n ? '' : ' zero'}`} onClick={() => pickRegion(r.id)}>
                    <i style={{ background: fillFor(n, max) }} />{r.ar} <b key={n} className="rm-pop">{n}</b>
                  </button>
                );
              })}
            </div>}
          </>
        )}

        {level >= 1 && level <= 3 && (
          <div className="rm-chips" dir="rtl">
            <span className="rm-chips-label">{childNoun}:</span>
            {groups.map(g => (
              <button key={g.key} className="rm-chip" onClick={() => drill(g.key)}>
                {nameOf(level, g.key)} <b key={g.items.length} className="rm-pop">{g.items.length}</b>
              </button>
            ))}
          </div>
        )}

        {level === 4 && (
          <div className="rm-branch-card" dir="rtl">
            <div className="rm-branch-title">{branchLabel(branchNum, 'ar')} <span>· {scope.length} مفتوح</span></div>
            <div className="rm-branch-meta">
              {areaName(path[1])} · {path[2]}
              {branchInfo?.address && <> · <bdi>{branchInfo.address}</bdi></>}
            </div>
            {branchInfo?.mapsUrl && (
              <a className="rm-link" href={branchInfo.mapsUrl} target="_blank" rel="noopener noreferrer">📍 فتح في خرائط Google</a>
            )}
          </div>
        )}

        {(expanded || showUnknown) && (
          <div className="rm-list">
            <div className="rm-list-title">
              <span>
                <bdi>{expanded ? nameOf(level - 1, path[level - 1]) : 'غير محدد'}</bdi>
                {' '}— {listItems.length} open {listItems.length === 1 ? 'request' : 'requests'}
              </span>
            </div>
            {listItems.length === 0 ? (
              <div className="rm-empty">No open requests here 🎉</div>
            ) : (
              <table className="rm-table">
                <thead><tr><th>Request</th><th>Branch</th><th>District</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {listItems.map(({ req, loc }) => (
                    <tr key={req.id}>
                      <td className="rm-id">{req.id}</td>
                      <td>
                        {loc && !(level === 4 && path[3] === loc.branch)
                          ? <button className="rm-link rm-fly" title="Zoom to this branch"
                              onClick={() => { setUnknown(false); setPath([loc.region, loc.area, loc.district, loc.branch]); }}>
                              📍 {branchLabel(req.branchNumber)}
                            </button>
                          : (branchLabel(req.branchNumber) || '—')}
                      </td>
                      <td dir="rtl">{loc ? `${areaName(loc.area)} · ${loc.district}` : '—'}</td>
                      <td><StatusBadge status={STATUS[req.status]} style={{ fontSize: 11 }} /></td>
                      <td><button className="rm-link" onClick={() => onSelect(req)}>Open ›</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </section>
  );

  return (
    <>
      {expanded && <div className="rm-backdrop" onClick={() => goTo(0)} />}
      {hero ? <div className="rm-hero">{card}{side}</div> : card}
    </>
  );
}
