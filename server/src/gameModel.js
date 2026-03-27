function makeClueId(boardIndex, categoryIndex, clueIndex) {
  return `b${boardIndex}-c${categoryIndex}-q${clueIndex}`;
}

function parseClueId(clueId) {
  const match = /^b(\d+)-c(\d+)-q(\d+)$/.exec(clueId);
  if (!match) return null;
  return {
    boardIndex: Number(match[1]),
    categoryIndex: Number(match[2]),
    clueIndex: Number(match[3]),
  };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Pick one random clue per board to be a Daily Double.
 * Returns a Set of clueId strings.
 */
function pickDailyDoubles(boards) {
  const dailyDoubles = {};
  for (let bIdx = 0; bIdx < boards.length; bIdx += 1) {
    const board = boards[bIdx];
    const allClueIds = [];
    for (let c = 0; c < (board.categories?.length ?? 0); c += 1) {
      for (let q = 0; q < (board.categories[c]?.clues?.length ?? 0); q += 1) {
        allClueIds.push(makeClueId(bIdx, c, q));
      }
    }
    if (allClueIds.length > 0) {
      const picked = allClueIds[Math.floor(Math.random() * allClueIds.length)];
      dailyDoubles[picked] = true;
    }
  }
  return dailyDoubles;
}

function createSession(sessionId, contentSnapshot) {
  const boards = deepClone(contentSnapshot.boards);
  // Ensure every board has a multiplier (default 1)
  for (const board of boards) {
    if (board.multiplier == null) board.multiplier = 1;
  }

  return {
    sessionId,
    boards,
    currentBoardIndex: 0,

    selectedClueId: null,
    buzzEnabled: false,
    buzzOrder: [],
    answerRevealed: false,

    // Daily Double
    dailyDoubles: pickDailyDoubles(boards), // { clueId: true }
    dailyDoublePhase: null, // null | 'reveal' | 'done'

    // Score tracking for round-end deltas
    scoreAtClueStart: {}, // { playerId: score }
    lastClueDeltas: null,  // null | { playerId: delta } — set after done()
    showingSummary: false,

    used: {},

    players: {},
    joinOrder: [],
    gameOver: false,
  };
}

function getClue(session, clueId) {
  const parsed = parseClueId(clueId);
  if (!parsed) return null;
  const { boardIndex, categoryIndex, clueIndex } = parsed;
  const board = session.boards?.[boardIndex];
  const category = board?.categories?.[categoryIndex];
  const clue = category?.clues?.[clueIndex];
  if (!board || !category || !clue) return null;
  return { boardIndex, categoryIndex, clueIndex, clue };
}

function isClueUsed(session, clueId) {
  const parsed = parseClueId(clueId);
  if (!parsed) return true;
  const usedForBoard = session.used?.[parsed.boardIndex] ?? {};
  return Boolean(usedForBoard[clueId]);
}

function isBoardComplete(session, boardIndex) {
  const board = session.boards?.[boardIndex];
  if (!board?.categories) return false;

  const total =
    board.categories.reduce((acc, cat) => acc + (cat.clues ? cat.clues.length : 0), 0) || 0;
  if (total === 0) return false;

  let usedCount = 0;
  for (let c = 0; c < board.categories.length; c += 1) {
    const cat = board.categories[c];
    for (let q = 0; q < (cat.clues?.length ?? 0); q += 1) {
      const clueId = makeClueId(boardIndex, c, q);
      if (isClueUsed(session, clueId)) usedCount += 1;
    }
  }
  return usedCount >= total;
}

function isDailyDouble(session, clueId) {
  return Boolean(session.dailyDoubles?.[clueId]);
}

/**
 * Get the effective point value for a clue, accounting for board multiplier and daily double.
 */
function getEffectiveValue(session, clueId) {
  const result = getClue(session, clueId);
  if (!result) return 0;
  const board = session.boards?.[result.boardIndex];
  const multiplier = board?.multiplier ?? 1;
  const ddMultiplier = isDailyDouble(session, clueId) ? 2 : 1;
  return (result.clue.value ?? 0) * multiplier * ddMultiplier;
}

function selectClue(session, clueId) {
  if (!clueId) return { ok: false, error: 'Missing clueId' };
  const parsed = parseClueId(clueId);
  if (!parsed) return { ok: false, error: 'Invalid clueId format' };
  if (parsed.boardIndex !== session.currentBoardIndex) {
    return { ok: false, error: 'Clue is not on the current board' };
  }
  if (isClueUsed(session, clueId)) {
    return { ok: false, error: 'Clue already used' };
  }

  session.selectedClueId = clueId;
  session.buzzEnabled = false;
  session.buzzOrder = [];
  session.answerRevealed = false;
  session.lastClueDeltas = null;
  session.showingSummary = false;

  // Snapshot scores at clue start
  session.scoreAtClueStart = {};
  for (const pid of Object.keys(session.players ?? {})) {
    session.scoreAtClueStart[pid] = Number(session.players[pid]?.score ?? 0);
  }

  // Reset per-player buzzes
  for (const pid of Object.keys(session.players ?? {})) {
    if (session.players[pid]) session.players[pid].hasBuzzed = false;
  }

  // If daily double, enter reveal phase
  if (isDailyDouble(session, clueId)) {
    session.dailyDoublePhase = 'reveal';
  } else {
    session.dailyDoublePhase = null;
  }

  return { ok: true };
}

function advanceDailyDouble(session) {
  if (session.dailyDoublePhase !== 'reveal') {
    return { ok: false, error: 'Not in daily double reveal phase' };
  }
  session.dailyDoublePhase = 'done';
  return { ok: true };
}

function finishReading(session) {
  if (!session.selectedClueId) return { ok: false, error: 'No clue selected' };
  session.buzzEnabled = true;
  return { ok: true };
}

function done(session) {
  if (!session.selectedClueId) return { ok: false, error: 'No clue selected' };
  const clueId = session.selectedClueId;
  const parsed = parseClueId(clueId);
  const boardIndex = parsed?.boardIndex ?? session.currentBoardIndex;

  if (!session.used[boardIndex]) session.used[boardIndex] = {};
  session.used[boardIndex][clueId] = true;

  // Compute score deltas
  const deltas = {};
  for (const pid of Object.keys(session.players ?? {})) {
    const before = Number(session.scoreAtClueStart?.[pid] ?? 0);
    const after = Number(session.players[pid]?.score ?? 0);
    deltas[pid] = after - before;
  }

  session.selectedClueId = null;
  session.buzzEnabled = false;
  session.buzzOrder = [];
  session.answerRevealed = false;
  session.dailyDoublePhase = null;
  session.lastClueDeltas = deltas;
  session.showingSummary = true;

  // Don't advance board yet — wait for nextAfterSummary

  return { ok: true };
}

function nextAfterSummary(session) {
  if (!session.showingSummary) return { ok: false, error: 'Not showing summary' };

  session.lastClueDeltas = null;
  session.showingSummary = false;

  // Check if the board is complete and advance
  const boardIndex = session.currentBoardIndex;
  if (isBoardComplete(session, boardIndex)) {
    const nextIndex = boardIndex + 1;
    if (nextIndex < (session.boards?.length ?? 0)) {
      session.currentBoardIndex = nextIndex;
    } else {
      session.gameOver = true;
    }
  }

  return { ok: true };
}

function resetBuzz(session) {
  session.buzzOrder = [];
  session.buzzEnabled = true;
  for (const pid of Object.keys(session.players ?? {})) {
    if (session.players[pid]) session.players[pid].hasBuzzed = false;
  }
  return { ok: true };
}

function toggleAnswerReveal(session) {
  if (!session.selectedClueId) return { ok: false, error: 'No clue selected' };
  session.answerRevealed = !session.answerRevealed;
  return { ok: true, answerRevealed: session.answerRevealed };
}

function skipToNextBoard(session) {
  const nextIndex = session.currentBoardIndex + 1;
  if (nextIndex >= (session.boards?.length ?? 0)) {
    // Last board — trigger game over
    session.selectedClueId = null;
    session.buzzEnabled = false;
    session.buzzOrder = [];
    session.answerRevealed = false;
    session.dailyDoublePhase = null;
    session.lastClueDeltas = null;
    session.showingSummary = false;
    session.gameOver = true;
    return { ok: true };
  }
  // Clear any active clue state
  session.selectedClueId = null;
  session.buzzEnabled = false;
  session.buzzOrder = [];
  session.answerRevealed = false;
  session.dailyDoublePhase = null;
  session.lastClueDeltas = null;
  session.showingSummary = false;
  session.currentBoardIndex = nextIndex;
  return { ok: true };
}

module.exports = {
  makeClueId,
  parseClueId,
  createSession,
  getClue,
  isClueUsed,
  isDailyDouble,
  getEffectiveValue,
  isBoardComplete,
  selectClue,
  advanceDailyDouble,
  finishReading,
  done,
  nextAfterSummary,
  resetBuzz,
  toggleAnswerReveal,
  skipToNextBoard,
};
