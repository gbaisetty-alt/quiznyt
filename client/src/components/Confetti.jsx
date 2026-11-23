import { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = ['#ffcc00', '#e21b3c', '#1368ce', '#26890c', '#a78bfa', '#ff5fa2', '#ffffff'];

export default function Confetti({ count = 40 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.6,
        duration: 2.8 + Math.random() * 2.2,
        size: 7 + Math.random() * 8,
        color: COLORS[i % COLORS.length],
        rotate: (Math.random() > 0.5 ? 1 : -1) * (180 + Math.random() * 540),
        round: Math.random() > 0.7,
      })),
    [count],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.round ? '999px' : '2px',
          }}
          initial={{ y: '-8vh', opacity: 0, rotate: 0 }}
          animate={{ y: '108vh', opacity: [0, 1, 1, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn', repeat: Infinity, repeatDelay: 1.2 }}
        />
      ))}
    </div>
  );
}
