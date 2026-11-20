import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { branchLabel, getBranchInfo } from '../branchData';
import { AREA_AR } from '../branchDataAr';
import { BRANCH_GEO } from '../branchGeo';
import { AREA_REGION } from '../regionData';
import { getActiveTrips, hasLocation, subscribeTrips } from '../trips';

/* ── Data: active trips, kept live ─────────────────────────────────── */

// Active trips, refreshed by Realtime: a position update is patched in place
// (so the marker moves without a reload); a new / ended trip reloads the list.
// A slow poll covers a dropped Realtime connection.
export function useActiveTrips() {
  const [trips, setTrips] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const reload = useCallback(() => getActiveTrips().then(t => { setTrips(t); setLoaded(true); }), []);

  useEffect(() => {
    reload();
    const unsub = subscribeTrips(({ eventType, new: row }) => {
      if (eventType === 'UPDATE' && row?.status === 'en_route') {
        setTrips(ts => {
          if (!ts.some(t => t.id === row.id)) { reload(); return ts; }
          return ts.map(t => (t.id === row.id ? {
            ...t, lat: row.lat, lng: row.lng, accuracy: row.accuracy, heading: row.heading,
            speed: row.speed, locationAt: row.location_at,
          } : t));
        });
      } else {
        reload();
      }
    });
    const poll = setInterval(reload, 30000);
    return () => { unsub(); clearInterval(poll); };
  }, [reload]);

  return { trips, loaded, reload };
}

/* ── Helpers ───────────────────────────────────────────────────────── */

// Where the branch is: its saved pin, else its city centre.
export function branchPoint(num) {
  const geo = BRANCH_GEO[String(num)];
  if (geo) return { lat: geo[1], lng: geo[0], exact: true };
  const area = getBranchInfo(num)?.area;
  const c = area && AREA_REGION[area];
  return c ? { lat: c[2], lng: c[1], exact: false } : null;
}

const areaAr = (num) => { const a = getBranchInfo(num)?.area; return a ? (AREA_AR[a] || a) : ''; };

function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lng - a.lng) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function ago(iso, now = Date.now()) {
  if (!iso) return '';
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `منذ ${s} ث`;
  const m = Math.round(s / 60);
  if (m < 60) return `منذ ${m} د`;
  return `منذ ${Math.round(m / 60)} س`;
}
const clock = (iso) => new Date(iso).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit', numberingSystem: 'latn' });
const STALE_S = 120;   // older than this, the position is shown as possibly out of date

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/* ── Home screen box: «متوجه للفرع» ───────────────────────────────── */

export function OnTheWayCard({ trips, onOpen }) {
  const now = useNow(15000);
  const n = trips.length;
  return (
    <button className={`otw-card${n ? ' live' : ''}`} dir="rtl" onClick={onOpen}>
      <div className="otw-head">
        <span className="otw-title">🚗 متوجه للفرع</span>
        {n > 0 && <span className="otw-live"><i />مباشر</span>}
      </div>
      <div className="otw-count"><b>{n}</b>{n === 1 ? 'فني في الطريق' : 'فنيين في الطريق'}</div>
      {n === 0 ? (
        <div className="otw-empty">لا يوجد فني متوجه حالياً</div>
      ) : (
        <ul className="otw-list">
          {trips.slice(0, 3).map(t => (
            <li key={t.id}>
              <b>{t.technicianName}</b> ← {branchLabel(t.request.branchNumber, 'ar')}
              <span>{hasLocation(t) ? ago(t.locationAt, now) : 'بانتظار الموقع'}</span>
            </li>
          ))}
          {n > 3 && <li className="otw-more">+ {n - 3} آخرين</li>}
        </ul>
      )}
      <div className="otw-cta">فتح التتبّع المباشر ←</div>
    </button>
  );
}

/* ── Live map (OpenStreetMap tiles, no map library) ───────────────── */

const TILE = 256;
const worldPx = (lat, lng, z) => {
  const s = TILE * 2 ** z, r = (lat * Math.PI) / 180;
  return [((lng + 180) / 360) * s, ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * s];
};

// Highest zoom (≤ maxZ) at which all points fit inside the box with padding.
function fitView(points, w, h, maxZ = 16) {
  if (!points.length || !w) return null;
  if (points.length === 1) { const [x, y] = worldPx(points[0].lat, points[0].lng, 14); return { z: 14, cx: x, cy: y }; }
  for (let z = maxZ; z >= 4; z--) {
    const ps = points.map(p => worldPx(p.lat, p.lng, z));
    const xs = ps.map(p => p[0]), ys = ps.map(p => p[1]);
    if (Math.max(...xs) - Math.min(...xs) <= w - 140 && Math.max(...ys) - Math.min(...ys) <= h - 160) {
      return { z, cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2 };
    }
  }
  const [x, y] = worldPx(points[0].lat, points[0].lng, 4);
  return { z: 4, cx: x, cy: y };
}

// Herfy's logo for the destination marker. Put the file at public/herfy-brand.png;
// until it exists the marker shows «هرفي» as text instead.
// (public/herfy-logo.png is the ALTASES mark despite its name.)
const HERFY_LOGO = '/herfy-brand.png';

function LiveMap({ tech, techName, dest, branchNum, fitKey }) {
  const boxRef = useRef(null);
  const [logoOk, setLogoOk] = useState(true);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState(null);
  const [follow, setFollow] = useState(true);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => [dest, tech].filter(Boolean), [dest, tech]);

  // Fit on a new trip / resize; afterwards only re-fit (while following) when
  // the technician gets near the edge, so the marker glides instead of jumping.
  useEffect(() => { setFollow(true); setView(fitView(points, size.w, size.h)); }, [fitKey, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps
  const hadTech = useRef(!!tech);
  useEffect(() => {
    if (!view || !follow) return;
    if (tech && !hadTech.current) { hadTech.current = true; setView(fitView(points, size.w, size.h)); return; }
    hadTech.current = !!tech;
    if (!tech) return;
    const [x, y] = worldPx(tech.lat, tech.lng, view.z);
    const sx = x - view.cx + size.w / 2, sy = y - view.cy + size.h / 2;
    const m = 70;
    if (sx < m || sy < m || sx > size.w - m || sy > size.h - m) setView(fitView(points, size.w, size.h));
  }, [tech?.lat, tech?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomBy = (d) => setView(v => {
    if (!v) return v;
    const z = Math.min(18, Math.max(4, v.z + d)), k = 2 ** (z - v.z);
    return { z, cx: v.cx * k, cy: v.cy * k };
  });

  const tiles = [];
  if (view && size.w) {
    const n = 2 ** view.z;
    const x0 = Math.floor((view.cx - size.w / 2) / TILE), x1 = Math.floor((view.cx + size.w / 2) / TILE);
    const y0 = Math.max(0, Math.floor((view.cy - size.h / 2) / TILE)), y1 = Math.min(n - 1, Math.floor((view.cy + size.h / 2) / TILE));
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const wx = ((x % n) + n) % n;
      tiles.push({ key: `${view.z}/${x}/${y}`, src: `https://tile.openstreetmap.org/${view.z}/${wx}/${y}.png`,
        left: x * TILE - view.cx + size.w / 2, top: y * TILE - view.cy + size.h / 2 });
    }
  }
  const at = (p) => { const [x, y] = worldPx(p.lat, p.lng, view.z); return [x - view.cx + size.w / 2, y - view.cy + size.h / 2]; };

  return (
    <div className="lt-map" ref={boxRef}>
      <div className="lt-tiles">
        {tiles.map(t => <img key={t.key} src={t.src} alt="" draggable="false" style={{ left: t.left, top: t.top }} />)}
      </div>
      {view && dest && (() => { const [x, y] = at(dest); return (
        <div className="lt-dest" style={{ transform: `translate(${x}px, ${y}px)` }}>
          <div className="lt-dest-num">{branchNum}</div>
          <div className="lt-dest-logo">
            {logoOk ? <img src={HERFY_LOGO} alt="هرفي" onError={() => setLogoOk(false)} /> : <span className="lt-dest-text">هرفي</span>}
          </div>
          <div className="lt-dest-tip" />
        </div>
      ); })()}
      {view && tech && (() => { const [x, y] = at(tech); return (
        <div className="lt-tech" style={{ transform: `translate(${x}px, ${y}px)` }}>
          <div className="lt-tech-pulse" />
          <div className="lt-tech-dot">🚗</div>
          <div className="lt-tech-name">{techName}</div>
        </div>
      ); })()}
      <div className="lt-zoom">
        <button onClick={() => { setFollow(false); zoomBy(1); }} aria-label="تكبير">＋</button>
        <button onClick={() => { setFollow(false); zoomBy(-1); }} aria-label="تصغير">－</button>
        <button onClick={() => { setFollow(true); setView(fitView(points, size.w, size.h)); }} aria-label="إظهار الفني والفرع" title="إظهار الفني والفرع">⤢</button>
      </div>
      <a className="lt-attrib" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>
    </div>
  );
}

/* ── Live tracking page ────────────────────────────────────────────── */

export function LiveTrackingPage({ onOpenRequest }) {
  const { trips, loaded } = useActiveTrips();
  return <TrackingView trips={trips} loaded={loaded} onOpenRequest={onOpenRequest} />;
}

export function TrackingView({ trips, loaded, onOpenRequest }) {
  const [pick, setPick] = useState(null);
  const now = useNow(1000);

  const trip = trips.find(t => t.id === pick) || trips[0] || null;
  const dest = trip ? branchPoint(trip.request.branchNumber) : null;
  const tech = trip && hasLocation(trip) ? { lat: trip.lat, lng: trip.lng } : null;
  const ageS = trip?.locationAt ? (now - new Date(trip.locationAt).getTime()) / 1000 : null;

  if (!loaded) return <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">جاري التحميل…</div></div>;

  if (!trips.length) return (
    <div className="empty-state" dir="rtl">
      <div className="empty-icon">🚗</div>
      <div className="empty-title">لا يوجد فني متوجه للفرع حالياً</div>
      <div className="empty-sub">لما يضغط الفني «تم قبول الطلب» يظهر هنا مباشرة.</div>
    </div>
  );

  return (
    <div className="lt-page" dir="rtl">
      {trips.length > 1 && (
        <aside className="lt-list">
          <div className="lt-list-title">اختر الطلب ({trips.length})</div>
          {trips.map(t => (
            <button key={t.id} className={`lt-item${t.id === trip.id ? ' on' : ''}`} onClick={() => setPick(t.id)}>
              <b>{t.technicianName}</b>
              <span>← {branchLabel(t.request.branchNumber, 'ar')} · {areaAr(t.request.branchNumber)}</span>
              <small>{hasLocation(t) ? `آخر موقع ${ago(t.locationAt, now)}` : 'بانتظار موقع الفني'}</small>
            </button>
          ))}
        </aside>
      )}

      <section className="lt-main">
        <div className="lt-info">
          <div>
            <div className="lt-tech-title">👷 {trip.technicianName}</div>
            <div className="lt-sub">
              متوجه إلى <b>{branchLabel(trip.request.branchNumber, 'ar')}</b>
              {areaAr(trip.request.branchNumber) && <> · {areaAr(trip.request.branchNumber)}</>}
              {' '}· قبل الطلب {ago(trip.acceptedAt, now)}
            </div>
          </div>
          <div className="lt-facts">
            <div>
              <span>آخر تحديث للموقع</span>
              {trip.locationAt
                ? <b className={ageS > STALE_S ? 'stale' : ''}>{clock(trip.locationAt)} <small>({ago(trip.locationAt, now)})</small></b>
                : <b className="stale">—</b>}
            </div>
            {tech && dest && <div><span>المسافة المباشرة</span><b>{km(tech, dest).toFixed(1)} كم</b></div>}
            <button className="lt-open" onClick={() => onOpenRequest?.(trip.request.id)}>فتح الطلب {trip.request.id}</button>
          </div>
        </div>

        <div className="lt-map-wrap">
          <LiveMap tech={tech} techName={trip.technicianName} dest={dest} branchNum={trip.request.branchNumber} fitKey={trip.id} />
          {!tech && <div className="lt-waiting">📡 بانتظار موقع الفني</div>}
          {tech && ageS > STALE_S && <div className="lt-waiting warn">⚠️ لم يصل موقع جديد {ago(trip.locationAt, now)} — قد يكون الجوال مقفل أو بدون إنترنت</div>}
          {!dest && <div className="lt-waiting warn">موقع الفرع غير محدد</div>}
        </div>
      </section>
    </div>
  );
}
