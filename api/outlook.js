// ── /api/outlook — Outlook drafts for closed requests (Vercel function) ──
// The browser never sees Microsoft credentials; it calls these actions and
// this function talks to Microsoft Graph with the server-side app secret.
//
//   GET  ?action=status                      is Outlook connected?
//   GET  ?action=search&q=Herfy 215          find Herfy's original email
//   POST ?action=link    {requestId, messageId}   link / unlink (messageId '')
//   POST ?action=draft   {requestId}         create or reuse the draft
//   POST ?action=attach&requestId=..&name=..  body = PDF bytes
//
// Drafts are only created, never sent: sending stays a manual step in Outlook.
// In `npm run dev` the same handler is mounted by vite.config.js.

import { createClient } from '@supabase/supabase-js';
import { graph, msgPath, getMessageOrNull, putFileAttachment, missingGraphSettings, mailbox, GraphError } from '../server/graph.js';
import { REPAIR_ICON_PNG, ALTASES_LOGO_PNG } from '../server/emailAssets.js';
import { buildRepairNoticeHtml, noticeSubject, NOTICE_LOGO_CID, NOTICE_ICON_CID } from '../src/email/repairNotice.js';

const MAX_PDF_BYTES = 4.3 * 1024 * 1024;   // Vercel request body limit is 4.5 MB
const INLINE = [
  { name: 'altases-logo.png', contentId: NOTICE_LOGO_CID, b64: ALTASES_LOGO_PNG },
  { name: 'repair-icon.png',  contentId: NOTICE_ICON_CID, b64: REPAIR_ICON_PNG },
];

const db = () => {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) throw new GraphError('Server is missing the Supabase URL/key.', { status: 500 });
  return createClient(url, key, { auth: { persistSession: false } });
};

const send = (res, status, obj) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let size = 0;
  req.on('data', c => {
    size += c.length;
    if (size > MAX_PDF_BYTES + 1024) { reject(new GraphError('File is too large (over 4.3 MB).', { status: 413 })); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const readJson = async (req) => {
  const buf = await readBody(req);
  try { return JSON.parse(buf.toString('utf8') || '{}'); }
  catch { throw new GraphError('Invalid JSON body.', { status: 400 }); }
};

const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id);

async function loadRequest(requestId) {
  if (!validId(requestId)) throw new GraphError('Invalid request id.', { status: 400 });
  const { data, error } = await db().from('requests')
    .select('id,status,branch_number,ticket_number,outlook_message_id,outlook_message_subject,outlook_draft_id,outlook_draft_link')
    .eq('id', requestId).maybeSingle();
  if (error) {
    const hint = /outlook_/.test(error.message || '') ? ' Run supabase_migration_v4_outlook.sql in Supabase first.' : '';
    throw new GraphError(`Database: ${error.message}.${hint}`, { status: 500 });
  }
  if (!data) throw new GraphError('Request not found.', { status: 404 });
  return data;
}

async function saveRequest(requestId, fields) {
  const { error } = await db().from('requests').update(fields).eq('id', requestId);
  if (error) throw new GraphError(`Database: ${error.message}`, { status: 500 });
}

async function attachmentNames(draftId) {
  const list = await graph(`${msgPath(draftId)}/attachments?$select=name,isInline,size`);
  return (list?.value || []).map(a => ({ name: a.name, isInline: !!a.isInline, size: a.size }));
}

async function ensureInlineImages(draftId, have) {
  for (const img of INLINE) {
    if (have.some(a => a.name === img.name)) continue;
    await putFileAttachment(draftId, {
      name: img.name, contentType: 'image/png', contentId: img.contentId, isInline: true,
      bytes: Buffer.from(img.b64, 'base64'),
    });
  }
}

// Puts the notice above the quoted original message of a reply draft.
function prependToBody(html, notice) {
  const block = `<div>${notice}</div><br>`;
  if (/<body[^>]*>/i.test(html || '')) return html.replace(/<body[^>]*>/i, m => m + block);
  return block + (html || '');
}

async function createDraft(req) {
  const notice = buildRepairNoticeHtml({ branchNumber: req.branch_number, ticketNumber: req.ticket_number });

  if (req.outlook_message_id) {
    const original = await getMessageOrNull(req.outlook_message_id, 'id');
    if (!original) {
      throw new GraphError('The linked original email was not found in the mailbox (moved or deleted). Link it again or unlink it.', { status: 409, code: 'original_missing' });
    }
    const reply = await graph(`${msgPath(req.outlook_message_id)}/createReply`, { method: 'POST', body: {} });
    await graph(msgPath(reply.id), {
      method: 'PATCH',
      body: { body: { contentType: 'HTML', content: prependToBody(reply.body?.content, notice) } },
    });
    return { id: reply.id, webLink: reply.webLink, kind: 'reply' };
  }

  const draft = await graph('/messages', {
    method: 'POST',
    body: {
      subject: noticeSubject(req.branch_number),
      body: { contentType: 'HTML', content: `<html><body>${notice}</body></html>` },
    },
  });
  return { id: draft.id, webLink: draft.webLink, kind: 'new' };
}

const actions = {
  async status() {
    const missing = missingGraphSettings();
    return { configured: missing.length === 0, missing, mailbox: mailbox() };
  },

  async search(req, url) {
    const q = (url.searchParams.get('q') || '').replace(/["\\]/g, ' ').trim().slice(0, 80);
    if (!q) throw new GraphError('Search text is empty.', { status: 400 });
    const data = await graph(`/messages?$search=${encodeURIComponent(`"${q}"`)}&$top=15&$select=id,subject,from,receivedDateTime,bodyPreview,isDraft`);
    const items = (data?.value || [])
      .filter(m => !m.isDraft)
      .map(m => ({
        id: m.id,
        subject: m.subject || '(no subject)',
        from: m.from?.emailAddress?.address || '',
        fromName: m.from?.emailAddress?.name || '',
        received: m.receivedDateTime,
        preview: (m.bodyPreview || '').slice(0, 140),
      }))
      .sort((a, b) => String(b.received).localeCompare(String(a.received)));
    return { items };
  },

  async link(req) {
    const { requestId, messageId } = await readJson(req);
    await loadRequest(requestId);
    if (!messageId) {
      await saveRequest(requestId, { outlook_message_id: '', outlook_message_subject: '' });
      return { messageId: '', subject: '' };
    }
    const msg = await getMessageOrNull(messageId, 'id,subject');
    if (!msg) throw new GraphError('That email was not found in the mailbox.', { status: 404 });
    await saveRequest(requestId, { outlook_message_id: msg.id, outlook_message_subject: msg.subject || '' });
    return { messageId: msg.id, subject: msg.subject || '' };
  },

  async draft(req) {
    const { requestId } = await readJson(req);
    const r = await loadRequest(requestId);

    // Reuse the draft saved with the request while it is still an unsent draft.
    let draft = null, reused = false;
    if (r.outlook_draft_id) {
      const found = await getMessageOrNull(r.outlook_draft_id, 'id,isDraft,webLink');
      if (found?.isDraft) { draft = { id: found.id, webLink: found.webLink }; reused = true; }
    }
    if (!draft) {
      draft = await createDraft(r);
      // Saved before attaching, so a retry after a failed upload reuses it.
      await saveRequest(requestId, { outlook_draft_id: draft.id, outlook_draft_link: draft.webLink || '' });
    }

    let attachments = await attachmentNames(draft.id);
    await ensureInlineImages(draft.id, attachments);
    attachments = attachments.filter(a => !a.isInline).map(a => a.name);
    return { draftId: draft.id, webLink: draft.webLink, reused, attachments };
  },

  async attach(req, url) {
    const requestId = url.searchParams.get('requestId');
    const name = url.searchParams.get('name') || '';
    if (!/^[A-Za-z0-9 ._()-]{1,120}\.pdf$/.test(name)) throw new GraphError('Invalid attachment name.', { status: 400 });
    const r = await loadRequest(requestId);
    if (!r.outlook_draft_id) throw new GraphError('No draft is saved for this request yet.', { status: 409 });
    const bytes = await readBody(req);
    if (bytes.length < 100 || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
      throw new GraphError(`${name} is not a valid PDF.`, { status: 400 });
    }
    await putFileAttachment(r.outlook_draft_id, { name, contentType: 'application/pdf', bytes });
    const attachments = (await attachmentNames(r.outlook_draft_id)).filter(a => !a.isInline).map(a => a.name);
    if (!attachments.includes(name)) throw new GraphError(`${name} did not appear on the draft after upload.`, { status: 502 });
    return { attachments };
  },
};

const POST_ONLY = new Set(['link', 'draft', 'attach']);

// Every action needs Tariq's Supabase Auth session (the same login that
// unlocks the Price List). The browser sends its access token; Supabase
// verifies it here, so the mailbox can't be reached with the public anon key.
const allowedEmails = () => (process.env.OUTLOOK_ALLOWED_EMAILS || 'tariq@request-manager.example')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

async function requireTariq(req) {
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!m) throw new GraphError('Sign in again as Tariq to use Outlook (no session).', { status: 401, code: 'no_session' });
  const { data, error } = await db().auth.getUser(m[1]);
  const email = data?.user?.email?.toLowerCase();
  if (error || !email) throw new GraphError('Your session expired. Log out and sign in again as Tariq.', { status: 401, code: 'bad_session' });
  if (!allowedEmails().includes(email)) throw new GraphError('Only Tariq can use Outlook drafts.', { status: 403, code: 'forbidden' });
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const action = url.searchParams.get('action') || '';

  // Optional: only accept calls from the app's own origin(s).
  const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (allowed.length && origin && !allowed.includes(origin)) return send(res, 403, { error: 'Origin not allowed.' });

  const fn = actions[action];
  if (!fn) return send(res, 404, { error: 'Unknown action.' });
  if (POST_ONLY.has(action) !== (req.method === 'POST')) return send(res, 405, { error: 'Method not allowed.' });

  try {
    await requireTariq(req);
    send(res, 200, await fn(req, url));
  } catch (e) {
    const status = e instanceof GraphError ? e.status : 500;
    if (!(e instanceof GraphError)) console.error('[api/outlook]', e);
    send(res, status >= 400 && status < 600 ? status : 500, { error: e.message || 'Unexpected server error.', code: e.code || '' });
  }
}
