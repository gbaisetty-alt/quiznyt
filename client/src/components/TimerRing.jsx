export default function TimerRing({
  secondsLeft,
  timeLimit,
  size = 88,
  strokeWidth = 9,
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const fraction = timeLimit > 0 ? Math.min(1, Math.max(0, secondsLeft / timeLimit)) : 0;
  const urgent = secondsLeft <= 5 && secondsLeft > 0;
  const done = secondsLeft <= 0;
  const color = done ? '#94a3b8' : urgent ? '#ff5470' : '#ffcc00';

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="timer"
      aria-live="off"
      aria-label={`${Math.ceil(secondsLeft)} seconds remaining`}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.16)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{ transition: 'stroke-dashoffset 120ms linear, stroke 300ms ease' }}
        />
      </svg>
      <div
        className={`absolute inset-0 grid place-items-center font-display font-extrabold tabular-nums ${
          size >= 80 ? 'text-3xl' : 'text-xl'
        } ${urgent ? 'text-[#ff8fa3]' : 'text-white'}`}
      >
        {Math.ceil(secondsLeft)}
      </div>
    </div>
  );
}
