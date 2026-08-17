import type { ReactNode } from 'react';

type Props = {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
};

export default function SectionHead({ eyebrow, title, children }: Props) {
  return (
    <div className="max-w-[680px]">
      <span className="inline-flex items-center gap-2.5 text-[12.5px] lowercase text-muted">
        <span className="w-[7px] h-[7px] rounded-sm bg-brand-lime shadow-[0_0_0_3px_rgba(159,255,0,0.18)]" />
        {eyebrow}
      </span>
      <h1 className="font-display font-light text-[clamp(28px,3.8vw,46px)] tracking-tight leading-[1.08] mt-4 mb-[14px]">
        {title}
      </h1>
      {children && <p className="text-ink-soft text-[16px]">{children}</p>}
    </div>
  );
}
