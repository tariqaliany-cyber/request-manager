import { useEffect, useMemo, useRef, useState } from 'react';
import { STATUS } from '../storage';
import { branchLabel } from '../branchData';
import { AREA_AR } from '../branchDataAr';
import { MAP_W, MAP_H, REGIONS, project } from '../saudiRegions';
import { branchRegion } from '../regionData';
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

export default function RegionMap({ requests, onSelect }) {
  const [selected, setSelected]   = useState(null);   // region id | 'unknown' | null
  const [branchPick, setBranch]   = useState(null);   // branch number filter inside a region
  const [vb, setVb]               = useState(FULL_VB);
  const [k, setK]                 = useState(1);      // label/point boost on narrow screens
  const vbRef   = useRef(FULL_VB);
  const svgRef  = useRef(null);
  const pathRef = useRef({});

  // Open requests grouped by region (and "unknown").
  const { byRegion, unknown, max } = useMemo(() => {
    const byRegion = Object.fromEntries(REGIONS.map(r => [r.id, []]));
    const unknown = [];
    for (const req of requests || []) {
      if (!OPEN_STATUSES.includes(req.status)) continue;
      const loc = branchRegion(req.branchNumber);
      if (loc && byRegion[loc.region]) byRegion[loc.region].push({ req, loc });
      else unknown.push({ req, loc: null });
    }
    const max = Math.max(0, ...Object.values(byRegion).map(a => a.length));
    return { byRegion, unknown, max };
  }, [requests]);

  const totalOpen = Object.values(byRegion).reduce((n, a) => n + a.length, 0) + unknown.length;

  // One point per branch in the selected region, fanned out around its city.
  const points = useMemo(() => {
    if (!selected || selected === 'unknown') return [];
    const groups = new Map();
    for (const { req, loc } of byRegion[selected] || []) {
      const key = String(req.branchNumber);
      if (!groups.has(key)) groups.set(key, { branch: key, loc, reqs: [] });
      groups.get(key).reqs.push(req);
    }
    const perArea = new Map();
    return [...groups.values()]
      .sort((a, b) => b.reqs.length - a.reqs.length || a.branch.localeCompare(b.branch, 'en', { numeric: true }))
      .map(g => {
        const i = perArea.get(g.loc.area) || 0;
        perArea.set(g.loc.area, i + 1);
        const [x, y] = project(g.loc.lon, g.loc.lat);
        return { ...g, x, y, i };
      });
  }, [selected, byRegion]);

  // Zoom (animated viewBox) to the selected region.
  useEffect(() => {
    let target = FULL_VB;
    const el = selected && selected !== 'unknown' && pathRef.current[selected];
    if (el) {
      const b = el.getBBox();
      const pad = Math.max(b.width, b.height) * 0.12 + 10;
      let w = b.width + pad * 2, h = b.height + pad * 2;
      // Keep the map's aspect ratio (so the card doesn't change height) and
      // cap the zoom for tiny regions.
      w = Math.max(w, h * MAP_W / MAP_H, MAP_W / 3.2);
      h = w * MAP_H / MAP_W;
      target = [b.x + b.width / 2 - w / 2, b.y + b.height / 2 - h / 2, w, h];
    }
    const from = vbRef.current, start = performance.now(), dur = 480;
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur), e = easeOut(t);
      const next = from.map((v, i) => v + (target[i] - v) * e);
      vbRef.current = next; setVb(next);
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  // On a phone the whole country is ~330px wide, so labels drawn at desktop
  // size would be ~7px; grow them (and the points) as the map shrinks.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setK(Math.max(1, 0.7 / (e.contentRect.width / MAP_W || 1))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the scale of labels and points constant on screen while zooming.
  const zoom = MAP_W / vb[2] / k;

  const pick = (id) => { setBranch(null); setSelected(s => (s === id ? null : id)); };

  const listItems = selected === 'unknown' ? unknown
    : selected ? (byRegion[selected] || []).filter(x => !branchPick || String(x.req.branchNumber) === branchPick)
    : [];
  const selRegion = REGIONS.find(r => r.id === selected);
  const sortedRegions = [...REGIONS].sort((a, b) => byRegion[b.id].length - byRegion[a.id].length || a.ar.localeCompare(b.ar, 'ar'));

  return (
    <section className="rm-card">
      <div className="rm-head">
        <span className="rm-title">🗺️ Open Requests by Region / <span dir="rtl">الطلبات المفتوحة حسب المنطقة</span></span>
        <span className="rm-total">{totalOpen} open</span>
      </div>

      <div className="rm-map-wrap">
        <svg ref={svgRef} className="rm-svg" viewBox={vb.map(v => v.toFixed(2)).join(' ')} role="img" aria-label="Open requests per region of Saudi Arabia">
          {REGIONS.map((r, idx) => {
            const n = byRegion[r.id].length;
            const on = selected === r.id;
            return (
              <path key={r.id}
                ref={el => { pathRef.current[r.id] = el; }}
                d={r.d}
                className={`rm-region${on ? ' on' : ''}${selected && !on && selected !== 'unknown' ? ' dim' : ''}`}
                style={{ fill: fillFor(n, max), animationDelay: `${idx * 35}ms`, strokeWidth: (on ? 2.2 : 1) / zoom }}
                onClick={() => pick(r.id)}>
                <title>{`${r.ar} ${n}`}</title>
              </path>
            );
          })}

          {REGIONS.map(r => {
            const n = byRegion[r.id].length;
            const [dx, dy] = LABEL_NUDGE[r.id] || [0, 0];
            const x = r.cx + dx, y = r.cy + dy;
            const fs = (SMALL.has(r.id) ? 13 : 17) / zoom;
            const dark = isDark(n, max);
            const showName = !SMALL.has(r.id) || selected === r.id;
            // Zoomed in: the selected region's name/count moves to the corner tag
            // (it would sit on top of the branch points) and the rest are hidden.
            if (selected && selected !== 'unknown') return null;
            return (
              <g key={`${r.id}-${n}`} className="rm-label" onClick={() => pick(r.id)} style={{ cursor: 'pointer' }}>
                {SMALL.has(r.id) && selected !== r.id ? (
                  <>
                    <circle cx={x} cy={y} r={12 / zoom} className="rm-small-dot" style={{ fill: n ? '#563b2c' : '#94A3B8', strokeWidth: 1.5 / zoom }} />
                    <text x={x} y={y} dy=".35em" textAnchor="middle" className="rm-count rm-pop" style={{ fontSize: fs, fill: '#fff' }}>{n}</text>
                  </>
                ) : (
                  <text x={x} y={y} textAnchor="middle" className="rm-pop" direction="rtl"
                    style={{ fontSize: fs, fill: dark ? '#fff' : '#3b2a20' }}>
                    {showName && <tspan className={`rm-name${MID.has(r.id) ? ' rm-name-mid' : ''}`}>{r.ar} </tspan>}
                    <tspan className="rm-count">{n}</tspan>
                  </text>
                )}
              </g>
            );
          })}

          {points.map(p => {
            const angle = p.i * 2.39996;               // golden angle fan-out
            const rad = p.i ? 17 * Math.sqrt(p.i) : 0;
            const cx = p.x + Math.cos(angle) * rad / zoom;
            const cy = p.y + Math.sin(angle) * rad / zoom;
            const r = (8 + 2.5 * Math.sqrt(p.reqs.length)) / zoom;
            const on = branchPick === p.branch;
            return (
              <g key={p.branch} className={`rm-point${on ? ' on' : ''}`}
                onClick={(e) => { e.stopPropagation(); setBranch(b => (b === p.branch ? null : p.branch)); }}>
                <title>{`${branchLabel(p.branch, 'ar')} · ${p.reqs.length}`}</title>
                <circle cx={cx} cy={cy} r={r} style={{ strokeWidth: 2 / zoom }} />
                <text x={cx} y={cy} dy=".35em" textAnchor="middle" style={{ fontSize: 12 / zoom }}>{p.reqs.length}</text>
              </g>
            );
          })}
        </svg>

        {selected && selected !== 'unknown' && (
          <>
            <button className="rm-reset" onClick={() => pick(selected)}>✕ كل المناطق</button>
            <div className="rm-sel-tag rm-pop" key={`${selected}-${byRegion[selected].length}`} dir="rtl">
              {selRegion?.ar} <b>{byRegion[selected].length}</b>
            </div>
          </>
        )}
      </div>

      <div className="rm-legend">
        <span className="rm-legend-zero"><i style={{ background: ZERO_FILL }} />0</span>
        <span className="rm-legend-bar" />
        <span>{max}</span>
        <button className={`rm-unknown${selected === 'unknown' ? ' on' : ''}`} onClick={() => pick('unknown')}>
          غير محدد <b key={unknown.length} className="rm-pop">{unknown.length}</b>
        </button>
      </div>

      <div className="rm-chips" dir="rtl">
        {sortedRegions.map(r => {
          const n = byRegion[r.id].length;
          return (
            <button key={r.id} className={`rm-chip${selected === r.id ? ' on' : ''}${n ? '' : ' zero'}`} onClick={() => pick(r.id)}>
              <i style={{ background: fillFor(n, max) }} />{r.ar} <b key={n} className="rm-pop">{n}</b>
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="rm-list">
          <div className="rm-list-title">
            <span>
              <bdi>{selected === 'unknown' ? 'غير محدد' : selRegion?.ar}</bdi>
              {branchPick && <> · {branchLabel(branchPick)}</>}
              {' '}— {listItems.length} open {listItems.length === 1 ? 'request' : 'requests'}
            </span>
            {branchPick && <button className="rm-link" onClick={() => setBranch(null)}>Show all branches</button>}
          </div>
          {listItems.length === 0 ? (
            <div className="rm-empty">No open requests here 🎉</div>
          ) : (
            <table className="rm-table">
              <thead><tr><th>Request</th><th>Branch</th><th>Area</th><th>Status</th><th /></tr></thead>
              <tbody>
                {listItems.map(({ req, loc }) => (
                  <tr key={req.id}>
                    <td className="rm-id">{req.id}</td>
                    <td>{branchLabel(req.branchNumber) || '—'}</td>
                    <td dir="rtl">{loc ? (AREA_AR[loc.area] || loc.area) : '—'}</td>
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
}
