import { motion } from 'framer-motion';
import { WifiOff } from 'lucide-react';

const MEDALS = [
  'bg-accent text-brand-night',
  'bg-[#d7dee8] text-brand-night',
  'bg-[#d08a4a] text-white',
];

export default function LeaderboardList({ entries, meId, max = 5, className = '' }) {
  const visible = entries.slice(0, max);

  return (
    <ol className={`space-y-2 ${className}`}>
      {visible.map((player, i) => {
        const mine = player.id === meId;
        return (
          <motion.li
            key={player.id}
            layout
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i, type: 'spring', stiffness: 260, damping: 24 }}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 sm:px-4 ${
              mine
                ? 'bg-white/15 ring-1 ring-accent/70'
                : i < 3
                  ? 'bg-white/10'
                  : 'bg-white/5'
            }`}
          >
            <span
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl font-display text-sm font-extrabold ${
                MEDALS[i] ?? 'bg-white/10 text-white/80'
              }`}
            >
              {i + 1}
            </span>
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-semibold">
                {player.name}
                {mine && <span className="ml-1.5 text-xs font-bold text-accent">you</span>}
              </span>
              {!player.connected && (
                <WifiOff className="h-3.5 w-3.5 shrink-0 text-white/35" aria-label="disconnected" />
              )}
            </span>
            <span className="shrink-0 font-display font-extrabold tabular-nums">
              {player.score.toLocaleString()}
            </span>
          </motion.li>
        );
      })}
      {visible.length === 0 && (
        <li className="rounded-2xl bg-white/5 px-4 py-6 text-center text-sm text-white/50">
          No players on the board yet.
        </li>
      )}
    </ol>
  );
}
