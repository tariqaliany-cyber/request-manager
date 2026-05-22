import { useState, useEffect } from 'react';
import AladheedView from './AladheedView';
import { getRequests, updateRequest, deleteRequest, getNotifications, getLastRead, setLastRead, ACTION_LABELS_MAP, STATUS, formatDate } from '../storage';
import { generateServiceReport } from '../generateReport';
import { BRANCHES } from '../branchData';
import PhotoLightbox from '../components/PhotoLightbox';

function getBranchInfo(num) {
  return BRANCHES.find(b => b.num === String(num)) || null;
}

export default function TariqView({ user, onLogout }) {
  const [selected, setSelected]         = useState(null);
  const [tick, setTick]                 = useState(0);
  const [aladheedMode, setAladheedMode] = useState(false);
  const [aladheedJob, setAladheedJob]   = useState(null);
  const refresh = () => setTick(n => n + 1);

  const openAladheed  = (job = null) => { setAladheedJob(job); setAladheedMode(true); };
  const closeAladheed = ()           => { setAladheedJob(null); setAladheedMode(false); };

  if (aladheedMode) {
    return <AladheedView job={aladheedJob} onClose={closeAladheed} />;
  }

  if (selected) {
    return (
      <div>
        <header className="header header-tariq">
          <button className="back-btn" onClick={() => { setSelected(null); refresh(); }} style={{ color: '#1E293B' }}>
            ← All Requests
          </button>
          <div className="header-right">
            <button className="btn-outline" onClick={() => openAladheed(null)} style={{ marginRight: 8, fontSize: 13, fontWeight: 700 }}>
              🦅 Aladheed
            </button>
            <button className="btn-logout" onClick={onLogout}>Logout</button>
          </div>
        </header>
        <div className="page">
          <TariqDetail req={selected} onClose={() => { setSelected(null); refresh(); }} onOpenAladheed={openAladheed} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="header header-tariq">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/herfy-logo.png" alt="Herfy" style={{ height: 36, width: 'auto', display: 'block' }} />
          <div>
            <div className="header-title">Admin / لوحة التحكم</div>
            <div className="header-sub">Welcome, {user.nameAr} · {user.name}</div>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-outline" onClick={() => openAladheed(null)} style={{ marginRight: 8, fontSize: 13, fontWeight: 700 }}>
            🦅 Aladheed
          </button>
          <button className="btn-logout" onClick={onLogout}>Logout</button>
        </div>
      </header>
      <div className="page">
        <TariqDashboard onSelect={setSelected} tick={tick} />
      </div>
    </div>
  );
}

/* ── Dashboard ──────────────────────────────────────── */
function TariqDashboard({ onSelect, tick }) {
  const [all, setAll]           = useState([]);
  const [notifs, setNotifs]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState('all');

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

  const openNotifications = () => {
    setLastRead();
    setFilter('updates');
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
    return r.status === filter;
  });

  const FILTERS = [
    { key: 'all',         label: 'All',         color: 'var(--tariq-color)' },
    { key: 'unassigned',  label: 'Unassigned',  color: '#EF4444' },
    { key: 'scheduled',   label: 'Scheduled',   color: '#D97706' },
    { key: 'in_progress', label: 'In Progress', color: '#563b2c' },
    { key: 'completed',   label: 'Completed',   color: '#16A34A' },
  ];

  if (loading) return <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>;

  // Build a req lookup map for "Open Request" button in notifications
  const reqMap = Object.fromEntries(all.map(r => [r.id, r]));

  return (
    <div>
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
        onClick={filter === 'updates' ? () => setFilter('all') : openNotifications}
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
                onClick={() => setFilter(f.key)}>
                {f.label}{counts[f.key] > 0 && <span style={{ opacity: .7 }}> ({counts[f.key]})</span>}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <div className="empty-title">No requests here</div>
            </div>
          ) : filtered.map(req => {
            const s = STATUS[req.status];
            return (
              <div key={req.id} className="card card-clickable" onClick={() => onSelect(req)}>
                <div className="card-header">
                  <div>
                    <div className="card-id">{req.id}</div>
                    <div className="card-branch">Herfy {req.branchNumber}</div>
                    {(() => { const info = getBranchInfo(req.branchNumber); return <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>📍 {info ? info.area : 'Location: Not specified'}</div>; })()}
                  </div>
                  <span className="badge" style={{ color: s.color, background: s.bg }}>
                    <span className="badge-dot" />{s.en}
                  </span>
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
        </>
      )}
    </div>
  );
}

/* ── Notifications Panel ────────────────────────────── */
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {isUnread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#7C3AED', display: 'inline-block', flexShrink: 0 }} />}
                <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>{n.req_id}</span>
                <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>· Herfy {n.branch_number}</span>
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

/* ── Request Detail ─────────────────────────────────── */
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
  // edit core fields
  const [branch, setBranch]           = useState(req.branchNumber);
  const [location, setLocation]       = useState(req.locationLink || '');
  const [desc, setDesc]               = useState(req.problemDescription || '');
  const [confirmDel, setConfirmDel]   = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [lightbox, setLightbox]       = useState(null);

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
      {/* Header card */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="card-id">{fresh.id}</div>
            <div className="card-branch">Herfy {fresh.branchNumber}</div>
            <div className="card-date mt4">{formatDate(fresh.createdAt)}</div>
          </div>
          <span className="badge" style={{ color: STATUS[status].color, background: STATUS[status].bg }}>
            <span className="badge-dot" />{STATUS[status].en}
          </span>
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
  );
}
