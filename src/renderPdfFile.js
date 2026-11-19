// ── Template → PDF file (no print dialog) ─────────────────────────
// The Export buttons print the templates through the browser's print dialog,
// which gives the user a PDF but no file the app can attach. This renders the
// same template pages (filled through the same window.setXxxData(data)) in a
// hidden iframe and turns each .page into one PDF page, so the Delivery Note
// and Service Report look exactly like the exported ones.

import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';

const A4_W_PX = 793.7;   // 210mm at 96dpi — the templates' page width
const A4_W_MM = 210;

function loadFrame(src) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${Math.ceil(A4_W_PX)}px;height:1200px;border:0;opacity:0;pointer-events:none;`;
    const timer = setTimeout(() => { frame.remove(); reject(new Error('Template took too long to load.')); }, 20000);
    frame.onload = () => { clearTimeout(timer); resolve(frame); };
    frame.onerror = () => { clearTimeout(timer); frame.remove(); reject(new Error('Template failed to load.')); };
    frame.src = src;
    document.body.appendChild(frame);
  });
}

// The templates load Tajawal from Google Fonts. html-to-image can't read a
// cross-origin stylesheet's rules, so fetch the CSS and its font files here
// and hand it the result inlined as data: URLs (cached per stylesheet).
const fontCssCache = new Map();
const toDataUrl = async (url) => {
  const blob = await (await fetch(url)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
};
async function fontEmbedCss(doc) {
  const hrefs = [...doc.querySelectorAll('link[rel="stylesheet"]')].map(l => l.href).filter(h => /fonts\.googleapis\.com/.test(h));
  const parts = await Promise.all(hrefs.map(href => {
    if (!fontCssCache.has(href)) {
      fontCssCache.set(href, (async () => {
        let css = await (await fetch(href)).text();
        const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map(m => m[1]))];
        for (const u of urls) css = css.split(u).join(await toDataUrl(u));
        return css;
      })().catch(e => { fontCssCache.delete(href); throw e; }));
    }
    return fontCssCache.get(href);
  }));
  return parts.join('\n');
}

// Renders `src` filled with `data` and returns a PDF Blob.
// quality/pixelRatio drop automatically if the file would be too large to upload.
export async function renderTemplatePdf({ src, fillName, data, maxBytes = 4.2 * 1024 * 1024 }) {
  const frame = await loadFrame(src);
  try {
    const win = frame.contentWindow;
    if (typeof win[fillName] !== 'function') throw new Error(`Template ${src} has no ${fillName}().`);
    await win[fillName](data);
    await win.document.fonts.ready;
    const pages = [...win.document.querySelectorAll('.page')];
    if (!pages.length) throw new Error('Template rendered no pages.');
    // Let the page's own layout pass settle.
    await new Promise(r => setTimeout(r, 150));
    let fontCss;
    try { fontCss = await fontEmbedCss(win.document); }
    catch { throw new Error('Could not load the document font (Tajawal). Check the internet connection.'); }

    const attempts = [{ pixelRatio: 2, quality: 0.86 }, { pixelRatio: 1.6, quality: 0.72 }, { pixelRatio: 1.25, quality: 0.6 }];
    let blob = null;
    for (const opt of attempts) {
      let pdf = null;
      for (const page of pages) {
        const w = page.offsetWidth, h = page.offsetHeight;
        const img = await toJpeg(page, {
          ...opt, backgroundColor: '#ffffff', width: w, height: h, cacheBust: false, fontEmbedCSS: fontCss,
          style: { margin: '0', boxShadow: 'none' },
        });
        const hMm = A4_W_MM * h / w;
        if (!pdf) pdf = new jsPDF({ unit: 'mm', format: [A4_W_MM, hMm], orientation: 'portrait', compress: true });
        else pdf.addPage([A4_W_MM, hMm], 'portrait');
        pdf.addImage(img, 'JPEG', 0, 0, A4_W_MM, hMm, undefined, 'FAST');
      }
      if (data?.fileName) pdf.setProperties({ title: data.fileName });
      blob = pdf.output('blob');
      if (blob.size <= maxBytes) return blob;
    }
    throw new Error(`The PDF is too large to attach (${(blob.size / 1048576).toFixed(1)} MB). Remove some photos and try again.`);
  } finally {
    frame.remove();
  }
}
