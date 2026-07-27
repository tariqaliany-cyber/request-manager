/*
 * Generalizes the inline "trigger button -> are-you-sure box" pattern
 * previously duplicated in TariqDetail and DeliveryNoteForm. `pending`
 * (owned by the caller) toggles between the trigger and the confirm box.
 */
export default function ConfirmationDialog({ pending, onRequestConfirm, onConfirm, onCancel, triggerLabel, busy }) {
  if (!pending) {
    return (
      <button className="btn btn-outline" style={{ color: '#EF4444', borderColor: '#EF4444' }} onClick={onRequestConfirm}>
        {triggerLabel}
      </button>
    );
  }
  return (
    <div style={{ background: '#FEF2F2', borderRadius: 10, padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444', marginBottom: 10 }}>
        Are you sure? / هل أنت متأكد؟
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary-red btn-sm" onClick={onConfirm} disabled={busy}>
          {busy ? '...' : 'Yes, Delete / نعم احذف'}
        </button>
        <button className="btn btn-outline btn-sm" onClick={onCancel}>Cancel / إلغاء</button>
      </div>
    </div>
  );
}
