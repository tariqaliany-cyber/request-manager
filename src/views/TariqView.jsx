import { useState, useEffect, useRef } from 'react';
import { getRequestListItems, createRequest, getRecentNotifications, logActivity, getLastRead, setLastRead, ACTION_LABELS_MAP, STATUS, PRIORITY, PAYMENT_STATUS, formatDate, compressImage } from '../storage';
import { getBranchInfo, BRANCHES } from '../branchData';
import AppSidebar, { useSidebarCollapse } from '../components/AppSidebar';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import TariqRequestDetail from './TariqRequestDetail';

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, Number(value) || 0));
  const color = pct >= 95 ? '#15803D' : pct >= 51 ? '#22C55E' : pct >= 26 ? '#EAB308' : '#EF4444';
  const bg    = pct >= 95 ? 'linear-gradient(90deg,#15803D,#16A34A)'
    : pct >= 51 ? 'linear-gradient(90deg,#16A34A,#4ADE80)'
    : pct >= 26 ? 'linear-gradient(90deg,#CA8A04,#EAB308)'
    :             'linear-gradient(90deg,#DC2626,#EF4444)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
      <div style={{ flex: 1, background: '#E2E8F0', borderRadius: 99, height: 7, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: bg, borderRadius: 99, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 800, color, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

function formatSAR(amount) {
  const n = Number(amount);
  if (isNaN(n)) return null;
  return 'SAR ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ── Main Export ────────────────────────────────── */
export default function TariqView({ user, onLogout }) {
  const [selected, setSelected]         = useState(null);
  const [tick, setTick]                 = useState(0);
  const [filter, setFilter]             = useState('all');
  const [unreadCount, setUnreadCount]   = useState(0);
  const [newReqMode, setNewReqMode]     = useState(false);
  const [collapsed, toggleCollapsed]    = useSidebarCollapse();
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const refresh = () => setTick(n => n + 1);

  const openNewRequest = () => { setNewReqMode(true); setSelected(null); setDrawerOpen(false); };
  const closeNewRequest = (created) => {
    setNewReqMode(false);
    if (created) { setSelected(created); refresh(); }
  };

  const handleFilter = (f) => {
    setFilter(f);
    setSelected(null);
    setNewReqMode(false);
    setDrawerOpen(false);
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

  const showBack = !!(selected || newReqMode);

  return (
    <div className="tariq-layout">
      <AppSidebar
        user={user}
        onLogout={onLogout}
        activeFilter={newReqMode ? 'new' : selected ? '' : filter}
        onFilter={handleFilter}
        onNewRequest={openNewRequest}
        unreadCount={unreadCount}
        collapsed={collapsed}
        onToggleCollapse={toggleCollapsed}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      {/* ── Main content area ── */}
      <div className={`tariq-main ${collapsed ? 'sidebar-collapsed' : ''}`}>

        <AppHeader
          title={topbarTitle}
          user={user}
          onLogout={onLogout}
          onNewRequest={openNewRequest}
          showBack={showBack}
          onBack={() => { setSelected(null); setNewReqMode(false); refresh(); }}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        {/* Page content */}
        <div className="page">
          {newReqMode ? (
            <TariqNewRequestForm onClose={closeNewRequest} />
          ) : selected ? (
            <TariqRequestDetail
              req={selected}
              user={user}
              onClose={() => { setSelected(null); refresh(); }}
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
    logActivity({ requestId: created.id, action: 'request_created', actor: 'Tariq', actorRole: 'tariq' });
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
                  <img src={src} alt="" decoding="async" />
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
const PAGE_SIZE = 20;

function TariqDashboard({ onSelect, tick, filter, onFilter, onUnreadCount }) {
  const [all, setAll]         = useState([]);
  const [notifs, setNotifs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch]           = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [paymentFilter, setPaymentFilter]   = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    Promise.all([getRequestListItems(), getRecentNotifications()]).then(([reqs, nfs]) => {
      setAll(reqs);
      setNotifs(nfs);
      setLoading(false);
    });
  }, [tick]);

  // Debounce search input so filtering a large list doesn't re-run on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [filter, search, priorityFilter, paymentFilter]);

  const lastRead = getLastRead();
  const unreadCount = notifs.filter(n => !lastRead || n.created_at > lastRead).length;

  useEffect(() => { onUnreadCount(unreadCount); }, [unreadCount]);

  const openNotifications = () => {
    setLastRead();
    onFilter('updates');
  };

  const today = new Date().toISOString().substring(0, 10);
  const counts = {
    all:         all.length,
    unassigned:  all.filter(r => !r.assignedTo && r.status !== 'completed').length,
    in_progress: all.filter(r => r.status === 'in_progress').length,
    scheduled:   all.filter(r => r.status === 'scheduled').length,
    completed:   all.filter(r => r.status === 'completed').length,
    overdue:     all.filter(r => r.status !== 'completed' && r.dueDate && r.dueDate.substring(0, 10) < today).length,
    unpaid:      all.filter(r => r.invoiceAmount != null && (r.paymentStatus || 'unpaid') !== 'paid').length,
  };

  const filtered = all.filter(r => {
    if (filter === 'all')        { /* no status restriction */ }
    else if (filter === 'unassigned') { if (r.assignedTo || r.status === 'completed') return false; }
    else if (filter === 'updates')    return false;
    else if (r.status !== filter) return false;

    if (search) {
      const haystack = `${r.id} ${r.branchNumber} ${r.problemDescription || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (priorityFilter && (r.priority || 'normal') !== priorityFilter) return false;
    if (paymentFilter && (r.paymentStatus || 'unpaid') !== paymentFilter) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

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
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#DC2626' }}>{counts.overdue}</div>
            <div className="stat-lbl">Overdue</div>
          </div>
          <div className="stat-card">
            <div className="stat-num" style={{ color: '#B45309' }}>{counts.unpaid}</div>
            <div className="stat-lbl">Unpaid</div>
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
            <input
              className="input mt12" type="search" placeholder="🔍 Search request #, branch, description…"
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <select className="select" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
                <option value="">All Priorities</option>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
              </select>
              <select className="select" value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
                <option value="">All Payment</option>
                {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
              </select>
            </div>
            <div className="filter-bar mt12">
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
                {paged.map(req => {
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
                          <StatusBadge status={s} />
                          {req.priority && req.priority !== 'normal' && <StatusBadge status={PRIORITY[req.priority]} style={{ fontSize: 10 }} />}
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
                      <ProgressBar value={req.progressPercentage ?? 0} />
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
            {filtered.length > 0 && <Pagination page={pageSafe} totalPages={totalPages} onChange={setPage} />}
          </>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          DESKTOP LAYOUT (hidden on mobile via CSS)
      ═══════════════════════════════════════════ */}

      {/* KPI row.
          Not shown: "Awaiting Delivery Note" / "Awaiting Signature" — the
          delivery_notes table doesn't exist in production yet (see Phase 8
          notes), so a widget built on it would silently show 0 and lie. */}
      <div className="tariq-desktop-panel">
        <div className="dash-kpi-row">
          {[
            { num: counts.all,         label: 'Total',       labelAr: 'الإجمالي',     color: 'var(--tariq-color)', border: 'var(--tariq-color)' },
            { num: counts.unassigned,  label: 'Pending',     labelAr: 'غير مسندة',    color: '#EF4444',            border: '#EF4444' },
            { num: counts.in_progress, label: 'In Progress', labelAr: 'قيد التنفيذ',  color: '#563b2c',            border: '#563b2c' },
            { num: counts.scheduled,   label: 'Scheduled',   labelAr: 'مجدولة',       color: '#D97706',            border: '#D97706' },
            { num: counts.completed,   label: 'Completed',   labelAr: 'مكتملة',       color: '#16A34A',            border: '#16A34A' },
            { num: counts.overdue,     label: 'Overdue',     labelAr: 'متأخرة',       color: '#DC2626',            border: '#DC2626' },
            { num: counts.unpaid,      label: 'Unpaid',      labelAr: 'غير مدفوعة',   color: '#B45309',            border: '#B45309' },
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
                    <StatusBadge status={s} style={{ flexShrink: 0, fontSize: 11 }} />
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
                        {n.request_id} · Herfy {reqMap[n.request_id]?.branchNumber ?? '—'}
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

        {/* Search + filters */}
        {filter !== 'updates' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <input
              className="input" type="search" placeholder="🔍 Search request #, branch, description…"
              value={searchInput} onChange={e => setSearchInput(e.target.value)}
              style={{ flex: '1 1 240px', minWidth: 200 }}
            />
            <select className="select" style={{ width: 'auto' }} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="">All Priorities</option>
              {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
            </select>
            <select className="select" style={{ width: 'auto' }} value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
              <option value="">All Payment Statuses</option>
              {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.en}</option>)}
            </select>
          </div>
        )}

        {/* Filter chips */}
        {filter !== 'updates' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--gray-800)' }}>
              {filter === 'all' ? `All Requests — ${filtered.length}` : `${FILTERS.find(f => f.key === filter)?.label} — ${filtered.length}`}
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
                    <th>Priority</th>
                    <th>Progress</th>
                    <th>Status</th>
                    <th>Invoice</th>
                    <th>Assigned</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(req => {
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
                          <StatusBadge status={PRIORITY[req.priority || 'normal']} style={{ fontSize: 11 }} />
                        </td>
                        <td style={{ minWidth: 110 }}>
                          <ProgressBar value={req.progressPercentage ?? 0} />
                        </td>
                        <td>
                          <StatusBadge status={s} style={{ fontSize: 11 }} />
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
        {filter !== 'updates' && filtered.length > 0 && (
          <Pagination page={pageSafe} totalPages={totalPages} onChange={setPage} />
        )}
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, margin: '16px 0' }}>
      <button className="btn-outline btn-sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>‹ Prev</button>
      <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>Page {page} of {totalPages}</span>
      <button className="btn-outline btn-sm" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next ›</button>
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
        const req = reqMap[n.request_id];
        return (
          <div key={n.id || i} style={{
            background: isUnread ? '#faf5ff' : '#fff',
            border: `1.5px solid ${isUnread ? '#c4b5fd' : '#e2e8f0'}`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C3AED', display: 'inline-block', flexShrink: 0 }} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>{n.request_id}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>· Herfy {req?.branchNumber ?? '—'}</span>
                {n.actor && <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>· {n.actor}</span>}
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

            {req?.problemDescription && (
              <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 5 }}>{req.problemDescription}</div>
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

