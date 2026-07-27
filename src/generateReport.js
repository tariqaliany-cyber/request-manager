import { STATUS, formatDate, photoSrc, photoCaption } from './storage';

// ── Builds the report HTML (no side effects) ────────────────
// Used both for the in-app iframe preview (print:false, via PDFPreview)
// and as the source for the real print window (print:true).
// Uses native browser print (window.print) instead of html2canvas/jsPDF so:
//   • Arabic text is shaped and rendered correctly by the browser engine
//   • CSS break-inside:avoid guarantees no photo row or section is ever split
//   • Real base64 photos from Supabase render as-is (no re-encoding needed)
export function buildServiceReportHtml(req, { print = true } = {}) {
  const s   = STATUS[req.status];
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const statusColor = req.status === 'completed' ? '#16A34A'
    : req.status === 'in_progress' ? '#92400E' : '#1D4ED8';

  // ── helpers ──────────────────────────────────────────────
  const esc = (t) => String(t ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function infoRow(labelEn, labelAr, value) {
    return `
      <tr>
        <td class="label">${esc(labelEn)} / <span class="ar">${esc(labelAr)}</span></td>
        <td class="value">${value}</td>
      </tr>`;
  }

  function sectionHeader(en, ar) {
    return `<div class="sec-head"><strong>${esc(en)}</strong> / <span class="ar">${esc(ar)}</span></div>`;
  }

  function photoRows(photos, cols = 4) {
    if (!photos?.length) return '';
    let rows = '';
    for (let i = 0; i < photos.length; i += cols) {
      const chunk = photos.slice(i, i + cols);
      rows += `<div class="photo-row">
        ${chunk.map(p => {
          const caption = photoCaption(p);
          return `<div class="photo-cell-wrap">
            <div class="photo-cell"><img src="${photoSrc(p)}" /></div>
            ${caption ? `<div class="photo-caption">${esc(caption)}</div>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }
    return rows;
  }

  function photoSection(en, ar, photos) {
    if (!photos?.length) return '';
    return `
      <div class="section no-break">
        ${sectionHeader(`${en} (${photos.length})`, ar)}
        <div class="photo-grid">${photoRows(photos)}</div>
      </div>`;
  }

  function textSection(en, ar, text, minLines = 3) {
    const content = text
      ? `<p>${esc(text)}</p>`
      : `<p class="empty">—</p>`;
    return `
      <div class="section">
        ${sectionHeader(en, ar)}
        <div class="text-body" style="min-height:${minLines * 1.65}em;">${content}</div>
      </div>`;
  }

  // ── HTML document ────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="ar" dir="ltr">
<head>
<meta charset="UTF-8" />
<title>Maintenance Report — ${esc(req.id)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet" />
<style>
  /* ── Base ── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Noto Sans Arabic', 'Cairo', Tahoma, Arial, sans-serif;
    font-size: 12px;
    color: #111;
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Arabic spans — browser handles shaping natively */
  .ar {
    font-family: 'Noto Sans Arabic', 'Cairo', Tahoma, Arial, sans-serif;
    direction: rtl;
    unicode-bidi: embed;
    display: inline;
  }

  /* ── Print page setup ── */
  @page {
    size: A4 portrait;
    margin: 12mm 14mm;
  }

  /* ── Layout ── */
  .report-wrap {
    width: 100%;
    max-width: 700px;
    margin: 0 auto;
  }

  /* ── Logo ── */
  .logo-wrap {
    text-align: center;
    padding-bottom: 12px;
  }
  .logo-wrap img {
    height: 110px;
    width: auto;
    object-fit: contain;
  }

  /* ── Title bar ── */
  .title-bar {
    display: flex;
    border: 2px solid #000;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .title-main {
    flex: 1;
    background: #000;
    color: #fff;
    padding: 6px 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 14px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .title-main span { font-size: 13px; font-weight: 600; opacity: 0.88; }
  .title-no {
    min-width: 190px;
    padding: 6px 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    border-left: 2px solid #000;
    font-size: 13px;
    font-weight: 800;
  }
  .title-no em { font-size: 11px; font-weight: 500; font-style: normal; color: #666; }

  /* ── Info table ── */
  .info-table {
    width: 100%;
    border-collapse: collapse;
    border: 2px solid #000;
    border-top: none;
  }
  .info-table td {
    padding: 6px 12px;
    border-bottom: 1px solid #ccc;
    vertical-align: top;
  }
  .info-table tr:last-child td { border-bottom: none; }
  .info-table td.label {
    width: 38%;
    font-size: 10px;
    font-weight: 700;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    border-right: 1px solid #ccc;
  }
  .info-table td.value {
    font-size: 12px;
    font-weight: 600;
  }

  /* ── Content sections ── */
  .section {
    border: 2px solid #000;
    border-top: none;
  }
  .sec-head {
    padding: 4px 12px;
    background: #efefef;
    border-bottom: 1px solid #bbb;
    font-size: 10px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .text-body {
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.7;
  }
  .text-body p { margin: 0; }
  .text-body .empty { color: #aaa; }

  /* ── Photos — key rules ── */
  .photo-grid {
    padding: 6px 10px 8px;
  }
  /* Each row of photos must stay on one page — never split */
  .photo-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .photo-row:last-child { margin-bottom: 0; }
  .photo-cell-wrap {
    flex: 1;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .photo-cell {
    height: 130px;
    overflow: hidden;
    border-radius: 4px;
    border: 1px solid #ddd;
    background: #f5f5f5;
  }
  .photo-cell img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .photo-caption {
    font-size: 9px;
    color: #666;
    margin-top: 3px;
    text-align: center;
  }
  /* Photo section header + first row must stay together */
  .no-break {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* ── Report Details footer — never split ── */
  .report-details {
    border: 2px solid #000;
    border-top: none;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .details-bar {
    background: #000;
    color: #fff;
    padding: 5px 12px;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-top: none;
  }
  .details-cell {
    padding: 7px 12px;
    border-bottom: 1px solid #ccc;
    border-right: 1px solid #ccc;
  }
  .details-cell:nth-child(even) { border-right: none; }
  .details-cell:nth-last-child(-n+2) { border-bottom: none; }
  .details-cell .dlabel {
    font-size: 8px;
    font-weight: 700;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    margin-bottom: 3px;
  }
  .details-cell .dvalue {
    font-size: 12px;
    font-weight: 600;
  }
  .sig-line {
    border-bottom: 1px solid #999;
    width: 120px;
    height: 24px;
    margin-top: 6px;
  }

  /* ── Watermark ── */
  .watermark {
    text-align: center;
    font-size: 8px;
    color: #ccc;
    padding: 6px 0 0;
    letter-spacing: 0.5px;
  }
</style>
</head>
<body>
<div class="report-wrap">

  <!-- Logo -->
  <div class="logo-wrap">
    <img src="/altasis-logo.png" onerror="this.style.display='none'" />
  </div>

  <!-- Title bar -->
  <div class="title-bar">
    <div class="title-main">
      MAINTENANCE REPORT <span>/ <span class="ar">تقرير الصيانة</span></span>
    </div>
    <div class="title-no">
      <em>No.:</em> ${esc(req.id)}
    </div>
  </div>

  <!-- Info rows -->
  <table class="info-table">
    ${infoRow('Branch', 'الفرع', `Herfy ${esc(req.branchNumber)}`)}
    ${infoRow('Date Submitted', 'تاريخ الإرسال', esc(formatDate(req.createdAt)))}
    ${infoRow('Status', 'الحالة', `<span style="color:${statusColor};font-weight:700;">${esc(s.en)} / <span class="ar">${esc(s.ar)}</span></span>`)}
    ${infoRow('Work Started', 'بدأ العمل', req.majedStarted ? `YES / <span class="ar">نعم</span>` : `NO / <span class="ar">لا</span>`)}
    ${req.locationLink ? infoRow('Google Maps', 'خرائط جوجل', `<span style="color:#1a56db;font-size:10px;">${esc(req.locationLink)}</span>`) : ''}
  </table>

  <!-- Problem Description -->
  ${textSection('Problem Description', 'وصف المشكلة', req.problemDescription)}

  <!-- Problem Photos -->
  ${photoSection('Problem Photos', 'صور المشكلة', req.problemPhotos)}

  <!-- Work Completed -->
  ${textSection('Work Completed', 'العمل المنجز', req.workDone)}

  <!-- Progress Photos -->
  ${photoSection('Progress Photos', 'صور التقدم', req.progressPhotos)}

  <!-- Completion Photos -->
  ${photoSection('Completion Photos', 'صور الإنجاز', req.completionPhotos)}

  <!-- Notes to Client -->
  ${req.notesToEssa ? textSection('Notes to Client', 'ملاحظات للعميل', req.notesToEssa) : ''}

  <!-- Report Details — never split across pages -->
  <div class="report-details">
    <div class="details-bar">
      REPORT DETAILS <span style="font-weight:600;opacity:0.85;">/ <span class="ar">تفاصيل التقرير</span></span>
    </div>
    <div class="details-grid">
      <div class="details-cell">
        <div class="dlabel">Coordinator / <span class="ar">المنسق</span></div>
        <div class="dvalue">Tariq / <span class="ar">طارق</span></div>
      </div>
      <div class="details-cell">
        <div class="dlabel">Print Date / <span class="ar">تاريخ الطباعة</span></div>
        <div class="dvalue">${esc(now)}</div>
      </div>
      <div class="details-cell">
        <div class="dlabel">Report No. / <span class="ar">رقم التقرير</span></div>
        <div class="dvalue">${esc(req.id)}</div>
      </div>
      <div class="details-cell">
        <div class="dlabel">Signature / <span class="ar">التوقيع</span></div>
        <div class="sig-line"></div>
      </div>
    </div>
  </div>

  <div class="watermark">
    Herfy Maintenance Management System · <span class="ar">نظام إدارة صيانة هرفي</span>
  </div>

</div>

<script>
  // Wait for all images and fonts to load before printing
  Promise.all([
    document.fonts.ready,
    new Promise(resolve => {
      const imgs = document.querySelectorAll('img');
      if (!imgs.length) return resolve();
      let loaded = 0;
      imgs.forEach(img => {
        if (img.complete) { loaded++; if (loaded === imgs.length) resolve(); }
        else {
          img.onload = img.onerror = () => { loaded++; if (loaded === imgs.length) resolve(); };
        }
      });
    })
  ]).then(() => {
    // Small extra delay for Arabic shaping to settle
    if (${print}) setTimeout(() => { window.print(); }, 600);
  });
</script>
</body>
</html>`;

  return html;
}

// Export PDF — opens a print window and triggers window.print() so the user
// can save it as a PDF (or send it to a physical printer). Preview does NOT
// use this path (see buildServiceReportHtml + PDFPreview's iframe modal).
export async function generateServiceReportPdf(req, { print = true } = {}) {
  const html = buildServiceReportHtml(req, { print });

  const win = window.open('', '_blank', 'width=820,height=1000,menubar=yes,toolbar=yes');
  if (!win) {
    alert('Pop-up blocked — please allow pop-ups for this site and try again.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
