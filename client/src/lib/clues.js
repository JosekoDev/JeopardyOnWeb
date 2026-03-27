export function makeClueId(boardIndex, categoryIndex, clueIndex) {
  return `b${boardIndex}-c${categoryIndex}-q${clueIndex}`;
}

export function parseClueId(clueId) {
  if (!clueId) return null;
  const match = /^b(\d+)-c(\d+)-q(\d+)$/.exec(clueId);
  if (!match) return null;
  return {
    boardIndex: Number(match[1]),
    categoryIndex: Number(match[2]),
    clueIndex: Number(match[3]),
  };
}

export function getClueFromState(state, clueId) {
  const parsed = parseClueId(clueId);
  if (!parsed) return null;

  const board = state.boards?.[parsed.boardIndex];
  const category = board?.categories?.[parsed.categoryIndex];
  const clue = category?.clues?.[parsed.clueIndex];
  if (!board || !category || !clue) return null;

  return {
    ...parsed,
    categoryName: category.name,
    questionText: clue.questionText,
    answerText: clue.answerText,
    value: clue.value,
  };
}

/**
 * Get effective point value accounting for board multiplier and daily double.
 */
export function getEffectiveValue(state, clueId) {
  const parsed = parseClueId(clueId);
  if (!parsed) return 0;
  const board = state.boards?.[parsed.boardIndex];
  const clue = board?.categories?.[parsed.categoryIndex]?.clues?.[parsed.clueIndex];
  if (!clue) return 0;
  const multiplier = board?.multiplier ?? 1;
  const isDailyDouble = Boolean(state.dailyDoubles?.[clueId]);
  return (clue.value ?? 0) * multiplier * (isDailyDouble ? 2 : 1);
}

/**
 * Get display value for the board grid (value × board multiplier, but NOT daily double 2×).
 */
export function getDisplayValue(state, clueId) {
  const parsed = parseClueId(clueId);
  if (!parsed) return 0;
  const board = state.boards?.[parsed.boardIndex];
  const clue = board?.categories?.[parsed.categoryIndex]?.clues?.[parsed.clueIndex];
  if (!clue) return 0;
  const multiplier = board?.multiplier ?? 1;
  return (clue.value ?? 0) * multiplier;
}
