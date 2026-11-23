import { useEffect, useMemo, useState } from 'react';
import { getServerOffset } from './serverClock.js';

export function useCountdown(payload) {
  const timeLimit = payload?.timeLimit ?? 0;
  const endsAt = payload?.endsAt;
  const serverNow = payload?.serverNow;

  const snapshotOffset = useMemo(
    () => (serverNow && endsAt ? serverNow - Date.now() : null),
    [endsAt, serverNow],
  );

  const [secondsLeft, setSecondsLeft] = useState(timeLimit);

  useEffect(() => {
    if (!endsAt) {
      setSecondsLeft(0);
      return undefined;
    }
    const tick = () => {
      const offset = getServerOffset() ?? snapshotOffset ?? 0;
      setSecondsLeft(Math.max(0, (endsAt - (Date.now() + offset)) / 1000));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt, snapshotOffset]);

  return {
    secondsLeft,
    timeLimit,
    fraction: timeLimit > 0 ? Math.min(1, Math.max(0, secondsLeft / timeLimit)) : 0,
    expired: endsAt !== undefined && secondsLeft <= 0,
  };
}
