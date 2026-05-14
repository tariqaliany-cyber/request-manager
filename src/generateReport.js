import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { STATUS, formatDate } from './storage';

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

// Crop background margins from an image by sampling corner color, return cropped base64
async function cropWhitespace(base64) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
      // Sample background color from top-left corner pixel
      const br = data[0], bg = data[1], bb = data[2];
      const threshold = 18;
      const isBg = (r, g, b, a) =>
        a < 10 ||
        (Math.abs(r - br) < threshold && Math.abs(g - bg) < threshold && Math.abs(b - bb) < threshold);
      let top = height, left = width, right = 0, bottom = 0;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          if (!isBg(data[i], data[i+1], data[i+2], data[i+3])) {
            if (x < left)   left   = x;
            if (x > right)  right  = x;
            if (y < top)    top    = y;
            if (y > bottom) bottom = y;
          }
        }
      }
      const pad = 6;
      const cw = right - left + 1 + pad * 2;
      const ch = bottom - top + 1 + pad * 2;
      const out = document.createElement('canvas');
      out.width = cw; out.height = ch;
      // Fill with white so JPEG background is clean
      const octx = out.getContext('2d');
      octx.fillStyle = '#ffffff';
      octx.fillRect(0, 0, cw, ch);
      octx.drawImage(c, left - pad, top - pad, cw, ch, 0, 0, cw, ch);
      resolve(out.toDataURL('image/png'));
    };
    img.src = base64;
  });
}

function photoRow(photos, label, labelAr) {
  if (!photos?.length) return '';
  const imgs = photos
    .map(src => `<img src="${src}" style="max-width:160px;max-height:130px;width:auto;height:auto;border-radius:6px;border:1px solid #e2e8f0;display:block;" />`)
    .join('');
  return `
    <div style="margin-top:10px;">
      <div style="font-size:12px;font-weight:700;color:#563b2c;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-bottom:8px;display:flex;justify-content:space-between;">
        <span>${label}</span><span dir="rtl">${labelAr}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start;">${imgs}</div>
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
      <td style="padding:5px 10px;font-size:12px;font-weight:600;color:#64748b;width:160px;white-space:nowrap;">${labelEn}</td>
      <td style="padding:5px 10px;font-size:12px;color:#94a3b8;width:140px;white-space:nowrap;text-align:right;" dir="rtl">${labelAr}</td>
      <td style="padding:5px 10px;font-size:13px;color:#1e293b;font-weight:500;${valueStyle}">${value}</td>
    </tr>`;
}

function section(titleEn, titleAr, content) {
  return `
    <div style="margin-top:10px;">
      <div style="font-size:12px;font-weight:700;color:#563b2c;background:#fdf6f0;padding:6px 12px;border-radius:6px;display:flex;justify-content:space-between;align-items:center;">
        <span>${titleEn}</span><span dir="rtl">${titleAr}</span>
      </div>
      <div style="padding:2px 0;">${content}</div>
    </div>`;
}

async function loadCairoFont() {
  if (document.getElementById('cairo-font-link')) return;
  const link = document.createElement('link');
  link.id = 'cairo-font-link';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap';
  document.head.appendChild(link);
  await document.fonts.load('700 16px Cairo');
  await document.fonts.load('400 14px Cairo');
}

export async function generateServiceReport(req) {
  await loadCairoFont();
  const rawLogo = await toBase64('/altasis-logo.png');
  const logoBase64 = rawLogo ? await cropWhitespace(rawLogo) : null;
  const s = STATUS[req.status];
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const logoImg = logoBase64
    ? `<img src="${logoBase64}" style="height:160px;width:auto;object-fit:contain;" />`
    : `<div style="font-size:14px;font-weight:900;color:#2d2d2d;text-align:center;">ALTASIS<br/>ALISTRATIJI</div>`;

  const html = `
    <div style="font-family:'Cairo','Segoe UI',Arial,sans-serif;background:#fff;padding:20px 28px;width:760px;box-sizing:border-box;">

      <!-- Header -->
      <div style="text-align:center;border-bottom:3px solid #2d2d2d;padding-bottom:10px;margin-bottom:12px;">
        ${logoImg}
        <div style="margin-top:0px;font-size:14px;font-weight:700;color:#2d2d2d;letter-spacing:0.5px;">SERVICE REPORT</div>
        <div style="margin-top:3px;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:1px;">${req.id} &nbsp;·&nbsp; ${now}</div>
      </div>

      <!-- Info Table -->
      <table style="width:100%;border-collapse:collapse;background:#f8fafc;border-radius:8px;overflow:hidden;">
        <tbody>
          ${infoRow('Branch', 'الفرع', `Herfy ${req.branchNumber}`)}
          ${infoRow('Date Created', 'تاريخ الإنشاء', formatDate(req.createdAt))}
          ${infoRow('Status', 'الحالة',
            `<span style="display:inline-flex;align-items:center;gap:6px;padding:2px 10px;border-radius:20px;font-size:12px;font-weight:600;color:${s.color};background:${s.bg};">
              ● ${s.en} / ${s.ar}
            </span>`)}
          ${req.assignedTo ? infoRow('Assigned To', 'مسند إلى', '👷 Workshop Team / فريق الورشة') : ''}
          ${req.locationLink ? infoRow('Google Maps', 'خرائط جوجل', `<a href="${req.locationLink}" style="color:#563b2c;">🗺️ View Map</a>`) : ''}
        </tbody>
      </table>

      <!-- Problem Description -->
      ${section('Problem Description', 'وصف المشكلة',
        `<div style="padding:8px 12px;font-size:13px;color:#334155;line-height:1.4;">${req.problemDescription || '—'}</div>`)}

      <!-- Problem Photos -->
      ${photoRow(req.problemPhotos, 'Problem Photos', 'صور المشكلة')}

      <!-- Workshop Updates -->
      ${req.majedStarted ? `
        <div style="margin-top:12px;border-top:2px dashed #e2e8f0;padding-top:12px;">
          <div style="font-size:13px;font-weight:800;color:#10B981;margin-bottom:8px;display:flex;justify-content:space-between;">
            <span>Workshop Updates</span><span dir="rtl">تحديثات الورشة</span>
          </div>
          ${req.workDone ? section('Work Done', 'العمل المنجز',
            `<div style="padding:8px 12px;font-size:13px;color:#334155;line-height:1.4;">${req.workDone}</div>`) : ''}
          ${photoRow(req.progressPhotos, 'Progress Photos', 'صور التقدم')}
          ${photoRow(req.completionPhotos, 'Completion Photos', 'صور الإنجاز')}
        </div>` : ''}

      <!-- Notes to Client -->
      ${req.notesToEssa ? section('Notes to Client', 'ملاحظات للعميل',
        `<div style="padding:8px 12px;font-size:13px;color:#334155;line-height:1.4;">${req.notesToEssa}</div>`) : ''}

      <!-- Final Summary -->
      ${req.finalSummary ? `
        <div style="margin-top:12px;background:#fdf6f0;border:2px solid #563b2c;border-radius:8px;padding:12px;">
          <div style="font-size:12px;font-weight:700;color:#563b2c;margin-bottom:6px;display:flex;justify-content:space-between;">
            <span>Final Summary</span><span dir="rtl">الملخص النهائي</span>
          </div>
          <div style="font-size:13px;color:#1e293b;line-height:1.4;">${req.finalSummary}</div>
        </div>` : ''}

      <!-- Footer -->
      <div style="margin-top:16px;padding-top:10px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:10px;color:#94a3b8;">
          Generated by: <strong style="color:#563b2c;">Tariq / طارق</strong>
        </div>
        <div style="font-size:10px;color:#94a3b8;">Herfy Maintenance System · ${now}</div>
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
