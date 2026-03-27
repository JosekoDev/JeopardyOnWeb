import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getServerUrl } from '../lib/serverUrl';
import { playSfx } from '../lib/sfx';

const SERVER_URL = getServerUrl();

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function JoinPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);

  const prefilledCode = useMemo(() => normalizeCode(location?.state?.lobbyCode), [location?.state?.lobbyCode]);

  const [lobbyCode, setLobbyCode] = useState(prefilledCode);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [focused, setFocused] = useState(true);

  useEffect(() => {
    if (prefilledCode.length === 6) setLobbyCode(prefilledCode);
  }, [prefilledCode]);

  useEffect(() => {
    if (prefilledCode.length !== 6) { navigate('/', { replace: true }); return; }
    inputRef.current?.focus();
  }, [prefilledCode.length, navigate]);

  async function join() {
    const code = normalizeCode(lobbyCode);
    const name = String(username || '').trim();
    setError(null);
    if (!code) return setError('Enter a lobby code.');
    if (!name) return setError('Enter a username.');
    if (name.length > 16) return setError('Username must be 16 characters or less.');

    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/lobbies/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lobbyCode: code, username: name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      playSfx('username_success');
      navigate(`/p/${data.sessionId}/${data.playerId}`, { replace: true });
    } catch (err) {
      setError(err?.message || 'Failed to join.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lobbyScreen">
      <div className="lobbyTopRight">Lobby Code: {normalizeCode(lobbyCode)}</div>

      <div className="lobbyCenter">
        <div className="lobbyTitle">Enter Username</div>

        <div className="usernameRow">
          <div
            className={'usernameUnderline' + (focused ? ' focused' : '')}
            onClick={() => inputRef.current?.focus()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') join(); if (e.key === ' ') inputRef.current?.focus(); }}
            aria-label="Username input"
          >
            <span className="usernameText">{username}</span>
            {focused ? <span className="usernameCaret" aria-hidden="true" /> : null}
          </div>

          <button className="btn usernameDoneBtn" type="button" onClick={join} disabled={loading}>
            {loading ? '…' : 'Done'}
          </button>
        </div>

        <div className="lobbyErrorRow">
          {error ? <div className="lobbyErrorText">{error}</div> : <div />}
        </div>

        <input
          ref={inputRef}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, left: -9999, top: 0 }}
          type="text"
          value={username}
          maxLength={16}
          onChange={(e) => { setUsername(e.target.value); setError(null); }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCorrect="off"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
