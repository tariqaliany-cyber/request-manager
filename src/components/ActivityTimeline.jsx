import { useState, useEffect } from 'react';
import { getActivityLog, ACTION_LABELS_MAP, formatDate } from '../storage';

/* Per-request activity feed — status changes, assignment changes, photo
 * uploads, Delivery Note events, and Majed's comments, merged into one
 * human-readable list (not raw DB logs). */
export default function ActivityTimeline({ requestId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getActivityLog(requestId).then(data => { if (!cancelled) { setEntries(data); setLoading(false); } });
    return () => { cancelled = true; };
  }, [requestId]);

  if (loading) return <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Loading…</div>;
  if (entries.length === 0) return <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>No activity yet / لا يوجد نشاط بعد</div>;

  return (
    <div>
      {entries.map(e => {
        const label = ACTION_LABELS_MAP[e.action] || { en: e.action, ar: '' };
        return (
          <div key={e.id} className="comment-item">
            <div className="comment-text">
              {label.en}
              {e.actor && <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}> — {e.actor}</span>}
            </div>
            {e.detail && <div style={{ fontSize: 12, color: 'var(--gray-600)', marginTop: 2 }}>{e.detail}</div>}
            <div className="comment-time">{formatDate(e.created_at)}</div>
          </div>
        );
      })}
    </div>
  );
}
