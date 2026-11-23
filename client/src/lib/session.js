const PLAYER_KEY = 'quizblitz:player';
const hostTokenKey = (pin) => `quizblitz:host:${pin}`;

export function savePlayerSession(session) {
  sessionStorage.setItem(PLAYER_KEY, JSON.stringify(session));
}

export function loadPlayerSession() {
  try {
    const raw = sessionStorage.getItem(PLAYER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.pin || !parsed?.playerId || !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPlayerSession() {
  sessionStorage.removeItem(PLAYER_KEY);
}

export function saveHostToken(pin, token) {
  localStorage.setItem(hostTokenKey(pin), token);
}

export function loadHostToken(pin) {
  return localStorage.getItem(hostTokenKey(pin));
}

export function clearHostToken(pin) {
  localStorage.removeItem(hostTokenKey(pin));
}
