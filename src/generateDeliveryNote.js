// ── Delivery Note PDF generator ─────────────────────────────
// Same architecture as src/generateReport.js: native browser print
// (window.print) rather than html2canvas/jsPDF, so Arabic text is shaped
// and RTL-rendered correctly by the browser engine and no photo/rate data
// is ever pulled in — this document contains neither.

const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const STATUS_LABEL = {
  draft:               { en: 'Draft',              ar: 'مسودة' },
  ready_for_signature: { en: 'Ready for Signature', ar: 'جاهز للتوقيع' },
  signed:              { en: 'Signed',              ar: 'موقّع' },
  cancelled:            { en: 'Cancelled',           ar: 'ملغى' },
};

function infoCell(labelEn, labelAr, value) {
  return `
    <div class="dn-info-cell">
      <div class="dn-info-label">${esc(labelEn)} / <span class="ar">${esc(labelAr)}</span></div>
      <div class="dn-info-value">${value || '<span class="empty">—</span>'}</div>
    </div>`;
}

function itemRows(items) {
  return items.map((it, i) => `
    <tr>
      <td class="c-no">${i + 1}</td>
      <td class="c-item">${esc(it.itemNo)}</td>
      <td class="c-desc">${esc(it.description)}</td>
      <td class="c-unit">${esc(it.unit)}</td>
      <td class="c-qty">${esc(it.qty)}</td>
      <td class="c-remarks">${esc(it.remarks) || ''}</td>
    </tr>`).join('');
}

// Builds the self-contained HTML document (used by both the Preview modal's
// iframe and the Export PDF print window) without touching window.open.
export function buildDeliveryNoteHtml(note, { print = true } = {}) {
  const st = STATUS_LABEL[note.status] || STATUS_LABEL.draft;

  return `<!DOCTYPE html>
<html lang="ar" dir="ltr">
<head>
<meta charset="UTF-8" />
<title>Delivery-Note_${esc(note.number)}_${esc(note.branchNumber)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* Same font stack as the app's global styles.css — no separate web font,
     so Arabic and English match the rest of the interface exactly. */
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    font-size: 11.5px;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .ar { direction: rtl; unicode-bidi: embed; display: inline; }
  .ar-block { direction: rtl; text-align: right; }

  @page { size: A4 portrait; margin: 14mm 14mm 16mm; }

  .dn-wrap { width: 100%; max-width: 720px; margin: 0 auto; position: relative; }

  /* Navy / gold / white palette — specific to this document */
  :root { --navy: #0F172A; --gold: #B8860B; --gold-bg: #FDF8ED; }

  /* Header — logo only, no company-name text */
  .dn-logo { text-align: center; padding: 6px 0 18px; }
  .dn-logo img { height: 170px; width: auto; max-width: 100%; object-fit: contain; }

  .dn-title-bar {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: var(--navy); color: #fff; padding: 10px 14px; border-radius: 4px 4px 0 0;
    border-bottom: 3px solid var(--gold);
  }
  .dn-title-ar { font-size: 17px; font-weight: 800; }
  .dn-title-en { font-size: 13px; font-weight: 700; letter-spacing: 2px; margin-top: 2px; color: var(--gold); }
  .dn-status { text-align: center; font-size: 11px; font-weight: 700; padding: 4px; background: var(--gold-bg); color: var(--navy); border: 1px solid #eee0bd; border-top: none; }

  /* Info grid */
  .dn-info-grid {
    display: grid; grid-template-columns: 1fr 1fr;
    border: 1.5px solid var(--navy); border-top: none;
  }
  .dn-info-cell { padding: 6px 12px; border-bottom: 1px solid #ddd; border-right: 1px solid #ddd; }
  .dn-info-cell:nth-child(even) { border-right: none; }
  .dn-info-label { font-size: 9px; font-weight: 700; color: #666; text-transform: uppercase; letter-spacing: .3px; margin-bottom: 2px; }
  .dn-info-value { font-size: 12px; font-weight: 600; }
  .dn-info-value .empty { color: #bbb; font-weight: 400; }

  /* Section headers */
  .dn-sec-head {
    background: var(--navy); color: #fff; padding: 5px 12px;
    font-size: 11px; font-weight: 800; letter-spacing: .5px; text-transform: uppercase;
    margin-top: 14px;
  }

  /* Items table */
  table.dn-items { width: 100%; border-collapse: collapse; border: 1.5px solid var(--navy); border-top: none; }
  table.dn-items thead th {
    background: var(--gold-bg); color: var(--navy);
    font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .3px;
    padding: 6px 8px; border-bottom: 1.5px solid var(--navy); text-align: left;
  }
  table.dn-items tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e5e5; font-size: 11px; vertical-align: top; }
  table.dn-items tbody tr { break-inside: avoid; page-break-inside: avoid; }
  table.dn-items .c-no    { width: 24px; color: #888; }
  table.dn-items .c-item  { width: 46px; font-weight: 700; }
  table.dn-items .c-unit  { width: 40px; }
  table.dn-items .c-qty   { width: 44px; font-weight: 700; text-align: center; }
  table.dn-items .c-remarks { width: 22%; color: #444; }

  /* Text sections */
  .dn-text-box { border: 1.5px solid var(--navy); border-top: none; padding: 8px 12px; font-size: 11.5px; line-height: 1.6; }
  .dn-text-box .empty { color: #bbb; }

  .dn-confirm {
    margin-top: 14px; border: 1.5px solid var(--gold); background: var(--gold-bg);
    border-radius: 4px; padding: 10px 14px; font-size: 11px; line-height: 1.8;
  }
  .dn-confirm .en { margin-top: 6px; color: #333; }

  /* Herfy receipt / signature / stamp box */
  .dn-stamp-heading { text-align: center; margin-top: 16px; margin-bottom: 8px; break-inside: avoid; page-break-inside: avoid; }
  .dn-stamp-heading .ar-block { font-size: 14px; font-weight: 800; color: var(--navy); text-align: center; }
  .dn-stamp-heading .en { font-size: 12px; font-weight: 700; letter-spacing: 1.5px; color: var(--navy); margin-top: 2px; }
  .dn-stamp-box {
    border: 2px solid var(--navy); border-radius: 4px;
    height: 55mm; break-inside: avoid; page-break-inside: avoid;
  }

  /* Footer / page markers */
  .dn-footer { position: absolute; left: 0; right: 0; text-align: center; }
  .dn-footer-inner { font-size: 8px; color: #999; border-top: 1px solid #eee; padding-top: 4px; }
  .dn-footer-page { margin-top: 1px; }
</style>
</head>
<body>
<div class="dn-wrap" id="dnWrap">

  <div class="dn-logo"><img src="/altasis-logo.png" onerror="this.style.display='none'" /></div>

  <div class="dn-title-bar">
    <div class="dn-title-ar">إشعار استلام</div>
    <div class="dn-title-en">DELIVERY NOTE</div>
  </div>
  <div class="dn-status">${esc(st.en)} / <span class="ar">${esc(st.ar)}</span></div>

  <div class="dn-info-grid">
    ${infoCell('Request Number', 'رقم الطلب', esc(note.requestNumber))}
    ${infoCell('Ticket Number', 'رقم التذكرة', esc(note.wrpNumber))}
    ${infoCell('Branch Number', 'رقم الفرع', 'Herfy ' + esc(note.branchNumber))}
    ${infoCell('Branch Name', 'اسم الفرع', esc(note.branchName))}
    ${infoCell('City / Region', 'المدينة / المنطقة', esc(note.cityRegion))}
    ${infoCell('Branch Location', 'موقع الفرع', esc(note.branchLocation))}
    ${infoCell('Request Date', 'تاريخ الطلب', esc(note.requestDate))}
    ${infoCell('Completion Date', 'تاريخ الإنجاز', esc(note.completionDate))}
  </div>

  <div class="dn-sec-head">BOQ Items / بنود الأعمال المنجزة</div>
  <table class="dn-items">
    <thead>
      <tr>
        <th class="c-no">#</th>
        <th class="c-item">Item No</th>
        <th>Description</th>
        <th class="c-unit">Unit</th>
        <th class="c-qty">Qty</th>
        <th class="c-remarks">Remarks</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows(note.items)}
    </tbody>
  </table>

  <div class="dn-sec-head">General Remarks / ملاحظات عامة</div>
  <div class="dn-text-box">${note.generalRemarks ? esc(note.generalRemarks) : '<span class="empty">—</span>'}</div>

  <div class="dn-confirm">
    <div class="ar-block">نقر نحن الموقعين أدناه بأن الأعمال الموضحة أعلاه قد تم تنفيذها وتسليمها للموقع، وتم استلامها وفقاً للبنود والكميات المذكورة في هذا الإشعار.</div>
    <div class="en">We, the undersigned, confirm that the works described above have been completed and delivered to the site and have been received according to the items and quantities stated in this Delivery Note.</div>
  </div>

  <div class="dn-stamp-heading">
    <div class="ar-block">استلام وختم هرفي</div>
    <div class="en">HERFY RECEIPT, SIGNATURE &amp; STAMP</div>
  </div>
  <div class="dn-stamp-box"></div>

</div>

<script>
  // Wait for fonts/images, then (a) inject a repeating footer with an
  // approximate page number at each computed page-height offset — the
  // browser print engine gives pages no API to report real break
  // positions, so this is a best-effort estimate based on content height
  // vs. A4 usable height — and (b) trigger print if requested.
  function injectFooters() {
    var wrap = document.getElementById('dnWrap');
    var PAGE_MARGIN_MM = 30; // 14mm top + 16mm bottom, matches @page margin
    var PX_PER_MM = 96 / 25.4;
    var pageHeightPx = (297 - PAGE_MARGIN_MM) * PX_PER_MM;
    var totalHeight = wrap.scrollHeight;
    var totalPages = Math.max(1, Math.ceil(totalHeight / pageHeightPx));

    // No company name in the footer — only a page counter, and only when
    // there's more than one page (nothing to show otherwise).
    if (totalPages <= 1) return;
    for (var i = 0; i < totalPages; i++) {
      var footer = document.createElement('div');
      footer.className = 'dn-footer';
      footer.style.top = ((i + 1) * pageHeightPx - 34) + 'px';
      footer.innerHTML =
        '<div class="dn-footer-inner">' +
          '<div class="dn-footer-page">Page ' + (i + 1) + ' / ' + totalPages + '</div>' +
        '</div>';
      wrap.appendChild(footer);
    }
  }

  Promise.all([
    document.fonts.ready,
    new Promise(resolve => {
      const imgs = document.querySelectorAll('img');
      if (!imgs.length) return resolve();
      let loaded = 0;
      imgs.forEach(img => {
        if (img.complete) { loaded++; if (loaded === imgs.length) resolve(); }
        else { img.onload = img.onerror = () => { loaded++; if (loaded === imgs.length) resolve(); }; }
      });
    })
  ]).then(() => {
    setTimeout(() => {
      injectFooters();
      if (${print}) setTimeout(() => { window.print(); }, 250);
    }, 400);
  });
</script>
</body>
</html>`;
}

// Export PDF — opens a print window and triggers window.print() so the user
// can save it as a PDF (or send it to a physical printer). Requires a real
// popup-capable browser; Preview does NOT use this path (see
// buildDeliveryNoteHtml + the in-app iframe modal in DeliveryNoteSection).
export async function generateDeliveryNotePdf(note, { print = true } = {}) {
  const html = buildDeliveryNoteHtml(note, { print });

  const win = window.open('', '_blank', 'width=820,height=1000,menubar=yes,toolbar=yes');
  if (!win) {
    alert('Pop-up blocked — please allow pop-ups for this site and try again.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
