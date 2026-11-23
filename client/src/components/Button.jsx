import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary:
    'bg-accent text-brand-night hover:bg-[#ffd83d] shadow-lg shadow-black/25 disabled:bg-accent/50',
  light: 'bg-white text-brand-night hover:bg-white/90 shadow-lg shadow-black/20',
  glass:
    'bg-white/10 text-white ring-1 ring-inset ring-white/15 hover:bg-white/15 disabled:opacity-50',
  outline:
    'bg-transparent text-white ring-1 ring-inset ring-white/25 hover:bg-white/10 disabled:opacity-50',
};

const SIZES = {
  sm: 'px-3.5 py-2 text-sm rounded-xl gap-1.5',
  md: 'px-5 py-3 text-sm sm:text-base rounded-2xl gap-2',
  lg: 'px-6 py-4 text-base sm:text-lg rounded-2xl gap-2.5',
};

export default function Button({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled = false,
  children,
  ...props
}) {
  return (
    <Component
      className={`inline-flex items-center justify-center font-display font-bold tracking-tight transition-all duration-200 active:translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      disabled={Component === 'button' ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </Component>
  );
}
