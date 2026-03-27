import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getServerUrl } from '../lib/serverUrl';

const SERVER_URL = getServerUrl();

export default function HostHome() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function createSession() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/sessions`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      navigate(`/host/${data.sessionId}`, { state: { lobbyCode: data.lobbyCode } });
    } catch (err) {
      setError(err?.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="topRow">
        <div>
          <div style={{ fontWeight: 300, fontSize: 20, letterSpacing: '-0.01em' }}>JeopardyMaxxing</div>
          <div className="small">Host / Presenter</div>
        </div>
        <div className="row" style={{ alignItems: 'center' }}>
          <button className="btn" type="button" onClick={() => navigate('/edit')}>Edit Board</button>
          <button className="btn" type="button" onClick={() => navigate('/join')}>Join as Player</button>
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
