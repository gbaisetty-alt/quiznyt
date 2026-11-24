import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ClipboardPaste,
  Clock,
  Copy,
  ExternalLink,
  ListChecks,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import Brand from '../components/Brand.jsx';
import Button from '../components/Button.jsx';
import Shape from '../components/Shape.jsx';
import { SERVER_URL, request } from '../lib/socket.js';
import { saveHostToken } from '../lib/session.js';
import { ANSWERS } from '../lib/answers.js';
import {
  buildChatGptPrompt,
  copyText,
  extractQuizJson,
  normalizeImportedQuiz,
} from '../lib/quizImport.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const TIME_OPTIONS = [10, 15, 20, 30];
const MAX_QUESTIONS = 50;

const questionHasContent = (question) =>
  Boolean(
    question.text.trim() ||
      question.options.some((option) => option.trim()) ||
      question.correctIndex !== null,
  );

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  `q-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function blankQuestion(overrides = {}) {
  return {
    id: uid(),
    text: '',
    options: ['', '', '', ''],
    correctIndex: null,
    timeLimit: 20,
    ...overrides,
  };
}

function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

function QuestionEditor({ question, index, count, onChange, onOptionChange, onRemove }) {
  const [customSeconds, setCustomSeconds] = useState(String(question.timeLimit));

  useEffect(() => {
    setCustomSeconds(String(question.timeLimit));
  }, [question.timeLimit]);

  const handleCustomChange = (raw) => {
    setCustomSeconds(raw);
    const seconds = Number(raw);
    if (!raw || !Number.isFinite(seconds) || seconds < 10 || seconds > 60) return;
    onChange({ timeLimit: Math.round(seconds) });
  };

  const commitCustom = () => {
    const seconds = Number(customSeconds);
    const clamped = Number.isFinite(seconds) ? Math.min(60, Math.max(10, Math.round(seconds))) : 20;
    setCustomSeconds(String(clamped));
    onChange({ timeLimit: clamped });
  };

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="glass rounded-3xl p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-[10px] font-black text-brand-night">
            {index + 1}
          </span>
          Question
        </span>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-full bg-white/5 p-1 ring-1 ring-inset ring-white/10">
            <Clock className="ml-1.5 h-3.5 w-3.5 text-white/40" aria-hidden="true" />
            {TIME_OPTIONS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                onClick={() => onChange({ timeLimit: seconds })}
                aria-pressed={question.timeLimit === seconds}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                  question.timeLimit === seconds
                    ? 'bg-accent text-brand-night'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {seconds}s
              </button>
            ))}
          </div>
          <label
            className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-[11px] font-bold text-white/50 ring-1 ring-inset ring-white/10 focus-within:ring-accent/60"
            title="Any time from 10 to 60 seconds"
          >
            <input
              type="number"
              min={10}
              max={60}
              step={1}
              value={customSeconds}
              onChange={(e) => handleCustomChange(e.target.value)}
              onBlur={commitCustom}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitCustom();
                  e.currentTarget.blur();
                }
              }}
              className="w-9 bg-transparent text-center tabular-nums text-white focus:outline-none"
              aria-label="Custom time limit in seconds, 10 to 60"
            />
            <span aria-hidden="true">s</span>
          </label>
          <button
            type="button"
            onClick={onRemove}
            disabled={count === 1}
            aria-label={`Remove question ${index + 1}`}
            className="grid h-8 w-8 place-items-center rounded-xl text-white/40 transition hover:bg-answer-red/20 hover:text-[#ff9db0] disabled:cursor-not-allowed disabled:opacity-20"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <label className="sr-only" htmlFor={`q-${question.id}`}>
        Question {index + 1}
      </label>
      <textarea
        id={`q-${question.id}`}
        value={question.text}
        onChange={(e) => onChange({ text: e.target.value.slice(0, 200) })}
        rows={2}
        maxLength={200}
        placeholder="What do you want to ask?"
        className="mt-3 w-full resize-none rounded-2xl bg-white/5 p-3.5 text-base font-semibold leading-snug ring-1 ring-inset ring-white/10 transition placeholder:font-normal placeholder:text-white/25 focus:bg-white/10 focus:outline-none focus:ring-2 focus:ring-accent/60"
      />

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {question.options.map((option, i) => {
          const meta = ANSWERS[i];
          const selected = question.correctIndex === i;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-2xl p-2 pl-2.5 transition ${
                selected ? 'bg-white/10' : 'bg-white/5 hover:bg-white/[0.08]'
              }`}
              style={{
                boxShadow: `inset 0 0 0 ${selected ? 2 : 1}px ${
                  selected ? meta.hex : 'rgba(255,255,255,0.1)'
                }`,
              }}
            >
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white"
                style={{ backgroundColor: meta.hex }}
                aria-hidden="true"
              >
                <Shape type={meta.shape} className="h-4 w-4 text-white/90" />
              </span>
              <input
                value={option}
                onChange={(e) => onOptionChange(i, e.target.value.slice(0, 80))}
                maxLength={80}
                placeholder={`Answer ${LETTERS[i]}`}
                aria-label={`Question ${index + 1} answer ${LETTERS[i]}`}
                className="min-w-0 flex-1 bg-transparent py-2 text-sm font-semibold placeholder:font-normal placeholder:text-white/25 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onChange({ correctIndex: i })}
                aria-pressed={selected}
                aria-label={`Mark answer ${LETTERS[i]} as correct`}
                title="Mark as correct"
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ring-inset transition ${
                  selected
                    ? 'bg-white text-brand-night ring-white'
                    : 'text-white/30 ring-white/20 hover:text-white hover:ring-white/45'
                }`}
              >
                <Check className="h-4 w-4" strokeWidth={selected ? 3 : 2} />
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 flex items-center gap-1.5 pl-1 text-[11px] text-white/35">
        <Check className="h-3 w-3" />
        {question.correctIndex === null
          ? 'Tap the check on the correct answer.'
          : `Answer ${LETTERS[question.correctIndex]} is marked correct.`}
      </p>
    </motion.section>
  );
}

export default function CreateQuiz() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState(() => [blankQuestion()]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);
  const [aiTopic, setAiTopic] = useState('');
  const [aiCount, setAiCount] = useState(8);
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiNotice, setAiNotice] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiMode, setAiMode] = useState('add');
  const [pasteText, setPasteText] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch(`${SERVER_URL}/api/ai/status`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAiEnabled(Boolean(data?.enabled));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const preparedQuestions = aiMode === 'add' ? questions.filter(questionHasContent) : [];

  const aiPromptPreview = buildChatGptPrompt({
    topic: aiTopic.trim() || 'your topic',
    count: aiCount,
    difficulty: aiDifficulty,
    existingQuestions: preparedQuestions
      .map((question) => question.text.trim())
      .filter(Boolean)
      .slice(0, 20),
  });

  function applyDraft(draft) {
    const base = aiMode === 'add' ? questions.filter(questionHasContent) : [];
    const incoming = draft.questions.map((question) =>
      blankQuestion({
        text: question.text,
        options: [...question.options],
        correctIndex: question.correctIndex,
        timeLimit: question.timeLimit,
      }),
    );
    if (base.length + incoming.length > MAX_QUESTIONS) {
      throw new Error(
        `That would make ${base.length + incoming.length} questions, but quizzes hold at most ${MAX_QUESTIONS}. Ask for fewer.`,
      );
    }
    setQuestions([...base, ...incoming]);
    setTitle(aiMode === 'add' ? title.trim() || draft.title : draft.title);
    setError('');
    return base.length + incoming.length;
  }

  async function copyPrompt() {
    setAiError('');
    setAiNotice('');
    if (!aiTopic.trim()) {
      setAiError('Describe a topic first, like "The solar system for grade 7".');
      return;
    }
    try {
      await copyText(aiPromptPreview);
      setAiNotice('Prompt copied. Paste it into ChatGPT, then paste the reply below.');
    } catch {
      setAiError('Could not copy automatically. Open the prompt preview and copy it manually.');
    }
  }

  function importReply() {
    setAiError('');
    setAiNotice('');
    if (!pasteText.trim()) {
      setAiError('Paste ChatGPT\u2019s reply first.');
      return;
    }
    try {
      const quiz = normalizeImportedQuiz(extractQuizJson(pasteText));
      const total = applyDraft(quiz);
      setPasteText('');
      const summary =
        aiMode === 'add'
          ? `Added ${quiz.questions.length} questions — ${total} total.`
          : `Imported ${quiz.questions.length} questions.`;
      setAiNotice(`${summary} Review them below, then press Create & host.`);
    } catch (err) {
      setAiError(err.message);
    }
  }

  const totalSeconds = questions.reduce((sum, q) => sum + Number(q.timeLimit || 0), 0);

  const updateQuestion = (id, patch) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const updateOption = (id, optionIndex, value) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === id
          ? { ...q, options: q.options.map((opt, i) => (i === optionIndex ? value : opt)) }
          : q,
      ),
    );

  const addQuestion = () => setQuestions((prev) => [...prev, blankQuestion()]);

  const removeQuestion = (id) =>
    setQuestions((prev) => (prev.length === 1 ? prev : prev.filter((q) => q.id !== id)));

  async function loadSample() {
    setSampleBusy(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/sample-quiz`);
      if (!res.ok) throw new Error('bad response');
      const data = await res.json();
      setTitle(data.title);
      setQuestions(
        data.questions.map((q) =>
          blankQuestion({
            text: q.text,
            options: [...q.options],
            correctIndex: q.correctIndex,
            timeLimit: q.timeLimit,
          }),
        ),
      );
    } catch {
      setError('Could not load the sample quiz. Make sure the real-time server is running.');
    } finally {
      setSampleBusy(false);
    }
  }

  async function generateWithAI() {
    if (!aiTopic.trim()) {
      setAiError('Describe a topic first, like "The solar system for grade 7".');
      return;
    }
    if (aiMode === 'add' && preparedQuestions.length + aiCount > MAX_QUESTIONS) {
      setAiError(
        `You already have ${preparedQuestions.length} questions; asking for ${aiCount} more would pass the ${MAX_QUESTIONS}-question limit.`,
      );
      return;
    }
    setAiError('');
    setAiNotice('');
    setAiBusy(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/ai/quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic.trim(),
          count: aiCount,
          difficulty: aiDifficulty,
          existing:
            aiMode === 'add'
              ? preparedQuestions
                  .map((question) => question.text.trim())
                  .filter(Boolean)
                  .slice(0, 20)
              : [],
        }),
        signal: AbortSignal.timeout(60_000),
      });
      const data = await res.json().catch(() => null);
      if (!data?.ok || !data.quiz) {
        setAiError(data?.error || 'Could not generate a quiz. Try again.');
        return;
      }
      try {
        const total = applyDraft(data.quiz);
        const summary =
          aiMode === 'add'
            ? `Added ${data.quiz.questions.length} questions — ${total} total.`
            : `Generated ${data.quiz.questions.length} questions.`;
        setAiNotice(`${summary} Review them below, then press Create & host.`);
      } catch (err) {
        setAiError(err.message);
      }
    } catch {
      setAiError('Could not reach the AI service. Check your connection and try again.');
    } finally {
      setAiBusy(false);
    }
  }

  function validate() {
    if (!title.trim()) return 'Give your quiz a title first.';
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i];
      if (!q.text.trim()) return `Question ${i + 1} needs a question.`;
      const blank = q.options.findIndex((opt) => !opt.trim());
      if (blank !== -1) return `Question ${i + 1} is missing answer ${LETTERS[blank]}.`;
      if (q.correctIndex === null) return `Mark the correct answer for question ${i + 1}.`;
    }
    return null;
  }

  async function handleCreate() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setBusy(true);
    const quiz = {
      title: title.trim(),
      questions: questions.map((q) => ({
        text: q.text.trim(),
        options: q.options.map((opt) => opt.trim()),
        correctIndex: q.correctIndex,
        timeLimit: q.timeLimit,
      })),
    };
    const res = await request('host:create', { quiz });
    setBusy(false);
    if (!res.ok) {
      setError(res.error || 'Could not create the game.');
      return;
    }
    saveHostToken(res.pin, res.hostToken);
    navigate(`/host/${res.pin}`);
  }

  return (
    <div className="min-h-dvh bg-arena pb-28 lg:pb-16">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-brand-night/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Brand compact />
          <div className="flex items-center gap-2">
            <Button
              variant="glass"
              size="sm"
              onClick={loadSample}
              loading={sampleBusy}
              className="rounded-full"
            >
              {!sampleBusy && <Sparkles className="h-4 w-4 text-accent" />}
              Sample quiz
            </Button>
            <Link
              to="/"
              className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-white/60 transition hover:bg-white/10 hover:text-white sm:flex"
            >
              <ArrowLeft className="h-4 w-4" /> Home
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-8 pt-6 sm:px-8 sm:pt-8">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl font-black tracking-tight sm:text-4xl">
            Build your quiz
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/60 sm:text-base">
            Add four answers per question, mark the correct one, and pick a countdown. Let AI
            draft it from a topic, or grab the sample quiz if you just want to play right now.
          </p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 20 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              role="alert"
              className="flex items-start gap-2 overflow-hidden rounded-2xl bg-answer-red/15 px-4 py-3 text-sm text-[#ffb3c1] ring-1 ring-inset ring-answer-red/30"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <button
                type="button"
                onClick={() => setError('')}
                aria-label="Dismiss error"
                className="rounded-md p-0.5 text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <section className="glass rounded-3xl p-5 transition focus-within:ring-1 focus-within:ring-accent/40">
              <label
                htmlFor="quiz-title"
                className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45"
              >
                Quiz title
              </label>
              <input
                id="quiz-title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                maxLength={80}
                placeholder="Friday Night Brain Battle"
                className="mt-1.5 w-full bg-transparent font-display text-2xl font-extrabold tracking-tight placeholder:text-white/20 focus:outline-none sm:text-3xl"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-white/30">
                <span>This is what players see when they join.</span>
                <span>{title.length}/80</span>
              </div>
            </section>

            <section className="rounded-3xl bg-gradient-to-br from-accent/15 via-white/[0.06] to-white/[0.03] p-4 ring-1 ring-inset ring-accent/25 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-xl bg-accent/20 text-accent">
                  <Wand2 className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-bold">Generate with ChatGPT</h2>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white/50">
                  {aiEnabled ? 'API ready' : 'No API key'}
                </span>
                <div
                  role="group"
                  aria-label="How to apply the AI questions"
                  className="ml-auto flex items-center gap-0.5 rounded-full bg-white/5 p-0.5 ring-1 ring-inset ring-white/10"
                >
                  {[
                    ['add', 'Add'],
                    ['replace', 'Replace'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAiMode(value)}
                      aria-pressed={aiMode === value}
                      title={
                        value === 'add'
                          ? 'Keep your questions and add the AI ones after them'
                          : 'Replace every question with the AI ones'
                      }
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition ${
                        aiMode === value
                          ? 'bg-accent text-brand-night'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-white/50">
                Set a topic, copy the ready-made prompt into ChatGPT, then paste its reply
                here.{' '}
                {aiMode === 'add'
                  ? 'New questions are added after the ones you prepared, and the prompt avoids repeating them.'
                  : 'The reply replaces every question below.'}{' '}
                No account or key needed in this app.
              </p>

              <div className="mt-3 flex flex-col gap-2 lg:flex-row">
                <input
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value.slice(0, 120))}
                  maxLength={120}
                  placeholder="e.g. Harry Potter trivia, space, world capitals"
                  aria-label="Topic for AI quiz generation"
                  className="min-w-0 flex-1 rounded-xl bg-white/10 px-3.5 py-2.5 text-sm ring-1 ring-inset ring-white/15 transition placeholder:text-white/30 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent/60"
                />
                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-2 text-[11px] font-bold text-white/60 ring-1 ring-inset ring-white/15">
                    <span className="sr-only">Number of questions</span>
                    <select
                      value={aiCount}
                      onChange={(e) => setAiCount(Number(e.target.value))}
                      className="bg-transparent font-bold text-white focus:outline-none"
                    >
                      {[5, 8, 10, 12, 15].map((n) => (
                        <option key={n} value={n} className="bg-brand-night">
                          {n} Qs
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-2 text-[11px] font-bold text-white/60 ring-1 ring-inset ring-white/15">
                    <span className="sr-only">Difficulty</span>
                    <select
                      value={aiDifficulty}
                      onChange={(e) => setAiDifficulty(e.target.value)}
                      className="bg-transparent font-bold capitalize text-white focus:outline-none"
                    >
                      {['easy', 'medium', 'hard'].map((level) => (
                        <option key={level} value={level} className="bg-brand-night">
                          {level}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button size="sm" onClick={copyPrompt} className="shrink-0">
                    <Copy className="h-4 w-4" /> Copy prompt
                  </Button>
                  <a
                    href="https://chatgpt.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold text-white/70 ring-1 ring-inset ring-white/20 transition hover:bg-white/10 hover:text-white"
                  >
                    Open ChatGPT <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {aiEnabled && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateWithAI}
                      loading={aiBusy}
                      className="shrink-0"
                    >
                      {!aiBusy && <Sparkles className="h-4 w-4" />}
                      {aiBusy ? 'Drafting…' : 'Generate now'}
                    </Button>
                  )}
                </div>
              </div>

              {aiNotice && (
                <p role="status" className="mt-2 text-xs font-medium text-[#9ef0b8]">
                  {aiNotice}
                </p>
              )}
              {aiError && (
                <p role="alert" className="mt-2 text-xs font-medium text-[#ffb3c1]">
                  {aiError}
                </p>
              )}

              <details className="mt-3 rounded-xl bg-black/20 px-3 py-2 text-xs text-white/45">
                <summary className="cursor-pointer font-semibold text-white/60">
                  Preview the prompt
                </summary>
                <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-white/55">
                  {aiPromptPreview}
                </pre>
              </details>

              <div className="mt-4 border-t border-white/10 pt-3">
                <label
                  htmlFor="ai-paste"
                  className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45"
                >
                  Paste ChatGPT&apos;s reply
                </label>
                <textarea
                  id="ai-paste"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  rows={4}
                  placeholder="Paste the whole reply. I'll find the JSON even if it's wrapped in text or a code block."
                  className="mt-1.5 w-full resize-y rounded-xl bg-white/10 px-3.5 py-2.5 font-mono text-xs ring-1 ring-inset ring-white/15 transition placeholder:font-sans placeholder:text-white/30 focus:bg-white/15 focus:outline-none focus:ring-2 focus:ring-accent/60"
                />
                <Button size="sm" onClick={importReply} className="mt-2 w-full sm:w-auto">
                  <ClipboardPaste className="h-4 w-4" /> Import quiz
                </Button>
              </div>
            </section>

            <div className="space-y-3">
              {questions.map((question, index) => (
                <QuestionEditor
                  key={question.id}
                  question={question}
                  index={index}
                  count={questions.length}
                  onChange={(patch) => updateQuestion(question.id, patch)}
                  onOptionChange={(optIndex, value) =>
                    updateOption(question.id, optIndex, value)
                  }
                  onRemove={() => removeQuestion(question.id)}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={addQuestion}
              className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-white/15 py-4 text-sm font-bold text-white/60 transition hover:border-accent/50 hover:bg-white/5 hover:text-white"
            >
              <Plus className="h-4 w-4" /> Add another question
            </button>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-4">
              <div className="glass rounded-3xl p-5">
                <h2 className="font-display text-lg font-extrabold">Quiz summary</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-white/50">Title</dt>
                    <dd className="max-w-[190px] truncate text-right font-semibold">
                      {title.trim() || 'Untitled quiz'}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-white/50">Questions</dt>
                    <dd className="font-semibold">{questions.length}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-white/50">Time on the clock</dt>
                    <dd className="font-semibold">{formatDuration(totalSeconds)}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="text-white/50">Max points</dt>
                    <dd className="font-semibold text-accent">
                      {(questions.length * 1000).toLocaleString()}
                    </dd>
                  </div>
                </dl>
                <Button size="lg" onClick={handleCreate} loading={busy} className="mt-5 w-full">
                  {!busy && <Play className="h-5 w-5" fill="currentColor" />}
                  {busy ? 'Creating game…' : 'Create & host'}
                </Button>
                <p className="mt-3 text-center text-[11px] text-white/35">
                  You will get a 6-digit PIN to share with players.
                </p>
              </div>

              <div className="rounded-3xl bg-white/[0.04] p-5 text-sm leading-relaxed text-white/50 ring-1 ring-inset ring-white/10">
                <p className="flex items-center gap-2 font-semibold text-white/75">
                  <ListChecks className="h-4 w-4 text-accent" /> Quick tips
                </p>
                <ul className="mt-2.5 space-y-2">
                  <li>Keep questions short so they read well on a projector.</li>
                  <li>Speed counts: faster correct answers score more.</li>
                  <li>Players only see the four colored shapes on their phones.</li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-brand-night/85 px-4 pt-3 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="min-w-0 flex-1 text-xs text-white/50">
            <p className="truncate font-semibold text-white/80">{title.trim() || 'Untitled quiz'}</p>
            {questions.length} questions · {formatDuration(totalSeconds)}
          </div>
          <Button onClick={handleCreate} loading={busy} className="shrink-0">
            {!busy && <Play className="h-4 w-4" fill="currentColor" />}
            {busy ? 'Creating…' : 'Create & host'}
          </Button>
        </div>
      </div>
    </div>
  );
}
