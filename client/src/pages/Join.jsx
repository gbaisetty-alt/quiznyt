import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Dices,
  Gamepad2,
  KeyRound,
  LogOut,
  UserRound,
} from 'lucide-react';
import Avatar from '../components/Avatar.jsx';
import Brand from '../components/Brand.jsx';
import Button from '../components/Button.jsx';
import Shape from '../components/Shape.jsx';
import { AVATAR_GROUPS, avatarsByGroup, getAvatar, randomAvatarId } from '../lib/avatars.js';
import { request, socket } from '../lib/socket.js';
import {
  clearPlayerSession,
  loadPlayerSession,
  savePlayerSession,
} from '../lib/session.js';

export default function Join() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [pin, setPin] = useState((params.get('pin') || '').replace(/\D/g, '').slice(0, 6));
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(() => randomAvatarId());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState(null);

  useEffect(() => {
    setExisting(loadPlayerSession());
  }, []);

  const leaveExisting = () => {
    socket.emit('player:leave');
    clearPlayerSession();
    setExisting(null);
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    if (pin.length !== 6) {
      setError('Enter the full 6-digit game PIN.');
      return;
    }
    if (!name.trim()) {
      setError('Pick a nickname so the host can see you.');
      return;
    }
    setBusy(true);
    const res = await request('player:join', { pin, name: name.trim(), avatar });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Could not join that game.');
      return;
    }
    savePlayerSession({
      pin: res.pin,
      playerId: res.playerId,
      name: res.name,
      avatar: res.avatar || avatar,
      quizTitle: res.quizTitle,
    });
    navigate('/play');
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-arena">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Shape
          type="triangle"
          className="animate-float-slow absolute -right-6 top-24 h-28 w-28 text-answer-red/20"
        />
        <Shape
          type="diamond"
          className="animate-float-slow absolute -left-8 bottom-24 h-24 w-24 text-answer-blue/25 [animation-delay:-3s]"
        />
        <Shape
          type="circle"
          className="animate-float-slow absolute left-8 top-40 h-16 w-16 text-answer-yellow/20 [animation-delay:-1.5s]"
        />
      </div>

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Brand />
        <Link
          to="/"
          className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </header>

      <main className="relative flex flex-1 items-start justify-center px-5 pb-12 pt-2 sm:items-center sm:pt-0">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-md"
        >
          <div className="mb-5 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70 ring-1 ring-inset ring-white/15">
              <Gamepad2 className="h-3.5 w-3.5 text-accent" /> Player entry
            </span>
            <h1 className="mt-3 font-display text-3xl font-black tracking-tight sm:text-4xl">
              Join a game
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Type the PIN from the host screen and pick a nickname.
            </p>
          </div>

          {existing && (
            <div className="mb-4 rounded-2xl bg-accent/10 p-4 ring-1 ring-inset ring-accent/25">
              <p className="text-sm text-white/80">
                You are still in game{' '}
                <span className="font-mono font-bold tracking-wider text-accent">
                  {existing.pin}
                </span>{' '}
                as <span className="font-semibold">{existing.name}</span>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => navigate('/play')}>
                  Resume game <ArrowRight className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={leaveExisting}>
                  <LogOut className="h-3.5 w-3.5" /> Leave
                </Button>
              </div>
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="rounded-[2rem] glass card-glow p-5 sm:p-7"
          >
            <label htmlFor="pin" className="mb-2 block text-xs font-bold uppercase tracking-[0.18em] text-white/50">
              Game PIN
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
              <input
                id="pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                autoFocus
                className="w-full rounded-2xl bg-white/10 py-4 pl-12 pr-4 text-center font-display text-2xl font-extrabold tracking-[0.35em] text-white ring-1 ring-inset ring-white/15 transition placeholder:font-sans placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-white/30 focus:bg-white/15 focus:ring-2 focus:ring-accent"
              />
            </div>

            <label htmlFor="nickname" className="mb-2 mt-5 block text-xs font-bold uppercase tracking-[0.18em] text-white/50">
              Nickname
            </label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
              <input
                id="nickname"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 16))}
                placeholder="QuizWizard"
                maxLength={16}
                autoComplete="nickname"
                className="w-full rounded-2xl bg-white/10 py-3.5 pl-12 pr-14 text-base font-semibold text-white ring-1 ring-inset ring-white/15 transition placeholder:font-normal placeholder:text-white/30 focus:bg-white/15 focus:ring-2 focus:ring-accent"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-medium text-white/30">
                {name.length}/16
              </span>
            </div>

            <div role="group" aria-labelledby="avatar-label" className="mt-5">
              <div className="flex items-center justify-between">
                <span
                  id="avatar-label"
                  className="text-xs font-bold uppercase tracking-[0.18em] text-white/50"
                >
                  Avatar
                </span>
                <button
                  type="button"
                  onClick={() => setAvatar(randomAvatarId())}
                  className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-semibold text-white/45 transition hover:bg-white/10 hover:text-white"
                >
                  <Dices className="h-3.5 w-3.5" /> Surprise me
                </button>
              </div>

              <div className="mt-2 flex items-center gap-2.5 rounded-2xl bg-white/5 px-3 py-2 ring-1 ring-inset ring-white/10">
                <Avatar id={avatar} size={38} className="ring-2 ring-accent/40" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">
                    Playing as
                  </p>
                  <p className="truncate text-sm font-semibold">{getAvatar(avatar).label}</p>
                </div>
              </div>

              <div className="mt-2 space-y-2">
                {AVATAR_GROUPS.map((group) => (
                  <div key={group.id}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30">
                      {group.label}
                    </p>
                    <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
                      {avatarsByGroup(group.id).map((option) => {
                        const selected = option.id === avatar;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => setAvatar(option.id)}
                            aria-pressed={selected}
                            aria-label={option.label}
                            className={`grid place-items-center rounded-xl p-0.5 transition ${
                              selected
                                ? 'bg-accent/20 ring-2 ring-accent'
                                : 'hover:bg-white/10'
                            }`}
                          >
                            <Avatar id={option.id} size={32} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2 rounded-xl bg-answer-red/15 px-3 py-2.5 text-sm text-[#ffb3c1] ring-1 ring-inset ring-answer-red/30"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              loading={busy}
              className="mt-5 w-full"
            >
              {busy ? 'Joining…' : 'Enter game'}
              {!busy && <ArrowRight className="h-5 w-5" />}
            </Button>

            <p className="mt-4 text-center text-xs leading-relaxed text-white/40">
              The PIN is shown on the host&apos;s big screen. Nicknames are visible on the
              leaderboard.
            </p>
          </form>

          <p className="mt-5 text-center text-sm text-white/45">
            Hosting instead?{' '}
            <Link to="/create" className="font-semibold text-accent hover:underline">
              Create a quiz
            </Link>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
