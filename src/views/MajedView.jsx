import { useState, useEffect, useRef } from 'react';
import { getRequestListItems, getRequestById, updateRequest, addMajedComment, logActivity, compressImage, STATUS, photoSrc, canSeeRepairCost } from '../storage';
import { BRANCHES, branchLabel } from '../branchData';
import { AREA_AR, ADDRESS_AR } from '../branchDataAr';
import PhotoLightbox from '../components/PhotoLightbox';
import StatusBadge from '../components/StatusBadge';

// Majed reads Arabic only — this whole view is Arabic and right-to-left.

function getBranchInfo(num) {
  const b = BRANCHES.find(b => b.num === String(num));
  if (!b) return null;
  return { ...b, areaAr: AREA_AR[b.area] || b.area, addressAr: ADDRESS_AR[b.address] || b.address };
}

// Request's own link first, then the branch's saved pin, then a Maps search.
function mapsLinkFor(req, info) {
  if (req.locationLink) return req.locationLink;
  if (info?.mapsUrl) return info.mapsUrl;
  if (!info) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Herfy ${info.address} ${info.area}`)}`;
}

const formatDateAr = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ar', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    calendar: 'gregory', numberingSystem: 'latn',
  });
};

const backBtnStyle = {
  background: '#563b2c', color: '#fff', border: 'none', borderRadius: 10,
  padding: '10px 18px', fontSize: 16, fontWeight: 700, cursor: 'pointer',
};

export default function MajedView({ user, onLogout }) {
  const [selected, setSelected] = useState(null);

  // Opening a job pushes a history entry so the phone's own back button
  // returns to the list instead of leaving the app.
  useEffect(() => {
    const onPop = () => setSelected(null);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openJob = (req) => {
    window.history.pushState({ majedJob: req.id }, '');
    setSelected(req);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    if (window.history.state?.majedJob) window.history.back();
    else setSelected(null);
  };

  if (selected) {
    return (
      <div dir="rtl" lang="ar">
        <header className="header header-majed">
          <button onClick={goBack} style={backBtnStyle}>→ رجوع</button>
          <div className="header-right">
            <button className="btn-logout" onClick={onLogout}>تسجيل الخروج</button>
          </div>
        </header>
        <div className="page">
          <MajedDetail req={selected} user={user} />
          <button onClick={goBack} style={{ ...backBtnStyle, width: '100%', marginTop: 8, padding: 14 }}>
            → رجوع إلى أعمالي
          </button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="ar">
      <header className="header header-majed">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/herfy-logo.png" alt="هرفي" style={{ height: 36, width: 'auto', display: 'block' }} />
          <div>
            <div className="header-title">أعمالي</div>
            <div className="header-sub">أهلاً {user.nameAr}</div>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-logout" onClick={onLogout}>تسجيل الخروج</button>
        </div>
      </header>
      <div className="page">
        <MajedList onSelect={openJob} />
      </div>
    </div>
  );
}

/* ── Job List ───────────────────────────────────────── */
function MajedList({ onSelect }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    // All technicians share the workshop queue.
    getRequestListItems({ assignedTo: 'majed' }).then(reqs => {
      setRequests(reqs);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">جاري التحميل...</div></div>;

  const active = requests.filter(r => r.status !== 'completed');
  const done   = requests.filter(r => r.status === 'completed');

  const JobCard = ({ req }) => {
    const info = getBranchInfo(req.branchNumber);
    const mapsLink = mapsLinkFor(req, info);
    return (
      <div className="card card-clickable" onClick={() => onSelect(req)}>
        <div className="card-header">
          <div>
            <div className="card-branch">{branchLabel(req.branchNumber, 'ar')}</div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>📍 {info ? `${info.areaAr} — ${info.addressAr}` : 'الموقع غير محدد'}</div>
            {mapsLink && (
              <a href={mapsLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                style={{ display: 'inline-block', marginTop: 6, fontSize: 13, fontWeight: 700, color: '#2563EB' }}>
                🗺️ الذهاب للموقع
              </a>
            )}
          </div>
          <StatusBadge status={STATUS[req.status]} lang="ar" />
        </div>
        <div className="card-desc">{req.problemDescription}</div>
        <div className="card-footer">
          <span className="card-date">{formatDateAr(req.createdAt)}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#563b2c' }}>افتح ‹</span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="section-title mt16">الأعمال المسندة لك ({active.length})</div>
      {active.length > 0
        ? active.map(r => <JobCard key={r.id} req={r} />)
        : (
          <div className="empty-state" style={{ padding: '30px 20px' }}>
            <div className="empty-icon">📭</div>
            <div className="empty-title">لا يوجد أعمال مسندة لك حالياً</div>
          </div>
        )}

      {done.length > 0 && (
        <>
          <button className="btn btn-outline" onClick={() => setShowDone(v => !v)} style={{ marginTop: 16 }}>
            {showDone ? '▲ إخفاء الأعمال المنجزة' : `▼ عرض الأعمال المنجزة (${done.length})`}
          </button>
          {showDone && (
            <div style={{ marginTop: 12 }}>
              {done.map(r => <JobCard key={r.id} req={r} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Job Detail ─────────────────────────────────────── */
function MajedDetail({ req, user }) {
  const [fresh, setFresh]       = useState(req);
  const [comment, setComment]         = useState('');
  const [workDone, setWorkDone]       = useState(req.workDone || '');
  const [repairCost, setRepairCost]   = useState('');
  const [costSaved, setCostSaved]     = useState(false);
  const [saving, setSaving]           = useState(false);
  const [stagedProgress, setStagedProgress]     = useState([]);
  const [stagedCompletion, setStagedCompletion] = useState([]);
  const [photoSaving, setPhotoSaving] = useState('');
  const [photoSaved, setPhotoSaved]   = useState('');
  const progressRef   = useRef();
  const completionRef = useRef();

  const reload = async () => {
    const updated = await getRequestById(req.id);
    if (updated) {
      setFresh(updated);
      setWorkDone(updated.workDone || '');
      setRepairCost(updated.repairCost ?? '');
    }
  };

  useEffect(() => { reload(); }, [req.id]);

  const logBase = () => ({
    requestId: fresh.id,
    actor:     user.name,
    actorRole: user.role,
    notify:    true,
  });

  const markStarted = async () => {
    setSaving(true);
    await updateRequest(fresh.id, { majedStarted: true, status: 'in_progress' });
    await logActivity({ ...logBase(), action: 'started' });
    await reload();
    setSaving(false);
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    const text = comment.trim();
    await addMajedComment(fresh.id, text);
    await logActivity({ ...logBase(), action: 'comment', detail: text });
    setComment('');
    await reload();
  };

  const saveWorkDone = async () => {
    if (!workDone.trim()) return;
    setSaving(true);
    await updateRequest(fresh.id, { workDone: workDone.trim() });
    await logActivity({ ...logBase(), action: 'work_done', detail: workDone.trim() });
    await reload();
    setSaving(false);
  };

  // Activity log is visible to Essa, so the amount itself is never logged.
  const saveRepairCost = async () => {
    setSaving(true);
    const value = repairCost === '' ? null : Number(repairCost);
    const ok = await updateRequest(fresh.id, { repairCost: value });
    await reload();
    setSaving(false);
    if (ok) { setCostSaved(true); setTimeout(() => setCostSaved(false), 3000); }
  };

  const stagePhotos = async (files, type) => {
    const compressed = await Promise.all([...files].map(compressImage));
    if (type === 'progress') setStagedProgress(p => [...p, ...compressed]);
    else setStagedCompletion(p => [...p, ...compressed]);
  };

  const saveAllPhotos = async (type) => {
    const staged = type === 'progress' ? stagedProgress : stagedCompletion;
    if (!staged.length) return;
    const key    = type === 'progress' ? 'progressPhotos' : 'completionPhotos';
    const action = type === 'progress' ? 'progress_photos' : 'completion_photos';
    setPhotoSaving(type);
    const existing = fresh[key] || [];
    await updateRequest(fresh.id, { [key]: [...existing, ...staged.map(url => ({ url, caption: '' }))] });
    await logActivity({ ...logBase(), action, detail: `${staged.length} photo(s)` });
    if (type === 'progress') setStagedProgress([]);
    else setStagedCompletion([]);
    await reload();
    setPhotoSaving('');
    setPhotoSaved(type);
    setTimeout(() => setPhotoSaved(''), 3000);
  };

  const [lightbox, setLightbox] = useState(null);
  const isCompleted = fresh.status === 'completed';
  const info = getBranchInfo(fresh.branchNumber);
  const mapsLink = mapsLinkFor(fresh, info);

  const PhotoSection = ({ title, type, staged, setStaged, inputRef, saved }) => (
    <div className="card">
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {!isCompleted && (
        <>
          <button className="btn btn-outline mb8" onClick={() => inputRef.current.click()}>
            📷 إضافة صور
          </button>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden
            onChange={e => stagePhotos(e.target.files, type)} />

          {staged.length > 0 && (
            <div style={{ marginTop: 8, padding: '12px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
                {staged.length} صورة جاهزة — لم يتم الحفظ بعد
              </div>
              <div className="photo-grid">
                {staged.map((src, i) => (
                  <div key={i} className="photo-thumb">
                    <img src={src} alt="" decoding="async" />
                    <button className="photo-remove" onClick={() => setStaged(p => p.filter((_, j) => j !== i))}>×</button>
                  </div>
                ))}
              </div>
              <button className="btn btn-primary-majed"
                onClick={() => saveAllPhotos(type)}
                disabled={photoSaving === type}
                style={{ width: '100%', marginTop: 10 }}>
                {photoSaving === type ? '⏳ جاري الحفظ...' : '💾 حفظ الصور'}
              </button>
            </div>
          )}

          {photoSaved === type && staged.length === 0 && (
            <div style={{ textAlign: 'center', color: '#16A34A', fontWeight: 700, marginTop: 8, fontSize: 14, padding: '8px', background: '#F0FDF4', borderRadius: 8 }}>
              ✅ تم حفظ الصور بنجاح
            </div>
          )}
        </>
      )}

      {saved?.length > 0 ? (
        <>
          {!isCompleted && <div style={{ fontSize: 12, color: 'var(--gray-400)', margin: '10px 0 4px' }}>الصور المحفوظة</div>}
          <div className="photo-grid">
            {saved.map((p, i) => (
              <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: saved, index: i })}>
                <img src={photoSrc(p)} alt="" decoding="async" />
              </div>
            ))}
          </div>
        </>
      ) : <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>لا توجد صور</div>}
    </div>
  );

  return (
    <div>
      {lightbox && <PhotoLightbox photos={lightbox.photos} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}

      {/* First thing Majed sees when he opens a job */}
      {canSeeRepairCost(user) && (
        <div className="card" style={{ border: '2px solid #563b2c' }}>
          <label htmlFor="repair-cost" style={{ display: 'block', fontSize: 17, fontWeight: 700, marginBottom: 10 }}>💰 أدخل قيمة الإصلاح</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input id="repair-cost" className="input" type="number" inputMode="decimal" min="0" step="any"
              placeholder="0" value={repairCost} onChange={e => setRepairCost(e.target.value)}
              disabled={isCompleted} style={{ flex: 1, fontSize: 20, fontWeight: 700, direction: 'ltr', textAlign: 'right' }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--gray-600)' }}>ريال</span>
          </div>
          {!isCompleted && (
            <button className="btn btn-primary-majed" onClick={saveRepairCost}
              disabled={saving || String(repairCost) === String(fresh.repairCost ?? '')}
              style={{ width: '100%', marginTop: 10 }}>
              💾 حفظ القيمة
            </button>
          )}
          {costSaved && <div style={{ color: '#16A34A', fontWeight: 700, fontSize: 14, marginTop: 8, textAlign: 'center' }}>✅ تم الحفظ</div>}
          <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 8 }}>🔒 يظهر لك ولطارق فقط</div>
        </div>
      )}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="card-branch">{branchLabel(fresh.branchNumber, 'ar')}</div>
          <StatusBadge status={STATUS[fresh.status]} lang="ar" />
        </div>

        {info && (
          <>
            <div className="section-title">موقع الفرع</div>
            <div className="note-box note-box-green">
              📍 {info.areaAr} — {info.addressAr}
            </div>
          </>
        )}
        {mapsLink && (
          <a href={mapsLink} target="_blank" rel="noopener noreferrer"
            style={{ display: 'block', marginTop: 10, padding: 14, borderRadius: 10, background: '#2563EB', color: '#fff', textAlign: 'center', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}>
            🗺️ الذهاب للموقع
          </a>
        )}

        <div className="section-title">المشكلة</div>
        <div style={{ fontSize: 15, lineHeight: 1.6 }}>{fresh.problemDescription}</div>

        {fresh.problemPhotos?.length > 0 && (
          <>
            <div className="section-title">صور المشكلة</div>
            <div className="photo-grid">
              {fresh.problemPhotos.map((p, i) => (
                <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: fresh.problemPhotos, index: i })}>
                  <img src={photoSrc(p)} alt="" decoding="async" />
                </div>
              ))}
            </div>
          </>
        )}

        {fresh.notesToMajed && (
          <>
            <div className="section-title">ملاحظات من المنسق</div>
            <div className="note-box note-box-amber">{fresh.notesToMajed}</div>
          </>
        )}
      </div>

      {!fresh.majedStarted && !isCompleted && (
        <div className="card">
          <button className="btn btn-primary-green" onClick={markStarted} disabled={saving}>
            🚀 بدء العمل
          </button>
        </div>
      )}

      {fresh.majedStarted && (
        <>
          <PhotoSection title="صور أثناء العمل" type="progress"
            staged={stagedProgress} setStaged={setStagedProgress}
            inputRef={progressRef} saved={fresh.progressPhotos} />

          {!isCompleted && (
            <div className="card">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>إضافة تعليق</div>
              <textarea className="textarea mb8"
                placeholder="اكتب تعليقاً أو تحديثاً..."
                value={comment} onChange={e => setComment(e.target.value)} rows={3} />
              <button className="btn btn-primary-majed" onClick={submitComment} disabled={!comment.trim()}>
                💬 إرسال
              </button>
            </div>
          )}

          {fresh.majedComments?.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>التعليقات</div>
              {fresh.majedComments.map((c, i) => (
                <div key={i} className="comment-item">
                  <div className="comment-text">{c.text}</div>
                  <div className="comment-time">{formatDateAr(c.time)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>ما تم تنفيذه</div>
            <textarea className="textarea mb8"
              placeholder="اكتب كل ما تم تنفيذه..."
              value={workDone} onChange={e => setWorkDone(e.target.value)}
              disabled={isCompleted} rows={4} />
            {!isCompleted && (
              <button className="btn btn-outline btn-sm" onClick={saveWorkDone}
                disabled={saving || !workDone.trim()}>
                💾 حفظ
              </button>
            )}
          </div>

          <PhotoSection title="صور بعد الإنجاز" type="completion"
            staged={stagedCompletion} setStaged={setStagedCompletion}
            inputRef={completionRef} saved={fresh.completionPhotos} />

          {isCompleted && (
            <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A' }}>تم إغلاق الطلب من قبل المنسق</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
