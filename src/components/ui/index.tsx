import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react';

/*
 * plain in-house components (the coss/ui registry could not be installed
 * in non-interactive mode), in the landing's night charter: hairline boxes,
 * square corners, lime for the one thing that is on.
 */

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cx(
        'border border-line bg-night/70 backdrop-blur-[2px]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse bg-white/[0.06]', className)} aria-hidden="true" />;
}

type BadgeTone = 'lime' | 'neutral' | 'red';

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  const tones: Record<BadgeTone, string> = {
    lime: 'bg-brand-lime/[0.08] text-bone border-brand-lime/40',
    neutral: 'bg-night/70 text-smoke border-line',
    red: 'bg-red-500/10 text-red-400 border-red-500/30',
  };
  return (
    <span
      className={cx(
        'inline-flex items-center gap-2 text-[12.5px] lowercase px-3 py-1.5 border',
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

/** status dot (green / red / gray) */
export function Dot({ color }: { color: 'lime' | 'red' | 'gray' }) {
  const map = {
    lime: 'bg-brand-lime pulse-ring',
    red: 'bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.18)]',
    gray: 'bg-faint',
  };
  return <span className={cx('w-1.5 h-1.5 rounded-full flex-none', map[color])} />;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'lime';
};

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  /* The two black/white variants carry their relief (and their own transition)
     from index.css. `transition-colors` is deliberately NOT in the shared base:
     it is a utility, so it would beat the component class and kill the rim and
     shadow animation. Lime is flat and keeps it. */
  const variants = {
    primary: 'btn-raised',
    ghost: 'btn-raised-light',
    lime: 'bg-brand-lime text-night hover:bg-[#c4ff5a] transition-colors',
  };
  return (
    <button
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 text-sm lowercase font-medium px-4 py-2.5 disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        className
      )}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        'w-full bg-night border border-line px-4 py-2.5 text-[15px] text-ink placeholder-faint outline-none focus:border-brand-lime transition-colors',
        className
      )}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cx(
        'w-full bg-night border border-line px-4 py-2.5 text-[15px] text-ink placeholder-faint outline-none focus:border-brand-lime transition-colors resize-y',
        className
      )}
    />
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="block text-[12.5px] lowercase text-muted mb-1.5">{children}</label>;
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13.5px] text-red-400 bg-red-500/10 border border-red-500/30 px-3.5 py-2.5 lowercase">
      {children}
    </p>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-[13.5px] text-ink-soft bg-white/[0.03] border border-line px-3.5 py-2.5 lowercase">
      {children}
    </p>
  );
}
