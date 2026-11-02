import { useState, useEffect, useMemo } from 'react';
import {
  getDeliveryNotesByRequest, createDeliveryNote, updateDeliveryNote, deleteDeliveryNote,
  logActivity, DELIVERY_NOTE_STATUS, formatDate,
} from '../storage';
import { getBranchInfo } from '../branchData';
import { buildDeliveryData, exportDeliveryNotePdf, DELIVERY_TEMPLATE_URL } from '../generateDeliveryNote';
import { SkuPicker, SkuBrowser } from '../components/SkuPicker';
import StatusBadge from '../components/StatusBadge';
import ConfirmationDialog from '../components/ConfirmationDialog';
import PDFPreview from '../components/PDFPreview';

const newKey = () => Math.random().toString(36).slice(2);
const emptyRow = () => ({
  key: newKey(), itemNo: '', description: '', unit: '', qty: 1, remarks: '', serial: '',
  itemName: '', isCustom: false,
});
const decimalUnits = new Set(['m', 'm²']);
// A row counts as "filled" once it has either a picked item number, or —
// for custom rows, where the item number is optional — a name/description.
const rowHasContent = (r) => r.isCustom ? !!(r.itemName || r.description) : !!r.itemNo;

/* ── Card shown inside the request detail: list + create button ──── */
export function DeliveryNoteCard({ req, user, onOpen }) {
  const [notes, setNotes]     = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getDeliveryNotesByRequest(req.id).then(n => { if (!cancelled) { setNotes(n); setLoading(false); } });
    return () => { cancelled = true; };
  }, [req.id]);

  return (
    <div className="card">
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Delivery Notes / إشعارات استلام</div>
      <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 14 }}>Acknowledgment of completed work, no prices — for Herfy submission</div>

      {loading ? (
        <div style={{ fontSize: 13, color: 'var(--gray-400)' }}>Loading…</div>
      ) : notes.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 14 }}>No delivery notes yet / لا يوجد إشعارات استلام بعد</div>
      ) : notes.map(n => {
        const s = DELIVERY_NOTE_STATUS[n.status];
        return (
          <div key={n.id} className="dn-list-item" onClick={() => onOpen(n)}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{n.number}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>{formatDate(n.createdAt)} · {n.createdBy || '—'}</div>
            </div>
            <StatusBadge status={s} />
          </div>
        );
      })}

      <button className="btn btn-primary-tariq mt8" onClick={() => onOpen('new')}>
        ＋ Create Delivery Note / إنشاء إشعار استلام
      </button>
    </div>
  );
}

/* ── Full create/edit form ────────────────────────────────────────── */
// Desktop: form on one side, the approved item list (src/skuData.js) always
// open beside it. Phones: the same blocks stacked.
export function DeliveryNoteForm({ req, user, note, onBack }) {
  const branchInfo = getBranchInfo(req.branchNumber);
  const branchNumber   = req.branchNumber;
  const branchName     = branchInfo?.label || '';
  const branchLocation = branchInfo?.address || branchInfo?.location || '';
  const cityRegion     = branchInfo?.area || '';
  const requestDate    = formatDate(req.createdAt);

  const existing = note !== 'new' ? note : null;

  const [savedId, setSavedId]         = useState(existing?.id || null);
  const [number, setNumber]           = useState(existing?.number || null);
  const [createdBy, setCreatedByVal]  = useState(existing?.createdBy || user.username);
  const [createdAt, setCreatedAt]     = useState(existing?.createdAt || null);
  const [status, setStatus]           = useState(existing?.status || 'draft');
  const [wrpNumber, setWrp]           = useState(existing?.wrpNumber || req.id);
  const [completionDate, setComp]     = useState(existing?.completionDate || '');
  const [items, setItems]             = useState(
    existing?.items?.length ? existing.items.map(it => ({ ...it, key: newKey() })) : [emptyRow()]
  );
  const [generalRemarks, setRemarks]  = useState(existing?.generalRemarks || '');
  const [technicianName, setTechnician] = useState(existing?.technicianName || '');
  const [recipientName, setRecipient]   = useState(existing?.recipientName || '');

  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [layout, setLayout] = useState(null);
  const [justAdded, setJustAdded] = useState(null);

  const isSaved = savedId != null;
  const hasItems = items.some(rowHasContent);

  const addItem       = () => setItems(rows => [...rows, emptyRow()]);
  const removeItem     = key => setItems(rows => rows.length > 1 ? rows.filter(r => r.key !== key) : [emptyRow()]);
  const duplicateItem = key => setItems(rows => {
    const idx = rows.findIndex(r => r.key === key);
    if (idx === -1) return rows;
    return [...rows.slice(0, idx + 1), { ...rows[idx], key: newKey() }, ...rows.slice(idx + 1)];
  });
  // Picking an item fills its number and description exactly as in the file.
  const fillSku = (r, sku) => ({ ...r, itemNo: sku.itemNo, description: sku.description, isCustom: false, itemName: '' });
  const selectSku = (key, sku) => setItems(rows => rows.map(r => r.key === key ? fillSku(r, sku) : r));
  // From the side list: fill the first empty row, or add a new one.
  const addFromList = (sku) => {
    const target = items.find(r => !rowHasContent(r));
    const key = target ? target.key : newKey();
    setItems(rows => target
      ? rows.map(r => r.key === key ? fillSku(r, sku) : r)
      : [...rows, fillSku({ ...emptyRow(), key }, sku)]);
    setJustAdded(key);
    setTimeout(() => setJustAdded(k => (k === key ? null : k)), 1500);
  };
  const startCustomItem = (key, prefillName) => setItems(rows => rows.map(r => r.key === key
    ? { ...r, isCustom: true, itemNo: '', itemName: prefillName || '', description: '' }
    : r));
  const backToList = (key) => setItems(rows => rows.map(r => r.key === key
    ? { ...r, isCustom: false, itemNo: '', itemName: '', description: '' }
    : r));
  const updateItemField = (key, field, value) => setItems(rows => rows.map(r => r.key === key ? { ...r, [field]: value } : r));

  const buildPayload = () => ({
    requestId: req.id,
    status,
    branchNumber, branchName, branchLocation,
    requestDate, completionDate,
    wrpNumber,
    items: items.filter(rowHasContent).map(({ key, ...rest }) => rest),
    generalRemarks,
    technicianName, recipientName,
  });

  const [saveError, setSaveError] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaveError(false);
    let ok = false;
    const wasSigned = existing?.status === 'signed';
    if (!isSaved) {
      const created = await createDeliveryNote({ ...buildPayload(), createdBy: user.username });
      if (created) {
        setSavedId(created.id);
        setNumber(created.number);
        setCreatedAt(created.createdAt);
        setCreatedByVal(created.createdBy);
        ok = true;
        logActivity({ requestId: req.id, action: 'dn_created', actor: user.name, actorRole: user.role, detail: created.number });
      }
    } else {
      const updated = await updateDeliveryNote(savedId, buildPayload());
      ok = !!updated;
      if (ok && status === 'signed' && !wasSigned) {
        logActivity({ requestId: req.id, action: 'dn_signed', actor: user.name, actorRole: user.role, detail: number });
      }
    }
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } else {
      setSaveError(true);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    await deleteDeliveryNote(savedId);
    onBack();
  };

  // What the template shows — rebuilt only when an edited field changes,
  // so the open preview re-fills live as the form is edited.
  const deliveryData = useMemo(() => buildDeliveryData({
    number,
    wrpNumber, branchNumber, branchLocation,
    completionDate,
    items: items.filter(rowHasContent),
    generalRemarks, technicianName, recipientName,
  }), [number, wrpNumber, branchNumber, branchLocation, completionDate, items, generalRemarks, technicianName, recipientName]);

  const doPreview = () => setPreviewOpen(true);
  const doExport = async () => {
    if (!hasItems) return;
    setExporting(true);
    await exportDeliveryNotePdf(deliveryData);
    setExporting(false);
  };

  // Filled by the preview from the template's getDeliveryLayout().
  const layoutIssues = layout ? [
    layout.pageCount > 1 && `ℹ️ The note continues onto ${layout.pageCount} pages / السند ${layout.pageCount} صفحات`,
    layout.overflow && '⚠️ One section is taller than a full page / قسم أطول من صفحة كاملة',
  ].filter(Boolean) : [];

  const usedItemNos = useMemo(() => items.filter(r => !r.isCustom && r.itemNo).map(r => r.itemNo), [items]);
  const s = DELIVERY_NOTE_STATUS[status];

  return (
    <div>
      <PDFPreview src={previewOpen ? DELIVERY_TEMPLATE_URL : null} data={deliveryData}
        onLayout={setLayout} onClose={() => setPreviewOpen(false)} />

      <button className="back-btn mb16" onClick={onBack}>← Back to Delivery Notes / رجوع للإشعارات</button>

      <div className="dn-layout">
        <div className="dn-main">
          {/* Header + details */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div className="card-id">DELIVERY NOTE / إشعار استلام</div>
                <div className="card-branch">{number || '(assigned on save)'}</div>
                {isSaved && <div className="card-date mt4">Created {formatDate(createdAt)} by {createdBy}</div>}
              </div>
              <StatusBadge status={s} />
            </div>

            <div className="section-title">Request Info (locked) / بيانات الطلب</div>
            <div className="dn-info-grid">
              <div className="dn-info-cell"><div className="info-label">Request Number</div><div className="info-value">{req.id}</div></div>
              <div className="dn-info-cell"><div className="info-label">Branch</div><div className="info-value">Herfy {branchNumber}{branchName && branchName !== `Herfy ${branchNumber}` ? ` · ${branchName}` : ''}</div></div>
              <div className="dn-info-cell"><div className="info-label">City / Region</div><div className="info-value">{cityRegion || '—'}</div></div>
              <div className="dn-info-cell"><div className="info-label">Branch Location</div><div className="info-value">{branchLocation || '—'}</div></div>
              <div className="dn-info-cell"><div className="info-label">Request Date</div><div className="info-value">{requestDate}</div></div>
            </div>

            <div className="section-title">Editable Details / بيانات قابلة للتعديل</div>
            <div className="dn-fields">
              <div className="form-group">
                <label className="label">Ticket Number <span>/ رقم التذكرة</span></label>
                <input className="input" value={wrpNumber} onChange={e => setWrp(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Completion Date <span>/ تاريخ الإنجاز</span></label>
                <input className="input" type="date" value={completionDate} onChange={e => setComp(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Service Technician <span>/ الفني المسؤول</span></label>
                <input className="input" value={technicianName} onChange={e => setTechnician(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="label">Recipient <span>/ المستلم</span></label>
                <input className="input" value={recipientName} onChange={e => setRecipient(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card">
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Items / البنود</div>
            <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 14 }}>
              Pick from the approved list — the item number and description fill in automatically. No rates or prices.
            </div>

            <div className="dn-rows">
              {items.map((row, i) => (
                <div key={row.key} className={`dn-row${justAdded === row.key ? ' dn-row-flash' : ''}`}>
                  <div className="dn-row-head">
                    <span className="dn-row-index">{i + 1}</span>
                    <div className="dn-row-pick">
                      {row.isCustom ? (
                        <div className="dn-custom-name-row">
                          <input className="input" placeholder="Custom item name / اسم البند" value={row.itemName}
                            onChange={e => updateItemField(row.key, 'itemName', e.target.value)} />
                          <button type="button" className="dn-icon-btn" title="Pick from the approved list instead" onClick={() => backToList(row.key)}>🔍</button>
                        </div>
                      ) : (
                        <SkuPicker value={row.itemNo} onSelect={sku => selectSku(row.key, sku)}
                          onCreateCustom={name => startCustomItem(row.key, name)} />
                      )}
                    </div>
                    <div className="dn-row-actions">
                      <button type="button" className="dn-icon-btn" title="Duplicate" onClick={() => duplicateItem(row.key)}>⧉</button>
                      <button type="button" className="dn-icon-btn dn-icon-btn-danger" title="Remove" onClick={() => removeItem(row.key)}>✕</button>
                    </div>
                  </div>

                  {row.isCustom ? (
                    <div className="dn-row-fields">
                      <label className="dn-mini">Item No. <span>/ رقم البند</span>
                        <input className="input" placeholder="Optional" value={row.itemNo} onChange={e => updateItemField(row.key, 'itemNo', e.target.value)} />
                      </label>
                      <label className="dn-mini dn-mini-wide">Description <span>/ الوصف</span>
                        <input className="input" value={row.description} onChange={e => updateItemField(row.key, 'description', e.target.value)} />
                      </label>
                    </div>
                  ) : rowHasContent(row) && (
                    <div className="dn-row-chosen">
                      <span className="sku-row-no">{row.itemNo}</span>
                      <span>{row.description}</span>
                    </div>
                  )}

                  <div className="dn-row-fields">
                    <label className="dn-mini">Qty <span>/ العدد</span>
                      <input className="input" type="number"
                        min={decimalUnits.has(row.unit) ? 0.01 : 1}
                        step={decimalUnits.has(row.unit) ? 0.01 : 1}
                        value={row.qty} onChange={e => updateItemField(row.key, 'qty', e.target.value)} />
                    </label>
                    <label className="dn-mini">Unit <span>/ الوحدة</span>
                      <input className="input" value={row.unit || ''} onChange={e => updateItemField(row.key, 'unit', e.target.value)} />
                    </label>
                    <label className="dn-mini">Serial No. <span>/ الرقم التسلسلي</span>
                      <input className="input" value={row.serial || ''} onChange={e => updateItemField(row.key, 'serial', e.target.value)} />
                    </label>
                    <label className="dn-mini dn-mini-wide">Remarks <span>/ ملاحظات</span>
                      <input className="input" value={row.remarks || ''} onChange={e => updateItemField(row.key, 'remarks', e.target.value)} />
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="btn btn-outline mt12" onClick={addItem}>＋ Add Item / إضافة بند</button>
          </div>

          {/* Report + confirmation */}
          <div className="card">
            <div className="form-group">
              <label className="label">Technician Report <span>/ تقرير الفني</span></label>
              <textarea className="textarea" rows={3} value={generalRemarks} onChange={e => setRemarks(e.target.value)} />
            </div>
            <div className="note-box note-box-blue" style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div className="ar-rtl" style={{ marginBottom: 8 }}>أقرّ باستلام الجهاز والملحقات الموضحة أعلاه.</div>
              <div>I acknowledge receipt of the equipment and accessories listed above.</div>
            </div>
          </div>

          {/* Status + actions */}
          <div className="card">
            <div className="form-group">
              <label className="label">Status / الحالة</label>
              <select className="select" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="draft">Draft / مسودة</option>
                <option value="ready_for_signature">Ready for Signature / جاهز للتوقيع</option>
                <option value="signed">Signed / موقّع</option>
                <option value="cancelled">Cancelled / ملغى</option>
              </select>
            </div>

            <button className="btn btn-primary-tariq mb8" onClick={save} disabled={saving}>
              {saved ? '✅ Saved!' : saving ? 'Saving...' : isSaved ? '💾 Update Delivery Note / تحديث الإشعار' : '💾 Save Draft / حفظ كمسودة'}
            </button>
            {saveError && <div className="error-msg" style={{ textAlign: 'center', marginTop: -4, marginBottom: 8 }}>Save failed — check your connection (or that the delivery_notes table has been created) and try again / فشل الحفظ</div>}
            <button className="btn btn-outline mb8" onClick={doPreview}>👁 Preview / معاينة</button>
            <button
              className="btn mb8"
              style={{ background: '#1e293b', color: '#fff', border: 'none' }}
              onClick={doExport}
              disabled={exporting || !hasItems}>
              {exporting ? '⏳ Generating PDF...' : '📄 Export PDF / تصدير PDF'}
            </button>
            {layoutIssues.length > 0 && (
              <div className="note-box note-box-amber" style={{ fontSize: 13, marginBottom: 8 }}>
                {layoutIssues.map(t => <div key={t}>{t}</div>)}
              </div>
            )}
            {!hasItems && <div className="error-msg" style={{ textAlign: 'center', marginTop: -4, marginBottom: 8 }}>Add at least one item before exporting / أضف بندًا واحدًا على الأقل قبل التصدير</div>}

            {isSaved && (
              <ConfirmationDialog
                pending={confirmDel}
                onRequestConfirm={() => setConfirmDel(true)}
                onConfirm={handleDelete}
                onCancel={() => setConfirmDel(false)}
                triggerLabel="🗑️ Delete Delivery Note / حذف الإشعار"
                busy={saving}
              />
            )}
          </div>
        </div>

        <aside className="dn-side card">
          <SkuBrowser usedItemNos={usedItemNos} onPick={addFromList} />
        </aside>
      </div>
    </div>
  );
}
