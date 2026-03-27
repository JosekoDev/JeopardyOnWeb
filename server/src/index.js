const path = require('path');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { readDefaultContent } = require('./contentStore');
const {
  initDb,
  getUserByUsername,
  createUser,
  getUserById,
  setUserContent,
} = require('./db');
const {
  createSession,
  getClue,
  selectClue,
  finishReading,
  done,
  nextAfterSummary,
  resetBuzz,
  toggleAnswerReveal,
  isClueUsed,
  advanceDailyDouble,
  getEffectiveValue,
  skipToNextBoard,
} = require('./gameModel');

const PORT = process.env.PORT ? Number(process.env.PORT) : 3010;
const authTokens = new Map();

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: '1mb' }));

function normalizeUsername(value) {
  return String(value || '').trim();
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function createAuthResponse(user) {
  const token = createToken();
  authTokens.set(token, user.id);
  return {
    token,
    user: {
      id: user.id,
      username: user.username,
    },
  };
}

async function resolveContentForUser(userId) {
  const user = await getUserById(userId);
  const fallback = readDefaultContent();
  if (!user?.content_json) return fallback;
  try {
    const parsed = JSON.parse(user.content_json);
    if (!parsed || !Array.isArray(parsed.boards)) return fallback;
    return parsed;
  } catch (err) {
    return fallback;
  }
}

async function requireAuth(req, res, next) {
  try {
    const auth = String(req.headers.authorization || '');
    if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = auth.slice('Bearer '.length).trim();
    const userId = authTokens.get(token);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const user = await getUserById(userId);
    if (!user) {
      authTokens.delete(token);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.auth = { token, user };
    return next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password ?? '');
    if (username.length < 3 || username.length > 24) {
      return res.status(400).json({ error: 'Username must be 3-24 characters' });
    }
    if (password.length < 6 || password.length > 128) {
      return res.status(400).json({ error: 'Password must be 6-128 characters' });
    }

    const existing = await getUserByUsername(username);
    if (existing) return res.status(409).json({ error: 'Username already exists' });

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const defaultContent = readDefaultContent();
    const user = await createUser({
      username,
      passwordHash,
      passwordSalt: salt,
      contentJson: JSON.stringify(defaultContent),
    });
    return res.json(createAuthResponse(user));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to sign up' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const password = String(req.body?.password ?? '');
    const user = await getUserByUsername(username);
    if (!user) return res.status(401).json({ error: 'Invalid username or password' });
    const passwordHash = hashPassword(password, user.password_salt);
    if (passwordHash !== user.password_hash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    return res.json(createAuthResponse(user));
  } catch (err) {
    return res.status(500).json({ error: 'Failed to log in' });
  }
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  authTokens.delete(req.auth.token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: { id: req.auth.user.id, username: req.auth.user.username } });
});

app.get('/api/content', requireAuth, async (req, res) => {
  try {
    const content = await resolveContentForUser(req.auth.user.id);
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read content' });
  }
});

app.post('/api/content', requireAuth, async (req, res) => {
  try {
    const next = req.body;
    if (!next || !Array.isArray(next.boards)) return res.status(400).json({ error: 'Invalid content format' });
    await setUserContent(req.auth.user.id, JSON.stringify(next));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save content' });
  }
});

const sessions = new Map();
const lobbyCodeToSessionId = new Map();

function normalizeLobbyCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function generateLobbyCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function allocateUniqueLobbyCode() {
  for (let i = 0; i < 20; i += 1) {
    const code = generateLobbyCode();
    if (!lobbyCodeToSessionId.has(code)) return code;
  }
  return `${generateLobbyCode()}${generateLobbyCode()}`.slice(0, 8);
}

app.post('/api/sessions', requireAuth, async (req, res) => {
  try {
    const sessionId = crypto.randomUUID();
    const contentSnapshot = await resolveContentForUser(req.auth.user.id);
    const session = createSession(sessionId, contentSnapshot);
    sessions.set(sessionId, session);
    const lobbyCode = allocateUniqueLobbyCode();
    lobbyCodeToSessionId.set(lobbyCode, sessionId);
    session.lobbyCode = lobbyCode;
    res.json({ sessionId, lobbyCode });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create session' });
  }
});

app.post('/api/lobbies/join', (req, res) => {
  try {
    const lobbyCode = normalizeLobbyCode(req.body?.lobbyCode);
    const sessionId = lobbyCodeToSessionId.get(lobbyCode);
    if (!sessionId) return res.status(404).json({ error: 'Lobby not found' });

    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Lobby not found' });

    const rawName = String(req.body?.username ?? '').trim();
    if (!rawName) return res.status(400).json({ error: 'Username required' });
    if (rawName.length > 16) return res.status(400).json({ error: 'Username must be 16 characters or less' });

    const username = rawName;
    const playerId = crypto.randomUUID();
    session.players[playerId] = {
      name: username,
      color: '#111111',
      connected: false,
      hasBuzzed: false,
      score: 0,
    };
    if (!Array.isArray(session.joinOrder)) session.joinOrder = [];
    session.joinOrder.push(playerId);

    res.json({ sessionId, playerId });
  } catch (err) {
    res.status(500).json({ error: 'Failed to join lobby' });
  }
});

app.get('/api/lobbies/:lobbyCode/exists', (req, res) => {
  const lobbyCode = normalizeLobbyCode(req.params.lobbyCode);
  const sessionId = lobbyCodeToSessionId.get(lobbyCode);
  if (!sessionId) return res.json({ exists: false });
  const session = sessions.get(sessionId);
  if (!session) return res.json({ exists: false });
  return res.json({ exists: true });
});

// Serve frontend static files
const clientPath = path.join(__dirname, '..', 'public');
const audioPath = path.join(__dirname, '..', '..', 'audio');
app.use(express.static(clientPath));
app.use('/audio', express.static(audioPath));

// Fallback for React Router (using RegExp to bypass path-to-regexp syntax errors in newer Express)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

function serializeState(session) {
  return {
    lobbyCode: session.lobbyCode,
    joinOrder: session.joinOrder ?? [],
    currentBoardIndex: session.currentBoardIndex,
    selectedClueId: session.selectedClueId,
    buzzEnabled: session.buzzEnabled,
    buzzOrder: session.buzzOrder,
    answerRevealed: Boolean(session.answerRevealed),
    players: session.players,
    boards: session.boards,
    used: session.used,
    // New fields
    dailyDoubles: session.dailyDoubles ?? {},
    dailyDoublePhase: session.dailyDoublePhase ?? null,
    lastClueDeltas: session.lastClueDeltas ?? null,
    showingSummary: Boolean(session.showingSummary),
    gameOver: Boolean(session.gameOver),
  };
}

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
  },
});

io.on('connection', (socket) => {
  socket.on('client:join', ({ sessionId, role, playerId }) => {
    if (!sessionId) return;
    const session = sessions.get(sessionId);
    if (!session) {
      socket.emit('error', { error: 'Session not found' });
      return;
    }

    socket.join(sessionId);
    socket.data.sessionId = sessionId;
    socket.data.role = role;
    socket.data.playerId = playerId;

    if (role === 'player' && playerId) {
      const player = session.players[playerId];
      if (!player) {
        socket.emit('error', { error: 'Player not found' });
        return;
      }
      player.connected = true;
      player.hasBuzzed = false;
    }

    socket.emit('state:update', serializeState(session));
  });

  socket.on('host:selectClue', ({ clueId } = {}) => {
    const { sessionId, role } = socket.data ?? {};
    if (role !== 'host') return;
    const session = sessions.get(sessionId);
    if (!session) return;
    if (!clueId) return;

    const existing = getClue(session, clueId);
    if (!existing) return;
    if (isClueUsed(session, clueId)) return;

    const result = selectClue(session, clueId);
    if (!result?.ok) return;
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('host:advanceDailyDouble', () => {
    const { sessionId, role } = socket.data ?? {};
    if (role !== 'host') return;
    const session = sessions.get(sessionId);
    if (!session) return;
    const result = advanceDailyDouble(session);
    if (!result?.ok) return;
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('host:finishReading', () => {
    const { sessionId, role } = socket.data ?? {};
    if (role !== 'host') return;
    const session = sessions.get(sessionId);
    if (!session) return;
    const result = finishReading(session);
    if (!result?.ok) return;
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('host:toggleAnswer', () => {
    const { sessionId, role } = socket.data ?? {};
    if (role !== 'host') return;
    const session = sessions.get(sessionId);
    if (!session) return;
    const result = toggleAnswerReveal(session);
    if (!result?.ok) return;
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('host:adjustScore', ({ playerId, delta } = {}) => {
    const { sessionId, role } = socket.data ?? {};
    if (role !== 'host') return;
    const session = sessions.get(sessionId);
    if (!session) return;
    if (!playerId) return;
    const d = Number(delta);
    if (!Number.isFinite(d) || d === 0) return;
    const player = session.players?.[playerId];
    if (!player) return;
    player.score = Number(player.score ?? 0) + d;
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('host:resetBuzz', () => {
    const { sessionId, role } = socket.data ?? {};
    if (role !== 'host') return;
    const session = sessions.get(sessionId);
    if (!session) return;
    const result = resetBuzz(session);
    if (!result?.ok) return;
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('host:done', () => {
    const { sessionId, role } = socket.data ?? {};
    if (role !== 'host') return;
    const session = sessions.get(sessionId);
    if (!session) return;

    const result = done(session);
    if (!result?.ok) return;
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('host:nextAfterSummary', () => {
    const { sessionId, role } = socket.data ?? {};
    if (role !== 'host') return;
    const session = sessions.get(sessionId);
    if (!session) return;
    const result = nextAfterSummary(session);
    if (!result?.ok) return;
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('host:skipBoard', () => {
    const { sessionId, role } = socket.data ?? {};
    if (role !== 'host') return;
    const session = sessions.get(sessionId);
    if (!session) return;
    const result = skipToNextBoard(session);
    if (!result?.ok) return;
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('player:buzz', () => {
    const { sessionId, role, playerId } = socket.data ?? {};
    if (role !== 'player' || !playerId) return;

    const session = sessions.get(sessionId);
    if (!session) return;
    if (!session.selectedClueId || !session.buzzEnabled) return;

    const player = session.players[playerId];
    if (!player || player.hasBuzzed) return;

    player.hasBuzzed = true;
    session.buzzOrder.push(playerId);
    io.to(sessionId).emit('state:update', serializeState(session));
  });

  socket.on('disconnect', () => {
    const { sessionId, role, playerId } = socket.data ?? {};
    if (role === 'player' && sessionId && playerId) {
      const session = sessions.get(sessionId);
      const player = session?.players?.[playerId];
      if (player) player.connected = false;
    }
  });
});

initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Jeopardy server listening on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database', err);
    process.exit(1);
  });

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\nReceived ${signal}. Shutting down...`);
  try { io.close(); } catch (e) { /* ignore */ }
  server.close(() => {
    console.log('Server closed. Bye.');
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
