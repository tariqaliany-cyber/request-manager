import { useState, useEffect, useRef } from 'react';
import { createRequest, getRequests, compressImage, STATUS, formatDate } from '../storage';

export default function EssaView({ user, onLogout }) {
  const [tab, setTab] = useState('new');

  return (
    <div>
      <header className="header header-essa">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/herfy-logo.png" alt="Herfy" style={{ height: 36, width: 'auto', display: 'block' }} />
          <div>
            <div className="header-title">Maintenance / صيانة</div>
            <div className="header-sub">Welcome, {user.nameAr} · {user.name}</div>
          </div>
        </div>
        <div className="header-right">
          <button className="btn-logout" onClick={onLogout}>Logout</button>
        </div>
      </header>

      <div className="page">
        <div className="tabs mt16">
          <button className={`tab-btn ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>
            ➕ New Request <span style={{fontSize:11}}>/ طلب جديد</span>
          </button>
          <button className={`tab-btn ${tab === 'requests' ? 'active' : ''}`} onClick={() => setTab('requests')}>
            📋 My Requests <span style={{fontSize:11}}>/ طلباتي</span>
          </button>
        </div>

        {tab === 'new'      && <EssaNewRequest onSubmit={() => setTab('requests')} />}
        {tab === 'requests' && <EssaRequestList />}
      </div>
    </div>
  );
}

/* ── New Request Form ───────────────────────────────── */
function EssaNewRequest({ onSubmit }) {
  const [branch, setBranch]     = useState('');
  const [location, setLocation] = useState('');
  const [desc, setDesc]         = useState('');
  const [photos, setPhotos]     = useState([]);
  const [errors, setErrors]     = useState({});
  const [saving, setSaving]     = useState(false);
  const [done, setDone]         = useState(false);
  const fileRef = useRef();

  const addPhotos = async (files) => {
    const compressed = await Promise.all([...files].slice(0, 6).map(compressImage));
    setPhotos(p => [...p, ...compressed].slice(0, 6));
  };

  const validate = () => {
    const e = {};
    if (!branch.trim()) e.branch = 'Required / مطلوب';
    if (!desc.trim())   e.desc   = 'Required / مطلوب';
    return e;
  };

  const submit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setSaving(true);
    await createRequest({
      branchNumber: branch.trim(),
      locationLink: location.trim(),
      problemDescription: desc.trim(),
      problemPhotos: photos,
      createdBy: 'essa',
    });
    setSaving(false);
    setDone(true);
    setTimeout(() => { setDone(false); onSubmit(); }, 1800);
  };

  if (done) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Request Submitted!</div>
        <div style={{ fontSize: 15, color: 'var(--gray-600)', marginTop: 6 }}>تم إرسال الطلب بنجاح</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 20 }}>
        New Maintenance Request
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-400)', marginTop: 3 }}>طلب صيانة جديد</div>
      </div>

      <div className="form-group">
        <label className="label">Herfy Number <span>/ رقم هرفي</span> *</label>
        <input
          className={`input ${errors.branch ? 'input-error' : ''}`}
          type="text"
          placeholder="e.g. 105"
          value={branch}
          onChange={e => { setBranch(e.target.value); setErrors(v => ({ ...v, branch: '' })); }}
        />
        {errors.branch && <div className="error-msg">{errors.branch}</div>}
      </div>

      <div className="form-group">
        <label className="label">Location / Google Maps Link <span>/ رابط الموقع (اختياري)</span></label>
        <input
          className="input"
          type="url"
          placeholder="https://maps.google.com/..."
          value={location}
          onChange={e => setLocation(e.target.value)}
        />
      </div>

      <div className="form-group">
        <label className="label">Problem Description <span>/ وصف المشكلة</span> *</label>
        <textarea
          className={`textarea ${errors.desc ? 'input-error' : ''}`}
          placeholder="Describe the problem clearly... / صف المشكلة بوضوح..."
          value={desc}
          onChange={e => { setDesc(e.target.value); setErrors(v => ({ ...v, desc: '' })); }}
          rows={4}
        />
        {errors.desc && <div className="error-msg">{errors.desc}</div>}
      </div>

      <div className="form-group">
        <label className="label">Photos <span>/ صور المشكلة (اختياري)</span></label>
        <div className="photo-upload-area" onClick={() => fileRef.current.click()}>
          <div className="photo-upload-icon">📷</div>
          <div className="photo-upload-text">Tap to add photos / اضغط لإضافة صور</div>
          <div className="photo-upload-sub">Max 6 photos</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={e => addPhotos(e.target.files)} />
        {photos.length > 0 && (
          <div className="photo-grid mt8">
            {photos.map((src, i) => (
              <div key={i} className="photo-thumb">
                <img src={src} alt="" />
                <button className="photo-remove" onClick={() => setPhotos(p => p.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-primary-essa" onClick={submit} disabled={saving}>
        {saving ? 'Sending... / جاري الإرسال...' : '📤 Submit Request / إرسال الطلب'}
      </button>
    </div>
  );
}

/* ── Request List ───────────────────────────────────── */
function EssaRequestList() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    const all = await getRequests();
    setRequests(all.filter(r => r.createdBy === 'essa'));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (selected) {
    return <EssaRequestDetail req={selected} onBack={() => { setSelected(null); load(); }} />;
  }

  if (loading) return <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>;

  if (requests.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📭</div>
        <div className="empty-title">No requests yet</div>
        <div className="empty-sub">لا يوجد طلبات حتى الآن</div>
      </div>
    );
  }

  return (
    <div>
      {requests.map(req => {
        const s = STATUS[req.status];
        return (
          <div key={req.id} className="card card-clickable" onClick={() => setSelected(req)}>
            <div className="card-header">
              <div>
                <div className="card-id">{req.id}</div>
                <div className="card-branch">Herfy {req.branchNumber}</div>
              </div>
              <span className="badge" style={{ color: s.color, background: s.bg }}>
                <span className="badge-dot" />{s.ar}
              </span>
            </div>
            <div className="card-desc">{req.problemDescription}</div>
            <div className="card-footer">
              <span className="card-date">{formatDate(req.createdAt)}</span>
              <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Tap for details ›</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Request Detail ─────────────────────────────────── */
function EssaRequestDetail({ req, onBack }) {
  const [fresh, setFresh] = useState(req);

  useEffect(() => {
    getRequests().then(all => {
      const found = all.find(r => r.id === req.id);
      if (found) setFresh(found);
    });
  }, [req.id]);

  const s = STATUS[fresh.status];

  return (
    <div className="card">
      <button className="back-btn mb16" onClick={onBack} style={{ color: '#64748B' }}>
        ← Back / رجوع
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="card-id">{fresh.id}</div>
          <div className="card-branch">Herfy {fresh.branchNumber}</div>
        </div>
        <span className="badge" style={{ color: s.color, background: s.bg }}>
          <span className="badge-dot" />{s.ar}
        </span>
      </div>

      <div className="section-title">Status / الحالة</div>
      <div style={{ borderRadius: 10, padding: '16px', textAlign: 'center', background: s.bg, color: s.color }}>
        <div style={{ fontSize: 24, fontWeight: 900 }}>{s.ar}</div>
        <div style={{ fontSize: 14, marginTop: 4, opacity: .8 }}>{s.en}</div>
      </div>

      {fresh.locationLink && (
        <>
          <div className="section-title">Location / الموقع</div>
          <a className="info-link" href={fresh.locationLink} target="_blank" rel="noopener noreferrer">
            📍 Open in Maps / فتح في الخريطة
          </a>
        </>
      )}

      <div className="section-title">Problem / المشكلة</div>
      <div style={{ fontSize: 15, lineHeight: 1.6 }}>{fresh.problemDescription}</div>

      {fresh.problemPhotos?.length > 0 && (
        <>
          <div className="section-title">Photos / الصور</div>
          <div className="photo-grid">
            {fresh.problemPhotos.map((src, i) => (
              <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => window.open(src)}>
                <img src={src} alt="" />
              </div>
            ))}
          </div>
        </>
      )}

      {fresh.notesToEssa && (
        <>
          <div className="section-title">Update / تحديث</div>
          <div className="note-box note-box-blue">{fresh.notesToEssa}</div>
        </>
      )}

      {fresh.showWorkDoneToEssa && fresh.workDone && (
        <>
          <div className="section-title">Work Completed / العمل المنجز</div>
          <div className="note-box note-box-green">{fresh.workDone}</div>
        </>
      )}

      {fresh.showCompletionPhotosToEssa && fresh.completionPhotos?.length > 0 && (
        <>
          <div className="section-title">Completion Photos / صور الإنجاز</div>
          <div className="photo-grid">
            {fresh.completionPhotos.map((src, i) => (
              <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => window.open(src)}>
                <img src={src} alt="" />
              </div>
            ))}
          </div>
        </>
      )}

      {fresh.finalSummary && (
        <>
          <div className="section-title">Summary / الملخص</div>
          <div className="note-box note-box-green">{fresh.finalSummary}</div>
        </>
      )}

      <div className="card-date" style={{ marginTop: 20 }}>Submitted: {formatDate(fresh.createdAt)}</div>
    </div>
  );
}
