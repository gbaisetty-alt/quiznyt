import { io } from 'socket.io-client';

const devFallback = `${window.location.protocol}//${window.location.hostname}:3001`;

export const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  (import.meta.env.DEV ? devFallback : window.location.origin);

export const socket = io(SERVER_URL, {
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 600,
  reconnectionDelayMax: 4000,
});

export function request(event, payload, timeoutMs = 10000) {
  return new Promise((resolve) => {
    if (!socket.connected) socket.connect();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, error: 'The server took too long to respond. Is it running?' });
    }, timeoutMs);

    const done = (response) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(response ?? { ok: false, error: 'No response from the server.' });
    };

    if (payload === undefined) socket.emit(event, done);
    else socket.emit(event, payload, done);
  });
}
