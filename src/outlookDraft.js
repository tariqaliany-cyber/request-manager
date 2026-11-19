// ── Close Ticket & Open Outlook Draft (client side) ────────────────
// Renders the Delivery Note and Service Report PDFs, has the server
// (api/outlook.js) create or reuse the draft in info@altases.sa, uploads both
// PDFs to it and confirms they are attached. Closing the request and opening
// Outlook Web happen in the view only after this resolves; any failure throws
// with a readable reason and leaves the request untouched.

import { getDeliveryNotesByRequest, supabase } from './storage';
import { buildDeliveryData, DELIVERY_TEMPLATE_URL } from './generateDeliveryNote';
import { MAINTENANCE_REPORT_URL } from './generateMaintenanceReport';
import { renderTemplatePdf } from './renderPdfFile';

async function api(action, { params = {}, json, body, method } = {}) {
  const qs = new URLSearchParams({ action, ...params });
  // The server only answers to Tariq's Supabase Auth session.
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Sign in again as Tariq to use Outlook (no session).');
  let res;
  try {
    res = await fetch(`/api/outlook?${qs}`, {
      method: method || (json || body ? 'POST' : 'GET'),
      headers: {
        Authorization: `Bearer ${token}`,
        ...(json ? { 'Content-Type': 'application/json' } : body ? { 'Content-Type': 'application/octet-stream' } : {}),
      },
      body: json ? JSON.stringify(json) : body,
    });
  } catch {
    throw new Error('Could not reach the server (network error).');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Server error (HTTP ${res.status}).`);
    err.code = data.code || '';
    throw err;
  }
  return data;
}

export const outlookStatus = () => api('status');
export const searchOutlookMessages = (q) => api('search', { params: { q } });
export const linkOutlookMessage = (requestId, messageId) => api('link', { json: { requestId, messageId } });

const pdfName = (base) => `${String(base || 'Document').replace(/[^A-Za-z0-9 ._()-]+/g, '-')}.pdf`;

// onStep(text) reports progress for the button label.
export async function prepareOutlookDraft({ requestId, reportData, onStep = () => {} }) {
  // 1. Export both PDFs with the existing templates.
  onStep('Exporting Delivery Note…');
  const notes = await getDeliveryNotesByRequest(requestId);
  const note = notes.find(n => n.status !== 'cancelled');
  if (!note) throw new Error('This request has no Delivery Note yet. Create one in the Delivery Note tab first.');
  const dnData = buildDeliveryData(note);
  let dnPdf, reportPdf;
  try {
    dnPdf = await renderTemplatePdf({ src: DELIVERY_TEMPLATE_URL, fillName: 'setDeliveryData', data: dnData });
  } catch (e) { throw new Error(`Delivery Note PDF export failed: ${e.message}`); }

  onStep('Exporting Service Report…');
  try {
    reportPdf = await renderTemplatePdf({ src: MAINTENANCE_REPORT_URL, fillName: 'setMaintenanceReportData', data: reportData });
  } catch (e) { throw new Error(`Service Report PDF export failed: ${e.message}`); }

  // 2. Create (or reuse) the draft.
  onStep('Preparing Outlook draft…');
  const draft = await api('draft', { json: { requestId } });

  // 3. Attach both files (a retry replaces same-name files, never duplicates).
  const files = [
    { label: 'Delivery Note', name: pdfName(dnData.fileName), blob: dnPdf },
    { label: 'Service Report', name: pdfName(reportData.fileName), blob: reportPdf },
  ];
  let attachments = draft.attachments || [];
  for (const f of files) {
    onStep(`Attaching ${f.label}…`);
    try {
      ({ attachments } = await api('attach', { params: { requestId, name: f.name }, body: f.blob }));
    } catch (e) { throw new Error(`Attaching the ${f.label} failed: ${e.message}`); }
  }
  const missing = files.filter(f => !attachments.includes(f.name));
  if (missing.length) throw new Error(`Not attached: ${missing.map(f => f.label).join(', ')}.`);

  return { draftId: draft.draftId, webLink: draft.webLink, reused: draft.reused, files: files.map(f => f.name) };
}
