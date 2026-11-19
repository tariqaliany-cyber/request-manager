// ── Close Ticket & Open Outlook Draft (client side) ────────────────
// Renders the Service Report PDF, has the server
// (api/outlook.js) create or reuse the draft in info@altases.sa, uploads the
// PDF to it and confirms it is attached. Closing the request and opening
// Outlook Web happen in the view only after this resolves; any failure throws
// with a readable reason and leaves the request untouched.

import { supabase } from './storage';
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
  // 1. Export the Service Report with the existing template. The Delivery
  //    Note is a separate signed paper, so it is not attached here.
  onStep('Exporting Service Report…');
  let reportPdf;
  try {
    reportPdf = await renderTemplatePdf({ src: MAINTENANCE_REPORT_URL, fillName: 'setMaintenanceReportData', data: reportData });
  } catch (e) { throw new Error(`Service Report PDF export failed: ${e.message}`); }

  // 2. Create (or reuse) the draft.
  onStep('Preparing Outlook draft…');
  const draft = await api('draft', { json: { requestId } });

  // 3. Attach the report (a retry replaces the same-name file, never duplicates).
  const files = [
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
