import type { ReactNode } from 'react';

type Props = {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
};

/* The landing's bracket label. The capitals are CSS only: the copy stays
   lowercase in the source like everything else. */
export function Eyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-ash ${className}`}>
      [ {children} ]
    </p>
  );
}

/* Page header, the landing's split: serif title on the left, the paragraph
   bottom-aligned on the right. Kept short on purpose, the explorer's pages have
   to fit a screen and the header is the part nobody came for. */
export default function SectionHead({ eyebrow, title, children }: Props) {
  return (
    <div
      className={
        children
          ? 'grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] items-end gap-4 lg:gap-12'
          : ''
      }
    >
      <div>
        <Eyebrow className="mb-4">{eyebrow}</Eyebrow>
        {/* data-scramble: decodes as it mounts (src/lib/scramble.ts) */}
        <h1
          data-scramble
          className="font-serif font-normal text-[clamp(30px,3.4vw,48px)] leading-[1.05] tracking-[-0.03em] text-balance"
        >
          {title}
        </h1>
      </div>
      {children && (
        <p className="text-smoke text-[14px] leading-relaxed max-w-[420px] lg:mb-1.5">{children}</p>
      )}
    </div>
  );
}
