import { useState, useEffect } from 'react';
import Login from './views/Login';
import EssaView from './views/EssaView';
import MajedView from './views/MajedView';
import TariqView from './views/TariqView';

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
  if (user.role === 'tariq') return <TariqView user={user} onLogout={handleLogout} />;

  return <Login onLogin={handleLogin} />;
}
