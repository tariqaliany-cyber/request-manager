import { useEffect, useRef } from 'react';

/* Generalizes the old DeliveryNotePreviewModal — renders a generated
 * document in an in-app iframe, never window.open. Two modes:
 *   html            → srcDoc (service report)
 *   src + data      → loads a template page and fills it through its
 *                     window.setDeliveryData(data); re-fills whenever
 *                     data changes, so edits show up live. onLayout gets
 *                     the template's getDeliveryLayout() after each fill. */
export default function PDFPreview({ html, src, data, onLayout, onClose }) {
  const frameRef = useRef(null);
  const open = !!(html || src);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const fill = async () => {
    const win = frameRef.current?.contentWindow;
    if (!src || !win || typeof win.setDeliveryData !== 'function') return;
    await win.setDeliveryData(data);
    if (onLayout && typeof win.getDeliveryLayout === 'function') onLayout(win.getDeliveryLayout());
  };

  useEffect(() => { fill(); }, [data]);

  if (!open) return null;

  return (
    <div className="dn-preview-overlay" onClick={onClose}>
      <div className="dn-preview-sheet" onClick={e => e.stopPropagation()}>
        <div className="dn-preview-bar">
          <span>Preview / معاينة</span>
          <button type="button" className="dn-icon-btn" onClick={onClose}>✕</button>
        </div>
        {src
          ? <iframe ref={frameRef} title="Document Preview" src={src} onLoad={fill} className="dn-preview-iframe" />
          : <iframe title="Document Preview" srcDoc={html} className="dn-preview-iframe" />}
      </div>
    </div>
  );
}
