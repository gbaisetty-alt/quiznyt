# QuizBlitz

A real-time, multiplayer live quiz game inspired by Kahoot. The host runs the game on a laptop or projector; players join from their phones with a 6-digit PIN and tap colored shapes to answer.

## Features

- Landing page with **Host a Quiz** and **Join a Game** flows
- Quiz builder: title, unlimited questions (up to 50), 4 answers each, correct answer, per-question timer (presets or any custom value from 10–60s)
- **ChatGPT quiz generation**: copy a ready-made prompt into [chatgpt.com](https://chatgpt.com), paste its JSON reply back, and the title, questions, options, answer key, and timers load into the editor. Works with no API key or account in the app; adding an OpenAI key enables one-click generation instead
- Pick-your-avatar join screen with a Wizarding-world set (wizard, witch, owl, serpent, lion, unicorn, dragon…) and animal favorites — avatars appear in the lobby, scoreboards, and podium
- Built-in sample quiz so you can play immediately
- Host lobby with a random 6-digit PIN, live-updating player list, copyable PIN and join link
- Live gameplay: countdown synchronized to the server clock every 30s (immune to device clock drift), answer-count tracking, early reveal when everyone answers
- Kahoot-style scoring: up to 1,000 points per correct answer based on response speed
- Answer reveal with a live bar chart of choices; per-player "Correct!" / "Wrong!" and points
- Top-5 leaderboard between questions and an animated 1st/2nd/3rd podium with confetti
- Mobile-first player UI (four large colored shape buttons, no answer text)
- Graceful disconnects: players are marked offline and keep their score; host has a 25s reconnect window; host can end the game cleanly
- Player refresh/reconnect support (session is restored automatically)

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS v4, Framer Motion, Lucide icons, React Router |
| Real-time server | Node.js, Express, Socket.IO |
| State | Server-authoritative game rooms in memory (no database required) |

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- All devices on the same network (for phone play)

## Run locally

```bash
npm install
npm run dev
```

- Client (Vite): http://localhost:5173
- Real-time server: http://localhost:3001

`npm run dev` runs both processes together with `concurrently`. The Vite dev server is exposed on your LAN (`host: true`), and the client automatically connects to the Socket.IO server on port 3001 of the same hostname.

### Production-style run

```bash
npm run build   # builds the React app into ./dist
npm start       # Express serves ./dist and Socket.IO on port 3001
```

Open http://localhost:3001.

### Play with phones

1. Start the app with `npm run dev` (or build + `npm start`).
2. Find your computer's LAN IP (e.g. `192.168.1.20`). On Windows: `ipconfig`.
3. Open the host on your laptop: `http://localhost:5173` (dev) or `http://localhost:3001` (prod).
4. Players open `http://192.168.1.20:5173/join` (dev) or `http://192.168.1.20:3001/join` (prod) and enter the PIN.
5. If phones cannot connect, allow Node.js through your firewall / keep both devices on the same Wi-Fi.

The host lobby also shows the exact join URL to copy.

## Deploy publicly (anyone can join)

GitHub Pages only serves static files, so it cannot host the Socket.IO server. Deploy the whole app as one Node service instead — the Express server serves the built React app and the real-time server on the same URL, which is what makes cross-device play work.

### Render (free tier, WebSockets supported)

The repo includes [render.yaml](render.yaml), so Render configures everything automatically.

1. Push this repo to GitHub.
2. Sign in at [render.com](https://render.com) and choose **New → Blueprint**.
3. Pick this repository. Render reads `render.yaml`, runs `npm ci && npm run build`, and starts `npm start`.
4. When the deploy finishes, open the `https://<service>.onrender.com` URL. That is the permanent host URL — share it with players.

Free instances sleep after ~15 minutes of inactivity and take 30–60 seconds to wake, so open the host page a minute before a game. Everything else (PIN join, live timers, scoring, leaderboard, podium) works the same as locally.

One-click shortcut after the repo exists:

```
https://render.com/deploy?repo=https://github.com/gbaisetty-alt/quiznyt
```

Alternative hosts that support Node + WebSockets: Railway, Fly.io, Heroku. Any of them just needs `npm run build` and `npm start`.

## ChatGPT quiz generation

The **Generate with ChatGPT** panel in the quiz builder works in two modes.

### No key needed: copy, ask, paste

1. Type a topic, pick the question count and difficulty, and press **Copy prompt**.
2. Press **Open ChatGPT**, paste the prompt, and send it.
3. Copy ChatGPT's reply and paste it into **Paste ChatGPT's reply** in QuizBlitz, then press **Import quiz**.

The importer accepts a bare JSON object, a JSON array of questions, a fenced code block, or JSON wrapped in ChatGPT's commentary. It also understands `correctIndex`, `correctAnswer` as "A"–"D", or the correct answer's exact text. Everything is validated before it replaces the editor's questions, and the result is fully editable.

### Optional: one-click generation with an OpenAI key

1. Create an API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys). A ChatGPT Plus subscription does **not** include API access — the key needs its own billing.
2. Add `OPENAI_API_KEY` as an environment variable on your host (Render: **Environment → Add Environment Variable**, then redeploy). `OPENAI_MODEL` defaults to `gpt-4o-mini`.
3. The panel detects the key and shows **Generate now**, which drafts the quiz in place. Locally: `OPENAI_API_KEY=sk-... npm start`.

The key never reaches the browser: generation goes through `POST /api/ai/quiz`, which is rate-limited to 5 requests per IP per 10 minutes, caps questions at 15, and validates the AI's JSON against the same rules as manually built quizzes. Each draft costs roughly $0.001–0.003 with `gpt-4o-mini`.

## How to play

1. **Host a Quiz** → build questions or press **Sample quiz** to load the 8-question starter pack.
2. Press **Create & host**. You'll get a 6-digit PIN.
3. Players open `/join`, enter the PIN and a nickname.
4. Press **Start game** once at least one player has joined.
5. Players tap a colored shape on their phone. Faster correct answers earn more points.
6. After each question the host reviews the answer chart, shows the Top 5, then advances.
7. Final animated podium crowns the winner. The host can start a new quiz or end the room.

### Scoring

```js
points = correct ? Math.round(1000 * (timeRemaining / totalTime)) : 0
```

`timeRemaining` is computed on the server from the question deadline, so the clock cannot be gamed from the client. Disconnected or unanswered players receive 0 for that question.

## Project structure

```
.
├── client/
│   ├── index.html
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx, App.jsx, index.css
│       ├── components/         # Brand, Shape, TimerRing, Confetti, LeaderboardList, Button
│       ├── lib/                # socket client, answer palette, session storage, countdown hook
│       └── pages/              # Landing, CreateQuiz, Join, HostGame, PlayerGame
├── server/
│   ├── index.js                # Express + Socket.IO game engine (rooms, timers, scoring)
│   └── sampleQuiz.js
├── render.yaml                 # zero-config Render deployment blueprint
└── package.json
```

## Socket.IO events

| Direction | Event | Purpose |
| --- | --- | --- |
| host → server | `host:create`, `host:rejoin`, `host:start`, `host:next`, `host:continue`, `host:end`, `host:leave` | Create/restore a room and drive the game loop |
| player → server | `player:join`, `player:rejoin`, `player:answer`, `player:leave` | Join, reconnect, answer a question, leave |
| any client → server | `time:sync` | Returns the server clock so every device's countdown agrees |
| server → room | `room:players`, `game:question`, `game:answerCount`, `game:reveal`, `game:leaderboard`, `game:podium`, `game:closed`, `game:hostAway`, `game:hostBack` | Broadcast authoritative state |

The server validates quiz payloads (1–50 questions, exactly 4 non-empty answers, one correct index, timer clamped to 10–60s), sanitizes nicknames/text, and enforces a 200-player room cap.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3001` | Socket.IO/Express server port |
| `VITE_SERVER_URL` | dev: `http://<current-host>:3001`, prod: same origin | Override the client's server URL if the API is hosted elsewhere |
| `OPENAI_API_KEY` | — | Optional; enables the one-click **Generate now** button. The copy/paste ChatGPT flow works without it |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI model used for one-click quiz drafts |

## Notes

- Rooms are in memory; restarting the server clears all games.
- A host refresh is recoverable (host token is kept per PIN in `localStorage`); if the host does not return within 25 seconds, the room closes and players are notified.
- Players keep their session in `sessionStorage` and are automatically re-seated after a refresh or network blip.
