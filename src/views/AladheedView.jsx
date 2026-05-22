import { useState, useEffect, useRef } from 'react';
import { getRequests, updateRequest, formatDate } from '../storage';
import { BRANCHES } from '../branchData';

/* ── Document type config ─────────────────────────── */
const DOC_TYPES = {
  invoice:         { label: 'Invoice',               ar: 'فاتورة',              icon: '🧾', required: true,  color: '#7C3AED', bg: '#F5F3FF' },
  completion_pics: { label: 'Completion Pics',       ar: 'صور الإنجاز',          icon: '📸', required: true,  color: '#0369A1', bg: '#EFF6FF' },
  work_receiving:  { label: 'Work Receiving Paper',  ar: 'ورقة استلام الأعمال',  icon: '📋', required: true,  color: '#047857', bg: '#F0FDF4' },
  other:           { label: 'Other',                 ar: 'أخرى',                icon: '📎', required: false, color: '#64748B', bg: '#F8FAFC' },
};

/* ── localStorage session ─────────────────────────── */
const sKey = id => `aladheed_${id}`;
const loadSession = id => { try { return JSON.parse(localStorage.getItem(sKey(id))); } catch { return null; } };
const saveSession = (id, data) => localStorage.setItem(sKey(id), JSON.stringify(data));

/* ── File auto-classification ─────────────────────── */
function classifyFile(name) {
  const n = name.toLowerCase();
  if (/invoice|inv\b|فاتورة|bill|billing/.test(n)) return 'invoice';
  if (/photo|pic|completion|complete|صور|إنجاز|finish|done/.test(n)) return 'completion_pics';
  if (/receiv|استلام|work.?order|work.?receiv|استلام.?اعمال/.test(n)) return 'work_receiving';
  return 'unknown';
}

/* ── Email defaults ───────────────────────────────── */
function defaultSubject(job) {
  return `Submission of Completion Documents – Herfy Branch ${job.branchNumber}`;
}
function defaultBody(job) {
  const b = BRANCHES.find(b => b.num === String(job.branchNumber));
  return `Dear [Recipient Name],

Please find attached the completion documents for Herfy Branch ${job.branchNumber}${b ? ` (${b.area})` : ''}.

The attached documents include:
1. Invoice
2. Sample Completion Pictures
3. Work Receiving Paper

Kindly review the attached documents and confirm if any further information is required.

Best regards,
Tariq Alalyani`;
}

/* ── File download ────────────────────────────────── */
function downloadBase64(name, dataUrl) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/* ── Branch label helper ──────────────────────────── */
function branchLabel(job) {
  const b = BRANCHES.find(b => b.num === String(job.branchNumber));
  return b ? `Herfy ${job.branchNumber} – ${b.area}` : `Herfy ${job.branchNumber}`;
}

/* ── Completion Pics PDF ──────────────────────────── */
function printCompletionPics(job, photos) {
  if (!photos.length) return;
  const label = branchLabel(job);
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to generate PDF.'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Completion Photos – ${label}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;padding:24px;color:#1e293b}
.hdr{border-bottom:3px solid #0F172A;padding-bottom:16px;margin-bottom:24px;text-align:center}
.hdr h1{font-size:18px;font-weight:bold}.hdr p{font-size:12px;color:#64748b;margin-top:3px}
.meta{display:flex;gap:24px;justify-content:center;margin-top:10px;flex-wrap:wrap}
.mi{font-size:11px}.ml{color:#64748b}.mv{font-weight:bold}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
.pb{break-inside:avoid;page-break-inside:avoid}
.pb img{width:100%;height:200px;object-fit:cover;border:1px solid #e2e8f0;border-radius:4px;display:block}
.pc{font-size:10px;color:#64748b;text-align:center;margin-top:3px}
@media print{body{padding:12px}}
</style></head><body>
<div class="hdr">
  <h1>Sample Completion Photos / صور الإنجاز</h1>
  <p>Work Completion Documentation</p>
  <div class="meta">
    <div class="mi"><span class="ml">Branch: </span><span class="mv">${label}</span></div>
    <div class="mi"><span class="ml">Request #: </span><span class="mv">${job.id}</span></div>
    <div class="mi"><span class="ml">Date: </span><span class="mv">${new Date().toLocaleDateString('en-GB')}</span></div>
    <div class="mi"><span class="ml">Total: </span><span class="mv">${photos.length} photos</span></div>
  </div>
</div>
<div class="grid">${photos.map((src, i) => `<div class="pb"><img src="${src}" alt="Photo ${i + 1}"/><div class="pc">Photo ${i + 1} / ${photos.length}</div></div>`).join('')}</div>
<script>window.onload=()=>window.print();</script>
</body></html>`);
  win.document.close();
}

/* ── Work Receiving Paper PDF ─────────────────────── */
function printWorkReceiving(job) {
  const label = branchLabel(job);
  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to generate PDF.'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Work Receiving Paper – ${label}</title>
<style>
*{box-sizing:border-box}
body{font-family:Arial,sans-serif;padding:40px;color:#1e293b;max-width:740px;margin:auto;font-size:13px}
.title{font-size:18px;font-weight:bold;text-align:center;border:2px solid #0F172A;padding:12px;margin-bottom:24px}
.title-ar{font-size:14px;color:#334155;margin-top:4px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px}
.ibox{border:1px solid #e2e8f0;padding:10px 14px;border-radius:6px}
.il{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.5px}
.iv{font-size:14px;font-weight:bold;margin-top:3px}
.stitle{font-size:11px;font-weight:bold;background:#f1f5f9;padding:7px 12px;margin:18px 0 10px;border-left:3px solid #0F172A;text-transform:uppercase;letter-spacing:.5px}
.desc{font-size:13px;line-height:1.7;padding:8px 0}
table{width:100%;border-collapse:collapse;font-size:12px}
th{background:#0F172A;color:#fff;padding:8px 12px;text-align:left;font-weight:600}
td{border:1px solid #e2e8f0;padding:8px 12px}
tr:nth-child(even) td{background:#f8fafc}
.confirm{margin-top:20px;border:1px solid #e2e8f0;padding:14px;border-radius:6px;font-size:12px;line-height:1.8}
.sig{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}
.sb{border-top:1.5px solid #334155;padding-top:10px;font-size:12px;color:#64748b}
.sn{font-size:13px;font-weight:bold;color:#1e293b;margin-bottom:4px}
.sl{display:block;margin-top:28px}
@media print{body{padding:24px}}
</style></head><body>
<div class="title">Work Receiving Paper<div class="title-ar">ورقة استلام الأعمال</div></div>
<div class="grid2">
  <div class="ibox"><div class="il">Customer / العميل</div><div class="iv">Herfy Restaurant Co.</div></div>
  <div class="ibox"><div class="il">Branch / الفرع</div><div class="iv">${label}</div></div>
  <div class="ibox"><div class="il">Request Number / رقم الطلب</div><div class="iv">${job.id}</div></div>
  <div class="ibox"><div class="il">Date / التاريخ</div><div class="iv">${new Date().toLocaleDateString('en-GB')}</div></div>
</div>
<div class="stitle">Work Description / وصف العمل</div>
<div class="desc">${job.problemDescription || '—'}</div>
${job.workDone ? `<div class="stitle">Work Completed / العمل المنجز</div><div class="desc">${job.workDone}</div>` : ''}
<div class="stitle">Services Performed / الخدمات المنجزة</div>
<p style="font-size:11px;color:#64748b;margin-bottom:8px">* Excludes transportation, crane, and external support charges / لا تشمل رسوم النقل والرافعات والدعم الخارجي</p>
<table>
<thead><tr><th style="width:40px">#</th><th>Service Item / البند</th><th style="width:110px">Status / الحالة</th></tr></thead>
<tbody><tr><td>1</td><td>${job.problemDescription || 'Maintenance services as per agreed scope'}</td><td>✓ Completed</td></tr></tbody>
</table>
<div class="confirm">
  We hereby confirm that the above-mentioned work has been completed satisfactorily and in full accordance with the required standards and specifications.<br/><br/>
  نؤكد بموجب هذا أن الأعمال المذكورة أعلاه قد اكتملت بشكل مُرضٍ ووفقاً للمعايير والمواصفات المطلوبة.
</div>
<div class="sig">
  <div class="sb"><div class="sn">Tariq Alalyani</div>Prepared By / أعده<span class="sl">Signature: _______________</span></div>
  <div class="sb"><div class="sn">[Client Representative]</div>Received By / استلم من<span class="sl">Signature: _______________</span></div>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`);
  win.document.close();
}

/* ── HTML escape helper ───────────────────────────── */
function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ── Excluded item detection ──────────────────────── */
const EXCLUDE_RE = /\b(transport|transfer|crane|mobiliz|mobilisati|mob\b|external\s*support|ext\.?\s*support|admin\s*fee|freight|shipping|delivery|site\s*visit|call\s*out|call-out|رافعة|نقل|تعبئة|تنقل|شحن|زيارة|رسوم)\b/i;
function isExcluded(text) { return EXCLUDE_RE.test(text); }
function hasArabic(text)  { return /[؀-ۿ]/.test(text); }

/* ── PDF.js lazy loader ───────────────────────────── */
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(s);
  });
}

async function extractPdfText(dataUrl) {
  const lib = await loadPdfJs();
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const pdf = await lib.getDocument({ data: bytes }).promise;
  let text = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text;
}

/* ── Invoice text parser ──────────────────────────── */
function parseInvoice(text) {
  const lines    = text.split('\n').map(l => l.trim()).filter(Boolean);
  const full     = lines.join('\n');

  const grab = (patterns) => {
    for (const p of patterns) {
      const m = full.match(p);
      if (m) return m[1]?.trim() || null;
    }
    return null;
  };

  const grabNum = (patterns) => {
    const v = grab(patterns);
    if (!v) return null;
    const n = parseFloat(v.replace(/,/g, ''));
    return isNaN(n) ? null : n;
  };

  const invoiceNumber = grab([
    /(?:Invoice\s*(?:No\.?|Number|#)|فاتورة\s*رقم|رقم\s*الفاتورة)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
    /(?:Inv\.?\s*No\.?)\s*[:\-]?\s*([A-Z0-9\-\/]+)/i,
  ]);

  const invoiceDate = grab([
    /(?:Invoice\s*Date|Date\s*of\s*Invoice|التاريخ|تاريخ\s*الفاتورة)\s*[:\-]?\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(?:Date)\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
  ]);

  const customerName = grab([
    /(?:Bill\s*To|Billed\s*To|Customer|Client|Sold\s*To|To\s*:|إلى)\s*[:\-]?\s*\n?\s*([^\n]{3,80})/i,
  ]);

  const branchNumber = grab([
    /(?:Herfy|هرفي)\s*(?:Branch\s*)?#?\s*(\d{2,4})/i,
  ]);

  const grandTotal = grabNum([
    /(?:Grand\s*Total|Total\s*(?:Amount\s*)?(?:incl\.?|including|with|شامل)\s*(?:VAT|Tax|ضريبة)|الإجمالي\s*(?:الكلي|النهائي|شامل)|المبلغ\s*الإجمالي)\s*[:\-]?\s*(?:SAR|SR|ر\.?س\.?)?\s*([\d,]+\.?\d*)/i,
    /(?:Total\s*(?:Due|Payable)|المستحق)\s*[:\-]?\s*(?:SAR|SR|ر\.?س\.?)?\s*([\d,]+\.?\d*)/i,
    /(?:TOTAL)\s*(?:SAR|SR|ر\.?س\.?)?\s*([\d,]+\.?\d*)/,
  ]);

  const vatAmount = grabNum([
    /(?:VAT\s*(?:Amount)?|Tax\s*Amount|ضريبة\s*(?:القيمة\s*المضافة)?|الضريبة)\s*[:\-]?\s*(?:SAR|SR|ر\.?س\.?)?\s*([\d,]+\.?\d*)/i,
  ]);

  const subtotal = grabNum([
    /(?:Sub\s*[-\s]?Total|Amount\s*(?:Before\s*VAT|Excl\.?\s*VAT)|المجموع\s*(?:قبل\s*الضريبة|الفرعي)|قبل\s*الضريبة)\s*[:\-]?\s*(?:SAR|SR|ر\.?س\.?)?\s*([\d,]+\.?\d*)/i,
  ]);

  // Derive grand total if missing but sub+vat are present
  const computedGrandTotal = grandTotal ?? (subtotal != null && vatAmount != null ? subtotal + vatAmount : null);

  // Extract service description lines
  const amountRe   = /^[\d,\.\s]+(?:SAR|SR|ر\.?س\.?)?$/i;
  const headerRe   = /^(?:description|qty|quantity|unit|price|amount|total|subtotal|vat|tax|#|item|no\.|serial|رقم|الوصف|الكمية|السعر|المبلغ)/i;
  const skipRe     = /(?:tel|fax|email|www\.|@|P\.O\.|VAT\s*No|CR\s*No|رقم\s*(?:ضريبي|سجل)|Invoice|فاتورة|Page\s*\d)/i;

  const serviceLines = lines.filter(line => {
    if (line.length < 5) return false;
    if (amountRe.test(line)) return false;
    if (headerRe.test(line)) return false;
    if (skipRe.test(line)) return false;
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(line)) return false;
    const words = line.split(/\s+/).filter(w => w.length > 2);
    return words.length >= 2;
  });

  const confidence = computedGrandTotal != null ? 'high' : subtotal != null ? 'medium' : 'low';

  return { invoiceNumber, invoiceDate, customerName, branchNumber, subtotal, vatAmount, grandTotal: computedGrandTotal, serviceLines, confidence };
}

/* ── Load xlsx-populate browser build on demand ─── */
function loadXlsxPopulate() {
  if (window.XlsxPopulate) return Promise.resolve(window.XlsxPopulate);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = '/xlsx-populate.min.js';
    s.onload = () => resolve(window.XlsxPopulate);
    s.onerror = () => reject(new Error('Failed to load xlsx-populate'));
    document.head.appendChild(s);
  });
}

/* ── Excel template filler (xlsx-populate) ───────── */
async function downloadFilledExcel(job, items, date) {
  const XlsxPopulate = await loadXlsxPopulate();
  const res = await fetch('/work-receiving-template.xlsx');
  const buf = await res.arrayBuffer();
  const wb  = await XlsxPopulate.fromDataAsync(buf);
  const ws  = wb.sheet('Work Receiving Note');

  // Fill date (D4 = English date next to "Date :", E4 = Arabic date side)
  ws.cell('D4').value(date);
  ws.cell('E4').value(date);

  // Fill work descriptions D11–D34 (24 rows total)
  for (let i = 0; i < 24; i++) {
    const cell = ws.cell(`D${11 + i}`);
    cell.value(i < items.length ? items[i].english : '');
  }

  const outBuf = await wb.outputAsync();
  const blob   = new Blob([outBuf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url    = URL.createObjectURL(blob);
  const a      = document.createElement('a');
  a.href       = url;
  a.download   = `Work-Receiving-Note-Herfy${job.branchNumber}-${date.replace(/\//g, '-')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Work Receiving Paper — Herfy template print ─── */
function printWorkReceivingFilled(job, items, date, branchDisplay) {
  const logoUrl = `${window.location.origin}/herfy-logo.png`;
  const rows = [...items];
  while (rows.length < 24) rows.push(null);

  const win = window.open('', '_blank');
  if (!win) { alert('Please allow popups to generate PDF.'); return; }

  win.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Work Receiving Note – Herfy ${job.branchNumber}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#000}
.page{display:flex;width:100%;min-height:100vh}
.sidebar{width:44px;background:#1a56db;flex-shrink:0;display:flex;align-items:center;justify-content:center}
.sidebar span{color:#fff;font-size:8.5px;font-weight:bold;letter-spacing:2.5px;writing-mode:vertical-rl;transform:rotate(180deg);white-space:nowrap;text-transform:uppercase}
.main{flex:1;padding:20px 24px 28px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
.co-ar{font-size:17px;font-weight:bold;direction:rtl;line-height:1.4}
.co-en{font-size:13px;font-weight:bold;letter-spacing:.4px;margin-top:2px}
.logo{height:58px;width:auto;object-fit:contain}
.date-row{display:flex;justify-content:space-between;align-items:center;border-top:1.5px solid #000;border-bottom:1.5px solid #000;padding:5px 0;margin-bottom:8px}
.title{text-align:center;font-size:15px;font-weight:bold;padding:6px 0;border-bottom:1.5px solid #000;margin-bottom:8px}
.subtitle{display:flex;justify-content:space-between;font-size:11px;margin-bottom:10px;gap:12px}
.subtitle .ar{direction:rtl;text-align:right}
table{width:100%;border-collapse:collapse;table-layout:fixed}
th{border:1.5px solid #000;padding:6px 8px;font-weight:bold;text-align:center;font-size:12px}
td{border:1.5px solid #000;padding:5px 8px;height:30px;vertical-align:middle;font-size:12px}
.nc{width:38px;text-align:center}
.rc{width:100px}
.btm{display:flex;justify-content:flex-end;margin-top:6px}
.stamp-wrap{text-align:left;font-size:11px;font-weight:bold}
.stamp-box{border:1.5px solid #000;height:100px;width:240px;margin-top:4px}
.sigs{display:flex;gap:16px;margin-top:24px}
.sig-box{flex:1;border:1.5px solid #000;padding:12px 14px;min-height:90px;display:flex;flex-direction:column;justify-content:space-between}
.sig-line{border-bottom:1px dotted #555;height:18px;margin:4px 0}
.sig-label{font-size:11.5px;font-weight:bold;text-align:center;margin-top:8px}
@media print{html,body,page{height:auto;min-height:0}button{display:none!important}}
</style></head><body>
<div class="page">
  <div class="sidebar"><span>ADVERTISING INSTALLATION SIGNAGE</span></div>
  <div class="main">
    <div class="hdr">
      <div>
        <div class="co-ar">شـركـة هـرفـي للخدمـات الغـذائيـة(ذ.م.م)</div>
        <div class="co-en">HERFY FOOD SERVICES CO.LTD.</div>
      </div>
      <img class="logo" src="${logoUrl}" onerror="this.style.display='none'" alt="Herfy" />
    </div>

    <div class="date-row">
      <div>Date : &nbsp;${esc(date)}</div>
      <div style="direction:rtl">التاريخ : &nbsp;${esc(date)} &nbsp; ٢٠م</div>
    </div>

    <div class="title">
      استـــلام اعمـــال &nbsp;&nbsp;&nbsp; Work Receiving Note
    </div>

    <div class="subtitle">
      <div>I the undersigned hereby have received following</div>
      <div class="ar">استلامت انا المـوقع ادناه اعمـال الدعايـة و الاعلان التـالى ذكرهـا</div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="nc">#</th>
          <th>Work Description</th>
          <th class="rc">Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((item, i) => `<tr>
          <td class="nc">${item ? i + 1 : ''}</td>
          <td>${item ? esc(item.english) : ''}</td>
          <td></td>
        </tr>`).join('')}
      </tbody>
    </table>

    <div class="btm">
      <div class="stamp-wrap">Rest.Stamp<div class="stamp-box"></div></div>
    </div>

    <div class="sigs">
      <div class="sig-box">
        <div>
          <div style="font-size:11px;color:#555">Signature</div>
          <div class="sig-line"></div>
        </div>
        <div class="sig-label">Advertising Installation Supervisor</div>
      </div>
      <div class="sig-box">
        <div>
          <div style="font-size:11px;color:#555">Signature</div>
          <div class="sig-line"></div>
          <div style="font-size:11px;color:#555;margin-top:8px">Name</div>
          <div class="sig-line"></div>
        </div>
        <div class="sig-label">Restaurant Manager/In-charge</div>
      </div>
    </div>
  </div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),400);</script>
</body></html>`);
  win.document.close();
}

/* ════════════════════════════════════════════════════
   INVOICE ANALYSIS CARD
════════════════════════════════════════════════════ */
function InvoiceAnalysisCard({ data, parsing, error, job, onUseItems }) {
  const [saving, setSaving]       = useState(false);
  const [amountSaved, setAmtSaved] = useState(false);
  const [manualAmt, setManualAmt] = useState('');

  const fmt = n => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const detectedTotal = data?.grandTotal ?? null;
  const effectiveAmt  = detectedTotal ?? (manualAmt !== '' ? parseFloat(manualAmt) : null);

  const saveAmount = async () => {
    if (effectiveAmt == null || isNaN(effectiveAmt)) return;
    setSaving(true);
    await updateRequest(job.id, { invoiceAmount: effectiveAmt });
    setSaving(false);
    setAmtSaved(true);
  };

  if (parsing) return (
    <div className="card" style={{ borderLeft: '4px solid #D4A843' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 22 }}>⏳</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Reading Invoice…</div>
          <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Detecting grand total amount</div>
        </div>
      </div>
    </div>
  );

  if (error) return (
    <div className="card" style={{ borderLeft: '4px solid #EF4444' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>⚠️ Invoice Read Failed</div>
      <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>{error}</div>
    </div>
  );

  if (!data) return null;

  const isImage    = !!data.isImage;
  const hasTotal   = detectedTotal != null;
  const canSave    = effectiveAmt != null && !isNaN(effectiveAmt);

  return (
    <div className="card" style={{ borderLeft: '4px solid #D4A843' }}>
      <div style={{ fontSize: 10, color: '#D4A843', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
        🦅 Aladheed — Invoice Grand Total
      </div>

      {/* Grand Total display */}
      {hasTotal ? (
        <div style={{ background: '#0F172A', borderRadius: 10, padding: '18px', marginBottom: 14, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, marginBottom: 6 }}>Invoice Grand Total</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: '#D4A843' }}>SAR {fmt(detectedTotal)}</div>
        </div>
      ) : (
        <div style={{ background: '#FEF9C3', borderRadius: 10, padding: '14px', marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#D97706', marginBottom: 6 }}>
            {isImage ? '📷 Image invoice — manual entry required' : '⚠️ Grand Total not detected. Please enter manually.'}
          </div>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 0 }}>
            <span style={{ padding: '0 12px', fontSize: 13, fontWeight: 700, color: '#64748B', background: '#F8FAFC', border: '1.5px solid #E2E8F0', borderRight: 'none', borderRadius: '10px 0 0 10px', display: 'flex', alignItems: 'center' }}>SAR</span>
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={manualAmt}
              onChange={e => { setManualAmt(e.target.value); setAmtSaved(false); }}
              style={{ borderRadius: '0 10px 10px 0', borderLeft: 'none', flex: 1, background: '#fff' }}
            />
          </div>
        </div>
      )}

      {/* Pre-fill Work Receiving Paper (silent, no items displayed) */}
      {data.serviceLines?.length > 0 && (
        <button onClick={() => onUseItems(data.serviceLines.join('\n'))}
          style={{ width: '100%', padding: '10px', marginBottom: 10, background: '#047857', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          📋 Pre-fill Work Receiving Paper from Invoice
        </button>
      )}

      {/* Save to request */}
      <button onClick={saveAmount} disabled={saving || amountSaved || !canSave}
        style={{
          width: '100%', padding: '11px', borderRadius: 10, border: 'none',
          cursor: canSave && !amountSaved ? 'pointer' : 'not-allowed',
          background: amountSaved ? '#166534' : canSave ? '#0F172A' : '#E2E8F0',
          color:      amountSaved ? '#fff'    : canSave ? '#D4A843' : '#94A3B8',
          fontWeight: 700, fontSize: 13,
        }}>
        {amountSaved ? '✅ Saved to Request'
          : saving    ? '⏳ Saving…'
          : canSave   ? `💰 Save SAR ${fmt(effectiveAmt)} to Request`
          : '💰 Enter amount above to save'}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   WORK RECEIVING SECTION (toggle wrapper)
════════════════════════════════════════════════════ */
function WorkReceivingSection({ job, prefilledText }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button className="btn mb8" style={{ background: '#047857', color: '#fff', border: 'none' }}
        onClick={() => setOpen(true)}>
        📋 Fill Work Receiving Paper
        {prefilledText && <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.85 }}>· Items ready from invoice ✓</span>}
      </button>
    );
  }
  return (
    <div className="card" style={{ border: '2px solid #047857', marginBottom: 0 }}>
      <WorkReceivingFiller job={job} prefilledText={prefilledText} onClose={() => setOpen(false)} />
    </div>
  );
}

/* ════════════════════════════════════════════════════
   WORK RECEIVING FILLER (3-step workflow)
════════════════════════════════════════════════════ */
function WorkReceivingFiller({ job, prefilledText, onClose }) {
  const [step, setStep]           = useState(1);
  const [rawInput, setRawInput]   = useState(prefilledText || '');
  const [items, setItems]         = useState([]);
  const [date, setDate]           = useState(new Date().toLocaleDateString('en-GB'));
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [xlsxError, setXlsxError]     = useState('');
  const b = BRANCHES.find(b => b.num === String(job.branchNumber));
  const branchDisplay             = b ? `Herfy ${job.branchNumber} – ${b.area}` : `Herfy ${job.branchNumber}`;

  /* ── Step 1 → 2: parse and classify ── */
  const processItems = () => {
    const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
    const processed = lines.map((line, i) => ({
      id: i,
      original: line,
      english: hasArabic(line) ? '' : line,
      include: !isExcluded(line),
      isArabic: hasArabic(line),
      excludeReason: isExcluded(line) ? 'Non-service charge (transport/crane/admin)' : null,
    }));
    setItems(processed);
    setStep(2);
  };

  const updateItem = (id, field, val) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));

  const included = items.filter(it => it.include);
  const excluded = items.filter(it => !it.include);
  const needsTranslation = included.some(it => it.isArabic && !it.english.trim());

  const generate = () => printWorkReceivingFilled(job, included, date, branchDisplay);

  const handleDownloadExcel = async () => {
    setXlsxLoading(true);
    setXlsxError('');
    try {
      await downloadFilledExcel(job, included, date);
    } catch (err) {
      setXlsxError('Failed to generate Excel: ' + err.message);
    } finally {
      setXlsxLoading(false);
    }
  };

  /* ─── STEP 1: Enter invoice items ─── */
  if (step === 1) return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 13, padding: 0 }}>← Cancel</button>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#047857' }}>📋 Fill Work Receiving Paper</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">Date / التاريخ</label>
          <input className="input" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="label">Branch</label>
          <input className="input" value={branchDisplay} readOnly style={{ background: '#F8FAFC', color: '#64748B' }} />
        </div>
      </div>

      <div className="form-group">
        <label className="label">Invoice Items / بنود الفاتورة *</label>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 8, lineHeight: 1.5 }}>
          Paste all invoice items below — one per line. Include everything; Aladheed will filter out transportation, crane, and non-service charges automatically.
        </div>
        <textarea
          className="textarea"
          rows={10}
          placeholder={`Example:\nLED module replacement\nDriver replacement\nSignage cleaning\nTransportation\nCrane hire`}
          value={rawInput}
          onChange={e => setRawInput(e.target.value)}
          style={{ fontFamily: 'inherit', lineHeight: 1.7 }}
        />
      </div>

      <button className="btn" style={{ width: '100%', background: '#0F172A', color: '#D4A843', border: 'none', fontWeight: 800, fontSize: 14 }}
        onClick={processItems} disabled={!rawInput.trim()}>
        Process Items →
      </button>
    </div>
  );

  /* ─── STEP 2: Review & edit ─── */
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: 13, padding: 0 }}>← Edit Items</button>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#047857' }}>Review & Confirm</div>
      </div>

      {/* Included items */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#15803D', marginBottom: 8 }}>
          ✅ Items to Include — {included.length} service item{included.length !== 1 ? 's' : ''}
        </div>
        {included.length === 0 && (
          <div style={{ fontSize: 12, color: '#94A3B8', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8 }}>
            No service items found. Go back and add items.
          </div>
        )}
        {included.map((item, i) => (
          <div key={item.id} style={{ marginBottom: 10, padding: '10px 12px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0' }}>
            <div style={{ fontSize: 11, color: '#64748B', marginBottom: 6 }}>
              {i + 1}. Original: <span style={{ color: '#334155', fontWeight: 600 }}>{item.original}</span>
              {item.isArabic && (
                <span style={{ marginLeft: 8, background: '#FEF9C3', color: '#D97706', fontSize: 10, padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>
                  Arabic → needs English
                </span>
              )}
            </div>
            <input
              className="input"
              style={{ fontSize: 13 }}
              placeholder="English description for Work Receiving Paper..."
              value={item.english}
              onChange={e => updateItem(item.id, 'english', e.target.value)}
            />
            <button onClick={() => updateItem(item.id, 'include', false)}
              style={{ fontSize: 11, color: '#EF4444', background: 'none', border: 'none', cursor: 'pointer', marginTop: 5, padding: 0 }}>
              ✕ Remove from Work Receiving Paper
            </button>
          </div>
        ))}
      </div>

      {/* Excluded items */}
      {excluded.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 8 }}>
            ❌ Excluded — {excluded.length} non-service item{excluded.length !== 1 ? 's' : ''}
          </div>
          {excluded.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#FEF2F2', borderRadius: 8, marginBottom: 6, border: '1px solid #FECACA' }}>
              <span style={{ fontSize: 12, color: '#64748B', flex: 1 }}>{item.original}</span>
              <span style={{ fontSize: 10, color: '#DC2626', fontWeight: 600, whiteSpace: 'nowrap' }}>Non-service</span>
              <button onClick={() => updateItem(item.id, 'include', true)}
                style={{ fontSize: 11, color: '#0369A1', background: 'none', border: '1px solid #BAE6FD', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', flexShrink: 0 }}>
                Include
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {needsTranslation && (
        <div style={{ padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A', fontSize: 12, color: '#92400E', marginBottom: 12 }}>
          ⚠️ Some items need an English translation. Please fill in the English text above before generating.
        </div>
      )}

      {included.length > 24 && (
        <div style={{ padding: '10px 14px', background: '#EFF6FF', borderRadius: 8, border: '1px solid #BFDBFE', fontSize: 12, color: '#1D4ED8', marginBottom: 12 }}>
          ℹ️ The template has 24 rows. Only the first 24 items will appear. Consider splitting into two documents.
        </div>
      )}

      {xlsxError && (
        <div style={{ padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, border: '1px solid #FECACA', fontSize: 12, color: '#DC2626', marginBottom: 12 }}>
          ⚠️ {xlsxError}
        </div>
      )}

      {/* Output buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button className="btn" onClick={handleDownloadExcel}
          disabled={included.length === 0 || needsTranslation || xlsxLoading}
          style={{ width: '100%', background: '#047857', color: '#fff', border: 'none', fontWeight: 800, fontSize: 14, padding: '13px' }}>
          {xlsxLoading ? '⏳ Generating Excel…' : '📥 Download Filled Excel (.xlsx)'}
        </button>

        <button className="btn" onClick={generate}
          disabled={included.length === 0 || needsTranslation}
          style={{ width: '100%', background: '#1E293B', color: '#94A3B8', border: 'none', fontWeight: 700, fontSize: 13, padding: '11px' }}>
          🖨️ Print / Export PDF
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════════════════ */
export default function AladheedView({ job: initialJob, onClose }) {
  const [activeJob, setActiveJob] = useState(initialJob || null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getRequests().then(all => {
      setJobs(all.filter(r => r.status === 'completed'));
      setLoading(false);
    });
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9' }}>
      {/* ── Aladheed sticky header ── */}
      <div style={{
        background: '#0F172A', padding: '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeJob && (
            <button onClick={() => setActiveJob(null)} style={{
              background: 'rgba(255,255,255,0.08)', border: 'none', color: '#94A3B8',
              fontSize: 13, cursor: 'pointer', padding: '5px 12px', borderRadius: 6,
            }}>
              ← Dashboard
            </button>
          )}
          <div>
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 16, letterSpacing: '-0.3px' }}>
              🦅 Aladheed | العضيد
            </div>
            <div style={{ color: '#475569', fontSize: 11 }}>AI Document & Email Assistant</div>
          </div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: '1px solid #334155', color: '#94A3B8',
          borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
        }}>
          ✕ Exit
        </button>
      </div>

      <div className="page">
        {loading
          ? <div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>
          : activeJob
            ? <AladheedSession job={activeJob} onBack={() => setActiveJob(null)} />
            : <AladheedDashboard jobs={jobs} onSelectJob={setActiveJob} />
        }
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════ */
function AladheedDashboard({ jobs, onSelectJob }) {
  const withPhotos = jobs.filter(j => j.completionPhotos?.length > 0).length;
  const withEmail  = jobs.filter(j => !!loadSession(j.id)?.emailBody).length;
  const missing    = jobs.length - withPhotos;

  return (
    <div>
      {/* Title */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A' }}>📂 Document Dashboard</div>
        <div style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>لوحة إدارة الوثائق والمراسلات</div>
      </div>

      {/* Stats */}
      <div className="stats-bar">
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#0F172A' }}>{jobs.length}</div>
          <div className="stat-lbl">Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#16A34A' }}>{withPhotos}</div>
          <div className="stat-lbl">Photos Ready</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#D97706' }}>{missing}</div>
          <div className="stat-lbl">Missing Photos</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#D4A843' }}>{withEmail}</div>
          <div className="stat-lbl">Email Ready</div>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 32 }}>
          <div className="empty-icon">🦅</div>
          <div className="empty-title">No completed jobs yet</div>
          <div className="empty-sub">Jobs appear here once marked as completed</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#334155', margin: '20px 0 10px' }}>
            Completed Jobs — Tap to prepare documents
          </div>
          {jobs.map(job => {
            const hasPhotos = !!job.completionPhotos?.length;
            const session   = loadSession(job.id);
            const hasEmail  = !!session?.emailBody;
            return (
              <div key={job.id} className="card"
                style={{ cursor: 'pointer', borderLeft: '4px solid #D4A843' }}
                onClick={() => onSelectJob(job)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="card-id">{job.id}</div>
                    <div className="card-branch">Herfy {job.branchNumber}</div>
                    {(() => { const info = BRANCHES.find(b => b.num === String(job.branchNumber)); return <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>📍 {info ? info.area : 'Location: Not specified'}</div>; })()}
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 3 }}>{formatDate(job.createdAt)}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
                      background: hasPhotos ? '#F0FDF4' : '#FEF9C3',
                      color: hasPhotos ? '#16A34A' : '#D97706',
                    }}>
                      {hasPhotos ? '📸 Photos ✓' : '⚠️ No Photos'}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
                      background: hasEmail ? '#F0FDF4' : '#F8FAFC',
                      color: hasEmail ? '#16A34A' : '#94A3B8',
                    }}>
                      {hasEmail ? '✉️ Email ✓' : '○ Email Pending'}
                    </span>
                  </div>
                </div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 8, lineHeight: 1.5 }}>
                  {(job.problemDescription || '').substring(0, 90)}{(job.problemDescription?.length || 0) > 90 ? '…' : ''}
                </div>
                <div style={{ marginTop: 10, textAlign: 'right', fontSize: 12, color: '#D4A843', fontWeight: 700 }}>
                  🦅 Open Aladheed →
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════
   SESSION
════════════════════════════════════════════════════ */
function AladheedSession({ job }) {
  const [tab, setTab]                   = useState('docs');
  const [docs, setDocs]                 = useState([]);
  const [classifyModal, setClassifyModal] = useState(null);
  const [emailSubject, setEmailSubject] = useState(defaultSubject(job));
  const [emailBody, setEmailBody]       = useState(defaultBody(job));
  const [emailReady, setEmailReady]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [dragActive, setDragActive]     = useState(false);
  const fileInputRef = useRef();

  // Invoice analysis state
  const [invoiceData, setInvoiceData]     = useState(null);
  const [invoiceParsing, setInvParsing]   = useState(false);
  const [invoiceError, setInvError]       = useState('');
  const [prefilledText, setPrefilledText] = useState('');

  const analyzeInvoice = async (dataUrl, mimeType) => {
    setInvParsing(true);
    setInvError('');
    setInvoiceData(null);
    try {
      if (mimeType?.startsWith('image/')) {
        setInvoiceData({ isImage: true });
      } else if (mimeType === 'application/pdf' || dataUrl.startsWith('data:application/pdf')) {
        const text   = await extractPdfText(dataUrl);
        const parsed = parseInvoice(text);
        setInvoiceData(parsed);
      } else {
        // Try treating as text (Excel text export, CSV, etc.)
        const parsed = parseInvoice(atob(dataUrl.split(',')[1] || ''));
        setInvoiceData(parsed);
      }
    } catch (err) {
      setInvError('Could not analyze the invoice file: ' + err.message);
    } finally {
      setInvParsing(false);
    }
  };

  // Load saved email session
  useEffect(() => {
    const s = loadSession(job.id);
    if (s?.emailSubject) setEmailSubject(s.emailSubject);
    if (s?.emailBody)    { setEmailBody(s.emailBody); setEmailReady(true); }
  }, [job.id]);

  const completionPhotos = job.completionPhotos || [];

  // Checklist derived state
  const hasInvoice = docs.some(d => d.classification === 'invoice');
  const hasCompPics = docs.some(d => d.classification === 'completion_pics') || completionPhotos.length > 0;
  const hasWorkRec  = docs.some(d => d.classification === 'work_receiving');
  const allReady    = hasInvoice && hasCompPics && hasWorkRec;

  // Process dropped/selected files
  const processFiles = async (files) => {
    const arr = Array.from(files);
    const newDocs = await Promise.all(arr.map(async file => {
      const data = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      return {
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type: file.type,
        size: file.size,
        data,
        classification: classifyFile(file.name),
      };
    }));
    setDocs(prev => [...prev, ...newDocs]);
    const firstUnknown = newDocs.find(d => d.classification === 'unknown');
    if (firstUnknown) setClassifyModal(firstUnknown);
    // Auto-analyze invoice files
    const invoiceDoc = newDocs.find(d => d.classification === 'invoice');
    if (invoiceDoc) analyzeInvoice(invoiceDoc.data, invoiceDoc.type);
  };

  const removeDoc = id => setDocs(prev => prev.filter(d => d.id !== id));

  const applyClassification = (docId, cls) => {
    setDocs(prev => prev.map(d => d.id === docId ? { ...d, classification: cls } : d));
    const remaining = docs.filter(d => d.classification === 'unknown' && d.id !== docId);
    setClassifyModal(remaining[0] || null);
    // If user manually classified as invoice, trigger analysis
    if (cls === 'invoice') {
      const doc = docs.find(d => d.id === docId);
      if (doc) analyzeInvoice(doc.data, doc.type);
    }
  };

  const prepareEmail = () => {
    saveSession(job.id, { emailSubject, emailBody });
    setEmailReady(true);
    setTab('email');
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${emailSubject}\n\n${emailBody}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const saveDraft = () => saveSession(job.id, { emailSubject, emailBody });

  const downloadAll = () => {
    docs.forEach((doc, i) => setTimeout(() => downloadBase64(doc.name, doc.data), i * 400));
  };

  return (
    <div>
      {/* ── Job header ── */}
      <div className="card" style={{ borderLeft: '4px solid #D4A843' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 10, color: '#D4A843', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
              Active Aladheed Session
            </div>
            <div className="card-id">{job.id}</div>
            <div className="card-branch">Herfy {job.branchNumber}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end' }}>
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#F0FDF4', color: '#16A34A', fontWeight: 600 }}>
              ✅ Completed
            </span>
            {completionPhotos.length > 0 && (
              <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: '#EFF6FF', color: '#0369A1', fontWeight: 600 }}>
                📸 {completionPhotos.length} Photos
              </span>
            )}
          </div>
        </div>
        {job.problemDescription && (
          <div style={{ fontSize: 12, color: '#64748B', marginTop: 8, lineHeight: 1.5 }}>{job.problemDescription}</div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="tabs mt16">
        <button className={`tab-btn ${tab === 'docs' ? 'active' : ''}`} onClick={() => setTab('docs')}>
          📁 Documents
        </button>
        <button className={`tab-btn ${tab === 'email' ? 'active' : ''}`} onClick={() => setTab('email')}>
          ✉️ Email{emailReady ? ' ✓' : ''}
        </button>
      </div>

      {/* ═══════════════ DOCUMENTS TAB ═══════════════ */}
      {tab === 'docs' && (
        <div>
          {/* Checklist */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#0F172A' }}>📋 Attachment Checklist</div>
            {[
              { label: 'Invoice / فاتورة',                               ready: hasInvoice },
              { label: 'Completion Photos / صور الإنجاز',                ready: hasCompPics },
              { label: 'Work Receiving Paper / ورقة استلام الأعمال',     ready: hasWorkRec },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: 18 }}>{item.ready ? '✅' : '⭕'}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: item.ready ? '#15803D' : '#64748B', flex: 1 }}>{item.label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20,
                  background: item.ready ? '#F0FDF4' : '#FEF9C3',
                  color: item.ready ? '#16A34A' : '#D97706',
                }}>
                  {item.ready ? 'Ready' : 'Missing'}
                </span>
              </div>
            ))}
            {!allReady && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#FFFBEB', borderRadius: 8, border: '1px solid #FDE68A', fontSize: 12, color: '#92400E' }}>
                ⚠️ Some required documents are missing. You can still prepare the email, but please review before sending.
              </div>
            )}
            {allReady && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0', fontSize: 12, color: '#15803D', fontWeight: 600 }}>
                ✅ All required documents are ready.
              </div>
            )}
          </div>

          {/* Drag & Drop Upload */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>📎 Upload Documents</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>
              Please upload all related documents here. Aladheed will organize them and prepare the submission email.
            </div>
            <div
              style={{
                border: `2px dashed ${dragActive ? '#D4A843' : '#CBD5E1'}`,
                borderRadius: 12, padding: '28px 20px', textAlign: 'center',
                background: dragActive ? '#FFFDF0' : '#F8FAFC', cursor: 'pointer',
                transition: 'all .2s',
              }}
              onClick={() => fileInputRef.current.click()}
              onDragOver={e => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={e => { e.preventDefault(); setDragActive(false); processFiles(e.dataTransfer.files); }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>Drag & Drop files here</div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>or tap to browse</div>
              <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 6 }}>PDF, JPG, PNG accepted</div>
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf,image/*" multiple hidden onChange={e => processFiles(e.target.files)} />
          </div>

          {/* Uploaded docs list */}
          {docs.length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>📁 Uploaded Documents ({docs.length})</div>
                {docs.length > 1 && (
                  <button onClick={downloadAll} style={{ fontSize: 11, padding: '4px 12px', borderRadius: 8, border: '1.5px solid #E2E8F0', background: '#F8FAFC', color: '#334155', cursor: 'pointer', fontWeight: 600 }}>
                    ⬇️ Download All
                  </button>
                )}
              </div>
              {docs.map(doc => {
                const type      = DOC_TYPES[doc.classification] || DOC_TYPES.other;
                const needsCls  = doc.classification === 'unknown';
                return (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{needsCls ? '❓' : type.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1E293B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.name}</div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{(doc.size / 1024).toFixed(0)} KB</div>
                    </div>
                    {needsCls ? (
                      <button onClick={() => setClassifyModal(doc)} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, border: '1.5px solid #F59E0B', background: '#FFFBEB', color: '#D97706', cursor: 'pointer', fontWeight: 600, flexShrink: 0 }}>
                        Classify
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: type.bg, color: type.color, fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {type.icon} {type.label}
                      </span>
                    )}
                    <button onClick={() => downloadBase64(doc.name, doc.data)} title="Download" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#94A3B8', flexShrink: 0 }}>⬇️</button>
                    <button onClick={() => removeDoc(doc.id)} title="Remove" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: '#EF4444', flexShrink: 0 }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Completion photos from job */}
          {completionPhotos.length > 0 && (
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>
                📸 Completion Photos
                <span style={{ fontSize: 11, fontWeight: 400, color: '#64748B', marginLeft: 8 }}>({completionPhotos.length} — from workshop)</span>
              </div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                These photos are linked to this job and included in the Completion Pics PDF.
              </div>
              <div className="photo-grid">
                {completionPhotos.map((src, i) => (
                  <div key={i} className="photo-thumb"><img src={src} alt="" /></div>
                ))}
              </div>
              <button className="btn mt8" style={{ background: '#0369A1', color: '#fff', border: 'none', marginTop: 12 }}
                onClick={() => printCompletionPics(job, completionPhotos)}>
                📄 Generate Completion Pics PDF
              </button>
            </div>
          )}

          {/* Invoice Analysis */}
          {(invoiceParsing || invoiceError || invoiceData) && (
            <InvoiceAnalysisCard
              data={invoiceData}
              parsing={invoiceParsing}
              error={invoiceError}
              job={job}
              onUseItems={text => setPrefilledText(text)}
            />
          )}

          {/* PDF Actions */}
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>📄 Generate Documents</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 14 }}>Generate standard paperwork for this job.</div>

            <WorkReceivingSection job={job} prefilledText={prefilledText} />

            {completionPhotos.length > 0 && (
              <button className="btn mb8" style={{ background: '#0369A1', color: '#fff', border: 'none' }}
                onClick={() => printCompletionPics(job, completionPhotos)}>
                📸 Generate Completion Pics PDF
              </button>
            )}

            {completionPhotos.length === 0 && (
              <div style={{ fontSize: 12, color: '#94A3B8', padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px dashed #CBD5E1' }}>
                Completion Pics PDF requires completion photos to be uploaded by the workshop first.
              </div>
            )}
          </div>

          {/* Prepare email CTA */}
          <button className="btn" onClick={prepareEmail} style={{
            width: '100%', background: '#D4A843', color: '#0F172A',
            border: 'none', fontWeight: 800, fontSize: 15, padding: '14px',
          }}>
            ✉️ Prepare Email with Aladheed
          </button>
        </div>
      )}

      {/* ═══════════════ EMAIL TAB ═══════════════ */}
      {tab === 'email' && (
        <div>
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0F172A' }}>✉️ Email Draft</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
              Review and edit below, then copy to send from Outlook or Gmail.
            </div>

            <div className="form-group">
              <label className="label">Email Subject / عنوان البريد</label>
              <input className="input" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>

            <div className="form-group">
              <label className="label">Email Body / نص البريد</label>
              <textarea
                className="textarea"
                rows={12}
                value={emailBody}
                onChange={e => setEmailBody(e.target.value)}
                style={{ fontFamily: 'inherit', lineHeight: 1.7 }}
              />
            </div>

            {/* Attachment list */}
            <div style={{ marginBottom: 16, padding: '12px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 8 }}>📎 Attachments to Include</div>
              {[
                hasInvoice                       && { label: 'Invoice',                    icon: '🧾' },
                hasCompPics                      && { label: 'Sample Completion Photos',   icon: '📸' },
                hasWorkRec                       && { label: 'Work Receiving Paper',        icon: '📋' },
                ...docs.filter(d => d.classification === 'other').map(d => ({ label: d.name, icon: '📎' })),
              ].filter(Boolean).map((att, i) => (
                <div key={i} style={{ fontSize: 12, color: '#64748B', padding: '3px 0' }}>{att.icon} {att.label}</div>
              ))}
              {!hasInvoice && !hasCompPics && !hasWorkRec && docs.filter(d => d.classification === 'other').length === 0 && (
                <div style={{ fontSize: 12, color: '#94A3B8' }}>No documents classified yet. Go to Documents tab to upload and classify.</div>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn" onClick={copyEmail} style={{
                flex: 1, background: copied ? '#16A34A' : '#0F172A',
                color: '#fff', border: 'none', fontWeight: 700, fontSize: 14,
              }}>
                {copied ? '✅ Copied!' : '📋 Copy Email'}
              </button>
              <button className="btn btn-outline" onClick={saveDraft} style={{ flex: 1 }}>
                💾 Save Draft
              </button>
            </div>
          </div>

          {/* Tip */}
          <div style={{ padding: '12px 14px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0', fontSize: 12, color: '#15803D' }}>
            💡 After copying the email, paste it into Outlook or Gmail and attach the downloaded PDF files.
          </div>
        </div>
      )}

      {/* ═══════════════ CLASSIFY MODAL ═══════════════ */}
      {classifyModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '0 20px',
        }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '24px 20px', maxWidth: 380, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>❓</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A', marginBottom: 6 }}>Document Type?</div>
            <div style={{ fontSize: 12, color: '#64748B', marginBottom: 18, wordBreak: 'break-all', lineHeight: 1.5 }}>
              This file type is not clear. Please select the correct type for:<br/>
              <strong style={{ color: '#334155' }}>"{classifyModal.name}"</strong>
            </div>
            {Object.entries(DOC_TYPES).map(([key, type]) => (
              <button key={key} onClick={() => applyClassification(classifyModal.id, key)} style={{
                width: '100%', textAlign: 'left', padding: '11px 14px', marginBottom: 8,
                border: '1.5px solid #E2E8F0', borderRadius: 10, cursor: 'pointer',
                background: '#F8FAFC', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 22 }}>{type.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{type.label}</div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{type.ar}</div>
                </div>
              </button>
            ))}
            <button onClick={() => setClassifyModal(null)} style={{
              width: '100%', padding: '10px', background: '#F1F5F9', border: 'none',
              borderRadius: 10, cursor: 'pointer', fontSize: 13, color: '#64748B', marginTop: 4,
            }}>
              Skip / Later
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
