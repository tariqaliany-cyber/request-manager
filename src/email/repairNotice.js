// ── "Notice of Repair Completion" email (Outlook-compatible HTML) ─────
// Rebuilt from the email ALTASES sends Herfy when a branch repair is done.
// Table layout + inline styles only (no classes, no flex, no SVG) so it
// renders the same in Outlook desktop, Outlook Web and mobile, and stays
// editable in the Outlook compose window.
//
// Images are inline attachments referenced by cid: — the server attaches
// them (server/emailAssets.js), so nothing depends on where the app is hosted.
// Shared by the server (draft body) and the app (preview).

export const NOTICE_LOGO_CID = 'altases-logo';
export const NOTICE_ICON_CID = 'altases-repair-icon';

// Signature lines, exactly as in the current email.
export const NOTICE_SIGNATURE = {
  company:  'ALTASES',
  legal:    'Altasis Alistratiji. Contracting Est.',
  services: 'General Contracting & Maintenance Services',
  phone:    '+966 50 071 5710',
  email:    'info@tastra.work',
  location: 'Dammam, Saudi Arabia',
};

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// "215", "HF215", "Herfy 215" → "215"
export function branchDigits(branch) {
  const s = String(branch ?? '').trim();
  const m = s.match(/\d+/);
  return m ? m[0] : s;
}

// Ticket number as typed; a request that came by email with no ticket says so.
export function noticeTicketLabel(ticketNumber) {
  const t = String(ticketNumber ?? '').trim();
  return t || 'Email request';
}

export function noticeSubject(branch) {
  return `Herfy ${branchDigits(branch)} – Notice of Repair Completion`;
}

// imgSrc lets the in-app preview pass real URLs instead of cid: references.
export function buildRepairNoticeHtml({ branchNumber, ticketNumber }, imgSrc = {}) {
  const no = esc(branchDigits(branchNumber));
  const ticket = esc(noticeTicketLabel(ticketNumber));
  const logo = imgSrc.logo || `cid:${NOTICE_LOGO_CID}`;
  const icon = imgSrc.icon || `cid:${NOTICE_ICON_CID}`;
  const s = NOTICE_SIGNATURE;
  const font = "font-family:Arial,Helvetica,sans-serif;";
  const txt = `${font}font-size:13px;line-height:18px;color:#000000;`;
  const cell = `${font}font-size:13px;line-height:18px;color:#000000;border:3px double #1F3864;padding:3px 6px;`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="450" align="center" style="width:450px;border:4px double #2F5597;border-collapse:separate;background:#ffffff;">
<tr><td style="padding:22px 16px 10px 16px;${txt}">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
<tr><td style="${txt}font-weight:bold;">${esc(s.company)}<br>Maintenance Team</td></tr>
<tr><td style="padding-top:12px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td valign="middle" style="padding-right:12px;"><img src="${icon}" width="72" height="72" alt="" style="display:block;width:72px;height:72px;border:0;"></td>
    <td valign="middle" style="${txt}font-weight:bold;">Notice of Repair Completion</td>
  </tr></table>
</td></tr>
<tr><td style="padding-top:26px;${txt}">Greeting All ,<br>We are pleased to <span style="color:#1F4E79;">inform</span> you that the repair and maintenance works on Herfy Branch <b>#${no}</b> have been <b style="color:#00792F;">completed</b>.</td></tr>
<tr><td style="padding-top:14px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border:3px double #1F3864;border-collapse:collapse;">
    <tr>
      <th width="45%" align="center" style="${cell}font-weight:bold;background:#DDEBF7;text-align:center;">Branch Number</th>
      <th align="left" style="${cell}font-weight:bold;background:#DDEBF7;text-align:left;">Ticket Number</th>
    </tr>
    <tr>
      <td align="center" style="${cell}text-align:center;">HF ${no}</td>
      <td align="left" style="${cell}">${ticket}</td>
    </tr>
  </table>
</td></tr>
<tr><td style="padding-top:28px;${txt}">Note: Please Don't hesitate to contact us if you need any further information.</td></tr>
<tr><td style="padding-top:22px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="3" style="height:3px;line-height:3px;font-size:1px;background:#2F5597;">&nbsp;</td></tr></table></td></tr>
<tr><td style="padding-top:8px;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
    <td valign="top" style="${txt}">
      <b>${esc(s.company)}</b><br>
      ${esc(s.legal)}<br>
      <span style="white-space:nowrap;">${esc(s.services)}</span><br>
      <b>T:</b> ${esc(s.phone)}<br>
      <b>E:</b> <a href="mailto:${esc(s.email)}" style="color:#0563C1;text-decoration:underline;">${esc(s.email)}</a><br>
      <b>Location:</b> ${esc(s.location)}
    </td>
    <td valign="middle" align="right" width="155" style="width:155px;"><img src="${logo}" width="150" height="47" alt="Altasis Alistratiji" style="display:block;width:150px;height:47px;border:0;"></td>
  </tr></table>
</td></tr>
</table>
</td></tr>
</table>`;
}
