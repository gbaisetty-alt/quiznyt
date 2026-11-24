const LETTER_INDEX = { A: 0, B: 1, C: 2, D: 3 };

export function buildChatGptPrompt({ topic, count, difficulty, existingQuestions = [] }) {
  const alreadyAsked = existingQuestions.filter(Boolean).slice(0, 20);
  const avoid = alreadyAsked.length
    ? `\n- Do not duplicate or rephrase these questions already in the quiz:\n${alreadyAsked
        .map((question) => `  - ${question}`)
        .join('\n')}`
    : '';
  return `You are creating a multiple-choice quiz for a live classroom game.
Topic: ${topic}
Number of questions: ${count}
Difficulty: ${difficulty}

Reply with ONLY a JSON object in this exact shape, with no commentary and no markdown:
{"title":"Short quiz title","questions":[{"text":"Question?","options":["First option","Second option","Third option","Fourth option"],"correctIndex":0,"timeLimit":20}]}

Rules:
- Exactly ${count} questions.
- Exactly 4 options per question and one correct answer.
- correctIndex is the 0-based index of the correct option (0, 1, 2, or 3).
- timeLimit is a whole number of seconds between 10 and 30.
- Questions under 200 characters, options under 80 characters.
- Factual, unambiguous, and age-appropriate.${avoid}`;
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
  } catch {
    // fall back to the legacy path below
  }
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(el);
  if (!ok) throw new Error('copy failed');
}

export function extractQuizJson(text) {
  const source = String(text ?? '');
  const candidates = [];
  const fence = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1]);
  candidates.push(source);

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      return JSON.parse(trimmed);
    } catch {
      // keep trying slices below
    }
    for (const [open, close] of [
      ['{', '}'],
      ['[', ']'],
    ]) {
      const start = trimmed.indexOf(open);
      const end = trimmed.lastIndexOf(close);
      if (start === -1 || end <= start) continue;
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // try the next shape
      }
    }
  }
  throw new Error('No quiz JSON found in that reply. Ask ChatGPT for the JSON object and paste the whole message.');
}

const clean = (value, max) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

function optionText(option) {
  if (typeof option === 'string') return option;
  if (option && typeof option === 'object') {
    return option.text ?? option.answer ?? option.value ?? option.label ?? '';
  }
  return '';
}

function resolveCorrectIndex(question, options, rawOptions) {
  const raw =
    question.correctIndex ??
    question.correct_index ??
    question.answerIndex ??
    question.correct ??
    question.answer ??
    question.correctAnswer;
  if (Number.isInteger(raw) && raw >= 0 && raw <= 3) return raw;
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (/^[A-Da-d]$/.test(value)) return LETTER_INDEX[value.toUpperCase()];
    if (/^[A-Da-d][).:]$/.test(value)) return LETTER_INDEX[value[0].toUpperCase()];
    const digit = Number(value);
    if (Number.isInteger(digit) && digit >= 0 && digit <= 3) return digit;
    const match = options.findIndex(
      (option) => option.toLowerCase() === value.toLowerCase(),
    );
    if (match !== -1) return match;
  }
  const flagged = rawOptions.findIndex(
    (option) => option && typeof option === 'object' && option.correct === true,
  );
  return flagged === -1 ? null : flagged;
}

export function normalizeImportedQuiz(raw) {
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw.quiz ?? raw) : raw;
  const list = Array.isArray(source) ? source : source?.questions;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('That reply does not contain any questions.');
  }
  if (list.length > 50) {
    throw new Error('That reply has more than 50 questions. Ask for 15 or fewer.');
  }
  const title = clean(source?.title ?? source?.name, 80) || 'ChatGPT Quiz';
  const questions = list.map((question, index) => {
    const text = clean(question?.text ?? question?.question ?? question?.prompt, 200);
    if (!text) throw new Error(`Question ${index + 1} has no question text.`);
    const rawOptions = question?.options ?? question?.answers ?? question?.choices;
    if (!Array.isArray(rawOptions) || rawOptions.length !== 4) {
      throw new Error(`Question ${index + 1} must have exactly 4 options.`);
    }
    const options = rawOptions.map((option) => clean(optionText(option), 80));
    if (options.some((option) => !option)) {
      throw new Error(`Question ${index + 1} has an empty option.`);
    }
    const correctIndex = resolveCorrectIndex(question, options, rawOptions);
    if (correctIndex === null) {
      throw new Error(
        `Question ${index + 1} is missing a valid correct answer. Ask ChatGPT to use correctIndex 0-3.`,
      );
    }
    const seconds = Number(question?.timeLimit ?? question?.time ?? question?.seconds ?? 20);
    const timeLimit = Number.isFinite(seconds)
      ? Math.min(60, Math.max(10, Math.round(seconds)))
      : 20;
    return { text, options, correctIndex, timeLimit };
  });
  return { title, questions };
}
