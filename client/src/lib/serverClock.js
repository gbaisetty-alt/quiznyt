import { socket } from './socket.js';

let offsetMs = 0;
let synced = false;

export function getServerOffset() {
  return synced ? offsetMs : null;
}

function sync() {
  if (!socket.connected) return;
  const sentAt = Date.now();
  socket.emit('time:sync', (res) => {
    if (!res?.serverNow) return;
    offsetMs = res.serverNow - (sentAt + Date.now()) / 2;
    synced = true;
  });
}

socket.on('connect', sync);
if (socket.connected) sync();
setInterval(() => {
  if (socket.connected) sync();
}, 30_000);
