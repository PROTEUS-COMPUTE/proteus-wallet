import { useEffect, useState } from 'react';
import type { ApiPromise } from '@polkadot/api';
import { Skeleton } from '../ui';

const BLOCKS_PER_DAY = 7_200;

type Props = { api: ApiPromise | null };

export default function UnlockCountdown({ api }: Props) {
  const [end, setEnd] = useState<number | null>(null);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!api) return;
    let alive = true;
    let unsub: (() => void) | undefined;

    const store = (
      api.query as unknown as {
        subtensorModule?: {
          outflowLimitEnd?: {
            (): Promise<{ toNumber(): number }>;
          };
        };
      }
    ).subtensorModule?.outflowLimitEnd;

    if (!store) return;

    store()
      .then((v) => {
        if (alive) setEnd(v.toNumber());
      })
      .catch(() => undefined);

    api.rpc.chain
      .subscribeNewHeads((header) => {
        if (alive) setNow(header.number.toNumber());
      })
      .then((u) => {
        unsub = u;
      })
      .catch(() => undefined);

    return () => {
      alive = false;
      unsub?.();
    };
  }, [api]);

  if (!api) return null;
  if (end === null || now === null) {
    return <Skeleton className="h-9 w-full" />;
  }
  if (end === 0 || now >= end) return null;

  const days = Math.max(1, Math.ceil((end - now) / BLOCKS_PER_DAY));

  return (
    <div className="flex items-center gap-2.5 rounded-[8px] border border-brand-lime/35 bg-brand-lime/[0.07] px-3 py-2">
      <span className="w-[7px] h-[7px] rounded-sm bg-brand-lime shadow-[0_0_0_3px_rgba(159,255,0,0.18)] shrink-0" />
      <p className="text-[12.5px] lowercase text-ink-soft leading-snug">
        <span className="font-medium text-ink tabular-nums">D-{days}</span>
        {' '}until unlimited unstaking · 1.5% of holdings / day
      </p>
    </div>
  );
}
