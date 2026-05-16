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

function photoGrid(photos) {
  if (!photos?.length) return '';
  return `<div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;">
    ${photos.map(src =>
      `<img src="${src}" style="height:105px;width:auto;max-width:145px;object-fit:cover;border-radius:4px;border:1px solid #ccc;" />`
    ).join('')}
  </div>`;
}

function fieldRow(labelEn, labelAr, valueLeft, labelEnR, labelArR, valueRight) {
  return `
    <div style="display:flex;border-bottom:1px solid #000;">
      <div style="flex:1;padding:7px 14px;border-right:1px solid #000;">
        <div style="font-size:9.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">${labelEn} / ${labelAr}</div>
        <div style="font-size:13px;font-weight:600;color:#000;">${valueLeft}</div>
      </div>
      <div style="flex:1;padding:7px 14px;">
        <div style="font-size:9.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">${labelEnR} / ${labelArR}</div>
        <div style="font-size:13px;font-weight:600;color:#000;">${valueRight}</div>
      </div>
    </div>`;
}

function sectionBox(labelEn, labelAr, content, minHeight = '60px') {
  return `
    <div style="border-bottom:1px solid #000;">
      <div style="padding:5px 14px;background:#f2f2f2;border-bottom:1px solid #aaa;">
        <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;color:#000;">${labelEn}:</span>
        <span style="font-size:10px;font-weight:600;color:#444;margin-right:8px;"> / ${labelAr}</span>
      </div>
      <div style="min-height:${minHeight};">
        ${content}
      </div>
    </div>`;
}

function photoSection(labelEn, labelAr, photos) {
  if (!photos?.length) return '';
  return `
    <div style="border-bottom:1px solid #000;">
      <div style="padding:5px 14px;background:#f2f2f2;border-bottom:1px solid #aaa;">
        <span style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.7px;color:#000;">${labelEn} (${photos.length}):</span>
        <span style="font-size:10px;font-weight:600;color:#444;margin-right:8px;"> / ${labelAr}</span>
      </div>
      ${photoGrid(photos)}
    </div>`;
}

export async function generateServiceReport(req) {
  await loadCairoFont();
  const herfyLogo = await toBase64('/herfy-logo.png');
  const altasisLogo = await toBase64('/altasis-logo.png');
  const s = STATUS[req.status];
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const altasisImg = altasisLogo
    ? `<img src="${altasisLogo}" style="height:168px;width:auto;object-fit:contain;display:block;" />`
    : `<div style="font-size:16px;font-weight:900;color:#000;">ALTASIS</div>`;

  const locationValue = req.locationLink
    ? `<span style="font-size:11px;color:#1a56db;">${req.locationLink.slice(0, 45)}${req.locationLink.length > 45 ? '…' : ''}</span>`
    : '—';

  const html = `
    <div style="font-family:'Cairo','Segoe UI',Arial,sans-serif;background:#fff;width:760px;box-sizing:border-box;padding:22px 30px;">

      <!-- ── Letterhead ── -->
      <div style="display:flex;justify-content:center;align-items:center;margin-bottom:14px;">
        ${altasisImg}
      </div>

      <!-- ── Main bordered container ── -->
      <div style="border:2px solid #000;border-radius:2px;">

        <!-- Title bar -->
        <div style="display:flex;border-bottom:2px solid #000;">
          <div style="flex:1;background:#000;color:#fff;padding:6px 16px;text-align:center;display:flex;align-items:center;justify-content:center;gap:10px;">
            <span style="font-size:14px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">Maintenance Report</span>
            <span style="font-size:13px;font-weight:600;opacity:0.82;letter-spacing:0.3px;">/ تقرير الصيانة</span>
          </div>
          <div style="padding:6px 18px;display:flex;align-items:center;gap:10px;min-width:190px;border-left:2px solid #000;">
            <span style="font-size:12px;font-weight:700;color:#555;">No.:</span>
            <span style="font-size:14px;font-weight:800;color:#000;letter-spacing:0.5px;">${req.id}</span>
          </div>
        </div>

        <!-- Row: Branch | Date Submitted -->
        ${fieldRow(
          'Branch', 'الفرع',          `Herfy ${req.branchNumber}`,
          'Date Submitted', 'تاريخ الإرسال', formatDate(req.createdAt)
        )}

        <!-- Row: Status | Work Started -->
        <div style="display:flex;border-bottom:1px solid #000;">
          <div style="flex:1;padding:7px 14px;border-right:1px solid #000;">
            <div style="font-size:9.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">Status / الحالة</div>
            <div style="font-size:13px;font-weight:700;color:${req.status === 'completed' ? '#16A34A' : req.status === 'in_progress' ? '#92400E' : '#1D4ED8'};">
              ${s.en} / ${s.ar}
            </div>
          </div>
          <div style="flex:1;padding:7px 14px;">
            <div style="font-size:9.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">Work Started / بدأ العمل</div>
            <div style="font-size:13px;font-weight:600;color:#000;">${req.majedStarted ? 'YES / نعم' : 'NO / لا'}</div>
          </div>
        </div>

        ${req.locationLink ? `
        <!-- Row: Google Maps (full width) -->
        <div style="border-bottom:1px solid #000;padding:7px 14px;">
          <span style="font-size:9.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;">Google Maps / خرائط جوجل: </span>
          <span style="font-size:11px;color:#1a56db;">${req.locationLink.slice(0, 80)}${req.locationLink.length > 80 ? '…' : ''}</span>
        </div>` : ''}

        <!-- Problem Description -->
        ${sectionBox('Problem Description', 'وصف المشكلة',
          `<div style="padding:10px 14px;font-size:13px;color:#1a1a1a;line-height:1.7;">${req.problemDescription || '—'}</div>`,
          '70px'
        )}

        <!-- Problem Photos -->
        ${photoSection('Problem Photos', 'صور المشكلة', req.problemPhotos)}

        <!-- Work Completed -->
        ${sectionBox('Work Completed', 'العمل المنجز',
          req.workDone
            ? `<div style="padding:10px 14px;font-size:13px;color:#1a1a1a;line-height:1.7;">${req.workDone}</div>`
            : `<div style="padding:10px 14px;font-size:12px;color:#aaa;">—</div>`,
          '70px'
        )}

        <!-- Progress Photos -->
        ${photoSection('Progress Photos', 'صور التقدم', req.progressPhotos)}

        <!-- Completion Photos -->
        ${photoSection('Completion Photos', 'صور الإنجاز', req.completionPhotos)}

        ${req.notesToEssa ? sectionBox('Notes to Client', 'ملاحظات للعميل',
          `<div style="padding:10px 14px;font-size:13px;color:#1a1a1a;line-height:1.7;">${req.notesToEssa}</div>`,
          '50px'
        ) : ''}

        <!-- ── Footer black bar ── -->
        <div style="background:#000;color:#fff;padding:6px 14px;">
          <span style="font-size:10.5px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">Report Details</span>
          <span style="font-size:10px;font-weight:600;opacity:0.8;margin-right:10px;"> / تفاصيل التقرير</span>
        </div>

        <!-- Footer row 1 -->
        <div style="display:flex;border-top:none;">
          <div style="flex:1;padding:8px 14px;border-right:1px solid #000;">
            <div style="font-size:9.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">Coordinator / المنسق</div>
            <div style="font-size:12px;font-weight:600;color:#000;">Tariq / طارق</div>
          </div>
          <div style="flex:1;padding:8px 14px;">
            <div style="font-size:9.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">Print Date / تاريخ الطباعة</div>
            <div style="font-size:12px;font-weight:600;color:#000;">${now}</div>
          </div>
        </div>

        <!-- Footer row 2 -->
        <div style="display:flex;border-top:1px solid #000;">
          <div style="flex:1;padding:8px 14px;border-right:1px solid #000;">
            <div style="font-size:9.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">Report No. / رقم التقرير</div>
            <div style="font-size:12px;font-weight:600;color:#000;">${req.id}</div>
          </div>
          <div style="flex:1;padding:8px 14px;">
            <div style="font-size:9.5px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:3px;">Signature / التوقيع</div>
            <div style="border-bottom:1px solid #999;width:130px;height:22px;">&nbsp;</div>
          </div>
        </div>

      </div>

      <!-- System watermark -->
      <div style="margin-top:8px;text-align:center;font-size:9px;color:#bbb;letter-spacing:0.5px;">
        Herfy Maintenance Management System · نظام إدارة صيانة هرفي
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

    pdf.save(`Maintenance-Report-${req.id}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
