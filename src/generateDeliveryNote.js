// ── Delivery Note (bilingual Altasis template) ──────────────────
// The document itself is a static page, public/delivery-note/template.html,
// built to match Altasis-Delivery-Bilingual.pdf. The app never edits that
// file: it loads it (in the Preview iframe, or a print window for Export)
// and fills it through the page's own window.setDeliveryData(data).
// Native browser print is kept so Arabic is shaped and RTL-rendered by the
// browser engine, same as the maintenance report (src/generateMaintenanceReport.js).

import { ADDRESS_AR } from './branchDataAr';

export const DELIVERY_TEMPLATE_URL = '/delivery-note/template.html';

// Custom items keep a short "item name" and a longer "description" as
// separate fields (see DeliveryNoteSection.jsx) — the template's item
// column has one main line, so combine them there.
function itemDescription(it) {
  if (it.isCustom) return [it.itemName, it.description].filter(Boolean).join(' — ');
  return it.description || '';
}

const join = (...parts) => parts.filter(Boolean).join('');

// Names are typed once. The English sub-line only repeats a name written
// in Latin letters, so an Arabic name isn't printed twice.
const latinOnly = (s) => (s && !/[؀-ۿ]/.test(s) ? s : '');

// Maps a delivery note (as edited in DeliveryNoteForm) to the template's
// fields. Anything empty in the note stays empty in the document.
export function buildDeliveryData(note) {
  const branchNo = note.branchNumber ? String(note.branchNumber) : '';
  const location = note.branchLocation || '';
  const locationAr = ADDRESS_AR[location] || location;
  const qty = (it) => [it.qty, it.unit].filter(v => v !== '' && v != null).join(' ');

  return {
    deliveryNo:   note.number || '',
    workOrder:    note.wrpNumber || '',
    deliveryDate: note.completionDate || '',
    partyAr: branchNo ? join(`هرفي ${branchNo}`, locationAr && `   /   ${locationAr}`) : '',
    partyEn: branchNo ? join(`Herfy ${branchNo}`, location && `  /  ${location}`) : '',
    technicianAr: note.technicianName || '',
    technicianEn: latinOnly(note.technicianName),
    items: (note.items || []).map(it => ({
      descAr: itemDescription(it),
      descEn: it.remarks || '',
      serial: it.serial || '',
      qty:    qty(it),
    })),
    reportAr: note.generalRemarks || '',
    reportEn: '',
    recipientAr: note.recipientName || '',
    recipientEn: latinOnly(note.recipientName),
    fileName: join('Delivery-Note', note.number && `_${note.number}`, branchNo && `_${branchNo}`),
  };
}

// Export PDF — opens the template in a print window, fills it, then calls
// window.print() so the user can save it as a PDF.
export async function exportDeliveryNotePdf(data) {
  const win = window.open(DELIVERY_TEMPLATE_URL, '_blank', 'width=820,height=1000,menubar=yes,toolbar=yes');
  if (!win) {
    alert('Pop-up blocked — please allow pop-ups for this site and try again.');
    return;
  }
  // The new window starts on about:blank, so wait for the template itself.
  const ready = await new Promise(resolve => {
    const started = Date.now();
    const tick = () => {
      if (win.closed) return resolve(false);
      if (typeof win.setDeliveryData === 'function' && win.document.readyState === 'complete') return resolve(true);
      if (Date.now() - started > 15000) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
  if (!ready) return;
  await win.setDeliveryData(data);
  setTimeout(() => { win.focus(); win.print(); }, 250);
}
