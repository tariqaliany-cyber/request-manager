// ── Microsoft Graph client (server only) ───────────────────────────
// OAuth 2.0 client-credentials flow against Microsoft Entra ID. The client
// secret never leaves the server: it is read from environment variables
// (Vercel project settings, or .env.local for `npm run dev`).
//
// Required env:
//   MS_TENANT_ID      Directory (tenant) ID of the altases.sa tenant
//   MS_CLIENT_ID      Application (client) ID of the app registration
//   MS_CLIENT_SECRET  Client secret value of that app registration
// Optional:
//   MS_MAILBOX        Mailbox the drafts are created in (default info@altases.sa)

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SIMPLE_ATTACHMENT_LIMIT = 3 * 1024 * 1024;   // larger → upload session
const UPLOAD_CHUNK = 320 * 1024 * 10;               // 3.125 MiB (multiple of 320 KiB)

export class GraphError extends Error {
  constructor(message, { status = 500, code = '' } = {}) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const mailbox = () => (process.env.MS_MAILBOX || 'info@altases.sa').trim();

export function missingGraphSettings() {
  return ['MS_TENANT_ID', 'MS_CLIENT_ID', 'MS_CLIENT_SECRET'].filter(k => !process.env[k]);
}

let cachedToken = null; // { value, expires }

async function accessToken() {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.value;
  const missing = missingGraphSettings();
  if (missing.length) {
    throw new GraphError(`Outlook is not connected yet: missing server settings ${missing.join(', ')}.`,
      { status: 503, code: 'not_configured' });
  }
  const res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(process.env.MS_TENANT_ID)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID,
      client_secret: process.env.MS_CLIENT_SECRET,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.access_token) {
    throw new GraphError(`Microsoft sign-in failed: ${body.error_description?.split('\r\n')[0] || body.error || res.status}`,
      { status: 502, code: 'auth_failed' });
  }
  cachedToken = { value: body.access_token, expires: Date.now() + (body.expires_in || 3600) * 1000 };
  return cachedToken.value;
}

// path is relative to the mailbox: '/messages/...'
export async function graph(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await accessToken();
  const res = await fetch(`${GRAPH}/users/${encodeURIComponent(mailbox())}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const code = data?.error?.code || '';
    let msg = data?.error?.message || `HTTP ${res.status}`;
    if (res.status === 403 || code === 'ErrorAccessDenied') {
      msg = `Access to ${mailbox()} was denied. Check the Mail.ReadWrite application permission (admin consent) and the mailbox access policy. (${msg})`;
    }
    throw new GraphError(`Outlook: ${msg}`, { status: res.status, code });
  }
  return data;
}

export const msgPath = (id) => `/messages/${encodeURIComponent(id)}`;

export async function getMessageOrNull(id, select) {
  try {
    return await graph(`${msgPath(id)}?$select=${select}`);
  } catch (e) {
    if (e.status === 404 || e.code === 'ErrorItemNotFound') return null;
    throw e;
  }
}

// Adds a file attachment, replacing an earlier attachment of the same name
// (so a retry never leaves two copies).
export async function putFileAttachment(messageId, { name, contentType, bytes, contentId, isInline = false }) {
  const existing = await graph(`${msgPath(messageId)}/attachments?$select=id,name`);
  for (const a of existing?.value || []) {
    if (a.name === name) await graph(`${msgPath(messageId)}/attachments/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
  }

  if (bytes.length < SIMPLE_ATTACHMENT_LIMIT) {
    return graph(`${msgPath(messageId)}/attachments`, {
      method: 'POST',
      body: {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name, contentType, isInline,
        ...(contentId ? { contentId } : {}),
        contentBytes: Buffer.from(bytes).toString('base64'),
      },
    });
  }

  // 3 MB and up: upload session (pre-authenticated URL, no bearer token).
  const session = await graph(`${msgPath(messageId)}/attachments/createUploadSession`, {
    method: 'POST',
    body: { AttachmentItem: { attachmentType: 'file', name, size: bytes.length, contentType } },
  });
  for (let start = 0; start < bytes.length; start += UPLOAD_CHUNK) {
    const end = Math.min(start + UPLOAD_CHUNK, bytes.length);
    const res = await fetch(session.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(end - start),
        'Content-Range': `bytes ${start}-${end - 1}/${bytes.length}`,
      },
      body: bytes.subarray(start, end),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      throw new GraphError(`Outlook: uploading ${name} failed (HTTP ${res.status}) ${t.slice(0, 200)}`, { status: 502 });
    }
  }
  return { name };
}
