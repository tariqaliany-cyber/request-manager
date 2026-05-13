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
- **PDF service report export** (Tariq only) — bilingual, includes logo, photos, and full request history

---

## Tech Stack

- **React 18** + **Vite**
- **Supabase** — database and storage
- **jsPDF** + **html2canvas** — PDF report generation

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

Configured for **Netlify** — push to `main` and it auto-deploys.

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
