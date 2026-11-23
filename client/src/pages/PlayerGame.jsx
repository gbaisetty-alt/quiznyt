import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Crown,
  Loader2,
  LogOut,
  Sparkles,
  Trophy,
  WifiOff,
  XCircle,
} from 'lucide-react';
import Brand from '../components/Brand.jsx';
import Button from '../components/Button.jsx';
import Confetti from '../components/Confetti.jsx';
import LeaderboardList from '../components/LeaderboardList.jsx';
import Shape from '../components/Shape.jsx';
import TimerRing from '../components/TimerRing.jsx';
import { ANSWERS } from '../lib/answers.js';
import { request, socket } from '../lib/socket.js';
import { clearPlayerSession, loadPlayerSession } from '../lib/session.js';
import { useCountdown } from '../lib/useCountdown.js';

function PlayerHeader({ question, score, name }) {
  return (
    <header className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <Brand compact />
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden max-w-[110px] truncate text-xs font-semibold text-white/50 sm:block">
          {name}
        </span>
        {question && (
          <span className="rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-bold tabular-nums">
            Q{question.index + 1}/{question.total}
          </span>
        )}
        <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1.5 text-[11px] font-bold tabular-nums text-accent">
          <Trophy className="h-3.5 w-3.5" />
          {(score ?? 0).toLocaleString()}
        </span>
      </div>
    </header>
  );
}

export default function PlayerGame() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [phase, setPhase] = useState('connecting');
  const [message, setMessage] = useState('');
  const [me, setMe] = useState(null);
  const [question, setQuestion] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [podium, setPodium] = useState(null);
  const [myChoice, setMyChoice] = useState(null);
  const [answerBusy, setAnswerBusy] = useState(false);
  const [answerStats, setAnswerStats] = useState({ answered: 0, total: 0 });
  const [online, setOnline] = useState(socket.connected);
  const [hostAway, setHostAway] = useState(false);
  const [notice, setNotice] = useState(null);
  const sessionRef = useRef(null);

  const { secondsLeft, timeLimit, fraction, expired } = useCountdown(question);

  useEffect(() => {
    const stored = loadPlayerSession();
    if (!stored) {
      navigate('/join', { replace: true });
      return undefined;
    }
    sessionRef.current = stored;
    setSession(stored);
    setMe({ id: stored.playerId, name: stored.name, score: 0 });

    let cancelled = false;
    let rejoining = false;

    const applySnapshot = (snapshot) => {
      setMe(snapshot.player);
      setHostAway(false);
      if (snapshot.quizTitle) {
        setSession((prev) => (prev ? { ...prev, quizTitle: snapshot.quizTitle } : prev));
      }
      setAnswerStats({
        answered: snapshot.answerCount?.answered ?? 0,
        total: snapshot.answerCount?.total ?? 0,
      });
      const event = snapshot.lastEvent;
      if (event?.payload) {
        if (event.type === 'question') setQuestion(event.payload);
        if (event.type === 'reveal') setReveal(event.payload);
        if (event.type === 'leaderboard') setLeaderboard(event.payload);
        if (event.type === 'podium') setPodium(event.payload);
      }
      if (snapshot.status === 'lobby') {
        setPhase('lobby');
        return;
      }
      if (snapshot.status === 'question') {
        const answeredChoice =
          snapshot.answeredChoice === null || snapshot.answeredChoice === undefined
            ? null
            : snapshot.answeredChoice;
        setMyChoice(answeredChoice);
        setPhase(answeredChoice === null ? 'question' : 'answered');
        return;
      }
      setPhase(snapshot.status);
    };

    const rejoin = async () => {
      if (cancelled || rejoining) return;
      rejoining = true;
      const res = await request('player:rejoin', {
        pin: stored.pin,
        playerId: stored.playerId,
      });
      rejoining = false;
      if (cancelled) return;
      if (!res.ok) {
        setPhase('closed');
        setMessage(res.error || 'You are no longer in this game.');
        return;
      }
      applySnapshot(res);
    };

    rejoin();

    const onConnect = () => {
      setOnline(true);
      rejoin();
    };
    const onDisconnect = () => setOnline(false);
    const onQuestion = (payload) => {
      setQuestion(payload);
      setReveal(null);
      setMyChoice(null);
      setNotice(null);
      setHostAway(false);
      setAnswerStats({
        answered: payload.answered ?? 0,
        total: payload.playerCount ?? 0,
      });
      setPhase('question');
    };
    const onAnswerCount = (stats) => setAnswerStats(stats);
    const onReveal = (payload) => {
      setReveal(payload);
      const mine = payload.results.find((r) => r.id === sessionRef.current?.playerId);
      if (mine) setMe((prev) => (prev ? { ...prev, score: mine.score } : prev));
      setPhase('reveal');
    };
    const onLeaderboard = (payload) => {
      setLeaderboard(payload);
      setPhase('leaderboard');
    };
    const onPodium = (payload) => {
      setPodium(payload);
      const mine = payload.leaderboard.find((p) => p.id === sessionRef.current?.playerId);
      if (mine) setMe((prev) => (prev ? { ...prev, score: mine.score } : prev));
      setPhase('podium');
    };
    const onPlayers = (list) => {
      const mine = list.find((p) => p.id === sessionRef.current?.playerId);
      if (mine) setMe((prev) => (prev ? { ...prev, score: mine.score } : prev));
    };
    const onClosed = (payload) => {
      setPhase('closed');
      setMessage(
        payload?.reason === 'host-ended'
          ? 'The host ended this game.'
          : payload?.reason === 'host-started-new-game'
            ? 'The host started a different game.'
            : 'The host left the room.',
      );
    };
    const onHostAway = () => setHostAway(true);
    const onHostBack = () => setHostAway(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('game:question', onQuestion);
    socket.on('game:answerCount', onAnswerCount);
    socket.on('game:reveal', onReveal);
    socket.on('game:leaderboard', onLeaderboard);
    socket.on('game:podium', onPodium);
    socket.on('room:players', onPlayers);
    socket.on('game:closed', onClosed);
    socket.on('game:hostAway', onHostAway);
    socket.on('game:hostBack', onHostBack);

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('game:question', onQuestion);
      socket.off('game:answerCount', onAnswerCount);
      socket.off('game:reveal', onReveal);
      socket.off('game:leaderboard', onLeaderboard);
      socket.off('game:podium', onPodium);
      socket.off('room:players', onPlayers);
      socket.off('game:closed', onClosed);
      socket.off('game:hostAway', onHostAway);
      socket.off('game:hostBack', onHostBack);
    };
  }, [navigate]);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  async function answer(choice) {
    if (phase !== 'question' || answerBusy) return;
    setAnswerBusy(true);
    setNotice(null);
    setMyChoice(choice);
    setPhase('answered');
    const res = await request('player:answer', { choice });
    setAnswerBusy(false);
    if (!res.ok) {
      setNotice(res.error || 'Could not send that answer.');
      setPhase((prev) => (prev === 'answered' ? 'question' : prev));
      setMyChoice(null);
    }
  }

  function goHome() {
    socket.emit('player:leave');
    clearPlayerSession();
    navigate('/', { replace: true });
  }

  if (!session) return null;

  const entries =
    podium?.leaderboard || leaderboard?.leaderboard || reveal?.results || [];
  const myId = session.playerId;
  const myRank = entries.findIndex((p) => p.id === myId) + 1;
  const myResult = reveal?.results.find((r) => r.id === myId);
  const myPlacement = podium?.leaderboard.findIndex((p) => p.id === myId) + 1;
  const totalPlayers = Math.max(
    answerStats.total || question?.playerCount || 0,
    answerStats.answered || 0,
  );
  const showHeader = phase === 'question' || phase === 'answered';

  return (
    <div className="relative flex min-h-dvh flex-col bg-arena">
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {phase === 'lobby' && (
          <>
            <Shape
              type="circle"
              className="animate-float-slow absolute -right-10 top-24 h-36 w-36 text-answer-green/10"
            />
            <Shape
              type="triangle"
              className="animate-float-slow absolute -left-8 bottom-24 h-28 w-28 text-answer-yellow/10 [animation-delay:-2s]"
            />
          </>
        )}
      </div>

      <AnimatePresence>
        {!online && (
          <motion.div
            initial={{ y: -48, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -48, opacity: 0 }}
            className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-answer-red px-4 py-2 text-xs font-bold text-white shadow-lg"
          >
            <WifiOff className="h-3.5 w-3.5" /> Connection lost — reconnecting…
          </motion.div>
        )}
      </AnimatePresence>

      {hostAway && phase !== 'closed' && (
        <div className="relative z-10 flex items-center justify-center gap-2 bg-accent/15 px-4 py-2 text-center text-[11px] font-semibold text-accent ring-1 ring-inset ring-accent/20">
          <AlertCircle className="h-3.5 w-3.5" /> Host connection lost. Hold on — the
          game will resume when they return.
        </div>
      )}

      {phase === 'connecting' && (
        <div className="grid flex-1 place-items-center px-4">
          <div className="flex flex-col items-center gap-4 text-white/60">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
            <p className="text-sm font-semibold">Joining the game…</p>
          </div>
        </div>
      )}

      {phase === 'lobby' && (
        <div className="relative flex flex-1 flex-col">
          <header className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Brand compact />
            <button
              type="button"
              onClick={goHome}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/50 ring-1 ring-inset ring-white/10 hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> Leave
            </button>
          </header>

          <main className="flex flex-1 flex-col items-center justify-center px-5 pb-12 text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <div className="relative mx-auto grid h-24 w-24 place-items-center">
                <span className="absolute inset-0 animate-pulse-soft rounded-full bg-answer-green/25 blur-xl" />
                <span className="relative grid h-20 w-20 place-items-center rounded-full bg-answer-green/15 ring-2 ring-answer-green/40">
                  <CheckCircle2 className="h-10 w-10 text-[#6fe04a]" />
                </span>
              </div>
              <h1 className="mt-5 font-display text-4xl font-black tracking-tight sm:text-5xl">
                You&apos;re in!
              </h1>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/60">
                Hang tight,{' '}
                <span className="font-semibold text-white">{me?.name}</span>. The host is
                getting the room ready.
              </p>
            </motion.div>

            <div className="mt-8 w-full max-w-sm space-y-2">
              <div className="glass flex items-center justify-between rounded-2xl px-4 py-3 text-sm">
                <span className="text-white/45">Game PIN</span>
                <span className="font-mono font-bold tracking-[0.2em] text-accent">
                  {session.pin}
                </span>
              </div>
              <div className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm">
                <span className="shrink-0 text-white/45">Quiz</span>
                <span className="truncate font-semibold text-white/85">
                  {session.quizTitle || 'Live quiz'}
                </span>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-white/40">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              Waiting for the host to start…
            </div>

            <p className="mt-6 max-w-xs text-[11px] leading-relaxed text-white/25">
              Keep this tab open. If you lose connection, we&apos;ll put you right back in
              your seat.
            </p>
          </main>
        </div>
      )}

      {showHeader && (
        <div className="flex flex-1 flex-col">
          <PlayerHeader question={question} score={me?.score} name={me?.name} />

          {phase === 'question' && question && (
            <main className="flex flex-1 flex-col px-3 pb-4 sm:px-5">
              <div className="flex items-start justify-between gap-3 px-1 pt-1">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                    Question {question.index + 1} of {question.total}
                  </p>
                  <p className="mt-1 text-xs text-white/45">
                    {expired ? 'Time is up — hold on.' : 'Look up at the host screen, then tap a shape.'}
                  </p>
                </div>
                <TimerRing
                  secondsLeft={secondsLeft}
                  timeLimit={timeLimit}
                  size={62}
                  strokeWidth={10}
                />
              </div>

              <div className="mt-2 grid flex-1 grid-cols-2 gap-2.5 sm:gap-3.5">
                {ANSWERS.map((meta, i) => (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() => answer(i)}
                    disabled={expired || answerBusy}
                    whileTap={expired ? undefined : { scale: 0.95 }}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05, type: 'spring', stiffness: 220, damping: 20 }}
                    aria-label={`Answer ${meta.name}`}
                    className={`${meta.bg} relative flex min-h-[7.5rem] flex-col items-center justify-center gap-3 rounded-3xl shadow-lg shadow-black/30 transition-opacity ${
                      expired ? 'opacity-40' : 'active:brightness-95'
                    }`}
                  >
                    <Shape type={meta.shape} className="h-12 w-12 text-white/95 sm:h-16 sm:w-16" />
                    <span className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
                      {meta.name}
                    </span>
                  </motion.button>
                ))}
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-accent/80"
                  style={{ width: `${fraction * 100}%`, transition: 'width 120ms linear' }}
                />
              </div>
            </main>
          )}

          {phase === 'answered' && (
            <main className="flex flex-1 flex-col items-center justify-center px-5 pb-10 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                className={`${ANSWERS[myChoice]?.bg ?? 'bg-white/10'} grid h-32 w-32 place-items-center rounded-[2rem] shadow-2xl shadow-black/35 sm:h-40 sm:w-40`}
              >
                <Shape
                  type={ANSWERS[myChoice]?.shape}
                  className="h-16 w-16 text-white/95 sm:h-20 sm:w-20"
                />
              </motion.div>
              <h1 className="mt-6 font-display text-3xl font-black tracking-tight">
                Locked in!
              </h1>
              <p className="mt-2 text-sm text-white/55">
                You picked{' '}
                <span className="font-semibold text-white">
                  {ANSWERS[myChoice]?.name}
                </span>
                . Waiting for the reveal…
              </p>

              <div className="mt-5 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-xs font-semibold text-white/60">
                <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                {answerStats.answered} of {totalPlayers} players answered
              </div>

              <div className="mt-6 flex items-center gap-3 text-sm text-white/40">
                <TimerRing
                  secondsLeft={secondsLeft}
                  timeLimit={timeLimit}
                  size={48}
                  strokeWidth={12}
                />
                <span>{secondsLeft > 0 ? 'Clock is still running' : 'Revealing soon…'}</span>
              </div>
            </main>
          )}
        </div>
      )}

      {phase === 'reveal' && reveal && (
        <div className="flex flex-1 flex-col">
          <PlayerHeader question={reveal} score={me?.score} name={me?.name} />
          <main className="flex flex-1 flex-col items-center justify-center px-4 pb-8">
            <motion.section
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 22 }}
              className={`w-full max-w-md rounded-[2rem] p-6 text-center ring-1 ring-inset ${
                myResult?.correct
                  ? 'bg-answer-green/15 ring-answer-green/40'
                  : 'bg-answer-red/10 ring-answer-red/30'
              }`}
            >
              <motion.div
                initial={{ scale: 0.5, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.05 }}
                className={`mx-auto grid h-16 w-16 place-items-center rounded-full ${
                  myResult?.correct
                    ? 'bg-answer-green/25 text-[#6fe04a]'
                    : 'bg-answer-red/20 text-[#ff8fa3]'
                }`}
              >
                {myResult?.correct ? (
                  <CheckCircle2 className="h-9 w-9" />
                ) : (
                  <XCircle className="h-9 w-9" />
                )}
              </motion.div>

              <h1 className="mt-4 font-display text-3xl font-black tracking-tight">
                {myResult?.correct
                  ? 'Correct!'
                  : myResult?.choice === null
                    ? "Time's up"
                    : 'Not quite'}
              </h1>

              {myResult?.correct ? (
                <motion.p
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: 'spring', stiffness: 240, damping: 16 }}
                  className="mt-1 font-display text-4xl font-black text-accent"
                >
                  +{myResult.points}
                </motion.p>
              ) : (
                <p className="mt-1 text-sm text-white/55">
                  {myResult?.choice === null
                    ? 'No answer recorded this round.'
                    : 'No points this round — next one is yours.'}
                </p>
              )}

              <div className="mt-5 space-y-2 text-left">
                <div className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-3 py-2.5">
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white"
                    style={{ backgroundColor: ANSWERS[reveal.correctIndex].hex }}
                  >
                    <Shape
                      type={ANSWERS[reveal.correctIndex].shape}
                      className="h-4.5 w-4.5 text-white/90"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">
                      Correct answer
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {reveal.options[reveal.correctIndex]}
                    </p>
                  </div>
                </div>

                {myResult?.choice !== null && myResult?.choice !== undefined && (
                  <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg opacity-70"
                      style={{ backgroundColor: ANSWERS[myResult.choice].hex }}
                    >
                      <Shape
                        type={ANSWERS[myResult.choice].shape}
                        className="h-4.5 w-4.5 text-white/90"
                      />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">
                        Your answer
                      </p>
                      <p className="truncate text-sm font-semibold text-white/70">
                        {reveal.options[myResult.choice]}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 flex justify-center gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white/10 px-3.5 py-2">
                  Total <span className="font-display text-sm font-black text-accent">{me?.score?.toLocaleString()}</span>
                </span>
                {myRank > 0 && (
                  <span className="rounded-full bg-white/10 px-3.5 py-2">
                    Rank <span className="font-display text-sm font-black">{myRank}</span>
                  </span>
                )}
              </div>
            </motion.section>
            <p className="mt-4 text-center text-xs text-white/35">
              Waiting for the host to show the leaderboard…
            </p>
          </main>
        </div>
      )}

      {phase === 'leaderboard' && leaderboard && (
        <div className="flex flex-1 flex-col">
          <PlayerHeader question={leaderboard} score={me?.score} name={me?.name} />
          <main className="flex flex-1 flex-col px-4 pb-8">
            <div className="mt-2 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
                <Trophy className="h-6 w-6" />
              </span>
              <h1 className="mt-3 font-display text-2xl font-black tracking-tight">
                Leaderboard
              </h1>
              <p className="text-xs text-white/45">
                After question {leaderboard.index + 1} of {leaderboard.total}
              </p>
            </div>

            <div className="mx-auto mt-5 w-full max-w-md">
              <LeaderboardList
                entries={leaderboard.leaderboard}
                meId={myId}
                max={5}
              />
              {myRank > 5 && (
                <div className="mt-3 flex items-center justify-between rounded-2xl bg-accent/10 px-4 py-3 text-sm ring-1 ring-inset ring-accent/25">
                  <span className="font-semibold text-white/80">
                    Your rank <span className="font-display font-black text-accent">#{myRank}</span>
                  </span>
                  <span className="font-display font-extrabold tabular-nums">
                    {me?.score?.toLocaleString()} pts
                  </span>
                </div>
              )}
            </div>

            <div className="mt-auto flex items-center justify-center gap-2 pt-8 text-sm text-white/40">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
              Next question is coming up…
            </div>
          </main>
        </div>
      )}

      {phase === 'podium' && podium && (
        <div className="relative flex min-h-dvh flex-col overflow-hidden">
          <Confetti count={26} />
          <div className="relative flex flex-1 flex-col">
            <header className="flex items-center justify-between px-4 py-3 sm:px-6">
              <Brand compact />
              <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent">
                Final results
              </span>
            </header>

            <main className="flex flex-1 flex-col items-center px-5 pb-10 text-center">
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 16 }}
                className={`mt-2 grid h-24 w-24 place-items-center rounded-full ${
                  myPlacement === 1
                    ? 'bg-accent text-brand-night shadow-xl shadow-accent/25'
                    : 'bg-white/10 text-accent'
                }`}
              >
                {myPlacement === 1 ? (
                  <Crown className="h-11 w-11" />
                ) : (
                  <span className="font-display text-4xl font-black">#{myPlacement || '–'}</span>
                )}
              </motion.div>

              <h1 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-4xl">
                {myPlacement === 1
                  ? 'You won!'
                  : myPlacement === 2
                    ? 'You finished 2nd!'
                    : myPlacement === 3
                      ? 'You finished 3rd!'
                      : myPlacement > 3
                        ? `You finished #${myPlacement}`
                        : 'Game over'}
              </h1>
              <p className="mt-1.5 text-sm text-white/55">
                {me?.name} · {me?.score?.toLocaleString()} points
              </p>

              <div className="mt-6 w-full max-w-md">
                <LeaderboardList
                  entries={podium.leaderboard}
                  meId={myId}
                  max={Math.min(3, podium.leaderboard.length)}
                />
              </div>

              <div className="mt-auto w-full max-w-md pt-8">
                <Button className="w-full" onClick={goHome}>
                  <Sparkles className="h-4 w-4" /> Back to home
                </Button>
                <p className="mt-3 text-[11px] text-white/25">
                  Thanks for playing QuizBlitz.
                </p>
              </div>
            </main>
          </div>
        </div>
      )}

      {phase === 'closed' && (
        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between px-4 py-3 sm:px-6">
            <Brand compact />
          </header>
          <main className="grid flex-1 place-items-center px-5 pb-12">
            <div className="w-full max-w-sm rounded-[2rem] glass p-7 text-center">
              <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-answer-red/15 text-answer-red">
                <AlertCircle className="h-7 w-7" />
              </span>
              <h1 className="mt-4 font-display text-2xl font-extrabold">Game over</h1>
              <p className="mt-2 text-sm leading-relaxed text-white/55">
                {message || 'This game is no longer available.'}
              </p>
              <Button className="mt-6 w-full" onClick={goHome}>
                Back to home
              </Button>
            </div>
          </main>
        </div>
      )}

      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="alert"
            className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-sm items-start gap-2 rounded-2xl bg-[#3b0f23] px-4 py-3 text-sm text-[#ffb3c1] shadow-2xl ring-1 ring-inset ring-answer-red/40"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{notice}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
