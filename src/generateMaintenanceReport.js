// ── Maintenance Report (bilingual Altasis template) ─────────────
// The document is a static page, public/maintenance-report/template.html,
// built to match Altasis-Maintenance-Report.pdf. The app never edits that
// file: it loads it (in the Preview iframe, or a print window for Export)
// and fills it through the page's own window.setMaintenanceReportData(data).

import { photoSrc } from './storage';
import { getBranchInfo } from './branchData';
import { ADDRESS_AR } from './branchDataAr';

export const MAINTENANCE_REPORT_URL = '/maintenance-report/template.html';

const join = (...parts) => parts.filter(Boolean).join('');
const urls = (photos) => (photos || []).map(photoSrc).filter(Boolean);

// Maps the open request to the template's fields. The ticket number and
// problem description are passed exactly as entered (leading zeros kept);
// anything the request doesn't record stays empty in the report.
export function buildMaintenanceReportData(req) {
  const branchNo = req.branchNumber ? String(req.branchNumber) : '';
  const address = getBranchInfo(branchNo)?.address || '';
  const addressAr = ADDRESS_AR[address] || address;
  const workshop = req.assignedTo === 'majed';

  return {
    ticketNumber:       req.ticketNumber == null ? '' : String(req.ticketNumber),
    problemDescription: req.problemDescription || '',
    reportNo:    req.id || '',
    workOrder:   '',
    serviceDate: '',
    clientAr: branchNo ? join(`هرفي ${branchNo}`, addressAr && ` · ${addressAr}`) : '',
    clientEn: branchNo ? join(`Herfy ${branchNo}`, address && ` · ${address}`) : '',
    assetAr: workshop ? 'فريق الورشة' : '',
    assetEn: workshop ? 'Workshop team' : '',
    // Site photo types map to the report's before / during / after groups.
    photos: {
      before: urls(req.problemPhotos),
      during: urls(req.progressPhotos),
      after:  urls(req.completionPhotos),
    },
    fileName: join('Maintenance-Report', req.id && `_${req.id}`),
  };
}

// Export PDF — opens the template in a print window, fills it, then calls
// window.print() so the user can save it as a PDF.
export async function exportMaintenanceReportPdf(data) {
  const win = window.open(MAINTENANCE_REPORT_URL, '_blank', 'width=820,height=1000,menubar=yes,toolbar=yes');
  if (!win) {
    alert('Pop-up blocked — please allow pop-ups for this site and try again.');
    return;
  }
  // The new window starts on about:blank, so wait for the template itself.
  const ready = await new Promise(resolve => {
    const started = Date.now();
    const tick = () => {
      if (win.closed) return resolve(false);
      if (typeof win.setMaintenanceReportData === 'function' && win.document.readyState === 'complete') return resolve(true);
      if (Date.now() - started > 15000) return resolve(false);
      setTimeout(tick, 100);
    };
    tick();
  });
  if (!ready) return;
  await win.setMaintenanceReportData(data);
  setTimeout(() => { win.focus(); win.print(); }, 250);
}
