import React, { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useJeopardySocket } from '../lib/useJeopardySocket';
import { getClueFromState, getDisplayValue, getEffectiveValue, makeClueId } from '../lib/clues';
import Podium from '../components/Podium';

export default function PlayerPage() {
  const { sessionId, playerId } = useParams();

  const { state, error, emit } = useJeopardySocket({
    sessionId,
    role: 'player',
    playerId,
  });

  const me = state?.players?.[playerId];
  const clue = useMemo(() => {
    if (!state?.selectedClueId) return null;
    return getClueFromState(state, state.selectedClueId);
  }, [state]);

  const effectiveValue = useMemo(() => {
    if (!state?.selectedClueId) return 0;
    return getEffectiveValue(state, state.selectedClueId);
  }, [state]);

  const hasBuzzed = Boolean(me?.hasBuzzed);

  const boardIndex = state?.currentBoardIndex ?? 0;
  const board = state?.boards?.[boardIndex];
  const usedForBoard = state?.used?.[boardIndex] ?? {};

  if (state?.gameOver) {
    return <Podium players={state.players} joinOrder={state.joinOrder} onReturn={() => { window.location.href = '/'; }} />;
  }

  // Round-end summary (player view — no Next button)
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
      </div>
    );
  }

  // Daily Double reveal (player view — animated splash, no Next button)
  if (state?.dailyDoublePhase === 'reveal') {
    return (
      <div className="dailyDoubleSplash">
        <div className="dailyDoubleText">Daily Double</div>
        <div className="dailyDoubleSubtext">Worth {effectiveValue} points</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="lobbyTopRight">{state?.lobbyCode ? `Lobby Code: ${state.lobbyCode}` : ''}</div>
      <div className="topRow">
        <div>
          <div style={{ fontWeight: 300, fontSize: 26, letterSpacing: '-0.01em' }}>
            {me?.name ?? 'Contestant'}
          </div>
          <div style={{ fontWeight: 200, fontSize: 20, color: 'var(--fg)' }}>
            {me?.name ? `${Number(me.score ?? 0)}` : 'Waiting for host…'}
          </div>
        </div>
        <div />
      </div>

      {error ? <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>Socket: {error}</div> : null}

      {state?.selectedClueId ? (
        <div className="playerClueLayout">
          <div className="card playerClueCard">
            <div className="playerClueMeta">
              {clue?.categoryName} · {effectiveValue}
            </div>
            <div className="playerClueBody">
              <div className="playerClueText">
                {state?.answerRevealed
                  ? clue?.answerText?.trim()
                    ? clue.answerText
                    : '—'
                  : clue?.questionText}
              </div>
            </div>
          </div>

          <div className="card playerBuzzCard">
            <button
              className={
                'playerBuzzBtn' +
                (state?.buzzEnabled && !hasBuzzed ? ' enabled' : '') +
                (hasBuzzed ? ' used' : '')
              }
              type="button"
              onClick={() => emit('player:buzz')}
              disabled={!state?.buzzEnabled || hasBuzzed}
            >
              {hasBuzzed ? 'BUZZED' : 'BUZZ'}
            </button>
            <div className="playerBuzzHint">
              {state?.buzzEnabled
                ? hasBuzzed ? 'You buzzed in.' : 'Tap to buzz in.'
                : 'Waiting for host to open buzzer.'}
            </div>
          </div>
        </div>
      ) : board ? (
        <div className="playerBoardWrap">
          <div style={{ fontSize: 13, color: 'var(--fg)', marginBottom: 14, fontWeight: 200 }}>
            Waiting for host to select a clue.
          </div>
          <table className="board">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                {board.categories.map((cat) => (
                  <th key={cat.name}>{cat.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, clueRowIdx) => (
                <tr key={clueRowIdx}>
                  <td style={{ fontWeight: 200, color: 'var(--fg)', fontSize: 13 }}>{clueRowIdx + 1}</td>
                  {board.categories.map((cat, categoryIndex) => {
                    const clueId = makeClueId(boardIndex, categoryIndex, clueRowIdx);
                    const used = Boolean(usedForBoard?.[clueId]);
                    const displayVal = getDisplayValue(state, clueId);
                    return (
                      <td key={clueId}>
                        <div className={used ? 'clueCell used' : 'clueCell disabled'} aria-disabled="true">
                          {used ? '·' : displayVal}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {Array.isArray(state?.joinOrder) && state.joinOrder.length ? (
            <div className="playerScoreboard">
              <div className="playerScoreRow playerScoreNames">
                {state.joinOrder.map((pid) => (
                  <div key={pid} className="playerScoreCell">
                    <div className="playerScoreName">{state?.players?.[pid]?.name ?? 'Player'}</div>
                  </div>
                ))}
              </div>
              <div className="playerScoreRow playerScoreScores">
                {state.joinOrder.map((pid) => (
                  <div key={pid} className="playerScoreCell">
                    <div className="playerScoreValue">{Number(state?.players?.[pid]?.score ?? 0)}</div>
                  </div>
                ))}
              </div>
              <div className="playerScoreRow playerScorePositions">
                {state.joinOrder.map((pid, idx) => (
                  <div key={pid} className="playerScoreCell">
                    <div className="playerScorePos">#{idx + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="card">Waiting for game state…</div>
      )}
    </div>
  );
}
