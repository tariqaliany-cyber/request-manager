import { useState, useEffect } from 'react';
import {
  getRequestById, updateRequest, deleteRequest, compressImage, canManageDeliveryNotes,
  STATUS, PRIORITY, PAYMENT_STATUS, formatDate, logActivity,
} from '../storage';
import { generateServiceReportPdf, buildServiceReportHtml } from '../generateReport';
import { getBranchInfo } from '../branchData';
import { DeliveryNoteCard, DeliveryNoteForm } from './DeliveryNoteSection';
import PhotoGallery from '../components/PhotoGallery';
import StatusBadge from '../components/StatusBadge';
import ConfirmationDialog from '../components/ConfirmationDialog';
import PDFPreview from '../components/PDFPreview';
import ActivityTimeline from '../components/ActivityTimeline';
import GenerateDocumentMenu from '../components/GenerateDocumentMenu';

function formatSAR(amount) {
  const n = Number(amount);
  if (isNaN(n)) return null;
  return 'SAR ' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TABS = [
  { key: 'overview', label: 'Overview / نظرة عامة' },
  { key: 'report',   label: 'Report / التقرير' },
  { key: 'photos',   label: 'Photos / الصور' },
  { key: 'delivery', label: 'Delivery Note / إشعار الاستلام' },
  { key: 'financial',label: 'Financial / مالي' },
  { key: 'activity', label: 'Activity / النشاط' },
];

export default function TariqRequestDetail({ req, user, onClose }) {
  const [activeTab, setActiveTab]     = useState('overview');
  const [dnOpen, setDnOpen]           = useState(null); // null | 'new' | delivery note object
  const [fresh, setFresh]             = useState(req);
  const [status, setStatus]           = useState(req.status);
  const [priority, setPriority]       = useState(req.priority || 'normal');
  const [assignedTo, setAssignedTo]   = useState(req.assignedTo || '');
  const [finalSummary, setSummary]    = useState(req.finalSummary || '');
  const [uploadingType, setUploadingType] = useState(null); // null | 'problem' | 'progress' | 'completion'
  const [showWorkDone, setShowWork]   = useState(req.showWorkDoneToEssa || false);
  const [showCompletion, setShowComp] = useState(req.showCompletionPhotosToEssa || false);
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [saveError, setSaveError]     = useState('');
  const [completing, setCompleting]   = useState(false);
  const [branch, setBranch]           = useState(req.branchNumber);
  const [location, setLocation]       = useState(req.locationLink || '');
  const [desc, setDesc]               = useState(req.problemDescription || '');
  const [confirmDel, setConfirmDel]   = useState(false);
  const [exporting, setExporting]     = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [invoiceAmount, setInvoiceAmt]    = useState(req.invoiceAmount ?? '');
  const [progressPercentage, setProgress] = useState(req.progressPercentage ?? 0);
  const [paymentStatus, setPaymentStatus] = useState(req.paymentStatus || 'unpaid');
  const [paymentDate, setPaymentDate]     = useState(req.paymentDate || '');
  const [accountingNote, setAccountingNote] = useState(req.internalAccountingNote || '');
  const [dueDate, setDueDate]             = useState(req.dueDate || '');

  useEffect(() => {
    getRequestById(req.id).then(found => {
      if (found) {
        setFresh(found);
        setStatus(found.status);
        setPriority(found.priority || 'normal');
        setAssignedTo(found.assignedTo || '');
        setSummary(found.finalSummary || '');
        setShowWork(found.showWorkDoneToEssa || false);
        setShowComp(found.showCompletionPhotosToEssa || false);
        setInvoiceAmt(found.invoiceAmount ?? '');
        setProgress(found.progressPercentage ?? 0);
        setPaymentStatus(found.paymentStatus || 'unpaid');
        setPaymentDate(found.paymentDate || '');
        setAccountingNote(found.internalAccountingNote || '');
        setDueDate(found.dueDate || '');
      }
    });
  }, [req.id]);

  const save = async () => {
    setSaving(true);
    setSaveError('');
    const pct = Math.min(100, Math.max(0, Number(progressPercentage) || 0));
    const statusChanged   = status !== fresh.status;
    const assignedChanged = (assignedTo || null) !== (fresh.assignedTo || null);
    const updated = await updateRequest(fresh.id, {
      status,
      priority,
      branchNumber:               branch.trim(),
      locationLink:               location.trim(),
      problemDescription:         desc.trim(),
      assignedTo:                 assignedTo || null,
      finalSummary,
      showWorkDoneToEssa:         showWorkDone,
      showCompletionPhotosToEssa: showCompletion,
      invoiceAmount:              invoiceAmount !== '' ? parseFloat(invoiceAmount) : null,
      progressPercentage:         pct,
      paymentStatus,
      paymentDate:                paymentDate || null,
      internalAccountingNote:     accountingNote,
      dueDate:                    dueDate || null,
    });
    setSaving(false);
    if (updated) {
      if (statusChanged) {
        logActivity({ requestId: fresh.id, action: 'status_changed', actor: user.name, actorRole: user.role,
          detail: `${STATUS[fresh.status]?.en || fresh.status} → ${STATUS[status]?.en || status}` });
      }
      if (assignedChanged) {
        logActivity({ requestId: fresh.id, action: 'assigned_changed', actor: user.name, actorRole: user.role,
          detail: assignedTo ? `Assigned to ${assignedTo}` : 'Unassigned' });
      }
      setFresh(updated);
      setProgress(updated.progressPercentage ?? 0);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setSaveError('❌ Save failed. Open browser console (F12) for details.');
    }
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
    if (fresh.status !== 'completed') {
      logActivity({ requestId: fresh.id, action: 'status_changed', actor: user.name, actorRole: user.role,
        detail: `${STATUS[fresh.status]?.en || fresh.status} → ${STATUS.completed.en}` });
    }
    setStatus('completed');
    setCompleting(false);
  };

  const PHOTO_FIELD = { problem: 'problemPhotos', progress: 'progressPhotos', completion: 'completionPhotos' };

  const uploadPhotos = async (type, files) => {
    setUploadingType(type);
    const compressed = await Promise.all(files.map(async f => ({ url: await compressImage(f), caption: '' })));
    const next = [...(fresh[PHOTO_FIELD[type]] || []), ...compressed];
    const updated = await updateRequest(fresh.id, { [PHOTO_FIELD[type]]: next });
    if (updated) setFresh(updated);
    setUploadingType(null);
  };

  const deletePhotoAt = async (type, idx) => {
    const next = (fresh[PHOTO_FIELD[type]] || []).filter((_, i) => i !== idx);
    const updated = await updateRequest(fresh.id, { [PHOTO_FIELD[type]]: next });
    if (updated) setFresh(updated);
  };

  const reorderPhoto = async (type, from, to) => {
    const arr = [...(fresh[PHOTO_FIELD[type]] || [])];
    if (to < 0 || to >= arr.length) return;
    [arr[from], arr[to]] = [arr[to], arr[from]];
    const updated = await updateRequest(fresh.id, { [PHOTO_FIELD[type]]: arr });
    if (updated) setFresh(updated);
  };

  const updatePhotoCaption = async (type, idx, caption) => {
    const arr = (fresh[PHOTO_FIELD[type]] || []).map((p, i) => i === idx ? { ...p, caption } : p);
    const updated = await updateRequest(fresh.id, { [PHOTO_FIELD[type]]: arr });
    if (updated) setFresh(updated);
  };

  if (dnOpen) {
    return <DeliveryNoteForm req={fresh} user={user} note={dnOpen} onBack={() => setDnOpen(null)} />;
  }

  const photoCount = (fresh.problemPhotos?.length || 0) + (fresh.progressPhotos?.length || 0) + (fresh.completionPhotos?.length || 0);

  const docMenuItems = [
    { label: '👁 Preview Report / معاينة التقرير', onClick: () => setPreviewHtml(buildServiceReportHtml(fresh, { print: false })) },
    { label: '📄 Export Report PDF / تصدير تقرير PDF', onClick: async () => { setExporting(true); await generateServiceReportPdf(fresh); setExporting(false); } },
    { label: '📋 Go to Delivery Note / إشعار الاستلام', onClick: () => setActiveTab('delivery'), disabled: !canManageDeliveryNotes(user) },
  ];

  return (
    <div>
      <PDFPreview html={previewHtml} onClose={() => setPreviewHtml(null)} />

      {/* Sticky request header */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div className="card-id">{fresh.id}</div>
            <div className="card-branch">Herfy {fresh.branchNumber}</div>
            <div className="card-date mt4">Created {formatDate(fresh.createdAt)}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <StatusBadge status={STATUS[status]} />
              <StatusBadge status={PRIORITY[priority]} />
            </div>
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

        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-400)', marginBottom: 4 }}>
            <span>Progress / نسبة التقدم</span><span>{progressPercentage}%</span>
          </div>
          <div style={{ background: '#F1F5F9', borderRadius: 8, height: 8, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progressPercentage}%`,
              background: progressPercentage >= 95 ? '#15803D' : progressPercentage >= 51 ? '#22C55E' : progressPercentage >= 26 ? '#EAB308' : '#EF4444',
              borderRadius: 8, transition: 'width .3s ease',
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <GenerateDocumentMenu items={docMenuItems} />
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs tabs-wide">
        {TABS.map(t => (
          <button key={t.key} className={`tab-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
            {t.label}
            {t.key === 'photos' && photoCount > 0 && <span style={{ opacity: .6, marginLeft: 4 }}>({photoCount})</span>}
          </button>
        ))}
      </div>

      {/* ══ Overview ══ */}
      {activeTab === 'overview' && (
        <div className="detail-grid">
          <div className="detail-col">
            <div className="card">
              {getBranchInfo(fresh.branchNumber) && (() => {
                const info = getBranchInfo(fresh.branchNumber);
                return (
                  <div className="note-box note-box-green" style={{ marginTop: 0 }}>
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

              <div className="section-title">Core Info / البيانات الأساسية</div>
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
            </div>

            <div className="card">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">📋 Final Summary <span>/ الملخص النهائي (visible to client)</span></label>
                <textarea className="textarea" placeholder="Write a final summary..."
                  value={finalSummary} onChange={e => setSummary(e.target.value)} rows={4} />
              </div>
            </div>
          </div>

          <div className="detail-col">
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
                <label className="label">Priority / الأولوية</label>
                <select className="select" value={priority} onChange={e => setPriority(e.target.value)}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.en} / {v.ar}</option>)}
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
                <label className="label">Due Date / تاريخ الاستحقاق</label>
                <input className="input" type="date" value={dueDate ? dueDate.substring(0, 10) : ''} onChange={e => setDueDate(e.target.value)} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="label">📊 Progress / نسبة التقدم <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400 }}>— visible to client</span></label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    className="input" type="number" min="0" max="100" step="5" placeholder="0"
                    value={progressPercentage}
                    onChange={e => setProgress(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--tariq-color)', minWidth: 40 }}>{progressPercentage}%</span>
                </div>
              </div>
            </div>

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

            <div className="card">
              <button className="btn btn-primary-tariq mb8" onClick={save} disabled={saving}>
                {saved ? '✅ Saved!' : saving ? 'Saving...' : '💾 Save Changes / حفظ التغييرات'}
              </button>
              {saveError && (
                <div style={{ marginBottom: 8, padding: '10px 14px', background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10, fontSize: 12, color: '#DC2626', lineHeight: 1.5 }}>
                  {saveError}
                </div>
              )}
              {status !== 'completed'
                ? <button className="btn btn-primary-green mb8" onClick={markComplete} disabled={completing}>
                    {completing ? '...' : '✅ Mark as Completed / إغلاق الطلب كمنجز'}
                  </button>
                : <div style={{ textAlign: 'center', padding: '12px', color: '#16A34A', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                    ✅ This request is completed / تم إغلاق هذا الطلب
                  </div>
              }
              <ConfirmationDialog
                pending={confirmDel}
                onRequestConfirm={() => setConfirmDel(true)}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDel(false)}
                triggerLabel="🗑️ Delete Request / حذف الطلب"
                busy={saving}
              />
            </div>
          </div>
        </div>
      )}

      {/* ══ Report ══ */}
      {activeTab === 'report' && (
        <div className="card">
          {fresh.majedComments?.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 0 }}>Technician Comments / تعليقات الفني</div>
              {fresh.majedComments.map((c, i) => (
                <div key={i} className="comment-item">
                  <div className="comment-text">👷 {c.text}</div>
                  <div className="comment-time">{formatDate(c.time)}</div>
                </div>
              ))}
            </>
          )}
          {fresh.workDone ? (
            <>
              <div className="section-title">Work Performed / العمل المنجز</div>
              <div className="note-box note-box-green">{fresh.workDone}</div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--gray-400)', marginTop: fresh.majedComments?.length ? 16 : 0 }}>
              No work report submitted yet / لم يتم إرسال تقرير العمل بعد
            </div>
          )}
        </div>
      )}

      {/* ══ Photos ══ */}
      {activeTab === 'photos' && (
        <div className="card">
          <PhotoGallery
            title="Before Photos" titleAr="صور ما قبل العمل"
            photos={fresh.problemPhotos} editable
            uploading={uploadingType === 'problem'}
            onUpload={files => uploadPhotos('problem', files)}
            onDelete={i => deletePhotoAt('problem', i)}
            onReorder={(from, to) => reorderPhoto('problem', from, to)}
            onCaptionChange={(i, caption) => updatePhotoCaption('problem', i, caption)}
          />
          <div style={{ height: 20 }} />
          <PhotoGallery
            title="Progress Photos" titleAr="صور أثناء العمل"
            photos={fresh.progressPhotos} editable
            collapsible defaultCollapsed={!fresh.progressPhotos?.length}
            uploading={uploadingType === 'progress'}
            onUpload={files => uploadPhotos('progress', files)}
            onDelete={i => deletePhotoAt('progress', i)}
            onReorder={(from, to) => reorderPhoto('progress', from, to)}
            onCaptionChange={(i, caption) => updatePhotoCaption('progress', i, caption)}
          />
          <div style={{ height: 20 }} />
          <PhotoGallery
            title="After Photos" titleAr="صور بعد الإنجاز"
            photos={fresh.completionPhotos} editable
            uploading={uploadingType === 'completion'}
            onUpload={files => uploadPhotos('completion', files)}
            onDelete={i => deletePhotoAt('completion', i)}
            onReorder={(from, to) => reorderPhoto('completion', from, to)}
            onCaptionChange={(i, caption) => updatePhotoCaption('completion', i, caption)}
          />
        </div>
      )}

      {/* ══ Delivery Note ══ */}
      {activeTab === 'delivery' && (
        canManageDeliveryNotes(user)
          ? <DeliveryNoteCard req={fresh} user={user} onOpen={setDnOpen} />
          : <div className="card"><div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Not available for this account.</div></div>
      )}

      {/* ══ Financial ══ */}
      {activeTab === 'financial' && (
        <div className="card">
          <div className="form-group">
            <label className="label">💰 Invoice Amount / قيمة الفاتورة</label>
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <span style={{ padding: '0 12px', fontSize: 13, fontWeight: 700, color: '#64748B', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRight: 'none', borderRadius: '10px 0 0 10px', display: 'flex', alignItems: 'center' }}>SAR</span>
              <input
                className="input" type="number" step="0.01" min="0" placeholder="0.00"
                value={invoiceAmount} onChange={e => setInvoiceAmt(e.target.value)}
                style={{ borderRadius: '0 10px 10px 0', borderLeft: 'none', flex: 1 }}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="label">Payment Status / حالة الدفع</label>
            <select className="select" value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)}>
              {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.en} / {v.ar}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="label">Payment Date / تاريخ الدفع</label>
            <input className="input" type="date" value={paymentDate ? paymentDate.substring(0, 10) : ''} onChange={e => setPaymentDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="label">Internal Accounting Note <span>/ ملاحظة محاسبية داخلية — admin only</span></label>
            <textarea className="textarea" rows={3} value={accountingNote} onChange={e => setAccountingNote(e.target.value)} />
          </div>
          <button className="btn btn-primary-tariq mt16" onClick={save} disabled={saving}>
            {saved ? '✅ Saved!' : saving ? 'Saving...' : '💾 Save Changes / حفظ التغييرات'}
          </button>
        </div>
      )}

      {/* ══ Activity ══ */}
      {activeTab === 'activity' && (
        <div className="card">
          <ActivityTimeline requestId={fresh.id} />
        </div>
      )}
    </div>
  );
}
