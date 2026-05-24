import { useState, useEffect } from 'react';
import AladheedView from './AladheedView';
import { getRequests, updateRequest, deleteRequest, getNotifications, getLastRead, setLastRead, ACTION_LABELS_MAP, STATUS, formatDate } from '../storage';
import { generateServiceReport } from '../generateReport';
import { BRANCHES } from '../branchData';
import PhotoLightbox from '../components/PhotoLightbox';

function getBranchInfo(num) {
  return BRANCHES.find(b => b.num === String(num)) || null;
}

function formatSAR(amount) {
  const n = Number(amount);
  if (isNaN(n)) return null;
  return 'SAR ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Sidebar (desktop only via CSS) ────────────── */
const SIDEBAR_FILTERS = [
  { key: 'unassigned',  icon: '⚠️', label: 'Unassigned',  labelAr: 'غير مسندة' },
  { key: 'scheduled',   icon: '📅', label: 'Scheduled',   labelAr: 'مجدولة'    },
  { key: 'in_progress', icon: '🔧', label: 'In Progress', labelAr: 'قيد التنفيذ'},
  { key: 'completed',   icon: '✅', label: 'Completed',   labelAr: 'مكتملة'    },
];

function TariqSidebar({ user, onLogout, activeFilter, onFilter, onAladheed, unreadCount }) {
  return (
    <aside className="tariq-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <img
          src="/herfy-logo.png" alt="Herfy"
          style={{ height: 34, width: 'auto', display: 'block', marginBottom: 12,
                   filter: 'brightness(0) invert(1)', opacity: 0.85 }}
        />
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-.2px' }}>
          مدير الصيانة
        </div>
        <div style={{ color: 'rgba(255,255,255,.38)', fontSize: 11, marginTop: 2 }}>
          لوحة التحكم الإدارية
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        <div className="sidebar-section-label">القائمة الرئيسية</div>

        <button
          className={`sidebar-item ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => onFilter('all')}>
          <span className="sidebar-item-icon">🏠</span>
          الرئيسية / Dashboard
        </button>

        <button
          className={`sidebar-item ${activeFilter === 'updates' ? 'active' : ''}`}
          onClick={() => onFilter('updates')}>
          <span className="sidebar-item-icon">🔔</span>
          التحديثات / Updates
          {unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
        </button>

        <div className="sidebar-section-label">الأعطال</div>

        {SIDEBAR_FILTERS.map(f => (
          <button
            key={f.key}
            className={`sidebar-item ${activeFilter === f.key ? 'active' : ''}`}
            onClick={() => onFilter(f.key)}>
            <span className="sidebar-item-icon">{f.icon}</span>
            {f.label}
            <span style={{ fontSize: 11, color: 'inherit', opacity: .6, marginLeft: 2 }}>
              / {f.labelAr}
            </span>
          </button>
        ))}

        <div className="sidebar-section-label">أدوات</div>

        <button className="sidebar-item" onClick={onAladheed}>
          <span className="sidebar-item-icon">🦅</span>
          العضيد / Aladheed
        </button>
      </nav>

      {/* User */}
      <div className="sidebar-user-section">
        <div className="sidebar-avatar">{user.name[0]}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </div>
          <div style={{ color: 'rgba(255,255,255,.38)', fontSize: 11 }}>المسؤول الإداري</div>
        </div>
        <button
          onClick={onLogout}
          style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.5)',
                   borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
          خروج
        </button>
      </div>
    </aside>
  );
}

/* ── Main Export ────────────────────────────────── */
export default function TariqView({ user, onLogout }) {
  const [selected, setSelected]         = useState(null);
  const [tick, setTick]                 = useState(0);
  const [aladheedMode, setAladheedMode] = useState(false);
  const [aladheedJob, setAladheedJob]   = useState(null);
  const [filter, setFilter]             = useState('all');
  const [unreadCount, setUnreadCount]   = useState(0);
  const refresh = () => setTick(n => n + 1);

  const openAladheed  = (job = null) => { setAladheedJob(job); setAladheedMode(true); };
  const closeAladheed = ()           => { setAladheedJob(null); setAladheedMode(false); };

  // Aladheed is full-screen — no sidebar
  if (aladheedMode) {
    return <AladheedView job={aladheedJob} onClose={closeAladheed} />;
  }

  const handleFilter = (f) => {
    setFilter(f);
    setSelected(null);
  };

  // Topbar title based on current view
  const topbarTitle = selected
    ? `Herfy ${selected.branchNumber} · ${selected.id}`
    : filter === 'all'        ? '🏠 Dashboard / الرئيسية'
    : filter === 'updates'    ? '🔔 Updates / التحديثات'
    : filter === 'unassigned' ? '⚠️ Unassigned / غير مسندة'
    : filter === 'scheduled'  ? '📅 Scheduled / مجدولة'
    : filter === 'in_progress'? '🔧 In Progress / قيد التنفيذ'
    : filter === 'completed'  ? '✅ Completed / مكتملة'
    : 'Dashboard';

  return (
    <div className="tariq-layout">
      {/* ── Sidebar (desktop only via CSS) ── */}
      <TariqSidebar
        user={user}
        onLogout={onLogout}
        activeFilter={selected ? '' : filter}
        onFilter={handleFilter}
        onAladheed={() => openAladheed(null)}
        unreadCount={unreadCount}
      />

      {/* ── Main content area ── */}
      <div className="tariq-main">

        {/* Mobile header (hidden on desktop via CSS) */}
        <header className="header header-tariq tariq-mobile-header">
          {selected ? (
            <>
              <button className="back-btn" onClick={() => { setSelected(null); refresh(); }} style={{ color: '#1E293B' }}>
                ← All Requests
              </button>
              <div className="header-right">
                <button className="btn-outline" onClick={() => openAladheed(null)} style={{ fontSize: 13, fontWeight: 700 }}>
                  🦅 Aladheed
                </button>
                <button className="btn-logout" onClick={onLogout}>Logout</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/herfy-logo.png" alt="Herfy" style={{ height: 36, width: 'auto', display: 'block' }} />
                <div>
                  <div className="header-title">Admin / لوحة التحكم</div>
                  <div className="header-sub">Welcome, {user.nameAr} · {user.name}</div>
                </div>
              </div>
              <div className="header-right">
                <button className="btn-outline" onClick={() => openAladheed(null)} style={{ fontSize: 13, fontWeight: 700 }}>
                  🦅 Aladheed
                </button>
                <button className="btn-logout" onClick={onLogout}>Logout</button>
              </div>
            </>
          )}
        </header>

        {/* Desktop topbar (hidden on mobile via CSS) */}
        <header className="tariq-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {selected && (
              <button
                onClick={() => { setSelected(null); refresh(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                         fontWeight: 700, color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: 5,
                         padding: '6px 10px', borderRadius: 7, marginRight: 4 }}>
                ← Dashboard
              </button>
            )}
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)' }}>{topbarTitle}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
              {user.nameAr} · {user.name}
            </span>
            <button
              className="btn-outline btn-sm"
              onClick={() => openAladheed(null)}
              style={{ fontSize: 12, fontWeight: 700 }}>
              🦅 Aladheed
            </button>
            <button className="btn-logout" onClick={onLogout}>Logout</button>
          </div>
        </header>

        {/* Page content */}
        <div className="page">
          {selected ? (
            <TariqDetail
              req={selected}
              onClose={() => { setSelected(null); refresh(); }}
              onOpenAladheed={openAladheed}
            />
          ) : (
            <TariqDashboard
              onSelect={setSelected}
              tick={tick}
              filter={filter}
              onFilter={setFilter}
              onUnreadCount={setUnreadCount}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Dashboard ──────────────────────────────────── */
function TariqDashboard({ onSelect, tick, filter, onFilter, onUnreadCount }) {
  const [all, setAll]         = useState([]);
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getRequests(), getNotifications()]).then(([reqs, nfs]) => {
      setAll(reqs);
      setNotifs(nfs);
      setLoading(false);
    });
  }, [tick]);

  const lastRead = getLastRead();
  const unreadCount = notifs.filter(n => !lastRead || n.created_at > lastRead).length;

  useEffect(() => { onUnreadCount(unreadCount); }, [unreadCount]);

  const openNotifications = () => {
    setLastRead();
    onFilter('updates');
  };

  const counts = {
    all:         all.length,
    unassigned:  all.filter(r => !r.assignedTo && r.status !== 'completed').length,
    in_progress: all.filter(r => r.status === 'in_progress').length,
    scheduled:   all.filter(r => r.status === 'scheduled').length,
    completed:   all.filter(r => r.status === 'completed').length,
  };

  const filtered = all.filter(r => {
    if (filter === 'all')        return true;
    if (filter === 'unassigned') return !r.assignedTo && r.status !== 'completed';
    if (filter === 'updates')    return false;
    return r.status === filter;
  });

  const FILTERS = [
    { key: 'all',         label: 'All',         color: 'var(--tariq-color)' },
    { key: 'unassigned',  label: 'Unassigned',  color: '#EF4444' },
    { key: 'scheduled',   label: 'Scheduled',   color: '#D97706' },
    { key: 'in_progress', label: 'In Progress', color: '#563b2c' },
    { key: 'completed',   label: 'Completed',   color: '#16A34A' },
  ];

  const reqMap = Object.fromEntries(all.map(r => [r.id, r]));

  // Active (in-progress + unassigned) for the panel
  const activeReqs = all.filter(r => r.status === 'in_progress' || (!r.assignedTo && r.status !== 'completed')).slice(0, 5);
  // Recent notifs for panel
  const recentNotifs = notifs.slice(0, 4);

  if (loading) return (
    <div className="empty-state">
      <div className="empty-icon">⏳</div>
      <div className="empty-title">Loading...</div>
    </div>
  );

  return (
    <div>
      {/* ═══════════════════════════════════════════
          MOBILE LAYOUT
      ═══════════════════════════════════════════ */}
      <div className="tariq-mobile-only">
        <div className="stats-bar mt16">
          <div className="stat-card">
            <div className="stat-num" style={{ color: 'var(--tariq-color)' }}>{counts.all}</div>
            <div className="stat-lbl">Total</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#EF4444' }}>{counts.unassigned}</div>
            <div className="stat-lbl">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#563b2c' }}>{counts.in_progress}</div>
            <div className="stat-lbl">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#16A34A' }}>{counts.completed}</div>
            <div className="stat-lbl">Done</div>
          </div>
        </div>

        {/* Notifications button */}
        <button
          onClick={filter === 'updates' ? () => onFilter('all') : openNotifications}
          style={{
            width: '100%', marginTop: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderRadius: 10, border: '1.5px solid',
            borderColor: filter === 'updates' ? '#7C3AED' : (unreadCount > 0 ? '#7C3AED' : '#e2e8f0'),
            background: filter === 'updates' ? '#F5F3FF' : (unreadCount > 0 ? '#faf5ff' : '#f8fafc'),
            cursor: 'pointer', transition: 'all .15s',
          }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: filter === 'updates' ? '#7C3AED' : '#334155' }}>
            🔔 Updates / التحديثات
            {unreadCount > 0 && filter !== 'updates' && (
              <span style={{ background: '#7C3AED', color: '#fff', borderRadius: 20, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                {unreadCount} new
              </span>
            )}
          </span>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
            {filter === 'updates' ? '✕ Close' : `${notifs.length} total ›`}
          </span>
        </button>

        {filter === 'updates' ? (
          <NotificationsPanel notifs={notifs} lastRead={lastRead} reqMap={reqMap} onSelect={onSelect} />
        ) : (
          <>
            <div className="filter-bar">
              {FILTERS.map(f => (
                <button key={f.key}
                  className={`chip ${filter === f.key ? 'active' : ''}`}
                  style={filter === f.key ? { color: f.color, borderColor: f.color, background: f.color + '15' } : {}}
                  onClick={() => onFilter(f.key)}>
                  {f.label}{counts[f.key] > 0 && <span style={{ opacity: .7 }}> ({counts[f.key]})</span>}
                </button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <div className="empty-title">No requests here</div>
              </div>
            ) : (
              <div className="req-grid">
                {filtered.map(req => {
                  const s = STATUS[req.status];
                  return (
                    <div key={req.id} className="card card-clickable" onClick={() => onSelect(req)}>
                      <div className="card-header">
                        <div>
                          <div className="card-id">{req.id}</div>
                          <div className="card-branch">Herfy {req.branchNumber}</div>
                          {(() => { const info = getBranchInfo(req.branchNumber); return <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>📍 {info ? info.area : 'Location: Not specified'}</div>; })()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                          <span className="badge" style={{ color: s.color, background: s.bg }}>
                            <span className="badge-dot" />{s.en}
                          </span>
                          <span style={{
                            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                            color: req.invoiceAmount != null ? '#166534' : '#94A3B8',
                            background: req.invoiceAmount != null ? '#F0FDF4' : '#F8FAFC',
                            border: '1px solid ' + (req.invoiceAmount != null ? '#BBF7D0' : '#E2E8F0'),
                            padding: '2px 8px', borderRadius: 20,
                          }}>
                            {req.invoiceAmount != null ? formatSAR(req.invoiceAmount) : 'No invoice'}
                          </span>
                        </div>
                      </div>
                      <div className="card-desc">{req.problemDescription}</div>
                      <div className="card-footer">
                        <span className="card-date">{formatDate(req.createdAt)}</span>
                        {req.assignedTo
                          ? <span className="assigned-tag">👷 Assigned to Workshop</span>
                          : req.status !== 'completed'
                            ? <span className="unassigned-tag">○ Unassigned</span>
                            : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          DESKTOP LAYOUT (hidden on mobile via CSS)
      ═══════════════════════════════════════════ */}

      {/* KPI row */}
      <div className="tariq-desktop-panel">
        <div className="dash-kpi-row">
          {[
            { num: counts.all,         label: 'Total',       labelAr: 'الإجمالي',     color: 'var(--tariq-color)', border: 'var(--tariq-color)' },
            { num: counts.unassigned,  label: 'Pending',     labelAr: 'غير مسندة',    color: '#EF4444',            border: '#EF4444' },
            { num: counts.in_progress, label: 'In Progress', labelAr: 'قيد التنفيذ',  color: '#563b2c',            border: '#563b2c' },
            { num: counts.scheduled,   label: 'Scheduled',   labelAr: 'مجدولة',       color: '#D97706',            border: '#D97706' },
            { num: counts.completed,   label: 'Completed',   labelAr: 'مكتملة',       color: '#16A34A',            border: '#16A34A' },
          ].map(k => (
            <div key={k.label} className="dash-kpi-card" style={{ borderTopColor: k.border }}>
              <div className="dash-kpi-num" style={{ color: k.color }}>{k.num}</div>
              <div className="dash-kpi-label">{k.label}</div>
              <div style={{ fontSize: 11, color: 'rgba(0,0,0,.3)', marginTop: 2 }}>{k.labelAr}</div>
            </div>
          ))}
        </div>

        {/* Two panels: active requests + recent notifications */}
        {filter !== 'updates' && (
          <div className="dash-panels">
            {/* Active requests panel */}
            <div className="dash-panel">
              <div className="dash-panel-title">
                <span>🔧 Active Requests / الأعطال النشطة</span>
                <span style={{ fontSize: 11, color: 'var(--gray-400)', fontWeight: 400 }}>
                  {activeReqs.length} showing
                </span>
              </div>
              {activeReqs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--gray-400)', padding: '20px 0', textAlign: 'center' }}>
                  No active requests 🎉
                </div>
              ) : activeReqs.map(req => {
                const s = STATUS[req.status];
                const info = getBranchInfo(req.branchNumber);
                return (
                  <div key={req.id}
                    onClick={() => onSelect(req)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 0', borderBottom: '1px solid var(--gray-100)',
                      cursor: 'pointer', gap: 12,
                    }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-800)' }}>
                        Herfy {req.branchNumber}
                        {info && <span style={{ fontWeight: 400, color: 'var(--gray-400)' }}> · {info.area}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(req.problemDescription || '').substring(0, 55)}
                      </div>
                    </div>
                    <span className="badge" style={{ color: s.color, background: s.bg, flexShrink: 0, fontSize: 11 }}>
                      <span className="badge-dot" />{s.en}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Notifications panel */}
            <div className="dash-panel">
              <div className="dash-panel-title">
                <span>
                  🔔 Workshop Updates / تحديثات الورشة
                  {unreadCount > 0 && (
                    <span style={{ marginLeft: 8, background: '#7C3AED', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>
                      {unreadCount} new
                    </span>
                  )}
                </span>
                <button
                  onClick={openNotifications}
                  style={{ fontSize: 11, color: '#7C3AED', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, fontFamily: 'inherit' }}>
                  View all ›
                </button>
              </div>
              {recentNotifs.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--gray-400)', padding: '20px 0', textAlign: 'center' }}>
                  No updates yet
                </div>
              ) : recentNotifs.map((n, i) => {
                const isUnread = !lastRead || n.created_at > lastRead;
                const label = ACTION_LABELS_MAP[n.action] || { en: n.action };
                return (
                  <div key={n.id || i} style={{
                    padding: '9px 0', borderBottom: '1px solid var(--gray-100)',
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                  }}>
                    {isUnread && (
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#7C3AED', flexShrink: 0, marginTop: 4 }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>
                        {n.req_id} · Herfy {n.branch_number}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gray-600)', marginTop: 1 }}>{label.en}</div>
                      {n.detail && (
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2, fontStyle: 'italic' }}>
                          "{n.detail.substring(0, 60)}"
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--gray-400)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {formatDate(n.created_at).split(',')[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Notifications full view (when filter=updates on desktop) */}
        {filter === 'updates' && (
          <div className="dash-panel" style={{ marginBottom: 20 }}>
            <div className="dash-panel-title">
              🔔 All Workshop Updates / جميع التحديثات
            </div>
            <NotificationsPanel notifs={notifs} lastRead={lastRead} reqMap={reqMap} onSelect={onSelect} />
          </div>
        )}

        {/* Filter chips */}
        {filter !== 'updates' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)' }}>
              {filter === 'all' ? `All Requests — ${counts.all}` : `${FILTERS.find(f => f.key === filter)?.label} — ${filtered.length}`}
            </div>
            <div className="filter-bar" style={{ marginBottom: 0 }}>
              {FILTERS.map(f => (
                <button key={f.key}
                  className={`chip ${filter === f.key ? 'active' : ''}`}
                  style={filter === f.key ? { color: f.color, borderColor: f.color, background: f.color + '15' } : {}}
                  onClick={() => onFilter(f.key)}>
                  {f.label}{counts[f.key] > 0 && <span style={{ opacity: .7 }}> ({counts[f.key]})</span>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Request table */}
        {filter !== 'updates' && (
          <div className="req-table-wrap">
            {filtered.length === 0 ? (
              <div className="empty-state" style={{ padding: '48px 20px' }}>
                <div className="empty-icon">📭</div>
                <div className="empty-title">No requests here</div>
              </div>
            ) : (
              <table className="req-table">
                <thead>
                  <tr>
                    <th>Request #</th>
                    <th>Branch</th>
                    <th>Location</th>
                    <th>Problem</th>
                    <th>Status</th>
                    <th>Invoice</th>
                    <th>Assigned</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(req => {
                    const s    = STATUS[req.status];
                    const info = getBranchInfo(req.branchNumber);
                    return (
                      <tr key={req.id} onClick={() => onSelect(req)}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--gray-400)', letterSpacing: .5 }}>{req.id}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>Herfy {req.branchNumber}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>
                            📍 {info ? info.area : '—'}
                          </div>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--gray-600)' }}>
                            {req.problemDescription || '—'}
                          </div>
                        </td>
                        <td>
                          <span className="badge" style={{ color: s.color, background: s.bg, fontSize: 11 }}>
                            <span className="badge-dot" />{s.en}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
                            color: req.invoiceAmount != null ? '#166534' : '#94A3B8',
                          }}>
                            {req.invoiceAmount != null ? formatSAR(req.invoiceAmount) : '—'}
                          </span>
                        </td>
                        <td>
                          {req.assignedTo
                            ? <span className="assigned-tag" style={{ fontSize: 11 }}>👷 Workshop</span>
                            : req.status !== 'completed'
                              ? <span className="unassigned-tag" style={{ fontSize: 11 }}>○ Unassigned</span>
                              : <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>—</span>}
                        </td>
                        <td>
                          <div style={{ fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                            {formatDate(req.createdAt)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Notifications Panel ──────────────────────────── */
function NotificationsPanel({ notifs, lastRead, reqMap, onSelect }) {
  if (notifs.length === 0) return (
    <div className="empty-state" style={{ marginTop: 20 }}>
      <div className="empty-icon">🔔</div>
      <div className="empty-title">No updates yet</div>
      <div className="empty-sub">لا يوجد تحديثات من الورشة حتى الآن</div>
    </div>
  );

  return (
    <div style={{ marginTop: 12 }}>
      {notifs.map((n, i) => {
        const isUnread = !lastRead || n.created_at > lastRead;
        const label = ACTION_LABELS_MAP[n.action] || { en: n.action, ar: '' };
        const req = reqMap[n.req_id];
        return (
          <div key={n.id || i} style={{
            background: isUnread ? '#faf5ff' : '#fff',
            border: `1.5px solid ${isUnread ? '#c4b5fd' : '#e2e8f0'}`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C3AED', display: 'inline-block', flexShrink: 0 }} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>{n.req_id}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>· Herfy {n.branch_number}</span>
                {req?.invoiceAmount != null && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#166534', background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '1px 7px', borderRadius: 20 }}>
                    {formatSAR(req.invoiceAmount)}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--gray-400)', whiteSpace: 'nowrap', marginLeft: 8 }}>{formatDate(n.created_at)}</span>
            </div>

            <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 2 }}>
              {label.en}
              {label.ar && <span style={{ color: 'var(--gray-400)', fontWeight: 400, marginLeft: 6, fontSize: 12 }}>/ {label.ar}</span>}
            </div>

            {n.detail && (
              <div style={{ fontSize: 12, color: '#64748b', background: '#f1f5f9', borderRadius: 6, padding: '5px 8px', marginTop: 5 }}>
                "{n.detail}"
              </div>
            )}

            {n.problem_description && (
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 5 }}>{n.problem_description}</div>
            )}

            {req && (
              <button
                onClick={() => onSelect(req)}
                style={{
                  marginTop: 10, padding: '5px 14px', borderRadius: 6,
                  border: '1px solid #7C3AED', background: '#fff',
                  color: '#7C3AED', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                Open Request / فتح الطلب ›
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Request Detail ───────────────────────────────── */
function TariqDetail({ req, onClose, onOpenAladheed }) {
  const [fresh, setFresh]             = useState(req);
  const [status, setStatus]           = useState(req.status);
  const [assignedTo, setAssignedTo]   = useState(req.assignedTo || '');
  const [internalNotes, setInternal]  = useState(req.internalNotes || '');
  const [notesToMajed, setToMajed]    = useState(req.notesToMajed || '');
  const [notesToEssa, setToEssa]      = useState(req.notesToEssa || '');
  const [finalSummary, setSummary]    = useState(req.finalSummary || '');
  const [showWorkDone, setShowWork]   = useState(req.showWorkDoneToEssa || false);
  const [showCompletion, setShowComp] = useState(req.showCompletionPhotosToEssa || false);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [completing, setCompleting]   = useState(false);
  const [branch, setBranch]           = useState(req.branchNumber);
  const [location, setLocation]       = useState(req.locationLink || '');
  const [desc, setDesc]               = useState(req.problemDescription || '');
  const [confirmDel, setConfirmDel]   = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [lightbox, setLightbox]       = useState(null);
  const [invoiceAmount, setInvoiceAmt] = useState(req.invoiceAmount ?? '');

  useEffect(() => {
    getRequests().then(all => {
      const found = all.find(r => r.id === req.id);
      if (found) {
        setFresh(found);
        setStatus(found.status);
        setAssignedTo(found.assignedTo || '');
        setInternal(found.internalNotes || '');
        setToMajed(found.notesToMajed || '');
        setToEssa(found.notesToEssa || '');
        setSummary(found.finalSummary || '');
        setShowWork(found.showWorkDoneToEssa || false);
        setShowComp(found.showCompletionPhotosToEssa || false);
        setInvoiceAmt(found.invoiceAmount ?? '');
      }
    });
  }, [req.id]);

  const save = async () => {
    setSaving(true);
    await updateRequest(fresh.id, {
      status,
      branchNumber:               branch.trim(),
      locationLink:               location.trim(),
      problemDescription:         desc.trim(),
      assignedTo:                 assignedTo || null,
      internalNotes,
      notesToMajed,
      notesToEssa,
      finalSummary,
      showWorkDoneToEssa:         showWorkDone,
      showCompletionPhotosToEssa: showCompletion,
      invoiceAmount:              invoiceAmount !== '' ? parseFloat(invoiceAmount) : null,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDelete = async () => {
    setSaving(true);
    await deleteRequest(fresh.id);
    onClose();
  };

  const markComplete = async () => {
    setCompleting(true);
    await updateRequest(fresh.id, {
      status: 'completed',
      finalSummary,
      notesToEssa,
      showWorkDoneToEssa:         showWorkDone,
      showCompletionPhotosToEssa: showCompletion,
    });
    setStatus('completed');
    setCompleting(false);
  };

  return (
    <div>
      {lightbox && <PhotoLightbox photos={lightbox.photos} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}

      <div className="detail-grid">

        {/* ══ LEFT: main info + workshop updates ══ */}
        <div className="detail-col">

          {/* Header card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="card-id">{fresh.id}</div>
                <div className="card-branch">Herfy {fresh.branchNumber}</div>
                <div className="card-date mt4">{formatDate(fresh.createdAt)}</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span className="badge" style={{ color: STATUS[status].color, background: STATUS[status].bg }}>
                  <span className="badge-dot" />{STATUS[status].en}
                </span>
                <span style={{
                  fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap',
                  color: fresh.invoiceAmount != null ? '#166534' : '#94A3B8',
                  background: fresh.invoiceAmount != null ? '#F0FDF4' : '#F8FAFC',
                  border: '1px solid ' + (fresh.invoiceAmount != null ? '#BBF7D0' : '#E2E8F0'),
                  padding: '3px 10px', borderRadius: 20,
                }}>
                  {fresh.invoiceAmount != null ? `💰 ${formatSAR(fresh.invoiceAmount)}` : '💰 Invoice: Not added'}
                </span>
              </div>
            </div>

            {getBranchInfo(fresh.branchNumber) && (() => {
              const info = getBranchInfo(fresh.branchNumber);
              return (
                <div className="mt12" style={{ fontSize: 13, color: '#166534', background: '#f0fdf4', borderRadius: 8, padding: '8px 12px', border: '1px solid #bbf7d0' }}>
                  📍 {info.area} — {info.address}
                </div>
              );
            })()}
            {fresh.locationLink && (
              <div className="mt8">
                <a className="info-link" href={fresh.locationLink} target="_blank" rel="noopener noreferrer">
                  🗺️ Google Maps / خرائط جوجل
                </a>
              </div>
            )}

            <div className="section-title">Edit Core Info / تعديل البيانات</div>
            <div className="form-group">
              <label className="label">Herfy Number / رقم هرفي</label>
              <input className="input" value={branch} onChange={e => setBranch(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label">Location Link / رابط الموقع</label>
              <input className="input" type="url" value={location} onChange={e => setLocation(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">Problem Description / وصف المشكلة</label>
              <textarea className="textarea" rows={3} value={desc} onChange={e => setDesc(e.target.value)} />
            </div>

            {fresh.problemPhotos?.length > 0 && (
              <>
                <div className="section-title">Problem Photos / صور المشكلة</div>
                <div className="photo-grid">
                  {fresh.problemPhotos.map((src, i) => (
                    <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: fresh.problemPhotos, index: i })}>
                      <img src={src} alt="" />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Workshop Updates */}
          {fresh.majedStarted && (
            <div className="card">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Workshop Updates / تحديثات الورشة</div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 14 }}>Not visible to client by default</div>

              {fresh.majedComments?.length > 0 && (
                <>
                  <div className="section-title">Comments / التعليقات</div>
                  {fresh.majedComments.map((c, i) => (
                    <div key={i} className="comment-item">
                      <div className="comment-text">👷 {c.text}</div>
                      <div className="comment-time">{formatDate(c.time)}</div>
                    </div>
                  ))}
                </>
              )}

              {fresh.progressPhotos?.length > 0 && (
                <>
                  <div className="section-title">Progress Photos / صور التقدم</div>
                  <div className="photo-grid">
                    {fresh.progressPhotos.map((src, i) => (
                      <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: fresh.progressPhotos, index: i })}>
                        <img src={src} alt="" />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {fresh.workDone && (
                <>
                  <div className="section-title">Work Done / العمل المنجز</div>
                  <div className="note-box note-box-green">{fresh.workDone}</div>
                </>
              )}

              {fresh.completionPhotos?.length > 0 && (
                <>
                  <div className="section-title">Completion Photos / صور الإنجاز</div>
                  <div className="photo-grid">
                    {fresh.completionPhotos.map((src, i) => (
                      <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: fresh.completionPhotos, index: i })}>
                        <img src={src} alt="" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ══ RIGHT: controls, notes, actions ══ */}
        <div className="detail-col">

          {/* Controls */}
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Controls / التحكم</div>
            <div className="form-group">
              <label className="label">Status / الحالة</label>
              <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="received">Request Received / تم استلام الطلب</option>
                <option value="scheduled">Scheduled / مجدول</option>
                <option value="in_progress">In Progress / قيد التنفيذ</option>
                <option value="completed">Completed / مكتمل</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Assign To / إسناد إلى</label>
              <select className="select" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                <option value="">— Not Assigned / غير مسند —</option>
                <option value="majed">Workshop Team / فريق الورشة</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">💰 Invoice Amount / قيمة الفاتورة <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>— Admin only</span></label>
              <div style={{ display: 'flex', alignItems: 'stretch' }}>
                <span style={{ padding: '0 12px', fontSize: 13, fontWeight: 700, color: '#64748B', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRight: 'none', borderRadius: '10px 0 0 10px', display: 'flex', alignItems: 'center' }}>SAR</span>
                <input
                  className="input"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={invoiceAmount}
                  onChange={e => setInvoiceAmt(e.target.value)}
                  style={{ borderRadius: '0 10px 10px 0', borderLeft: 'none', flex: 1 }}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Notes / الملاحظات</div>
            <div className="form-group">
              <label className="label">🔒 Internal Notes <span>/ ملاحظات داخلية</span></label>
              <textarea className="textarea" placeholder="Private notes for yourself..."
                value={internalNotes} onChange={e => setInternal(e.target.value)} rows={3} />
            </div>
            <div className="form-group">
              <label className="label">👷 Notes to Workshop <span>/ ملاحظات للورشة</span></label>
              <textarea className="textarea" placeholder="Instructions for the maintenance team..."
                value={notesToMajed} onChange={e => setToMajed(e.target.value)} rows={3} />
            </div>
            <div className="form-group">
              <label className="label">👤 Notes to Client <span>/ ملاحظات للعميل</span></label>
              <textarea className="textarea" placeholder="Message visible to the client..."
                value={notesToEssa} onChange={e => setToEssa(e.target.value)} rows={3} />
            </div>
          </div>

          {/* Visibility toggles */}
          {(fresh.workDone || fresh.completionPhotos?.length > 0) && (
            <div className="card">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Client Visibility / ما يراه العميل</div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 14 }}>Control what the client can see</div>
              {fresh.workDone && (
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Show Work Done to Client</div>
                    <div className="toggle-sub">إظهار العمل المنجز للعميل</div>
                  </div>
                  <button className={`toggle ${showWorkDone ? 'on' : ''}`} onClick={() => setShowWork(v => !v)} />
                </div>
              )}
              {fresh.completionPhotos?.length > 0 && (
                <div className="toggle-row">
                  <div>
                    <div className="toggle-label">Show Completion Photos to Client</div>
                    <div className="toggle-sub">إظهار صور الإنجاز للعميل</div>
                  </div>
                  <button className={`toggle ${showCompletion ? 'on' : ''}`} onClick={() => setShowComp(v => !v)} />
                </div>
              )}
            </div>
          )}

          {/* Final Summary */}
          <div className="card">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">📋 Final Summary <span>/ الملخص النهائي (visible to client)</span></label>
              <textarea className="textarea" placeholder="Write a final summary..."
                value={finalSummary} onChange={e => setSummary(e.target.value)} rows={4} />
            </div>
          </div>

          {/* Action buttons */}
          <div className="card">
            <button
              className="btn mb8"
              style={{ background: '#1e293b', color: '#fff', border: 'none' }}
              onClick={async () => {
                setExporting(true);
                await generateServiceReport(fresh);
                setExporting(false);
              }}
              disabled={exporting}>
              {exporting ? '⏳ Generating PDF...' : '📄 Export Report PDF / تصدير تقرير PDF'}
            </button>
            <button className="btn btn-primary-tariq mb8" onClick={save} disabled={saving}>
              {saved ? '✅ Saved!' : saving ? 'Saving...' : '💾 Save Changes / حفظ التغييرات'}
            </button>
            {status !== 'completed'
              ? <button className="btn btn-primary-green mb8" onClick={markComplete} disabled={completing}>
                  {completing ? '...' : '✅ Mark as Completed / إغلاق الطلب كمنجز'}
                </button>
              : <div style={{ textAlign: 'center', padding: '12px', color: '#16A34A', fontWeight: 700, fontSize: 15 }}>
                  ✅ This request is completed / تم إغلاق هذا الطلب
                </div>
            }

            {fresh.status === 'completed' && onOpenAladheed && (
              <button className="btn mb8"
                style={{ background: '#0F172A', color: '#D4A843', border: 'none', fontWeight: 700, fontSize: 14 }}
                onClick={() => onOpenAladheed(fresh)}>
                🦅 Open Aladheed | العضيد — Prepare Documents
              </button>
            )}

            {!confirmDel
              ? <button className="btn btn-outline" style={{ color: '#EF4444', borderColor: '#EF4444' }}
                  onClick={() => setConfirmDel(true)}>
                  🗑️ Delete Request / حذف الطلب
                </button>
              : <div style={{ background: '#FEF2F2', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', marginBottom: 10 }}>
                    Are you sure? / هل أنت متأكد؟
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary-red btn-sm" onClick={handleDelete} disabled={saving}>
                      {saving ? '...' : 'Yes, Delete / نعم احذف'}
                    </button>
                    <button className="btn btn-outline btn-sm" onClick={() => setConfirmDel(false)}>
                      Cancel / إلغاء
                    </button>
                  </div>
                </div>
            }
          </div>

        </div>
      </div>
    </div>
  );
}
