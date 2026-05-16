import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { STATUS, formatDate } from './storage';

// ── Constants ──────────────────────────────────────────────
const RENDER_W   = 720;   // px width for html rendering
const SCALE      = 1.8;   // canvas scale for quality
const PHOTO_COLS = 5;     // photos per row
const PHOTO_H    = 88;    // px thumbnail height
const MM_MARGIN  = 8;     // mm page margin
const FONT = "'Noto Sans Arabic','Cairo',Tahoma,Arial,sans-serif";

// ── Helpers ────────────────────────────────────────────────
async function toBase64(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

async function loadFonts() {
  if (document.getElementById('pdf-fonts-link')) return;
  const link = document.createElement('link');
  link.id = 'pdf-fonts-link';
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700&family=Cairo:wght@400;600;700;800&display=swap';
  document.head.appendChild(link);
  // Wait for fonts to be ready before any canvas rendering
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 700));
}

// Render an HTML string to a canvas — each call is independent
async function renderBlock(html) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;left:-9999px;top:0;width:${RENDER_W}px;z-index:-1;background:#fff;`;
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
  try {
    return await html2canvas(wrap.firstElementChild, {
      scale: SCALE,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      allowTaint: true,
    });
  } finally {
    document.body.removeChild(wrap);
  }
}

// Arabic text: isolated RTL span so shaping works correctly
const ar = (text) =>
  `<span style="direction:rtl;unicode-bidi:isolate;font-family:${FONT};">${text}</span>`;

// ── HTML block builders ────────────────────────────────────
// Borders: header has full 2px border; middle blocks share sides only; footer closes with 2px bottom.
const SIDE  = `border-left:2px solid #000;border-right:2px solid #000;`;
const HDIV  = `border-bottom:1px solid #ccc;`;

function labelStyle(extraStyle = '') {
  return `font-size:8px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;font-family:${FONT};${extraStyle}`;
}

function valueStyle(extraStyle = '') {
  return `font-size:12px;font-weight:600;color:#000;font-family:${FONT};${extraStyle}`;
}

function sectionHeaderHtml(enLabel, arLabel, extra = '') {
  return `<div style="padding:4px 12px;background:#efefef;border-bottom:1px solid #bbb;font-family:${FONT};">
    <span style="font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.6px;color:#000;">${enLabel}${extra}:</span>
    <span style="font-size:8.5px;font-weight:600;color:#555;"> / ${ar(arLabel)}</span>
  </div>`;
}

// ── Block: Header (logo + title bar + info rows) ───────────
function headerBlock(logoImg, id, req, s) {
  const statusColor = req.status === 'completed' ? '#16A34A'
    : req.status === 'in_progress' ? '#92400E' : '#1D4ED8';
  const locationRow = req.locationLink ? `
    <div style="${HDIV}padding:5px 12px;font-family:${FONT};">
      <span style="${labelStyle()}">Google Maps / ${ar('خرائط جوجل')}: </span>
      <span style="font-size:10px;color:#1a56db;">${req.locationLink.slice(0, 75)}${req.locationLink.length > 75 ? '…' : ''}</span>
    </div>` : '';
  return `
  <div style="font-family:${FONT};background:#fff;width:${RENDER_W}px;box-sizing:border-box;">
    <div style="display:flex;justify-content:center;padding-bottom:10px;">${logoImg}</div>
    <div style="border:2px solid #000;">
      <!-- Title bar -->
      <div style="display:flex;border-bottom:2px solid #000;">
        <div style="flex:1;background:#000;color:#fff;padding:5px 14px;display:flex;align-items:center;justify-content:center;gap:10px;">
          <span style="font-size:13px;font-weight:800;letter-spacing:1px;text-transform:uppercase;font-family:${FONT};">Maintenance Report</span>
          <span style="font-size:12px;font-weight:600;opacity:0.85;font-family:${FONT};">/ ${ar('تقرير الصيانة')}</span>
        </div>
        <div style="padding:5px 14px;display:flex;align-items:center;gap:8px;min-width:180px;border-left:2px solid #000;">
          <span style="font-size:10px;font-weight:700;color:#888;font-family:${FONT};">No.:</span>
          <span style="font-size:12px;font-weight:800;color:#000;font-family:${FONT};">${id}</span>
        </div>
      </div>
      <!-- Branch / Date -->
      <div style="display:flex;${HDIV}">
        <div style="flex:1;padding:6px 12px;border-right:1px solid #ccc;">
          <div style="${labelStyle()}">Branch / ${ar('الفرع')}</div>
          <div style="${valueStyle()}">Herfy ${req.branchNumber}</div>
        </div>
        <div style="flex:1;padding:6px 12px;">
          <div style="${labelStyle()}">Date Submitted / ${ar('تاريخ الإرسال')}</div>
          <div style="${valueStyle()}">${formatDate(req.createdAt)}</div>
        </div>
      </div>
      <!-- Status / Work Started -->
      <div style="display:flex;${req.locationLink ? HDIV : ''}">
        <div style="flex:1;padding:6px 12px;border-right:1px solid #ccc;">
          <div style="${labelStyle()}">Status / ${ar('الحالة')}</div>
          <div style="${valueStyle(`color:${statusColor};`)}">${s.en} / ${ar(s.ar)}</div>
        </div>
        <div style="flex:1;padding:6px 12px;">
          <div style="${labelStyle()}">Work Started / ${ar('بدأ العمل')}</div>
          <div style="${valueStyle()}">${req.majedStarted ? `YES / ${ar('نعم')}` : `NO / ${ar('لا')}`}</div>
        </div>
      </div>
      ${locationRow}
    </div>
  </div>`;
}

// ── Block: Text section (description, work done, notes) ────
function textBlock(enLabel, arLabel, text, isFirst = false) {
  const topBorder = isFirst ? '' : 'border-top:none;';
  return `
  <div style="font-family:${FONT};width:${RENDER_W}px;${SIDE}${topBorder}${HDIV}">
    ${sectionHeaderHtml(enLabel, arLabel)}
    <div style="padding:7px 12px;min-height:48px;font-size:12px;color:${text ? '#1a1a1a' : '#aaa'};line-height:1.65;">${text || '—'}</div>
  </div>`;
}

// ── Block: Photo section header ─────────────────────────────
function photoHeaderBlock(enLabel, arLabel, count) {
  return `
  <div style="font-family:${FONT};width:${RENDER_W}px;${SIDE}border-top:none;">
    ${sectionHeaderHtml(enLabel, arLabel, ` (${count})`)}
  </div>`;
}

// ── Block: One row of photos ────────────────────────────────
function photoRowBlock(photos) {
  const thumbW = Math.floor((RENDER_W - 30) / PHOTO_COLS) - 6;
  return `
  <div style="font-family:${FONT};width:${RENDER_W}px;${SIDE}background:#fff;">
    <div style="display:flex;gap:5px;padding:6px 12px;flex-wrap:nowrap;">
      ${photos.map(src =>
        `<img src="${src}" style="width:${thumbW}px;height:${PHOTO_H}px;object-fit:cover;border-radius:3px;border:1px solid #ddd;flex-shrink:0;" />`
      ).join('')}
    </div>
  </div>`;
}

// ── Block: Photo section bottom border closer ───────────────
function photoBorderClose() {
  return `<div style="width:${RENDER_W}px;${SIDE}border-bottom:1px solid #ccc;height:1px;"></div>`;
}

// ── Block: Footer ───────────────────────────────────────────
function footerBlock(id, now) {
  return `
  <div style="font-family:${FONT};width:${RENDER_W}px;border:2px solid #000;border-top:none;">
    <div style="background:#000;color:#fff;padding:5px 12px;display:flex;align-items:center;gap:8px;">
      <span style="font-size:9.5px;font-weight:800;letter-spacing:1px;text-transform:uppercase;font-family:${FONT};">Report Details</span>
      <span style="font-size:9px;font-weight:600;opacity:0.82;font-family:${FONT};">/ ${ar('تفاصيل التقرير')}</span>
    </div>
    <div style="display:flex;${HDIV}">
      <div style="flex:1;padding:7px 12px;border-right:1px solid #ccc;">
        <div style="${labelStyle()}">Coordinator / ${ar('المنسق')}</div>
        <div style="${valueStyle()}">Tariq / ${ar('طارق')}</div>
      </div>
      <div style="flex:1;padding:7px 12px;">
        <div style="${labelStyle()}">Print Date / ${ar('تاريخ الطباعة')}</div>
        <div style="${valueStyle()}">${now}</div>
      </div>
    </div>
    <div style="display:flex;">
      <div style="flex:1;padding:7px 12px;border-right:1px solid #ccc;">
        <div style="${labelStyle()}">Report No. / ${ar('رقم التقرير')}</div>
        <div style="${valueStyle()}">${id}</div>
      </div>
      <div style="flex:1;padding:7px 12px;">
        <div style="${labelStyle()}">Signature / ${ar('التوقيع')}</div>
        <div style="border-bottom:1px solid #999;width:120px;height:20px;margin-top:4px;">&nbsp;</div>
      </div>
    </div>
  </div>`;
}

// ── Block: Watermark ────────────────────────────────────────
function watermarkBlock() {
  return `
  <div style="font-family:${FONT};width:${RENDER_W}px;text-align:center;font-size:8px;color:#bbb;letter-spacing:0.5px;padding:5px 0;">
    Herfy Maintenance Management System · ${ar('نظام إدارة صيانة هرفي')}
  </div>`;
}

// ── Add photo section (header + rows) to blocks array ───────
function addPhotoSection(blocks, photos, enLabel, arLabel) {
  if (!photos?.length) return;
  blocks.push(photoHeaderBlock(enLabel, arLabel, photos.length));
  for (let i = 0; i < photos.length; i += PHOTO_COLS) {
    blocks.push(photoRowBlock(photos.slice(i, i + PHOTO_COLS)));
  }
  blocks.push(photoBorderClose());
}

// ── Main export ────────────────────────────────────────────
export async function generateServiceReport(req) {
  await loadFonts();

  const altasisLogo = await toBase64('/altasis-logo.png');
  const s = STATUS[req.status];
  const now = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  const logoImg = altasisLogo
    ? `<img src="${altasisLogo}" style="height:120px;width:auto;object-fit:contain;display:block;" />`
    : `<div style="font-size:20px;font-weight:900;font-family:${FONT};">ALTASIS</div>`;

  // ── Assemble blocks ────────────────────────────────────────
  const htmlBlocks = [];

  htmlBlocks.push(headerBlock(logoImg, req.id, req, s));
  htmlBlocks.push(textBlock('Problem Description', 'وصف المشكلة', req.problemDescription));
  addPhotoSection(htmlBlocks, req.problemPhotos,    'Problem Photos',    'صور المشكلة');
  htmlBlocks.push(textBlock('Work Completed',       'العمل المنجز',     req.workDone));
  addPhotoSection(htmlBlocks, req.progressPhotos,   'Progress Photos',   'صور التقدم');
  addPhotoSection(htmlBlocks, req.completionPhotos, 'Completion Photos', 'صور الإنجاز');
  if (req.notesToEssa) htmlBlocks.push(textBlock('Notes to Client', 'ملاحظات للعميل', req.notesToEssa));
  htmlBlocks.push(footerBlock(req.id, now));
  htmlBlocks.push(watermarkBlock());

  // ── Render each block to canvas individually ───────────────
  const canvases = [];
  for (const html of htmlBlocks) {
    canvases.push(await renderBlock(html));
  }

  // ── Build PDF — place canvases page by page ────────────────
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();   // 210mm
  const pageH = pdf.internal.pageSize.getHeight();  // 297mm
  const cW    = pageW - 2 * MM_MARGIN;              // content width in mm
  let   y     = MM_MARGIN;

  for (const canvas of canvases) {
    const blockH = (canvas.height / canvas.width) * cW;

    // If block won't fit on the remaining page, start a new page
    if (y + blockH > pageH - MM_MARGIN && y > MM_MARGIN) {
      pdf.addPage();
      y = MM_MARGIN;
    }

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', MM_MARGIN, y, cW, blockH);
    y += blockH;
  }

  pdf.save(`Maintenance-Report-${req.id}.pdf`);
}
