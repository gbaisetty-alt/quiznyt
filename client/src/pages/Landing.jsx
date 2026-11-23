import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Clock3,
  FilePlus2,
  Gamepad2,
  MonitorPlay,
  Smartphone,
  Sparkles,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import Brand from '../components/Brand.jsx';
import Button from '../components/Button.jsx';
import Shape from '../components/Shape.jsx';
import { ANSWERS } from '../lib/answers.js';

const MOCK_OPTIONS = ['Venus', 'Mars', 'Jupiter', 'Mercury'];

const rise = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const STEPS = [
  {
    icon: FilePlus2,
    title: 'Build a quiz',
    text: 'Add questions, four answers each, and a timer. Or load the ready-made sample quiz.',
  },
  {
    icon: Smartphone,
    title: 'Share the PIN',
    text: 'Players join from any phone browser with a 6-digit code. No app, no account.',
  },
  {
    icon: Trophy,
    title: 'Race to the podium',
    text: 'Answer fast, stack points, and watch the leaderboard shift after every question.',
  },
];

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-arena">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Shape
          type="triangle"
          className="animate-float-slow absolute -left-10 top-40 h-40 w-40 rotate-12 text-white/[0.05]"
        />
        <Shape
          type="circle"
          className="animate-float-slow absolute -right-16 top-24 h-64 w-64 text-[#ffcc00]/[0.07] [animation-delay:-2s]"
        />
        <Shape
          type="diamond"
          className="animate-float-slow absolute bottom-24 left-1/3 hidden h-28 w-28 rotate-12 text-[#ff5fa2]/[0.08] lg:block"
        />
        <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-brand/25 blur-[120px]" />
      </div>

      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8 sm:py-6">
        <Brand />
        <nav className="flex items-center gap-2 text-sm sm:gap-3">
          <Link
            to="/join"
            className="rounded-full px-3 py-2 font-semibold text-white/75 transition hover:text-white sm:px-4"
          >
            Join game
          </Link>
          <Button as={Link} to="/create" variant="light" size="sm" className="rounded-full">
            Host a quiz
          </Button>
        </nav>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
        <section className="grid items-center gap-12 pt-6 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:pt-14">
          <motion.div
            initial="hidden"
            animate="show"
            transition={{ staggerChildren: 0.09 }}
            className="max-w-xl"
          >
            <motion.div
              variants={rise}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-inset ring-white/15"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Real-time multiplayer quizzes
            </motion.div>

            <motion.h1
              variants={rise}
              className="mt-5 font-display text-[clamp(2.6rem,7vw,4.5rem)] font-black leading-[0.98] tracking-tight text-balance"
            >
              Quiz night,
              <br />
              <span className="bg-gradient-to-r from-accent via-[#ffd75e] to-[#ff9d5c] bg-clip-text text-transparent">
                leveled up.
              </span>
            </motion.h1>

            <motion.p variants={rise} className="mt-5 max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
              Host a live quiz on the big screen. Everyone answers from their phone with a
              six-digit PIN, and the leaderboard updates in real time.
            </motion.p>

            <motion.div variants={rise} className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button as={Link} to="/create" size="lg" className="group">
                <MonitorPlay className="h-5 w-5" />
                Host a Quiz
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button as={Link} to="/join" size="lg" variant="glass">
                <Gamepad2 className="h-5 w-5 text-accent" />
                Join a Game
              </Button>
            </motion.div>

            <motion.ul
              variants={rise}
              className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-white/55"
            >
              <li className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-accent" /> No app downloads
              </li>
              <li className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-[#7dd3fc]" /> Up to 200 players
              </li>
              <li className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-[#f9a8d4]" /> Synced to the millisecond
              </li>
            </motion.ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40, rotate: -2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="relative mx-auto w-full max-w-md lg:max-w-[460px]"
          >
            <div
              className="absolute -inset-6 rounded-[2.75rem] bg-gradient-to-br from-brand/50 via-[#ff5fa2]/20 to-transparent blur-2xl"
              aria-hidden="true"
            />
            <div className="relative rounded-[2rem] glass card-glow p-4 sm:p-5">
              <div className="flex items-center justify-between text-[11px] font-semibold">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/75">
                  Question 2 of 8
                </span>
                <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-white/75">
                  <Clock3 className="h-3 w-3 text-accent" /> 18s
                </span>
              </div>

              <p className="mt-4 font-display text-lg font-extrabold leading-snug text-balance sm:text-xl">
                Which planet is known as the Red Planet?
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {ANSWERS.map((answer, i) => (
                  <div
                    key={answer.key}
                    className={`${answer.bg} flex items-center gap-2.5 rounded-xl px-3 py-3 shadow-md shadow-black/20`}
                  >
                    <Shape type={answer.shape} className="h-4 w-4 shrink-0 text-white/85" />
                    <span className="truncate text-sm font-semibold">{MOCK_OPTIONS[i]}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl bg-black/20 px-3 py-2.5 text-[11px]">
                <span className="font-mono tracking-[0.18em] text-white/60">PIN 428 913</span>
                <span className="flex items-center gap-1.5 font-semibold text-accent">
                  <Users className="h-3.5 w-3.5" /> 24 players in
                </span>
              </div>
            </div>

            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute -left-3 -top-5 flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-xs font-bold text-brand-night shadow-xl shadow-black/25 sm:-left-6"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-answer-green/15 text-answer-green">
                <Shape type="circle" className="h-3 w-3" />
              </span>
              Maya joined
            </motion.div>

            <motion.div
              animate={{ y: [0, 12, 0] }}
              transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
              className="absolute -bottom-6 -right-2 flex items-center gap-2 rounded-2xl bg-brand-night/90 px-3 py-2 text-xs font-bold text-white shadow-xl shadow-black/30 ring-1 ring-white/15 sm:-right-6"
            >
              <Trophy className="h-4 w-4 text-accent" />
              +940 pts
            </motion.div>
          </motion.div>
        </section>

        <section className="mt-20 grid gap-4 sm:grid-cols-3 sm:gap-5">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass rounded-3xl p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-accent">
                  <step.icon className="h-5 w-5" />
                </span>
                <span className="font-display text-3xl font-black text-white/10">0{i + 1}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-extrabold">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-white/60">{step.text}</p>
            </motion.div>
          ))}
        </section>

        <section className="mt-16 flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-r from-white/[0.08] to-white/[0.03] px-6 py-10 text-center ring-1 ring-inset ring-white/10">
          <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
            Ready when you are.
          </h2>
          <p className="max-w-lg text-sm text-white/60 sm:text-base">
            Load the sample quiz and go live in under a minute. Perfect for classrooms,
            game nights, and team socials.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button as={Link} to="/create">
              <MonitorPlay className="h-4 w-4" /> Host a Quiz
            </Button>
            <Button as={Link} to="/join" variant="outline">
              <Gamepad2 className="h-4 w-4" /> Join a Game
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative border-t border-white/10 px-5 py-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 text-xs text-white/40 sm:flex-row">
          <span>QuizBlitz — real-time quizzes built with React, Socket.IO and Tailwind CSS.</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-answer-green" /> Synced live
          </span>
        </div>
      </footer>
    </div>
  );
}
