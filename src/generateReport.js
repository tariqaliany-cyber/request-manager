import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { STATUS, formatDate } from './storage';

// Fetch image and convert to base64 for embedding in the off-screen div
async function toBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function photoRow(photos, label, labelAr) {
  if (!photos?.length) return '';
  const imgs = photos
    .map(src => `<img src="${src}" style="width:160px;height:120px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;" />`)
    .join('');
  return `
    <div style="margin-top:20px;">
      <div style="font-size:13px;font-weight:700;color:#563b2c;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px;display:flex;justify-content:space-between;">
        <span>${label}</span><span dir="rtl">${labelAr}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">${imgs}</div>
    </div>`;
}

function commentRows(comments) {
  if (!comments?.length) return '';
  const rows = comments
    .map(c => `<div style="padding:8px 10px;background:#f8fafc;border-radius:6px;margin-bottom:6px;">
      <div style="font-size:12px;color:#334155;">👷 ${c.text}</div>
      <div style="font-size:10px;color:#94a3b8;margin-top:2px;">${formatDate(c.time)}</div>
    </div>`)
    .join('');
  return `
    <div style="margin-top:16px;">
      <div style="font-size:13px;font-weight:700;color:#563b2c;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px;display:flex;justify-content:space-between;">
        <span>Workshop Comments</span><span dir="rtl">تعليقات الورشة</span>
      </div>
      ${rows}
    </div>`;
}

function infoRow(labelEn, labelAr, value, valueStyle = '') {
  return `
    <tr>
      <td style="padding:8px 10px;font-size:12px;font-weight:600;color:#64748b;width:160px;white-space:nowrap;">${labelEn}</td>
      <td style="padding:8px 10px;font-size:12px;color:#94a3b8;width:140px;white-space:nowrap;text-align:right;" dir="rtl">${labelAr}</td>
      <td style="padding:8px 10px;font-size:13px;color:#1e293b;font-weight:500;${valueStyle}">${value}</td>
    </tr>`;
}

function section(titleEn, titleAr, content) {
  return `
    <div style="margin-top:22px;">
      <div style="font-size:13px;font-weight:700;color:#563b2c;background:#fdf6f0;padding:8px 12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
        <span>${titleEn}</span><span dir="rtl">${titleAr}</span>
      </div>
      <div style="padding:4px 0;">${content}</div>
    </div>`;
}

export async function generateServiceReport(req) {
  const logoBase64 = await toBase64('/altasis-logo.png');
  const s = STATUS[req.status];
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const logoImg = logoBase64
    ? `<img src="${logoBase64}" style="height:72px;width:auto;object-fit:contain;" />`
    : `<div style="font-size:14px;font-weight:900;color:#2d2d2d;text-align:center;">ALTASIS<br/>ALISTRATIJI</div>`;

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;background:#fff;padding:32px 36px;width:760px;box-sizing:border-box;">

      <!-- Header -->
      <div style="display:grid;grid-template-columns:1fr auto 1fr;align-items:center;border-bottom:3px solid #2d2d2d;padding-bottom:18px;margin-bottom:20px;gap:16px;">
        <!-- Left: empty spacer to balance the right column -->
        <div></div>
        <!-- Center: logo -->
        <div style="display:flex;justify-content:center;align-items:center;">
          ${logoImg}
        </div>
        <!-- Right: report title above request ID -->
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:600;color:#64748b;letter-spacing:0.8px;text-transform:uppercase;margin-bottom:2px;">Service Report</div>
          <div style="font-size:10px;color:#94a3b8;margin-bottom:6px;" dir="rtl">تقرير الصيانة</div>
          <div style="font-size:20px;font-weight:800;color:#2d2d2d;">${req.id}</div>
          <div style="font-size:10px;color:#94a3b8;margin-top:3px;">${now}</div>
        </div>
      </div>

      <!-- Info Table -->
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;">
        <tbody>
          ${infoRow('Branch', 'الفرع', `Herfy ${req.branchNumber}`)}
          ${infoRow('Date Created', 'تاريخ الإنشاء', formatDate(req.createdAt))}
          ${infoRow('Status', 'الحالة',
            `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600;color:${s.color};background:${s.bg};">
              ● ${s.en} / ${s.ar}
            </span>`)}
          ${req.assignedTo ? infoRow('Assigned To', 'مسند إلى', '👷 Workshop Team / فريق الورشة') : ''}
          ${req.locationLink ? infoRow('Location', 'الموقع', `<a href="${req.locationLink}" style="color:#563b2c;">📍 View Map</a>`) : ''}
        </tbody>
      </table>

      <!-- Problem Description -->
      ${section('Problem Description', 'وصف المشكلة',
        `<div style="padding:12px;font-size:13px;color:#334155;line-height:1.6;">${req.problemDescription || '—'}</div>`)}

      <!-- Problem Photos -->
      ${photoRow(req.problemPhotos, 'Problem Photos', 'صور المشكلة')}

      <!-- Workshop Updates -->
      ${req.majedStarted ? `
        <div style="margin-top:22px;border-top:2px dashed #e2e8f0;padding-top:20px;">
          <div style="font-size:15px;font-weight:800;color:#10B981;margin-bottom:14px;display:flex;justify-content:space-between;">
            <span>Workshop Updates</span><span dir="rtl">تحديثات الورشة</span>
          </div>
          ${commentRows(req.majedComments)}
          ${req.workDone ? section('Work Done', 'العمل المنجز',
            `<div style="padding:12px;font-size:13px;color:#334155;line-height:1.6;">${req.workDone}</div>`) : ''}
          ${photoRow(req.progressPhotos, 'Progress Photos', 'صور التقدم')}
          ${photoRow(req.completionPhotos, 'Completion Photos', 'صور الإنجاز')}
        </div>` : ''}

      <!-- Notes to Client -->
      ${req.notesToEssa ? section('Notes to Client', 'ملاحظات للعميل',
        `<div style="padding:12px;font-size:13px;color:#334155;line-height:1.6;">${req.notesToEssa}</div>`) : ''}

      <!-- Final Summary -->
      ${req.finalSummary ? `
        <div style="margin-top:22px;background:#fdf6f0;border:2px solid #563b2c;border-radius:8px;padding:16px;">
          <div style="font-size:13px;font-weight:700;color:#563b2c;margin-bottom:8px;display:flex;justify-content:space-between;">
            <span>Final Summary</span><span dir="rtl">الملخص النهائي</span>
          </div>
          <div style="font-size:13px;color:#1e293b;line-height:1.7;">${req.finalSummary}</div>
        </div>` : ''}

      <!-- Footer -->
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:11px;color:#94a3b8;">
          Generated by: <strong style="color:#563b2c;">Tariq / طارق</strong>
        </div>
        <div style="font-size:11px;color:#94a3b8;">Herfy Maintenance System · ${now}</div>
      </div>
    </div>`;

  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;';
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container.firstElementChild, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgH = (canvas.height * pageW) / canvas.width;

    let remaining = imgH;
    let yOffset = 0;

    while (remaining > 0) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, -yOffset, pageW, imgH);
      yOffset += pageH;
      remaining -= pageH;
    }

    pdf.save(`Service-Report-${req.id}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
