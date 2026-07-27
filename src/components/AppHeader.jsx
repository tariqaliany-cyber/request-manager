/*
 * Replaces the old dual mobile-header/desktop-topbar markup in TariqView
 * with one component, shown/hidden per breakpoint via CSS (.app-header-mobile
 * / .app-header-desktop) rather than duplicating the JSX twice.
 */
export default function AppHeader({ title, user, onLogout, onNewRequest, showBack, onBack, onOpenDrawer }) {
  return (
    <>
      {/* Mobile header */}
      <header className="header header-tariq tariq-mobile-header">
        {showBack ? (
          <>
            <button className="back-btn" onClick={onBack} style={{ color: '#1E293B' }}>
              ← All Requests
            </button>
            <div className="header-right">
              <button className="btn-logout" onClick={onLogout}>Logout</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button className="drawer-toggle-btn" onClick={onOpenDrawer} aria-label="Menu">☰</button>
              <img src="/herfy-logo.png" alt="Herfy" style={{ height: 36, width: 'auto', display: 'block' }} />
              <div>
                <div className="header-title">Admin / لوحة التحكم</div>
                <div className="header-sub">Welcome, {user.nameAr} · {user.name}</div>
              </div>
            </div>
            <div className="header-right">
              <button
                onClick={onNewRequest}
                style={{ fontSize: 13, fontWeight: 700, background: 'var(--tariq-color)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer' }}>
                ➕ طلب جديد
              </button>
              <button className="btn-logout" onClick={onLogout}>Logout</button>
            </div>
          </>
        )}
      </header>

      {/* Desktop topbar */}
      <header className="tariq-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {showBack && (
            <button
              onClick={onBack}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13,
                       fontWeight: 700, color: 'var(--gray-600)', display: 'flex', alignItems: 'center', gap: 5,
                       padding: '6px 10px', borderRadius: 7, marginRight: 4 }}>
              ← Dashboard
            </button>
          )}
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gray-800)' }}>{title}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>
            {user.nameAr} · {user.name}
          </span>
          {!showBack && (
            <button
              onClick={onNewRequest}
              style={{ fontSize: 12, fontWeight: 700, background: 'var(--tariq-color)', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 12px', cursor: 'pointer' }}>
              ➕ طلب جديد
            </button>
          )}
          <button className="btn-logout" onClick={onLogout}>Logout</button>
        </div>
      </header>
    </>
  );
}
