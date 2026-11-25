import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const URL = 'http://localhost:3001';
const TOTAL = 200;
const quiz = {
  title: '200 Player Load Test',
  questions: [
    { text: 'Question one?', options: ['A', 'B', 'C', 'D'], correctIndex: 1, timeLimit: 10 },
    { text: 'Question two?', options: ['A', 'B', 'C', 'D'], correctIndex: 2, timeLimit: 10 },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const connect = () =>
  new Promise((resolve, reject) => {
    const socket = io(URL, { transports: ['websocket'], reconnection: false });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
const emitAck = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));
const waitEvent = (socket, event, ms = 20000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
const countQuestionDeliveries = (players) =>
  new Promise((resolve, reject) => {
    let seen = 0;
    const timer = setTimeout(
      () => reject(new Error(`game:question reached ${seen}/${TOTAL} players`)),
      15000,
    );
    for (const socket of players) {
      socket.once('game:question', () => {
        seen += 1;
        if (seen === TOTAL) {
          clearTimeout(timer);
          resolve();
        }
      });
    }
  });

const host = await connect();
let hostSawPlayers = 0;
const fullRoom = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('host never saw 200 players')), 20000);
  host.on('room:players', (list) => {
    hostSawPlayers = Math.max(hostSawPlayers, list.length);
    if (list.length >= TOTAL) {
      clearTimeout(timer);
      resolve(list);
    }
  });
});

const created = await emitAck(host, 'host:create', { quiz });
assert.equal(created.ok, true, created.error);
console.log('PIN', created.pin);

const started = Date.now();
const players = await Promise.all(
  Array.from({ length: TOTAL }, async (_, i) => {
    const socket = await connect();
    const ack = await emitAck(socket, 'player:join', {
      pin: created.pin,
      name: `Player ${String(i + 1).padStart(3, '0')}`,
    });
    assert.equal(ack.ok, true, `player ${i + 1}: ${ack.error}`);
    return socket;
  }),
);
const joinMs = Date.now() - started;

const joinedList = await fullRoom;
assert.equal(joinedList.length, TOTAL);
console.log(`JOINED ${TOTAL} in ${joinMs}ms; host sees ${hostSawPlayers}`);

const overflow = await connect();
const overflowAck = await emitAck(overflow, 'player:join', { pin: created.pin, name: 'Overflow' });
assert.equal(overflowAck.ok, false);
assert.match(overflowAck.error, /full/i);
overflow.disconnect();
console.log('OVERFLOW_REJECTED', overflowAck.error);

async function playRound(roundLabel) {
  await sleep(150);
  const revealEvent = waitEvent(host, 'game:reveal');
  const answersStart = Date.now();
  const acks = await Promise.all(
    players.map((socket, i) => emitAck(socket, 'player:answer', { choice: i % 4 })),
  );
  const answered = acks.filter((ack) => ack.ok).length;
  const reveal = await revealEvent;
  const revealMs = Date.now() - answersStart;
  assert.equal(reveal.results.length, TOTAL, 'reveal should include every player');
  assert.equal(
    reveal.counts.reduce((sum, n) => sum + n, 0),
    answered,
    'choice counts should add up to accepted answers',
  );
  console.log(
    `${roundLabel}: answered=${answered}/${TOTAL}, counts=${reveal.counts.join('/')}, reveal in ${revealMs}ms, top score=${reveal.results[0].score}`,
  );
  return { reveal, answered };
}

const q1Seen = countQuestionDeliveries(players);
const startAck = await emitAck(host, 'host:start');
assert.equal(startAck.ok, true, startAck.error);
await q1Seen;
console.log('QUESTION_1_REACHED_ALL');

const round1 = await playRound('ROUND_1');
const expectedQ1Correct = Array.from({ length: TOTAL }, (_, i) => i).filter((i) => i % 4 === 1).length;
assert.equal(round1.reveal.results.filter((r) => r.correct).length, expectedQ1Correct);

const lbEvent = waitEvent(host, 'game:leaderboard');
await emitAck(host, 'host:next');
const leaderboard = await lbEvent;
assert.equal(leaderboard.leaderboard.length, TOTAL);
console.log('LEADERBOARD_HAS_ALL', leaderboard.leaderboard.length);

const q2Seen = countQuestionDeliveries(players);
await emitAck(host, 'host:continue');
await q2Seen;
console.log('QUESTION_2_REACHED_ALL');

const round2 = await playRound('ROUND_2');
const expectedQ2Correct = Array.from({ length: TOTAL }, (_, i) => i).filter((i) => i % 4 === 2).length;
assert.equal(round2.reveal.results.filter((r) => r.correct).length, expectedQ2Correct);

const podiumEvent = waitEvent(host, 'game:podium');
await emitAck(host, 'host:next');
const podium = await podiumEvent;
assert.equal(podium.leaderboard.length, TOTAL);
console.log('PODIUM_HAS_ALL', podium.leaderboard.length, 'top=', podium.leaderboard[0].name);

assert.ok(podium.leaderboard[0].score > 0);
console.log(`LOAD${TOTAL}_PASS joinMs=${joinMs}`);

for (const socket of players) socket.disconnect();
host.disconnect();
process.exit(0);
