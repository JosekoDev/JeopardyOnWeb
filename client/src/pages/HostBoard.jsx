import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useJeopardySocket } from '../lib/useJeopardySocket';
import { makeClueId, getDisplayValue } from '../lib/clues';
import Podium from '../components/Podium';

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function HostBoard() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { state, error, emit } = useJeopardySocket({ sessionId, role: 'host' });

  const boardIndex = state?.currentBoardIndex ?? 0;
  const board = state?.boards?.[boardIndex];
  const usedForBoard = state?.used?.[boardIndex] ?? {};

  const [lobbyCode, setLobbyCode] = useState(() => normalizeCode(location?.state?.lobbyCode));

  useEffect(() => {
    if (state?.lobbyCode) setLobbyCode(state.lobbyCode);
  }, [state?.lobbyCode]);

  useEffect(() => {
    if (!state) return;
    if (state.showingSummary) return; // stay on board during summary
    if (state.selectedClueId) navigate(`/host/${sessionId}/clue`, { replace: true });
    else navigate(`/host/${sessionId}`, { replace: true });
  }, [state?.selectedClueId, state?.showingSummary, navigate, sessionId]);

  const scoreOrder = useMemo(() => {
    const ids = Array.isArray(state?.joinOrder) && state.joinOrder.length ? state.joinOrder : Object.keys(state?.players ?? {});
    return ids.map((pid, idx) => ({
      idx: idx + 1,
      pid,
      name: state?.players?.[pid]?.name ?? 'Player',
      score: Number(state?.players?.[pid]?.score ?? 0),
    }));
  }, [state]);

  function onClueClick(categoryIndex, clueIndex) {
    if (!state) return;
    const clueId = makeClueId(boardIndex, categoryIndex, clueIndex);
    if (Boolean(usedForBoard?.[clueId])) return;
    emit('host:selectClue', { clueId });
    navigate(`/host/${sessionId}/clue`);
  }

  if (state?.gameOver) {
    return <Podium players={state.players} joinOrder={state.joinOrder} onReturn={() => { window.location.href = '/'; }} />;
  }

  // Round-end summary overlay
  if (state?.showingSummary && state?.lastClueDeltas) {
    const joinOrder = state.joinOrder ?? Object.keys(state.players ?? {});
    return (
      <div className="roundEndOverlay">
        <div className="roundEndTitle">Round Complete</div>
        {joinOrder.map((pid, i) => {
          const delta = state.lastClueDeltas?.[pid] ?? 0;
          const name = state.players?.[pid]?.name ?? 'Player';
          const cls = delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'zero';
          const label = delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : 'no change';
          return (
            <div key={pid} className="roundEndRow" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
              <span className="roundEndName">{name}</span>
              <span className="roundEndDot" />
              <span className={`roundEndDelta ${cls}`}>{label}</span>
            </div>
          );
        })}
        <button
          className="btn"
          type="button"
          style={{ marginTop: 28, animationDelay: `${0.3 + joinOrder.length * 0.1 + 0.15}s`, animation: 'fadeInUp 0.4s var(--ease) backwards' }}
          onClick={() => emit('host:nextAfterSummary')}
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="lobbyTopRight">{lobbyCode ? `Lobby Code: ${lobbyCode}` : ''}</div>
      <div className="topRow">
        <div className="hostBoardHeaderMain">
          <div>
            <div style={{ fontWeight: 300, fontSize: 18, letterSpacing: '-0.01em' }}>Board {boardIndex + 1} of {state?.boards?.length ?? '?'}</div>
            <div className="small">{sessionId.slice(0, 8)}…</div>
          </div>
          <button
            className="btn"
            type="button"
            onClick={() => emit('host:skipBoard')}
            disabled={state?.gameOver}
          >
            {boardIndex >= (state?.boards?.length ?? 1) - 1 ? 'End Game →' : 'Next Board →'}
          </button>
        </div>
        <div />
      </div>

      {error ? <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>Socket: {error}</div> : null}

      <div className="hostSplit">
        <div className="hostBoardPane">
          {board ? (
            <div className="boardScrollWrap">
              <table className="board">
                <thead>
                  <tr>
                  <th className="boardRowIndexHead"></th>
                    {board.categories.map((cat) => (
                      <th key={cat.name}>{cat.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, clueRowIdx) => (
                    <tr key={clueRowIdx}>
                      <td className="boardRowIndex">{clueRowIdx + 1}</td>
                      {board.categories.map((cat, categoryIndex) => {
                        const clueId = makeClueId(boardIndex, categoryIndex, clueRowIdx);
                        const used = Boolean(usedForBoard?.[clueId]);
                        const isDD = Boolean(state?.dailyDoubles?.[clueId]);
                        const displayVal = getDisplayValue(state, clueId);
                        let className = used ? 'clueCell used' : 'clueCell';
                        if (!used && isDD) className += ' dailyDoubleGlow';
                        return (
                          <td key={clueId}>
                            <div
                              role="button"
                              tabIndex={0}
                              className={className}
                              onClick={() => (used ? null : onClueClick(categoryIndex, clueRowIdx))}
                              onKeyDown={(e) => {
                                if (used) return;
                                if (e.key === 'Enter' || e.key === ' ') onClueClick(categoryIndex, clueRowIdx);
                              }}
                            >
                              {used ? '·' : displayVal}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card">Waiting for board…</div>
          )}
        </div>

        <div className="hostRightPane">
          <div className="card hostBuzzCard">
            <div style={{ fontWeight: 300, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: 10 }}>
              Scores
            </div>
            {scoreOrder.length ? (
              <div className="hostBuzzOrder">
                {scoreOrder.map((it, i) => (
                  <div key={it.pid} className="buzzItem" style={{ animationDelay: `${i * 0.05}s` }}>
                    <span style={{ fontWeight: 200, color: 'var(--fg-dim)', fontSize: 12 }}>#{it.idx}</span>
                    <span style={{ fontWeight: 200, fontSize: 14 }}>{it.name}</span>
                    <span style={{ fontWeight: 300, fontSize: 16 }}>{it.score}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small">No players yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
