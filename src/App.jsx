import { useState, useEffect, Suspense, lazy } from 'react';
import Login from './views/Login';
import EssaView from './views/EssaView';
import MajedView from './views/MajedView';

// Tariq's admin bundle (sidebar, unified request page, delivery notes, etc.)
// is the largest part of the app and only ever reached by one role — load
// it on demand instead of shipping it to Essa's and Majed's bundles too.
const TariqView = lazy(() => import('./views/TariqView'));

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('maint_user');
    if (saved) try { setUser(JSON.parse(saved)); } catch {}
  }, []);

  const handleLogin = (userData) => {
    sessionStorage.setItem('maint_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('maint_user');
    setUser(null);
  };

  if (!user) return <Login onLogin={handleLogin} />;

  if (user.role === 'essa')  return <EssaView  user={user} onLogout={handleLogout} />;
  if (user.role === 'majed') return <MajedView user={user} onLogout={handleLogout} />;
  if (user.role === 'tariq') return (
    <Suspense fallback={<div className="empty-state"><div className="empty-icon">⏳</div><div className="empty-title">Loading...</div></div>}>
      <TariqView user={user} onLogout={handleLogout} />
    </Suspense>
  );

  return <Login onLogin={handleLogin} />;
}
