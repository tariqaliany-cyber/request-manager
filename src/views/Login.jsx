import { useState } from 'react';
import { authenticate } from '../storage';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setTimeout(() => {
      const user = authenticate(username.trim(), password);
      if (user) { onLogin(user); }
      else { setError('Incorrect username or password / اسم المستخدم أو كلمة المرور غير صحيحة'); }
      setLoading(false);
    }, 400);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img
          src="/logo-full.jpeg"
          alt="Altasis Alistratiji"
          style={{ width: '75%', maxWidth: 260, margin: '0 auto 28px', display: 'block' }}
        />

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="label">Username / اسم المستخدم</label>
            <input
              className="input"
              type="text"
              placeholder=""
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </div>
          <div className="form-group">
            <label className="label">Password / كلمة المرور</label>
            <input
              className="input"
              type="password"
              placeholder="••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <button className="btn btn-primary-login" type="submit" disabled={loading}>
            {loading ? '...' : 'Login / دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}
