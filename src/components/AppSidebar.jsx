
import { canAccessPriceList } from '../storage';

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
/*
 * Desktop: always the narrow icon rail — each item's name shows beside it on
 * hover (data-tip, styled in styles.css). Phone: the drawer shows full labels.
 */
export default function AppSidebar({ user, onLogout, activeFilter, onFilter, onNewRequest, unreadCount, drawerOpen, onCloseDrawer }) {
  const collapsed = !drawerOpen;
  return (
    <>
      {drawerOpen && <div className="sidebar-scrim" onClick={onCloseDrawer} />}
      <aside className={`tariq-sidebar ${collapsed ? 'collapsed' : ''} ${drawerOpen ? 'drawer-open' : ''}`}>
        <div className="sidebar-brand" data-tip={collapsed ? 'ALTASES · مدير الصيانة' : undefined}>
          <AltasesMark size={collapsed ? 30 : 34} style={{ marginBottom: collapsed ? 0 : 12 }} />
          {!collapsed && (
            <>
              <div style={{ color: '#fff', fontWeight: 800, fontSize: 15, letterSpacing: '-.2px' }}>
                مدير الصيانة
              </div>
              <div style={{ color: 'rgba(255,255,255,.38)', fontSize: 11, marginTop: 2 }}>
                التأسيس الاستراتيجي · هرفي
              </div>
            </>
          )}
        </div>

        <nav className="sidebar-nav">
          {!collapsed && <div className="sidebar-section-label">القائمة الرئيسية</div>}

          <button
            className={`sidebar-item ${activeFilter === 'all' ? 'active' : ''}`}
            data-tip="Dashboard / الرئيسية" aria-label="Dashboard / الرئيسية"
            onClick={() => onFilter('all')}>
            <span className="sidebar-item-icon">🏠</span>
            {!collapsed && 'الرئيسية / Dashboard'}
          </button>

          <button
            className={`sidebar-item ${activeFilter === 'updates' ? 'active' : ''}`}
            data-tip="Updates / التحديثات" aria-label="Updates / التحديثات"
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
              data-tip={`${f.label} / ${f.labelAr}`} aria-label={f.label}
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
            data-tip="New Request / طلب جديد" aria-label="New Request / طلب جديد"
            onClick={onNewRequest}
            style={{ background: 'rgba(212,168,67,.15)', marginBottom: 4 }}>
            <span className="sidebar-item-icon">➕</span>
            {!collapsed && 'طلب جديد / New Request'}
          </button>

          {/* Tariq-only. Rendered for no one else (Issa/Essa, Majed, Abdullah never see it). */}
          {canAccessPriceList(user) && (
            <button
              className={`sidebar-item ${activeFilter === 'pricelist' ? 'active' : ''}`}
              data-tip="Price List / قائمة الأسعار" aria-label="Price List / قائمة الأسعار"
              onClick={() => onFilter('pricelist')}>
              <span className="sidebar-item-icon">💰</span>
              {!collapsed && 'قائمة الأسعار / Price List'}
            </button>
          )}
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
            data-tip="Logout / خروج" aria-label="Logout"
            style={{ background: 'rgba(255,255,255,.08)', border: 'none', color: 'rgba(255,255,255,.5)',
                     borderRadius: 6, padding: '5px 8px', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>
            {collapsed ? '⏻' : 'خروج'}
          </button>
        </div>
      </aside>
    </>
  );
}

// ALTASES (التأسيس الاستراتيجي) logo mark, drawn inline so it stays crisp on the dark sidebar.
export function AltasesMark({ size = 32, color = '#fff', style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={color} style={{ display: 'block', ...style }} aria-label="ALTASES">
      <path d="M0 0H49V30L0 61Z" /><path d="M51 0H100V34Z" /><path d="M51 31L100 63V96L51 64Z" /><path d="M49 64V100H0V95Z" />
    </svg>
  );
}

