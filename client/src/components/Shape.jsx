const SHAPES = {
  triangle: <polygon points="50,7 95,93 5,93" />,
  diamond: <polygon points="50,3 97,50 50,97 3,50" />,
  circle: <circle cx="50" cy="50" r="44" />,
  square: <rect x="8" y="8" width="84" height="84" rx="8" />,
};

export default function Shape({ type = 'circle', className = 'h-6 w-6' }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      {SHAPES[type] ?? SHAPES.circle}
    </svg>
  );
}
