# Herfy Maintenance Manager
### نظام إدارة طلبات الصيانة — هرفي

A bilingual (Arabic/English) maintenance request management system built for Herfy, connecting the client, workshop team, and admin in one streamlined workflow.

---

## Roles

| User | Username | Role |
|------|----------|------|
| Essa | `essa` | Client — submits and tracks requests |
| Majed | `majed` | Workshop team — executes and updates |
| Tariq | `tariq` | Admin — manages, assigns, and exports reports |

---

## Features

- Submit maintenance requests with photos and location
- Assign requests to the workshop team
- Real-time status tracking: Received → Scheduled → In Progress → Completed
- Bilingual interface (Arabic & English)
- Workshop comments and progress photos
- Admin controls: notes to client, notes to workshop, visibility toggles
- **Price List** (Tariq only) — three confidential price lists (HVAC & Cold Room, MEP & Décor, Signages) with search, quantity and SAR totals. Data lives only in the database, locked by RLS to Tariq's Supabase Auth account (`supabase_migration_v3_price_list.sql`); Tariq signs in through Supabase Auth (hashed password)
- **PDF service report export** (Tariq only) — bilingual, includes logo, photos, and full request history

---

## Tech Stack

- **React 18** + **Vite**
- **Supabase** — database and storage
- Native browser print (`window.print()` on hand-built HTML) — PDF report generation, no client-side PDF library

---

## Getting Started

```bash
npm install
npm run dev
```

Create a `.env.local` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

---

## Deploy

```bash
npm run build   # output in /dist
```

Configured for **Vercel** — push to `main` and it auto-deploys.

| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Publish directory | `dist` |

---

## Project Structure

```
src/
├── App.jsx              # Router + auth
├── storage.js           # Supabase CRUD + helpers
├── generateReport.js    # PDF export (Tariq only)
├── styles.css
└── views/
    ├── Login.jsx
    ├── EssaView.jsx
    ├── MajedView.jsx
    └── TariqView.jsx
public/
├── herfy-logo.png
└── altasis-logo.png     # Used in PDF report header
```

---

## Close Ticket & Open Outlook Draft

On a request page (Tariq), **📧 Close Ticket & Open Outlook Draft**:

1. Renders the Delivery Note and Service Report templates to PDF files (`src/renderPdfFile.js`).
2. Calls `api/outlook.js` (Vercel function), which uses Microsoft Graph to create a draft in `info@altases.sa`:
   a reply in Herfy's thread (`createReply`) when the request is linked to the original email
   (**Link email** on the request page), otherwise a new draft "Herfy [branch] – Notice of Repair Completion".
   The body is the "Notice of Repair Completion" template (`src/email/repairNotice.js`).
3. Attaches both PDFs and checks they are on the draft.
4. Only then closes the request and opens the draft in Outlook Web. Nothing is sent automatically.

The draft id is saved on the request and reused on the next click. On any failure the reason is shown and the request stays open.

### Setup

1. Run `supabase_migration_v4_outlook.sql` in the Supabase SQL Editor.
2. Microsoft Entra admin center → App registrations → New registration (single tenant).
   - API permissions → Microsoft Graph → **Application** permission **Mail.ReadWrite** → Grant admin consent.
   - Certificates & secrets → New client secret.
3. Limit the app to the one mailbox (Exchange Online PowerShell), e.g.:
   ```powershell
   New-ApplicationAccessPolicy -AppId <client-id> -PolicyScopeGroupId info@altases.sa -AccessRight RestrictAccess -Description "Request manager drafts"
   ```
4. Vercel → Project → Settings → Environment Variables (and `.env.local` for `npm run dev`):
   `MS_TENANT_ID`, `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, optional `MS_MAILBOX` (default `info@altases.sa`), optional `ALLOWED_ORIGINS`.
   `/api/outlook` only accepts Tariq's Supabase Auth session (override with `OUTLOOK_ALLOWED_EMAILS`).
   See `.env.example`.
