import { useState, useEffect, useRef } from 'react';
import { getRequestListItems, getRequestById, updateRequest, addMajedComment, createNotification, compressImage, STATUS, formatDate } from '../storage';
import { BRANCHES } from '../branchData';
import PhotoLightbox from '../components/PhotoLightbox';
import StatusBadge from '../components/StatusBadge';

function getBranchInfo(num) {
  return BRANCHES.find(b => b.num === String(num)) || null;
}

export default function MajedView({ user, onLogout }) {
  const [selected, setSelected] = useState(null);

  if (selected) {
    return (
      <div>
        <header className="header header-majed">
          <button className="back-btn" onClick={() => setSelected(null)} style={{ color: '#fff' }}>← Back</button>
          <div className="header-right">
            <button className="btn-logout" onClick={onLogout}>Logout</button>
          </div>
        </header>
        <div className="page">
          <MajedDetail req={selected} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <header className="header header-majed">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/herfy-logo.png" alt="Herfy" style={{ height: 36, width: 'auto', display: 'block' }} />
          <div>
            <div className="header-title">My Jobs / أعمالي</div>
            <div className="header-sub">Welcome, {user.nameAr} · {user.name}</div>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-logout" onClick={onLogout}>Logout</button>
        </div>
      </header>
      <div className="page">
        <MajedList onSelect={setSelected} />
      </div>
    </div>
  );
}

/* ── Job List ───────────────────────────────────────── */
function MajedList({ onSelect }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getRequestListItems({ assignedTo: 'majed' }).then(reqs => {
      setRequests(reqs);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>;

  const active = requests.filter(r => r.status !== 'completed');
  const done   = requests.filter(r => r.status === 'completed');

  const JobCard = ({ req }) => {
    const s = STATUS[req.status];
    return (
      <div className="card card-clickable" onClick={() => onSelect(req)}>
        <div className="card-header">
          <div>
            <div className="card-id">{req.id}</div>
            <div className="card-branch">Herfy {req.branchNumber}</div>
            {(() => { const info = getBranchInfo(req.branchNumber); return <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>📍 {info ? info.area : 'Location: Not specified'}</div>; })()}
          </div>
          <StatusBadge status={s} />
        </div>
        <div className="card-desc">{req.problemDescription}</div>
        <div className="card-footer">
          <span className="card-date">{formatDate(req.createdAt)}</span>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Tap to open ›</span>
        </div>
      </div>
    );
  };

  if (active.length === 0 && done.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <div className="empty-title">No jobs assigned yet</div>
        <div className="empty-sub">لا يوجد أعمال مسندة حتى الآن</div>
      </div>
    );
  }

  return (
    <div>
      {active.length > 0 && (
        <>
          <div className="section-title mt16">Active Jobs / الأعمال النشطة</div>
          {active.map(r => <JobCard key={r.id} req={r} />)}
        </>
      )}
      {done.length > 0 && (
        <>
          <div className="section-title">Completed / المنجزة</div>
          {done.map(r => <JobCard key={r.id} req={r} />)}
        </>
      )}
    </div>
  );
}

/* ── Job Detail ─────────────────────────────────────── */
function MajedDetail({ req }) {
  const [fresh, setFresh]       = useState(req);
  const [comment, setComment]         = useState('');
  const [workDone, setWorkDone]       = useState(req.workDone || '');
  const [saving, setSaving]           = useState(false);
  const [stagedProgress, setStagedProgress]     = useState([]);
  const [stagedCompletion, setStagedCompletion] = useState([]);
  const [photoSaving, setPhotoSaving] = useState('');
  const [photoSaved, setPhotoSaved]   = useState('');
  const progressRef   = useRef();
  const completionRef = useRef();

  const reload = async () => {
    const updated = await getRequestById(req.id);
    if (updated) { setFresh(updated); setWorkDone(updated.workDone || ''); }
  };

  useEffect(() => { reload(); }, [req.id]);

  const notifBase = () => ({
    reqId: fresh.id,
    branchNumber: fresh.branchNumber,
    problemDescription: fresh.problemDescription,
  });

  const markStarted = async () => {
    setSaving(true);
    await updateRequest(fresh.id, { majedStarted: true, status: 'in_progress' });
    await createNotification({ ...notifBase(), action: 'started' });
    await reload();
    setSaving(false);
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    const text = comment.trim();
    await addMajedComment(fresh.id, text);
    await createNotification({ ...notifBase(), action: 'comment', detail: text });
    setComment('');
    await reload();
  };

  const saveWorkDone = async () => {
    if (!workDone.trim()) return;
    setSaving(true);
    await updateRequest(fresh.id, { workDone: workDone.trim() });
    await createNotification({ ...notifBase(), action: 'work_done', detail: workDone.trim() });
    await reload();
    setSaving(false);
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
    await updateRequest(fresh.id, { [key]: [...existing, ...staged] });
    await createNotification({ ...notifBase(), action, detail: `${staged.length} photo(s)` });
    if (type === 'progress') setStagedProgress([]);
    else setStagedCompletion([]);
    await reload();
    setPhotoSaving('');
    setPhotoSaved(type);
    setTimeout(() => setPhotoSaved(''), 3000);
  };

  const [lightbox, setLightbox] = useState(null);
  const s = STATUS[fresh.status];
  const isCompleted = fresh.status === 'completed';

  return (
    <div>
      {lightbox && <PhotoLightbox photos={lightbox.photos} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="card-id">{fresh.id}</div>
            <div className="card-branch">Herfy {fresh.branchNumber}</div>
          </div>
          <StatusBadge status={s} />
        </div>

        {getBranchInfo(fresh.branchNumber) && (() => {
          const info = getBranchInfo(fresh.branchNumber);
          return (
            <>
              <div className="section-title">Branch Location / موقع الفرع</div>
              <div className="note-box note-box-green">
                📍 {info.area} — {info.address}
              </div>
            </>
          );
        })()}
        {fresh.locationLink && (
          <>
            <div className="section-title">Google Maps / خرائط جوجل</div>
            <a className="info-link" href={fresh.locationLink} target="_blank" rel="noopener noreferrer">
              🗺️ Open in Google Maps / فتح في خرائط جوجل
            </a>
          </>
        )}

        <div className="section-title">Problem / المشكلة</div>
        <div style={{ fontSize: 15, lineHeight: 1.6 }}>{fresh.problemDescription}</div>

        {fresh.problemPhotos?.length > 0 && (
          <>
            <div className="section-title">Problem Photos / صور المشكلة</div>
            <div className="photo-grid">
              {fresh.problemPhotos.map((src, i) => (
                <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: fresh.problemPhotos, index: i })}>
                  <img src={src} alt="" decoding="async" />
                </div>
              ))}
            </div>
          </>
        )}

        {fresh.notesToMajed && (
          <>
            <div className="section-title">Notes from Coordinator / ملاحظات من المنسق</div>
            <div className="note-box note-box-amber">{fresh.notesToMajed}</div>
          </>
        )}
      </div>

      {!fresh.majedStarted && !isCompleted && (
        <div className="card">
          <button className="btn btn-primary-green" onClick={markStarted} disabled={saving}>
            🚀 Start Work / بدء العمل
          </button>
        </div>
      )}

      {fresh.majedStarted && (
        <>
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Progress Photos / صور التقدم</div>
            {!isCompleted && (
              <>
                <button className="btn btn-outline mb8" onClick={() => progressRef.current.click()}>
                  📷 Add Progress Photos / إضافة صور تقدم
                </button>
                <input ref={progressRef} type="file" accept="image/*" multiple hidden
                  onChange={e => stagePhotos(e.target.files, 'progress')} />

                {stagedProgress.length > 0 && (
                  <div style={{ marginTop: 8, padding: '12px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
                      {stagedProgress.length} photo{stagedProgress.length > 1 ? 's' : ''} ready — not saved yet
                      <span style={{ fontWeight: 400, marginRight: 4 }}> / لم يتم الحفظ بعد</span>
                    </div>
                    <div className="photo-grid">
                      {stagedProgress.map((src, i) => (
                        <div key={i} className="photo-thumb">
                          <img src={src} alt="" decoding="async" />
                          <button className="photo-remove" onClick={() => setStagedProgress(p => p.filter((_, j) => j !== i))}>×</button>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-primary-majed"
                      onClick={() => saveAllPhotos('progress')}
                      disabled={photoSaving === 'progress'}
                      style={{ width: '100%', marginTop: 10 }}>
                      {photoSaving === 'progress' ? '⏳ Saving... / جاري الحفظ...' : '💾 Save All Photos / حفظ جميع الصور'}
                    </button>
                  </div>
                )}

                {photoSaved === 'progress' && stagedProgress.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#16A34A', fontWeight: 700, marginTop: 8, fontSize: 14, padding: '8px', background: '#F0FDF4', borderRadius: 8 }}>
                    ✅ Photos saved successfully! / تم حفظ الصور بنجاح!
                  </div>
                )}
              </>
            )}

            {fresh.progressPhotos?.length > 0 ? (
              <>
                {!isCompleted && <div style={{ fontSize: 12, color: 'var(--gray-400)', margin: '10px 0 4px' }}>Saved photos / الصور المحفوظة</div>}
                <div className="photo-grid">
                  {fresh.progressPhotos.map((src, i) => (
                    <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: fresh.progressPhotos, index: i })}>
                      <img src={src} alt="" decoding="async" />
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>No photos yet / لا توجد صور</div>}
          </div>

          {!isCompleted && (
            <div className="card">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Add Comment / إضافة تعليق</div>
              <textarea className="textarea mb8"
                placeholder="Write a comment or update... / اكتب تعليقاً أو تحديثاً..."
                value={comment} onChange={e => setComment(e.target.value)} rows={3} />
              <button className="btn btn-primary-majed" onClick={submitComment} disabled={!comment.trim()}>
                💬 Send Comment / إرسال
              </button>
            </div>
          )}

          {fresh.majedComments?.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Comments / التعليقات</div>
              {fresh.majedComments.map((c, i) => (
                <div key={i} className="comment-item">
                  <div className="comment-text">{c.text}</div>
                  <div className="comment-time">{formatDate(c.time)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>What Was Done / ما تم تنفيذه</div>
            <textarea className="textarea mb8"
              placeholder="Describe everything that was done... / صف كل ما تم تنفيذه..."
              value={workDone} onChange={e => setWorkDone(e.target.value)}
              disabled={isCompleted} rows={4} />
            {!isCompleted && (
              <button className="btn btn-outline btn-sm" onClick={saveWorkDone}
                disabled={saving || !workDone.trim()}>
                💾 Save / حفظ
              </button>
            )}
          </div>

          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>Completion Photos / صور الإنجاز</div>
            {!isCompleted && (
              <>
                <button className="btn btn-outline mb8" onClick={() => completionRef.current.click()}>
                  📷 Add Completion Photos / إضافة صور إنجاز
                </button>
                <input ref={completionRef} type="file" accept="image/*" multiple hidden
                  onChange={e => stagePhotos(e.target.files, 'completion')} />

                {stagedCompletion.length > 0 && (
                  <div style={{ marginTop: 8, padding: '12px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#92400E', marginBottom: 8 }}>
                      {stagedCompletion.length} photo{stagedCompletion.length > 1 ? 's' : ''} ready — not saved yet
                      <span style={{ fontWeight: 400, marginRight: 4 }}> / لم يتم الحفظ بعد</span>
                    </div>
                    <div className="photo-grid">
                      {stagedCompletion.map((src, i) => (
                        <div key={i} className="photo-thumb">
                          <img src={src} alt="" decoding="async" />
                          <button className="photo-remove" onClick={() => setStagedCompletion(p => p.filter((_, j) => j !== i))}>×</button>
                        </div>
                      ))}
                    </div>
                    <button className="btn btn-primary-majed"
                      onClick={() => saveAllPhotos('completion')}
                      disabled={photoSaving === 'completion'}
                      style={{ width: '100%', marginTop: 10 }}>
                      {photoSaving === 'completion' ? '⏳ Saving... / جاري الحفظ...' : '💾 Save All Photos / حفظ جميع الصور'}
                    </button>
                  </div>
                )}

                {photoSaved === 'completion' && stagedCompletion.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#16A34A', fontWeight: 700, marginTop: 8, fontSize: 14, padding: '8px', background: '#F0FDF4', borderRadius: 8 }}>
                    ✅ Photos saved successfully! / تم حفظ الصور بنجاح!
                  </div>
                )}
              </>
            )}

            {fresh.completionPhotos?.length > 0 ? (
              <>
                {!isCompleted && <div style={{ fontSize: 12, color: 'var(--gray-400)', margin: '10px 0 4px' }}>Saved photos / الصور المحفوظة</div>}
                <div className="photo-grid">
                  {fresh.completionPhotos.map((src, i) => (
                    <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: fresh.completionPhotos, index: i })}>
                      <img src={src} alt="" decoding="async" />
                    </div>
                  ))}
                </div>
              </>
            ) : <div style={{ color: 'var(--gray-400)', fontSize: 13 }}>No photos yet / لا توجد صور</div>}
          </div>

          {isCompleted && (
            <div className="card" style={{ textAlign: 'center', padding: '24px' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A' }}>Job Completed by Coordinator</div>
              <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: 4 }}>تم إغلاق الطلب من قبل المنسق</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
