import { useEffect, useRef, useState } from 'react';
import { branchLabel } from '../branchData';
import { updateTripLocation } from '../trips';

// Send a new position when the technician has moved this far, or this long
// has passed since the last one (and never more often than MIN_GAP).
const MOVE_M = 15, MAX_GAP = 10_000, MIN_GAP = 3_000;

function metresBetween(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r, dLon = (b.longitude - a.longitude) * r;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/*
 * While `trip` is en_route, follow the phone's position and write it to the
 * trip row. The browser asks the technician for permission the first time.
 * Also keeps the screen awake (where supported), because browsers stop
 * reporting the position once the screen locks or the page is in the background.
 *
 * state: 'idle' | 'asking' | 'sharing' | 'denied' | 'unavailable' | 'unsupported'
 */
export function useLocationBroadcast(trip) {
  const [state, setState] = useState('idle');
  const [lastSent, setLastSent] = useState(null);
  const lastRef = useRef(null);
  const tripId = trip?.status === 'en_route' ? trip.id : null;

  useEffect(() => {
    if (!tripId) { setState('idle'); return; }
    if (!('geolocation' in navigator)) { setState('unsupported'); return; }
    setState('asking');
    lastRef.current = null;
    let stopped = false;

    const onPos = (pos) => {
      if (stopped) return;
      setState('sharing');
      const now = Date.now(), last = lastRef.current;
      const due = !last
        || (now - last.at >= MIN_GAP && (metresBetween(last.coords, pos.coords) >= MOVE_M || now - last.at >= MAX_GAP));
      if (!due) return;
      lastRef.current = { at: now, coords: pos.coords };
      updateTripLocation(tripId, pos.coords).then(ok => { if (ok && !stopped) setLastSent(new Date()); });
    };
    const onErr = (err) => {
      if (stopped) return;
      setState(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
    };
    const watch = navigator.geolocation.watchPosition(onPos, onErr, { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 });

    // Keep the screen on while driving to the branch (re-acquired when the page returns).
    let lock = null;
    const keepAwake = async () => {
      try { if ('wakeLock' in navigator && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch {}
    };
    const onVisible = () => { if (document.visibilityState === 'visible') keepAwake(); };
    keepAwake();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watch);
      document.removeEventListener('visibilitychange', onVisible);
      try { lock?.release(); } catch {}
    };
  }, [tripId]);

  return { state, lastSent };
}

const STATE_TEXT = {
  idle:        '',
  asking:      '⏳ بانتظار السماح بمشاركة الموقع…',
  sharing:     '🟢 يتم مشاركة موقعك الآن',
  denied:      '⚠️ مشاركة الموقع مرفوضة — اسمح بالموقع للمتصفح من إعدادات الجوال',
  unavailable: '⚠️ تعذّر تحديد موقعك — تأكد أن خدمة الموقع شغّالة',
  unsupported: '⚠️ هذا المتصفح لا يدعم مشاركة الموقع',
};

// Shown at the top of the technician's screens while he is on the way.
export function TripBanner({ trip, broadcast, onArrived, onCancel, busy }) {
  if (!trip) return null;
  const branch = trip.request ? branchLabel(trip.request.branchNumber, 'ar') : '';
  const bad = broadcast.state === 'denied' || broadcast.state === 'unavailable' || broadcast.state === 'unsupported';
  return (
    <div className="trip-banner" role="status">
      <div className="trip-banner-title">🚗 متوجه إلى {branch}</div>
      <div className={`trip-banner-state${bad ? ' bad' : ''}`}>
        {STATE_TEXT[broadcast.state]}
        {broadcast.state === 'sharing' && broadcast.lastSent && (
          <span> · آخر إرسال {broadcast.lastSent.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit', numberingSystem: 'latn' })}</span>
        )}
      </div>
      <div className="trip-banner-hint">خلّ هذه الصفحة مفتوحة والشاشة شغّالة لين توصل.</div>
      <div className="trip-banner-actions">
        <button className="btn btn-primary-green" onClick={onArrived} disabled={busy}>📍 تم الوصول</button>
        <button className="btn btn-outline" onClick={onCancel} disabled={busy} style={{ flex: '0 0 auto', width: 'auto' }}>إلغاء</button>
      </div>
    </div>
  );
}
