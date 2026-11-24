import { getAvatar } from '../lib/avatars.js';

export default function Avatar({ id, size = 40, className = '' }) {
  const avatar = getAvatar(id);

  return (
    <span
      role="img"
      aria-label={avatar.label}
      title={avatar.label}
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full align-middle ${className}`}
      style={{
        width: size,
        height: size,
        backgroundColor: avatar.bg,
        fontSize: Math.round(size * 0.56),
        boxShadow:
          'inset 0 2px 6px rgba(255,255,255,0.28), inset 0 -3px 8px rgba(0,0,0,0.22)',
      }}
    >
      <span aria-hidden="true" className="leading-none" style={{ transform: 'translateY(1%)' }}>
        {avatar.emoji}
      </span>
    </span>
  );
}
