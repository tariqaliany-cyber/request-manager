import { useState } from 'react';
import { prepareOutlookDraft, searchOutlookMessages, linkOutlookMessage } from '../outlookDraft';
import { buildRepairNoticeHtml, noticeSubject, branchDigits } from '../email/repairNotice';
import { formatDate } from '../storage';

/* "Close Ticket & Open Outlook Draft" — Tariq's request page.
 * Order matters: PDFs + draft + both attachments must all succeed before the
 * request is closed and Outlook Web opens. Any failure shows the reason and
 * leaves the request open with a Retry button. */
export default function OutlookClosePanel({ req, reportData, blockedReason, onCloseRequest, onRequestUpdated }) {
  const [busy, setBusy]       = useState(false);
  const [step, setStep]       = useState('');
  const [error, setError]     = useState('');
  const [done, setDone]       = useState(null);   // { webLink, reused, files }
  const [preview, setPreview] = useState(false);

  // Linking Herfy's original email
  const [finding, setFinding]   = useState(false);
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState('');

  const run = async () => {
    if (blockedReason) { setError(blockedReason); return; }
    setBusy(true); setError(''); setDone(null);
    // Opened now, inside the click, so the pop-up blocker allows it;
    // pointed at the draft once everything is ready.
    const win = window.open('', '_blank');
    try { win?.document.write('<p style="font:15px Arial;padding:24px">Preparing the Outlook draft… / جاري تجهيز المسودة…</p>'); } catch { /* ignore */ }
    try {
      const result = await prepareOutlookDraft({ requestId: req.id, reportData, onStep: setStep });
      setStep('Closing request…');
      const closed = await onCloseRequest(result);
      if (!closed) throw new Error('The draft is ready, but closing the request failed (database). Retry will reuse the same draft.');
      setDone(result);
      if (win && !win.closed) win.location.href = result.webLink;
      else window.open(result.webLink, '_blank', 'noopener');
    } catch (e) {
      try { win?.close(); } catch { /* ignore */ }
      setError(e.message || String(e));
    } finally {
      setBusy(false); setStep('');
    }
  };

  const openFinder = () => {
    setFinding(true); setLinkError('');
    const q = `Herfy ${branchDigits(req.branchNumber)}`;
    setQuery(q);
    search(q);
  };

  const search = async (q) => {
    setLinkBusy(true); setLinkError(''); setResults(null);
    try { setResults((await searchOutlookMessages(q)).items); }
    catch (e) { setLinkError(e.message); }
    setLinkBusy(false);
  };

  const link = async (messageId) => {
    setLinkBusy(true); setLinkError('');
    try {
      const r = await linkOutlookMessage(req.id, messageId);
      onRequestUpdated({ outlookMessageId: r.messageId, outlookMessageSubject: r.subject });
      setFinding(false); setResults(null);
    } catch (e) { setLinkError(e.message); }
    setLinkBusy(false);
  };

  const linked = !!req.outlookMessageId;

  return (
    <div className="outlook-panel">
      <div className="section-title" style={{ marginTop: 0 }}>Outlook / إشعار إنجاز الإصلاح</div>

      <div className="outlook-row">
        <div style={{ minWidth: 0 }}>
          <div className="outlook-label">Herfy's original email / رسالة هرفي الأصلية</div>
          <div className="outlook-value">
            {linked
              ? <>↩️ Reply in thread: <b>{req.outlookMessageSubject || '(no subject)'}</b></>
              : <>✉️ Not linked — a new email “{noticeSubject(req.branchNumber)}”</>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={openFinder} disabled={busy || linkBusy}>{linked ? 'Change' : 'Link email'}</button>
          {linked && <button type="button" className="btn btn-outline btn-sm" onClick={() => link('')} disabled={busy || linkBusy}>Unlink</button>}
        </div>
      </div>

      {finding && (
        <div className="outlook-finder">
          <form onSubmit={e => { e.preventDefault(); search(query); }} style={{ display: 'flex', gap: 6 }}>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search info@altases.sa" style={{ flex: 1 }} />
            <button type="submit" className="btn btn-outline btn-sm" disabled={linkBusy}>Search</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => { setFinding(false); setResults(null); }}>✕</button>
          </form>
          {linkBusy && <div className="outlook-muted">Searching…</div>}
          {linkError && <div className="outlook-error" style={{ marginTop: 8 }}>{linkError}</div>}
          {results && results.length === 0 && <div className="outlook-muted">No emails found.</div>}
          {results?.map(m => (
            <button type="button" key={m.id} className="outlook-result" onClick={() => link(m.id)} disabled={linkBusy}>
              <div style={{ fontWeight: 700 }}>{m.subject}</div>
              <div className="outlook-muted">{m.fromName || m.from} · {formatDate(m.received)}</div>
              {m.preview && <div className="outlook-muted" style={{ marginTop: 2 }}>{m.preview}</div>}
            </button>
          ))}
        </div>
      )}

      <button type="button" className="btn btn-outlook mt8" onClick={run} disabled={busy}>
        {busy ? `⏳ ${step || 'Working…'}` : error ? '🔁 Retry: Close Ticket & Open Outlook Draft' : '📧 Close Ticket & Open Outlook Draft'}
      </button>
      <div className="outlook-muted" style={{ textAlign: 'center' }}>
        Attaches the Delivery Note + Service Report PDFs. The email is never sent automatically.
      </div>

      {error && (
        <div className="outlook-error">
          ❌ {error}
          <div style={{ marginTop: 4, fontWeight: 600 }}>The request was left open. / تم إبقاء الطلب مفتوحًا.</div>
        </div>
      )}
      {done && (
        <div className="note-box note-box-green">
          ✅ Draft {done.reused ? 'reused' : 'created'} with {done.files.join(' + ')}. Request closed.{' '}
          <a href={done.webLink} target="_blank" rel="noopener noreferrer">Open draft in Outlook</a>
        </div>
      )}
      {!done && !busy && req.outlookDraftLink && (
        <div className="outlook-muted" style={{ textAlign: 'center' }}>
          A draft already exists for this request — it will be reused.{' '}
          <a href={req.outlookDraftLink} target="_blank" rel="noopener noreferrer">Open it</a>
        </div>
      )}

      <button type="button" className="btn-link" onClick={() => setPreview(v => !v)}>
        {preview ? 'Hide email preview' : 'Preview email'}
      </button>
      {preview && (
        <div className="outlook-preview"
          dangerouslySetInnerHTML={{ __html: buildRepairNoticeHtml(
            { branchNumber: req.branchNumber, ticketNumber: req.ticketNumber },
            { logo: '/email/altases-logo.png', icon: '/email/repair-icon.png' }) }} />
      )}
    </div>
  );
}
