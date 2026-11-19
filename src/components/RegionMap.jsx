import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS } from '../storage';
import { branchLabel, getBranchInfo } from '../branchData';
import { AREA_AR } from '../branchDataAr';
import { MAP_W, MAP_H, REGIONS, project } from '../saudiRegions';
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
const LIGHT = [0xEB, 0xD9, 0xC5];
const DARK  = [0x56, 0x3B, 0x2C];
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
const REGION_BY_ID = Object.fromEntries(REGIONS.map(r => [r.id, r]));

// Smallest map width (viewBox units, 1 unit ≈ 2.7 km) per drill level, so a
// city or district with a single branch still opens at a sensible zoom.
const MIN_W = [MAP_W, MAP_W / 3.2, 5, 1.2, 0.7];

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

export default function RegionMap({ requests, onSelect }) {
  // Drill path: [regionId, area, district, branch]; [] = whole country.
  const [path, setPath]           = useState([]);
  const [showUnknown, setUnknown] = useState(false);
  const [vb, setVb]               = useState(FULL_VB);
  const [scale, setScale]         = useState(1);      // screen px per viewBox unit at full-country zoom
  const vbRef   = useRef(FULL_VB);
  const svgRef  = useRef(null);
  const pathRef = useRef({});
  const level = path.length;
  const expanded = level > 0;

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

  // Zoom (animated viewBox) to the current scope.
  const zoomKey = path.join('|') + '#' + scope.length;
  useEffect(() => {
    let target = FULL_VB;
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
        let w = Math.max(b.width + pad * 2, (b.height + pad * 2) * MAP_W / MAP_H, MIN_W[level]);
        const h = w * MAP_H / MAP_W;
        target = [b.x + b.width / 2 - w / 2, b.y + b.height / 2 - h / 2, w, h];
      }
    }
    const from = vbRef.current, start = performance.now(), dur = 520;
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur), e = easeOut(t);
      // Interpolate the zoom geometrically so deep zooms don't rush at the end.
      const w = from[2] * Math.pow(target[2] / from[2], e);
      const cx = (from[0] + from[2] / 2) + ((target[0] + target[2] / 2) - (from[0] + from[2] / 2)) * e;
      const cy = (from[1] + from[3] / 2) + ((target[1] + target[3] / 2) - (from[1] + from[3] / 2)) * e;
      const h = w * MAP_H / MAP_W;
      const next = [cx - w / 2, cy - h / 2, w, h];
      vbRef.current = next; setVb(next);
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
      const scale = Math.min(width / MAP_W, height ? height / MAP_H : Infinity) || 1;
      setScale(scale);
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

  // Region labels shrink a little with the map (but never below 0.7×); bubbles
  // and pins keep a fixed on-screen size: divide a pixel size by `px`.
  const k = Math.max(1, 0.7 / scale);
  const zoom = MAP_W / vb[2] / k;
  const px = MAP_W / vb[2] * scale;

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
  const pickRegion = (id) => { setUnknown(false); setPath(p => (p[0] === id && p.length === 1 ? [] : [id])); };

  const sortedRegions = [...REGIONS].sort((a, b) => byRegion[b.id] - byRegion[a.id] || a.ar.localeCompare(b.ar, 'ar'));
  const branchNum = level === 4 ? path[3] : null;
  const branchInfo = branchNum ? getBranchInfo(branchNum) : null;
  const listItems = showUnknown && !expanded ? unknown : scope;
  const crumbs = [['السعودية', 0], ...path.map((p, i) => [nameOf(i, p), i + 1])];
  const childNoun = ['', 'المدن', 'الأحياء', 'الفروع'][level] || '';

  return (
    <>
      {expanded && <div className="rm-backdrop" onClick={() => goTo(0)} />}
      <section className={`rm-card${expanded ? ' expanded' : ''}`}>
        <div className="rm-head">
          <span className="rm-title">🗺️ Open Requests by Region / <span dir="rtl">الطلبات المفتوحة حسب المنطقة</span></span>
          <span className="rm-total">{expanded ? `${scope.length} of ${totalOpen} open` : `${totalOpen} open`}</span>
          {expanded && <button className="rm-close" onClick={() => goTo(0)} aria-label="Close">✕</button>}
        </div>

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
          <svg ref={svgRef} className="rm-svg" viewBox={vb.map(v => v.toFixed(4)).join(' ')} role="img" aria-label="Open requests per region of Saudi Arabia">
            {REGIONS.map((r, idx) => {
              const n = byRegion[r.id];
              const on = path[0] === r.id;
              return (
                <path key={r.id}
                  ref={el => { pathRef.current[r.id] = el; }}
                  d={r.d}
                  className={`rm-region${on ? ' on' : ''}${expanded && !on ? ' dim' : ''}`}
                  style={{ fill: expanded && on ? '#F6EEE6' : fillFor(n, max), animationDelay: `${idx * 35}ms`, strokeWidth: (on ? 2.2 : 1) / zoom }}
                  onClick={() => (level === 0 || !on ? pickRegion(r.id) : null)}>
                  <title>{`${r.ar} ${n}`}</title>
                </path>
              );
            })}

            {level === 0 && REGIONS.map(r => {
              const n = byRegion[r.id];
              const [dx, dy] = LABEL_NUDGE[r.id] || [0, 0];
              const x = r.cx + dx, y = r.cy + dy;
              const fs = (SMALL.has(r.id) ? 13 : 17) / zoom;
              return (
                <g key={`${r.id}-${n}`} className="rm-label" onClick={() => pickRegion(r.id)} style={{ cursor: 'pointer' }}>
                  {SMALL.has(r.id) ? (
                    <>
                      <circle cx={x} cy={y} r={12 / zoom} className="rm-small-dot" style={{ fill: n ? '#563b2c' : '#94A3B8', strokeWidth: 1.5 / zoom }} />
                      <text x={x} y={y} dy=".35em" textAnchor="middle" className="rm-count rm-pop" style={{ fontSize: fs, fill: '#fff' }}>{n}</text>
                    </>
                  ) : (
                    <text x={x} y={y} textAnchor="middle" className="rm-pop" direction="rtl"
                      style={{ fontSize: fs, fill: isDark(n, max) ? '#fff' : '#3b2a20' }}>
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
              const r = (14 + 4 * Math.sqrt(n)) / px;
              return (
                <g key={`${level}-${g.key}-${n}`} className={`rm-bubble lvl${level}`} style={{ animationDelay: `${i * 30}ms` }}
                  onClick={() => drill(g.key)}>
                  <title>{`${nameOf(level, g.key)} · ${n}`}</title>
                  <circle cx={g.x} cy={g.y} r={r} style={{ strokeWidth: 2 / px }} />
                  <text x={g.x} y={g.y} dy=".35em" textAnchor="middle" className="rm-bubble-n" style={{ fontSize: 15 / px }}>{n}</text>
                  {shownNames.has(g.key) && <text x={g.x} y={g.y + r + 15 / px} textAnchor="middle" direction="rtl" className="rm-bubble-name" style={{ fontSize: 14 / px, strokeWidth: 3.5 / px }}>
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
              const w = (Math.max(34, 9 * label.length + 18)) / px, h = 26 / px;
              return (
                <g key={`b-${g.key}-${n}`} className={`rm-branch${on ? ' on' : ''}`} style={{ animationDelay: `${i * 30}ms` }}
                  onClick={() => (level === 3 ? drill(g.key) : null)}>
                  <title>{`${branchLabel(g.key, 'ar')} · ${n}`}</title>
                  <path d={`M${g.x},${g.y} l${-5 / px},${-8 / px} h${10 / px} z`} className="rm-branch-tip" />
                  <rect x={g.x - w / 2} y={g.y - 8 / px - h} width={w} height={h} rx={6 / px} style={{ strokeWidth: 1.5 / px }} />
                  <text x={g.x} y={g.y - 8 / px - h / 2} dy=".35em" textAnchor="middle" style={{ fontSize: 14 / px }}>{label}</text>
                  <circle cx={g.x + w / 2} cy={g.y - 8 / px - h} r={9 / px} className="rm-branch-badge" style={{ strokeWidth: 1.5 / px }} />
                  <text x={g.x + w / 2} y={g.y - 8 / px - h} dy=".35em" textAnchor="middle" className="rm-branch-badge-n" style={{ fontSize: 11 / px }}>{n}</text>
                </g>
              );
            })}
          </svg>

          {expanded && level > 0 && (
            <button className="rm-reset" onClick={() => goTo(level - 1)}>‹ رجوع</button>
          )}
        </div>

        {level === 0 && (
          <>
            <div className="rm-legend">
              <span className="rm-legend-zero"><i style={{ background: ZERO_FILL }} />0</span>
              <span className="rm-legend-bar" />
              <span>{max}</span>
              <button className={`rm-unknown${showUnknown ? ' on' : ''}`} onClick={() => setUnknown(s => !s)}>
                غير محدد <b key={unknown.length} className="rm-pop">{unknown.length}</b>
              </button>
            </div>
            <div className="rm-chips" dir="rtl">
              {sortedRegions.map(r => {
                const n = byRegion[r.id];
                return (
                  <button key={r.id} className={`rm-chip${n ? '' : ' zero'}`} onClick={() => pickRegion(r.id)}>
                    <i style={{ background: fillFor(n, max) }} />{r.ar} <b key={n} className="rm-pop">{n}</b>
                  </button>
                );
              })}
            </div>
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
                      <td>{branchLabel(req.branchNumber) || '—'}</td>
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
    </>
  );
}
