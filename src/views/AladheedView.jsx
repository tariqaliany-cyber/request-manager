import { useState, useEffect, useRef } from 'react';
import { getRequests, formatDate } from '../storage';
import { BRANCHES } from '../branchData';

/* ── Document type config ─────────────────────────── */
const DOC_TYPES = {
  invoice:         { label: 'Invoice',               ar: 'فاتورة',              icon: '🧾', required: true,  color: '#7C3AED', bg: '#F5F3FF' },
  completion_pics: { label: 'Completion Pics',       ar: 'صور الإنجاز',          icon: '📸', required: true,  color: '#0369A1', bg: '#EFF6FF' },
  work_receiving:  { label: 'Work Receiving Paper',  ar: 'ورقة استلام الأعمال',  icon: '📋', required: true,  color: '#047857', bg: '#F0FDF4' },
  other:           { label: 'Other',                 ar: 'أخرى',                icon: '📎', required: false, color: '#64748B', bg: '#F8FAFC' },
};

/* ── localStorage session ─────────────────────────── */
const sKey = id => `aladheed_${id}`;
const loadSession = id => { try { return JSON.parse(localStorage.getItem(sKey(id))); } catch { return null; } };
const saveSession = (id, data) => localStorage.setItem(sKey(id), JSON.stringify(data));

/* ── File auto-classification ─────────────────────── */
function classifyFile(name) {
  const n = name.toLowerCase();
  if (/invoice|inv\b|فاتورة|bill|billing/.test(n)) return 'invoice';
  if (/photo|pic|completion|complete|صور|إنجاز|finish|done/.test(n)) return 'completion_pics';
  if (/receiv|استلام|work.?order|work.?receiv|استلام.?اعمال/.test(n)) return 'work_receiving';
  return 'unknown';
}

/* ── Email defaults ───────────────────────────────── */
function defaultSubject(job) {
  return `Submission of Completion Documents – Herfy Branch ${job.branchNumber}`;
}
function defaultBody(job) {
  const b = BRANCHES.find(b => b.num === String(job.branchNumber));
  return `Dear [Recipient Name],

Please find attached the completion documents for Herfy Branch ${job.branchNumber}${b ? ` (${b.area})` : ''}.

The attached documents include:
1. Invoice
2. Sample Completion Pictures
3. Work Receiving Paper

Kindly review the attached documents and confirm if any further information is required.

Best regards,
Tariq Alalyani`;
}

/* ── File download ────────────────────────────────── */
function downloadBase64(name, dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ── Branch label helper ──────────────────────────── */
function branchLabel(job) {
  const b = BRANCHES.find(b => b.num === String(job.branchNumber));
  return b ? `Herfy ${job.branchNumber} – ${b.area}` : `Herfy ${job.branchNumber}`;
}

/* ── Completion Pics PDF ──────────────────────────── */
function printCompletionPics(job, photos) {
  if (!photos.length) return;
  const label = branchLabel(job);
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to generate PDF.'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Completion Photos – ${label}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
.hdr{border-bottom:3px solid #0F172A;padding-bottom:16px;margin-bottom:24px;text-align:center}
.hdr h1{font-size:18px;font-weight:bold}.hdr p{font-size:12px;color:#64748b;margin-top:3px}
.meta{display:flex;gap:24px;justify-content:center;margin-top:10px;flex-wrap:wrap}
.mi{font-size:11px}.ml{color:#64748b}.mv{font-weight:bold}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
.pb{break-inside:avoid;page-break-inside:avoid}
.pb img{width:100%;height:200px;object-fit:cover;border:1px solid #e2e8f0;border-radius:4px;display:block}
.pc{font-size:10px;color:#64748b;text-align:center;margin-top:3px}
@media print{body{padding:12px}}
</style></head><body>
<div class="hdr">
  <h1>Sample Completion Photos / صور الإنجاز</h1>
  <p>Work Completion Documentation</p>
  <div class="meta">
    <div class="mi"><span class="ml">Branch: </span><span class="mv">${label}</span></div>
    <div class="mi"><span class="ml">Request #: </span><span class="mv">${job.id}</span></div>
    <div class="mi"><span class="ml">Date: </span><span class="mv">${new Date().toLocaleDateString('en-GB')}</span></div>
    <div class="mi"><span class="ml">Total: </span><span class="mv">${photos.length} photos</span></div>
  </div>
</div>
<div class="grid">${photos.map((src, i) => `<div class="pb"><img src="${src}" alt="Photo ${i + 1}"/><div class="pc">Photo ${i + 1} / ${photos.length}</div></div>`).join('')}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`);
  win.document.close();
}

/* ── Work Receiving Paper PDF ─────────────────────── */
function printWorkReceiving(job) {
  const label = branchLabel(job);
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to generate PDF.'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Work Receiving Paper – ${label}</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;padding:40px;color:#1e293b;max-width:740px;margin:auto;font-size:13px}
.title{font-size:18px;font-weight:bold;text-align:center;border:2px solid #0F172A;padding:12px;margin-bottom:24px}
.title-ar{font-size:14px;color:#334155;margin-top:4px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
.ibox{border:1px solid #e2e8f0;padding:10px 14px;border-radius:6px}
.il{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.iv{font-size:14px;font-weight:bold;margin-top:3px}
.stitle{font-size:11px;font-weight:bold;background:#f1f5f9;padding:7px 12px;margin:18px 0 10px;border-left:3px solid #0F172A;text-transform:uppercase;letter-spacing:.5px}
.desc{font-size:13px;line-height:1.7;padding:8px 0}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#0F172A;color:#fff;padding:8px 12px;text-align:left;font-weight:600}
td{border:1px solid #e2e8f0;padding:8px 12px}
tr:nth-child(even) td{background:#f8fafc}
.confirm{margin-top:20px;border:1px solid #e2e8f0;padding:14px;border-radius:6px;font-size:12px;line-height:1.8}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}
.sb{border-top:1.5px solid #334155;padding-top:10px;font-size:12px;color:#64748b}
.sn{font-size:13px;font-weight:bold;color:#1e293b;margin-bottom:4px}
.sl{display:block;margin-top:28px}
@media print{body{padding:24px}}
</style></head><body>
<div class="title">Work Receiving Paper<div class="title-ar">ورقة استلام الأعمال</div></div>
<div class="grid2">
  <div class="ibox"><div class="il">Customer / العميل</div><div class="iv">Herfy Restaurant Co.</div></div>
  <div class="ibox"><div class="il">Branch / الفرع</div><div class="iv">${label}</div></div>
  <div class="ibox"><div class="il">Request Number / رقم الطلب</div><div class="iv">${job.id}</div></div>
  <div class="ibox"><div class="il">Date / التاريخ</div><div class="iv">${new Date().toLocaleDateString('en-GB')}</div></div>
</div>
<div class="stitle">Work Description / وصف العمل</div>
<div class="desc">${job.problemDescription || '—'}</div>
${job.workDone ? `<div class="stitle">Work Completed / العمل المنجز</div><div class="desc">${job.workDone}</div>` : ''}
<div class="stitle">Services Performed / الخدمات المنجزة</div>
<p style="font-size:11px;color:#64748b;margin-bottom:8px">* Excludes transportation, crane, and external support charges / لا تشمل رسوم النقل والرافعات والدعم الخارجي</p>
<table>
<thead><tr><th style="width:40px">#</th><th>Service Item / البند</th><th style="width:110px">Status / الحالة</th></tr></thead>
<tbody><tr><td>1</td><td>${job.problemDescription || 'Maintenance services as per agreed scope'}</td><td>✓ Completed</td></tr></tbody>
</table>
<div class="confirm">
  We hereby confirm that the above-mentioned work has been completed satisfactorily and in full accordance with the required standards and specifications.<br/><br/>
  نؤكد بموجب هذا أن الأعمال المذكورة أعلاه قد اكتملت بشكل مُرضٍ ووفقاً للمعايير والمواصفات المطلوبة.
</div>
<div class="sig">
  <div class="sb"><div class="sn">Tariq Alalyani</div>Prepared By / أعده<span class="sl">Signature: _______________</span></div>
  <div class="sb"><div class="sn">[Client Representative]</div>Received By / استلم من<span class="sl">Signature: _______________</span></div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`);
  win.document.close();
}

/* ════════════════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════════════════ */
export default function AladheedView({ job: initialJob, onClose }) {
  const [activeJob, setActiveJob] = useState(initialJob || null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRequests().then(all => {
      setJobs(all.filter(r => r.status === 'completed'));
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      {/* ── Aladheed sticky header ── */}
      <div style={{
        background: '#0F172A', padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeJob && (
            <button onClick={() => setActiveJob(null)} style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94A3B8',
              fontSize: 13, cursor: 'pointer', padding: '5px 12px', borderRadius: 6,
            }}>
              ← Dashboard
            </button>
          )}
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>
              🦅 Aladheed | العضيد
            </div>
            <div style={{ color: '#475569', fontSize: 11 }}>AI Document & Email Assistant</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #334155', color: '#94A3B8',
          borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
        }}>
          ✕ Exit
        </button>
      </div>

      <div className="page">
        {loading
          ? <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>
          : activeJob
            ? <AladheedSession job={activeJob} onBack={() => setActiveJob(null)} />
            : <AladheedDashboard jobs={jobs} onSelectJob={setActiveJob} />
        }
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════ */
function AladheedDashboard({ jobs, onSelectJob }) {
  const withPhotos = jobs.filter(j => j.completionPhotos?.length > 0).length;
  const withEmail  = jobs.filter(j => !!loadSession(j.id)?.emailBody).length;
  const missing    = jobs.length - withPhotos;

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>📂 Document Dashboard</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>لوحة إدارة الوثائق والمراسلات</div>
      </div>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#0F172A' }}>{jobs.length}</div>
          <div className="stat-lbl">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#16A34A' }}>{withPhotos}</div>
          <div className="stat-lbl">Photos Ready</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#D97706' }}>{missing}</div>
          <div className="stat-lbl">Missing Photos</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#D4A843' }}>{withEmail}</div>
          <div className="stat-lbl">Email Ready</div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-icon">🦅</div>
          <div className="empty-title">No completed jobs yet</div>
          <div className="empty-sub">Jobs appear here once marked as completed</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: '20px 0 10px' }}>
            Completed Jobs — Tap to prepare documents
          </div>
          {jobs.map(job => {
            const hasPhotos = !!job.completionPhotos?.length;
            const session   = loadSession(job.id);
            const hasEmail  = !!session?.emailBody;
            return (
              <div key={job.id} className="card"
                style={{ cursor: 'pointer', borderLeft: '4px solid #D4A843' }}
                onClick={() => onSelectJob(job)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="card-id">{job.id}</div>
                    <div className="card-branch">Herfy {job.branchNumber}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{formatDate(job.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
                      background: hasPhotos ? '#F0FDF4' : '#FEF9C3',
                      color: hasPhotos ? '#16A34A' : '#D97706',
                    }}>
                      {hasPhotos ? '📸 Photos ✓' : '⚠️ No Photos'}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
                      background: hasEmail ? '#F0FDF4' : '#F8FAFC',
                      color: hasEmail ? '#16A34A' : '#94A3B8',
                    }}>
                      {hasEmail ? '✉️ Email ✓' : '○ Email Pending'}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 8, lineHeight: 1.5 }}>
                  {(job.problemDescription || '').substring(0, 90)}{(job.problemDescription?.length || 0) > 90 ? '…' : ''}
                </div>
                <div style={{ marginTop: 10, textAlign: 'right', fontSize: 12, color: '#D4A843', fontWeight: 700 }}>
                  🦅 Open Aladheed →
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   SESSION
════════════════════════════════════════════════════ */
function AladheedSession({ job }) {
  const [tab, setTab]                   = useState('docs');
  const [docs, setDocs]                 = useState([]);
  const [classifyModal, setClassifyModal] = useState(null);
  const [emailSubject, setEmailSubject] = useState(defaultSubject(job));
  const [emailBody, setEmailBody]       = useState(defaultBody(job));
  const [emailReady, setEmailReady]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [dragActive, setDragActive]     = useState(false);
  const fileInputRef = useRef();

  // Load saved email session
  useEffect(() => {
    const s = loadSession(job.id);
    if (s?.emailSubject) setEmailSubject(s.emailSubject);
    if (s?.emailBody)    { setEmailBody(s.emailBody); setEmailReady(true); }
  }, [job.id]);

  const completionPhotos = job.completionPhotos || [];

  // Checklist derived state
  const hasInvoice = docs.some(d => d.classification === 'invoice');
  const hasCompPics = docs.some(d => d.classification === 'completion_pics') || completionPhotos.length > 0;
  const hasWorkRec  = docs.some(d => d.classification === 'work_receiving');
  const allReady    = hasInvoice && hasCompPics && hasWorkRec;

  // Process dropped/selected files
  const processFiles = async (files) => {
    const arr = Array.from(files);
    const newDocs = await Promise.all(arr.map(async file => {
      const data = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        data,
        classification: classifyFile(file.name),
      };
    }));
    setDocs(prev => [...prev, ...newDocs]);
    const firstUnknown = newDocs.find(d => d.classification === 'unknown');
    if (firstUnknown) setClassifyModal(firstUnknown);
  };

  const removeDoc = id => setDocs(prev => prev.filter(d => d.id !== id));

  const applyClassification = (docId, cls) => {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, classification: cls } : d));
    const remaining = docs.filter(d => d.classification === 'unknown' && d.id !== docId);
    setClassifyModal(remaining[0] || null);
  };

  const prepareEmail = () => {
    saveSession(job.id, { emailSubject, emailBody });
    setEmailReady(true);
    setTab('email');
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const saveDraft = () => saveSession(job.id, { emailSubject, emailBody });

  const downloadAll = () => {
    docs.forEach((doc, i) => setTimeout(() => downloadBase64(doc.name, doc.data), i * 400));
  };

  return (
    <div>
      {/* ── Job header ── */}
      <div className="card" style={{ borderLeft: '4px solid #D4A843' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, color: '#D4A843', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              Active Aladheed Session
            </div>
            <div className="card-id">{job.id}</div>
            <div className="card-branch">Herfy {job.branchNumber}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#F0FDF4', color: '#16A34A', fontWeight: 600 }}>
              ✅ Completed
            </span>
            {completionPhotos.length > 0 && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#EFF6FF', color: '#0369A1', fontWeight: 600 }}>
                📸 {completionPhotos.length} Photos
              </span>
            )}
          </div>
        </div>
        {job.problemDescription && (
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 8, lineHeight: 1.5 }}>{job.problemDescription}</div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="tabs mt16">
        <button className={`tab-btn ${tab === 'docs' ? 'active' : ''}`} onClick={() => setTab('docs')}>
          📁 Documents
        </button>
        <button className={`tab-btn ${tab === 'email' ? 'active' : ''}`} onClick={() => setTab('email')}>
          ✉️ Email{emailReady ? ' ✓' : ''}
        </button>
      </div>

      {/* ═══════════════ DOCUMENTS TAB ═══════════════ */}
      {tab === 'docs' && (
        <div>
          {/* Checklist */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#0F172A' }}>📋 Attachment Checklist</div>
            {[
              { label: 'Invoice / فاتورة',                               ready: hasInvoice },
              { label: 'Completion Photos / صور الإنجاز',                ready: hasCompPics },
              { label: 'Work Receiving Paper / ورقة استلام الأعمال',     ready: hasWorkRec },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 18 }}>{item.ready ? '✅' : '⭕'}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: item.ready ? '#15803D' : '#64748B', flex: 1 }}>{item.label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                  background: item.ready ? '#F0FDF4' : '#FEF9C3',
                  color: item.ready ? '#16A34A' : '#D97706',
                }}>
                  {item.ready ? 'Ready' : 'Missing'}
                </span>
              </div>
            ))}
            {!allReady && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A', fontSize: 12, color: '#92400E' }}>
                ⚠️ Some required documents are missing. You can still prepare the email, but please review before sending.
              </div>
            )}
            {allReady && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0', fontSize: 12, color: '#15803D', fontWeight: 600 }}>
                ✅ All required documents are ready.
              </div>
            )}
          </div>

          {/* Drag & Drop Upload */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>📎 Upload Documents</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
              Please upload all related documents here. Aladheed will organize them and prepare the submission email.
            </div>
            <div
              style={{
                border: `2px dashed ${dragActive ? '#D4A843' : '#CBD5E1'}`,
                borderRadius: 12, padding: '28px 20px', textAlign: 'center',
                background: dragActive ? '#FFFDF0' : '#F8FAFC', cursor: 'pointer',
                transition: 'all .2s',
              }}
              onClick={() => fileInputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => { e.preventDefault(); setDragActive(false); processFiles(e.dataTransfer.files); }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>Drag & Drop files here</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>or tap to browse</div>
              <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 6 }}>PDF, JPG, PNG accepted</div>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={e => processFiles(e.target.files)} />
          </div>

          {/* Uploaded docs list */}
          {docs.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>📁 Uploaded Documents ({docs.length})</div>
                {docs.length > 1 && (
                  <button onClick={downloadAll} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                    ⬇️ Download All
                  </button>
                )}
              </div>
              {docs.map(doc => {
                const type      = DOC_TYPES[doc.classification] || DOC_TYPES.other;
                const needsCls  = doc.classification === 'unknown';
                return (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{needsCls ? '❓' : type.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{(doc.size / 1024).toFixed(0)} KB</div>
                    </div>
                    {needsCls ? (
                      <button onClick={() => setClassifyModal(doc)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1.5px solid #F59E0B', background: '#FFFBEB', color: '#D97706', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                        Classify
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: type.bg, color: type.color, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {type.icon} {type.label}
                      </span>
                    )}
                    <button onClick={() => downloadBase64(doc.name, doc.data)} title="Download" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94A3B8', flexShrink: 0 }}>⬇️</button>
                    <button onClick={() => removeDoc(doc.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#EF4444', flexShrink: 0 }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completion photos from job */}
          {completionPhotos.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>
                📸 Completion Photos
                <span style={{ fontSize: 11, fontWeight: 400, color: '#64748B', marginLeft: 8 }}>({completionPhotos.length} — from workshop)</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                These photos are linked to this job and included in the Completion Pics PDF.
              </div>
              <div className="photo-grid">
                {completionPhotos.map((src, i) => (
                  <div key={i} className="photo-thumb"><img src={src} alt="" /></div>
                ))}
              </div>
              <button className="btn mt8" style={{ background: '#0369A1', color: '#fff', border: 'none', marginTop: 12 }}
                onClick={() => printCompletionPics(job, completionPhotos)}>
                📄 Generate Completion Pics PDF
              </button>
            </div>
          )}

          {/* PDF Actions */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>📄 Generate Documents</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>Generate standard paperwork for this job.</div>

            <button className="btn mb8" style={{ background: '#047857', color: '#fff', border: 'none' }}
              onClick={() => printWorkReceiving(job)}>
              📋 Generate Work Receiving Paper PDF
            </button>

            {completionPhotos.length > 0 && (
              <button className="btn mb8" style={{ background: '#0369A1', color: '#fff', border: 'none' }}
                onClick={() => printCompletionPics(job, completionPhotos)}>
                📸 Generate Completion Pics PDF
              </button>
            )}

            {completionPhotos.length === 0 && (
              <div style={{ fontSize: 12, color: '#94A3B8', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px dashed #CBD5E1' }}>
                Completion Pics PDF requires completion photos to be uploaded by the workshop first.
              </div>
            )}
          </div>

          {/* Prepare email CTA */}
          <button className="btn" onClick={prepareEmail} style={{
            width: '100%', background: '#D4A843', color: '#0F172A',
            border: 'none', fontWeight: 800, fontSize: 15, padding: '14px',
          }}>
            ✉️ Prepare Email with Aladheed
          </button>
        </div>
      )}

      {/* ═══════════════ EMAIL TAB ═══════════════ */}
      {tab === 'email' && (
        <div>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>✉️ Email Draft</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
              Review and edit below, then copy to send from Outlook or Gmail.
            </div>

            <div className="form-group">
              <label className="label">Email Subject / عنوان البريد</label>
              <input className="input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="label">Email Body / نص البريد</label>
              <textarea
                className="textarea"
                rows={12}
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                style={{ fontFamily: 'inherit', lineHeight: 1.7 }}
              />
            </div>

            {/* Attachment list */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>📎 Attachments to Include</div>
              {[
                hasInvoice                       && { label: 'Invoice',                    icon: '🧾' },
                hasCompPics                      && { label: 'Sample Completion Photos',   icon: '📸' },
                hasWorkRec                       && { label: 'Work Receiving Paper',        icon: '📋' },
                ...docs.filter(d => d.classification === 'other').map(d => ({ label: d.name, icon: '📎' })),
              ].filter(Boolean).map((att, i) => (
                <div key={i} style={{ fontSize: 12, color: '#64748B', padding: '3px 0' }}>{att.icon} {att.label}</div>
              ))}
              {!hasInvoice && !hasCompPics && !hasWorkRec && docs.filter(d => d.classification === 'other').length === 0 && (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>No documents classified yet. Go to Documents tab to upload and classify.</div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={copyEmail} style={{
                flex: 1, background: copied ? '#16A34A' : '#0F172A',
                color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
              }}>
                {copied ? '✅ Copied!' : '📋 Copy Email'}
              </button>
              <button className="btn btn-outline" onClick={saveDraft} style={{ flex: 1 }}>
                💾 Save Draft
              </button>
            </div>
          </div>

          {/* Tip */}
          <div style={{ padding: '12px 14px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0', fontSize: 12, color: '#15803D' }}>
            💡 After copying the email, paste it into Outlook or Gmail and attach the downloaded PDF files.
          </div>
        </div>
      )}

      {/* ═══════════════ CLASSIFY MODAL ═══════════════ */}
      {classifyModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '0 20px',
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', maxWidth: 380, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>❓</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Document Type?</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 18, wordBreak: 'break-all', lineHeight: 1.5 }}>
              This file type is not clear. Please select the correct type for:<br/>
              <strong style={{ color: '#334155' }}>"{classifyModal.name}"</strong>
            </div>
            {Object.entries(DOC_TYPES).map(([key, type]) => (
              <button key={key} onClick={() => applyClassification(classifyModal.id, key)} style={{
                width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: 8,
                border: '1.5px solid #E2E8F0', borderRadius: 10, cursor: 'pointer',
                background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 22 }}>{type.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{type.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{type.ar}</div>
                </div>
              </button>
            ))}
            <button onClick={() => setClassifyModal(null)} style={{
              width: '100%', padding: '10px', background: '#F1F5F9', border: 'none',
              borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#64748B', marginTop: 4,
            }}>
              Skip / Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
