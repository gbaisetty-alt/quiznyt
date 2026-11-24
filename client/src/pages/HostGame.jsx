import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Crown,
  Loader2,
  LogOut,
  Play,
  Radio,
  Sparkles,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import Avatar from '../components/Avatar.jsx';
import Brand from '../components/Brand.jsx';
import Button from '../components/Button.jsx';
import Confetti from '../components/Confetti.jsx';
import LeaderboardList from '../components/LeaderboardList.jsx';
import Shape from '../components/Shape.jsx';
import TimerRing from '../components/TimerRing.jsx';
import { ANSWERS } from '../lib/answers.js';
import { request, socket } from '../lib/socket.js';
import { clearHostToken, loadHostToken } from '../lib/session.js';
import { useCountdown } from '../lib/useCountdown.js';

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function HostHeader({ title, right }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Brand compact />
        <span className="hidden h-5 w-px bg-white/15 sm:block" aria-hidden="true" />
        <span className="hidden max-w-[260px] truncate text-xs font-medium text-white/45 sm:block">
          {title}
        </span>
      </div>
      <div className="flex items-center gap-2">{right}</div>
    </header>
  );
}

function EndGameButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/50 ring-1 ring-inset ring-white/10 transition hover:bg-answer-red/15 hover:text-[#ff9db0]"
    >
      <LogOut className="h-3.5 w-3.5" /> End
    </button>
  );
}

function Podium({ entries }) {
  const slots = [
    { place: 1, height: 'h-36 sm:h-48' },
    { place: 0, height: 'h-48 sm:h-64' },
    { place: 2, height: 'h-28 sm:h-36' },
  ].filter((slot) => entries[slot.place]);

  const placeStyles = [
    'bg-gradient-to-b from-accent to-[#e0a200] text-brand-night',
    'bg-gradient-to-b from-white/30 to-white/10 text-white',
    'bg-gradient-to-b from-[#c9814a]/80 to-[#a35f2f]/60 text-white',
  ];

  return (
    <div className="mx-auto mt-8 flex max-w-3xl items-end justify-center gap-2 sm:mt-12 sm:gap-4">
      {slots.map(({ place, height }) => {
        const player = entries[place];
        const isWinner = place === 0;
        return (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 70 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + place * 0.15, type: 'spring', stiffness: 130, damping: 16 }}
            className={`flex flex-1 flex-col ${isWinner ? 'max-w-[240px]' : 'max-w-[210px]'}`}
          >
            <div className="mb-2 px-1 text-center">
              {isWinner && <Crown className="mx-auto mb-1 h-6 w-6 text-accent" />}
              <Avatar
                id={player.avatar}
                size={isWinner ? 60 : 48}
                className="mx-auto mb-1.5 ring-2 ring-white/20"
              />
              <p className="truncate font-display text-sm font-extrabold sm:text-lg">{player.name}</p>
              <p className="font-display text-xs font-bold tabular-nums text-accent sm:text-sm">
                {player.score.toLocaleString()} pts
              </p>
            </div>
            <div
              className={`${height} ${placeStyles[place]} flex flex-col items-center justify-start rounded-t-2xl pt-4 shadow-2xl shadow-black/30`}
            >
              <span className="font-display text-3xl font-black opacity-80 sm:text-4xl">
                {place + 1}
              </span>
              <span className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-60">
                {place === 0 ? 'Champion' : place === 1 ? 'Runner-up' : 'Third'}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

export default function HostGame() {
  const { pin = '' } = useParams();
  const navigate = useNavigate();
  const hostToken = loadHostToken(pin);

  const [phase, setPhase] = useState('connecting');
  const [fatal, setFatal] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [questionCount, setQuestionCount] = useState(0);
  const [players, setPlayers] = useState([]);
  const [question, setQuestion] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [podium, setPodium] = useState(null);
  const [answerStats, setAnswerStats] = useState({ answered: 0, total: 0 });
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const endedRef = useRef(false);
  const copyTimer = useRef(null);

  const { secondsLeft, timeLimit } = useCountdown(question);

  useEffect(() => {
    if (!hostToken) {
      setFatal('No host session was found for this PIN. Create a quiz to start a new game.');
      setPhase('error');
      return undefined;
    }

    let cancelled = false;

    const applySnapshot = (snapshot) => {
      setQuizTitle(snapshot.quizTitle ?? '');
      setQuestionCount(snapshot.questionCount ?? 0);
      setPlayers(snapshot.players ?? []);
      const event = snapshot.lastEvent;
      if (event?.payload) {
        if (event.type === 'question') {
          setQuestion(event.payload);
          setAnswerStats({
            answered: event.payload.answered ?? 0,
            total: event.payload.playerCount ?? 0,
          });
        }
        if (event.type === 'reveal') setReveal(event.payload);
        if (event.type === 'leaderboard') setLeaderboard(event.payload);
        if (event.type === 'podium') setPodium(event.payload);
      }
      setPhase(snapshot.status);
    };

    const rejoin = async () => {
      const res = await request('host:rejoin', { pin, hostToken });
      if (cancelled) return;
      if (!res.ok) {
        setFatal(res.error || 'Could not restore the host session.');
        setPhase('error');
        return;
      }
      applySnapshot(res);
    };

    rejoin();

    const onConnect = () => {
      if (!cancelled) rejoin();
    };
    const onPlayers = (list) => setPlayers(list);
    const onQuestion = (payload) => {
      setQuestion(payload);
      setReveal(null);
      setLeaderboard(null);
      setPodium(null);
      setAnswerStats({
        answered: payload.answered ?? 0,
        total: payload.playerCount ?? 0,
      });
      setActionError('');
      setPhase('question');
    };
    const onReveal = (payload) => {
      setReveal(payload);
      setPhase('reveal');
    };
    const onLeaderboard = (payload) => {
      setLeaderboard(payload);
      setPhase('leaderboard');
    };
    const onPodium = (payload) => {
      setPodium(payload);
      setPhase('podium');
    };
    const onAnswerCount = (stats) => setAnswerStats(stats);
    const onClosed = () => setPhase('closed');

    socket.on('connect', onConnect);
    socket.on('room:players', onPlayers);
    socket.on('game:question', onQuestion);
    socket.on('game:reveal', onReveal);
    socket.on('game:leaderboard', onLeaderboard);
    socket.on('game:podium', onPodium);
    socket.on('game:answerCount', onAnswerCount);
    socket.on('game:closed', onClosed);

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off('room:players', onPlayers);
      socket.off('game:question', onQuestion);
      socket.off('game:reveal', onReveal);
      socket.off('game:leaderboard', onLeaderboard);
      socket.off('game:podium', onPodium);
      socket.off('game:answerCount', onAnswerCount);
      socket.off('game:closed', onClosed);
      clearTimeout(copyTimer.current);
      if (!endedRef.current) socket.emit('host:leave');
    };
  }, [pin, hostToken]);

  const act = async (event) => {
    setBusy(true);
    setActionError('');
    const res = await request(event);
    setBusy(false);
    if (!res.ok) setActionError(res.error || 'Something went wrong.');
  };

  const endGame = async () => {
    endedRef.current = true;
    setConfirmEnd(false);
    await request('host:end');
    clearHostToken(pin);
    navigate('/', { replace: true });
  };

  const finishAndGo = async (path) => {
    endedRef.current = true;
    await request('host:end');
    clearHostToken(pin);
    navigate(path);
  };

  const handleCopy = async (value, key) => {
    const ok = await copyText(value);
    if (!ok) return;
    setCopied(key);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(null), 1800);
  };

  const joinUrl = `${window.location.origin}/join?pin=${pin}`;
  const groupedPin = pin.replace(/(\d{3})(\d{3})/, '$1 $2');
  const isLocal =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const progressTotal = question?.total || questionCount;
  const answered = answerStats.answered ?? 0;
  const totalPlayers = Math.max(answerStats.total || question?.playerCount || 0, answered);
  const answeredPct = totalPlayers > 0 ? Math.min(100, (answered / totalPlayers) * 100) : 0;

  if (phase === 'connecting') {
    return (
      <div className="grid min-h-dvh place-items-center bg-arena px-4">
        <div className="flex flex-col items-center gap-4 text-white/60">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <p className="text-sm font-semibold">Restoring your host session…</p>
        </div>
      </div>
    );
  }

  if (phase === 'error' || phase === 'closed') {
    const closed = phase === 'closed';
    return (
      <div className="grid min-h-dvh place-items-center bg-arena px-4">
        <div className="w-full max-w-md rounded-[2rem] glass card-glow p-7 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-answer-red/15 text-answer-red">
            <AlertCircle className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-extrabold">
            {closed ? 'This game has ended' : 'Host session unavailable'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/55">
            {closed ? 'The room was closed. Players have been notified.' : fatal}
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button as={Link} to="/create" className="w-full">
              <Sparkles className="h-4 w-4" /> Create a new quiz
            </Button>
            <Button as={Link} to="/" variant="outline" className="w-full">
              Back home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh bg-arena">
      {phase === 'lobby' && (
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
          <HostHeader
            title={quizTitle}
            right={
              <>
                <span className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/60 sm:flex">
                  <Radio className="h-3.5 w-3.5 text-answer-green" /> Host view
                </span>
                <EndGameButton onClick={() => setConfirmEnd(true)} />
              </>
            }
          />

          <main className="grid flex-1 items-start gap-4 px-4 pb-10 pt-1 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
            <div className="space-y-4">
              <motion.section
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[2rem] glass card-glow p-5 sm:p-7"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/45">
                      Game PIN
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      Players open{' '}
                      <span className="font-semibold text-white/60">
                        {window.location.hostname === 'localhost' ? 'this site' : window.location.host}
                        /join
                      </span>{' '}
                      and type this code.
                    </p>
                  </div>
                  <span className="hidden rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white/60 sm:inline-flex">
                    {questionCount} questions
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="font-display text-[clamp(2.8rem,10vw,5.2rem)] font-black leading-none tracking-[0.12em] text-accent">
                    {groupedPin}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopy(pin, 'pin')}
                    className="inline-flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-inset ring-white/15 transition hover:bg-white/15"
                  >
                    {copied === 'pin' ? (
                      <>
                        <Check className="h-4 w-4 text-answer-green" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" /> Copy PIN
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2 rounded-xl bg-black/25 px-3 py-2.5">
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/55">
                    {joinUrl}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(joinUrl, 'link')}
                    aria-label="Copy join link"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/45 transition hover:bg-white/10 hover:text-white"
                  >
                    {copied === 'link' ? (
                      <Check className="h-3.5 w-3.5 text-answer-green" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                <Button
                  size="lg"
                  className="mt-5 w-full"
                  onClick={() => act('host:start')}
                  loading={busy}
                  disabled={players.length === 0}
                >
                  {!busy && <Play className="h-5 w-5" fill="currentColor" />}
                  {players.length === 0
                    ? 'Waiting for players…'
                    : busy
                      ? 'Starting…'
                      : 'Start game'}
                </Button>
                <p className="mt-2.5 text-center text-[11px] text-white/35">
                  {players.length === 0
                    ? 'Share the PIN to let players in.'
                    : 'Players can still join until you press start.'}
                </p>

                {actionError && (
                  <p role="alert" className="mt-3 rounded-xl bg-answer-red/15 px-3 py-2 text-center text-xs text-[#ffb3c1]">
                    {actionError}
                  </p>
                )}
              </motion.section>

              <div className="flex items-center gap-3 rounded-3xl bg-white/[0.04] px-4 py-3.5 ring-1 ring-inset ring-white/10">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-accent">
                  <Trophy className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{quizTitle}</p>
                  <p className="text-[11px] text-white/40">
                    Points go up to 1,000 per question — speed decides the rest.
                  </p>
                </div>
              </div>

              {isLocal && (
                <div className="rounded-2xl bg-accent/10 p-4 text-xs leading-relaxed text-white/60 ring-1 ring-inset ring-accent/25">
                  <p className="font-bold text-accent">Testing with phones?</p>
                  <p className="mt-1">
                    Open this host on your laptop, then have players use your computer&apos;s
                    network address instead of localhost — for example{' '}
                    <span className="font-mono text-white/75">http://192.168.1.20:5173/join</span>.
                    Keep both devices on the same Wi-Fi.
                  </p>
                </div>
              )}
            </div>

            <motion.section
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.06 }}
              className="rounded-[2rem] glass p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
                  <Users className="h-4.5 w-4.5 text-accent" /> Players
                </h2>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold tabular-nums text-white/70">
                  {players.length}
                </span>
              </div>

              {players.length === 0 ? (
                <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-white/10 px-4 py-12 text-center">
                  <span className="relative grid h-16 w-16 place-items-center rounded-full bg-white/5">
                    <span className="absolute inset-0 animate-pulse-soft rounded-full bg-brand/30 blur-xl" />
                    <Users className="relative h-7 w-7 text-white/30" />
                  </span>
                  <div>
                    <p className="font-display font-bold text-white/70">Waiting for players…</p>
                    <p className="mt-1 text-xs text-white/35">
                      Names will pop in here as people join.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="mt-4 grid grid-cols-2 content-start gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
                  {players.map((player) => (
                    <motion.li
                      key={player.id}
                      layout
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                      className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-2.5 py-2 ring-1 ring-inset ring-white/10"
                    >
                      <Avatar id={player.avatar} size={28} />
                      <span className="truncate text-xs font-semibold">{player.name}</span>
                    </motion.li>
                  ))}
                </ul>
              )}

              <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/[0.04] px-3 py-2.5 text-[11px] text-white/40">
                <Clock3 className="h-3.5 w-3.5 shrink-0" />
                Each question has its own countdown. Faster correct answers score more.
              </div>
            </motion.section>
          </main>
        </div>
      )}

      {phase === 'question' && question && (
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
          <HostHeader
            title={quizTitle}
            right={
              <>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
                  Question {question.index + 1} / {progressTotal}
                </span>
                <EndGameButton onClick={() => setConfirmEnd(true)} />
              </>
            }
          />

          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 pb-6 sm:px-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                  Question {question.index + 1} of {progressTotal}
                </p>
                <p className="mt-0.5 text-xs text-white/40">Read it out, then let them tap.</p>
              </div>
              <TimerRing secondsLeft={secondsLeft} timeLimit={timeLimit} size={88} />
            </div>

            <div className="flex flex-1 flex-col justify-center gap-6 py-2 sm:gap-8">
              <motion.h1
                key={question.index}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="text-center font-display text-[clamp(1.5rem,4.5vw,3rem)] font-extrabold leading-tight text-balance"
              >
                {question.question}
              </motion.h1>

              <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3.5">
                {question.options.map((option, i) => {
                  const meta = ANSWERS[i];
                  return (
                    <motion.div
                      key={`${question.index}-${i}`}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.05 }}
                      className={`${meta.bg} flex items-center gap-3 rounded-2xl px-4 py-4 shadow-lg shadow-black/25 sm:gap-4 sm:px-5 sm:py-5`}
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-black/15 sm:h-12 sm:w-12">
                        <Shape type={meta.shape} className="h-5 w-5 text-white/90 sm:h-6 sm:w-6" />
                      </span>
                      <span className="font-display text-base font-bold leading-snug sm:text-xl lg:text-2xl">
                        {option}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-inset ring-white/10">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                <span className="flex items-center gap-2 text-white/70">
                  <Radio className="h-3.5 w-3.5 animate-pulse text-answer-green" />
                  {answered} of {totalPlayers} answers in
                </span>
                <span className="text-white/40">
                  {totalPlayers > 0 && answered >= totalPlayers
                    ? 'Everyone answered — revealing results'
                    : 'Waiting for answers…'}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <motion.div
                  className="h-full rounded-full bg-accent"
                  animate={{ width: `${answeredPct}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>
            </div>
          </main>
        </div>
      )}

      {phase === 'reveal' && reveal && (
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
          <HostHeader
            title={quizTitle}
            right={
              <>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
                  Question {reveal.index + 1} / {reveal.total}
                </span>
                <EndGameButton onClick={() => setConfirmEnd(true)} />
              </>
            }
          />

          <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-6 px-4 pb-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-accent">
                Answer reveal
              </p>
              <h1 className="mt-2 font-display text-2xl font-extrabold leading-snug text-balance sm:text-3xl">
                {reveal.question}
              </h1>

              <div className="mt-5 space-y-2.5">
                {reveal.counts.map((count, i) => {
                  const meta = ANSWERS[i];
                  const totalAnswers = reveal.counts.reduce((sum, n) => sum + n, 0);
                  const percent = totalAnswers ? Math.round((count / totalAnswers) * 100) : 0;
                  const correct = reveal.correctIndex === i;
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`relative overflow-hidden rounded-2xl bg-white/[0.06] ring-1 ring-inset ${
                        correct ? 'ring-accent/70' : 'ring-white/10'
                      }`}
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(count > 0 ? 5 : 0, percent)}%` }}
                        transition={{ duration: 0.85, delay: 0.15 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                        className={`absolute inset-y-0 left-0 ${meta.bg} ${correct ? '' : 'opacity-35'}`}
                      />
                      <div className="relative flex items-center gap-3 px-3.5 py-3 sm:px-4">
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white"
                          style={{ backgroundColor: meta.hex }}
                        >
                          <Shape type={meta.shape} className="h-4.5 w-4.5 text-white/90" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold sm:text-base">
                          {reveal.options[i]}
                        </span>
                        {correct && (
                          <span className="hidden items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-brand-night sm:inline-flex">
                            <CheckCircle2 className="h-3 w-3" /> Correct
                          </span>
                        )}
                        <span className="shrink-0 text-right">
                          <span className="block font-display text-lg font-extrabold tabular-nums leading-none">
                            {count}
                          </span>
                          <span className="text-[10px] font-semibold text-white/45">{percent}%</span>
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-6">
              <div className="rounded-3xl glass card-glow p-5">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">
                  This round
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-2xl font-display font-black tabular-nums">
                      {reveal.counts.reduce((sum, n) => sum + n, 0)}
                    </p>
                    <p className="text-[11px] text-white/40">answers in</p>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-3">
                    <p className="text-2xl font-display font-black tabular-nums">
                      {reveal.results.filter((r) => r.correct).length}
                    </p>
                    <p className="text-[11px] text-white/40">correct</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-accent/10 px-3 py-2.5 ring-1 ring-inset ring-accent/20">
                  <span
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                    style={{ backgroundColor: ANSWERS[reveal.correctIndex].hex }}
                  >
                    <Shape
                      type={ANSWERS[reveal.correctIndex].shape}
                      className="h-4 w-4 text-white/90"
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">
                      Correct answer
                    </p>
                    <p className="truncate text-sm font-bold text-accent">
                      {reveal.options[reveal.correctIndex]}
                    </p>
                  </div>
                </div>

                <Button
                  size="lg"
                  className="mt-4 w-full"
                  onClick={() => act('host:next')}
                  loading={busy}
                >
                  {reveal.index + 1 >= reveal.total ? 'See final results' : 'Show leaderboard'}
                  {!busy && <ArrowRight className="h-5 w-5" />}
                </Button>
                {actionError && (
                  <p role="alert" className="mt-2 text-center text-xs text-[#ffb3c1]">
                    {actionError}
                  </p>
                )}
              </div>

              <div className="rounded-2xl bg-white/[0.04] px-4 py-3 text-[11px] leading-relaxed text-white/40 ring-1 ring-inset ring-white/10">
                Points this round are based on speed: 1,000 for an instant correct answer,
                scaling down as the clock runs out.
              </div>
            </aside>
          </main>
        </div>
      )}

      {phase === 'leaderboard' && leaderboard && (
        <div className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
          <HostHeader
            title={quizTitle}
            right={
              <>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold">
                  After question {leaderboard.index + 1} / {leaderboard.total}
                </span>
                <EndGameButton onClick={() => setConfirmEnd(true)} />
              </>
            }
          />

          <main className="mx-auto grid w-full max-w-5xl flex-1 items-start gap-6 px-4 pb-10 sm:px-8 lg:grid-cols-[1.15fr_0.85fr]">
            <section>
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent/15 text-accent">
                  <Trophy className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="font-display text-2xl font-black sm:text-3xl">Leaderboard</h1>
                  <p className="text-xs text-white/45">
                    Top 5 after question {leaderboard.index + 1}
                  </p>
                </div>
              </div>
              <LeaderboardList
                entries={leaderboard.leaderboard}
                max={5}
                className="mt-5"
              />
            </section>

            <aside className="space-y-4 lg:sticky lg:top-6">
              <div className="rounded-3xl glass p-5">
                <div className="flex items-center justify-between text-xs font-semibold text-white/50">
                  <span>Question {leaderboard.index + 1} of {leaderboard.total}</span>
                  <span>{leaderboard.leaderboard.length} players</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${((leaderboard.index + 1) / leaderboard.total) * 100}%`,
                    }}
                  />
                </div>

                <p className="mt-5 text-sm text-white/55">
                  Give everyone a second to see the standings, then roll the next question.
                </p>
                <Button
                  size="lg"
                  className="mt-4 w-full"
                  onClick={() => act('host:continue')}
                  loading={busy}
                >
                  {!busy && <Play className="h-5 w-5" fill="currentColor" />}
                  Next question
                </Button>
                {actionError && (
                  <p role="alert" className="mt-2 text-center text-xs text-[#ffb3c1]">
                    {actionError}
                  </p>
                )}
              </div>

              <div className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-inset ring-white/10">
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/35">
                  Full standings
                </p>
                <ul className="mt-2.5 max-h-64 space-y-1.5 overflow-y-auto pr-1 text-sm">
                  {leaderboard.leaderboard.map((player, i) => (
                    <li key={player.id} className="flex items-center gap-2">
                      <span className="w-5 text-right text-xs font-bold tabular-nums text-white/30">
                        {i + 1}
                      </span>
                      <Avatar id={player.avatar} size={22} />
                      <span className="min-w-0 flex-1 truncate text-white/65">{player.name}</span>
                      <span className="font-semibold tabular-nums text-white/50">
                        {player.score.toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </main>
        </div>
      )}

      {phase === 'podium' && podium && (
        <div className="relative min-h-dvh overflow-hidden">
          <Confetti />
          <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col">
            <HostHeader
              title={quizTitle}
              right={
                <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-bold text-accent">
                  Final results
                </span>
              }
            />

            <main className="mx-auto w-full max-w-4xl flex-1 px-4 pb-16 text-center sm:px-8">
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent text-brand-night shadow-lg shadow-accent/25"
              >
                <Trophy className="h-7 w-7" />
              </motion.div>
              <h1 className="mt-4 font-display text-3xl font-black tracking-tight sm:text-5xl">
                That&apos;s a wrap!
              </h1>
              <p className="mt-1.5 text-sm text-white/50">
                {quizTitle} · {podium.total} questions
              </p>

              <Podium entries={podium.leaderboard} />

              {podium.leaderboard.length > 3 && (
                <div className="mx-auto mt-6 max-w-md rounded-2xl bg-white/[0.05] p-3 ring-1 ring-inset ring-white/10">
                  <ul className="space-y-1.5">
                    {podium.leaderboard.slice(3, 8).map((player, i) => (
                      <li key={player.id} className="flex items-center gap-2 text-sm">
                        <span className="w-6 text-right text-xs font-bold tabular-nums text-white/30">
                          {i + 4}
                        </span>
                        <Avatar id={player.avatar} size={20} />
                        <span className="min-w-0 flex-1 truncate text-white/60">{player.name}</span>
                        <span className="font-semibold tabular-nums text-white/45">
                          {player.score.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mx-auto mt-8 flex max-w-md flex-col gap-2.5 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={() => finishAndGo('/create')}
                >
                  <Sparkles className="h-4 w-4" /> Host another quiz
                </Button>
                <Button
                  variant="glass"
                  className="flex-1"
                  onClick={() => finishAndGo('/')}
                >
                  Back home
                </Button>
              </div>
            </main>
          </div>
        </div>
      )}

      <AnimatePresence>
        {confirmEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="End game confirmation"
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-[1.75rem] bg-[#241046] p-6 shadow-2xl ring-1 ring-white/15"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-answer-red/15 text-answer-red">
                  <LogOut className="h-5 w-5" />
                </span>
                <button
                  type="button"
                  onClick={() => setConfirmEnd(false)}
                  aria-label="Cancel"
                  className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="mt-4 font-display text-xl font-extrabold">End this game?</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                Everyone in the room will be disconnected and the PIN will stop working.
              </p>
              <div className="mt-5 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setConfirmEnd(false)}>
                  Keep playing
                </Button>
                <button
                  type="button"
                  onClick={endGame}
                  className="flex-1 rounded-2xl bg-answer-red px-4 py-3 font-display text-sm font-bold text-white shadow-lg shadow-answer-red/20 transition hover:bg-[#f0244a] active:translate-y-px"
                >
                  End game
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
