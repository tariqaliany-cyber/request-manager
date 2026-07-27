import { useState, useEffect, useRef } from 'react';
import { createRequest, getRequestListItems, getRequestById, compressImage, STATUS, formatDate } from '../storage';
import { BRANCHES } from '../branchData';
import PhotoLightbox from '../components/PhotoLightbox';

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

/* ── Helper ─────────────────────────────────────────── */
function getBranchInfo(num) {
  return BRANCHES.find(b => b.num === String(num)) || null;
}

/* ── Branch Dropdown ────────────────────────────────── */
function BranchDropdown({ value, onChange, onMapsFill, hasError }) {
  const [query, setQuery] = useState(value ? `Herfy ${value}` : '');
  const [open, setOpen]   = useState(false);
  const wrapRef = useRef();

  const filtered = query.length >= 1
    ? BRANCHES.filter(b =>
        b.label.toLowerCase().includes(query.toLowerCase()) ||
        b.num.startsWith(query) ||
        b.area.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50)
    : BRANCHES.slice(0, 50);

  const pick = (b) => {
    setQuery(b.label);
    setOpen(false);
    onChange(b.num);
    if (onMapsFill) onMapsFill(b.mapsUrl || '');
  };

  const handleInput = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    onChange('');
  };

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        className={`input ${hasError ? 'input-error' : ''}`}
        type="text"
        placeholder="Search branch / ابحث عن الفرع (e.g. 105 or Riyadh)"
        value={query}
        onChange={handleInput}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 999, top: '100%', left: 0, right: 0,
          background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: 220, overflowY: 'auto',
          marginTop: 4,
        }}>
          {filtered.map(b => (
            <div key={b.num}
              onMouseDown={() => pick(b)}
              style={{
                padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9',
                fontSize: 14,
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}
            >
              <div style={{ fontWeight: 700 }}>{b.label}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{b.area} — {b.address}</div>
            </div>
          ))}
        </div>
      )}
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
    const compressed = await Promise.all([...files].map(compressImage));
    setPhotos(p => [...p, ...compressed]);
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
        <label className="label">Herfy Branch <span>/ فرع هرفي</span> *</label>
        <BranchDropdown
          value={branch}
          onChange={(num) => { setBranch(num); setErrors(v => ({ ...v, branch: '' })); }}
          onMapsFill={(url) => setLocation(url)}
          hasError={!!errors.branch}
        />
        {errors.branch && <div className="error-msg">{errors.branch}</div>}
        {branch && getBranchInfo(branch) && (
          <div className="note-box note-box-green mt8" style={{ fontSize: 13 }}>
            📍 {getBranchInfo(branch).area} — {getBranchInfo(branch).address}
          </div>
        )}
      </div>

      <div className="form-group">
        <label className="label">Google Maps Link <span>/ رابط خرائط جوجل (اختياري)</span></label>
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
          <div className="photo-upload-sub">Add as many photos as needed / أضف بقدر ما تحتاج</div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden
          onChange={e => addPhotos(e.target.files)} />
        {photos.length > 0 && (
          <div className="photo-grid mt8">
            {photos.map((src, i) => (
              <div key={i} className="photo-thumb">
                <img src={src} alt="" decoding="async" />
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

/* ── Progress Bar ───────────────────────────────────── */
function ProgressBar({ value, large }) {
  const pct   = Math.min(100, Math.max(0, Number(value) || 0));
  const color = pct >= 95 ? '#15803D' : pct >= 51 ? '#22C55E' : pct >= 26 ? '#EAB308' : '#EF4444';
  const trackH = large ? 14 : 8;
  return (
    <div style={{ marginBottom: large ? 0 : 10, marginTop: large ? 0 : 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
        <span style={{ fontSize: large ? 13 : 11, fontWeight: 700, color: '#475569' }}>
          {large ? 'نسبة الإنجاز / Completion' : 'Progress'}
        </span>
        <span style={{
          fontSize: large ? 14 : 11, fontWeight: 800, color,
          background: color + '18', borderRadius: 20,
          padding: large ? '2px 10px' : '1px 7px',
        }}>
          {pct}%
        </span>
      </div>
      <div style={{ background: '#E2E8F0', borderRadius: 99, height: trackH, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: pct >= 95
            ? 'linear-gradient(90deg,#15803D,#16A34A)'
            : pct >= 51
            ? 'linear-gradient(90deg,#16A34A,#4ADE80)'
            : pct >= 26
            ? 'linear-gradient(90deg,#CA8A04,#EAB308)'
            : 'linear-gradient(90deg,#DC2626,#EF4444)',
          borderRadius: 99,
          transition: 'width .4s ease',
        }} />
      </div>
      {large && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginTop: 4 }}>
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      )}
    </div>
  );
}

/* ── Request List ───────────────────────────────────── */
function EssaRequestList() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setRequests(await getRequestListItems({ createdBy: 'essa' }));
    if (!silent) setLoading(false);
  };

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), 15000);
    return () => clearInterval(id);
  }, []);

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
                {(() => { const info = getBranchInfo(req.branchNumber); return <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>📍 {info ? info.area : 'Location: Not specified'}</div>; })()}
              </div>
              <span className="badge" style={{ color: s.color, background: s.bg }}>
                <span className="badge-dot" />{s.ar}
              </span>
            </div>
            <div className="card-desc">{req.problemDescription}</div>
            <ProgressBar value={req.progressPercentage ?? 0} />
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

/* ── Request Detail (view-only) ─────────────────────── */
function EssaRequestDetail({ req, onBack }) {
  const [fresh, setFresh]   = useState(req);
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    const fetch = () => getRequestById(req.id).then(found => {
      if (found) setFresh(found);
    });
    fetch();
    const id = setInterval(fetch, 15000);
    return () => clearInterval(id);
  }, [req.id]);

  const s = STATUS[fresh.status];

  return (
    <div className="card">
      {lightbox && <PhotoLightbox photos={lightbox.photos} startIndex={lightbox.index} onClose={() => setLightbox(null)} />}
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

      <div className="section-title">Progress / التقدم</div>
      <ProgressBar value={fresh.progressPercentage ?? 0} large />

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
          <div className="section-title">Before Photos / صور ما قبل العمل</div>
          <div className="photo-grid">
            {fresh.problemPhotos.map((src, i) => (
              <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: fresh.problemPhotos, index: i })}>
                <img src={src} alt="" decoding="async" />
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

      <div className="section-title">Completion Photos / صور الإنجاز</div>
      {fresh.showCompletionPhotosToEssa && fresh.completionPhotos?.length > 0 ? (
        <div className="photo-grid">
          {fresh.completionPhotos.map((src, i) => (
            <div key={i} className="photo-thumb" style={{ cursor: 'pointer' }} onClick={() => setLightbox({ photos: fresh.completionPhotos, index: i })}>
              <img src={src} alt="" decoding="async" />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: 'var(--gray-400)', background: '#f8fafc', borderRadius: 8, padding: '14px 16px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
          Completion photos are not available yet.
          <div style={{ fontSize: 12, marginTop: 4 }}>لم يتم رفع صور الإنجاز بعد</div>
        </div>
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
