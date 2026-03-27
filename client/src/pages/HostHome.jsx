import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, clearAuth, readAuth, writeAuth } from '../lib/auth';

export default function HostHome() {
  const navigate = useNavigate();
  const [auth, setAuth] = useState(() => readAuth());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function hydrateAuth() {
      const current = readAuth();
      if (!current) return;
      try {
        const res = await apiFetch('/api/auth/me', {}, true);
        if (!res.ok) throw new Error();
        if (!cancelled) setAuth(current);
      } catch (err) {
        clearAuth();
        if (!cancelled) setAuth(null);
      }
    }
    hydrateAuth();
    return () => { cancelled = true; };
  }, []);

  async function submitAuth(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const res = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      writeAuth(data);
      setAuth(data);
      setPassword('');
    } catch (err) {
      setError(err?.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function createSession() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/sessions', { method: 'POST' }, true);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      navigate(`/host/${data.sessionId}`, { state: { lobbyCode: data.lobbyCode } });
    } catch (err) {
      setError(err?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);
    setError(null);
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      // Best effort.
    } finally {
      clearAuth();
      setAuth(null);
      setLoading(false);
    }
  }

  if (!auth) {
    return (
      <div className="container">
        <div className="topRow">
          <div>
            <div style={{ fontWeight: 300, fontSize: 20, letterSpacing: '-0.01em' }}>Host Game</div>
            <div className="small">Sign in to host and edit your own board</div>
          </div>
          <div className="row" style={{ alignItems: 'center' }}>
            <button className="btn" type="button" onClick={() => navigate('/join')}>Join as Player</button>
          </div>
        </div>

        <form className="card" onSubmit={submitAuth}>
          <div style={{ fontWeight: 300, fontSize: 15, marginBottom: 10, letterSpacing: '-0.01em' }}>
            {mode === 'signup' ? 'Create Account' : 'Sign In'}
          </div>
          {error ? <div style={{ color: 'var(--danger)', marginBottom: 8, fontSize: 13 }}>{error}</div> : null}
          <div className="row" style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              minLength={3}
              maxLength={24}
            />
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              required
              minLength={6}
              maxLength={128}
            />
          </div>
          <div className="row">
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : (mode === 'signup' ? 'Create Account' : 'Sign In')}
            </button>
            <button
              className="btn"
              type="button"
              onClick={() => { setMode((m) => (m === 'signup' ? 'login' : 'signup')); setError(null); }}
              disabled={loading}
            >
              {mode === 'signup' ? 'Have an account? Sign In' : 'Need an account? Create one'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="topRow">
        <div>
          <div style={{ fontWeight: 300, fontSize: 20, letterSpacing: '-0.01em' }}>JeopardyMaxxing</div>
          <div className="small">Host account: {auth.user.username}</div>
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          <button className="btn" type="button" onClick={() => navigate('/edit')}>Edit Board</button>
          <button className="btn" type="button" onClick={() => navigate('/join')}>Join as Player</button>
          <button className="btn" type="button" onClick={logout} disabled={loading}>Log Out</button>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 300, fontSize: 15, marginBottom: 10, letterSpacing: '-0.01em' }}>New Game Session</div>
        {error ? <div style={{ color: 'var(--danger)', marginBottom: 8, fontSize: 13 }}>{error}</div> : null}
        <button className="btn" type="button" onClick={createSession} disabled={loading}>
          {loading ? 'Creating…' : 'Create Session'}
        </button>
      </div>
    </div>
  );
}
