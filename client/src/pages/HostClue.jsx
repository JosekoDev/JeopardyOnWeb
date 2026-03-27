import React, { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useJeopardySocket } from '../lib/useJeopardySocket';
import { getClueFromState, getEffectiveValue } from '../lib/clues';

export default function HostClue() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const { state, error, emit } = useJeopardySocket({ sessionId, role: 'host' });

  useEffect(() => {
    if (!state) return;
    if (!state.selectedClueId && !state.showingSummary) {
      navigate(`/host/${sessionId}`, { replace: true });
    }
  }, [state?.selectedClueId, state?.showingSummary, navigate, sessionId]);

  const clue = useMemo(() => {
    if (!state?.selectedClueId) return null;
    return getClueFromState(state, state.selectedClueId);
  }, [state]);

  const effectiveValue = useMemo(() => {
    if (!state?.selectedClueId) return 0;
    return getEffectiveValue(state, state.selectedClueId);
  }, [state]);

  const isDD = Boolean(state?.dailyDoubles?.[state?.selectedClueId]);

  const buzzOrderDisplay = useMemo(() => {
    if (!state?.buzzOrder?.length) return [];
    return state.buzzOrder.map((pid, idx) => ({
      idx: idx + 1,
      pid,
      name: state?.players?.[pid]?.name ?? pid,
    }));
  }, [state]);

  // Daily Double reveal splash
  if (state?.dailyDoublePhase === 'reveal') {
    return (
      <div className="dailyDoubleSplash">
        <div className="dailyDoubleText">Daily Double</div>
        <div className="dailyDoubleSubtext">Worth {effectiveValue} points</div>
        <button
          className="btn"
          type="button"
          style={{ marginTop: 12, animation: 'fadeInUp 0.4s var(--ease) 0.6s backwards' }}
          onClick={() => emit('host:advanceDailyDouble')}
        >
          Next
        </button>
      </div>
    );
  }

  // Round-end summary (host sees it on the clue page too)
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
          style={{ marginTop: 28, animation: 'fadeInUp 0.4s var(--ease) backwards', animationDelay: `${0.3 + (state.joinOrder?.length ?? 0) * 0.1 + 0.15}s` }}
          onClick={() => emit('host:nextAfterSummary')}
        >
          Next
        </button>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="topRow">
        <div>
          <div style={{ fontWeight: 300, fontSize: 18, letterSpacing: '-0.01em' }}>
            {isDD ? '★ Daily Double' : 'Clue'}
          </div>
          <div className="small">{sessionId.slice(0, 8)}…</div>
        </div>
        <div />
      </div>

      {error ? <div style={{ color: 'var(--danger)', marginBottom: 12, fontSize: 13 }}>Socket: {error}</div> : null}

      {clue ? (
        <div className="hostClueSplit">
          <div className="hostClueMainPane">
            <div className="card hostClueCard" style={{ marginBottom: 12 }}>
              <div className="hostClueMeta">
                {clue.categoryName} · {effectiveValue} pts{isDD ? ' (2×)' : ''}
              </div>
              <div className="hostClueText">{clue.questionText}</div>
            </div>

            <div className="card hostAnswerCard" style={{ marginBottom: 12 }}>
              <div className="hostClueMeta">Answer</div>
              <div className="hostAnswerText">{clue.answerText?.trim() ? clue.answerText : '—'}</div>
            </div>

            <div className="card" style={{ animation: 'fadeInUp 0.4s var(--ease) 0.2s backwards' }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn" type="button" onClick={() => emit('host:finishReading')} disabled={Boolean(state?.buzzEnabled)}>
                  Open Buzzer
                </button>
                <button className="btn" type="button" onClick={() => emit('host:toggleAnswer')} disabled={!state?.selectedClueId}>
                  {state?.answerRevealed ? 'Hide Answer' : 'Show Answer'}
                </button>
                <button className="btn" type="button" onClick={() => emit('host:done')}>
                  Done
                </button>
                <button className="btn" type="button" onClick={() => emit('host:resetBuzz')} disabled={!state?.buzzEnabled}>
                  Reset Buzzer
                </button>
              </div>
              <div className="small" style={{ marginTop: 10 }}>
                Press <strong>Open Buzzer</strong> when you finish reading the clue aloud.
              </div>
            </div>
          </div>

          <div className="hostClueSidePane">
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 300, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: 10 }}>
                Buzz Order
              </div>
              {buzzOrderDisplay.length ? (
                <div className="buzzOrder">
                  {buzzOrderDisplay.map((it, i) => (
                    <div key={it.pid} className="buzzItem" style={{ animationDelay: `${i * 0.05}s` }}>
                      <span style={{ fontWeight: 300, fontSize: 13, color: 'var(--fg-dim)' }}>#{it.idx}</span>
                      <span style={{ fontWeight: 200, fontSize: 14 }}>{it.name}</span>
                      <span className="hostScoreBtns">
                        <button
                          className="btn hostScoreBtn"
                          type="button"
                          onClick={() => emit('host:adjustScore', { playerId: it.pid, delta: effectiveValue })}
                          disabled={!effectiveValue}
                        >
                          +
                        </button>
                        <button
                          className="btn hostScoreBtn"
                          type="button"
                          onClick={() => emit('host:adjustScore', { playerId: it.pid, delta: -effectiveValue })}
                          disabled={!effectiveValue}
                        >
                          −
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="small">No buzzes yet.</div>
              )}
            </div>

            <div className="card">
              <div style={{ fontWeight: 300, fontSize: 13, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--fg-dim)', marginBottom: 10 }}>
                Players
              </div>
              {!Object.keys(state?.players ?? {}).length ? (
                <div className="small">No players yet.</div>
              ) : null}
              <div>
                {Object.entries(state?.players ?? {}).map(([pid, p], i) => {
                  const orderIndex = state?.buzzOrder?.indexOf(pid);
                  return (
                    <div key={pid} className="hostContestantRow" style={{ animationDelay: `${i * 0.05}s` }}>
                      <span style={{ fontWeight: 200, fontSize: 14 }}>{p.name}</span>
                      <span className="hostContestantScore">{Number(p.score ?? 0)}</span>
                      <span style={{ color: orderIndex === -1 ? 'var(--fg-dim)' : 'var(--accent)', fontWeight: 200, fontSize: 13 }}>
                        {orderIndex === -1 ? (p.connected ? 'Waiting' : 'Offline') : `#${orderIndex + 1}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">Waiting for clue selection…</div>
      )}
    </div>
  );
}
