import { useEffect, useRef } from 'react';

/* Generalizes the old DeliveryNotePreviewModal — renders a document
 * template in an in-app iframe, never window.open. It loads `src` and
 * fills it through the page's own window[fillName](data) (delivery note:
 * setDeliveryData, maintenance report: setMaintenanceReportData),
 * re-filling whenever data changes so edits show up live. onLayout gets
 * window[layoutName]() after each fill. */
export default function PDFPreview({ src, data, onLayout, onClose,
  fillName = 'setDeliveryData', layoutName = 'getDeliveryLayout' }) {
  const frameRef = useRef(null);
  const open = !!src;

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const fill = async () => {
    const win = frameRef.current?.contentWindow;
    if (!src || !win || typeof win[fillName] !== 'function') return;
    await win[fillName](data);
    if (onLayout && typeof win[layoutName] === 'function') onLayout(win[layoutName]());
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
        <iframe ref={frameRef} title="Document Preview" src={src} onLoad={fill} className="dn-preview-iframe" />
      </div>
    </div>
  );
}
