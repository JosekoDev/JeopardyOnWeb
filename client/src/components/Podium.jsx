import React, { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Podium component — animated 3-place reveal with confetti.
 *
 * Props:
 *   players: { [pid]: { name, score } }
 *   joinOrder: string[]
 *   onReturn?: () => void
 */
export default function Podium({ players, joinOrder, onReturn }) {
  const [phase, setPhase] = useState(0); // 0=hidden, 1=3rd, 2=2nd, 3=1st-rise, 4=1st-show, 5=confetti
  const confettiCanvasRef = useRef(null);

  const ranked = useMemo(() => {
    const ids = joinOrder?.length ? joinOrder : Object.keys(players ?? {});
    const list = ids.map((pid) => ({
      pid,
      name: players?.[pid]?.name ?? 'Player',
      score: Number(players?.[pid]?.score ?? 0),
    }));
    list.sort((a, b) => b.score - a.score);
    return list;
  }, [players, joinOrder]);

  const first = ranked[0] ?? null;
  const second = ranked[1] ?? null;
  const third = ranked[2] ?? null;

  useEffect(() => {
    const timers = [];
    timers.push(setTimeout(() => setPhase(1), 600));   // reveal 3rd
    timers.push(setTimeout(() => setPhase(2), 1800));  // reveal 2nd
    timers.push(setTimeout(() => setPhase(3), 3000));  // 1st pillar begins 3s rise, others sink
    timers.push(setTimeout(() => setPhase(4), 6000));  // 1st place text reveals (3s later)
    timers.push(setTimeout(() => setPhase(5), 6400));  // confetti & return button
    return () => timers.forEach(clearTimeout);
  }, []);

  // Confetti effect
  useEffect(() => {
    if (phase < 5) return;
    const canvas = confettiCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = [];
    const colors = ['#63b3ed', '#f0f2f5', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c'];

    for (let i = 0; i < 150; i++) {
      pieces.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: 4 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 8,
        vy: 1.5 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 2,
        opacity: 0.7 + Math.random() * 0.3,
      });
    }

    let animId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let anyVisible = false;
      for (const p of pieces) {
        p.y += p.vy;
        p.x += p.vx;
        p.rotation += p.rotSpeed;
        p.vy += 0.03; // gravity

        if (p.y > canvas.height + 50) {
          p.y = -10 - Math.random() * 50;
          p.x = Math.random() * canvas.width;
          p.vy = 1.5 + Math.random() * 3;
        }
        anyVisible = true; // Loop endlessly

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (anyVisible) animId = requestAnimationFrame(draw);
    }
    animId = requestAnimationFrame(draw);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [phase]);

  return (
    <div className="podiumOverlay">
      <canvas ref={confettiCanvasRef} className="podiumConfettiCanvas" />

      <div className="podiumTitle" style={{ opacity: phase >= 1 ? 1 : 0 }}>Final Standings</div>

      <div className="podiumStage">
        {/* 2nd place (left) */}
        <div className={`podiumPlace podiumSecond ${phase >= 2 ? 'visible' : ''} ${phase >= 3 ? 'sinking' : ''}`}>
          <div className="podiumPlayerName">{second?.name ?? '—'}</div>
          <div className="podiumPlayerScore">{second?.score ?? 0}</div>
          <div className="podiumPillar podiumPillarSecond">
            <span className="podiumPlaceLabel">2</span>
          </div>
        </div>

        {/* 1st place (center) */}
        <div className={`podiumPlace podiumFirst ${phase >= 3 ? 'visible rising' : ''} ${phase >= 4 ? 'textVisible' : ''}`}>
          <div className="podiumPlayerName">{first?.name ?? '—'}</div>
          <div className="podiumPlayerScore">{first?.score ?? 0}</div>
          <div className="podiumPillar podiumPillarFirst">
            <span className="podiumPlaceLabel">1</span>
          </div>
        </div>

        {/* 3rd place (right) */}
        <div className={`podiumPlace podiumThird ${phase >= 1 ? 'visible' : ''} ${phase >= 3 ? 'sinking' : ''}`}>
          <div className="podiumPlayerName">{third?.name ?? '—'}</div>
          <div className="podiumPlayerScore">{third?.score ?? 0}</div>
          <div className="podiumPillar podiumPillarThird">
            <span className="podiumPlaceLabel">3</span>
          </div>
        </div>
      </div>

      {/* Remaining players below */}
      {ranked.length > 3 && phase >= 4 ? (
        <div className={`podiumRest ${phase >= 3 ? 'sinking' : ''}`}>
          {ranked.slice(3).map((p, i) => (
            <div key={p.pid} className="podiumRestRow" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="podiumRestRank">#{i + 4}</span>
              <span className="podiumRestName">{p.name}</span>
              <span className="podiumRestScore">{p.score}</span>
            </div>
          ))}
        </div>
      ) : null}

      {onReturn && phase >= 5 ? (
        <button
          className="podiumTextBtn"
          type="button"
          onClick={onReturn}
          style={{ position: 'absolute', bottom: 40, zIndex: 10, animation: 'fadeInUp 0.6s var(--ease) backwards' }}
        >
          Return to Home
        </button>
      ) : null}
    </div>
  );
}
