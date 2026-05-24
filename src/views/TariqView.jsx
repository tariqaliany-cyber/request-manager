import { useState, useEffect, useRef } from 'react';
import AladheedView from './AladheedView';
import { getRequests, updateRequest, deleteRequest, createRequest, getNotifications, getLastRead, setLastRead, ACTION_LABELS_MAP, STATUS, formatDate, compressImage } from '../storage';
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

function TariqSidebar({ user, onLogout, activeFilter, onFilter, onAladheed, onNewRequest, unreadCount }) {
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

        <button
          className={`sidebar-item ${activeFilter === 'new' ? 'active' : ''}`}
          onClick={onNewRequest}
          style={{ background: 'rgba(212,168,67,.15)', marginBottom: 4 }}>
          <span className="sidebar-item-icon">➕</span>
          طلب جديد / New Request
        </button>

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
  const [newReqMode, setNewReqMode]     = useState(false);
  const refresh = () => setTick(n => n + 1);

  const openNewRequest = () => { setNewReqMode(true); setSelected(null); };
  const closeNewRequest = (created) => {
    setNewReqMode(false);
    if (created) { setSelected(created); refresh(); }
  };

  const openAladheed  = (job = null) => { setAladheedJob(job); setAladheedMode(true); };
  const closeAladheed = ()           => { setAladheedJob(null); setAladheedMode(false); };

  // Aladheed is full-screen — no sidebar
  if (aladheedMode) {
    return <AladheedView job={aladheedJob} onClose={closeAladheed} />;
  }

  const handleFilter = (f) => {
    setFilter(f);
    setSelected(null);
    setNewReqMode(false);
  };

  // Topbar title based on current view
  const topbarTitle = newReqMode
    ? '➕ New Request / طلب جديد'
    : selected
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
        activeFilter={newReqMode ? 'new' : selected ? '' : filter}
        onFilter={handleFilter}
        onAladheed={() => openAladheed(null)}
        onNewRequest={openNewRequest}
        unreadCount={unreadCount}
      />

      {/* ── Main content area ── */}
      <div className="tariq-main">

        {/* Mobile header (hidden on desktop via CSS) */}
        <header className="header header-tariq tariq-mobile-header">
          {(selected || newReqMode) ? (
            <>
              <button className="back-btn" onClick={() => { setSelected(null); setNewReqMode(false); refresh(); }} style={{ color: '#1E293B' }}>
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
                <button
                  onClick={openNewRequest}
                  style={{ fontSize: 13, fontWeight: 700, background: 'var(--tariq-color)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                  ➕ طلب جديد
                </button>
                <button className="btn-logout" onClick={onLogout}>Logout</button>
              </div>
            </>
          )}
        </header>

        {/* Desktop topbar (hidden on mobile via CSS) */}
        <header className="tariq-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {(selected || newReqMode) && (
              <button
                onClick={() => { setSelected(null); setNewReqMode(false); refresh(); }}
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
            {!newReqMode && !selected && (
              <button
                onClick={openNewRequest}
                style={{ fontSize: 12, fontWeight: 700, background: 'var(--tariq-color)', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}>
                ➕ طلب جديد
              </button>
            )}
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
          {newReqMode ? (
            <TariqNewRequestForm onClose={closeNewRequest} />
          ) : selected ? (
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

/* ── New Request Form ───────────────────────────── */
function TariqNewRequestForm({ onClose }) {
  const [branch, setBranch]   = useState('');
  const [desc, setDesc]       = useState('');
  const [location, setLoc]    = useState('');
  const [photos, setPhotos]   = useState([]);
  const [status, setStatus]   = useState('received');
  const [assignedTo, setAssign] = useState('');
  const [submitting, setSub]  = useState(false);
  const [error, setError]     = useState('');
  const fileRef               = useRef();

  const handlePhotos = async (e) => {
    const files = Array.from(e.target.files);
    const compressed = await Promise.all(files.map(compressImage));
    setPhotos(prev => [...prev, ...compressed]);
    e.target.value = '';
  };

  const removePhoto = (i) => setPhotos(prev => prev.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    if (!branch.trim()) { setError('رقم الفرع مطلوب / Branch number is required'); return; }
    if (!desc.trim())   { setError('وصف المشكلة مطلوب / Problem description is required'); return; }
    setSub(true);
    const created = await createRequest({
      branchNumber:       branch.trim(),
      problemDescription: desc.trim(),
      locationLink:       location.trim(),
      problemPhotos:      photos,
      status,
      assignedTo:         assignedTo || null,
      createdBy:          'tariq',
    });
    setSub(false);
    if (!created) { setError('فشل الحفظ / Save failed'); return; }
    onClose(created);
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="card">
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 18, color: 'var(--gray-800)' }}>
          ➕ طلب صيانة جديد / New Maintenance Request
        </div>

        <div className="form-group">
          <label className="label">رقم هرفي / Branch Number *</label>
          <select className="select" value={branch} onChange={e => setBranch(e.target.value)}>
            <option value="">— اختر الفرع / Select Branch —</option>
            {BRANCHES.map(b => (
              <option key={b.num} value={b.num}>
                {b.num} — {b.area}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="label">وصف المشكلة / Problem Description *</label>
          <textarea className="textarea" rows={4} placeholder="اكتب وصف المشكلة..." value={desc} onChange={e => setDesc(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="label">رابط الموقع / Location Link</label>
          <input className="input" type="url" placeholder="https://maps.google.com/..." value={location} onChange={e => setLoc(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="label">الحالة / Status</label>
          <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="received">Request Received / تم استلام الطلب</option>
            <option value="scheduled">Scheduled / مجدول</option>
            <option value="in_progress">In Progress / قيد التنفيذ</option>
          </select>
        </div>

        <div className="form-group">
          <label className="label">إسناد إلى / Assign To</label>
          <select className="select" value={assignedTo} onChange={e => setAssign(e.target.value)}>
            <option value="">— غير مسند / Unassigned —</option>
            <option value="majed">Workshop Team / فريق الورشة</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">صور المشكلة / Problem Photos</label>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotos} />
          {photos.length > 0 && (
            <div className="photo-grid" style={{ marginBottom: 10 }}>
              {photos.map((src, i) => (
                <div key={i} className="photo-thumb" style={{ position: 'relative' }}>
                  <img src={src} alt="" />
                  <button className="photo-remove" onClick={() => removePhoto(i)}>✕</button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', border: '1.5px dashed #CBD5E1', borderRadius: 10, background: '#F8FAFC', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#64748B', width: '100%', justifyContent: 'center' }}>
            📷 إضافة صور / Add Photos
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13 }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button
          className="btn btn-primary-tariq"
          style={{ flex: 1 }}
          onClick={handleSubmit}
          disabled={submitting}>
          {submitting ? '⏳ جاري الحفظ...' : '💾 حفظ الطلب / Save Request'}
        </button>
        <button className="btn btn-outline" onClick={() => onClose(null)} style={{ flex: 0 }}>
          إلغاء
        </button>
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
  const [finalSummary, setSummary]    = useState(req.finalSummary || '');
  const [editingPhotos, setEditingPhotos]   = useState(null); // null | 'problem' | 'progress' | 'completion'
  const [savingPhotos, setSavingPhotos]     = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoInputRef = useRef();
  const uploadTypeRef = useRef(null);
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
  const [invoiceAmount, setInvoiceAmt]       = useState(req.invoiceAmount ?? '');
  const [progressPercentage, setProgress]    = useState(req.progressPercentage ?? 0);

  useEffect(() => {
    getRequests().then(all => {
      const found = all.find(r => r.id === req.id);
      if (found) {
        setFresh(found);
        setStatus(found.status);
        setAssignedTo(found.assignedTo || '');
        setSummary(found.finalSummary || '');
        setShowWork(found.showWorkDoneToEssa || false);
        setShowComp(found.showCompletionPhotosToEssa || false);
        setInvoiceAmt(found.invoiceAmount ?? '');
        setProgress(found.progressPercentage ?? 0);
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
      finalSummary,
      showWorkDoneToEssa:         showWorkDone,
      showCompletionPhotosToEssa: showCompletion,
      invoiceAmount:              invoiceAmount !== '' ? parseFloat(invoiceAmount) : null,
      progressPercentage:         Math.min(100, Math.max(0, Number(progressPercentage) || 0)),
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
      showWorkDoneToEssa:         showWorkDone,
      showCompletionPhotosToEssa: showCompletion,
    });
    setStatus('completed');
    setCompleting(false);
  };

  const deletePhoto = async (type, idx) => {
    setSavingPhotos(true);
    const fieldMap = { problem: 'problemPhotos', progress: 'progressPhotos', completion: 'completionPhotos' };
    const srcMap   = { problem: fresh.problemPhotos, progress: fresh.progressPhotos, completion: fresh.completionPhotos };
    const next     = (srcMap[type] || []).filter((_, i) => i !== idx);
    const updated  = await updateRequest(fresh.id, { [fieldMap[type]]: next });
    if (updated) setFresh(updated);
    setSavingPhotos(false);
  };

  const triggerUpload = (type) => {
    uploadTypeRef.current = type;
    photoInputRef.current?.click();
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length || !uploadTypeRef.current) return;
    setUploadingPhotos(true);
    const fieldMap = { problem: 'problemPhotos', progress: 'progressPhotos', completion: 'completionPhotos' };
    const srcMap   = { problem: fresh.problemPhotos, progress: fresh.progressPhotos, completion: fresh.completionPhotos };
    const type     = uploadTypeRef.current;
    const compressed = await Promise.all(files.map(compressImage));
    const next = [...(srcMap[type] || []), ...compressed];
    const updated = await updateRequest(fresh.id, { [fieldMap[type]]: next });
    if (updated) setFresh(updated);
    setUploadingPhotos(false);
    e.target.value = '';
  };

  return (
    <div>
      {lightbox && <PhotoLightbox photos={lightbox.photos} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
      <input ref={photoInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotoUpload} />

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

            <div className="section-title" style={{ justifyContent: 'space-between' }}>
              <span>Problem Photos / صور المشكلة</span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => triggerUpload('problem')} disabled={uploadingPhotos}
                  style={{ fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  {uploadingPhotos && uploadTypeRef.current === 'problem' ? '⏳' : '📷 إضافة'}
                </button>
                {fresh.problemPhotos?.length > 0 && (
                  <button onClick={() => setEditingPhotos(editingPhotos === 'problem' ? null : 'problem')}
                    style={{ fontSize: 11, fontWeight: 700, background: editingPhotos === 'problem' ? '#166534' : '#F1F5F9', color: editingPhotos === 'problem' ? '#fff' : '#64748B', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                    {editingPhotos === 'problem' ? '✓ Done' : '✏️ Edit'}
                  </button>
                )}
              </div>
            </div>
            {savingPhotos && editingPhotos === 'problem' && <div style={{ fontSize: 11, color: '#D97706', marginBottom: 6 }}>⏳ Saving...</div>}
            {fresh.problemPhotos?.length > 0 && (
              <div className="photo-grid">
                {fresh.problemPhotos.map((src, i) => (
                  <div key={i} className="photo-thumb"
                    style={{ cursor: editingPhotos === 'problem' ? 'default' : 'pointer' }}
                    onClick={() => editingPhotos !== 'problem' && setLightbox({ photos: fresh.problemPhotos, index: i })}>
                    <img src={src} alt="" />
                    {editingPhotos === 'problem' && (
                      <button className="photo-remove" disabled={savingPhotos}
                        onClick={e => { e.stopPropagation(); deletePhoto('problem', i); }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
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

              <div className="section-title" style={{ justifyContent: 'space-between' }}>
                <span>Progress Photos / صور التقدم</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => triggerUpload('progress')} disabled={uploadingPhotos}
                    style={{ fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                    {uploadingPhotos && uploadTypeRef.current === 'progress' ? '⏳' : '📷 إضافة'}
                  </button>
                  {fresh.progressPhotos?.length > 0 && (
                    <button onClick={() => setEditingPhotos(editingPhotos === 'progress' ? null : 'progress')}
                      style={{ fontSize: 11, fontWeight: 700, background: editingPhotos === 'progress' ? '#166534' : '#F1F5F9', color: editingPhotos === 'progress' ? '#fff' : '#64748B', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                      {editingPhotos === 'progress' ? '✓ Done' : '✏️ Edit'}
                    </button>
                  )}
                </div>
              </div>
              {savingPhotos && editingPhotos === 'progress' && <div style={{ fontSize: 11, color: '#D97706', marginBottom: 6 }}>⏳ Saving...</div>}
              {fresh.progressPhotos?.length > 0 && (
                <div className="photo-grid">
                  {fresh.progressPhotos.map((src, i) => (
                    <div key={i} className="photo-thumb"
                      style={{ cursor: editingPhotos === 'progress' ? 'default' : 'pointer' }}
                      onClick={() => editingPhotos !== 'progress' && setLightbox({ photos: fresh.progressPhotos, index: i })}>
                      <img src={src} alt="" />
                      {editingPhotos === 'progress' && (
                        <button className="photo-remove" disabled={savingPhotos}
                          onClick={e => { e.stopPropagation(); deletePhoto('progress', i); }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {fresh.workDone && (
                <>
                  <div className="section-title">Work Done / العمل المنجز</div>
                  <div className="note-box note-box-green">{fresh.workDone}</div>
                </>
              )}

              <div className="section-title" style={{ justifyContent: 'space-between' }}>
                <span>Completion Photos / صور الإنجاز</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => triggerUpload('completion')} disabled={uploadingPhotos}
                    style={{ fontSize: 11, fontWeight: 700, background: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                    {uploadingPhotos && uploadTypeRef.current === 'completion' ? '⏳' : '📷 إضافة'}
                  </button>
                  {fresh.completionPhotos?.length > 0 && (
                    <button onClick={() => setEditingPhotos(editingPhotos === 'completion' ? null : 'completion')}
                      style={{ fontSize: 11, fontWeight: 700, background: editingPhotos === 'completion' ? '#166534' : '#F1F5F9', color: editingPhotos === 'completion' ? '#fff' : '#64748B', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                      {editingPhotos === 'completion' ? '✓ Done' : '✏️ Edit'}
                    </button>
                  )}
                </div>
              </div>
              {savingPhotos && editingPhotos === 'completion' && <div style={{ fontSize: 11, color: '#D97706', marginBottom: 6 }}>⏳ Saving...</div>}
              {fresh.completionPhotos?.length > 0 && (
                <div className="photo-grid">
                  {fresh.completionPhotos.map((src, i) => (
                    <div key={i} className="photo-thumb"
                      style={{ cursor: editingPhotos === 'completion' ? 'default' : 'pointer' }}
                      onClick={() => editingPhotos !== 'completion' && setLightbox({ photos: fresh.completionPhotos, index: i })}>
                      <img src={src} alt="" />
                      {editingPhotos === 'completion' && (
                        <button className="photo-remove" disabled={savingPhotos}
                          onClick={e => { e.stopPropagation(); deletePhoto('completion', i); }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
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
            <div className="form-group">
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

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="label">📊 Progress / نسبة التقدم <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>— visible to client</span></label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  placeholder="0"
                  value={progressPercentage}
                  onChange={e => {
                    const v = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                    setProgress(v);
                  }}
                  style={{ flex: 1 }}
                />
                <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--tariq-color)', minWidth: 40 }}>
                  {progressPercentage}%
                </span>
              </div>
              <div style={{ marginTop: 8, background: '#F1F5F9', borderRadius: 8, height: 10, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${progressPercentage}%`,
                  background: progressPercentage === 100 ? '#16A34A' : 'var(--tariq-color)',
                  borderRadius: 8,
                  transition: 'width .3s ease',
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
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
