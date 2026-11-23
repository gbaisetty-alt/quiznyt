import { Link } from 'react-router-dom';
import { Zap } from 'lucide-react';

export default function Brand({ to = '/', compact = false }) {
  return (
    <Link
      to={to}
      className="group inline-flex items-center gap-2.5 rounded-xl outline-offset-4"
      aria-label="QuizBlitz home"
    >
      <span
        className={`relative grid place-items-center rounded-2xl bg-gradient-to-br from-accent to-[#ffb300] text-brand-night shadow-lg shadow-black/25 transition-transform duration-300 group-hover:-rotate-6 ${
          compact ? 'h-8 w-8' : 'h-10 w-10'
        }`}
      >
        <Zap
          className={compact ? 'h-4 w-4' : 'h-5 w-5'}
          fill="currentColor"
          strokeWidth={2.5}
        />
      </span>
      <span
        className={`font-display font-extrabold tracking-tight ${
          compact ? 'text-lg' : 'text-xl sm:text-2xl'
        }`}
      >
        Quiz<span className="text-accent">Blitz</span>
      </span>
    </Link>
  );
}
