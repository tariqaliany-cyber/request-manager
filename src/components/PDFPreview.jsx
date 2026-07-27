import { useEffect } from 'react';

/* Generalizes the old DeliveryNotePreviewModal — renders any generated
 * document HTML in an in-app iframe (srcDoc), never window.open. */
export default function PDFPreview({ html, onClose }) {
  useEffect(() => {
    if (!html) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [html, onClose]);

  if (!html) return null;

  return (
    <div className="dn-preview-overlay" onClick={onClose}>
      <div className="dn-preview-sheet" onClick={e => e.stopPropagation()}>
        <div className="dn-preview-bar">
          <span>Preview / معاينة</span>
          <button type="button" className="dn-icon-btn" onClick={onClose}>✕</button>
        </div>
        <iframe title="Document Preview" srcDoc={html} className="dn-preview-iframe" />
      </div>
    </div>
  );
}
