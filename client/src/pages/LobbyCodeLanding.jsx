import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export default function LobbyCodeLanding() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(true);
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const normalized = useMemo(() => normalizeCode(code).slice(0, 6), [code]);

  const chars = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => normalized[i] ?? '');
  }, [normalized]);

  const caretIndex = Math.min(normalized.length, 5);
  const showCaret = focused && normalized.length < 6;

  function onChange(nextRaw) {
    const next = normalizeCode(nextRaw).slice(0, 6);
    setCode(next);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    async function validateAndAdvance() {
      if (normalized.length !== 6) return;
      setChecking(true);
      try {
        const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3010';
        const res = await fetch(`${SERVER_URL}/api/lobbies/${normalized}/exists`);
        const data = await res.json().catch(() => ({}));
        const exists = Boolean(data?.exists);
        if (cancelled) return;
        if (!exists) {
          setError("Code doesn't exist");
          return;
        }
        navigate('/join', { state: { lobbyCode: normalized } });
      } catch (e) {
        if (!cancelled) setError("Code doesn't exist");
      } finally {
        if (!cancelled) setChecking(false);
      }
    }
    validateAndAdvance();
    return () => {
      cancelled = true;
    };
  }, [normalized, navigate]);

  return (
    <div className="lobbyScreen">
      <div className="lobbyCenter">
        <div className="lobbyTitle">Enter Lobby Code</div>

        <div
          className="lobbyCodeCells lobbyCodeCellsBig"
          onClick={() => inputRef.current?.focus()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') inputRef.current?.focus();
          }}
          aria-label="Lobby code input"
        >
          {chars.map((ch, idx) => {
            const active = showCaret && idx === caretIndex;
            return (
              <div key={idx} className={'lobbyCodeCell lobbyCodeCellBig' + (active ? ' active' : '')}>
                <span className="lobbyCodeChar lobbyCodeCharBig">{ch}</span>
              </div>
            );
          })}
        </div>

        <div className="lobbyErrorRow">
          {error ? <div className="lobbyErrorText">{error}</div> : checking ? <div className="lobbyMuted"> </div> : <div />}
        </div>

        <input
          ref={inputRef}
          style={{
            position: 'absolute',
            opacity: 0,
            width: 1,
            height: 1,
            left: -9999,
            top: 0,
          }}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          maxLength={6}
        />
      </div>

      <div className="lobbyBottomLeft">
        <a className="lobbyHostLink" href="/host">
          Host a game
        </a>
      </div>
    </div>
  );
}
