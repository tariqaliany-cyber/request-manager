import { useState } from 'react';

const STATUS_FILTERS = [
  { key: 'unassigned',  icon: '⚠️', label: 'Unassigned',  labelAr: 'غير مسندة' },
  { key: 'scheduled',   icon: '📅', label: 'Scheduled',   labelAr: 'مجدولة'    },
  { key: 'in_progress', icon: '🔧', label: 'In Progress', labelAr: 'قيد التنفيذ'},
  { key: 'completed',   icon: '✅', label: 'Completed',   labelAr: 'مكتملة'    },
];

/*
 * Real, working nav only. Sections like Branches/Reports/Delivery
 * Notes/Accounting don't get their own sidebar entry yet — they become
 * reachable once later phases give them a real destination (Delivery
 * Note + Financial tabs land inside the unified request page; per-request
 * Report export already exists via that same page). Adding a sidebar
 * entry with no real screen behind it would be a fake button.
 */
export default function AppSidebar({ user, onLogout, activeFilter, onFilter, onNewRequest, unreadCount, collapsed, onToggleCollapse, drawerOpen, onCloseDrawer }) {
  return (
    <>
      {drawerOpen && <div className="sidebar-scrim" onClick={onCloseDrawer} />}
      <aside className={`tariq-sidebar ${collapsed ? 'collapsed' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
        <div className="sidebar-brand">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <img
              src="/herfy-logo.png" alt="Herfy"
              style={{ height: 34, width: 'auto', display: collapsed ? 'none' : 'block', marginBottom: 12,
                       filter: 'brightness(0) invert(1)', opacity: 0.85 }}
            />
            <button
              className="sidebar-collapse-btn"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand / توسيع' : 'Collapse / طي'}>
              {collapsed ? '»' : '«'}
            </button>
          </div>
          {!collapsed && (
            <>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-.2px' }}>
                مدير الصيانة
              </div>
              <div style={{ color: 'rgba(255,255,255,.38)', fontSize: 11, marginTop: 2 }}>
                لوحة التحكم الإدارية
              </div>
            </>
          )}
        </div>

        <nav className="sidebar-nav">
          {!collapsed && <div className="sidebar-section-label">القائمة الرئيسية</div>}

          <button
            className={`sidebar-item ${activeFilter === 'all' ? 'active' : ''}`}
            title="Dashboard / الرئيسية"
            onClick={() => onFilter('all')}>
            <span className="sidebar-item-icon">🏠</span>
            {!collapsed && 'الرئيسية / Dashboard'}
          </button>

          <button
            className={`sidebar-item ${activeFilter === 'updates' ? 'active' : ''}`}
            title="Updates / التحديثات"
            onClick={() => onFilter('updates')}>
            <span className="sidebar-item-icon">🔔</span>
            {!collapsed && 'التحديثات / Updates'}
            {unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
          </button>

          {!collapsed && <div className="sidebar-section-label">الأعطال</div>}

          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              className={`sidebar-item ${activeFilter === f.key ? 'active' : ''}`}
              title={f.label}
              onClick={() => onFilter(f.key)}>
              <span className="sidebar-item-icon">{f.icon}</span>
              {!collapsed && (
                <>
                  {f.label}
                  <span style={{ fontSize: 11, color: 'inherit', opacity: .6, marginLeft: 2 }}>
                    / {f.labelAr}
                  </span>
                </>
              )}
            </button>
          ))}

          {!collapsed && <div className="sidebar-section-label">أدوات</div>}

          <button
            className={`sidebar-item ${activeFilter === 'new' ? 'active' : ''}`}
            title="New Request / طلب جديد"
            onClick={onNewRequest}
            style={{ background: 'rgba(212,168,67,.15)', marginBottom: 4 }}>
            <span className="sidebar-item-icon">➕</span>
            {!collapsed && 'طلب جديد / New Request'}
          </button>
        </nav>

        <div className="sidebar-user-section">
          <div className="sidebar-avatar">{user.name[0]}</div>
          {!collapsed && (
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{ color: 'rgba(255,255,255,.38)', fontSize: 11 }}>المسؤول الإداري</div>
            </div>
          )}
          <button
            onClick={onLogout}
            title="خروج"
            style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.5)',
                     borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
            {collapsed ? '⏻' : 'خروج'}
          </button>
        </div>
      </aside>
    </>
  );
}

export function useSidebarCollapse() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('tariq_sidebar_collapsed') === '1');
  const toggle = () => {
    setCollapsed(v => {
      const next = !v;
      localStorage.setItem('tariq_sidebar_collapsed', next ? '1' : '0');
      return next;
    });
  };
  return [collapsed, toggle];
}
