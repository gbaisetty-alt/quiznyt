import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Server } from 'socket.io';
import { isAvatarId, randomAvatarId } from '../shared/avatars.js';
import { SAMPLE_QUIZ } from './sampleQuiz.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '../dist');
const PORT = Number(process.env.PORT) || 3001;
const HOST_GRACE_MS = 25_000;

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '500kb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/sample-quiz', (req, res) => res.json(SAMPLE_QUIZ));
app.get('/api/ai/status', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    enabled: Boolean(process.env.OPENAI_API_KEY),
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  });
});

const AI_RATE_LIMIT = 5;
const AI_RATE_WINDOW_MS = 10 * 60_000;
const aiRequests = new Map();

function aiRateLimited(ip) {
  const now = Date.now();
  const recent = (aiRequests.get(ip) ?? []).filter((t) => now - t < AI_RATE_WINDOW_MS);
  if (recent.length >= AI_RATE_LIMIT) {
    aiRequests.set(ip, recent);
    return true;
  }
  recent.push(now);
  aiRequests.set(ip, recent);
  if (aiRequests.size > 500) {
    for (const [key, stamps] of aiRequests) {
      if (!stamps.some((t) => now - t < AI_RATE_WINDOW_MS)) aiRequests.delete(key);
    }
  }
  return false;
}

const AI_PROMPT = `You write multiple-choice quiz questions for a live classroom game.
Return ONLY a JSON object shaped like:
{"title":"Short quiz title","questions":[{"text":"question","options":["option A","option B","option C","option D"],"correctIndex":0,"timeLimit":20}]}
Rules:
- Produce exactly the requested number of questions.
- Each question has exactly 4 plausible options and exactly one correct answer.
- correctIndex is the 0-based index of the correct option.
- timeLimit is a whole number between 10 and 30 seconds.
- Question text is under 200 characters. Options are under 80 characters and contain no "A)" or "1." prefixes.
- Questions must be factual, unambiguous, and age-appropriate.`;

app.post('/api/ai/quiz', async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    res.status(503).json({
      ok: false,
      error: 'AI generation is not configured yet. Add an OPENAI_API_KEY to the server.',
    });
    return;
  }
  const topic = cleanText(req.body?.topic, 120);
  if (!topic) {
    res.status(400).json({ ok: false, error: 'Add a topic for the AI to build questions around.' });
    return;
  }
  if (aiRateLimited(req.ip)) {
    res.status(429).json({
      ok: false,
      error: 'Too many AI requests. Wait a few minutes and try again.',
    });
    return;
  }
  const count = Math.min(15, Math.max(3, Math.round(Number(req.body?.count)) || 8));
  const difficulty = ['easy', 'medium', 'hard'].includes(req.body?.difficulty)
    ? req.body.difficulty
    : 'medium';
  const existing = Array.isArray(req.body?.existing)
    ? req.body.existing
        .map((question) => cleanText(question, 200))
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: AI_PROMPT },
          {
            role: 'user',
            content: `Topic: ${topic}\nQuestions: ${count}\nDifficulty: ${difficulty}${
              existing.length
                ? `\nDo not duplicate these questions already in the quiz:\n${existing
                    .map((question) => `- ${question}`)
                    .join('\n')}`
                : ''
            }`,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (err) {
    console.error('[ai] request failed:', err?.message);
    res.status(502).json({ ok: false, error: 'Could not reach the AI service. Try again.' });
    return;
  }

  const body = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    console.error('[ai]', upstream.status, body?.error?.message);
    let error = 'The AI service could not generate a quiz. Try again.';
    if (upstream.status === 401) {
      error = 'The OpenAI API key was rejected. Check OPENAI_API_KEY.';
    } else if (upstream.status === 429) {
      error = 'OpenAI is rate limiting requests right now. Try again shortly.';
    } else if (body?.error?.code === 'model_not_found') {
      error = `The model "${model}" is unavailable for this key. Set OPENAI_MODEL to a model you can use.`;
    }
    res.status(502).json({ ok: false, error });
    return;
  }

  let draft = null;
  try {
    draft = JSON.parse(body?.choices?.[0]?.message?.content ?? '');
  } catch {
    draft = null;
  }
  if (!draft) {
    res.status(502).json({ ok: false, error: 'The AI returned a malformed quiz. Try again.' });
    return;
  }
  try {
    res.json({ ok: true, quiz: normalizeQuiz(draft) });
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: `The AI returned an invalid quiz: ${err.message} Try again.`,
    });
  }
});

if (existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => res.sendFile(path.join(DIST_DIR, 'index.html')));
}

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

/** @type {Map<string, Room>} */
const rooms = new Map();

function newError(message) {
  const err = new Error(message);
  err.expose = true;
  return err;
}

function cleanText(value, max) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function makePin() {
  let pin;
  do {
    pin = String(Math.floor(100000 + Math.random() * 900000));
  } while (rooms.has(pin));
  return pin;
}

function normalizeQuiz(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const title = cleanText(source.title, 80) || 'Untitled Quiz';
  if (!Array.isArray(source.questions) || source.questions.length === 0) {
    throw newError('Add at least one question before hosting.');
  }
  if (source.questions.length > 50) {
    throw newError('Quizzes can have at most 50 questions.');
  }
  const questions = source.questions.map((q, i) => {
    const text = cleanText(q?.text, 200);
    if (!text) throw newError(`Question ${i + 1} needs a question.`);
    const rawOptions = Array.isArray(q?.options) ? q.options : [];
    if (rawOptions.length !== 4) {
      throw newError(`Question ${i + 1} needs exactly 4 answer options.`);
    }
    const options = rawOptions.map((opt) => cleanText(opt, 80));
    if (options.some((opt) => !opt)) {
      throw newError(`Question ${i + 1} has an empty answer option.`);
    }
    if (!Number.isInteger(q?.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) {
      throw newError(`Question ${i + 1} needs a correct answer selected.`);
    }
    const seconds = Number(q?.timeLimit);
    const timeLimit = Number.isFinite(seconds) ? Math.min(60, Math.max(10, Math.round(seconds))) : 20;
    return { text, options, correctIndex: q.correctIndex, timeLimit };
  });
  return { title, questions };
}

function activePlayers(room) {
  return [...room.players.values()].filter((p) => p.connected);
}

function publicPlayers(room) {
  return [...room.players.values()]
    .map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      connected: p.connected,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function answerCount(room) {
  return { answered: room.answers.size, total: activePlayers(room).length };
}

function destroyRoom(room) {
  clearTimeout(room.timer);
  clearTimeout(room.revealTimer);
  clearTimeout(room.hostGraceTimer);
  rooms.delete(room.pin);
}

function closeRoom(room, reason) {
  io.to(room.pin).emit('game:closed', { reason });
  destroyRoom(room);
  io.in(room.pin).socketsLeave(room.pin);
}

function questionPayload(room) {
  const q = room.quiz.questions[room.index];
  return {
    index: room.index,
    total: room.quiz.questions.length,
    question: q.text,
    options: q.options,
    timeLimit: q.timeLimit,
    endsAt: room.questionEndsAt,
    serverNow: Date.now(),
    answered: room.answers.size,
    playerCount: activePlayers(room).length,
  };
}

function startQuestion(room) {
  room.index += 1;
  const q = room.quiz.questions[room.index];
  if (!q) return;
  room.status = 'question';
  room.answers = new Map();
  room.questionStartedAt = Date.now();
  room.questionEndsAt = room.questionStartedAt + q.timeLimit * 1000;
  const payload = questionPayload(room);
  room.lastEvent = { type: 'question', payload };
  io.to(room.pin).emit('game:question', payload);
  clearTimeout(room.timer);
  room.timer = setTimeout(() => endQuestion(room, 'timeout'), q.timeLimit * 1000 + 120);
}

function maybeEndEarly(room) {
  if (room.status !== 'question') return;
  const players = activePlayers(room);
  if (players.length > 0 && players.every((p) => room.answers.has(p.id))) {
    clearTimeout(room.timer);
    clearTimeout(room.revealTimer);
    room.revealTimer = setTimeout(() => endQuestion(room, 'all-answered'), 400);
  }
}

function endQuestion(room, reason) {
  if (room.status !== 'question') return;
  clearTimeout(room.timer);
  room.status = 'reveal';
  const q = room.quiz.questions[room.index];
  const counts = [0, 0, 0, 0];
  const results = [];
  for (const player of room.players.values()) {
    const ans = room.answers.get(player.id);
    if (ans) counts[ans.choice] += 1;
    results.push({
      id: player.id,
      name: player.name,
      avatar: player.avatar,
      connected: player.connected,
      choice: ans ? ans.choice : null,
      correct: Boolean(ans?.correct),
      points: ans?.points ?? 0,
      score: player.score,
    });
  }
  const payload = {
    index: room.index,
    total: room.quiz.questions.length,
    question: q.text,
    options: q.options,
    correctIndex: q.correctIndex,
    counts,
    results: results.sort((a, b) => b.score - a.score),
    reason,
  };
  room.lastEvent = { type: 'reveal', payload };
  io.to(room.pin).emit('game:reveal', payload);
  io.to(room.pin).emit('room:players', publicPlayers(room));
}

function sendLeaderboard(room) {
  room.status = 'leaderboard';
  const payload = {
    index: room.index,
    total: room.quiz.questions.length,
    leaderboard: publicPlayers(room),
  };
  room.lastEvent = { type: 'leaderboard', payload };
  io.to(room.pin).emit('game:leaderboard', payload);
}

function sendPodium(room) {
  room.status = 'podium';
  const payload = {
    total: room.quiz.questions.length,
    leaderboard: publicPlayers(room),
  };
  room.lastEvent = { type: 'podium', payload };
  io.to(room.pin).emit('game:podium', payload);
}

function detachPlayerSocket(socket) {
  const pin = socket.data.playerPin;
  if (!pin) return;
  const room = rooms.get(pin);
  if (room) {
    const player = room.players.get(socket.data.playerId);
    if (player && player.socketId === socket.id) {
      if (room.status === 'lobby') room.players.delete(player.id);
      else {
        player.connected = false;
        player.socketId = null;
      }
      io.to(room.pin).emit('room:players', publicPlayers(room));
      io.to(room.pin).emit('game:answerCount', answerCount(room));
      maybeEndEarly(room);
    }
  }
  socket.leave(pin);
  delete socket.data.playerPin;
  delete socket.data.playerId;
}

function createRoom(socket, quiz) {
  const pin = makePin();
  const room = {
    pin,
    hostToken: randomUUID(),
    hostId: socket.id,
    quiz,
    status: 'lobby',
    index: -1,
    players: new Map(),
    answers: new Map(),
    questionStartedAt: 0,
    questionEndsAt: 0,
    timer: null,
    revealTimer: null,
    hostGraceTimer: null,
    lastEvent: null,
    createdAt: Date.now(),
  };
  rooms.set(pin, room);
  return room;
}

io.on('connection', (socket) => {
  socket.on('host:create', (payload, ack) => {
    if (typeof ack !== 'function') return;
    try {
      const existingPin = socket.data.hostPin;
      const existingRoom = existingPin ? rooms.get(existingPin) : null;
      if (existingRoom && existingRoom.hostId === socket.id) {
        closeRoom(existingRoom, 'host-started-new-game');
      }
      delete socket.data.hostPin;
      const quiz = normalizeQuiz(payload?.quiz ?? payload);
      const room = createRoom(socket, quiz);
      socket.join(room.pin);
      socket.data.hostPin = room.pin;
      ack({
        ok: true,
        pin: room.pin,
        hostToken: room.hostToken,
        quizTitle: quiz.title,
        questionCount: quiz.questions.length,
      });
    } catch (err) {
      ack({ ok: false, error: err.expose ? err.message : 'Could not create the quiz.' });
    }
  });

  socket.on('host:rejoin', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const pin = cleanText(payload?.pin, 6);
    const room = rooms.get(pin);
    if (!room || !payload?.hostToken || room.hostToken !== payload.hostToken) {
      return ack({ ok: false, error: 'Host session not found. Start a new game.' });
    }
    clearTimeout(room.hostGraceTimer);
    room.hostGraceTimer = null;
    room.hostId = socket.id;
    socket.data.hostPin = room.pin;
    socket.join(room.pin);
    socket.to(room.pin).emit('game:hostBack');
    ack({
      ok: true,
      pin: room.pin,
      status: room.status,
      quizTitle: room.quiz.title,
      questionCount: room.quiz.questions.length,
      index: room.index,
      players: publicPlayers(room),
      lastEvent: room.lastEvent,
    });
  });

  socket.on('host:start', (ack) => {
    const room = rooms.get(socket.data.hostPin);
    if (!room || room.hostId !== socket.id) return ack?.({ ok: false, error: 'Host session expired.' });
    if (room.status !== 'lobby') return ack?.({ ok: false, error: 'The game has already started.' });
    if (activePlayers(room).length === 0) return ack?.({ ok: false, error: 'Wait for at least one player to join.' });
    startQuestion(room);
    ack?.({ ok: true });
  });

  socket.on('host:next', (ack) => {
    const room = rooms.get(socket.data.hostPin);
    if (!room || room.hostId !== socket.id) return ack?.({ ok: false, error: 'Host session expired.' });
    if (room.status !== 'reveal') return ack?.({ ok: false, error: 'Not ready for the next step.' });
    if (room.index + 1 >= room.quiz.questions.length) sendPodium(room);
    else sendLeaderboard(room);
    ack?.({ ok: true });
  });

  socket.on('host:continue', (ack) => {
    const room = rooms.get(socket.data.hostPin);
    if (!room || room.hostId !== socket.id) return ack?.({ ok: false, error: 'Host session expired.' });
    if (room.status !== 'leaderboard') return ack?.({ ok: false, error: 'Not ready for the next question.' });
    startQuestion(room);
    ack?.({ ok: true });
  });

  socket.on('host:leave', () => {
    const room = rooms.get(socket.data.hostPin);
    if (!room || room.hostId !== socket.id) return;
    clearTimeout(room.hostGraceTimer);
    room.hostGraceTimer = setTimeout(() => {
      if (!rooms.has(room.pin)) return;
      closeRoom(room, 'host-left');
    }, 2500);
  });

  socket.on('host:end', (ack) => {
    const room = rooms.get(socket.data.hostPin);
    if (!room || room.hostId !== socket.id) {
      return ack?.({ ok: false, error: 'Host session expired.' });
    }
    closeRoom(room, 'host-ended');
    delete socket.data.hostPin;
    ack?.({ ok: true });
  });

  socket.on('player:join', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const pin = cleanText(payload?.pin, 6);
    const room = rooms.get(pin);
    if (!room) return ack({ ok: false, error: 'No game found with that PIN.' });
    if (room.status !== 'lobby') return ack({ ok: false, error: 'That game is already in progress.' });
    if (socket.data.playerPin) detachPlayerSocket(socket);
    const name = cleanText(payload?.name, 16);
    if (!name) return ack({ ok: false, error: 'Pick a nickname to join.' });
    const taken = [...room.players.values()].some(
      (p) => p.connected && p.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) return ack({ ok: false, error: 'That nickname is taken. Try another.' });
    if (room.players.size >= 200) return ack({ ok: false, error: 'This room is full.' });

    const player = {
      id: randomUUID(),
      name,
      avatar: isAvatarId(payload?.avatar) ? payload.avatar : randomAvatarId(),
      score: 0,
      connected: true,
      socketId: socket.id,
      joinedAt: Date.now(),
    };
    room.players.set(player.id, player);
    socket.data.playerPin = room.pin;
    socket.data.playerId = player.id;
    socket.join(room.pin);
    ack({
      ok: true,
      playerId: player.id,
      name,
      avatar: player.avatar,
      pin: room.pin,
      quizTitle: room.quiz.title,
    });
    io.to(room.pin).emit('room:players', publicPlayers(room));
  });

  socket.on('player:rejoin', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const pin = cleanText(payload?.pin, 6);
    const room = rooms.get(pin);
    if (!room) return ack({ ok: false, error: 'That game has ended.' });
    const player = room.players.get(String(payload?.playerId ?? ''));
    if (!player) return ack({ ok: false, error: 'Your spot in this game is gone.' });

    const previousSocket = player.socketId;
    player.socketId = socket.id;
    player.connected = true;
    socket.data.playerPin = room.pin;
    socket.data.playerId = player.id;
    socket.join(room.pin);
    if (previousSocket && previousSocket !== socket.id) {
      io.in(previousSocket).socketsLeave(room.pin);
    }
    const answered = room.answers.get(player.id);
    ack({
      ok: true,
      pin: room.pin,
      quizTitle: room.quiz.title,
      questionCount: room.quiz.questions.length,
      status: room.status,
      index: room.index,
      player: {
        id: player.id,
        name: player.name,
        avatar: player.avatar,
        score: player.score,
      },
      lastEvent: room.lastEvent,
      answeredChoice: answered ? answered.choice : null,
      answerCount: answerCount(room),
    });
    io.to(room.pin).emit('room:players', publicPlayers(room));
    io.to(room.pin).emit('game:answerCount', answerCount(room));
  });

  socket.on('player:answer', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const room = rooms.get(socket.data.playerPin);
    if (!room) return ack({ ok: false, error: 'Game not found.' });
    const player = room.players.get(socket.data.playerId);
    if (!player) return ack({ ok: false, error: 'You are not in this game.' });
    if (room.status !== 'question') return ack({ ok: false, error: 'Answers are closed.' });
    if (room.answers.has(player.id)) return ack({ ok: false, error: 'You already answered.' });
    const choice = payload?.choice;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) {
      return ack({ ok: false, error: 'Invalid answer.' });
    }
    const now = Date.now();
    if (now > room.questionEndsAt + 250) return ack({ ok: false, error: 'Too late!' });

    const q = room.quiz.questions[room.index];
    const correct = choice === q.correctIndex;
    const remaining = Math.max(0, room.questionEndsAt - now);
    const points = correct ? Math.round(1000 * (remaining / (q.timeLimit * 1000))) : 0;
    room.answers.set(player.id, { choice, correct, points });
    player.score += points;
    ack({ ok: true, choice });
    io.to(room.pin).emit('game:answerCount', answerCount(room));
    maybeEndEarly(room);
  });

  socket.on('player:leave', () => {
    detachPlayerSocket(socket);
  });

  socket.on('time:sync', (ack) => {
    if (typeof ack === 'function') ack({ serverNow: Date.now() });
  });

  socket.on('disconnect', () => {
    const hostRoom = rooms.get(socket.data.hostPin);
    if (hostRoom && hostRoom.hostId === socket.id) {
      io.to(hostRoom.pin).emit('game:hostAway');
      hostRoom.hostGraceTimer = setTimeout(() => {
        if (!rooms.has(hostRoom.pin)) return;
        closeRoom(hostRoom, 'host-left');
      }, HOST_GRACE_MS);
    }

    const playerRoom = rooms.get(socket.data.playerPin);
    if (playerRoom) {
      const player = playerRoom.players.get(socket.data.playerId);
      if (player && player.socketId === socket.id) {
        if (playerRoom.status === 'lobby') playerRoom.players.delete(player.id);
        else {
          player.connected = false;
          player.socketId = null;
        }
        io.to(playerRoom.pin).emit('room:players', publicPlayers(playerRoom));
        io.to(playerRoom.pin).emit('game:answerCount', answerCount(playerRoom));
        maybeEndEarly(playerRoom);
      }
    }
  });
});

const janitor = setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const room of rooms.values()) {
    if (room.createdAt < cutoff) {
      io.to(room.pin).emit('game:closed', { reason: 'expired' });
      destroyRoom(room);
    }
  }
}, 30 * 60 * 1000);
janitor.unref();

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`QuizBlitz server listening on http://localhost:${PORT}`);
});
