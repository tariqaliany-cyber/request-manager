import { useState, useEffect } from 'react';
import {
  getDeliveryNotesByRequest, createDeliveryNote, updateDeliveryNote, deleteDeliveryNote,
  getBoqLibraryItems, createBoqLibraryItem,
  DELIVERY_NOTE_STATUS, formatDate,
} from '../storage';
import { getBranchInfo } from '../branchData';
import { generateDeliveryNotePdf, buildDeliveryNoteHtml } from '../generateDeliveryNote';
import BoqItemPicker from '../components/BoqItemPicker';
import StatusBadge from '../components/StatusBadge';
import ConfirmationDialog from '../components/ConfirmationDialog';
import PDFPreview from '../components/PDFPreview';

const newKey = () => Math.random().toString(36).slice(2);
const emptyRow = () => ({
  key: newKey(), itemNo: '', category: '', description: '', unit: '', qty: 1, remarks: '',
  itemName: '', isCustom: false, savedToLibrary: false,
});
const decimalUnits = new Set(['m', 'm²']);
// A row counts as "filled" once it has either a picked BOQ item number, or —
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
  const [libraryItems, setLibraryItems] = useState([]);

  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [previewHtml, setPreviewHtml] = useState(null);

  useEffect(() => {
    getBoqLibraryItems().then(setLibraryItems);
  }, []);

  const isSaved = savedId != null;
  const hasItems = items.some(rowHasContent);

  const addItem       = () => setItems(rows => [...rows, emptyRow()]);
  const removeItem     = key => setItems(rows => rows.length > 1 ? rows.filter(r => r.key !== key) : rows);
  const duplicateItem = key => setItems(rows => {
    const idx = rows.findIndex(r => r.key === key);
    if (idx === -1) return rows;
    return [...rows.slice(0, idx + 1), { ...rows[idx], key: newKey() }, ...rows.slice(idx + 1)];
  });
  const selectBoqItem = (key, boqItem) => setItems(rows => rows.map(r => r.key === key
    ? { ...r, itemNo: boqItem.itemNo, category: boqItem.category, description: boqItem.description, unit: boqItem.unit, qty: 1, isCustom: false, itemName: '', savedToLibrary: false }
    : r));
  const startCustomItem = (key, prefillName) => setItems(rows => rows.map(r => r.key === key
    ? { ...r, isCustom: true, itemNo: '', category: 'Custom', itemName: prefillName || '', description: '', unit: '', qty: 1, savedToLibrary: false }
    : r));
  const useBoqSearch = (key) => setItems(rows => rows.map(r => r.key === key
    ? { ...r, isCustom: false, itemNo: '', category: '', itemName: '', description: '', unit: '', savedToLibrary: false }
    : r));
  const updateItemField = (key, field, value) => setItems(rows => rows.map(r => r.key === key ? { ...r, [field]: value } : r));

  const [savingLibraryKey, setSavingLibraryKey] = useState(null);
  const [libraryError, setLibraryError] = useState(false);
  const saveRowToLibrary = async (key) => {
    const row = items.find(r => r.key === key);
    if (!row) return;
    setSavingLibraryKey(key);
    setLibraryError(false);
    const saved = await createBoqLibraryItem({
      itemNo: row.itemNo,
      category: 'Custom',
      description: [row.itemName, row.description].filter(Boolean).join(' — '),
      unit: row.unit,
      createdBy: user.username,
    });
    setSavingLibraryKey(null);
    if (saved) {
      setLibraryItems(prev => [saved, ...prev]);
      setItems(rows => rows.map(r => r.key === key ? { ...r, savedToLibrary: true } : r));
    } else {
      setLibraryError(true);
    }
  };

  const buildPayload = () => ({
    requestId: req.id,
    status,
    branchNumber, branchName, branchLocation,
    requestDate, completionDate,
    wrpNumber,
    items: items.filter(rowHasContent).map(({ key, ...rest }) => rest),
    generalRemarks,
  });

  const [saveError, setSaveError] = useState(false);

  const save = async () => {
    setSaving(true);
    setSaveError(false);
    let ok = false;
    if (!isSaved) {
      const created = await createDeliveryNote({ ...buildPayload(), createdBy: user.username });
      if (created) {
        setSavedId(created.id);
        setNumber(created.number);
        setCreatedAt(created.createdAt);
        setCreatedByVal(created.createdBy);
        ok = true;
      }
    } else {
      const updated = await updateDeliveryNote(savedId, buildPayload());
      ok = !!updated;
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

  const noteForPdf = () => ({
    number: number || '(unsaved draft)',
    requestNumber: req.id,
    wrpNumber, branchNumber, branchName, branchLocation, cityRegion,
    requestDate, completionDate,
    items: items.filter(rowHasContent),
    generalRemarks,
  });

  const doPreview = () => setPreviewHtml(buildDeliveryNoteHtml(noteForPdf(), { print: false }));
  const doExport = async () => {
    if (!hasItems) return;
    setExporting(true);
    await generateDeliveryNotePdf(noteForPdf(), { print: true });
    setExporting(false);
  };

  const s = DELIVERY_NOTE_STATUS[status];

  return (
    <div>
      <PDFPreview html={previewHtml} onClose={() => setPreviewHtml(null)} />

      <button className="back-btn mb16" onClick={onBack}>← Back to Request / رجوع</button>

      {/* Header info */}
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
          <div className="dn-info-cell"><div className="info-label">Branch Number</div><div className="info-value">Herfy {branchNumber}</div></div>
          <div className="dn-info-cell"><div className="info-label">Branch Name</div><div className="info-value">{branchName || '—'}</div></div>
          <div className="dn-info-cell"><div className="info-label">City / Region</div><div className="info-value">{cityRegion || '—'}</div></div>
          <div className="dn-info-cell" style={{ gridColumn: '1 / -1' }}><div className="info-label">Branch Location</div><div className="info-value">{branchLocation || '—'}</div></div>
          <div className="dn-info-cell"><div className="info-label">Request Date</div><div className="info-value">{requestDate}</div></div>
        </div>

        <div className="section-title">Editable Details / بيانات قابلة للتعديل</div>
        <div className="form-group">
          <label className="label">Ticket Number <span>/ رقم التذكرة</span></label>
          <input className="input" value={wrpNumber} onChange={e => setWrp(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">Completion Date <span>/ تاريخ الإنجاز</span></label>
          <input className="input" type="date" value={completionDate} onChange={e => setComp(e.target.value)} />
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>BOQ Items / بنود الأعمال</div>
        <div style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 14 }}>No rates, prices, or totals — acknowledgment of completed work only</div>

        <div className="dn-table-wrap">
          <table className="dn-items-table">
            <thead>
              <tr>
                <th>#</th>
                <th>BOQ Item</th>
                <th>Description</th>
                <th>Unit</th>
                <th>Qty</th>
                <th>Remarks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <tr key={row.key}>
                  {row.isCustom ? (
                    <>
                      <td className="dn-col-no">
                        <input className="input" placeholder="Optional" value={row.itemNo} onChange={e => updateItemField(row.key, 'itemNo', e.target.value)} />
                      </td>
                      <td className="dn-col-picker">
                        <div className="dn-custom-name-row">
                          <input className="input" placeholder="Item Name / اسم البند" value={row.itemName} onChange={e => updateItemField(row.key, 'itemName', e.target.value)} />
                          <button type="button" className="dn-icon-btn" title="Search BOQ list instead" onClick={() => useBoqSearch(row.key)}>🔍</button>
                        </div>
                      </td>
                      <td className="dn-col-desc">
                        <input className="input" placeholder="Description / الوصف" value={row.description} onChange={e => updateItemField(row.key, 'description', e.target.value)} />
                      </td>
                      <td className="dn-col-unit">
                        <input className="input" placeholder="Unit" value={row.unit} onChange={e => updateItemField(row.key, 'unit', e.target.value)} />
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="dn-col-no">{row.itemNo || '—'}</td>
                      <td className="dn-col-picker">
                        <BoqItemPicker
                          value={row.itemNo ? `${row.itemNo} – ${row.description}` : ''}
                          onSelect={item => selectBoqItem(row.key, item)}
                          onCreateCustom={name => startCustomItem(row.key, name)}
                          libraryItems={libraryItems}
                        />
                      </td>
                      <td className="dn-col-desc">{row.description || '—'}</td>
                      <td className="dn-col-unit">{row.unit || '—'}</td>
                    </>
                  )}
                  <td className="dn-col-qty">
                    <input
                      className="input" type="number"
                      min={decimalUnits.has(row.unit) ? 0.01 : 1}
                      step={decimalUnits.has(row.unit) ? 0.01 : 1}
                      value={row.qty}
                      onChange={e => updateItemField(row.key, 'qty', e.target.value)}
                    />
                  </td>
                  <td className="dn-col-remarks">
                    <input className="input" value={row.remarks} onChange={e => updateItemField(row.key, 'remarks', e.target.value)} />
                  </td>
                  <td className="dn-col-actions">
                    {row.isCustom && (
                      row.savedToLibrary
                        ? <span className="dn-icon-btn dn-icon-btn-saved" title="Saved to BOQ Library">✓</span>
                        : <button type="button" className="dn-icon-btn" title="Save to BOQ Library / حفظ في مكتبة البنود"
                            disabled={!rowHasContent(row) || savingLibraryKey === row.key}
                            onClick={() => saveRowToLibrary(row.key)}>
                            {savingLibraryKey === row.key ? '⏳' : '💾'}
                          </button>
                    )}
                    <button type="button" className="dn-icon-btn" title="Duplicate" onClick={() => duplicateItem(row.key)}>⧉</button>
                    <button type="button" className="dn-icon-btn dn-icon-btn-danger" title="Remove" onClick={() => removeItem(row.key)}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" className="btn btn-outline mt12" onClick={addItem}>＋ Add Item / إضافة بند</button>
        {libraryError && <div className="error-msg" style={{ textAlign: 'center', marginTop: 8 }}>Failed to save to BOQ Library — check your connection (or that the boq_library_items table has been created) / فشل الحفظ في المكتبة</div>}
      </div>

      {/* Remarks + confirmation */}
      <div className="card">
        <div className="form-group">
          <label className="label">General Remarks <span>/ ملاحظات عامة</span></label>
          <textarea className="textarea" rows={3} value={generalRemarks} onChange={e => setRemarks(e.target.value)} />
        </div>
        <div className="note-box note-box-blue" style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div className="ar-rtl" style={{ marginBottom: 8 }}>
            نقر نحن الموقعين أدناه بأن الأعمال الموضحة أعلاه قد تم تنفيذها وتسليمها للموقع، وتم استلامها وفقاً للبنود والكميات المذكورة في هذا الإشعار.
          </div>
          <div>
            We, the undersigned, confirm that the works described above have been completed and delivered to the site and have been received according to the items and quantities stated in this Delivery Note.
          </div>
        </div>

        <div className="dn-stamp-heading">
          <div className="ar-rtl">استلام وختم هرفي</div>
          <div>HERFY RECEIPT, SIGNATURE &amp; STAMP</div>
        </div>
        <div className="dn-stamp-box" />
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
        {!hasItems && <div className="error-msg" style={{ textAlign: 'center', marginTop: -4, marginBottom: 8 }}>Add at least one BOQ item before exporting / أضف بندًا واحدًا على الأقل قبل التصدير</div>}

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
  );
}
